-- 00116_add_contract_signature_and_trial.sql
-- Adiciona suporte para controle de assinatura do contrato e período de testes gratuito

ALTER TABLE public.software_contracts
  ADD COLUMN IF NOT EXISTS is_signed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS has_trial_period BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_duration_months INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_software_contracts_is_signed ON public.software_contracts(is_signed);
