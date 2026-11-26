BEGIN;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profiles FROM anon, PUBLIC;

DROP POLICY IF EXISTS sisi_profiles_select_own ON public.profiles;
CREATE POLICY sisi_profiles_select_own ON public.profiles
AS RESTRICTIVE FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS sisi_profiles_insert_client ON public.profiles;
CREATE POLICY sisi_profiles_insert_client ON public.profiles
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (id = auth.uid() AND role = 'client');

DROP POLICY IF EXISTS sisi_profiles_update_own ON public.profiles;
CREATE POLICY sisi_profiles_update_own ON public.profiles
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS sisi_profiles_no_direct_delete ON public.profiles;
CREATE POLICY sisi_profiles_no_direct_delete ON public.profiles
AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.sisi_prevent_direct_profile_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user = 'authenticated' AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Profile role may only be changed by a trusted database role'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sisi_protect_profile_role ON public.profiles;
CREATE TRIGGER sisi_protect_profile_role
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sisi_prevent_direct_profile_role_changes();

COMMIT;
