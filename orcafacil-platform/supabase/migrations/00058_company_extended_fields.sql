-- Migration 00058: Campos estendidos para cadastro e edição de empresas (CNPJ, Endereço, Responsável, Observação) e Redefinição de Administrador

-- 1. Adiciona colunas na tabela organizations se ainda não existirem
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS responsible TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Atualiza a RPC admin_get_all_organizations para retornar as novas colunas
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
  cnpj TEXT,
  address TEXT,
  responsible TEXT,
  notes TEXT,
  members_count BIGINT,
  modules TEXT[]
)
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.slug,
    o.is_active,
    o.trial_ends_at,
    o.created_at,
    COALESCE(o.admin_email, '')::TEXT as admin_email,
    COALESCE(o.admin_name, 'Administrador')::TEXT as admin_name,
    COALESCE(o.cnpj, '')::TEXT as cnpj,
    COALESCE(o.address, '')::TEXT as address,
    COALESCE(o.responsible, '')::TEXT as responsible,
    COALESCE(o.notes, '')::TEXT as notes,
    COUNT(DISTINCT om.user_id) as members_count,
    COALESCE(array_agg(DISTINCT odm.module_code) FILTER (WHERE odm.module_code IS NOT NULL), '{}') as modules
  FROM public.organizations o
  LEFT JOIN public.organization_members om ON om.organization_id = o.id
  LEFT JOIN public.organization_dashboard_modules odm ON odm.organization_id = o.id
  GROUP BY o.id, o.name, o.slug, o.is_active, o.trial_ends_at, o.created_at, o.admin_email, o.admin_name, o.cnpj, o.address, o.responsible, o.notes
  ORDER BY o.created_at DESC;
END;
$$;

-- 3. Atualiza a RPC admin_update_full_company_details para suportar CNPJ, Endereço, Responsável, Observação e Redefinição de Senha do Administrador
DROP FUNCTION IF EXISTS public.admin_update_full_company_details(UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_update_full_company_details(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.admin_update_full_company_details(
  p_org_id UUID,
  p_name TEXT,
  p_slug TEXT,
  p_is_active BOOLEAN DEFAULT NULL,
  p_trial_ends_at TIMESTAMPTZ DEFAULT NULL,
  p_admin_name TEXT DEFAULT NULL,
  p_admin_email TEXT DEFAULT NULL,
  p_admin_password TEXT DEFAULT NULL,
  p_modules TEXT[] DEFAULT NULL,
  p_cnpj TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_responsible TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  target_admin_id UUID;
  encrypted_pw TEXT;
BEGIN
  -- 1. Atualiza dados da organização
  UPDATE public.organizations
  SET
    name = p_name,
    slug = p_slug,
    is_active = COALESCE(p_is_active, is_active),
    trial_ends_at = p_trial_ends_at,
    admin_name = COALESCE(p_admin_name, admin_name),
    admin_email = COALESCE(p_admin_email, admin_email),
    cnpj = COALESCE(p_cnpj, cnpj),
    address = COALESCE(p_address, address),
    responsible = COALESCE(p_responsible, responsible),
    notes = COALESCE(p_notes, notes),
    updated_at = NOW()
  WHERE id = p_org_id;

  -- 2. Localiza ou atualiza o administrador da empresa
  target_admin_id := NULL;
  SELECT om.user_id INTO target_admin_id
  FROM public.organization_members om
  WHERE om.organization_id = p_org_id
    AND om.role IN ('admin', 'owner')
    AND om.user_id <> auth.uid()
  ORDER BY om.created_at ASC
  LIMIT 1;

  IF target_admin_id IS NULL AND p_admin_email IS NOT NULL AND trim(p_admin_email) <> '' THEN
    SELECT id INTO target_admin_id FROM public.profiles WHERE lower(email) = lower(trim(p_admin_email)) LIMIT 1;
    IF target_admin_id IS NULL THEN
      SELECT id INTO target_admin_id FROM auth.users WHERE lower(email) = lower(trim(p_admin_email)) LIMIT 1;
    END IF;
    IF target_admin_id IS NOT NULL THEN
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (p_org_id, target_admin_id, 'admin')
      ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'admin';
    END IF;
  END IF;

  IF target_admin_id IS NOT NULL THEN
    -- Atualiza profile
    UPDATE public.profiles
    SET display_name = COALESCE(NULLIF(trim(p_admin_name), ''), display_name),
        email = COALESCE(NULLIF(lower(trim(p_admin_email)), ''), email),
        updated_at = NOW()
    WHERE id = target_admin_id;

    -- Atualiza auth.users
    IF p_admin_email IS NOT NULL AND trim(p_admin_email) <> '' THEN
      UPDATE auth.users
      SET email = lower(trim(p_admin_email)),
          raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
            'display_name', trim(p_admin_name),
            'email', lower(trim(p_admin_email))
          ),
          updated_at = NOW()
      WHERE id = target_admin_id;
    END IF;

    -- Redefinição de senha do administrador se fornecida
    IF p_admin_password IS NOT NULL AND length(trim(p_admin_password)) >= 6 THEN
      encrypted_pw := crypt(trim(p_admin_password), gen_salt('bf', 10));
      UPDATE auth.users
      SET encrypted_password = encrypted_pw,
          updated_at = NOW()
      WHERE id = target_admin_id;
    END IF;
  END IF;

  -- 3. Atualiza módulos se fornecidos
  IF p_modules IS NOT NULL THEN
    DELETE FROM public.organization_dashboard_modules WHERE organization_id = p_org_id;
    IF array_length(p_modules, 1) > 0 THEN
      INSERT INTO public.organization_dashboard_modules (organization_id, module_code)
      SELECT p_org_id, unnest(p_modules);
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
