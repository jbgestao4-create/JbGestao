-- 00113_allow_editing_system_owner_and_dynamic_superadmin.sql
-- Permite visualizar e editar a conta de superadmin / adm@adm.com, incluindo alteração de e-mail e preservação de privilégios

-- 1. Função helper para verificar se um usuário é proprietário da plataforma (Superadmin)
CREATE OR REPLACE FUNCTION public.is_system_owner(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
      AND (
        (raw_app_meta_data->>'is_platform_owner')::boolean = true
        OR (raw_user_meta_data->>'is_platform_owner')::boolean = true
        OR lower(email) IN (
          'adm@adm.com',
          'admin@adm.com',
          'proprietario@jbsoftware.com.br',
          'owner@jbsoftware.com.br',
          'bryan@administrador.com',
          'bryanmendes968@gmail.com'
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_system_owner(UUID) TO authenticated, anon;

-- 2. Função para auto-atualização de perfil (Meu Perfil) com suporte a troca de e-mail
CREATE OR REPLACE FUNCTION public.self_update_profile(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_clean_name TEXT;
  v_clean_email TEXT;
  v_clean_phone TEXT;
  v_is_owner BOOLEAN;
  v_old_email TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  v_clean_name := trim(COALESCE(p_name, ''));
  v_clean_email := lower(trim(COALESCE(p_email, '')));
  v_clean_phone := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');

  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'O nome é obrigatório.';
  END IF;

  IF v_clean_email = '' OR position('@' IN v_clean_email) < 2 THEN
    RAISE EXCEPTION 'Informe um e-mail válido.';
  END IF;

  SELECT email INTO v_old_email FROM auth.users WHERE id = v_user_id;

  v_is_owner := public.is_system_owner(v_user_id);

  -- Atualiza auth.users
  UPDATE auth.users
  SET email = v_clean_email,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      phone = NULLIF(v_clean_phone, ''),
      raw_app_meta_data = CASE
        WHEN v_is_owner THEN COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"is_platform_owner": true}'::jsonb
        ELSE raw_app_meta_data
      END,
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('display_name', v_clean_name, 'email', v_clean_email, 'phone', v_clean_phone)
        || CASE WHEN v_is_owner THEN '{"is_platform_owner": true}'::jsonb ELSE '{}'::jsonb END,
      updated_at = NOW()
  WHERE id = v_user_id;

  -- Atualiza auth.identities
  UPDATE auth.identities
  SET identity_data = COALESCE(identity_data, '{}'::jsonb)
        || jsonb_build_object('email', v_clean_email, 'sub', v_user_id::text),
      updated_at = NOW()
  WHERE user_id = v_user_id AND provider = 'email';

  -- Atualiza public.profiles
  UPDATE public.profiles
  SET display_name = v_clean_name,
      email = v_clean_email,
      phone = NULLIF(v_clean_phone, ''),
      updated_at = NOW()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'email_changed', v_old_email <> v_clean_email,
    'email', v_clean_email,
    'display_name', v_clean_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.self_update_profile(TEXT, TEXT, TEXT) TO authenticated;

-- 3. Atualiza update_organization_member para permitir edição de adm@adm.com / superadmins sem bloqueio
CREATE OR REPLACE FUNCTION public.update_organization_member(
  p_org_id UUID,
  p_user_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_job_title TEXT,
  p_role organization_role,
  p_phone TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_role organization_role;
  target_role organization_role;
  clean_name TEXT;
  clean_email TEXT;
  clean_phone TEXT;
  clean_job_title TEXT;
  v_is_target_owner BOOLEAN;
  v_is_caller_owner BOOLEAN;
BEGIN
  v_is_caller_owner := public.is_system_owner(auth.uid());
  caller_role := public.get_user_organization_role(p_org_id, auth.uid());

  IF NOT v_is_caller_owner AND (caller_role IS NULL OR caller_role NOT IN ('owner', 'admin')) AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Apenas proprietários, administradores ou o próprio usuário podem editar estas informações.';
  END IF;

  SELECT role
  INTO target_role
  FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  v_is_target_owner := public.is_system_owner(p_user_id);

  -- Se for superadmin/proprietário e não estiver vinculado na tabela, vincula automaticamente
  IF target_role IS NULL AND (v_is_target_owner OR p_user_id = auth.uid()) THEN
    INSERT INTO public.organization_members (organization_id, user_id, role, created_at, updated_at)
    VALUES (p_org_id, p_user_id, 'owner', NOW(), NOW())
    ON CONFLICT (organization_id, user_id) DO NOTHING;
    target_role := 'owner';
  END IF;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Funcionário não encontrado nesta empresa.';
  END IF;

  clean_name := trim(COALESCE(p_name, ''));
  clean_email := lower(trim(COALESCE(p_email, '')));
  clean_phone := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  clean_job_title := NULLIF(trim(COALESCE(p_job_title, '')), '');

  IF clean_name = '' THEN
    RAISE EXCEPTION 'O nome do funcionário é obrigatório.';
  END IF;

  IF clean_email = '' OR position('@' IN clean_email) < 2 THEN
    RAISE EXCEPTION 'Informe um e-mail válido.';
  END IF;

  -- Atualiza auth.users preservando is_platform_owner se o alvo for superadmin
  UPDATE auth.users
  SET email = clean_email,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      phone = NULLIF(clean_phone, ''),
      raw_app_meta_data = CASE
        WHEN v_is_target_owner THEN COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"is_platform_owner": true}'::jsonb
        ELSE raw_app_meta_data
      END,
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('display_name', clean_name, 'email', clean_email, 'phone', clean_phone)
        || CASE WHEN v_is_target_owner THEN '{"is_platform_owner": true}'::jsonb ELSE '{}'::jsonb END,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Atualiza auth.identities
  UPDATE auth.identities
  SET identity_data = COALESCE(identity_data, '{}'::jsonb)
        || jsonb_build_object('email', clean_email, 'sub', p_user_id::text),
      updated_at = NOW()
  WHERE user_id = p_user_id AND provider = 'email';

  -- Atualiza public.profiles
  UPDATE public.profiles
  SET display_name = clean_name,
      email = clean_email,
      phone = NULLIF(clean_phone, ''),
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Atualiza public.organization_members
  UPDATE public.organization_members
  SET job_title = clean_job_title,
      role = CASE WHEN target_role = 'owner' THEN 'owner'::organization_role ELSE COALESCE(p_role, target_role) END,
      updated_at = NOW()
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_organization_member(UUID, UUID, TEXT, TEXT, TEXT, organization_role, TEXT) TO authenticated;

-- 4. Atualiza admin_update_company_user para suportar edição de adm@adm.com e superadmin
CREATE OR REPLACE FUNCTION public.admin_update_company_user(
  p_org_id UUID,
  p_user_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_job_title TEXT,
  p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_is_caller_superadmin BOOLEAN;
  v_is_target_superadmin BOOLEAN;
  v_target_role TEXT;
  v_clean_name TEXT;
  v_clean_email TEXT;
  v_clean_phone TEXT;
  v_clean_job_title TEXT;
  v_new_role organization_role;
BEGIN
  v_is_caller_superadmin := public.is_system_owner(auth.uid());
  v_is_target_superadmin := public.is_system_owner(p_user_id);

  -- Verifica papel do chamador na organização
  SELECT role::TEXT INTO v_caller_role
  FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = auth.uid();

  IF NOT v_is_caller_superadmin AND (v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin')) AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado: permissões insuficientes para editar este usuário.';
  END IF;

  -- Verifica usuário alvo
  SELECT role::TEXT INTO v_target_role
  FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  IF v_target_role IS NULL AND (v_is_target_superadmin OR p_user_id = auth.uid()) THEN
    INSERT INTO public.organization_members (organization_id, user_id, role, created_at, updated_at)
    VALUES (p_org_id, p_user_id, 'owner', NOW(), NOW())
    ON CONFLICT (organization_id, user_id) DO NOTHING;
    v_target_role := 'owner';
  END IF;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado nesta organização.';
  END IF;

  v_clean_name := trim(COALESCE(p_name, ''));
  v_clean_email := lower(trim(COALESCE(p_email, '')));
  v_clean_phone := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_clean_job_title := NULLIF(trim(COALESCE(p_job_title, '')), '');

  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'O nome é obrigatório.';
  END IF;

  IF v_clean_email = '' OR position('@' IN v_clean_email) < 2 THEN
    RAISE EXCEPTION 'Informe um e-mail válido.';
  END IF;

  IF p_role IS NOT NULL AND p_role IN ('member', 'admin') THEN
    v_new_role := p_role::organization_role;
  ELSE
    v_new_role := v_target_role::organization_role;
  END IF;

  -- Atualiza em auth.users
  UPDATE auth.users
  SET email = v_clean_email,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      phone = NULLIF(v_clean_phone, ''),
      raw_app_meta_data = CASE
        WHEN v_is_target_superadmin THEN COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"is_platform_owner": true}'::jsonb
        ELSE raw_app_meta_data
      END,
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('display_name', v_clean_name, 'email', v_clean_email, 'phone', v_clean_phone)
        || CASE WHEN v_is_target_superadmin THEN '{"is_platform_owner": true}'::jsonb ELSE '{}'::jsonb END,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Atualiza em auth.identities
  UPDATE auth.identities
  SET identity_data = COALESCE(identity_data, '{}'::jsonb)
        || jsonb_build_object('email', v_clean_email, 'sub', p_user_id::text),
      updated_at = NOW()
  WHERE user_id = p_user_id AND provider = 'email';

  -- Atualiza em profiles
  UPDATE public.profiles
  SET display_name = v_clean_name,
      email = v_clean_email,
      phone = NULLIF(v_clean_phone, ''),
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Atualiza em organization_members
  UPDATE public.organization_members
  SET job_title = v_clean_job_title,
      role = CASE WHEN v_target_role = 'owner' THEN 'owner'::organization_role ELSE v_new_role END,
      updated_at = NOW()
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Dados do usuário atualizados com sucesso.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_company_user(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
