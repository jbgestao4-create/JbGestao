CREATE UNIQUE INDEX IF NOT EXISTS suppliers_organization_id_id_key
  ON public.suppliers (organization_id, id);

CREATE TABLE IF NOT EXISTS public.supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  invoice_number TEXT,
  received_at DATE NOT NULL DEFAULT CURRENT_DATE,
  file_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 20971520),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT supplier_invoices_supplier_fk
    FOREIGN KEY (organization_id, supplier_id)
    REFERENCES public.suppliers (organization_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS supplier_invoices_supplier_received_idx
  ON public.supplier_invoices (organization_id, supplier_id, received_at DESC);

ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros com acesso podem consultar notas de fornecedores"
  ON public.supplier_invoices;
CREATE POLICY "Membros com acesso podem consultar notas de fornecedores"
  ON public.supplier_invoices FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = supplier_invoices.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code = 'MOD-06'
      )
    )
  );

DROP POLICY IF EXISTS "Membros com acesso podem gerenciar notas de fornecedores"
  ON public.supplier_invoices;
CREATE POLICY "Membros com acesso podem gerenciar notas de fornecedores"
  ON public.supplier_invoices FOR ALL
  TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = supplier_invoices.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code = 'MOD-06'
      )
    )
  )
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = supplier_invoices.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code = 'MOD-06'
      )
    )
  );

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'supplier-invoices',
  'supplier-invoices',
  FALSE,
  20971520,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Membros com acesso podem abrir notas fiscais de fornecedores"
  ON storage.objects;
CREATE POLICY "Membros com acesso podem abrir notas fiscais de fornecedores"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'supplier-invoices'
    AND EXISTS (
      SELECT 1
      FROM public.suppliers supplier
      WHERE supplier.organization_id::TEXT = (storage.foldername(name))[1]
        AND supplier.id::TEXT = (storage.foldername(name))[2]
        AND public.is_org_member(supplier.organization_id, auth.uid())
        AND (
          public.get_user_organization_role(supplier.organization_id, auth.uid()) IN ('owner', 'admin')
          OR EXISTS (
            SELECT 1
            FROM public.organization_member_dashboard_modules permission
            WHERE permission.organization_id = supplier.organization_id
              AND permission.user_id = auth.uid()
              AND permission.module_code = 'MOD-06'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Membros com acesso podem enviar notas fiscais de fornecedores"
  ON storage.objects;
CREATE POLICY "Membros com acesso podem enviar notas fiscais de fornecedores"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'supplier-invoices'
    AND EXISTS (
      SELECT 1
      FROM public.suppliers supplier
      WHERE supplier.organization_id::TEXT = (storage.foldername(name))[1]
        AND supplier.id::TEXT = (storage.foldername(name))[2]
        AND public.is_org_member(supplier.organization_id, auth.uid())
        AND (
          public.get_user_organization_role(supplier.organization_id, auth.uid()) IN ('owner', 'admin')
          OR EXISTS (
            SELECT 1
            FROM public.organization_member_dashboard_modules permission
            WHERE permission.organization_id = supplier.organization_id
              AND permission.user_id = auth.uid()
              AND permission.module_code = 'MOD-06'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Membros com acesso podem excluir notas fiscais de fornecedores"
  ON storage.objects;
CREATE POLICY "Membros com acesso podem excluir notas fiscais de fornecedores"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'supplier-invoices'
    AND EXISTS (
      SELECT 1
      FROM public.suppliers supplier
      WHERE supplier.organization_id::TEXT = (storage.foldername(name))[1]
        AND supplier.id::TEXT = (storage.foldername(name))[2]
        AND public.is_org_member(supplier.organization_id, auth.uid())
        AND (
          public.get_user_organization_role(supplier.organization_id, auth.uid()) IN ('owner', 'admin')
          OR EXISTS (
            SELECT 1
            FROM public.organization_member_dashboard_modules permission
            WHERE permission.organization_id = supplier.organization_id
              AND permission.user_id = auth.uid()
              AND permission.module_code = 'MOD-06'
          )
        )
    )
  );
