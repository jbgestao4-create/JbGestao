INSERT INTO public.organization_member_dashboard_modules (
  organization_id,
  user_id,
  module_code
)
SELECT organization_id, user_id, 'MOD-07'::public.dashboard_module_code
FROM public.organization_member_dashboard_modules
WHERE module_code = 'MOD-06'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) >= 2),
  document TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_organization_document_key
  ON public.suppliers (organization_id, document)
  WHERE document IS NOT NULL;

CREATE INDEX IF NOT EXISTS suppliers_organization_name_idx
  ON public.suppliers (organization_id, name);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros com acesso podem visualizar fornecedores"
  ON public.suppliers;
CREATE POLICY "Membros com acesso podem visualizar fornecedores"
  ON public.suppliers FOR SELECT
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = suppliers.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code = 'MOD-06'
      )
    )
  );

DROP POLICY IF EXISTS "Membros com acesso podem gerenciar fornecedores"
  ON public.suppliers;
CREATE POLICY "Membros com acesso podem gerenciar fornecedores"
  ON public.suppliers FOR ALL
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = suppliers.organization_id
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
        WHERE permission.organization_id = suppliers.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code = 'MOD-06'
      )
    )
  );

CREATE OR REPLACE FUNCTION public.set_supplier_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_supplier_updated_at ON public.suppliers;
CREATE TRIGGER set_supplier_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_supplier_updated_at();
