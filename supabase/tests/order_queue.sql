-- Runs against the isolated schema created by run_order_queue.sh.
BEGIN;
SET LOCAL ROLE service_role;

DO $$
DECLARE
  active_id constant uuid := 'd0000000-0000-4000-8000-000000000001';
  cash_id constant uuid := 'd0000000-0000-4000-8000-000000000002';
  job public.order_jobs;
  replacement public.order_jobs;
BEGIN
  INSERT INTO public.orders (id,status,payment_method,payment_status,total_price,contact_email)
  VALUES (active_id,'placed','Online','pending',20,'a@example.invalid'),
    (cash_id,'placed','Gotówka',NULL,20,'b@example.invalid');

  IF (SELECT count(*) FROM public.order_jobs WHERE kind = 'mail') <> 2
    OR (SELECT count(*) FROM public.order_jobs WHERE kind = 'pos' AND order_id = cash_id) <> 1
    OR EXISTS (SELECT FROM public.order_jobs WHERE kind = 'pos' AND order_id = active_id) THEN
    RAISE EXCEPTION 'Checkout events were not queued correctly';
  END IF;
  BEGIN
    INSERT INTO public.orders (id,status,payment_method,total_price,contact_email)
    VALUES ('d0000000-0000-4000-8000-000000000099','placed','Gotówka',20,'c@example.invalid');
    RAISE check_violation;
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF EXISTS (SELECT FROM public.order_jobs WHERE order_id = 'd0000000-0000-4000-8000-000000000099') THEN
    RAISE EXCEPTION 'Rollback left jobs behind';
  END IF;

  PERFORM public.sisi_request_p24(active_id);
  PERFORM public.sisi_request_p24(active_id);
  IF (SELECT count(*) FROM public.order_jobs WHERE order_id = active_id AND kind LIKE 'p24_%') <> 2
    OR (SELECT p24_session_id FROM public.orders WHERE id = active_id) IS DISTINCT FROM 'sisi-' || active_id THEN
    RAISE EXCEPTION 'P24 request is not idempotent or session is not durable';
  END IF;

  SELECT * INTO STRICT job FROM public.sisi_claim_order_job('p24_register:' || active_id);
  IF EXISTS (SELECT FROM public.sisi_claim_order_job(job.job_key)) THEN RAISE EXCEPTION 'Lease was shared'; END IF;
  IF NOT public.sisi_prepare_order_job(job.id, job.lease_id, NULL) THEN RAISE EXCEPTION 'Prepare was not recorded'; END IF;
  UPDATE public.order_jobs SET lease_until = clock_timestamp() - interval '1 second' WHERE id = job.id;
  SELECT * INTO STRICT replacement FROM public.sisi_claim_order_job(job.job_key);
  IF replacement.lease_id = job.lease_id OR replacement.first_external_at IS NULL THEN
    RAISE EXCEPTION 'Expired lease was not fenced or lost the registration marker';
  END IF;
  IF public.sisi_store_p24_token(job.id, job.lease_id, 'old-token')
     OR public.sisi_finish_order_job(job.id, job.lease_id, 'done', 'stale') THEN
    RAISE EXCEPTION 'Expired worker changed the order/job';
  END IF;
  IF public.sisi_prepare_order_job(replacement.id, replacement.lease_id, NULL) THEN
    RAISE EXCEPTION 'Ambiguous registration was prepared twice';
  END IF;

  PERFORM public.sisi_confirm_p24_payment('sisi-' || active_id, '50', 2000);
  PERFORM public.sisi_confirm_p24_payment('sisi-' || active_id, '50', 2000);
  IF (SELECT count(*) FROM public.order_jobs WHERE kind = 'pos' AND order_id = active_id) <> 1 THEN
    RAISE EXCEPTION 'Replayed payment created duplicate kitchen dispatch';
  END IF;
  IF NOT public.sisi_begin_pos_dispatch(active_id) OR public.sisi_begin_pos_dispatch(active_id) THEN
    RAISE EXCEPTION 'POS delivery may be started twice';
  END IF;

  PERFORM public.sisi_change_order(active_id, '{"status":"accepted"}', NULL);
  PERFORM public.sisi_change_order(active_id, '{"status":"accepted"}', NULL);
  IF (SELECT count(*) FROM public.order_jobs WHERE job_key = 'mail:' || active_id || ':accepted') <> 1
    OR EXISTS (SELECT FROM public.sisi_claim_order_job('mail:' || active_id || ':accepted')) THEN
    RAISE EXCEPTION 'Status emails duplicate or can overtake the order receipt';
  END IF;

  SELECT * INTO STRICT job FROM public.sisi_claim_order_job('mail:' || active_id || ':received');
  IF NOT public.sisi_prepare_order_job(job.id, job.lease_id, '{"to":"a@example.invalid","text":"zdarzenie"}') THEN
    RAISE EXCEPTION 'Could not store immutable mail body';
  END IF;
  PERFORM public.sisi_finish_order_job(job.id, job.lease_id, 'pending', 'retry', 0);
  SELECT * INTO STRICT replacement FROM public.sisi_claim_order_job(job.job_key);
  IF replacement.prepared->>'text' IS DISTINCT FROM 'zdarzenie' OR replacement.first_external_at IS NULL THEN
    RAISE EXCEPTION 'Email retry lost the original payload';
  END IF;
  PERFORM public.sisi_finish_order_job(replacement.id, replacement.lease_id, 'done', 'sent');
  IF EXISTS (SELECT FROM public.order_jobs WHERE id = replacement.id AND (prepared IS NOT NULL OR payload IS NOT NULL)) THEN
    RAISE EXCEPTION 'Delivered email still stores contact payload';
  END IF;
END;
$$;
RESET ROLE;
ROLLBACK;
