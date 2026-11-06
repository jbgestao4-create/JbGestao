-- Migração 00056: Edição Completa da Empresa e Controle Estrito do Proprietário do Sistema
-- Permite ao Proprietário atualizar todos os dados da empresa (nome, slug, status, período de teste, administrador e páginas)

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

  -- 1. Atualiza dados da organização
  UPDATE public.organizations
  SET name = clean_name,
      slug = clean_slug,
      is_active = COALESCE(p_is_active, is_active, true),
      trial_ends_at = p_trial_ends_at,
      updated_at = NOW()
  WHERE id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A empresa não foi encontrada.';
  END IF;

  -- 2. Localiza e atualiza o administrador da empresa (se informado)
  SELECT om.user_id INTO target_admin_id
  FROM public.organization_members om
  WHERE om.organization_id = p_org_id
    AND om.role IN ('admin', 'owner')
    AND om.user_id <> auth.uid()
  ORDER BY om.created_at ASC
  LIMIT 1;

  IF target_admin_id IS NOT NULL THEN
    -- Atualiza profile
    UPDATE public.profiles
    SET display_name = COALESCE(NULLIF(clean_admin_name, ''), display_name),
        email = COALESCE(NULLIF(clean_admin_email, ''), email),
        updated_at = NOW()
    WHERE id = target_admin_id;

    -- Atualiza e-mail no auth.users
    IF clean_admin_email IS NOT NULL AND clean_admin_email <> '' THEN
      UPDATE auth.users
      SET email = clean_admin_email,
          raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
            'display_name', clean_admin_name,
            'email', clean_admin_email
          ),
          updated_at = NOW()
      WHERE id = target_admin_id;
    END IF;

    -- Atualiza senha no auth.users se fornecida
    IF p_admin_password IS NOT NULL AND length(trim(p_admin_password)) >= 6 THEN
      encrypted_pw := crypt(trim(p_admin_password), gen_salt('bf', 10));
      UPDATE auth.users
      SET encrypted_password = encrypted_pw,
          updated_at = NOW()
      WHERE id = target_admin_id;
    END IF;
  END IF;

  -- 3. Atualiza os módulos da empresa se fornecidos
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

