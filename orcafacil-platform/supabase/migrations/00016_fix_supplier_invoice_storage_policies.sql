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
      WHERE supplier.organization_id::TEXT = (storage.foldername(storage.objects.name))[1]
        AND supplier.id::TEXT = (storage.foldername(storage.objects.name))[2]
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
      WHERE supplier.organization_id::TEXT = (storage.foldername(storage.objects.name))[1]
        AND supplier.id::TEXT = (storage.foldername(storage.objects.name))[2]
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
      WHERE supplier.organization_id::TEXT = (storage.foldername(storage.objects.name))[1]
        AND supplier.id::TEXT = (storage.foldername(storage.objects.name))[2]
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
