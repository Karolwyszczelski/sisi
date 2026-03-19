-- Migration: Dotypos Integration Tables
-- ======================================
-- Creates tables needed for Dotypos POS integration
--
-- Run this migration in Supabase SQL Editor:
-- 1. Go to SQL Editor in your Supabase dashboard
-- 2. Paste this entire file
-- 3. Click "Run"
-- ======================================

-- ============================================
-- 1. Integrations Table
-- ============================================
-- Stores OAuth tokens and connection info for external integrations

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  refresh_token TEXT,
  cloud_id TEXT,
  access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if table already exists but columns are missing
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'integrations' AND column_name = 'access_token') THEN
    ALTER TABLE integrations ADD COLUMN access_token TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'integrations' AND column_name = 'access_token_expires_at') THEN
    ALTER TABLE integrations ADD COLUMN access_token_expires_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'integrations' AND column_name = 'connected_at') THEN
    ALTER TABLE integrations ADD COLUMN connected_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'integrations' AND column_name = 'updated_at') THEN
    ALTER TABLE integrations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================
-- 2. POS Products Table
-- ============================================
-- Stores products synced from Dotypos for order mapping

CREATE TABLE IF NOT EXISTS pos_products (
  pos_id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  barcode TEXT,
  plu TEXT,
  category_id BIGINT,
  vat_rate DECIMAL(5, 2) DEFAULT 23,
  deleted BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT pos_products_name_idx UNIQUE (name)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pos_products_name ON pos_products(name);
CREATE INDEX IF NOT EXISTS idx_pos_products_category ON pos_products(category_id);
CREATE INDEX IF NOT EXISTS idx_pos_products_deleted ON pos_products(deleted);

-- ============================================
-- 3. POS Categories Table
-- ============================================
-- Stores categories synced from Dotypos

CREATE TABLE IF NOT EXISTS pos_categories (
  pos_id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id BIGINT REFERENCES pos_categories(pos_id),
  sort_order INTEGER DEFAULT 0,
  deleted BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_pos_categories_parent ON pos_categories(parent_id);

-- ============================================
-- 4. Orders Table - Add Dotypos columns
-- ============================================
-- Extends the orders table with Dotypos tracking fields

DO $$ 
BEGIN
  -- Add dotypos_order_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'dotypos_order_id') THEN
    ALTER TABLE orders ADD COLUMN dotypos_order_id BIGINT;
  END IF;
  
  -- Add dotypos_receipt_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'dotypos_receipt_id') THEN
    ALTER TABLE orders ADD COLUMN dotypos_receipt_id BIGINT;
  END IF;
  
  -- Add dotypos_sent_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'dotypos_sent_at') THEN
    ALTER TABLE orders ADD COLUMN dotypos_sent_at TIMESTAMPTZ;
  END IF;
  
  -- Add dotypos_error column (for tracking failed sends)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'dotypos_error') THEN
    ALTER TABLE orders ADD COLUMN dotypos_error TEXT;
  END IF;

  -- Add dotypos_status column (sent, confirmed, pos_error)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'dotypos_status') THEN
    ALTER TABLE orders ADD COLUMN dotypos_status TEXT;
  END IF;

  -- Add dotypos_webhook_received_at column (when POS webhook callback arrived)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'dotypos_webhook_received_at') THEN
    ALTER TABLE orders ADD COLUMN dotypos_webhook_received_at TIMESTAMPTZ;
  END IF;

  -- Add dotypos_pos_response_code column (POS result code: 0 = OK)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'dotypos_pos_response_code') THEN
    ALTER TABLE orders ADD COLUMN dotypos_pos_response_code INTEGER;
  END IF;
END $$;

-- Index for finding orders not yet sent to Dotypos
CREATE INDEX IF NOT EXISTS idx_orders_dotypos_pending 
  ON orders(created_at) 
  WHERE dotypos_order_id IS NULL AND status = 'completed';

-- Index for tracking Dotypos order status
CREATE INDEX IF NOT EXISTS idx_orders_dotypos_status
  ON orders(dotypos_status)
  WHERE dotypos_status IS NOT NULL;

-- ============================================
-- 4b. Dotypos Webhook Logs Table (optional)
-- ============================================
-- Stores webhook payloads for debugging/auditing.
-- Used by /api/dotypos/webhook route.
-- Safe to drop if you don't need audit logs.

CREATE TABLE IF NOT EXISTS dotypos_webhook_logs (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,              -- 'pos-action-response', 'PRODUCT', 'ORDERBEAN', 'unknown', etc.
  payload JSONB,                   -- Full webhook payload
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-cleanup: keep only last 30 days of logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_received 
  ON dotypos_webhook_logs(received_at);

-- RLS for webhook logs
ALTER TABLE dotypos_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on dotypos_webhook_logs" ON dotypos_webhook_logs;
CREATE POLICY "Service role full access on dotypos_webhook_logs"
  ON dotypos_webhook_logs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 5. RLS Policies
-- ============================================
-- Row Level Security for the new tables

-- Enable RLS
ALTER TABLE pos_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create new ones
DO $$ 
BEGIN
  -- pos_products policies
  DROP POLICY IF EXISTS "Service role full access on pos_products" ON pos_products;
  DROP POLICY IF EXISTS "Authenticated read pos_products" ON pos_products;
  
  -- pos_categories policies
  DROP POLICY IF EXISTS "Service role full access on pos_categories" ON pos_categories;
  DROP POLICY IF EXISTS "Authenticated read pos_categories" ON pos_categories;
END $$;

-- Policy: Service role can do everything
CREATE POLICY "Service role full access on pos_products"
  ON pos_products FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access on pos_categories"
  ON pos_categories FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Authenticated users can read
CREATE POLICY "Authenticated read pos_products"
  ON pos_products FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated read pos_categories"
  ON pos_categories FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- 6. Helpful Views
-- ============================================

-- View: Active POS products with category name
CREATE OR REPLACE VIEW v_pos_products_with_category AS
SELECT 
  p.pos_id,
  p.name AS product_name,
  p.price,
  p.barcode,
  p.plu,
  c.name AS category_name,
  p.vat_rate,
  p.synced_at
FROM pos_products p
LEFT JOIN pos_categories c ON p.category_id = c.pos_id
WHERE p.deleted = FALSE;

-- View: Orders pending Dotypos sync
CREATE OR REPLACE VIEW v_orders_pending_dotypos AS
SELECT 
  id,
  created_at,
  name,
  total_price,
  status,
  payment_status
FROM orders
WHERE dotypos_order_id IS NULL 
  AND status IN ('placed', 'accepted', 'completed')
  AND payment_status = 'paid'
ORDER BY created_at ASC;

-- ============================================
-- 7. Comments for documentation
-- ============================================

COMMENT ON TABLE pos_products IS 'Products synced from Dotypos POS for order mapping';
COMMENT ON TABLE pos_categories IS 'Categories synced from Dotypos POS';
COMMENT ON COLUMN orders.dotypos_order_id IS 'Order ID returned from Dotypos POS after successful sync';
COMMENT ON COLUMN orders.dotypos_receipt_id IS 'Receipt ID from Dotypos POS';
COMMENT ON COLUMN orders.dotypos_sent_at IS 'Timestamp when order was sent to Dotypos';
COMMENT ON COLUMN orders.dotypos_error IS 'Error message if Dotypos sync failed';
COMMENT ON COLUMN orders.dotypos_status IS 'Dotypos sync status: sent, confirmed, pos_error';
COMMENT ON COLUMN orders.dotypos_webhook_received_at IS 'When POS webhook callback was received';
COMMENT ON COLUMN orders.dotypos_pos_response_code IS 'POS result code (0 = OK, see docs for other codes)';
COMMENT ON TABLE dotypos_webhook_logs IS 'Audit log of all webhook payloads received from Dotypos';

-- ============================================
-- Done!
-- ============================================
-- After running this migration:
-- 1. Configure environment variables (DOTYPOS_CLIENT_ID, DOTYPOS_CLIENT_SECRET)
-- 2. Connect via admin panel: /admin/settings → Integracje → Dotypos
-- 3. Sync products: GET /api/dotypos/sync-products
-- 4. Test order sending: POST /api/dotypos/send-order { orderId: "..." }
