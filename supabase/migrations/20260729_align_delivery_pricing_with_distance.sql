-- Cennik dostaw SISI:
-- drogowy dystans Google zaokrąglony do pełnego kilometra × 2,00 zł/km.
-- Zakres rozpiski: 0-22 km. Minimalna wartość zamówienia, ETA i próg darmowej
-- dostawy pozostają takie, jakie są zapisane w bazie.
--
-- Migracja celowo NIE używa UUID rekordów. Jest atomowa i zabezpieczona:
-- aktualizuje wyłącznie rozpoznaną starą konfigurację, a przy innym stanie
-- przerywa transakcję bez częściowych zmian.

BEGIN;

LOCK TABLE public.delivery_zones IN SHARE ROW EXCLUSIVE MODE;

DO $migration$
DECLARE
  active_zone_count integer;
  target_near_count integer;
  target_far_count integer;
  near_zone_id uuid;
  far_zone_id uuid;
BEGIN
  SELECT count(*)
  INTO active_zone_count
  FROM public.delivery_zones
  WHERE active IS TRUE;

  -- Pozwala bezpiecznie ponowić skrypt, jeżeli docelowa konfiguracja już jest.
  SELECT count(*)
  INTO target_near_count
  FROM public.delivery_zones
  WHERE active IS TRUE
    AND pricing_type = 'per_km'
    AND cost = 2
    AND cost_fixed = 0
    AND cost_per_km = 2
    AND min_distance_km = 0
    AND max_distance_km = 7;

  SELECT count(*)
  INTO target_far_count
  FROM public.delivery_zones
  WHERE active IS TRUE
    AND pricing_type = 'per_km'
    AND cost = 2
    AND cost_fixed = 0
    AND cost_per_km = 2
    AND min_distance_km = 8
    AND max_distance_km = 22;

  IF active_zone_count = 2
    AND target_near_count = 1
    AND target_far_count = 1
  THEN
    RETURN;
  END IF;

  -- Oczekiwany stan sprzed zmiany. Jeżeli ktoś wcześniej zmienił cennik,
  -- migracja ma się zatrzymać zamiast nadpisać nieznaną konfigurację.
  SELECT id
  INTO near_zone_id
  FROM public.delivery_zones
  WHERE active IS TRUE
    AND min_distance_km = 0
    AND max_distance_km = 7
    AND pricing_type = 'flat'
    AND cost = 5
    AND cost_fixed = 5
    AND cost_per_km = 0
    AND free_over = 120;

  SELECT id
  INTO far_zone_id
  FROM public.delivery_zones
  WHERE active IS TRUE
    AND min_distance_km = 7
    AND max_distance_km = 17
    AND pricing_type = 'per_km'
    AND cost = 2
    AND cost_fixed = 0
    AND cost_per_km = 2
    AND free_over IS NULL;

  IF active_zone_count <> 2 OR near_zone_id IS NULL OR far_zone_id IS NULL THEN
    RAISE EXCEPTION
      'Przerwano zmianę cennika: aktualne strefy dostawy nie odpowiadają oczekiwanej starej konfiguracji.';
  END IF;

  UPDATE public.delivery_zones
  SET
    min_distance_km = 0,
    max_distance_km = 7,
    cost = 2,
    cost_fixed = 0,
    cost_per_km = 2,
    pricing_type = 'per_km'
  WHERE id = near_zone_id;

  UPDATE public.delivery_zones
  SET
    min_distance_km = 8,
    max_distance_km = 22,
    cost = 2,
    cost_fixed = 0,
    cost_per_km = 2,
    pricing_type = 'per_km'
  WHERE id = far_zone_id;

  SELECT count(*)
  INTO target_near_count
  FROM public.delivery_zones
  WHERE active IS TRUE
    AND pricing_type = 'per_km'
    AND cost = 2
    AND cost_fixed = 0
    AND cost_per_km = 2
    AND min_distance_km = 0
    AND max_distance_km = 7;

  SELECT count(*)
  INTO target_far_count
  FROM public.delivery_zones
  WHERE active IS TRUE
    AND pricing_type = 'per_km'
    AND cost = 2
    AND cost_fixed = 0
    AND cost_per_km = 2
    AND min_distance_km = 8
    AND max_distance_km = 22;

  IF target_near_count <> 1 OR target_far_count <> 1 THEN
    RAISE EXCEPTION
      'Nie udało się potwierdzić docelowej konfiguracji stref dostawy.';
  END IF;
END
$migration$;

COMMIT;
