BEGIN;

ALTER TABLE public.order_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.order_settings;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.order_settings;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.order_settings FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id, orders_enabled, local_enabled, takeaway_enabled, delivery_enabled, updated_at, created_at),
       UPDATE (id, orders_enabled, local_enabled, takeaway_enabled, delivery_enabled, updated_at, created_at)
ON TABLE public.order_settings FROM PUBLIC, anon, authenticated;

-- Deny writes even if another permissive policy or column grant exists.
CREATE POLICY sisi_order_settings_no_browser_writes ON public.order_settings
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY sisi_order_settings_no_browser_insert ON public.order_settings
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY sisi_order_settings_no_browser_delete ON public.order_settings
  AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

-- Keep unrelated browser updates to restaurant_info (for example packaging_cost).
CREATE FUNCTION public.sisi_protect_restaurant_ordering_flag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'DELETE' AND OLD.id = 1
      OR TG_OP = 'INSERT' AND NEW.id = 1
      OR TG_OP = 'UPDATE' AND (OLD.id = 1 OR NEW.id = 1)
        AND (NEW.ordering_open IS DISTINCT FROM OLD.ordering_open OR NEW.id IS DISTINCT FROM OLD.id) THEN
      RAISE EXCEPTION 'Restaurant ordering configuration is managed by the server' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sisi_protect_restaurant_ordering_flag
BEFORE INSERT OR UPDATE OR DELETE ON public.restaurant_info
FOR EACH ROW EXECUTE FUNCTION public.sisi_protect_restaurant_ordering_flag();

-- Only the authenticated admin API calls this RPC via service_role. An explicit
-- master switch change updates both flags together, including the rollback guard.
CREATE FUNCTION public.sisi_update_order_availability(settings_id uuid, changes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  restaurant_open boolean;
  settings public.order_settings;
BEGIN
  SELECT ordering_open INTO STRICT restaurant_open
    FROM public.restaurant_info WHERE id = 1 FOR UPDATE;

  UPDATE public.order_settings
  SET orders_enabled = coalesce((changes->>'orders_enabled')::boolean, orders_enabled),
      local_enabled = coalesce((changes->>'local_enabled')::boolean, local_enabled),
      takeaway_enabled = coalesce((changes->>'takeaway_enabled')::boolean, takeaway_enabled),
      delivery_enabled = coalesce((changes->>'delivery_enabled')::boolean, delivery_enabled)
  WHERE id = settings_id
  RETURNING * INTO STRICT settings;

  IF changes ? 'orders_enabled' THEN
    restaurant_open := settings.orders_enabled;
    UPDATE public.restaurant_info SET ordering_open = restaurant_open WHERE id = 1;
  END IF;

  RETURN jsonb_build_object(
    'orders_enabled', restaurant_open IS TRUE AND settings.orders_enabled,
    'local_enabled', settings.local_enabled,
    'takeaway_enabled', settings.takeaway_enabled,
    'delivery_enabled', settings.delivery_enabled
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sisi_update_order_availability(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisi_update_order_availability(uuid, jsonb) TO service_role;

COMMIT;
