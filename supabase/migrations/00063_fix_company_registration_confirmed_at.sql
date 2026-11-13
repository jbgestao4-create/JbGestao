-- Migration 00063: Correção da coluna gerada confirmed_at no cadastro de empresas

CREATE OR REPLACE FUNCTION public.admin_register_company_with_admin(
  p_org_name TEXT,
  p_org_slug TEXT,
  p_admin_name TEXT,
  p_admin_email TEXT,
  p_admin_password TEXT,
  p_modules TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  new_org_id UUID;
  target_user_id UUID;
  clean_email TEXT;
  clean_name TEXT;
  clean_slug TEXT;
  clean_org_name TEXT;
  encrypted_pw TEXT;
  mod_code TEXT;
  orcafacil_mod_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'owner'
  ) AND NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND lower(email) IN (
      'adm@adm.com', 'admin@adm.com', 'proprietario@jbsoftware.com.br',
      'owner@jbsoftware.com.br', 'bryan@administrador.com', 'bryanmendes968@gmail.com'
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Proprietário pode cadastrar novas empresas.';
  END IF;

  clean_email := lower(trim(p_admin_email));
  clean_name := trim(p_admin_name);
  clean_org_name := trim(p_org_name);
  clean_slug := lower(trim(p_org_slug));

  IF length(clean_org_name) < 2 THEN
    RAISE EXCEPTION 'O nome da empresa deve ter pelo menos 2 caracteres.';
  END IF;

  IF clean_slug !~ '^[a-z0-9-]+$' THEN
    RAISE EXCEPTION 'O identificador único (slug) deve conter apenas letras minúsculas, números e traços.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = clean_slug) THEN
    RAISE EXCEPTION 'O identificador único (slug) "%" já está em uso por outra empresa cadastrada.', clean_slug;
  END IF;

  IF length(clean_name) < 2 THEN
    RAISE EXCEPTION 'O nome do administrador deve ter pelo menos 2 caracteres.';
  END IF;

  IF clean_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'E-mail do administrador inválido.';
  END IF;

  -- 1. Cria a organização com admin_email e admin_name registrados
  INSERT INTO public.organizations (name, slug, is_active, admin_email, admin_name)
  VALUES (clean_org_name, clean_slug, true, clean_email, clean_name)
  RETURNING id INTO new_org_id;

  -- 2. Localiza ou cria a conta do administrador
  SELECT id INTO target_user_id FROM auth.users WHERE lower(email) = clean_email LIMIT 1;

  IF target_user_id IS NULL THEN
    IF p_admin_password IS NULL OR length(trim(p_admin_password)) < 6 THEN
      RAISE EXCEPTION 'A senha inicial deve ter no mínimo 6 caracteres.';
    END IF;

    encrypted_pw := crypt(trim(p_admin_password), gen_salt('bf', 10));
    target_user_id := gen_random_uuid();

    -- Inserção segura em auth.users sem confirmed_at (coluna gerada automaticamente no Supabase)
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_sso_user,
      is_anonymous,
      created_at,
      updated_at
    ) VALUES (
      target_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      clean_email,
      encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('display_name', clean_name, 'sub', target_user_id::text, 'email', clean_email),
      false,
      false,
      NOW(),
      NOW()
    );

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
  ELSE
    IF p_admin_password IS NOT NULL AND length(trim(p_admin_password)) >= 6 THEN
      encrypted_pw := crypt(trim(p_admin_password), gen_salt('bf', 10));
      UPDATE auth.users
      SET encrypted_password = encrypted_pw,
          email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
          updated_at = NOW()
      WHERE id = target_user_id;

      IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = target_user_id AND provider = 'email') THEN
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
      END IF;
    END IF;
  END IF;

  -- Perfil
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (target_user_id, clean_name, clean_email)
  ON CONFLICT (id) DO UPDATE
  SET display_name = COALESCE(NULLIF(profiles.display_name, ''), EXCLUDED.display_name),
      email = EXCLUDED.email;

  -- 3. Vincula o usuário como 'admin' na nova organização
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, target_user_id, 'admin')
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET role = 'admin';

  -- Vincula também o proprietário mestre se logado
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, auth.uid(), 'owner')
    ON CONFLICT DO NOTHING;
  END IF;

  -- 4. Concede módulo JB Software (orcafacil)
  SELECT id INTO orcafacil_mod_id FROM public.modules WHERE code = 'orcafacil' LIMIT 1;
  IF orcafacil_mod_id IS NOT NULL THEN
    INSERT INTO public.organization_modules (organization_id, module_id, status)
    VALUES (new_org_id, orcafacil_mod_id, 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  -- 5. Grava os módulos do painel permitidos para a empresa
  IF p_modules IS NOT NULL AND cardinality(p_modules) > 0 THEN
    FOREACH mod_code IN ARRAY p_modules LOOP
      INSERT INTO public.organization_dashboard_modules (organization_id, module_code)
      VALUES (new_org_id, mod_code)
      ON CONFLICT DO NOTHING;
    END LOOP;
  ELSE
    INSERT INTO public.organization_dashboard_modules (organization_id, module_code)
    VALUES
      (new_org_id, 'MOD-01'), (new_org_id, 'MOD-02'), (new_org_id, 'MOD-03'),
      (new_org_id, 'MOD-04'), (new_org_id, 'MOD-05'), (new_org_id, 'MOD-06'),
      (new_org_id, 'MOD-07'), (new_org_id, 'MOD-08'), (new_org_id, 'MOD-09'),
      (new_org_id, 'MOD-10')
    ON CONFLICT DO NOTHING;
  END IF;

  -- 6. Assinatura gratuita padrão
  INSERT INTO public.subscriptions (organization_id, plan_id, status)
  VALUES (new_org_id, 'free', 'active')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'organizationId', new_org_id,
    'slug', clean_slug,
    'adminUserId', target_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_register_company_with_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated, service_role;

