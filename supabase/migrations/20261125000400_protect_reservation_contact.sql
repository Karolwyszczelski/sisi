BEGIN;

REVOKE ALL ON TABLE public.reservations FROM anon, PUBLIC;

DO $$
DECLARE columns text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ')
    INTO columns
    FROM pg_attribute
   WHERE attrelid = 'public.reservations'::regclass
     AND attnum > 0
     AND NOT attisdropped;
  EXECUTE format('REVOKE ALL (%s) ON TABLE public.reservations FROM anon, PUBLIC', columns);
END;
$$;

GRANT SELECT (reservation_date, reservation_time) ON public.reservations TO anon;

COMMIT;
