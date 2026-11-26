-- Uses the synthetic schema loaded by run_order_lifecycle.sh.
BEGIN;

INSERT INTO public.orders (id, status, payment_method, payment_status, total_price, p24_session_id, checkout_price_grosze)
VALUES
 ('b0000000-0000-4000-8000-000000000001', 'placed', 'Online', 'pending', 20, NULL, '{"total":2000}'),
 ('b0000000-0000-4000-8000-000000000002', 'placed', 'Online', 'pending', 20, 'pending-check', '{"total":2000}'),
 ('b0000000-0000-4000-8000-000000000003', 'placed', 'Gotówka', NULL, 20, NULL, '{"total":2000}'),
 ('b0000000-0000-4000-8000-000000000004', 'completed', 'Gotówka', NULL, 20, NULL, NULL),
 ('b0000000-0000-4000-8000-000000000005', 'accepted', 'Terminal', 'paid', 20, NULL, NULL);

SET LOCAL ROLE service_role;
DO $$
DECLARE
  first_id constant uuid := 'b0000000-0000-4000-8000-000000000001';
  pending_id constant uuid := 'b0000000-0000-4000-8000-000000000002';
  pos_id constant uuid := 'b0000000-0000-4000-8000-000000000003';
  completed_id constant uuid := 'b0000000-0000-4000-8000-000000000004';
  offline_id constant uuid := 'b0000000-0000-4000-8000-000000000005';
  operator_id constant uuid := 'b0000000-0000-4000-8000-000000000010';
  outcome jsonb;
BEGIN
  PERFORM public.sisi_change_order(first_id, '{"status":"cancelled"}', operator_id);
  IF EXISTS (SELECT 1 FROM public.order_followups WHERE order_id = first_id) THEN
    RAISE EXCEPTION 'Unpaid cancellation created a monetary or POS task';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.order_state_events WHERE order_id = first_id AND actor_id = operator_id AND new_status = 'cancelled') THEN
    RAISE EXCEPTION 'Cancellation did not record the actor';
  END IF;
  IF public.sisi_begin_pos_dispatch(first_id) THEN RAISE EXCEPTION 'Cancelled order went to POS'; END IF;

  IF public.sisi_confirm_p24_payment('pending-check', '41', 1999)->>'outcome' <> 'mismatch' THEN
    RAISE EXCEPTION 'Mismatched amount accepted';
  END IF;
  IF public.sisi_begin_pos_dispatch(pending_id) THEN RAISE EXCEPTION 'Unpaid order went to POS'; END IF;

  BEGIN
    PERFORM public.sisi_change_order(pending_id, '{"status":"accepted"}', operator_id);
    RAISE data_exception USING MESSAGE = 'Unpaid order accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'payment_not_confirmed' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.sisi_change_order(pending_id, '{"total_price":1}', operator_id);
    RAISE data_exception USING MESSAGE = 'Frozen price overwritten';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'order_price_locked' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.sisi_change_order(completed_id, '{"status":"cancelled"}', operator_id);
    RAISE data_exception USING MESSAGE = 'Completed order cancelled';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'invalid_order_transition' THEN RAISE; END IF;
  END;

  outcome := public.sisi_confirm_p24_payment('pending-check', '41', 2000);
  IF outcome->>'outcome' <> 'paid' OR outcome->>'dispatch' <> 'true' THEN RAISE EXCEPTION 'Payment not recorded: %', outcome; END IF;
  IF public.sisi_confirm_p24_payment('pending-check', '42', 2000)->>'outcome' <> 'mismatch' THEN
    RAISE EXCEPTION 'Gateway order identity overwritten';
  END IF;
  PERFORM public.sisi_change_order(pending_id, '{"status":"accepted"}', operator_id);
  PERFORM public.sisi_change_order(pending_id, '{"status":"completed"}', operator_id);

  IF NOT public.sisi_begin_pos_dispatch(pos_id) THEN RAISE EXCEPTION 'Eligible order blocked from POS'; END IF;
  PERFORM public.sisi_change_order(pos_id, '{"status":"cancelled"}', operator_id);
  IF (SELECT count(*) FROM public.order_followups WHERE order_id = pos_id AND kind = 'cancel_pos') <> 1 THEN
    RAISE EXCEPTION 'In-flight POS dispatch did not create a reconciliation task';
  END IF;

  PERFORM public.sisi_change_order(offline_id, '{"status":"cancelled"}', operator_id);
  IF (SELECT count(*) FROM public.order_followups WHERE order_id = offline_id AND kind = 'refund_offline' AND amount_grosze = 2000) <> 1 THEN
    RAISE EXCEPTION 'Tracked offline payment did not create a manual refund task';
  END IF;
  PERFORM public.sisi_change_order(offline_id, '{"status":"cancelled"}', operator_id);
  IF (SELECT count(*) FROM public.order_state_events WHERE order_id = offline_id) <> 1 THEN
    RAISE EXCEPTION 'Repeated cancellation added a duplicate event';
  END IF;
END;
$$;
RESET ROLE;

ROLLBACK;
