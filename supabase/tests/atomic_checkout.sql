-- Uses the synthetic schema loaded by run_atomic_checkout.sh.
BEGIN;

CREATE FUNCTION pg_temp.checkout(key uuid, fingerprint text, expected bigint, payment text DEFAULT 'Gotówka',
  code text DEFAULT NULL, quantity integer DEFAULT 1, mode text DEFAULT 'local')
RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.sisi_create_checkout(key, fingerprint,
    jsonb_build_object('name', 'Synthetic', 'phone', '+48500111222', 'contact_email', 'checkout@example.invalid',
      'selected_option', mode, 'payment_method', payment, 'status', 'placed', 'items', '[]',
      'legal_accept', '{}'::jsonb, 'delivery_min_required', 0),
    jsonb_build_array(jsonb_build_object('name', 'Synthetic', 'quantity', quantity,
      'product_id', (SELECT id FROM public.products WHERE name = 'Synthetic checkout fixture' LIMIT 1),
      'unit_price', 19.99, 'line_no', 1)),
    jsonb_build_object('products',1999,'packaging',200,'delivery',600,'deposit',CASE WHEN code = 'PR2_SYNTHETIC_ZERO' THEN 0 ELSE 50 END,'lines',ARRAY[1999]), expected, code);
$$;

INSERT INTO public.discount_codes (id, code, type, value, active, auto_apply, max_uses)
VALUES ('90000000-0000-4000-8000-000000000001','PR2_SYNTHETIC_LAST','amount',5,true,false,1),
       ('90000000-0000-4000-8000-000000000002','PR2_SYNTHETIC_ZERO','amount',110,true,false,NULL);

UPDATE public.restaurant_info SET ordering_open = true WHERE id = 1;
UPDATE public.order_settings SET orders_enabled = true, local_enabled = true, takeaway_enabled = true, delivery_enabled = true;

DO $$
DECLARE
  first_key constant uuid := 'a0000000-0000-4000-8000-000000000001';
  other_key constant uuid := 'a0000000-0000-4000-8000-000000000002';
  invalid_key constant uuid := 'a0000000-0000-4000-8000-000000000003';
  fingerprint constant text := repeat('a', 64);
  initial_count bigint := (SELECT count(*) FROM public.orders);
  result jsonb;
  replay jsonb;
BEGIN
  result := pg_temp.checkout(first_key, fingerprint, 2900);
  IF result->>'status' IS DISTINCT FROM 'PRICE_CHANGED' OR (result #>> '{price,total}')::integer IS DISTINCT FROM 2849 THEN
    RAISE EXCEPTION 'Expected 2849 grosze PRICE_CHANGED, got %', result;
  END IF;
  IF (SELECT count(*) FROM public.orders) <> initial_count OR EXISTS (SELECT FROM public.checkout_requests WHERE key = first_key) THEN
    RAISE EXCEPTION 'Quote mismatch left writes';
  END IF;

  BEGIN
    PERFORM pg_temp.checkout(invalid_key, fingerprint, 2349, 'Gotówka', 'PR2_SYNTHETIC_LAST', -1);
    RAISE EXCEPTION 'Expected line insert to fail';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT count(*) FROM public.orders) <> initial_count
     OR EXISTS (SELECT FROM public.checkout_requests WHERE key = invalid_key)
     OR EXISTS (SELECT FROM public.discount_redemptions WHERE code = 'PR2_SYNTHETIC_LAST') THEN
    RAISE EXCEPTION 'Line failure did not roll back';
  END IF;

  result := pg_temp.checkout(first_key, fingerprint, 2349, 'Gotówka', 'PR2_SYNTHETIC_LAST');
  IF result->>'status' IS DISTINCT FROM 'OK' THEN RAISE EXCEPTION 'Checkout failed: %', result; END IF;
  IF NOT EXISTS (SELECT FROM public.orders WHERE id = (result->>'orderId')::uuid
                 AND checkout_price_grosze = result->'price' AND total_price = 23.49)
     OR NOT EXISTS (SELECT FROM public.order_items WHERE order_id = (result->>'orderId')::uuid)
     OR NOT EXISTS (SELECT FROM public.discount_redemptions WHERE order_id = (result->>'orderId')::uuid AND amount = 5) THEN
    RAISE EXCEPTION 'Persisted amounts or components differ from the checkout result';
  END IF;
  IF (pg_temp.checkout(other_key, fingerprint, 2349, 'Gotówka', 'PR2_SYNTHETIC_LAST')->>'status') IS DISTINCT FROM 'PROMO_UNAVAILABLE' THEN
    RAISE EXCEPTION 'Discount limit was exceeded';
  END IF;
  IF (pg_temp.checkout(first_key, repeat('b', 64), 2349)->>'status') IS DISTINCT FROM 'KEY_CONFLICT' THEN
    RAISE EXCEPTION 'A different intent reused the checkout key';
  END IF;

  IF (pg_temp.checkout(other_key, fingerprint, 0, 'Online', 'PR2_SYNTHETIC_ZERO')->>'status') IS DISTINCT FROM 'ZERO_ONLINE' THEN
    RAISE EXCEPTION 'Zero-value online checkout was accepted';
  END IF;
  IF EXISTS (SELECT FROM public.checkout_requests WHERE key = other_key) THEN
    RAISE EXCEPTION 'Zero-value online checkout left writes';
  END IF;

  UPDATE public.restaurant_info SET ordering_open = false WHERE id = 1;
  replay := pg_temp.checkout(first_key, fingerprint, 2349);
  IF replay - 'replayed' <> result OR replay->'replayed' <> 'true'::jsonb THEN
    RAISE EXCEPTION 'Replay after closing did not return the original result';
  END IF;
  IF (pg_temp.checkout(other_key, fingerprint, 2849)->>'status') IS DISTINCT FROM 'CLOSED' THEN
    RAISE EXCEPTION 'A new checkout was accepted while closed';
  END IF;
END;
$$;

ROLLBACK;
