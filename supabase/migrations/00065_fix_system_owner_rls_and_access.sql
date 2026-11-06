-- Migration 00065: Corrige permissões de RLS, superadmin e ordenação de empresas para o Proprietário do Sistema

-- 1. Atualiza public.is_org_member para reconhecer todas as contas de Proprietário do Sistema (Superadmin)
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  u_email TEXT;
BEGIN
  IF uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1.1. Verifica se já consta na tabela organization_members
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id AND user_id = uid
  ) THEN
    RETURN TRUE;
  END IF;

  -- 1.2. Verifica se é o Proprietário do Sistema (Superadmin global com acesso irrestrito a todas as empresas)
  SELECT lower(email) INTO u_email FROM auth.users WHERE id = uid LIMIT 1;
  IF u_email IS NOT NULL AND u_email IN (
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br',
    'bryan@administrador.com',
    'bryanmendes968@gmail.com'
  ) THEN
    RETURN TRUE;
  END IF;

  -- 1.3. Verifica se o e-mail corresponde ao admin_email cadastrado na empresa
  IF u_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id AND lower(trim(COALESCE(admin_email, ''))) = u_email
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 2. Atualiza get_user_organization_role para reconhecer o papel de proprietário ('owner') para os e-mails superadmin
CREATE OR REPLACE FUNCTION public.get_user_organization_role(org_id UUID, uid UUID)
RETURNS organization_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role organization_role;
  u_email TEXT;
BEGIN
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2.1. Verifica se já existe papel explícito na tabela organization_members
  SELECT role INTO v_role
  FROM public.organization_members
  WHERE organization_id = org_id AND user_id = uid
  LIMIT 1;

  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  -- 2.2. Se o usuário for o Proprietário do Sistema, concede role 'owner'
  SELECT lower(email) INTO u_email FROM auth.users WHERE id = uid LIMIT 1;
  IF u_email IS NOT NULL AND u_email IN (
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br',
    'bryan@administrador.com',
    'bryanmendes968@gmail.com'
  ) THEN
    RETURN 'owner'::organization_role;
  END IF;

  -- 2.3. Se o e-mail do usuário corresponder ao admin_email cadastrado na organização
  IF u_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id AND lower(trim(COALESCE(admin_email, ''))) = u_email
  ) THEN
    RETURN 'admin'::organization_role;
  END IF;

  RETURN NULL;
END;
$$;

-- 3. Atualiza ensure_user_company_access para retornar todas as empresas para o Superadmin, ordenando a principal primeiro
CREATE OR REPLACE FUNCTION public.ensure_user_company_access()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  is_active BOOLEAN,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_is_owner BOOLEAN := FALSE;
  v_org RECORD;
  v_mod_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL THEN
    SELECT lower(email) INTO v_email FROM public.profiles WHERE id = v_uid;
  END IF;

  IF v_email IS NOT NULL AND v_email IN (
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br',
    'bryan@administrador.com',
    'bryanmendes968@gmail.com'
  ) THEN
    v_is_owner := TRUE;
  END IF;

  -- Se for Proprietário do Sistema:
  IF v_is_owner THEN
    -- Garante vínculo 'owner' na empresa principal
    FOR v_org IN
      SELECT o.id FROM public.organizations o WHERE lower(o.name) LIKE '%bryan%'
    LOOP
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (v_org.id, v_uid, 'owner')
      ON CONFLICT (organization_id, user_id) DO UPDATE
      SET role = 'owner';
    END LOOP;

    -- Retorna todas as empresas, com a empresa principal "Bryan adm" em 1º lugar
    RETURN QUERY
    SELECT
      o.id,
      o.name,
      o.slug,
      COALESCE(o.is_active, true) AS is_active,
      o.trial_ends_at,
      o.created_at
    FROM public.organizations o
    ORDER BY
      CASE WHEN lower(o.name) LIKE '%bryan%' THEN 1 ELSE 2 END,
      o.created_at ASC;
    RETURN;
  END IF;

  -- Para usuários normais ou admins de empresa:
  -- 1. Auto-vincula o usuário como admin em qualquer organização que possua o e-mail cadastrado
  IF v_email IS NOT NULL AND v_email <> '' THEN
    FOR v_org IN
      SELECT o.id
      FROM public.organizations o
      WHERE lower(trim(COALESCE(o.admin_email, ''))) = v_email
    LOOP
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (v_org.id, v_uid, 'admin')
      ON CONFLICT (organization_id, user_id) DO UPDATE
      SET role = 'admin';

      -- Garante módulo JB Software (orcafacil)
      SELECT m.id INTO v_mod_id FROM public.modules m WHERE m.code = 'orcafacil' LIMIT 1;
      IF v_mod_id IS NOT NULL THEN
        INSERT INTO public.organization_modules (organization_id, module_id, status)
        VALUES (v_org.id, v_mod_id, 'active')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- 2. Retorna a lista de empresas das quais é membro ou admin
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    COALESCE(o.is_active, true) AS is_active,
    o.trial_ends_at,
    o.created_at
  FROM public.organizations o
  WHERE EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = o.id AND om.user_id = v_uid
  )
  OR (v_email IS NOT NULL AND lower(trim(COALESCE(o.admin_email, ''))) = v_email)
  ORDER BY o.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_company_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_company_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_organization_role(UUID, UUID) TO authenticated, anon;

