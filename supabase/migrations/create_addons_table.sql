-- =====================================================
-- TABELA DODATKÓW (addons) dla Supabase
-- =====================================================

-- Utwórz tabelę addons
CREATE TABLE IF NOT EXISTS public.addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    price NUMERIC(10,2) NOT NULL DEFAULT 4.00,
    category VARCHAR(50) DEFAULT 'dodatek', -- 'dodatek', 'sos', 'premium'
    available BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dodaj indeks na nazwie
CREATE INDEX IF NOT EXISTS idx_addons_name ON public.addons(name);
CREATE INDEX IF NOT EXISTS idx_addons_category ON public.addons(category);

-- Włącz RLS
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;

-- Polityka: każdy może czytać
CREATE POLICY "Addons are viewable by everyone" 
ON public.addons FOR SELECT 
USING (true);

-- Polityka: tylko authenticated users mogą modyfikować (admin)
CREATE POLICY "Addons are editable by authenticated users" 
ON public.addons FOR ALL 
USING (auth.role() = 'authenticated');

-- =====================================================
-- WSTAW WSZYSTKIE DODATKI
-- =====================================================

-- Dodatki standardowe (4 zł)
INSERT INTO public.addons (name, price, category, display_order) VALUES
    ('Ser', 4.00, 'dodatek', 1),
    ('Bekon', 4.00, 'dodatek', 2),
    ('Jalapeño', 4.00, 'dodatek', 3),
    ('Ogórek', 4.00, 'dodatek', 4),
    ('Rukola', 4.00, 'dodatek', 5),
    ('Czerwona cebula', 4.00, 'dodatek', 6),
    ('Pomidor', 4.00, 'dodatek', 7),
    ('Pikle', 4.00, 'dodatek', 8),
    ('Nachosy', 4.00, 'dodatek', 9),
    ('Konfitura z cebuli', 4.00, 'dodatek', 10),
    ('Gruszka', 4.00, 'dodatek', 11),
    ('Ser cheddar', 4.00, 'dodatek', 12)
ON CONFLICT (name) DO NOTHING;

-- Dodatek premium (6 zł)
INSERT INTO public.addons (name, price, category, display_order) VALUES
    ('Płynny ser', 6.00, 'premium', 20)
ON CONFLICT (name) DO NOTHING;

-- Sosy (3 zł)
INSERT INTO public.addons (name, price, category, display_order) VALUES
    ('Amerykański', 3.00, 'sos', 30),
    ('Ketchup', 3.00, 'sos', 31),
    ('Majonez', 3.00, 'sos', 32),
    ('Musztarda', 3.00, 'sos', 33),
    ('Meksykański', 3.00, 'sos', 34),
    ('Serowy chili', 3.00, 'sos', 35),
    ('Czosnkowy', 3.00, 'sos', 36),
    ('Musztardowo-miodowy', 3.00, 'sos', 37),
    ('BBQ', 3.00, 'sos', 38),
    ('Sos BBQ', 3.00, 'sos', 39),
    ('Sos meksykański', 3.00, 'sos', 40)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- FUNKCJA DO AKTUALIZACJI updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_addons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trigger_addons_updated_at ON public.addons;
CREATE TRIGGER trigger_addons_updated_at
    BEFORE UPDATE ON public.addons
    FOR EACH ROW
    EXECUTE FUNCTION update_addons_updated_at();

-- =====================================================
-- DODAJ KOLUMNĘ packaging_cost DO restaurant_info (jeśli nie istnieje)
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'restaurant_info' AND column_name = 'packaging_cost'
    ) THEN
        ALTER TABLE public.restaurant_info ADD COLUMN packaging_cost NUMERIC(10,2) DEFAULT 2.00;
    END IF;
END $$;

-- Ustaw domyślną wartość packaging_cost
UPDATE public.restaurant_info SET packaging_cost = 2.00 WHERE id = 1 AND packaging_cost IS NULL;
