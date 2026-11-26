-- Apply before deploying the burger-month API. Keep the canonical product's
-- availability unchanged; hiding a product must also disable the promotional CTA.
BEGIN;

CREATE OR REPLACE FUNCTION public.save_burger_month(
  p_name text, p_description text, p_price numeric, p_image_url text
) RETURNS timestamptz
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  saved_at timestamptz := now();
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' OR p_price IS NULL
     OR p_price <= 0 OR p_price::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Invalid burger of month name or price';
  END IF;

  UPDATE public.products
  SET name = 'Burger Miesiąca',
      description = btrim(p_name) || ' - ' || coalesce(p_description, ''),
      ingredients = ARRAY[]::text[],
      price = round(p_price, 2),
      image_url = nullif(btrim(p_image_url), '')
  WHERE id = 12;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Canonical burger of month (product 12) is missing';
  END IF;

  INSERT INTO public.burger_of_month (id, name, description, image_url, updated_at)
  VALUES ('current', btrim(p_name), coalesce(p_description, ''), nullif(btrim(p_image_url), ''), saved_at)
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name, description = EXCLUDED.description,
      image_url = EXCLUDED.image_url, updated_at = EXCLUDED.updated_at;

  RETURN saved_at;
END;
$$;

REVOKE ALL ON FUNCTION public.save_burger_month(text, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_burger_month(text, text, numeric, text) TO service_role;
COMMIT;
