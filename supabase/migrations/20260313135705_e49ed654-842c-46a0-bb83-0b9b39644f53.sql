
-- Add new columns to stock_items
ALTER TABLE public.stock_items 
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_url text;

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload product images
CREATE POLICY "Users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Allow public read access to product images
CREATE POLICY "Public read access for product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Allow users to delete their own product images
CREATE POLICY "Users can delete own product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');
