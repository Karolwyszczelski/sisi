-- Migration: Add Dotypos v2 columns (2026 update)
-- ================================================
-- Run this if you already have the base tables from create_dotypos_tables.sql
-- and just need the new columns added by the 2026 API update.
--
-- Safe to run multiple times (uses IF NOT EXISTS).
-- ================================================

-- New columns on orders table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'dotypos_status') THEN
    ALTER TABLE orders ADD COLUMN dotypos_status TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'dotypos_webhook_received_at') THEN
    ALTER TABLE orders ADD COLUMN dotypos_webhook_received_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'dotypos_pos_response_code') THEN
    ALTER TABLE orders ADD COLUMN dotypos_pos_response_code INTEGER;
  END IF;
END $$;

-- Index for status tracking
CREATE INDEX IF NOT EXISTS idx_orders_dotypos_status
  ON orders(dotypos_status)
  WHERE dotypos_status IS NOT NULL;

-- Webhook audit logs table
CREATE TABLE IF NOT EXISTS dotypos_webhook_logs (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_received 
  ON dotypos_webhook_logs(received_at);

ALTER TABLE dotypos_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on dotypos_webhook_logs" ON dotypos_webhook_logs;
CREATE POLICY "Service role full access on dotypos_webhook_logs"
  ON dotypos_webhook_logs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE dotypos_webhook_logs IS 'Audit log of webhook payloads from Dotypos POS';

-- Done! New columns: dotypos_status, dotypos_webhook_received_at, dotypos_pos_response_code
-- New table: dotypos_webhook_logs
