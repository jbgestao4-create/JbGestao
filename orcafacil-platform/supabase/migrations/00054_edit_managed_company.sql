DROP FUNCTION IF EXISTS public.admin_get_all_organizations();
CREATE OR REPLACE FUNCTION public.admin_get_all_organizations()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  is_active BOOLEAN,
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

CREATE OR REPLACE FUNCTION public.admin_update_organization_details(
  p_org_id UUID,
  p_org_name TEXT,
  p_org_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_name TEXT := trim(p_org_name);
  clean_slug TEXT := lower(trim(p_org_slug));
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Proprietário pode editar empresas cadastradas.';
  END IF;

  IF length(clean_name) < 2 THEN
    RAISE EXCEPTION 'O nome da empresa deve ter pelo menos 2 caracteres.';
  END IF;

  IF clean_slug !~ '^[a-z0-9-]+$' THEN
    RAISE EXCEPTION 'O identificador deve conter apenas letras minúsculas, números e hífens.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE slug = clean_slug AND id <> p_org_id
  ) THEN
    RAISE EXCEPTION 'O identificador "%" já está em uso por outra empresa.', clean_slug;
  END IF;

  UPDATE public.organizations
  SET name = clean_name,
      slug = clean_slug,
      updated_at = NOW()
  WHERE id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A empresa não foi encontrada.';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'organizationId', p_org_id,
    'name', clean_name,
    'slug', clean_slug
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_organization_with_reason(
  p_org_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Proprietário pode excluir empresas cadastradas.';
  END IF;

  DELETE FROM public.organizations
  WHERE id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A empresa não foi encontrada.';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'organizationId', p_org_id
  );
END;
$$;
