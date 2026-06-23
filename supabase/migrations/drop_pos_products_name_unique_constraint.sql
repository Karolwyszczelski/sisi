-- Migration: allow duplicate product names from Dotypos
-- ==================================================
-- Dotypos can return distinct products with the same display name
-- (different pos_id, category, variants, etc.).
--
-- Keeping UNIQUE(name) breaks sync with error:
-- duplicate key value violates unique constraint "pos_products_name_idx"
--
-- We keep:
-- - PRIMARY KEY on pos_id (stable external identifier)
-- - non-unique index on name for lookup performance

ALTER TABLE IF EXISTS pos_products
  DROP CONSTRAINT IF EXISTS pos_products_name_idx;

-- Safety: in case this was created as a standalone unique index instead of constraint
DROP INDEX IF EXISTS pos_products_name_idx;

-- Ensure non-unique lookup index exists
CREATE INDEX IF NOT EXISTS idx_pos_products_name ON pos_products(name);
