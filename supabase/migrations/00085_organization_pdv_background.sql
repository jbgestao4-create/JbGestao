-- Migration 00085: Adiciona campo para imagem de fundo/logo da empresa no PDV e bucket de assets
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS pdv_background_url TEXT;

-- Criação do bucket company-assets para logos e imagens de fundo do PDV
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-assets',
  'company-assets',
  TRUE,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas de RLS para o bucket company-assets
DROP POLICY IF EXISTS "Membros autorizados enviam assets da empresa" ON storage.objects;
CREATE POLICY "Membros autorizados enviam assets da empresa"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-assets'
    AND public.is_org_member((storage.foldername(name))[1]::UUID, auth.uid())
  );

DROP POLICY IF EXISTS "Acesso público aos assets da empresa" ON storage.objects;
CREATE POLICY "Acesso público aos assets da empresa"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'company-assets');

DROP POLICY IF EXISTS "Membros autorizados atualizam assets da empresa" ON storage.objects;
CREATE POLICY "Membros autorizados atualizam assets da empresa"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND public.is_org_member((storage.foldername(name))[1]::UUID, auth.uid())
  );

DROP POLICY IF EXISTS "Membros autorizados excluem assets da empresa" ON storage.objects;
CREATE POLICY "Membros autorizados excluem assets da empresa"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND public.is_org_member((storage.foldername(name))[1]::UUID, auth.uid())
  );

-- Garante que membros administradores possam atualizar o pdv_background_url da organização
DROP POLICY IF EXISTS "Admins podem atualizar organizacao" ON public.organizations;
CREATE POLICY "Admins podem atualizar organizacao"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (
    public.get_user_organization_role(id, auth.uid()) IN ('owner', 'admin')
    OR public.is_org_member(id, auth.uid())
  )
  WITH CHECK (
    public.get_user_organization_role(id, auth.uid()) IN ('owner', 'admin')
    OR public.is_org_member(id, auth.uid())
  );

