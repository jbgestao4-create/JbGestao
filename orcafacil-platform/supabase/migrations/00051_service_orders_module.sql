-- 00051_service_orders_module.sql
-- Módulo de Ordem de Serviço (O.S.) - MOD-10
-- Contempla equipamento, avarias, fotos, problema, diagnóstico, solução, produtos/peças, serviços e envio para fechamento de venda

ALTER TYPE public.dashboard_module_code ADD VALUE IF NOT EXISTS 'MOD-10';

CREATE TABLE IF NOT EXISTS public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL CHECK (char_length(btrim(order_number)) >= 1),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'in_maintenance', 'waiting_parts', 'ready', 'closed')
  ),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (
    priority IN ('low', 'normal', 'high', 'urgent')
  ),

  -- Dados do Cliente
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL CHECK (char_length(btrim(customer_name)) >= 1),
  customer_phone TEXT,
  customer_document TEXT,

  -- Dados do Equipamento / Aparelho e Avarias
  equipment_name TEXT NOT NULL CHECK (char_length(btrim(equipment_name)) >= 1),
  equipment_brand TEXT,
  equipment_model TEXT,
  serial_number TEXT,
  equipment_color TEXT,
  accessories TEXT,
  device_password TEXT,
  damage_notes TEXT,
  damage_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Problema, Diagnóstico e Solução
  reported_problem TEXT NOT NULL CHECK (char_length(btrim(reported_problem)) >= 1),
  technical_diagnosis TEXT,
  solution_applied TEXT,
  technician_name TEXT,
  estimated_delivery_date DATE,
  warranty_days INTEGER NOT NULL DEFAULT 90 CHECK (warranty_days >= 0),
  warranty_terms TEXT,
  internal_notes TEXT,

  -- Valores Financeiros
  products_subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (products_subtotal >= 0),
  services_subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (services_subtotal >= 0),
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),

  -- Vínculo com Fechamento de Venda
  sale_id UUID,
  sale_number TEXT,

  -- Auditoria
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_name TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_service_orders_org_number UNIQUE (organization_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_service_orders_org_status
  ON public.service_orders (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_orders_org_customer
  ON public.service_orders (organization_id, customer_id);

CREATE TABLE IF NOT EXISTS public.service_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'service' CHECK (item_type IN ('product', 'service')),
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  description TEXT NOT NULL CHECK (char_length(btrim(description)) >= 1),
  unit TEXT NOT NULL DEFAULT 'UN',
  quantity NUMERIC(12, 4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_order_items_order
  ON public.service_order_items (organization_id, service_order_id);

ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros consultam ordens de servico" ON public.service_orders;
CREATE POLICY "Membros consultam ordens de servico"
  ON public.service_orders FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Membros gerenciam ordens de servico" ON public.service_orders;
CREATE POLICY "Membros gerenciam ordens de servico"
  ON public.service_orders FOR ALL
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Membros consultam itens de ordens de servico" ON public.service_order_items;
CREATE POLICY "Membros consultam itens de ordens de servico"
  ON public.service_order_items FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Membros gerenciam itens de ordens de servico" ON public.service_order_items;
CREATE POLICY "Membros gerenciam itens de ordens de servico"
  ON public.service_order_items FOR ALL
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

