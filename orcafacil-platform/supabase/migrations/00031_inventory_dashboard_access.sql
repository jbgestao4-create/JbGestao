INSERT INTO public.organization_member_dashboard_modules (
  organization_id,
  user_id,
  module_code
)
SELECT organization_id, user_id, 'MOD-02'::public.dashboard_module_code
FROM public.organization_member_dashboard_modules
WHERE module_code = 'MOD-06'
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Membros com acesso podem visualizar materiais"
  ON public.inventory_items;
CREATE POLICY "Membros com acesso podem visualizar materiais"
  ON public.inventory_items FOR SELECT
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = inventory_items.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code IN ('MOD-02', 'MOD-04', 'MOD-06')
      )
    )
  );

DROP POLICY IF EXISTS "Membros com acesso podem gerenciar materiais"
  ON public.inventory_items;
CREATE POLICY "Membros com acesso podem gerenciar materiais"
  ON public.inventory_items FOR ALL
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = inventory_items.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code IN ('MOD-02', 'MOD-06')
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
        WHERE permission.organization_id = inventory_items.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code IN ('MOD-02', 'MOD-06')
      )
    )
  );

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
          AND permission.module_code IN ('MOD-02', 'MOD-06')
      )
    )
  );
