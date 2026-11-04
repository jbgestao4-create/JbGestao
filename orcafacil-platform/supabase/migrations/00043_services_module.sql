-- 00043_services_module.sql
-- Módulo completo de Cadastro de Serviços (MOD-09), Categorias, Materiais vinculados e Histórico de Preços

-- 1. Adiciona MOD-09 ao enum dashboard_module_code
ALTER TYPE public.dashboard_module_code ADD VALUE IF NOT EXISTS 'MOD-09';

-- 2. Tabela de Categorias de Serviços
CREATE TABLE IF NOT EXISTS public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) >= 2),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_service_categories_org_name UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_service_categories_org ON public.service_categories(organization_id);

-- 3. Tabela de Serviços
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_code TEXT NOT NULL CHECK (char_length(btrim(service_code)) >= 1),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) >= 2),
  description TEXT,
  category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
  billing_unit TEXT NOT NULL DEFAULT 'unidade',
  estimated_time TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  internal_notes TEXT,

  -- Precificação
  operational_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000 CHECK (operational_cost >= 0),
  labor_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000 CHECK (labor_cost >= 0),
  materials_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000 CHECK (materials_cost >= 0),
  total_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000 CHECK (total_cost >= 0),
  sale_price NUMERIC(12, 4) NOT NULL DEFAULT 0.0000 CHECK (sale_price >= 0),
  profit_margin NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
  minimum_sale_price NUMERIC(12, 4) NOT NULL DEFAULT 0.0000 CHECK (minimum_sale_price >= 0),
  allow_discount BOOLEAN NOT NULL DEFAULT TRUE,
  commission_rate NUMERIC(8, 2) NOT NULL DEFAULT 0.00 CHECK (commission_rate >= 0),

  -- Informações Fiscais (NFS-e e Reforma Tributária 2026)
  lc116_item TEXT,
  nfs_national_code TEXT,
  nfs_municipal_code TEXT,
  cnae_code TEXT,
  nbs_code TEXT,
  fiscal_description TEXT,
  iss_rate NUMERIC(8, 4) NOT NULL DEFAULT 0.0000 CHECK (iss_rate >= 0),
  iss_tax_type TEXT NOT NULL DEFAULT 'tributavel',
  iss_withheld BOOLEAN NOT NULL DEFAULT FALSE,
  deductions_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  iss_requirement TEXT DEFAULT 'exigivel',
  cst_ibs_cbs TEXT,
  c_class_trib TEXT,
  ibs_rate NUMERIC(8, 4) NOT NULL DEFAULT 0.0000 CHECK (ibs_rate >= 0),
  cbs_rate NUMERIC(8, 4) NOT NULL DEFAULT 0.0000 CHECK (cbs_rate >= 0),
  tax_rules_notes TEXT,

  -- Auditoria
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_services_org_id UNIQUE (organization_id, id),
  CONSTRAINT uq_services_org_code UNIQUE (organization_id, service_code)
);

CREATE INDEX IF NOT EXISTS idx_services_org ON public.services(organization_id);
CREATE INDEX IF NOT EXISTS idx_services_org_name ON public.services(organization_id, name);
CREATE INDEX IF NOT EXISTS idx_services_org_code ON public.services(organization_id, service_code);
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(organization_id, category_id);

-- 4. Tabela de Materiais Utilizados no Serviço
CREATE TABLE IF NOT EXISTS public.service_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  service_id UUID NOT NULL,
  inventory_item_id UUID NOT NULL,
  quantity NUMERIC(12, 4) NOT NULL DEFAULT 1.0000 CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'UN',
  unit_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000 CHECK (unit_cost >= 0),
  total_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000 CHECK (total_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_service_materials_service FOREIGN KEY (organization_id, service_id)
    REFERENCES public.services(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_service_materials_inventory FOREIGN KEY (organization_id, inventory_item_id)
    REFERENCES public.inventory_items(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT uq_service_materials_service_item UNIQUE (service_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_service_materials_service ON public.service_materials(service_id);
CREATE INDEX IF NOT EXISTS idx_service_materials_inventory ON public.service_materials(inventory_item_id);

-- 5. Tabela de Histórico de Preços do Serviço
CREATE TABLE IF NOT EXISTS public.service_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_id UUID NOT NULL,
  old_price NUMERIC(12, 4) NOT NULL,
  new_price NUMERIC(12, 4) NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_service_price_history_service FOREIGN KEY (organization_id, service_id)
    REFERENCES public.services(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_service_price_history_service ON public.service_price_history(service_id);

-- 6. Trigger para registrar alteração de preço automaticamente
CREATE OR REPLACE FUNCTION public.track_service_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.sale_price IS DISTINCT FROM NEW.sale_price THEN
    INSERT INTO public.service_price_history (
      organization_id,
      service_id,
      old_price,
      new_price,
      changed_by,
      changed_by_name
    )
    VALUES (
      NEW.organization_id,
      NEW.id,
      OLD.sale_price,
      NEW.sale_price,
      auth.uid(),
      NEW.creator_name
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_service_price_change ON public.services;
CREATE TRIGGER trg_track_service_price_change
  AFTER UPDATE OF sale_price ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.track_service_price_change();

-- 7. Adiciona colunas para identificar Serviços em quote_items
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'product' CHECK (item_type IN ('product', 'service')),
  ADD COLUMN IF NOT EXISTS service_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_quote_items_service_id'
      AND conrelid = 'public.quote_items'::regclass
  ) THEN
    ALTER TABLE public.quote_items
      ADD CONSTRAINT fk_quote_items_service_id
      FOREIGN KEY (service_id)
      REFERENCES public.services(id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

-- 8. Row Level Security (RLS)
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_price_history ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para Categorias
DROP POLICY IF EXISTS "Membros podem ver categorias de serviços" ON public.service_categories;
CREATE POLICY "Membros podem ver categorias de serviços"
  ON public.service_categories FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Membros com acesso podem gerenciar categorias de serviços" ON public.service_categories;
CREATE POLICY "Membros com acesso podem gerenciar categorias de serviços"
  ON public.service_categories FOR ALL
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = service_categories.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code IN ('MOD-09', 'MOD-04', 'MOD-01')
      )
    )
  );

-- Políticas de RLS para Serviços
DROP POLICY IF EXISTS "Membros podem ver serviços da organização" ON public.services;
CREATE POLICY "Membros podem ver serviços da organização"
  ON public.services FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Membros com acesso podem gerenciar serviços" ON public.services;
CREATE POLICY "Membros com acesso podem gerenciar serviços"
  ON public.services FOR ALL
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = services.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code = 'MOD-09'
      )
    )
  );

-- Políticas de RLS para Materiais de Serviços
DROP POLICY IF EXISTS "Membros podem ver materiais dos serviços" ON public.service_materials;
CREATE POLICY "Membros podem ver materiais dos serviços"
  ON public.service_materials FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Membros com acesso podem gerenciar materiais dos serviços" ON public.service_materials;
CREATE POLICY "Membros com acesso podem gerenciar materiais dos serviços"
  ON public.service_materials FOR ALL
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = service_materials.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code = 'MOD-09'
      )
    )
  );

-- Políticas de RLS para Histórico de Preços
DROP POLICY IF EXISTS "Membros podem ver histórico de preços dos serviços" ON public.service_price_history;
CREATE POLICY "Membros podem ver histórico de preços dos serviços"
  ON public.service_price_history FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

