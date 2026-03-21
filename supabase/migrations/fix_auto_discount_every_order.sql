-- ============================================================
-- MIGRATION: Fix auto-discount so it applies to EVERY order
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── KROK 1: Usuń unique index który blokował rabat po 1. zamówieniu ──────────
--
-- Index "one_use_per_identity_active_order" na tabeli orders był przyczyną
-- błędu 23505 i blokował auto-rabat dla każdego klienta po pierwszym zamówieniu.
-- Może być na tabeli orders lub discount_redemptions – usuwamy oba warianty.

DROP INDEX IF EXISTS public.one_use_per_identity_active_order;

-- Jeśli index był tworzony bez schematu:
DROP INDEX IF EXISTS one_use_per_identity_active_order;


-- ── KROK 2: Upewnij się że tabela discount_redemptions istnieje ───────────────

CREATE TABLE IF NOT EXISTS public.discount_redemptions (
  id          uuid        NOT NULL DEFAULT extensions.uuid_generate_v4(),
  code_id     uuid        NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  code        public.citext NOT NULL,
  order_id    uuid        NOT NULL,
  user_id     uuid        NULL,
  email_lower public.citext NULL,
  amount      numeric(10,2) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discount_redemptions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_dr_code_id    ON public.discount_redemptions (code_id);
CREATE INDEX IF NOT EXISTS idx_dr_order_id   ON public.discount_redemptions (order_id);
CREATE INDEX IF NOT EXISTS idx_dr_user_id    ON public.discount_redemptions (user_id);
CREATE INDEX IF NOT EXISTS idx_dr_email      ON public.discount_redemptions (email_lower);


-- ── KROK 3: Trigger auto-inkrementujący used_count ────────────────────────────
--
-- Każdy INSERT do discount_redemptions atomicznie zwiększa used_count
-- w discount_codes. Eliminuje potrzebę ręcznego UPDATE z kodu aplikacji.

CREATE OR REPLACE FUNCTION public.tg_increment_discount_used_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.discount_codes
  SET used_count = used_count + 1
  WHERE id = NEW.code_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_used_count ON public.discount_redemptions;

CREATE TRIGGER trg_increment_used_count
  AFTER INSERT ON public.discount_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_increment_discount_used_count();


-- ── KROK 4: Naprawa existing data – zsynchronizuj used_count z redemptions ────

UPDATE public.discount_codes dc
SET used_count = (
  SELECT COUNT(*)
  FROM public.discount_redemptions dr
  WHERE dr.code_id = dc.id
);


-- ── KROK 5: Upewnij się że auto-apply kod ma nieograniczone użycia ─────────────
--
-- Dla kodów auto_apply = true: max_uses i per_user_max_uses MUSZĄ być NULL
-- (NULL = brak limitu). Jeśli mają jakąkolwiek wartość – rabat przestaje działać
-- po N zamówieniach globalnie lub per-użytkownik.
-- UWAGA: Sprawdź najpierw co jest ustawione (zapytanie diagnostyczne poniżej),
-- a następnie odkomentuj UPDATE jeśli potrzebne.

-- Diagnostyka (zawsze bezpieczne – tylko SELECT):
SELECT
  id,
  code,
  type,
  value,
  active,
  auto_apply,
  max_uses,
  per_user_max_uses,
  used_count
FROM public.discount_codes
WHERE auto_apply = true
ORDER BY created_at DESC;

-- Jeśli powyższe zapytanie pokazuje max_uses lub per_user_max_uses != NULL,
-- odkomentuj poniższy UPDATE:
--
-- UPDATE public.discount_codes
-- SET
--   max_uses         = NULL,
--   per_user_max_uses = NULL
-- WHERE auto_apply = true
--   AND active = true;
