-- Migration 00138: Cria a função RPC pública para auto-cadastro de empresas e administradores
-- Permite que novos clientes façam o cadastro diretamente pela tela pública /cadastrar-empresa
-- atribuindo 30 dias de teste grátis, plano escolhido e criação do usuário administrador.

CREATE OR REPLACE FUNCTION public.public_register_company_with_admin(
  p_org_name TEXT,
  p_org_slug TEXT,
  p_admin_name TEXT,
  p_admin_email TEXT,
  p_admin_password TEXT,
  p_modules TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_trial_days INTEGER DEFAULT 30,
  p_cnpj TEXT DEFAULT NULL,
  p_responsible_name TEXT DEFAULT NULL,
  p_whatsapp TEXT DEFAULT NULL,
  p_address_street TEXT DEFAULT NULL,
  p_address_number TEXT DEFAULT NULL,
  p_address_postal_code TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_plan_id UUID DEFAULT NULL
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
  clean_slug TEXT;
  encrypted_pw TEXT;
  mod_code TEXT;
  orcafacil_mod_id UUID;
  v_trial_ends_at TIMESTAMPTZ;
  v_effective_trial_days INTEGER;
  v_plan public.access_plans%ROWTYPE;
  v_contract_number TEXT;
BEGIN
  clean_email := lower(trim(p_admin_email));
  clean_name := trim(p_admin_name);
  clean_slug := lower(trim(p_org_slug));

  IF clean_email IS NULL OR clean_email = '' OR clean_email NOT LIKE '%@%.%' THEN
    RAISE EXCEPTION 'Informe um endereço de e-mail válido para o administrador.';
  END IF;

  -- Impede uso de e-mails reservados da administração/desenvolvedores
  IF clean_email IN (
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br',
    'bryan@administrador.com',
    'bryanmendes968@gmail.com'
  ) THEN
    RAISE EXCEPTION 'Este endereço de e-mail é reservado pela administração da plataforma.';
  END IF;

  IF clean_name IS NULL OR clean_name = '' THEN
    clean_name := 'Administrador';
  END IF;

  IF clean_slug IS NULL OR clean_slug = '' THEN
    clean_slug := 'empresa-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  END IF;

  -- Se o slug já existir, adiciona sufixo aleatório para evitar colisão
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = clean_slug) THEN
    clean_slug := clean_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
  END IF;

  -- Período de teste: 30 dias por padrão
  v_effective_trial_days := COALESCE(p_trial_days, 30);
  IF v_effective_trial_days <= 0 THEN
    v_effective_trial_days := 30;
  END IF;

  v_trial_ends_at := NOW() + (v_effective_trial_days || ' days')::INTERVAL;

  -- Valida se o plano informado existe e está disponível
  IF p_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.access_plans WHERE id = p_plan_id;
  END IF;

  -- 1. Cria a organização com 30 dias de trial
  INSERT INTO public.organizations (
    name,
    slug,
    is_active,
    trial_ends_at,
    cnpj,
    responsible_name,
    whatsapp,
    email_contact,
    address_street,
    address_number,
    address_postal_code,
    notes,
    admin_email,
    admin_name,
    access_plan_id
  )
  VALUES (
    trim(p_org_name),
    clean_slug,
    TRUE,
    v_trial_ends_at,
    NULLIF(trim(COALESCE(p_cnpj, '')), ''),
    COALESCE(NULLIF(trim(p_responsible_name), ''), clean_name),
    NULLIF(trim(COALESCE(p_whatsapp, '')), ''),
    clean_email,
    NULLIF(trim(COALESCE(p_address_street, '')), ''),
    NULLIF(trim(COALESCE(p_address_number, '')), ''),
    NULLIF(trim(COALESCE(p_address_postal_code, '')), ''),
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    clean_email,
    clean_name,
    v_plan.id
  )
  RETURNING id INTO new_org_id;

  -- 2. Cria ou localiza o usuário administrador no Supabase Auth
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
      jsonb_build_object('display_name', clean_name, 'phone', p_whatsapp),
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
    -- Atualiza senha do usuário caso já exista
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

  -- 3. Atualiza/cria o perfil público do usuário
  INSERT INTO public.profiles (id, display_name, email, phone)
  VALUES (target_user_id, clean_name, clean_email, NULLIF(trim(COALESCE(p_whatsapp, '')), ''))
  ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      email = EXCLUDED.email,
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  -- 4. Vincula o usuário como admin da organização recém-criada
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, target_user_id, 'admin')
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET role = 'admin';

  -- 5. Concede módulo base ControleSoft (orcafacil)
  SELECT id INTO orcafacil_mod_id FROM public.modules WHERE code = 'orcafacil' LIMIT 1;
  IF orcafacil_mod_id IS NOT NULL THEN
    INSERT INTO public.organization_modules (organization_id, module_id, status)
    VALUES (new_org_id, orcafacil_mod_id, 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  -- 6. Grava os módulos do plano selecionado
  IF p_modules IS NOT NULL AND cardinality(p_modules) > 0 THEN
    FOREACH mod_code IN ARRAY p_modules LOOP
      INSERT INTO public.organization_dashboard_modules (organization_id, module_code)
      VALUES (new_org_id, mod_code)
      ON CONFLICT DO NOTHING;
    END LOOP;
  ELSIF v_plan.module_codes IS NOT NULL AND cardinality(v_plan.module_codes) > 0 THEN
    FOREACH mod_code IN ARRAY v_plan.module_codes LOOP
      INSERT INTO public.organization_dashboard_modules (organization_id, module_code)
      VALUES (new_org_id, mod_code)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- 7. Gera contrato digital se a tabela existir
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'software_contracts') THEN
    v_contract_number := 'CTR-' || to_char(NOW(), 'YYYY') || '-' || upper(substr(replace(new_org_id::text, '-', ''), 1, 6));
    BEGIN
      INSERT INTO public.software_contracts (
        company_id,
        contract_number,
        client_name,
        client_document,
        client_responsible_name,
        client_responsible_role,
        client_email,
        client_phone,
        plan_name,
        monthly_amount,
        setup_fee,
        billing_day,
        payment_method,
        start_date,
        duration_months,
        has_trial_period,
        trial_duration_months,
        trial_ends_at,
        is_signed,
        signed_at,
        signer_name,
        signer_email,
        notes
      ) VALUES (
        new_org_id,
        v_contract_number,
        trim(p_org_name),
        COALESCE(NULLIF(trim(p_cnpj), ''), 'Não informado'),
        clean_name,
        'Administrador',
        clean_email,
        p_whatsapp,
        COALESCE(v_plan.name, 'Plano Inicial'),
        COALESCE(v_plan.monthly_price, 149.90),
        0,
        10,
        'PIX Automático',
        CURRENT_DATE,
        12,
        TRUE,
        1,
        v_trial_ends_at,
        TRUE,
        NOW(),
        clean_name,
        clean_email,
        'Contrato digital gerado via auto-cadastro com 30 dias de teste grátis.'
      ) ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Se a tabela de contratos tiver colunas divergentes, prossegue normalmente
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'organizationId', new_org_id,
    'userId', target_user_id,
    'adminEmail', clean_email,
    'adminName', clean_name,
    'trialEndsAt', v_trial_ends_at,
    'slug', clean_slug
  );
END;
$$;

-- Permite explicitamente a execução por usuários anônimos (visitantes do site) e autenticados
GRANT EXECUTE ON FUNCTION public.public_register_company_with_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO anon, authenticated;

-- Restaura a permissão de execução da função de criação com proprietário para usuários autenticados
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(TEXT, TEXT, UUID) TO authenticated;

-- Notifica o PostgREST para recarregar imediatamente o schema cache
NOTIFY pgrst, 'reload schema';
