-- ==============================================================================
-- MIGRAÇÃO 00003: GESTÃO DE FUNCIONÁRIOS / MEMBROS E PERMISSÕES DE MÓDULOS
-- ==============================================================================

-- 1. Adiciona coluna de e-mail na tabela profiles se ainda não existir
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Atualiza e-mails dos usuários existentes
DO $$
BEGIN
  UPDATE public.profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Atualiza trigger de novos usuários para salvar o email no perfil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      display_name = COALESCE(profiles.display_name, EXCLUDED.display_name);
  RETURN NEW;
END;
$$;

-- 2. Tabela de permissões de módulos por membro
CREATE TABLE IF NOT EXISTS public.organization_member_modules (
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  module_code module_code NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id, module_code),
  FOREIGN KEY (organization_id, user_id)
    REFERENCES public.organization_members(organization_id, user_id) ON DELETE CASCADE
);

ALTER TABLE public.organization_member_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros podem ver permissões de módulos de sua organização" ON public.organization_member_modules;
CREATE POLICY "Membros podem ver permissões de módulos de sua organização"
  ON public.organization_member_modules FOR SELECT
  USING (
    public.is_org_member(organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "Admins podem gerenciar permissões de módulos de membros" ON public.organization_member_modules;
CREATE POLICY "Admins podem gerenciar permissões de módulos de membros"
  ON public.organization_member_modules FOR ALL
  USING (
    public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
  );

-- 3. Função para listar membros com detalhes de perfil e permissões de módulos
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
SET search_path = public
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

-- 4. Função atômica para cadastrar funcionário / membro e suas permissões
CREATE OR REPLACE FUNCTION public.add_organization_member(
  p_org_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_password TEXT,
  p_role organization_role,
  p_modules module_code[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_role organization_role;
  target_user_id UUID;
  mod_code module_code;
  clean_email TEXT;
  clean_name TEXT;
  encrypted_pw TEXT;
BEGIN
  clean_email := lower(trim(p_email));
  clean_name := trim(p_name);

  -- 1. Verifica privilégios do chamador
  caller_role := public.get_user_organization_role(p_org_id, auth.uid());
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Apenas proprietários e administradores podem adicionar membros.';
  END IF;

  IF p_role = 'owner' AND caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Apenas o proprietário pode designar outro proprietário.';
  END IF;

  -- 2. Localiza ou cria a conta em auth.users
  SELECT id INTO target_user_id FROM auth.users WHERE lower(email) = clean_email;

  IF target_user_id IS NULL THEN
    IF p_password IS NULL OR length(trim(p_password)) < 6 THEN
      RAISE EXCEPTION 'Para novos funcionários, forneça uma senha de no mínimo 6 caracteres.';
    END IF;

    encrypted_pw := crypt(trim(p_password), gen_salt('bf'));
    target_user_id := gen_random_uuid();

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
      '{"provider":"email","providers":["email"]}'::jsonb,
      json_build_object('display_name', clean_name)::jsonb,
      NOW(),
      NOW()
    );

    INSERT INTO public.profiles (id, display_name, email)
    VALUES (target_user_id, clean_name, clean_email)
    ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name, email = EXCLUDED.email;
  ELSE
    UPDATE public.profiles
    SET display_name = COALESCE(NULLIF(display_name, ''), clean_name),
        email = clean_email
    WHERE id = target_user_id;
  END IF;

  -- 3. Verifica se já pertence à organização
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = target_user_id
  ) THEN
    RAISE EXCEPTION 'O usuário % já é membro desta organização.', clean_email;
  END IF;

  -- 4. Associa o membro
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (p_org_id, target_user_id, p_role);

  -- 5. Grava permissões de módulos
  IF p_modules IS NOT NULL THEN
    FOREACH mod_code IN ARRAY p_modules
    LOOP
      INSERT INTO public.organization_member_modules (organization_id, user_id, module_code)
      VALUES (p_org_id, target_user_id, mod_code)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN json_build_object(
    'success', true,
    'userId', target_user_id,
    'email', clean_email,
    'name', clean_name,
    'role', p_role
  );
END;
$$;

-- 5. Função para remover membro da organização
CREATE OR REPLACE FUNCTION public.remove_organization_member(
  p_org_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role organization_role;
  target_role organization_role;
BEGIN
  caller_role := public.get_user_organization_role(p_org_id, auth.uid());
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Apenas proprietários e administradores podem remover membros.';
  END IF;

  SELECT role INTO target_role
  FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'O proprietário da organização não pode ser removido.';
  END IF;

  IF target_role = 'admin' AND caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Apenas o proprietário pode remover administradores.';
  END IF;

  DELETE FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  RETURN true;
END;
$$;

-- 6. Função para atualizar as permissões de módulos de um membro
CREATE OR REPLACE FUNCTION public.update_member_modules(
  p_org_id UUID,
  p_user_id UUID,
  p_modules module_code[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role organization_role;
  mod_code module_code;
BEGIN
  caller_role := public.get_user_organization_role(p_org_id, auth.uid());
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Apenas proprietários e administradores podem alterar permissões.';
  END IF;

  DELETE FROM public.organization_member_modules
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  IF p_modules IS NOT NULL THEN
    FOREACH mod_code IN ARRAY p_modules
    LOOP
      INSERT INTO public.organization_member_modules (organization_id, user_id, module_code)
      VALUES (p_org_id, p_user_id, mod_code)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN true;
END;
$$;

