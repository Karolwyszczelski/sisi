ALTER TABLE public.orders ADD COLUMN p24_session_id text, ADD COLUMN p24_order_id text,
  ADD COLUMN paid_at timestamptz, ADD COLUMN dotypos_order_id bigint, ADD COLUMN dotypos_sent_at timestamptz;
