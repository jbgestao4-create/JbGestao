-- Depósitos cadastrados por organização, para reutilização no cadastro de materiais.
CREATE TABLE IF NOT EXISTS public.inventory_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_warehouses_org_name_key
  ON public.inventory_warehouses (organization_id, lower(btrim(name)));

-- Importa os depósitos já digitados nos materiais existentes.
INSERT INTO public.inventory_warehouses (organization_id, name)
SELECT DISTINCT ON (organization_id, lower(btrim(warehouse))) organization_id, btrim(warehouse)
FROM public.inventory_items
WHERE warehouse IS NOT NULL AND btrim(warehouse) <> ''
ON CONFLICT DO NOTHING;

ALTER TABLE public.inventory_warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros com acesso podem visualizar depositos"
  ON public.inventory_warehouses;
CREATE POLICY "Membros com acesso podem visualizar depositos"
  ON public.inventory_warehouses FOR SELECT
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = inventory_warehouses.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code IN ('MOD-04', 'MOD-06')
      )
    )
  );

DROP POLICY IF EXISTS "Membros com acesso podem gerenciar depositos"
  ON public.inventory_warehouses;
CREATE POLICY "Membros com acesso podem gerenciar depositos"
  ON public.inventory_warehouses FOR ALL
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = inventory_warehouses.organization_id
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
        WHERE permission.organization_id = inventory_warehouses.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code = 'MOD-06'
      )
    )
  );

DROP TRIGGER IF EXISTS trg_inventory_warehouses_updated_at ON public.inventory_warehouses;
CREATE TRIGGER trg_inventory_warehouses_updated_at
  BEFORE UPDATE ON public.inventory_warehouses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

