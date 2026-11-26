ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS deposit_grosze smallint NOT NULL DEFAULT 0
  CHECK (deposit_grosze IN (0, 50, 100));
