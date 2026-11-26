BEGIN;

ALTER TABLE public.orders ADD COLUMN checkout_price_grosze jsonb;

CREATE TABLE public.checkout_requests (
  key uuid PRIMARY KEY,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkout_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.checkout_requests TO service_role;

CREATE FUNCTION public.sisi_create_checkout(
  request_key uuid,
  request_fingerprint text,
  order_data jsonb,
  order_lines jsonb,
  price jsonb,
  expected_grosze bigint,
  requested_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  previous public.checkout_requests;
  restaurant_open boolean;
  settings public.order_settings;
  placed public.orders;
  candidate public.discount_codes;
  selected_code public.discount_codes;
  discount_grosze bigint := 0;
  candidate_grosze bigint;
  products_grosze bigint := (price->>'products')::bigint;
  packaging_grosze bigint := (price->>'packaging')::bigint;
  delivery_grosze bigint := (price->>'delivery')::bigint;
  deposit_grosze bigint := (price->>'deposit')::bigint;
  base_grosze bigint := products_grosze + packaging_grosze + delivery_grosze;
  amount_grosze bigint;
  all_uses bigint;
  user_uses bigint;
  email_uses bigint;
  result jsonb;
  checkout_time timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('sisi.checkout:' || request_key::text, 0));
  SELECT * INTO previous FROM public.checkout_requests WHERE key = request_key;
  IF FOUND THEN
    IF previous.fingerprint <> request_fingerprint THEN RETURN '{"status":"KEY_CONFLICT"}'; END IF;
    IF previous.order_id IS NULL THEN RETURN '{"status":"ORDER_UNAVAILABLE"}'; END IF;
    RETURN previous.result || '{"replayed":true}';
  END IF;

  -- Same lock order as sisi_update_order_availability. Hold both read locks
  -- until COMMIT so closing and checkout have an unambiguous order.
  SELECT ordering_open INTO restaurant_open FROM public.restaurant_info WHERE id = 1 FOR SHARE;
  IF restaurant_open IS DISTINCT FROM true THEN RETURN '{"status":"CLOSED"}'; END IF;

  BEGIN
    SELECT * INTO STRICT settings FROM public.order_settings FOR SHARE;
  EXCEPTION WHEN no_data_found OR too_many_rows THEN
    RETURN '{"status":"CLOSED"}';
  END;

  IF settings.orders_enabled IS DISTINCT FROM true OR
     (CASE order_data->>'selected_option'
        WHEN 'local' THEN settings.local_enabled
        WHEN 'takeaway' THEN settings.takeaway_enabled
        WHEN 'delivery' THEN settings.delivery_enabled
        ELSE false
      END) IS DISTINCT FROM true THEN
    RETURN '{"status":"CLOSED"}';
  END IF;

  placed := jsonb_populate_record(NULL::public.orders, order_data);
  checkout_time := clock_timestamp();

  -- Every checkout using a code takes the same row lock before counting uses.
  -- Lock in ID order for overlapping auto-promotion candidates.
  FOR candidate IN
    SELECT * FROM public.discount_codes
    WHERE active IS TRUE
      AND (starts_at IS NULL OR starts_at <= checkout_time)
      AND (expires_at IS NULL OR expires_at > checkout_time)
      AND (min_order IS NULL OR min_order * 100 <= base_grosze)
      AND CASE WHEN requested_code IS NOT NULL THEN lower(code::text) = lower(requested_code)
               ELSE auto_apply IS TRUE AND NOT (type = 'percent' AND value = 10)
          END
    ORDER BY id FOR UPDATE
  LOOP
    SELECT count(*),
           count(*) FILTER (WHERE user_id = placed."user"),
           count(*) FILTER (WHERE lower(email_lower::text) = lower(placed.contact_email))
      INTO all_uses, user_uses, email_uses
      FROM public.discount_redemptions WHERE code_id = candidate.id;

    IF (candidate.max_uses IS NOT NULL AND all_uses >= candidate.max_uses)
       OR (candidate.per_user_max_uses IS NOT NULL AND
           ((placed."user" IS NOT NULL AND user_uses >= candidate.per_user_max_uses)
            OR (placed.contact_email IS NOT NULL AND email_uses >= candidate.per_user_max_uses))) THEN
      CONTINUE;
    END IF;

    candidate_grosze := greatest(0, least(base_grosze, round(
      CASE WHEN candidate.type = 'amount' THEN candidate.value::numeric * 100
           ELSE base_grosze * candidate.value::numeric / 100 END
    )));
    IF requested_code IS NOT NULL OR candidate_grosze > discount_grosze THEN
      selected_code := candidate;
      discount_grosze := candidate_grosze;
    END IF;
    EXIT WHEN requested_code IS NOT NULL;
  END LOOP;

  IF requested_code IS NOT NULL AND selected_code.id IS NULL THEN
    RETURN '{"status":"PROMO_UNAVAILABLE"}';
  END IF;

  amount_grosze := base_grosze - discount_grosze + deposit_grosze;
  price := price || jsonb_build_object('discount', discount_grosze, 'total', amount_grosze);
  IF amount_grosze <> expected_grosze THEN
    RETURN jsonb_build_object('status', 'PRICE_CHANGED', 'price', price);
  END IF;
  IF amount_grosze = 0 AND placed.payment_method = 'Online' THEN
    RETURN '{"status":"ZERO_ONLINE"}';
  END IF;

  INSERT INTO public.orders (
    name, phone, contact_email, order_note, address, street, postal_code, city, flat_number,
    selected_option, payment_method, payment_status, items, total_price, delivery_cost,
    base_before_discount, delivery_min_required, status, client_delivery_time, delivery_time,
    eta, "user", promo_code, discount_amount, legal_accept, checkout_price_grosze
  ) VALUES (
    placed.name, placed.phone, placed.contact_email, placed.order_note, placed.address,
    placed.street, placed.postal_code, placed.city, placed.flat_number, placed.selected_option,
    placed.payment_method, placed.payment_status, placed.items, amount_grosze::numeric / 100,
    delivery_grosze::numeric / 100, (products_grosze + packaging_grosze)::numeric / 100,
    placed.delivery_min_required, placed.status, placed.client_delivery_time, placed.delivery_time,
    placed.eta, placed."user", selected_code.code, discount_grosze::numeric / 100,
    placed.legal_accept, price
  ) RETURNING * INTO placed;

  INSERT INTO public.order_items (order_id, product_id, name, quantity, unit_price, line_no)
    SELECT placed.id, line.product_id, line.name, line.quantity, line.unit_price, line.line_no
    FROM jsonb_populate_recordset(NULL::public.order_items, order_lines) AS line;

  IF selected_code.id IS NOT NULL THEN
    INSERT INTO public.discount_redemptions (code_id, code, order_id, user_id, email_lower, amount)
    VALUES (selected_code.id, selected_code.code, placed.id, placed."user",
            lower(placed.contact_email), discount_grosze::numeric / 100);
  END IF;

  result := jsonb_build_object(
    'status', 'OK', 'orderId', placed.id, 'price', price,
    'promoCode', selected_code.code, 'paymentMethod', placed.payment_method,
    'createdAt', checkout_time
  );
  INSERT INTO public.checkout_requests (key, fingerprint, order_id, result)
  VALUES (request_key, request_fingerprint, placed.id, result);
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.sisi_create_checkout(uuid, text, jsonb, jsonb, jsonb, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisi_create_checkout(uuid, text, jsonb, jsonb, jsonb, bigint, text) TO service_role;

COMMIT;
