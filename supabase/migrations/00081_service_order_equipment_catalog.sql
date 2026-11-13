CREATE TABLE IF NOT EXISTS public.service_order_equipment_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  normalized_name TEXT GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_order_equipment_catalog_org_name_key
    UNIQUE (organization_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS service_order_equipment_catalog_org_name_idx
  ON public.service_order_equipment_catalog (organization_id, normalized_name);

ALTER TABLE public.service_order_equipment_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da organização consultam catálogo de equipamentos"
  ON public.service_order_equipment_catalog FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Membros da organização gerenciam catálogo de equipamentos"
  ON public.service_order_equipment_catalog FOR ALL
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
