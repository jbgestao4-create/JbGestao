-- 00115_software_contract_invoices.sql
-- Tabela para gestão financeira de faturas, cobranças e pagamentos de contratos de licença de software

CREATE TABLE IF NOT EXISTS public.software_contract_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.software_contracts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_document TEXT,
  reference_month TEXT NOT NULL, -- Ex: "11/2026", "Novembro/2026"
  amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  due_date DATE NOT NULL,
  payment_date DATE,
  payment_method TEXT DEFAULT 'PIX',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'overdue', 'cancelled'
  pix_key TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para otimização de consultas financeiras e relatórios
CREATE INDEX IF NOT EXISTS idx_contract_invoices_contract_id ON public.software_contract_invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_invoices_company_id ON public.software_contract_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_contract_invoices_status ON public.software_contract_invoices(status);
CREATE INDEX IF NOT EXISTS idx_contract_invoices_due_date ON public.software_contract_invoices(due_date);

-- Habilitar RLS
ALTER TABLE public.software_contract_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage software contract invoices"
ON public.software_contract_invoices
FOR ALL
TO authenticated
USING (
  public.is_system_owner(auth.uid())
)
WITH CHECK (
  public.is_system_owner(auth.uid())
);

GRANT ALL ON TABLE public.software_contract_invoices TO authenticated;
