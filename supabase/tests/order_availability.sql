-- Run after applying the order availability migration, on an isolated database.
BEGIN;

-- Normalize the fixture under the database owner.
DELETE FROM public.order_settings;
INSERT INTO public.order_settings (id, orders_enabled)
VALUES ('55fa66ee-77fb-48c8-8988-110100000001', true);
UPDATE public.restaurant_info SET ordering_open = false WHERE id = 1;

-- Supabase browser roles are anon and authenticated. Client, employee and
-- administrator sessions all use authenticated for direct database access.
DO $$
DECLARE
  browser_role text;
  app_role text;
BEGIN
  FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH app_role IN ARRAY ARRAY['client', 'employee', 'admin'] LOOP
      PERFORM set_config('request.jwt.claims', json_build_object('role', browser_role, 'app_role', app_role)::text, true);
      EXECUTE format('SET LOCAL ROLE %I', browser_role);
      IF has_table_privilege(current_user, 'public.order_settings', 'UPDATE')
         OR has_any_column_privilege(current_user, 'public.order_settings', 'UPDATE')
         OR has_table_privilege(current_user, 'public.order_settings', 'INSERT')
         OR has_any_column_privilege(current_user, 'public.order_settings', 'INSERT')
         OR has_function_privilege(current_user, 'public.sisi_update_order_availability(uuid,jsonb)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Unexpected settings write privilege for % / %', browser_role, app_role;
      END IF;
      BEGIN
        UPDATE public.restaurant_info SET ordering_open = true WHERE id = 1;
        IF FOUND THEN RAISE EXCEPTION 'Browser role altered restaurant flag: %', browser_role; END IF;
      EXCEPTION WHEN insufficient_privilege THEN
        NULL;
      END;
      RESET ROLE;
    END LOOP;
  END LOOP;
END;
$$;

SET LOCAL ROLE service_role;
DO $$
DECLARE
  response jsonb;
  fixture constant uuid := '55fa66ee-77fb-48c8-8988-110100000001';
BEGIN
  response := public.sisi_update_order_availability(fixture, '{"local_enabled":false}');
  IF response->'orders_enabled' <> 'false'::jsonb OR response->'local_enabled' <> 'false'::jsonb THEN
    RAISE EXCEPTION 'Changing one mode must preserve the existing master veto';
  END IF;

  response := public.sisi_update_order_availability(fixture, '{"orders_enabled":true}');
  IF response->'orders_enabled' <> 'true'::jsonb
    OR (SELECT ordering_open FROM public.restaurant_info WHERE id = 1) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Explicitly opening must update both master flags';
  END IF;

  response := public.sisi_update_order_availability(fixture, '{"orders_enabled":false}');
  IF response->'orders_enabled' <> 'false'::jsonb
    OR (SELECT ordering_open FROM public.restaurant_info WHERE id = 1) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Closing must update both master flags';
  END IF;
END;
$$;
RESET ROLE;

ROLLBACK;
