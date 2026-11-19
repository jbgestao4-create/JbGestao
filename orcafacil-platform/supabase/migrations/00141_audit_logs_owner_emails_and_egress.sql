-- Migração 00141: Permite que todos os e-mails de proprietário/superadmin consultem e insiram audit_logs de qualquer organização

DROP POLICY IF EXISTS "audit_logs_select_admin_or_owner" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin_or_owner"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = audit_logs.empresa_id
        AND om.user_id = auth.uid()
        AND om.role::text IN ('admin', 'proprietario', 'owner')
    )
    OR EXISTS (
      SELECT 1
      FROM public.system_settings
      WHERE key = 'system_owner_user_id'
        AND (value->>'user_id')::uuid = auth.uid()
    )
    OR LOWER(COALESCE(auth.jwt()->>'email', auth.email(), '')) IN (
      'adm@adm.com',
      'admin@adm.com',
      'controlesoft@outlook.com',
      'proprietario@jbsoftware.com.br',
      'owner@jbsoftware.com.br',
      'bryan@administrador.com',
      'bryanmendes968@gmail.com'
    )
  );

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
      OR LOWER(COALESCE(auth.jwt()->>'email', auth.email(), '')) IN (
        'adm@adm.com',
        'admin@adm.com',
        'controlesoft@outlook.com',
        'proprietario@jbsoftware.com.br',
        'owner@jbsoftware.com.br',
        'bryan@administrador.com',
        'bryanmendes968@gmail.com'
      )
    )
  );
