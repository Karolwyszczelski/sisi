BEGIN;

CREATE TABLE public.pos_dispatch_control (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false
);
INSERT INTO public.pos_dispatch_control (id, enabled) VALUES (true, false);

ALTER TABLE public.pos_dispatch_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos_dispatch_control FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.pos_dispatch_control TO service_role;

-- Locking reads also require UPDATE privileges. Keep the lock in a narrow
-- definer function and return only the switch state to the service role.
CREATE FUNCTION public.sisi_lock_pos_dispatch_enabled()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((
    SELECT enabled FROM public.pos_dispatch_control WHERE id = true FOR SHARE
  ), false);
$$;
REVOKE ALL ON FUNCTION public.sisi_lock_pos_dispatch_enabled() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisi_lock_pos_dispatch_enabled() TO service_role;

-- Keep the function name, named arguments and default used by older builds.
CREATE OR REPLACE FUNCTION public.sisi_begin_pos_dispatch(order_id uuid, reprint boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT public.sisi_lock_pos_dispatch_enabled() THEN RETURN false; END IF;

  UPDATE public.orders SET pos_dispatch_started_at = coalesce(pos_dispatch_started_at, clock_timestamp())
  WHERE id = order_id AND status IN ('new','pending','placed','accepted','completed')
    AND (payment_method IS DISTINCT FROM 'Online' OR payment_status = 'paid')
    AND (CASE WHEN reprint THEN dotypos_order_id IS NOT NULL ELSE pos_dispatch_started_at IS NULL AND dotypos_order_id IS NULL END);
  RETURN FOUND;
END;
$$;

-- Paused POS jobs keep their attempts available. This also applies to
-- callbacks in older builds that request one specific POS job.
CREATE OR REPLACE FUNCTION public.sisi_claim_order_job(wanted_key text DEFAULT NULL)
RETURNS SETOF public.order_jobs LANGUAGE sql SET search_path = '' AS $$
  WITH next_job AS (
    SELECT job.id FROM public.order_jobs job
    WHERE (wanted_key IS NULL OR job.job_key = wanted_key) AND job.available_at <= clock_timestamp()
      AND (job.state = 'pending' OR (job.state = 'running' AND job.lease_until <= clock_timestamp()))
      AND (job.kind <> 'pos' OR EXISTS (
        SELECT FROM public.pos_dispatch_control WHERE id = true AND enabled
      ))
      AND (job.kind <> 'mail' OR NOT EXISTS (
        SELECT FROM public.order_jobs prior WHERE prior.order_id = job.order_id AND prior.kind = 'mail'
          AND (prior.created_at, prior.id) < (job.created_at, job.id) AND prior.state IN ('pending','running')
      ))
    ORDER BY job.available_at, job.created_at, job.id LIMIT 1 FOR UPDATE SKIP LOCKED
  )
  UPDATE public.order_jobs job
  SET state = 'running', lease_id = gen_random_uuid(), lease_until = clock_timestamp() + interval '60 seconds',
      attempts = attempts + 1
  FROM next_job WHERE job.id = next_job.id RETURNING job.*;
$$;

COMMIT;
