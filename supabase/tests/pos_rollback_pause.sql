BEGIN;
SET LOCAL ROLE service_role;

DO $$
DECLARE
  paid_id constant uuid := 'fa000000-0000-4000-8000-000000000001';
  reprint_id constant uuid := 'fa000000-0000-4000-8000-000000000002';
  result jsonb;
BEGIN
  INSERT INTO public.orders (id,status,payment_method,payment_status,total_price,p24_session_id,contact_email)
  VALUES (paid_id,'placed','Online','pending',20,'pause-test','pause@example.invalid');
  INSERT INTO public.orders (id,status,payment_method,total_price,dotypos_order_id)
  VALUES (reprint_id,'placed','Gotówka',20,42);

  result := public.sisi_confirm_p24_payment('pause-test','200',2000);
  IF result->>'outcome' IS DISTINCT FROM 'paid' THEN RAISE EXCEPTION 'POS pause blocked P24'; END IF;
  IF EXISTS (SELECT FROM public.sisi_claim_order_job('pos:' || paid_id))
     OR EXISTS (SELECT FROM public.sisi_claim_order_job('pos:' || reprint_id))
     OR public.sisi_begin_pos_dispatch(order_id => paid_id)
     OR public.sisi_begin_pos_dispatch(order_id => paid_id, reprint => false)
     OR public.sisi_begin_pos_dispatch(order_id => reprint_id, reprint => true) THEN
    RAISE EXCEPTION 'A paused dispatch, replay or old signature escaped the gate';
  END IF;
  IF NOT EXISTS (SELECT FROM public.order_jobs WHERE order_id = paid_id AND kind = 'pos' AND state = 'pending' AND attempts = 0)
     OR NOT EXISTS (SELECT FROM public.sisi_claim_order_job('mail:' || paid_id || ':received')) THEN
    RAISE EXCEPTION 'POS job was consumed or mail processing was blocked';
  END IF;
  IF has_table_privilege(current_user, 'public.pos_dispatch_control', 'UPDATE')
     OR has_function_privilege('authenticated', 'public.sisi_lock_pos_dispatch_enabled()', 'EXECUTE') THEN
    RAISE EXCEPTION 'POS control privileges are too broad';
  END IF;
END;
$$;

RESET ROLE;
UPDATE public.pos_dispatch_control SET enabled = true WHERE id = true;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  paid_id constant uuid := 'fa000000-0000-4000-8000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT FROM public.sisi_claim_order_job('pos:' || paid_id))
     OR NOT public.sisi_begin_pos_dispatch(order_id => paid_id)
     OR public.sisi_begin_pos_dispatch(order_id => paid_id) THEN
    RAISE EXCEPTION 'Queued POS work could not resume exactly once';
  END IF;
END;
$$;
RESET ROLE;
DELETE FROM public.pos_dispatch_control;
SET LOCAL ROLE service_role;
DO $$
BEGIN
  IF public.sisi_begin_pos_dispatch('fa000000-0000-4000-8000-000000000002', true) THEN
    RAISE EXCEPTION 'Missing switch configuration must block POS';
  END IF;
END;
$$;
RESET ROLE;
ROLLBACK;
