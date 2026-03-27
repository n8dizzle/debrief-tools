-- Create the pricebook-uploads storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pricebook-uploads',
  'pricebook-uploads',
  false,
  20971520, -- 20MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for pricebook-uploads bucket
-- Contractors can upload to their own folder
CREATE POLICY "Contractors upload own pricebook files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pricebook-uploads'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM contractors WHERE user_id = auth.uid()
  )
);

-- Contractors can read their own files
CREATE POLICY "Contractors read own pricebook files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'pricebook-uploads'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM contractors WHERE user_id = auth.uid()
  )
);

-- Contractors can delete their own files
CREATE POLICY "Contractors delete own pricebook files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pricebook-uploads'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM contractors WHERE user_id = auth.uid()
  )
);
