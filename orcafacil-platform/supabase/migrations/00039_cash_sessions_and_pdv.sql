-- Migration 00039: Sessões de Caixa e Ponto de Venda (PDV)
-- Cria tabelas para gerenciamento de turnos/sessões de caixa e movimentações (sangria/suprimento)

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  register_id TEXT NOT NULL DEFAULT 'Caixa 01' CHECK (char_length(btrim(register_id)) BETWEEN 1 AND 80),
  opened_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  operator_name TEXT NOT NULL CHECK (char_length(btrim(operator_name)) >= 2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,

  -- Acumuladores financeiros do turno/sessão
  total_sales NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_sales >= 0),
  total_money NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_money >= 0),
  total_pix NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_pix >= 0),
  total_credit_card NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_credit_card >= 0),
  total_debit_card NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_debit_card >= 0),
  total_additional_entries NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_additional_entries >= 0),
  total_withdrawals NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_withdrawals >= 0),
  total_cancellations NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_cancellations >= 0),

  -- Conferência física do dinheiro no fechamento
  expected_money NUMERIC(12, 2) NOT NULL DEFAULT 0,
  counted_money NUMERIC(12, 2),
  difference NUMERIC(12, 2),
  conference_attempts INTEGER NOT NULL DEFAULT 0 CHECK (conference_attempts >= 0),
  discrepancy_justification TEXT,
  supervisor_authorized_by TEXT,

  sales_count INTEGER NOT NULL DEFAULT 0 CHECK (sales_count >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT cash_sessions_org_id_key UNIQUE (organization_id, id)
);

-- Impede que existam duas sessões ABERTAS simultaneamente no mesmo caixa da mesma organização
CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_one_open_per_register
  ON public.cash_sessions (organization_id, register_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS cash_sessions_org_status
  ON public.cash_sessions (organization_id, status);

CREATE INDEX IF NOT EXISTS cash_sessions_org_opened_at
  ON public.cash_sessions (organization_id, opened_at DESC);

-- Tabela para Sangrias (retiradas) e Suprimentos (entradas de troco) durante o expediente
CREATE TABLE IF NOT EXISTS public.cash_session_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('supply', 'bleed')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) >= 3),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cash_session_movements_session_org_fk
    FOREIGN KEY (organization_id, session_id)
    REFERENCES public.cash_sessions(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS cash_session_movements_session_idx
  ON public.cash_session_movements (organization_id, session_id);

-- Habilita RLS
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_session_movements ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Membros autorizados consultam sessões de caixa" ON public.cash_sessions;
CREATE POLICY "Membros autorizados consultam sessões de caixa"
  ON public.cash_sessions FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Membros autorizados gerenciam sessões de caixa" ON public.cash_sessions;
CREATE POLICY "Membros autorizados gerenciam sessões de caixa"
  ON public.cash_sessions FOR ALL
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Membros autorizados consultam movimentações da sessão de caixa" ON public.cash_session_movements;
CREATE POLICY "Membros autorizados consultam movimentações da sessão de caixa"
  ON public.cash_session_movements FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Membros autorizados gerenciam movimentações da sessão de caixa" ON public.cash_session_movements;
CREATE POLICY "Membros autorizados gerenciam movimentações da sessão de caixa"
  ON public.cash_session_movements FOR ALL
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

