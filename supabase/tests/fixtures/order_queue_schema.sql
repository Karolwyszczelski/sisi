ALTER TABLE public.orders ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN p24_token text, ADD COLUMN dotypos_status text;
