-- Migration 00052: Gestão de Contas a Pagar / Boletos (Água, Luz, Internet, Fornecedores, Outros)
-- e aprimoramentos de conferência de fechamento de caixa (MOD-05)

-- 1. Colunas adicionais de conferência detalhada nas sessões de caixa
ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS counted_pix NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS counted_credit_card NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS counted_debit_card NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS total_bill_payments NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_bill_payments >= 0);

-- 2. Tabela de Boletos e Contas a Pagar do Módulo de Caixa
CREATE TABLE IF NOT EXISTS public.cash_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  description TEXT NOT NULL CHECK (char_length(btrim(description)) BETWEEN 2 AND 240),
  beneficiary_name TEXT,
  supplier_id UUID,
  category TEXT NOT NULL DEFAULT 'Outros'
    CHECK (category IN ('Água', 'Luz', 'Internet', 'Fornecedor', 'Aluguel', 'Impostos', 'Outros')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  barcode TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'cancelled', 'archived')),
  paid_at TIMESTAMPTZ,
  paid_amount NUMERIC(12, 2),
  payment_method TEXT,
  cash_session_id UUID,
  cash_entry_id UUID,
  attachment_name TEXT,
  attachment_path TEXT,
  attachment_data_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT cash_bills_org_id_key UNIQUE (organization_id, id),
  CONSTRAINT cash_bills_supplier_org_fk
    FOREIGN KEY (organization_id, supplier_id)
    REFERENCES public.suppliers(organization_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS cash_bills_org_status_due_date_idx
  ON public.cash_bills (organization_id, status, due_date ASC);

CREATE INDEX IF NOT EXISTS cash_bills_org_created_at_idx
  ON public.cash_bills (organization_id, created_at DESC);

ALTER TABLE public.cash_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários com acesso ao caixa consultam boletos" ON public.cash_bills;
CREATE POLICY "Usuários com acesso ao caixa consultam boletos"
  ON public.cash_bills FOR SELECT
  USING (public.can_access_cash(organization_id));

DROP POLICY IF EXISTS "Usuários com acesso ao caixa gerenciam boletos" ON public.cash_bills;
CREATE POLICY "Usuários com acesso ao caixa gerenciam boletos"
  ON public.cash_bills FOR ALL
  USING (public.can_access_cash(organization_id))
  WITH CHECK (public.can_access_cash(organization_id));

