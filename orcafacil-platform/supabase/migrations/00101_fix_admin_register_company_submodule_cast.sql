-- Migration 00101: Corrige cast indevido para dashboard_module_code no cadastro de empresas
-- Permite salvar submódulos como 'MOD-01_QUICK_SALE', 'MOD-01_PDV', 'MOD-01_SEARCH', etc.
-- na tabela organization_dashboard_modules (cujo campo module_code é TEXT).

CREATE OR REPLACE FUNCTION public.admin_register_company_with_admin(
  p_org_name TEXT,
  p_org_slug TEXT,
  p_admin_name TEXT,
  p_admin_email TEXT,
  p_admin_password TEXT,
  p_modules TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_trial_days INTEGER DEFAULT 7,
  p_cnpj TEXT DEFAULT NULL,
  p_corporate_name TEXT DEFAULT NULL,
  p_trade_name TEXT DEFAULT NULL,
  p_state_registration TEXT DEFAULT NULL,
  p_municipal_registration TEXT DEFAULT NULL,
  p_responsible_name TEXT DEFAULT NULL,
  p_responsible_cpf TEXT DEFAULT NULL,
  p_whatsapp TEXT DEFAULT NULL,
  p_email_contact TEXT DEFAULT NULL,
  p_address_street TEXT DEFAULT NULL,
  p_address_number TEXT DEFAULT NULL,
  p_address_neighborhood TEXT DEFAULT NULL,
  p_address_city TEXT DEFAULT NULL,
  p_address_state TEXT DEFAULT NULL,
  p_address_postal_code TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  new_org_id UUID;
  target_user_id UUID;
  clean_email TEXT;
  clean_name TEXT;
  encrypted_pw TEXT;
  mod_code TEXT;
  orcafacil_mod_id UUID;
  v_trial_ends_at TIMESTAMPTZ;
BEGIN
  -- Permite apenas ao Proprietário do Sistema
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND lower(email) IN (
      'adm@adm.com',
      'admin@adm.com',
      'proprietario@jbsoftware.com.br',
      'owner@jbsoftware.com.br',
      'bryan@administrador.com',
      'bryanmendes968@gmail.com'
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Proprietário do Sistema pode cadastrar novas empresas.';
  END IF;

  clean_email := lower(trim(p_admin_email));
  clean_name := trim(p_admin_name);

  IF clean_email IS NULL OR clean_email = '' THEN
    RAISE EXCEPTION 'O e-mail do administrador é obrigatório.';
  END IF;

  IF clean_email IN (
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br',
    'bryan@administrador.com',
    'bryanmendes968@gmail.com'
  ) THEN
    RAISE EXCEPTION 'A conta do desenvolvedor do software não pode ser cadastrada como administrador de empresa cliente.';
  END IF;

  IF clean_name IS NULL OR clean_name = '' THEN
    clean_name := 'Administrador';
  END IF;

  IF p_trial_days IS NOT NULL AND p_trial_days > 0 THEN
    v_trial_ends_at := NOW() + (p_trial_days || ' days')::INTERVAL;
  ELSE
    v_trial_ends_at := NULL;
  END IF;

  -- 1. Cria a organização
  INSERT INTO public.organizations (
    name,
    slug,
    is_active,
    trial_ends_at,
    cnpj,
    corporate_name,
    trade_name,
    state_registration,
    municipal_registration,
    responsible_name,
    responsible_cpf,
    whatsapp,
    email_contact,
    address_street,
    address_number,
    address_neighborhood,
    address_city,
    address_state,
    address_postal_code,
    admin_email,
    admin_name
  )
  VALUES (
    trim(p_org_name),
    lower(trim(p_org_slug)),
    true,
    v_trial_ends_at,
    p_cnpj,
    p_corporate_name,
    p_trade_name,
    p_state_registration,
    p_municipal_registration,
    p_responsible_name,
    p_responsible_cpf,
    p_whatsapp,
    p_email_contact,
    p_address_street,
    p_address_number,
    p_address_neighborhood,
    p_address_city,
    p_address_state,
    p_address_postal_code,
    clean_email,
    clean_name
  )
  RETURNING id INTO new_org_id;

  -- 2. Cria ou localiza o usuário administrador da empresa no Supabase Auth
  SELECT id INTO target_user_id FROM auth.users WHERE lower(email) = clean_email LIMIT 1;

  IF target_user_id IS NULL THEN
    target_user_id := gen_random_uuid();
    encrypted_pw := crypt(trim(p_admin_password), gen_salt('bf', 10));

    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      target_user_id,
      '00000000-0000-0000-0000-000000000000',
      clean_email,
      encrypted_pw,
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object('display_name', clean_name),
      NOW(),
      NOW(),
      'authenticated',
      'authenticated'
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

  -- 3. Vincula APENAS o usuário administrador na nova organização
  -- O desenvolvedor / proprietário do sistema NUNCA é vinculado como membro da empresa
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, target_user_id, 'admin')
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET role = 'admin';

  -- 4. Concede módulo JB Software (orcafacil)
  SELECT id INTO orcafacil_mod_id FROM public.modules WHERE code = 'orcafacil' LIMIT 1;
  IF orcafacil_mod_id IS NOT NULL THEN
    INSERT INTO public.organization_modules (organization_id, module_id, status)
    VALUES (new_org_id, orcafacil_mod_id, 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  -- 5. Grava os módulos do painel permitidos para a empresa (incluindo submódulos como MOD-01_QUICK_SALE)
  IF p_modules IS NOT NULL AND cardinality(p_modules) > 0 THEN
    FOREACH mod_code IN ARRAY p_modules LOOP
      INSERT INTO public.organization_dashboard_modules (organization_id, module_code)
      VALUES (new_org_id, mod_code)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'organizationId', new_org_id,
    'userId', target_user_id,
    'adminEmail', clean_email,
    'adminName', clean_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_register_company_with_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_register_company_with_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_register_company_with_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
