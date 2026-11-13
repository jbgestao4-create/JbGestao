-- 00114_software_rental_contracts.sql
-- Tabela para gestão e emissão de contratos de locação / licença de software para clientes da JB Software

CREATE TABLE IF NOT EXISTS public.software_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  contract_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_trade_name TEXT,
  client_document TEXT NOT NULL,
  client_responsible_name TEXT NOT NULL,
  client_responsible_document TEXT,
  client_responsible_role TEXT,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  plan_name TEXT NOT NULL DEFAULT 'Plano Padrão JB Gestão',
  monthly_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  setup_fee NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  billing_day INTEGER NOT NULL DEFAULT 10,
  payment_method TEXT NOT NULL DEFAULT 'PIX / Boleto',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_months INTEGER NOT NULL DEFAULT 12,
  status TEXT NOT NULL DEFAULT 'active',
  licensor_name TEXT NOT NULL DEFAULT 'JB SOFTWARE & TECNOLOGIA LTDA',
  licensor_trade_name TEXT DEFAULT 'JB Software Gestão Inteligente',
  licensor_document TEXT NOT NULL DEFAULT '00.000.000/0001-00',
  licensor_responsible TEXT NOT NULL DEFAULT 'Bryan Mendes - Administrador Geral',
  licensor_email TEXT DEFAULT 'contato@jbsoftware.com.br',
  licensor_phone TEXT DEFAULT '(00) 00000-0000',
  licensor_address TEXT DEFAULT 'Brasil',
  included_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_terms TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_software_contracts_company_id ON public.software_contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_software_contracts_client_name ON public.software_contracts(client_name);
CREATE INDEX IF NOT EXISTS idx_software_contracts_status ON public.software_contracts(status);
CREATE INDEX IF NOT EXISTS idx_software_contracts_created_at ON public.software_contracts(created_at DESC);

-- Habilita RLS
ALTER TABLE public.software_contracts ENABLE ROW LEVEL SECURITY;

-- Política de RLS: apenas Superadmins / Proprietários da plataforma podem visualizar e manipular contratos
CREATE POLICY "Superadmins can manage software contracts"
ON public.software_contracts
FOR ALL
TO authenticated
USING (
  public.is_system_owner(auth.uid())
)
WITH CHECK (
  public.is_system_owner(auth.uid())
);

GRANT ALL ON TABLE public.software_contracts TO authenticated;
