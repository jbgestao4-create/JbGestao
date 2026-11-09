-- Migration 00096: Registro de último acesso por organização e exibição na gestão de empresas

-- 1. Coluna de último acesso na tabela organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ;

COMMENT ON COLUMN public.organizations.last_access_at IS 'Data e hora em que qualquer membro da organização acessou ou utilizou o sistema pela última vez';

-- 2. Atualizar RPC record_user_screen_time para registrar o último acesso da organização quando informado
DROP FUNCTION IF EXISTS public.record_user_screen_time(INT, UUID);
DROP FUNCTION IF EXISTS public.record_user_screen_time(INT);
DROP FUNCTION IF EXISTS public.record_user_screen_time();

CREATE OR REPLACE FUNCTION public.record_user_screen_time(
  p_seconds INT DEFAULT 0,
  p_user_id UUID DEFAULT NULL,
  p_org_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := COALESCE(p_user_id, auth.uid());
  v_secs BIGINT := GREATEST(0, COALESCE(p_seconds, 0));
BEGIN
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.profiles (id, display_name, screen_time_seconds, last_access_at)
    VALUES (v_uid, 'Usuário', v_secs, NOW())
    ON CONFLICT (id) DO UPDATE
    SET
      screen_time_seconds = COALESCE(public.profiles.screen_time_seconds, 0) + v_secs,
      last_access_at = NOW();
  END IF;

  IF p_org_id IS NOT NULL THEN
    UPDATE public.organizations
    SET last_access_at = NOW()
    WHERE id = p_org_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_user_screen_time(INT, UUID, UUID) TO authenticated, anon;

-- 3. Atualizar a RPC admin_get_all_organizations para retornar o último acesso de cada empresa
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
  access_plan_description text,
  last_access_at timestamptz
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
    ap.description,
    COALESCE(o.last_access_at, MAX(p.last_access_at)) AS last_access_at
  FROM public.organizations o
  LEFT JOIN public.organization_members om ON om.organization_id = o.id
  LEFT JOIN public.profiles p ON p.id = om.user_id
  LEFT JOIN public.organization_dashboard_modules odm ON odm.organization_id = o.id
  LEFT JOIN public.access_plans ap ON ap.id = o.access_plan_id
  GROUP BY
    o.id, o.name, o.slug, o.is_active, o.trial_ends_at, o.created_at,
    o.admin_email, o.admin_name, o.cnpj, o.address, o.responsible, o.notes,
    o.access_plan_id, ap.name, ap.description, o.last_access_at
  ORDER BY o.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_all_organizations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_all_organizations() TO authenticated;
