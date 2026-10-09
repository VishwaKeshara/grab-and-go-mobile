BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'product-images', 
  'product-images', 
  true, 
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

DROP POLICY IF EXISTS "Product images public read" ON storage.objects;
DROP POLICY IF EXISTS "Product images shop owner insert" ON storage.objects;
DROP POLICY IF EXISTS "Product images shop owner update" ON storage.objects;
DROP POLICY IF EXISTS "Product images shop owner delete" ON storage.objects;

DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Shop Owners Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Shop Owners Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Shop Owners Delete" ON storage.objects;

CREATE POLICY "Product images public read" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'product-images');

CREATE POLICY "Product images shop owner insert" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'product-images' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.customer_shops WHERE profile_id = auth.uid()
  )
);

CREATE POLICY "Product images shop owner update" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'product-images' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.customer_shops WHERE profile_id = auth.uid()
  )
);

CREATE POLICY "Product images shop owner delete" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'product-images' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.customer_shops WHERE profile_id = auth.uid()
  )
);

COMMIT;
