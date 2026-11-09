-- Migration 00092: Criar tabela de agendamentos e compromissos da Agenda
-- Suporta integração com Orçamentos, Ordens de Serviço, Vendas e Atendimentos Avulsos

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'dashboard_module_code' AND e.enumlabel = 'MOD-12'
  ) THEN
    ALTER TYPE public.dashboard_module_code ADD VALUE IF NOT EXISTS 'MOD-12';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) >= 1),
  description TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  appointment_date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (
    status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled')
  ),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (
    priority IN ('low', 'normal', 'high', 'urgent')
  ),
  type TEXT NOT NULL DEFAULT 'general' CHECK (
    type IN ('general', 'quote', 'service_order', 'sale', 'technical_visit', 'delivery')
  ),
  reference_id UUID,
  reference_type TEXT,
  assigned_to TEXT,
  location TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_org_date
  ON public.appointments (organization_id, appointment_date ASC, start_time ASC);

CREATE INDEX IF NOT EXISTS idx_appointments_org_status
  ON public.appointments (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_appointments_reference
  ON public.appointments (organization_id, reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_appointments_customer
  ON public.appointments (organization_id, customer_id);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros visualizam agendamentos da organizacao" ON public.appointments;
CREATE POLICY "Membros visualizam agendamentos da organizacao"
  ON public.appointments FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Membros gerenciam agendamentos da organizacao" ON public.appointments;
CREATE POLICY "Membros gerenciam agendamentos da organizacao"
  ON public.appointments FOR ALL
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
