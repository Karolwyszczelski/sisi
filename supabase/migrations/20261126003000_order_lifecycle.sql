BEGIN;

ALTER TABLE public.orders
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_by uuid,
  ADD COLUMN pos_dispatch_started_at timestamptz;

CREATE TABLE public.order_followups (
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('refund_p24', 'refund_offline', 'cancel_pos')),
  amount_grosze bigint CHECK (amount_grosze >= 0),
  p24_order_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_by uuid,
  claimed_at timestamptz,
  resolved_at timestamptz,
  resolution_reference text,
  PRIMARY KEY (order_id, kind),
  UNIQUE (kind, resolution_reference)
);
CREATE INDEX order_followups_open_idx ON public.order_followups (created_at) WHERE resolved_at IS NULL;

CREATE TABLE public.order_state_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  old_status text,
  new_status text,
  old_payment_status text,
  new_payment_status text,
  actor_id uuid
);

ALTER TABLE public.order_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_state_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_followups, public.order_state_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.order_followups TO service_role;
GRANT SELECT, INSERT ON public.order_state_events TO service_role;

-- Direct browser writes must not bypass the staff endpoints. Leave SELECT and
-- Realtime access subject to the existing RLS boundaries.
CREATE POLICY sisi_orders_no_browser_updates ON public.orders AS RESTRICTIVE
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY sisi_orders_no_browser_inserts ON public.orders AS RESTRICTIVE
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY sisi_orders_no_browser_deletes ON public.orders AS RESTRICTIVE
  FOR DELETE TO anon, authenticated USING (false);

CREATE FUNCTION public.sisi_guard_order_lifecycle()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT coalesce(
      (NEW.status IN ('accepted', 'cancelled') AND OLD.status IN ('new', 'placed', 'pending'))
      OR (NEW.status IN ('completed', 'cancelled') AND OLD.status = 'accepted'), false
    ) THEN
      RAISE EXCEPTION 'invalid_order_transition' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.status IN ('accepted', 'completed') AND NEW.payment_method = 'Online'
       AND NEW.payment_status IS DISTINCT FROM 'paid' THEN
      RAISE EXCEPTION 'payment_not_confirmed' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.status = 'cancelled' THEN
      NEW.cancelled_at := clock_timestamp();
    END IF;
  END IF;

  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method AND
     (OLD.payment_method = 'Online' OR NEW.payment_method = 'Online'
      OR OLD.payment_status IS NOT NULL OR OLD.status IN ('completed', 'cancelled')) THEN
    RAISE EXCEPTION 'payment_method_locked' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status AND NOT coalesce(
    OLD.payment_method = 'Online' AND OLD.payment_status IN ('pending', 'failed')
      AND NEW.payment_status = 'paid' AND NEW.p24_order_id IS NOT NULL AND NEW.paid_at IS NOT NULL,
    false
  ) THEN
    RAISE EXCEPTION 'invalid_payment_transition' USING ERRCODE = 'P0001';
  END IF;

  IF (OLD.checkout_price_grosze IS NOT NULL OR OLD.payment_method = 'Online'
      OR OLD.payment_status = 'paid' OR OLD.status IN ('completed', 'cancelled'))
     AND (NEW.total_price IS DISTINCT FROM OLD.total_price OR NEW.items IS DISTINCT FROM OLD.items
       OR NEW.selected_option IS DISTINCT FROM OLD.selected_option OR NEW.promo_code IS DISTINCT FROM OLD.promo_code
       OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount OR NEW.delivery_cost IS DISTINCT FROM OLD.delivery_cost
       OR NEW.checkout_price_grosze IS DISTINCT FROM OLD.checkout_price_grosze) THEN
    RAISE EXCEPTION 'order_price_locked' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER sisi_guard_order_lifecycle BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.sisi_guard_order_lifecycle();

CREATE FUNCTION public.sisi_record_order_lifecycle()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status OR OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    INSERT INTO public.order_state_events (order_id, old_status, new_status, old_payment_status, new_payment_status, actor_id)
    VALUES (NEW.id, OLD.status, NEW.status, OLD.payment_status, NEW.payment_status,
      nullif(current_setting('sisi.order_actor', true), '')::uuid);
  END IF;

  IF NEW.status = 'cancelled' AND NEW.payment_status = 'paid' THEN
    INSERT INTO public.order_followups (order_id, kind, amount_grosze, p24_order_id)
    VALUES (NEW.id, CASE WHEN NEW.payment_method = 'Online' THEN 'refund_p24' ELSE 'refund_offline' END,
      coalesce((NEW.checkout_price_grosze->>'total')::bigint, round(NEW.total_price * 100)::bigint),
      NEW.p24_order_id::text)
    ON CONFLICT (order_id, kind) DO NOTHING;
  END IF;

  IF NEW.status = 'cancelled' AND
    (NEW.pos_dispatch_started_at IS NOT NULL OR NEW.dotypos_order_id IS NOT NULL OR NEW.dotypos_sent_at IS NOT NULL) THEN
    INSERT INTO public.order_followups (order_id, kind)
    VALUES (NEW.id, 'cancel_pos') ON CONFLICT (order_id, kind) DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER sisi_record_order_lifecycle AFTER UPDATE ON public.orders
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.payment_status IS DISTINCT FROM NEW.payment_status
    OR OLD.dotypos_order_id IS DISTINCT FROM NEW.dotypos_order_id OR OLD.dotypos_sent_at IS DISTINCT FROM NEW.dotypos_sent_at)
  EXECUTE FUNCTION public.sisi_record_order_lifecycle();

CREATE FUNCTION public.sisi_change_order(order_id uuid, changes jsonb, actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  previous public.orders;
  updated public.orders;
  requested public.orders;
BEGIN
  SELECT * INTO previous FROM public.orders WHERE id = order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"outcome":"not_found"}'; END IF;
  IF previous.status = 'cancelled' AND changes = '{"status":"cancelled"}'::jsonb THEN
    RETURN jsonb_build_object('outcome', 'ok', 'order', to_jsonb(previous), 'stateChanged', false, 'timeChanged', false);
  END IF;
  IF previous.status IN ('cancelled', 'completed') AND
     changes IS DISTINCT FROM jsonb_build_object('status', previous.status) THEN
    RAISE EXCEPTION 'invalid_order_transition' USING ERRCODE = 'P0001';
  END IF;

  requested := jsonb_populate_record(previous, changes);
  PERFORM set_config('sisi.order_actor', coalesce(actor_id::text, ''), true);
  UPDATE public.orders SET
    status = requested.status,
    delivery_time = requested.delivery_time, client_delivery_time = requested.client_delivery_time,
    items = requested.items, selected_option = requested.selected_option, payment_method = requested.payment_method,
    total_price = requested.total_price, address = requested.address, street = requested.street,
    postal_code = requested.postal_code, city = requested.city, flat_number = requested.flat_number,
    phone = requested.phone, contact_email = requested.contact_email, name = requested.name,
    promo_code = requested.promo_code, discount_amount = requested.discount_amount,
    cancelled_by = CASE WHEN requested.status = 'cancelled' AND previous.status IS DISTINCT FROM 'cancelled'
      THEN actor_id ELSE previous.cancelled_by END
  WHERE id = order_id RETURNING * INTO updated;
  PERFORM set_config('sisi.order_actor', '', true);
  RETURN jsonb_build_object('outcome', 'ok', 'order', to_jsonb(updated),
    'stateChanged', updated.status IS DISTINCT FROM previous.status,
    'timeChanged', updated.delivery_time IS DISTINCT FROM previous.delivery_time);
END;
$$;

CREATE FUNCTION public.sisi_confirm_p24_payment(session_id text, gateway_order_id text, amount_grosze bigint)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  current_order public.orders;
BEGIN
  IF amount_grosze IS NULL OR amount_grosze <= 0 OR nullif(session_id, '') IS NULL OR nullif(gateway_order_id, '') IS NULL THEN
    RETURN '{"outcome":"mismatch"}';
  END IF;

  BEGIN
    SELECT * INTO STRICT current_order FROM public.orders WHERE p24_session_id = session_id FOR UPDATE;
  EXCEPTION WHEN no_data_found OR too_many_rows THEN
    RETURN '{"outcome":"mismatch"}';
  END;

  IF current_order.payment_method IS DISTINCT FROM 'Online'
    OR round(current_order.total_price * 100)::bigint IS DISTINCT FROM amount_grosze
    OR (current_order.p24_order_id IS NOT NULL AND current_order.p24_order_id::text <> gateway_order_id)
  THEN RETURN '{"outcome":"mismatch"}'; END IF;

  IF current_order.payment_status = 'paid' THEN RETURN '{"outcome":"already_paid"}'; END IF;
  IF current_order.payment_status IS NULL OR current_order.payment_status NOT IN ('pending', 'failed') THEN
    RETURN '{"outcome":"mismatch"}';
  END IF;

  -- Cast through the table row type to preserve legacy gateway ID storage.
  UPDATE public.orders SET
    p24_order_id = (jsonb_populate_record(current_order, jsonb_build_object('p24_order_id', gateway_order_id))).p24_order_id,
    payment_status = 'paid', paid_at = clock_timestamp()
  WHERE id = current_order.id;

  RETURN jsonb_build_object('outcome', CASE WHEN current_order.status = 'cancelled' THEN 'refund_pending' ELSE 'paid' END,
    'dispatch', coalesce(current_order.status IN ('new', 'placed', 'pending', 'accepted'), false),
    'orderId', current_order.id, 'selectedOption', current_order.selected_option, 'total', current_order.total_price);
END;
$$;

CREATE FUNCTION public.sisi_begin_pos_dispatch(order_id uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  UPDATE public.orders SET pos_dispatch_started_at = coalesce(pos_dispatch_started_at, clock_timestamp())
  WHERE id = order_id AND status IN ('new', 'pending', 'placed', 'accepted', 'completed')
    AND (payment_method IS DISTINCT FROM 'Online' OR payment_status = 'paid');
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.sisi_change_order(uuid, jsonb, uuid),
  public.sisi_confirm_p24_payment(text, text, bigint), public.sisi_begin_pos_dispatch(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisi_change_order(uuid, jsonb, uuid),
  public.sisi_confirm_p24_payment(text, text, bigint), public.sisi_begin_pos_dispatch(uuid) TO service_role;
GRANT USAGE ON SEQUENCE public.order_state_events_id_seq TO service_role;

COMMIT;
