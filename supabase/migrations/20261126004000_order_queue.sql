BEGIN;

CREATE TABLE public.order_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('p24_register', 'p24_reconcile', 'pos', 'mail')),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'running', 'done', 'review')),
  event text,
  payload jsonb,
  prepared jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  lease_id uuid,
  lease_until timestamptz,
  first_external_at timestamptz,
  last_code text,
  finished_at timestamptz
);
CREATE INDEX order_jobs_due ON public.order_jobs (available_at, created_at) WHERE state IN ('pending', 'running');
ALTER TABLE public.order_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.order_jobs TO service_role;

CREATE FUNCTION public.sisi_queue_order_events()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  mail_event text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    mail_event := 'received';
    IF NEW.payment_method IS DISTINCT FROM 'Online' THEN
      INSERT INTO public.order_jobs (job_key, order_id, kind)
      VALUES ('pos:' || NEW.id, NEW.id, 'pos') ON CONFLICT (job_key) DO NOTHING;
    END IF;
  ELSE
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NEW.payment_status = 'paid' THEN
      IF NEW.status IN ('new', 'placed', 'pending', 'accepted') THEN
        INSERT INTO public.order_jobs (job_key, order_id, kind)
        VALUES ('pos:' || NEW.id, NEW.id, 'pos') ON CONFLICT (job_key) DO NOTHING;
      END IF;
      UPDATE public.order_jobs SET state = 'done', finished_at = clock_timestamp(), last_code = 'p24_recovered'
      WHERE job_key = 'p24_register:' || NEW.id AND state = 'review';
    END IF;

    IF NEW.dotypos_order_id IS NOT NULL AND to_jsonb(NEW)->>'dotypos_status' IN ('sent', 'confirmed') THEN
      UPDATE public.order_jobs SET state = 'done', finished_at = clock_timestamp(), last_code = 'pos_confirmed'
      WHERE job_key = 'pos:' || NEW.id AND state = 'review';
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('accepted', 'completed', 'cancelled') THEN
      mail_event := NEW.status;
    ELSIF NEW.status = 'accepted' AND OLD.delivery_time IS DISTINCT FROM NEW.delivery_time THEN
      mail_event := 'time_changed';
    END IF;
  END IF;

  IF mail_event IS NOT NULL AND
    coalesce(to_jsonb(NEW)->>'contact_email', to_jsonb(NEW)->>'email', to_jsonb(NEW)->>'user_id', to_jsonb(NEW)->>'user') IS NOT NULL THEN
    INSERT INTO public.order_jobs (job_key, order_id, kind, event, payload)
    VALUES ('mail:' || NEW.id || ':' || mail_event ||
      CASE WHEN mail_event = 'time_changed' THEN ':' || gen_random_uuid()::text ELSE '' END,
      NEW.id, 'mail', mail_event,
      (SELECT jsonb_object_agg(field, value) FROM jsonb_each(to_jsonb(NEW)) AS fields(field, value)
        WHERE field IN ('id', 'contact_email', 'email', 'user_id', 'user',
          'items', 'status', 'total_price', 'delivery_cost', 'discount_amount', 'checkout_price_grosze',
          'selected_option', 'payment_method', 'payment_status', 'delivery_time', 'client_delivery_time',
          'address', 'street', 'flat_number', 'city', 'postal_code', 'legal_accept')));
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER sisi_queue_order_events AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.sisi_queue_order_events();

-- Assign the session before any network call. Even a callback arriving before
-- token persistence can then be matched to this order.
CREATE FUNCTION public.sisi_request_p24(order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  entry public.orders;
  job_state text;
BEGIN
  SELECT * INTO entry FROM public.orders WHERE id = order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"outcome":"missing"}'; END IF;
  IF entry.payment_method IS DISTINCT FROM 'Online' OR coalesce(entry.status IN ('new','placed','pending','accepted'), false) = false
    OR entry.payment_status IS DISTINCT FROM 'pending' OR coalesce(entry.total_price, 0) <= 0 THEN
    RETURN '{"outcome":"closed"}';
  END IF;
  IF entry.p24_session_id IS NULL THEN
    UPDATE public.orders SET p24_session_id = 'sisi-' || entry.id WHERE id = entry.id RETURNING * INTO entry;
  END IF;

  INSERT INTO public.order_jobs (job_key, order_id, kind, available_at)
  VALUES ('p24_reconcile:' || entry.id, entry.id, 'p24_reconcile', now() + interval '2 minutes')
  ON CONFLICT (job_key) DO NOTHING;

  IF entry.p24_token IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'ready', 'token', entry.p24_token);
  END IF;
  INSERT INTO public.order_jobs (job_key, order_id, kind)
  VALUES ('p24_register:' || entry.id, entry.id, 'p24_register') ON CONFLICT (job_key) DO NOTHING;
  SELECT state INTO job_state FROM public.order_jobs WHERE job_key = 'p24_register:' || entry.id;
  RETURN jsonb_build_object('outcome', CASE WHEN job_state = 'review' THEN 'review' ELSE 'pending' END);
END;
$$;

CREATE FUNCTION public.sisi_claim_order_job(wanted_key text DEFAULT NULL)
RETURNS SETOF public.order_jobs LANGUAGE sql SET search_path = '' AS $$
  WITH next_job AS (
    SELECT job.id FROM public.order_jobs job
    WHERE (wanted_key IS NULL OR job.job_key = wanted_key) AND job.available_at <= clock_timestamp()
      AND (job.state = 'pending' OR (job.state = 'running' AND job.lease_until <= clock_timestamp()))
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

-- Fenced first external attempt. P24 registration is never reissued after an
-- ambiguous outcome. Resend retries keep the first payload and timestamp.
CREATE FUNCTION public.sisi_prepare_order_job(job_id uuid, lease uuid, body jsonb)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  UPDATE public.order_jobs SET first_external_at = clock_timestamp(), prepared = body
  WHERE id = job_id AND lease_id = lease AND state = 'running'
    AND lease_until > clock_timestamp() AND first_external_at IS NULL;
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.sisi_store_p24_token(job_id uuid, lease uuid, token text)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  target uuid;
BEGIN
  -- Lock and fence before touching the order. The order-trigger only queues
  -- events for business transitions, so storing a token takes no queue lock.
  SELECT order_id INTO target FROM public.order_jobs
  WHERE id = job_id AND lease_id = lease AND kind = 'p24_register' AND state = 'running'
    AND lease_until > clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.orders SET p24_token = token
  WHERE id = target AND payment_method = 'Online' AND payment_status = 'pending'
    AND status IN ('new','placed','pending','accepted') AND p24_token IS NULL;
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.sisi_finish_order_job(job_id uuid, lease uuid, result text, code text, delay_seconds integer DEFAULT 0)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF result NOT IN ('pending','done','review') THEN RAISE EXCEPTION 'invalid queue outcome'; END IF;
  UPDATE public.order_jobs SET state = result, last_code = code,
    available_at = clock_timestamp() + make_interval(secs => greatest(delay_seconds, 0)),
    lease_id = NULL, lease_until = NULL,
    finished_at = CASE WHEN result = 'pending' THEN NULL ELSE clock_timestamp() END,
    payload = CASE WHEN result = 'done' THEN NULL ELSE payload END,
    prepared = CASE WHEN result = 'done' THEN NULL ELSE prepared END
  WHERE id = job_id AND lease_id = lease AND state = 'running' AND lease_until > clock_timestamp();
  RETURN FOUND;
END;
$$;

DROP FUNCTION public.sisi_begin_pos_dispatch(uuid);
CREATE FUNCTION public.sisi_begin_pos_dispatch(order_id uuid, reprint boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  UPDATE public.orders SET pos_dispatch_started_at = coalesce(pos_dispatch_started_at, clock_timestamp())
  WHERE id = order_id AND status IN ('new','pending','placed','accepted','completed')
    AND (payment_method IS DISTINCT FROM 'Online' OR payment_status = 'paid')
    AND (CASE WHEN reprint THEN dotypos_order_id IS NOT NULL ELSE pos_dispatch_started_at IS NULL AND dotypos_order_id IS NULL END);
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.sisi_request_p24(uuid), public.sisi_claim_order_job(text),
  public.sisi_prepare_order_job(uuid,uuid,jsonb), public.sisi_store_p24_token(uuid,uuid,text),
  public.sisi_finish_order_job(uuid,uuid,text,text,integer), public.sisi_begin_pos_dispatch(uuid,boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisi_request_p24(uuid), public.sisi_claim_order_job(text),
  public.sisi_prepare_order_job(uuid,uuid,jsonb), public.sisi_store_p24_token(uuid,uuid,text),
  public.sisi_finish_order_job(uuid,uuid,text,text,integer), public.sisi_begin_pos_dispatch(uuid,boolean)
  TO service_role;

-- Recover pending sessions created by the legacy registration route.
INSERT INTO public.order_jobs (job_key, order_id, kind)
SELECT 'p24_reconcile:' || id, id, 'p24_reconcile' FROM public.orders
WHERE payment_method = 'Online' AND payment_status IN ('pending','failed') AND p24_session_id IS NOT NULL
ON CONFLICT (job_key) DO NOTHING;

COMMIT;
