-- Ciechanów zachowuje dotychczasową stałą opłatę 5 zł.
-- Pozostałe miejscowości korzystają z ogólnych stref kilometrowych.
--
-- WAŻNE: tę migrację należy wykonać dopiero po wdrożeniu kodu obsługującego
-- destination_city. Stary kod nie rozróżnia zakresów miejskich i ogólnych.
--
-- Migracja jest atomowa i nie opiera się na UUID rekordów. Zachowuje z
-- istniejącej strefy lokalnej minimalną wartość zamówienia, próg darmowej
-- dostawy oraz ETA.

BEGIN;

LOCK TABLE public.delivery_zones IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS destination_city text;

DO $migration$
DECLARE
  generic_near_count integer;
  generic_far_count integer;
  city_override_count integer;
BEGIN
  SELECT count(*)
  INTO city_override_count
  FROM public.delivery_zones
  WHERE active IS TRUE
    AND lower(btrim(destination_city)) = lower('Ciechanów');

  -- Bezpieczne ponowienie: zaakceptuj wyłącznie dokładnie oczekiwany rekord.
  IF city_override_count = 1 AND EXISTS (
    SELECT 1
    FROM public.delivery_zones
    WHERE active IS TRUE
      AND lower(btrim(destination_city)) = lower('Ciechanów')
      AND min_distance_km = 0
      AND max_distance_km = 22
      AND pricing_type = 'flat'
      AND cost = 5
      AND cost_fixed = 5
      AND cost_per_km = 0
  ) THEN
    RETURN;
  END IF;

  IF city_override_count <> 0 THEN
    RAISE EXCEPTION
      'Przerwano migrację: istnieje nieoczekiwana strefa miejska dla Ciechanowa.';
  END IF;

  SELECT count(*)
  INTO generic_near_count
  FROM public.delivery_zones
  WHERE active IS TRUE
    AND destination_city IS NULL
    AND min_distance_km = 0
    AND max_distance_km = 7
    AND pricing_type = 'per_km'
    AND cost = 2
    AND cost_fixed = 0
    AND cost_per_km = 2;

  SELECT count(*)
  INTO generic_far_count
  FROM public.delivery_zones
  WHERE active IS TRUE
    AND destination_city IS NULL
    AND min_distance_km = 8
    AND max_distance_km = 22
    AND pricing_type = 'per_km'
    AND cost = 2
    AND cost_fixed = 0
    AND cost_per_km = 2;

  IF generic_near_count <> 1 OR generic_far_count <> 1 THEN
    RAISE EXCEPTION
      'Przerwano migrację: ogólne strefy kilometrowe mają nieoczekiwaną konfigurację.';
  END IF;

  INSERT INTO public.delivery_zones (
    min_distance_km,
    max_distance_km,
    min_order_value,
    cost,
    free_over,
    eta_min_minutes,
    eta_max_minutes,
    cost_fixed,
    cost_per_km,
    pricing_type,
    active,
    destination_city
  )
  SELECT
    0,
    22,
    min_order_value,
    5,
    free_over,
    eta_min_minutes,
    eta_max_minutes,
    5,
    0,
    'flat',
    TRUE,
    'Ciechanów'
  FROM public.delivery_zones
  WHERE active IS TRUE
    AND destination_city IS NULL
    AND min_distance_km = 0
    AND max_distance_km = 7
    AND pricing_type = 'per_km'
    AND cost = 2
    AND cost_fixed = 0
    AND cost_per_km = 2;

  IF NOT EXISTS (
    SELECT 1
    FROM public.delivery_zones
    WHERE active IS TRUE
      AND lower(btrim(destination_city)) = lower('Ciechanów')
      AND min_distance_km = 0
      AND max_distance_km = 22
      AND pricing_type = 'flat'
      AND cost = 5
      AND cost_fixed = 5
      AND cost_per_km = 0
  ) THEN
    RAISE EXCEPTION
      'Nie udało się potwierdzić miejskiej strefy dostawy dla Ciechanowa.';
  END IF;
END
$migration$;

COMMIT;
