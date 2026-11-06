-- ==============================================================================
-- MIGRAÇÃO 00057: AUTO-VÍNCULO DO ADMINISTRADOR E PERSISTÊNCIA DAS PÁGINAS DA EMPRESA
-- Garante que o administrador cadastrado pelo proprietário tenha acesso imediato
-- e automático à empresa e aos módulos liberados no painel.
-- ==============================================================================

-- 1. Colunas de e-mail e nome do administrador na organização
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS admin_email TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS admin_name TEXT;

-- Popula dados para organizações existentes
UPDATE public.organizations o
SET admin_email = sub.email,
    admin_name = sub.display_name
FROM (
  SELECT DISTINCT ON (om.organization_id)
    om.organization_id,
    p.email,
    p.display_name
  FROM public.organization_members om
  JOIN public.profiles p ON p.id = om.user_id
  WHERE om.role IN ('admin', 'owner')
  ORDER BY om.organization_id, CASE WHEN om.role = 'owner' THEN 1 ELSE 2 END, om.created_at ASC
) sub
WHERE o.id = sub.organization_id
  AND (o.admin_email IS NULL OR o.admin_email = '');

-- 2. Atualiza a política de SELECT de organizations para permitir acesso por admin_email
DROP POLICY IF EXISTS "Membros podem ver suas organizações" ON public.organizations;
CREATE POLICY "Membros podem ver suas organizações"
  ON public.organizations FOR SELECT
  USING (
    public.is_org_member(id, auth.uid())
    OR lower(COALESCE(admin_email, '')) = lower(COALESCE(auth.jwt()->>'email', ''))
  );

-- 3. Atualiza a política de SELECT de organization_dashboard_modules
DROP POLICY IF EXISTS "Membros podem ver módulos da sua organização" ON public.organization_dashboard_modules;
CREATE POLICY "Membros podem ver módulos da sua organização"
  ON public.organization_dashboard_modules FOR SELECT
  USING (
    public.is_org_member(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_dashboard_modules.organization_id
        AND lower(COALESCE(o.admin_email, '')) = lower(COALESCE(auth.jwt()->>'email', ''))
    )
  );

-- 4. Função RPC para garantir vínculo de membro e retornar organizações do usuário autenticado
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

  -- 2. Retorna a lista de empresas
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

-- 5. Atualiza a RPC admin_register_company_with_admin para salvar admin_email e admin_name
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
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'owner'
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
  SELECT id INTO target_user_id FROM auth.users WHERE lower(email) = clean_email;

  IF target_user_id IS NULL THEN
    IF p_admin_password IS NULL OR length(trim(p_admin_password)) < 6 THEN
      RAISE EXCEPTION 'A senha inicial deve ter no mínimo 6 caracteres.';
    END IF;

    encrypted_pw := crypt(trim(p_admin_password), gen_salt('bf', 10));
    target_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      phone_change_token,
      phone_change,
      reauthentication_token,
      email_change_token_current,
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
      NOW(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
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
          confirmed_at = COALESCE(confirmed_at, NOW()),
          updated_at = NOW()
      WHERE id = target_user_id;
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

  -- Vincula também o proprietário mestre
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, auth.uid(), 'owner')
  ON CONFLICT DO NOTHING;

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

  RETURN json_build_object(
    'success', true,
    'organizationId', new_org_id,
    'adminUserId', target_user_id,
    'slug', clean_slug
  );
END;
$$;

-- 6. Atualiza admin_update_full_company_details para manter admin_email e admin_name sincronizados
CREATE OR REPLACE FUNCTION public.admin_update_full_company_details(
  p_org_id UUID,
  p_name TEXT,
  p_slug TEXT,
  p_is_active BOOLEAN DEFAULT NULL,
  p_trial_ends_at TIMESTAMPTZ DEFAULT NULL,
  p_admin_name TEXT DEFAULT NULL,
  p_admin_email TEXT DEFAULT NULL,
  p_admin_password TEXT DEFAULT NULL,
  p_modules TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  clean_name TEXT := trim(p_name);
  clean_slug TEXT := lower(trim(p_slug));
  clean_admin_name TEXT := trim(p_admin_name);
  clean_admin_email TEXT := lower(trim(p_admin_email));
  target_admin_id UUID;
  encrypted_pw TEXT;
  mod_code TEXT;
  orcafacil_mod_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Proprietário pode editar empresas cadastradas.';
  END IF;

  IF length(clean_name) < 2 THEN
    RAISE EXCEPTION 'O nome da empresa deve ter pelo menos 2 caracteres.';
  END IF;

  IF clean_slug !~ '^[a-z0-9-]+$' THEN
    RAISE EXCEPTION 'O identificador deve conter apenas letras minúsculas, números e hífens.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organizations
    WHERE slug = clean_slug AND id <> p_org_id
  ) THEN
    RAISE EXCEPTION 'O identificador "%" já está em uso por outra empresa.', clean_slug;
  END IF;

  -- 1. Atualiza dados da organização incluindo admin_email e admin_name
  UPDATE public.organizations
  SET name = clean_name,
      slug = clean_slug,
      is_active = COALESCE(p_is_active, is_active, true),
      trial_ends_at = p_trial_ends_at,
      admin_email = COALESCE(NULLIF(clean_admin_email, ''), admin_email),
      admin_name = COALESCE(NULLIF(clean_admin_name, ''), admin_name),
      updated_at = NOW()
  WHERE id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A empresa não foi encontrada.';
  END IF;

  -- 2. Localiza ou cria vínculo do administrador da empresa
  IF clean_admin_email IS NOT NULL AND clean_admin_email <> '' THEN
    SELECT id INTO target_admin_id FROM auth.users WHERE lower(email) = clean_admin_email;
    IF target_admin_id IS NULL THEN
      SELECT om.user_id INTO target_admin_id
      FROM public.organization_members om
      WHERE om.organization_id = p_org_id
        AND om.role IN ('admin', 'owner')
        AND om.user_id <> auth.uid()
      ORDER BY om.created_at ASC
      LIMIT 1;
    END IF;

    IF target_admin_id IS NOT NULL THEN
      -- Garante vínculo no organization_members com role admin
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (p_org_id, target_admin_id, 'admin')
      ON CONFLICT (organization_id, user_id) DO UPDATE
      SET role = 'admin';

      -- Atualiza perfil
      UPDATE public.profiles
      SET display_name = COALESCE(NULLIF(clean_admin_name, ''), display_name),
          email = COALESCE(NULLIF(clean_admin_email, ''), email),
          updated_at = NOW()
      WHERE id = target_admin_id;

      -- Atualiza senha se fornecida
      IF p_admin_password IS NOT NULL AND length(trim(p_admin_password)) >= 6 THEN
        encrypted_pw := crypt(trim(p_admin_password), gen_salt('bf', 10));
        UPDATE auth.users
        SET encrypted_password = encrypted_pw,
            updated_at = NOW()
        WHERE id = target_admin_id;
      END IF;
    END IF;
  END IF;

  -- 3. Garante módulo orcafacil ativo
  SELECT id INTO orcafacil_mod_id FROM public.modules WHERE code = 'orcafacil' LIMIT 1;
  IF orcafacil_mod_id IS NOT NULL THEN
    INSERT INTO public.organization_modules (organization_id, module_id, status)
    VALUES (p_org_id, orcafacil_mod_id, 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  -- 4. Atualiza os módulos do painel permitidos para a empresa
  IF p_modules IS NOT NULL THEN
    DELETE FROM public.organization_dashboard_modules WHERE organization_id = p_org_id;
    FOREACH mod_code IN ARRAY p_modules LOOP
      INSERT INTO public.organization_dashboard_modules (organization_id, module_code)
      VALUES (p_org_id, mod_code)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_org_id,
    'name', clean_name,
    'slug', clean_slug
  );
END;
$$;

