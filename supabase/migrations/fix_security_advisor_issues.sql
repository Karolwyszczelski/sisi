-- =============================================================================
-- Migration: Fix Supabase Security Advisor Issues (2026-03-24)
-- =============================================================================
-- Fixes:
--   1. RLS Disabled in Public: dotypos_webhook_logs, integrations, favorites,
--      discount_code_usages, user_addresses, discount_redemptions
--   2. Security Definer Views: orders_warsaw, v_pos_products_with_category,
--      v_orders_pending_dotypos
--   3. Sensitive Columns Exposed: integrations (tokens, credentials)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper: is_admin() function (SECURITY DEFINER so it can always read
--    profiles regardless of RLS on that table)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- 1. dotypos_webhook_logs – internal logging, service_role only
-- ---------------------------------------------------------------------------
ALTER TABLE public.dotypos_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dotypos_webhook_logs FORCE ROW LEVEL SECURITY;

-- Drop old policies if they exist, then recreate
DROP POLICY IF EXISTS "service_role_all_webhook_logs" ON public.dotypos_webhook_logs;
DROP POLICY IF EXISTS "Service role full access to webhook logs" ON public.dotypos_webhook_logs;

CREATE POLICY "service_role_all_webhook_logs"
  ON public.dotypos_webhook_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. integrations – contains OAuth tokens (sensitive!). Admins via client,
--    service_role via API routes. Fixes both "RLS Disabled" and
--    "Sensitive Columns Exposed" warnings.
-- ---------------------------------------------------------------------------
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations FORCE ROW LEVEL SECURITY;

-- Service role (API routes) – full access (bypasses RLS by default, but
-- explicit policy is good practice)
DROP POLICY IF EXISTS "service_role_all_integrations" ON public.integrations;
CREATE POLICY "service_role_all_integrations"
  ON public.integrations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins (client-side anon/session) – full CRUD
DROP POLICY IF EXISTS "admin_all_integrations" ON public.integrations;
CREATE POLICY "admin_all_integrations"
  ON public.integrations
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. favorites – users manage their own favorites only
-- ---------------------------------------------------------------------------
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_favorites" ON public.favorites;
DROP POLICY IF EXISTS "users_insert_own_favorites" ON public.favorites;
DROP POLICY IF EXISTS "users_delete_own_favorites" ON public.favorites;
DROP POLICY IF EXISTS "users_manage_own_favorites" ON public.favorites;

CREATE POLICY "users_select_own_favorites"
  ON public.favorites
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_favorites"
  ON public.favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_delete_own_favorites"
  ON public.favorites
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. discount_code_usages – table exists but is unused in application code.
--    Lock it down: service_role only.
-- ---------------------------------------------------------------------------
ALTER TABLE public.discount_code_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_code_usages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_discount_code_usages" ON public.discount_code_usages;
CREATE POLICY "service_role_all_discount_code_usages"
  ON public.discount_code_usages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5. user_addresses – users manage their own addresses only
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_addresses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "users_insert_own_addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "users_update_own_addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "users_delete_own_addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "users_manage_own_addresses" ON public.user_addresses;

CREATE POLICY "users_select_own_addresses"
  ON public.user_addresses
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_addresses"
  ON public.user_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_addresses"
  ON public.user_addresses
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_delete_own_addresses"
  ON public.user_addresses
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. discount_redemptions – server-only table (service_role), no client access
-- ---------------------------------------------------------------------------
ALTER TABLE public.discount_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_redemptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_discount_redemptions" ON public.discount_redemptions;
CREATE POLICY "service_role_all_discount_redemptions"
  ON public.discount_redemptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 7. Security Definer Views → Security Invoker
--    By default PostgreSQL views execute as the view owner (= security definer).
--    Setting security_invoker = true makes them respect the caller's RLS.
-- ---------------------------------------------------------------------------

-- orders_warsaw (not used in app code but exists in DB)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'orders_warsaw'
  ) THEN
    ALTER VIEW public.orders_warsaw SET (security_invoker = true);
  END IF;
END;
$$;

-- v_pos_products_with_category
ALTER VIEW public.v_pos_products_with_category SET (security_invoker = true);

-- v_orders_pending_dotypos
ALTER VIEW public.v_orders_pending_dotypos SET (security_invoker = true);

-- ---------------------------------------------------------------------------
-- 8. Revoke direct table access from anon role on sensitive/internal tables
--    (belt-and-suspenders: RLS protects even if GRANT exists, but revoking
--    unnecessary grants is defense in depth)
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.dotypos_webhook_logs FROM anon;
REVOKE ALL ON public.discount_code_usages FROM anon;
REVOKE ALL ON public.discount_redemptions FROM anon;
REVOKE ALL ON public.integrations FROM anon;


-- =============================================================================
-- PART 2: Warnings — function_search_path_mutable, rls_policy_always_true,
--         extension_in_public
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 9. Helper: is_admin_or_employee()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_or_employee()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'employee')
  );
$$;

-- ---------------------------------------------------------------------------
-- 10. function_search_path_mutable — fix 7 functions
--     Adding SET search_path = public prevents search_path injection attacks
-- ---------------------------------------------------------------------------

-- 10a. Functions with known definitions (recreate with SET search_path)
CREATE OR REPLACE FUNCTION public.update_order_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_addons_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 10b. Functions that exist only in the live DB (ALTER to add search_path).
--      Wrapped in DO blocks so migration doesn't fail if signature differs.
DO $$ BEGIN
  ALTER FUNCTION public.tg_discount_used_count() SET search_path = public;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'tg_discount_used_count: %', SQLERRM;
END; $$;

DO $$ BEGIN
  ALTER FUNCTION public.touch_updated_at() SET search_path = public;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'touch_updated_at: %', SQLERRM;
END; $$;

DO $$ BEGIN
  ALTER FUNCTION public.set_updated_at() SET search_path = public;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'set_updated_at: %', SQLERRM;
END; $$;

DO $$ BEGIN
  ALTER FUNCTION public.bump_used_count() SET search_path = public;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'bump_used_count: %', SQLERRM;
END; $$;

DO $$ BEGIN
  ALTER FUNCTION public.redeem_discount_code() SET search_path = public;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'redeem_discount_code: %', SQLERRM;
END; $$;

-- ---------------------------------------------------------------------------
-- 11. extension_in_public — move citext to extensions schema
--     PostgreSQL tracks column types by OID, so existing columns using
--     citext (discount_redemptions.code, .email_lower) will keep working.
--     Supabase search_path includes 'extensions' by default.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER EXTENSION citext SET SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'citext move: %', SQLERRM;
END; $$;

-- ---------------------------------------------------------------------------
-- 12. rls_policy_always_true — replace overly permissive policies
-- ---------------------------------------------------------------------------

-- ── 12a. delivery_zones ──────────────────────────────────────────────────
-- Current: "write_delivery_zones_authed" ALL authenticated true/true
-- Fix:     public SELECT + admin/employee write
DROP POLICY IF EXISTS "write_delivery_zones_authed" ON public.delivery_zones;

DROP POLICY IF EXISTS "public_read_delivery_zones" ON public.delivery_zones;
CREATE POLICY "public_read_delivery_zones"
  ON public.delivery_zones
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "staff_manage_delivery_zones" ON public.delivery_zones;
CREATE POLICY "staff_manage_delivery_zones"
  ON public.delivery_zones
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "staff_update_delivery_zones" ON public.delivery_zones;
CREATE POLICY "staff_update_delivery_zones"
  ON public.delivery_zones
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_employee())
  WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "staff_delete_delivery_zones" ON public.delivery_zones;
CREATE POLICY "staff_delete_delivery_zones"
  ON public.delivery_zones
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_employee());

-- ── 12b. orders ──────────────────────────────────────────────────────────
-- Current: "Allow all" (ALL, public, true/true)
--          "Allow all updates" (UPDATE, public, true/true)
--          "Allow insert for all" (INSERT, public, true)
-- Fix:     user reads own + staff reads all + staff updates;
--          INSERT/DELETE via service_role only (API routes)
DROP POLICY IF EXISTS "Allow all" ON public.orders;
DROP POLICY IF EXISTS "Allow all updates" ON public.orders;
DROP POLICY IF EXISTS "Allow insert for all" ON public.orders;

DROP POLICY IF EXISTS "users_select_own_orders" ON public.orders;
CREATE POLICY "users_select_own_orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING ("user" = auth.uid()::text);

DROP POLICY IF EXISTS "staff_select_all_orders" ON public.orders;
CREATE POLICY "staff_select_all_orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_employee());

DROP POLICY IF EXISTS "staff_update_orders" ON public.orders;
CREATE POLICY "staff_update_orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_employee())
  WITH CHECK (public.is_admin_or_employee());

-- INSERT and DELETE handled by service_role (bypasses RLS)

-- ── 12c. products ────────────────────────────────────────────────────────
-- Current: "temp allow update" (UPDATE, public, true/true)
-- Fix:     admin/employee only for write operations
DROP POLICY IF EXISTS "temp allow update" ON public.products;

DROP POLICY IF EXISTS "staff_update_products" ON public.products;
CREATE POLICY "staff_update_products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_employee())
  WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "staff_insert_products" ON public.products;
CREATE POLICY "staff_insert_products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "staff_delete_products" ON public.products;
CREATE POLICY "staff_delete_products"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_employee());

-- ── 12d. profiles ────────────────────────────────────────────────────────
-- Current: "Allow insert via trigger" (INSERT, public, true)
-- Fix:     Trigger function uses SECURITY DEFINER (bypasses RLS).
--          Only allow authenticated users to insert their own profile.
DROP POLICY IF EXISTS "Allow insert via trigger" ON public.profiles;

DROP POLICY IF EXISTS "users_insert_own_profile" ON public.profiles;
CREATE POLICY "users_insert_own_profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ── 12e. reservations ────────────────────────────────────────────────────
-- Current: "anon_insert_reservations" (INSERT, anon, true)
-- Fix:     Reservation creation goes through API route (service_role).
--          The public ReservationModal only does SELECT (slot counts).
--          Remove direct anon INSERT — service_role bypasses RLS.
DROP POLICY IF EXISTS "anon_insert_reservations" ON public.reservations;

-- ── 12f. restaurant_tables ───────────────────────────────────────────────
-- Current: "restaurant_tables_rw" (ALL, public, true/true)
--          "write_restaurant_tables_authed" (ALL, authenticated, true/true)
-- Fix:     public SELECT + admin/employee write
DROP POLICY IF EXISTS "restaurant_tables_rw" ON public.restaurant_tables;
DROP POLICY IF EXISTS "write_restaurant_tables_authed" ON public.restaurant_tables;

DROP POLICY IF EXISTS "public_read_restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "public_read_restaurant_tables"
  ON public.restaurant_tables
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "staff_manage_restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "staff_manage_restaurant_tables"
  ON public.restaurant_tables
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "staff_update_restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "staff_update_restaurant_tables"
  ON public.restaurant_tables
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_employee())
  WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "staff_delete_restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "staff_delete_restaurant_tables"
  ON public.restaurant_tables
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_employee());

-- ── 12g. table_layout ────────────────────────────────────────────────────
-- Current: "table_layout_insert" (INSERT, public, true)
--          "table_layout_rw" (ALL, public, true/true)
--          "table_layout_update" (UPDATE, public, true/true)
-- Fix:     Only used via service_role API routes + admin read
DROP POLICY IF EXISTS "table_layout_insert" ON public.table_layout;
DROP POLICY IF EXISTS "table_layout_rw" ON public.table_layout;
DROP POLICY IF EXISTS "table_layout_update" ON public.table_layout;

DROP POLICY IF EXISTS "staff_read_table_layout" ON public.table_layout;
CREATE POLICY "staff_read_table_layout"
  ON public.table_layout
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_employee());

-- Write via service_role only (bypasses RLS)

-- =============================================================================
-- NOT FIXABLE VIA SQL — requires Supabase Dashboard action:
-- =============================================================================
-- ❶ auth_leaked_password_protection
--    → Dashboard → Authentication → URL Configuration (or Auth settings)
--    → Enable "Leaked password protection" (uses HaveIBeenPwned.org)
--
-- ❷ vulnerable_postgres_version (supabase-postgres-15.8.1.121)
--    → Dashboard → Project Settings → Infrastructure → Upgrade Postgres
-- =============================================================================
