-- ==============================================================================
-- MIGRAÇÃO 00053: GERENCIAMENTO DE EMPRESAS CADASTRADAS E CONTROLE DE ACESSO
-- Permite ao Proprietário gerenciar o status de ativação das empresas,
-- controlar módulos/páginas por Identificador Único (Slug) e cadastrar novas empresas
-- com administradores diretamente pelo painel restrito.
-- ==============================================================================

-- 1. Adiciona coluna is_active à tabela organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Tabela de módulos/páginas liberadas no painel por organização
CREATE TABLE IF NOT EXISTS public.organization_dashboard_modules (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, module_code)
);

ALTER TABLE public.organization_dashboard_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros podem ver módulos da sua organização" ON public.organization_dashboard_modules;
CREATE POLICY "Membros podem ver módulos da sua organização"
  ON public.organization_dashboard_modules FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Proprietários podem gerenciar módulos de organizações" ON public.organization_dashboard_modules;
CREATE POLICY "Proprietários podem gerenciar módulos de organizações"
  ON public.organization_dashboard_modules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Popula módulos padrão para as empresas existentes
INSERT INTO public.organization_dashboard_modules (organization_id, module_code)
SELECT o.id, m.code
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('MOD-01'), ('MOD-02'), ('MOD-03'), ('MOD-04'), ('MOD-05'),
    ('MOD-06'), ('MOD-07'), ('MOD-08'), ('MOD-09'), ('MOD-10')
) AS m(code)
ON CONFLICT DO NOTHING;

-- 3. Função para listar todas as empresas cadastradas com administrador e módulos (Restrita ao Proprietário)
CREATE OR REPLACE FUNCTION public.admin_get_all_organizations()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  admin_email TEXT,
  admin_name TEXT,
  members_count BIGINT,
  modules TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Proprietário pode acessar a gestão de empresas.';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    COALESCE(o.is_active, true) AS is_active,
    o.created_at,
    COALESCE(
      (
        SELECT p.email
        FROM public.organization_members om
        JOIN public.profiles p ON p.id = om.user_id
        WHERE om.organization_id = o.id AND om.role IN ('admin', 'owner')
        ORDER BY CASE WHEN om.role = 'owner' THEN 1 ELSE 2 END, om.created_at ASC
        LIMIT 1
      ),
      ''
    ) AS admin_email,
    COALESCE(
      (
        SELECT p.display_name
        FROM public.organization_members om
        JOIN public.profiles p ON p.id = om.user_id
        WHERE om.organization_id = o.id AND om.role IN ('admin', 'owner')
        ORDER BY CASE WHEN om.role = 'owner' THEN 1 ELSE 2 END, om.created_at ASC
        LIMIT 1
      ),
      'Administrador'
    ) AS admin_name,
    (
      SELECT COUNT(*)::BIGINT
      FROM public.organization_members om
      WHERE om.organization_id = o.id
    ) AS members_count,
    COALESCE(
      (
        SELECT array_agg(odm.module_code ORDER BY odm.module_code)
        FROM public.organization_dashboard_modules odm
        WHERE odm.organization_id = o.id
      ),
      ARRAY['MOD-01','MOD-02','MOD-03','MOD-04','MOD-05','MOD-06','MOD-07','MOD-08','MOD-09','MOD-10']::TEXT[]
    ) AS modules
  FROM public.organizations o
  ORDER BY o.created_at DESC;
END;
$$;

-- 4. Função para ativar ou desativar o acesso de uma empresa (Restrita ao Proprietário)
CREATE OR REPLACE FUNCTION public.admin_set_organization_active(
  p_org_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Proprietário pode alterar o status da empresa.';
  END IF;

  UPDATE public.organizations
  SET is_active = p_is_active,
      updated_at = NOW()
  WHERE id = p_org_id;

  RETURN json_build_object('success', true, 'is_active', p_is_active);
END;
$$;

-- 5. Função para atualizar os módulos permitidos de uma empresa (Restrita ao Proprietário)
CREATE OR REPLACE FUNCTION public.admin_update_organization_modules(
  p_org_id UUID,
  p_modules TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mod_code TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Proprietário pode alterar os módulos da empresa.';
  END IF;

  DELETE FROM public.organization_dashboard_modules
  WHERE organization_id = p_org_id;

  IF p_modules IS NOT NULL THEN
    FOREACH mod_code IN ARRAY p_modules LOOP
      INSERT INTO public.organization_dashboard_modules (organization_id, module_code)
      VALUES (p_org_id, mod_code)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- 6. Função para cadastrar nova empresa com administrador e permissões de módulos (Restrita ao Proprietário)
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

  -- 1. Cria a organização
  INSERT INTO public.organizations (name, slug, is_active)
  VALUES (clean_org_name, clean_slug, true)
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
    -- Se o usuário já existe, atualiza senha fornecida e garante confirmação de login
    IF p_admin_password IS NOT NULL AND length(trim(p_admin_password)) >= 6 THEN
      encrypted_pw := crypt(trim(p_admin_password), gen_salt('bf', 10));
      UPDATE auth.users
      SET encrypted_password = encrypted_pw,
          email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
          confirmed_at = COALESCE(confirmed_at, NOW()),
          confirmation_token = COALESCE(confirmation_token, ''),
          recovery_token = COALESCE(recovery_token, ''),
          email_change_token_new = COALESCE(email_change_token_new, ''),
          email_change = COALESCE(email_change, ''),
          phone_change_token = COALESCE(phone_change_token, ''),
          phone_change = COALESCE(phone_change, ''),
          reauthentication_token = COALESCE(reauthentication_token, ''),
          email_change_token_current = COALESCE(email_change_token_current, ''),
          updated_at = NOW()
      WHERE id = target_user_id;
    END IF;

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
        jsonb_build_object('sub', target_user_id::text, 'email', clean_email),
        'email',
        target_user_id::text,
        NOW(),
        NOW(),
        NOW()
      );
    END IF;
  END IF;

  -- Perfil
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (target_user_id, clean_name, clean_email)
  ON CONFLICT (id) DO UPDATE
  SET display_name = COALESCE(NULLIF(profiles.display_name, ''), EXCLUDED.display_name),
      email = EXCLUDED.email;

  -- 3. Vincula o usuário como 'admin' na nova organização (permissão de Administrador)
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, target_user_id, 'admin')
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET role = 'admin';

  -- Vincula também o proprietário mestre para gestão
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

  -- 6. Assinatura gratuita
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

