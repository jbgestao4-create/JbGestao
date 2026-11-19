-- Migração 00140: Garante que qualquer usuário autenticado da empresa (ou proprietário da plataforma) possa inserir audit_logs

DROP POLICY IF EXISTS "audit_logs_insert_same_empresa" ON public.audit_logs;

CREATE POLICY "audit_logs_insert_same_empresa"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      usuario_id IS NULL
      OR usuario_id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = audit_logs.empresa_id
          AND om.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.system_settings
        WHERE key = 'system_owner_user_id'
          AND (value->>'user_id')::uuid = auth.uid()
      )
      OR auth.email() = 'controlesoft@outlook.com'
    )
  );
