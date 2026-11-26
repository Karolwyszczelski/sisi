BEGIN;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.orders FROM anon, PUBLIC;

DROP POLICY IF EXISTS sisi_order_access_boundary ON public.orders;
CREATE POLICY sisi_order_access_boundary ON public.orders
AS RESTRICTIVE FOR SELECT TO authenticated
USING ("user"::text = auth.uid()::text OR public.is_admin_or_employee());

DROP POLICY IF EXISTS sisi_orders_insert_boundary ON public.orders;
CREATE POLICY sisi_orders_insert_boundary ON public.orders AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_employee());
DROP POLICY IF EXISTS sisi_orders_update_boundary ON public.orders;
CREATE POLICY sisi_orders_update_boundary ON public.orders AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_admin_or_employee()) WITH CHECK (public.is_admin_or_employee());
DROP POLICY IF EXISTS sisi_orders_delete_boundary ON public.orders;
CREATE POLICY sisi_orders_delete_boundary ON public.orders AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_admin_or_employee());

DO $$
BEGIN
  IF to_regclass('public.order_items') IS NOT NULL THEN
    ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.order_items FROM anon, PUBLIC;
    DROP POLICY IF EXISTS sisi_order_items_access_boundary ON public.order_items;
    CREATE POLICY sisi_order_items_access_boundary ON public.order_items
    AS RESTRICTIVE FOR SELECT TO authenticated
    USING (
      EXISTS (SELECT 1 FROM public.orders o
              WHERE o.id::text = order_items.order_id::text
                AND (o."user"::text = auth.uid()::text OR public.is_admin_or_employee()))
    );
    DROP POLICY IF EXISTS sisi_order_items_insert_boundary ON public.order_items;
    CREATE POLICY sisi_order_items_insert_boundary ON public.order_items AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_employee());
    DROP POLICY IF EXISTS sisi_order_items_update_boundary ON public.order_items;
    CREATE POLICY sisi_order_items_update_boundary ON public.order_items AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_admin_or_employee()) WITH CHECK (public.is_admin_or_employee());
    DROP POLICY IF EXISTS sisi_order_items_delete_boundary ON public.order_items;
    CREATE POLICY sisi_order_items_delete_boundary ON public.order_items AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_admin_or_employee());

  END IF;
END $$;

COMMIT;
