-- Migration 00084: Suporte a anexos de notas de compra e comprovantes nas movimentações de caixa (sangria/saída)
ALTER TABLE public.cash_session_movements
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT;

-- Configuração do bucket de storage para comprovantes de caixa
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cash-attachments',
  'cash-attachments',
  TRUE,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas de RLS para o bucket cash-attachments
DROP POLICY IF EXISTS "Membros autenticados consultam comprovantes de caixa" ON storage.objects;
CREATE POLICY "Membros autenticados consultam comprovantes de caixa"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cash-attachments'
    AND public.is_org_member((storage.foldername(name))[1]::UUID, auth.uid())
  );

DROP POLICY IF EXISTS "Acesso público aos comprovantes de caixa" ON storage.objects;
CREATE POLICY "Acesso público aos comprovantes de caixa"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'cash-attachments');

DROP POLICY IF EXISTS "Membros autenticados enviam comprovantes de caixa" ON storage.objects;
CREATE POLICY "Membros autenticados enviam comprovantes de caixa"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cash-attachments'
    AND public.is_org_member((storage.foldername(name))[1]::UUID, auth.uid())
  );

