-- Product images must be readable on the public menu, while uploads remain
-- restricted to the server-side admin endpoint using the service role.
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read access for product images" ON storage.objects;
CREATE POLICY "Public read access for product images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'products');
