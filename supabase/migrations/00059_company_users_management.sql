-- Migration 00059: Consulta de Usuários da Empresa e Redefinição de Senha pelo Proprietário

-- 1. Função para o Proprietário do Sistema listar todos os usuários/membros de qualquer empresa
CREATE OR REPLACE FUNCTION public.admin_get_company_users(p_org_id UUID)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  email TEXT,
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
    RAISE EXCEPTION 'Acesso negado: apenas o Proprietário do Sistema pode consultar usuários de empresas.';
  END IF;

  RETURN QUERY
  SELECT
    om.user_id,
    COALESCE(p.display_name, u.raw_user_meta_data->>'display_name', 'Usuário')::TEXT as display_name,
    COALESCE(p.email, u.email, '')::TEXT as email,
    om.role::TEXT as role,
    COALESCE(om.job_title, '')::TEXT as job_title,
    om.created_at
  FROM public.organization_members om
  LEFT JOIN public.profiles p ON p.id = om.user_id
  LEFT JOIN auth.users u ON u.id = om.user_id
  WHERE om.organization_id = p_org_id
  ORDER BY
    CASE om.role
      WHEN 'admin' THEN 1
      WHEN 'owner' THEN 2
      ELSE 3
    END,
    om.created_at ASC;
END;
$$;

-- 2. Função para o Proprietário do Sistema redefinir a senha de qualquer usuário de uma empresa
CREATE OR REPLACE FUNCTION public.admin_reset_company_user_password(
  p_org_id UUID,
  p_user_id TEXT,
  p_new_password TEXT,
  p_user_email TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  target_user_id UUID;
  encrypted_pw TEXT;
  clean_email TEXT;
BEGIN
  -- Permite se o usuário logado for owner/admin em qualquer organização OU for do sistema
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND (role = 'owner' OR role = 'admin')
  ) AND NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND lower(email) IN ('adm@adm.com', 'admin@adm.com', 'proprietario@jbsoftware.com.br', 'owner@jbsoftware.com.br', 'bryan@administrador.com', 'bryanmendes968@gmail.com')
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Proprietário do Sistema pode redefinir senhas de usuários.';
  END IF;

  IF length(trim(p_new_password)) < 6 THEN
    RAISE EXCEPTION 'A nova senha deve ter no mínimo 6 caracteres.';
  END IF;

  target_user_id := NULL;
  clean_email := NULL;

  IF p_user_email IS NOT NULL AND trim(p_user_email) <> '' THEN
    clean_email := lower(trim(p_user_email));
  END IF;

  -- 1. Tenta por p_user_id se for formato UUID válido
  IF p_user_id IS NOT NULL AND p_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO target_user_id FROM auth.users WHERE id = p_user_id::UUID;
  END IF;

  -- 2. Tenta por e-mail fornecido em clean_email
  IF target_user_id IS NULL AND clean_email IS NOT NULL THEN
    SELECT id INTO target_user_id FROM auth.users WHERE lower(email) = clean_email LIMIT 1;
  END IF;

  -- 3. Tenta por p_user_id se ele próprio for um e-mail
  IF target_user_id IS NULL AND p_user_id IS NOT NULL AND p_user_id LIKE '%@%' THEN
    clean_email := lower(trim(p_user_id));
    SELECT id INTO target_user_id FROM auth.users WHERE lower(email) = clean_email LIMIT 1;
  END IF;

  -- 4. Tenta buscar em profiles pelo e-mail
  IF target_user_id IS NULL AND clean_email IS NOT NULL THEN
    SELECT id INTO target_user_id FROM public.profiles WHERE lower(email) = clean_email LIMIT 1;
  END IF;

  -- 5. Se ainda não achou e a empresa tem admin_email cadastrado
  IF target_user_id IS NULL THEN
    SELECT u.id, lower(o.admin_email) INTO target_user_id, clean_email
    FROM public.organizations o
    LEFT JOIN auth.users u ON lower(u.email) = lower(o.admin_email)
    WHERE o.id = p_org_id AND o.admin_email IS NOT NULL AND trim(o.admin_email) <> ''
    LIMIT 1;
  END IF;

  -- Criptografa a nova senha com bcrypt salt custo 10
  encrypted_pw := crypt(trim(p_new_password), gen_salt('bf', 10));

  -- Se não encontrou o usuário em auth.users mas temos e-mail, cria a conta em auth.users e auth.identities
  IF target_user_id IS NULL THEN
    IF clean_email IS NOT NULL AND clean_email <> '' THEN
      target_user_id := gen_random_uuid();

      INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role,
        aud
      ) VALUES (
        target_user_id,
        '00000000-0000-0000-0000-000000000000',
        clean_email,
        encrypted_pw,
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('display_name', split_part(clean_email, '@', 1)),
        false,
        'authenticated',
        'authenticated'
      );

      -- Garante identidade de autenticação para login com e-mail/senha
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        target_user_id,
        jsonb_build_object('sub', target_user_id::text, 'email', clean_email),
        'email',
        target_user_id::text,
        NOW(),
        NOW(),
        NOW()
      );

      -- Garante profile
      INSERT INTO public.profiles (id, email, display_name)
      VALUES (target_user_id, clean_email, split_part(clean_email, '@', 1))
      ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email;

      -- Garante vínculo na organização
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (p_org_id, target_user_id, 'member')
      ON CONFLICT (organization_id, user_id) DO NOTHING;

      RETURN jsonb_build_object(
        'success', true,
        'user_id', target_user_id,
        'message', 'Conta criada e senha definida com sucesso.'
      );
    ELSE
      RAISE EXCEPTION 'Usuário não encontrado na base de autenticação.';
    END IF;
  END IF;

  -- Se o usuário existe em auth.users, atualiza a senha criptografada imediatamente
  UPDATE auth.users
  SET encrypted_password = encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
  WHERE id = target_user_id;

  -- Garante que exista registro em auth.identities para viabilizar login
  IF NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = target_user_id AND provider = 'email'
  ) THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      target_user_id,
      jsonb_build_object('sub', target_user_id::text, 'email', COALESCE(clean_email, (SELECT email FROM auth.users WHERE id = target_user_id))),
      'email',
      target_user_id::text,
      NOW(),
      NOW(),
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'message', 'Senha redefinida com sucesso.'
  );
END;
$$;

-- Overload aceitando UUID direto para retrocompatibilidade
CREATE OR REPLACE FUNCTION public.admin_reset_company_user_password(
  p_org_id UUID,
  p_user_id UUID,
  p_new_password TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN public.admin_reset_company_user_password(
    p_org_id,
    p_user_id::TEXT,
    p_new_password,
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_company_users(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_company_users(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_reset_company_user_password(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_company_user_password(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_reset_company_user_password(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_company_user_password(UUID, UUID, TEXT) TO authenticated, service_role;
