ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS access_plan_id uuid
  REFERENCES public.access_plans(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.admin_assign_access_plan_to_company(
  p_org_id uuid,
  p_plan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  selected_plan public.access_plans;
BEGIN
  IF public.is_access_plan_manager() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Apenas o proprietário do sistema pode definir planos para empresas.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO selected_plan
  FROM public.access_plans
  WHERE id = p_plan_id
  FOR SHARE;

  IF NOT FOUND OR NOT selected_plan.is_active OR selected_plan.is_locked THEN
    RAISE EXCEPTION 'O plano selecionado não está disponível para empresas.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.organizations
  SET access_plan_id = selected_plan.id,
      updated_at = now()
  WHERE id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A empresa não foi encontrada.'
      USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.organization_dashboard_modules
  WHERE organization_id = p_org_id;

  INSERT INTO public.organization_dashboard_modules (organization_id, module_code)
  SELECT p_org_id, module_code
  FROM unnest(selected_plan.module_codes) AS module_code
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'organization_id', p_org_id,
    'access_plan_id', selected_plan.id,
    'plan_name', selected_plan.name,
    'plan_description', selected_plan.description,
    'module_codes', selected_plan.module_codes
  );
END;
$$;

DROP FUNCTION IF EXISTS public.admin_get_all_organizations();
CREATE FUNCTION public.admin_get_all_organizations()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  is_active boolean,
  trial_ends_at timestamptz,
  created_at timestamptz,
  admin_email text,
  admin_name text,
  cnpj text,
  address text,
  responsible text,
  notes text,
  members_count bigint,
  modules text[],
  access_plan_id uuid,
  access_plan_name text,
  access_plan_description text
)
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.is_access_plan_manager() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Apenas o proprietário do sistema pode consultar empresas cadastradas.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    o.is_active,
    o.trial_ends_at,
    o.created_at,
    COALESCE(o.admin_email, '')::text,
    COALESCE(o.admin_name, 'Administrador')::text,
    COALESCE(o.cnpj, '')::text,
    COALESCE(o.address, '')::text,
    COALESCE(o.responsible, '')::text,
    COALESCE(o.notes, '')::text,
    COUNT(DISTINCT om.user_id),
    COALESCE(array_agg(DISTINCT odm.module_code) FILTER (WHERE odm.module_code IS NOT NULL), '{}'),
    o.access_plan_id,
    ap.name,
    ap.description
  FROM public.organizations o
  LEFT JOIN public.organization_members om ON om.organization_id = o.id
  LEFT JOIN public.organization_dashboard_modules odm ON odm.organization_id = o.id
  LEFT JOIN public.access_plans ap ON ap.id = o.access_plan_id
  GROUP BY
    o.id, o.name, o.slug, o.is_active, o.trial_ends_at, o.created_at,
    o.admin_email, o.admin_name, o.cnpj, o.address, o.responsible, o.notes,
    o.access_plan_id, ap.name, ap.description
  ORDER BY o.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_access_plan_to_company(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_access_plan_to_company(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_get_all_organizations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_all_organizations() TO authenticated;
