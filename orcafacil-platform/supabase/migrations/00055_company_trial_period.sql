-- Migração 00055: Período de Teste para Empresas Cadastradas (Trial Period)
-- Adiciona a coluna trial_ends_at à tabela public.organizations e disponibiliza funções seguras

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ NULL;

-- 1. Função RPC para o Proprietário configurar ou estender o período de teste de uma empresa
CREATE OR REPLACE FUNCTION public.admin_set_organization_trial(
  p_org_id UUID,
  p_trial_ends_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Proprietário pode alterar o período de teste das empresas.';
  END IF;

  UPDATE public.organizations
  SET trial_ends_at = p_trial_ends_at
  WHERE id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_org_id,
    'trial_ends_at', p_trial_ends_at
  );
END;
$$;

-- 2. Atualiza a RPC admin_get_all_organizations para incluir trial_ends_at
DROP FUNCTION IF EXISTS public.admin_get_all_organizations();
CREATE OR REPLACE FUNCTION public.admin_get_all_organizations()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  is_active BOOLEAN,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  admin_email TEXT,
  admin_name TEXT,
  members_count BIGINT,
  modules TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Proprietário pode acessar a gestão de empresas.';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    COALESCE(o.is_active, true),
    o.trial_ends_at,
    o.created_at,
    COALESCE(
      (
        SELECT p.email
        FROM public.organization_members om
        JOIN public.profiles p ON p.id = om.user_id
        WHERE om.organization_id = o.id AND om.role IN ('admin', 'owner')
        ORDER BY CASE WHEN om.role = 'owner' THEN 1 ELSE 2 END, om.created_at ASC
        LIMIT 1
      ),
      ''
    ),
    COALESCE(
      (
        SELECT p.display_name
        FROM public.organization_members om
        JOIN public.profiles p ON p.id = om.user_id
        WHERE om.organization_id = o.id AND om.role IN ('admin', 'owner')
        ORDER BY CASE WHEN om.role = 'owner' THEN 1 ELSE 2 END, om.created_at ASC
        LIMIT 1
      ),
      'Administrador'
    ),
    (
      SELECT COUNT(*)::BIGINT
      FROM public.organization_members om
      WHERE om.organization_id = o.id
    ),
    ARRAY(
      SELECT odm.module_code
      FROM public.organization_dashboard_modules odm
      WHERE odm.organization_id = o.id
      ORDER BY odm.module_code
    )
  FROM public.organizations o
  ORDER BY o.created_at DESC;
END;
$$;

