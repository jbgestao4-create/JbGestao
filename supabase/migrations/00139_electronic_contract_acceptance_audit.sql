-- 00139_electronic_contract_acceptance_audit.sql
-- Implementação de Aceite Eletrônico de Contratos com Registro Completo de Evidências,
-- Trilha de Auditoria Criptográfica Imutável (SHA-256) e Não-Repúdio (MP 2.200-2/2001 e Lei 14.063/2020)

CREATE TABLE IF NOT EXISTS public.contract_acceptance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT UNIQUE NOT NULL,
  contract_id TEXT,
  contract_number TEXT NOT NULL,
  contract_name TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  document_sha256 TEXT NOT NULL,
  document_content TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_document TEXT,
  user_phone TEXT,
  user_birth_date TEXT,
  user_address TEXT,
  company_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  company_name TEXT,
  company_document TEXT,
  plan_id TEXT,
  plan_name TEXT,
  auth_method TEXT NOT NULL DEFAULT 'password',
  ip_address TEXT NOT NULL,
  ip_type TEXT DEFAULT 'IPv4',
  geo_country TEXT,
  geo_region TEXT,
  geo_city TEXT,
  user_agent TEXT NOT NULL,
  browser_name TEXT,
  browser_version TEXT,
  os_name TEXT,
  os_version TEXT,
  device_type TEXT DEFAULT 'computador',
  device_language TEXT DEFAULT 'pt-BR',
  device_timezone TEXT DEFAULT 'America/Sao_Paulo',
  session_id TEXT NOT NULL,
  page_url TEXT NOT NULL,
  referrer_url TEXT,
  declaration_text TEXT NOT NULL,
  checkbox_checked_at TIMESTAMPTZ,
  button_clicked_at TIMESTAMPTZ,
  accepted_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at_local TEXT NOT NULL,
  evidence_sha256 TEXT NOT NULL,
  audit_chain_head_hash TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'verified',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Eventos Encadeados da Trilha de Auditoria (Append-Only)
CREATE TABLE IF NOT EXISTS public.contract_acceptance_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acceptance_id UUID NOT NULL REFERENCES public.contract_acceptance_records(id) ON DELETE CASCADE,
  event_sequence INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_event_hash TEXT NOT NULL,
  event_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de consulta e perícia técnica
CREATE INDEX IF NOT EXISTS idx_contract_acceptance_receipt ON public.contract_acceptance_records(receipt_number);
CREATE INDEX IF NOT EXISTS idx_contract_acceptance_user_email ON public.contract_acceptance_records(user_email);
CREATE INDEX IF NOT EXISTS idx_contract_acceptance_user_doc ON public.contract_acceptance_records(user_document);
CREATE INDEX IF NOT EXISTS idx_contract_acceptance_company ON public.contract_acceptance_records(company_id);
CREATE INDEX IF NOT EXISTS idx_contract_acceptance_contract_num ON public.contract_acceptance_records(contract_number);
CREATE INDEX IF NOT EXISTS idx_contract_acceptance_doc_sha256 ON public.contract_acceptance_records(document_sha256);
CREATE INDEX IF NOT EXISTS idx_contract_acceptance_created ON public.contract_acceptance_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_acceptance_events_acc_id ON public.contract_acceptance_audit_events(acceptance_id, event_sequence);

-- Habilitar RLS
ALTER TABLE public.contract_acceptance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_acceptance_audit_events ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para contract_acceptance_records
DROP POLICY IF EXISTS "Superadmins podem ver todos os aceites de contratos" ON public.contract_acceptance_records;
CREATE POLICY "Superadmins podem ver todos os aceites de contratos"
  ON public.contract_acceptance_records FOR SELECT
  TO authenticated
  USING (
    public.is_system_owner(auth.uid())
    OR user_id = auth.uid()
    OR company_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Usuarios autenticados podem registrar seus aceites de contratos" ON public.contract_acceptance_records;
CREATE POLICY "Usuarios autenticados podem registrar seus aceites de contratos"
  ON public.contract_acceptance_records FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR public.is_system_owner(auth.uid()) OR auth.uid() IS NOT NULL
  );

-- Bloqueio estrito de UPDATE e DELETE para garantir integridade imutável (Append-Only)
DROP POLICY IF EXISTS "Proibido deletar registros de aceite de contratos" ON public.contract_acceptance_records;
CREATE POLICY "Proibido deletar registros de aceite de contratos"
  ON public.contract_acceptance_records FOR DELETE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "Proibido alterar registros de aceite de contratos" ON public.contract_acceptance_records;
CREATE POLICY "Proibido alterar registros de aceite de contratos"
  ON public.contract_acceptance_records FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Políticas para contract_acceptance_audit_events
DROP POLICY IF EXISTS "Superadmins e titulares leem eventos de auditoria" ON public.contract_acceptance_audit_events;
CREATE POLICY "Superadmins e titulares leem eventos de auditoria"
  ON public.contract_acceptance_audit_events FOR SELECT
  TO authenticated
  USING (
    public.is_system_owner(auth.uid())
    OR acceptance_id IN (
      SELECT id FROM public.contract_acceptance_records WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Inserir eventos de auditoria de aceite" ON public.contract_acceptance_audit_events;
CREATE POLICY "Inserir eventos de auditoria de aceite"
  ON public.contract_acceptance_audit_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Proibido alterar eventos de auditoria" ON public.contract_acceptance_audit_events;
CREATE POLICY "Proibido alterar eventos de auditoria"
  ON public.contract_acceptance_audit_events FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "Proibido excluir eventos de auditoria" ON public.contract_acceptance_audit_events;
CREATE POLICY "Proibido excluir eventos de auditoria"
  ON public.contract_acceptance_audit_events FOR DELETE
  TO authenticated
  USING (false);

GRANT ALL ON TABLE public.contract_acceptance_records TO authenticated;
GRANT ALL ON TABLE public.contract_acceptance_audit_events TO authenticated;
