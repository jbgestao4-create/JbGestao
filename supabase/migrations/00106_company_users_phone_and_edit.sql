-- Migration 00106: Adicao de Telefone e Edicao de Informacoes de Usuarios e Funcionarios
-- Permite cadastrar e editar o numero de WhatsApp/telefone dos funcionarios e usuarios,
-- alem de habilitar o botao de edicao de informacoes em Organizacao e em Usuarios Cadastrados.

-- 1. Garante que profiles possui a coluna phone
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Atualiza admin_get_company_users para retornar a coluna phone
DROP FUNCTION IF EXISTS public.admin_get_company_users(UUID);
CREATE OR REPLACE FUNCTION public.admin_get_company_users(p_org_id UUID)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  job_title TEXT,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- Permite ao Proprietário do Sistema ou Admin da empresa
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND (role = 'owner' OR role = 'admin')
  ) AND NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND lower(email) IN ('adm@adm.com', 'admin@adm.com', 'proprietario@jbsoftware.com.br', 'owner@jbsoftware.com.br', 'bryan@administrador.com', 'bryanmendes968@gmail.com')
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Proprietário do Sistema ou Administrador pode consultar usuários de empresas.';
  END IF;

  RETURN QUERY
  SELECT
    om.user_id,
    COALESCE(p.display_name, u.raw_user_meta_data->>'display_name', 'Usuário')::TEXT as display_name,
    COALESCE(p.email, u.email, '')::TEXT as email,
    COALESCE(p.phone, u.phone, '')::TEXT as phone,
    om.role::TEXT as role,
    COALESCE(om.job_title, '')::TEXT as job_title,
    om.created_at
  FROM public.organization_members om
  LEFT JOIN public.profiles p ON p.id = om.user_id
  LEFT JOIN auth.users u ON u.id = om.user_id
  WHERE om.organization_id = p_org_id
    AND lower(COALESCE(p.email, u.email, '')) NOT IN (
      'adm@adm.com',
      'admin@adm.com',
      'proprietario@jbsoftware.com.br',
      'owner@jbsoftware.com.br',
      'bryan@administrador.com',
      'bryanmendes968@gmail.com'
    )
  ORDER BY
    CASE om.role
      WHEN 'admin' THEN 1
      WHEN 'owner' THEN 2
      ELSE 3
    END,
    om.created_at ASC;
END;
$$;

-- 3. Atualiza get_organization_members_with_details para retornar a coluna phone
DROP FUNCTION IF EXISTS public.get_organization_members_with_details(UUID);
CREATE OR REPLACE FUNCTION public.get_organization_members_with_details(p_org_id UUID)
RETURNS TABLE (
  user_id UUID,
  organization_id UUID,
  role organization_role,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  modules module_code[],
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_org_member(p_org_id, auth.uid()) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  RETURN QUERY
  SELECT
    om.user_id,
    om.organization_id,
    om.role,
    COALESCE(p.display_name, 'Membro')::TEXT as display_name,
    COALESCE(p.email, '')::TEXT as email,
    COALESCE(p.phone, '')::TEXT as phone,
    COALESCE(
      array_agg(omm.module_code) FILTER (WHERE omm.module_code IS NOT NULL),
      ARRAY[]::module_code[]
    ) as modules,
    om.created_at
  FROM public.organization_members om
  LEFT JOIN public.profiles p ON p.id = om.user_id
  LEFT JOIN public.organization_member_modules omm
    ON omm.organization_id = om.organization_id AND omm.user_id = om.user_id
  WHERE om.organization_id = p_org_id
    AND lower(COALESCE(p.email, '')) NOT IN (
      'adm@adm.com',
      'admin@adm.com',
      'proprietario@jbsoftware.com.br',
      'owner@jbsoftware.com.br',
      'bryan@administrador.com',
      'bryanmendes968@gmail.com'
    )
  GROUP BY om.user_id, om.organization_id, om.role, p.display_name, p.email, p.phone, om.created_at
  ORDER BY
    CASE om.role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      ELSE 3
    END,
    om.created_at ASC;
END;
$$;

-- 4. Função para atualizar dados completos de usuário/funcionário da empresa (inclusive telefone)
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
  v_is_superadmin BOOLEAN;
  v_target_role TEXT;
  v_clean_name TEXT;
  v_clean_email TEXT;
  v_clean_phone TEXT;
  v_clean_job_title TEXT;
  v_new_role organization_role;
BEGIN
  -- Verifica se é superadmin/desenvolvedor
  v_is_superadmin := EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND lower(email) IN ('adm@adm.com', 'admin@adm.com', 'proprietario@jbsoftware.com.br', 'owner@jbsoftware.com.br', 'bryan@administrador.com', 'bryanmendes968@gmail.com')
  );

  -- Verifica papel na organização
  SELECT role::TEXT INTO v_caller_role
  FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = auth.uid();

  -- Se não for superadmin nem admin/owner nem o próprio usuário:
  IF NOT v_is_superadmin AND (v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin')) AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado: permissões insuficientes para editar este usuário.';
  END IF;

  -- Verifica usuário alvo
  SELECT role::TEXT INTO v_target_role
  FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;

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

  -- Se o papel foi informado e é válido:
  IF p_role IS NOT NULL AND p_role IN ('member', 'admin') THEN
    v_new_role := p_role::organization_role;
  ELSE
    v_new_role := v_target_role::organization_role;
  END IF;

  -- Atualiza em auth.users
  UPDATE auth.users
  SET email = v_clean_email,
      phone = NULLIF(v_clean_phone, ''),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('display_name', v_clean_name, 'email', v_clean_email, 'phone', v_clean_phone),
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
      role = CASE WHEN v_target_role = 'owner' THEN 'owner'::organization_role ELSE v_new_role END
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Dados do usuário atualizados com sucesso.'
  );
END;
$$;

-- 5. Atualiza update_organization_member para aceitar telefone e suportar auto-edição
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
BEGIN
  caller_role := public.get_user_organization_role(p_org_id, auth.uid());
  IF (caller_role IS NULL OR caller_role NOT IN ('owner', 'admin')) AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Apenas proprietários, administradores ou o próprio usuário podem editar estas informações.';
  END IF;

  SELECT role
  INTO target_role
  FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;

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

  UPDATE auth.users
  SET email = clean_email,
      phone = NULLIF(clean_phone, ''),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('display_name', clean_name, 'email', clean_email, 'phone', clean_phone),
      updated_at = NOW()
  WHERE id = p_user_id;

  UPDATE auth.identities
  SET identity_data = COALESCE(identity_data, '{}'::jsonb)
        || jsonb_build_object('email', clean_email, 'sub', p_user_id::text),
      updated_at = NOW()
  WHERE user_id = p_user_id AND provider = 'email';

  UPDATE public.profiles
  SET display_name = clean_name,
      email = clean_email,
      phone = NULLIF(clean_phone, '')
  WHERE id = p_user_id;

  UPDATE public.organization_members
  SET job_title = clean_job_title,
      role = CASE WHEN target_role = 'owner' THEN 'owner'::organization_role ELSE COALESCE(p_role, target_role) END
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  RETURN TRUE;
END;
$$;

-- 6. Concede permissões
GRANT EXECUTE ON FUNCTION public.admin_get_company_users(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_members_with_details(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_company_user(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_organization_member(UUID, UUID, TEXT, TEXT, TEXT, organization_role, TEXT) TO authenticated;
