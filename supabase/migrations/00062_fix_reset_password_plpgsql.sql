-- Migration 00062: Correção de variáveis PL/pgSQL e remoção de sobrecarga ambígua no PostgREST

-- Remove sobrecargas antigas para que o PostgREST não tenha conflito PGRST203
DROP FUNCTION IF EXISTS public.admin_reset_company_user_password(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_reset_company_user_password(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_reset_company_user_password(UUID, TEXT, TEXT);

-- Função única sem ambiguidade
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
  target_user_id UUID := NULL;
  encrypted_pw TEXT := NULL;
  clean_email TEXT := NULL;
  temp_id UUID := NULL;
  temp_email TEXT := NULL;
BEGIN
  -- Permite se for chamado por superadmin ou se o usuário logado for owner/admin
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND (role = 'owner' OR role = 'admin')
  ) AND NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND lower(email) IN (
      'adm@adm.com', 'admin@adm.com', 'proprietario@jbsoftware.com.br',
      'owner@jbsoftware.com.br', 'bryan@administrador.com', 'bryanmendes968@gmail.com'
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Proprietário do Sistema pode redefinir senhas de usuários.';
  END IF;

  IF length(trim(p_new_password)) < 6 THEN
    RAISE EXCEPTION 'A nova senha deve ter no mínimo 6 caracteres.';
  END IF;

  IF p_user_email IS NOT NULL AND trim(p_user_email) <> '' THEN
    clean_email := lower(trim(p_user_email));
  END IF;

  -- 1. Tenta por p_user_id se for formato UUID válido
  IF p_user_id IS NOT NULL AND p_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id, lower(email) INTO temp_id, temp_email FROM auth.users WHERE id = p_user_id::UUID LIMIT 1;
    IF temp_id IS NOT NULL THEN
      target_user_id := temp_id;
      IF temp_email IS NOT NULL THEN clean_email := temp_email; END IF;
    ELSE
      SELECT id, lower(email) INTO temp_id, temp_email FROM public.profiles WHERE id = p_user_id::UUID LIMIT 1;
      IF temp_id IS NOT NULL THEN
        target_user_id := temp_id;
        IF temp_email IS NOT NULL THEN clean_email := temp_email; END IF;
      END IF;
    END IF;
  END IF;

  -- 2. Tenta por e-mail fornecido
  IF target_user_id IS NULL AND clean_email IS NOT NULL THEN
    SELECT id INTO temp_id FROM auth.users WHERE lower(email) = clean_email LIMIT 1;
    IF temp_id IS NOT NULL THEN
      target_user_id := temp_id;
    ELSE
      SELECT id INTO temp_id FROM public.profiles WHERE lower(email) = clean_email LIMIT 1;
      IF temp_id IS NOT NULL THEN
        target_user_id := temp_id;
      END IF;
    END IF;
  END IF;

  -- 3. Tenta por p_user_id se ele próprio for um e-mail
  IF target_user_id IS NULL AND p_user_id IS NOT NULL AND p_user_id LIKE '%@%' THEN
    clean_email := lower(trim(p_user_id));
    SELECT id INTO temp_id FROM auth.users WHERE lower(email) = clean_email LIMIT 1;
    IF temp_id IS NOT NULL THEN
      target_user_id := temp_id;
    ELSE
      SELECT id INTO temp_id FROM public.profiles WHERE lower(email) = clean_email LIMIT 1;
      IF temp_id IS NOT NULL THEN
        target_user_id := temp_id;
      END IF;
    END IF;
  END IF;

  -- 4. Se ainda não achou e a empresa tem admin_email cadastrado
  IF target_user_id IS NULL AND p_org_id IS NOT NULL THEN
    SELECT u.id, lower(o.admin_email) INTO temp_id, temp_email
    FROM public.organizations o
    LEFT JOIN auth.users u ON lower(u.email) = lower(o.admin_email)
    WHERE o.id = p_org_id AND o.admin_email IS NOT NULL AND trim(o.admin_email) <> ''
    LIMIT 1;

    IF temp_id IS NOT NULL THEN
      target_user_id := temp_id;
      IF temp_email IS NOT NULL THEN clean_email := temp_email; END IF;
    ELSIF temp_email IS NOT NULL THEN
      clean_email := temp_email;
    END IF;
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

      -- Garante vínculo na organização se p_org_id for válido
      IF p_org_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id) THEN
        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (p_org_id, target_user_id, 'member')
        ON CONFLICT (organization_id, user_id) DO NOTHING;
      END IF;

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

-- Permissões de execução
GRANT EXECUTE ON FUNCTION public.admin_reset_company_user_password(UUID, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
