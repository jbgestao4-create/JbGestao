-- Migration 00049: Cadastro de Caixas PDV (Terminais de Frente de Caixa)
-- Permite que a organização cadastre e gerencie múltiplos caixas PDV (ex: Caixa 01, Caixa 02, Balcão)

CREATE TABLE IF NOT EXISTS public.cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cash_registers_org_name_key UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS cash_registers_org_idx
  ON public.cash_registers (organization_id, is_active, name);

ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros autorizados consultam caixas PDV" ON public.cash_registers;
CREATE POLICY "Membros autorizados consultam caixas PDV"
  ON public.cash_registers FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Membros autorizados gerenciam caixas PDV" ON public.cash_registers;
CREATE POLICY "Membros autorizados gerenciam caixas PDV"
  ON public.cash_registers FOR ALL
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

