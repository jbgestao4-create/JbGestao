-- Migration 00109: Bucket publico de assets para imagens de e-mail e sistema
INSERT INTO storage.buckets (id, name, public)
VALUES ('system-assets', 'system-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Access system-assets" ON storage.objects;
CREATE POLICY "Public Access system-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'system-assets');

DROP POLICY IF EXISTS "Public Insert system-assets" ON storage.objects;
CREATE POLICY "Public Insert system-assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'system-assets');

DROP POLICY IF EXISTS "Public Update system-assets" ON storage.objects;
CREATE POLICY "Public Update system-assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'system-assets');
