-- Tabela do kontroli dostępności zamówień
CREATE TABLE IF NOT EXISTS order_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orders_enabled BOOLEAN DEFAULT TRUE NOT NULL,
  local_enabled BOOLEAN DEFAULT TRUE NOT NULL,
  takeaway_enabled BOOLEAN DEFAULT TRUE NOT NULL,
  delivery_enabled BOOLEAN DEFAULT TRUE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wstaw domyślny wiersz
INSERT INTO order_settings (orders_enabled, local_enabled, takeaway_enabled, delivery_enabled)
VALUES (true, true, true, true)
ON CONFLICT DO NOTHING;

-- Funkcja do automatycznej aktualizacji updated_at
CREATE OR REPLACE FUNCTION update_order_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS order_settings_updated_at ON order_settings;
CREATE TRIGGER order_settings_updated_at
  BEFORE UPDATE ON order_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_order_settings_updated_at();

-- Polityka RLS - wszyscy mogą czytać
ALTER TABLE order_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON order_settings
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated update" ON order_settings
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated insert" ON order_settings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
