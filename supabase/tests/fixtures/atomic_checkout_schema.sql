CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE TABLE public.restaurant_info (id integer PRIMARY KEY, ordering_open boolean, packaging_cost numeric);
INSERT INTO public.restaurant_info VALUES (1, false, 2);
GRANT SELECT, UPDATE ON public.restaurant_info TO anon, authenticated, service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS 'SELECT current_user::text';
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE public.products (id uuid PRIMARY KEY, name text);
INSERT INTO public.products VALUES ('c0000000-0000-4000-8000-000000000001','Synthetic checkout fixture');
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text, phone text, contact_email text, order_note text, address text, street text,
  postal_code text, city text, flat_number text, selected_option text, payment_method text,
  payment_status text, items jsonb, total_price numeric(10,2), delivery_cost numeric(10,2),
  base_before_discount numeric(10,2), delivery_min_required numeric(10,2), status text,
  client_delivery_time text, delivery_time timestamptz, eta text, "user" uuid, promo_code text,
  discount_amount numeric(10,2), legal_accept jsonb
);
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES public.orders(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  name text NOT NULL, quantity integer CHECK (quantity > 0), unit_price numeric(10,2), line_no int
);
CREATE TABLE public.discount_codes (
  id uuid PRIMARY KEY, code text UNIQUE, type text, value numeric, active boolean, auto_apply boolean,
  starts_at timestamptz, expires_at timestamptz, min_order numeric, max_uses integer, per_user_max_uses integer
);
CREATE TABLE public.discount_redemptions (
  code_id uuid REFERENCES public.discount_codes(id), code text,
  order_id uuid REFERENCES public.orders(id), user_id uuid, email_lower text, amount numeric(10,2)
);
GRANT SELECT, INSERT, UPDATE ON public.orders, public.order_items, public.discount_codes, public.discount_redemptions TO service_role;
