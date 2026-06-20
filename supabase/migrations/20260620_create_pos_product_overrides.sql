-- Migration: pos_product_overrides
-- ======================================
-- Creates table for manual mappings from internal product_id -> POS pos_id
-- Use this to force exact POS product selection when fuzzy matching fails

CREATE TABLE IF NOT EXISTS pos_product_overrides (
  internal_product_id INTEGER PRIMARY KEY,
  pos_id BIGINT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_pos_product_overrides_pos_id ON pos_product_overrides(pos_id);

COMMENT ON TABLE pos_product_overrides IS 'Manual mapping of internal product_id -> Dotypos pos_id to override fuzzy matching';

-- Only backend requests using the service role should access these mappings.
ALTER TABLE pos_product_overrides ENABLE ROW LEVEL SECURITY;

-- Website and POS use different display names for these drinks, so name-based
-- matching is ambiguous (for example both Coca-Cola and Fanta contain "0,25 l").
INSERT INTO pos_product_overrides (internal_product_id, pos_id, note)
VALUES
  (29, 4307445928075278, 'Coca-Cola 0,25 l -> Coca-cola szklo'),
  (31, 2047713206299330, 'Fanta 0,5l -> Fanta 0,25 l')
ON CONFLICT (internal_product_id) DO UPDATE
SET
  pos_id = EXCLUDED.pos_id,
  note = EXCLUDED.note,
  updated_at = NOW();
