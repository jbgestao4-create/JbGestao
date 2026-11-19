-- Migração 00139: Tabela imutável de Logs de Auditoria (Audit Logs) multi-tenant (LGPD)

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nome TEXT NOT NULL,
  modulo TEXT NOT NULL,
  acao TEXT NOT NULL,
  descricao TEXT NOT NULL,
  entidade TEXT,
  entidade_id TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices compostos para consultas rápidas e baixo consumo de recursos
CREATE INDEX IF NOT EXISTS idx_audit_logs_empresa_created_at
  ON public.audit_logs (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_empresa_usuario
  ON public.audit_logs (empresa_id, usuario_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs (created_at DESC);

-- Habilita Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- INSERT: permitido apenas para usuários autenticados pertencentes à mesma empresa_id
CREATE POLICY "audit_logs_insert_same_empresa"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      usuario_id IS NULL
      OR usuario_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = audit_logs.empresa_id
        AND om.user_id = auth.uid()
    )
  );

-- SELECT: permitido para usuários com role 'admin' ou 'proprietario'/'owner' da mesma empresa_id,
-- ou para o proprietário da plataforma (Superadmin / Configurações de Desenvolvedor)
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
    OR auth.email() = 'controlesoft@outlook.com'
  );

-- UPDATE e DELETE estritamente bloqueados (logs imutáveis)
CREATE POLICY "audit_logs_no_update"
  ON public.audit_logs
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "audit_logs_no_delete"
  ON public.audit_logs
  FOR DELETE
  TO authenticated, anon
  USING (false);

REVOKE UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
