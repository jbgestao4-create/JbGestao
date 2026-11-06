-- Migration 00066: Desvincula a conta do Desenvolvedor (Proprietário do Sistema) de todas as organizações
-- Garante que a conta proprietário seja exclusiva para gerenciamento do sistema e testes irrestritos,
-- sem pertencer nem constar na lista de membros de nenhuma organização.

-- 1. Remove qualquer vínculo prévio da conta do Desenvolvedor / Proprietário da tabela organization_members
DELETE FROM public.organization_member_dashboard_modules
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE lower(email) IN (
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br',
    'bryan@administrador.com',
    'bryanmendes968@gmail.com'
  )
);

DELETE FROM public.organization_member_modules
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE lower(email) IN (
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br',
    'bryan@administrador.com',
    'bryanmendes968@gmail.com'
  )
);

DELETE FROM public.organization_members
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE lower(email) IN (
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br',
    'bryan@administrador.com',
    'bryanmendes968@gmail.com'
  )
);

-- 2. Gatilho preventivo: impede que o desenvolvedor seja adicionado a organization_members
CREATE OR REPLACE FUNCTION public.check_developer_not_organization_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = NEW.user_id LIMIT 1;
  IF v_email IS NOT NULL AND v_email IN (
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br',
    'bryan@administrador.com',
    'bryanmendes968@gmail.com'
  ) THEN
    -- Cancela o INSERT/UPDATE do desenvolvedor como membro de empresa
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_developer_org_member ON public.organization_members;
CREATE TRIGGER trg_prevent_developer_org_member
  BEFORE INSERT OR UPDATE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_developer_not_organization_member();

-- 3. Atualiza admin_register_company_with_admin para NÃO vincular o desenvolvedor como membro
CREATE OR REPLACE FUNCTION public.admin_register_company_with_admin(
  p_org_name TEXT,
  p_org_slug TEXT,
  p_admin_name TEXT,
  p_admin_email TEXT,
  p_admin_password TEXT,
  p_modules TEXT[],
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
    encrypted_pw := crypt(COALESCE(NULLIF(trim(p_admin_password), ''), 'Senha@123456'), gen_salt('bf', 10));

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
  -- NOTA: O desenvolvedor / proprietário do sistema NUNCA é vinculado como membro da empresa!
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

  -- 5. Grava os módulos do painel permitidos para a empresa
  IF p_modules IS NOT NULL AND cardinality(p_modules) > 0 THEN
    FOREACH mod_code IN ARRAY p_modules LOOP
      INSERT INTO public.organization_dashboard_modules (organization_id, module_code)
      VALUES (new_org_id, mod_code::dashboard_module_code)
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

-- 4. Atualiza ensure_user_company_access: Desenvolvedor acessa todas as empresas sem vínculos em organization_members
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

  -- Se for o Desenvolvedor / Proprietário do Sistema:
  -- Tem acesso a TODAS as organizações para testes e gerenciamento sem pertencer a nenhuma
  IF v_is_owner THEN
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

  -- Para usuários normais ou administradores de empresas clientes:
  -- 1. Auto-vincula o usuário como admin nas organizações onde ele foi explicitamente cadastrado como admin_email
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

-- 5. Atualiza admin_get_company_users para NUNCA exibir a conta do desenvolvedor na listagem de usuários de nenhuma empresa
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

-- 6. Atualiza get_organization_members_with_details para também ocultar o desenvolvedor
CREATE OR REPLACE FUNCTION public.get_organization_members_with_details(p_org_id UUID)
RETURNS TABLE (
  user_id UUID,
  organization_id UUID,
  role organization_role,
  display_name TEXT,
  email TEXT,
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
  GROUP BY om.user_id, om.organization_id, om.role, p.display_name, p.email, om.created_at
  ORDER BY
    CASE om.role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      ELSE 3
    END,
    om.created_at ASC;
END;
$$;

-- 7. Garante permissões de execução
GRANT EXECUTE ON FUNCTION public.ensure_user_company_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_company_users(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_members_with_details(UUID) TO authenticated;
