-- Corrige contas de funcionários sem identidade de e-mail no Supabase Auth.
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  u.id::text,
  NOW(),
  NOW(),
  NOW()
FROM auth.users u
WHERE EXISTS (
  SELECT 1
  FROM public.organization_members om
  WHERE om.user_id = u.id
)
AND NOT EXISTS (
  SELECT 1
  FROM auth.identities i
  WHERE i.user_id = u.id AND i.provider = 'email'
);

UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  is_sso_user = false,
  is_anonymous = false
WHERE email_confirmed_at IS NULL
AND EXISTS (
  SELECT 1
  FROM public.organization_members om
  WHERE om.user_id = auth.users.id
);

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

  caller_role := public.get_user_organization_role(p_org_id, auth.uid());
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Apenas proprietários e administradores podem adicionar membros.';
  END IF;

  IF p_role = 'owner' AND caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Apenas o proprietário pode designar outro proprietário.';
  END IF;

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
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'display_name', clean_name,
        'sub', target_user_id::text,
        'email', clean_email
      ),
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

    INSERT INTO public.profiles (id, display_name, email)
    VALUES (target_user_id, clean_name, clean_email)
    ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name, email = EXCLUDED.email;
  ELSE
    UPDATE public.profiles
    SET display_name = COALESCE(NULLIF(display_name, ''), clean_name),
        email = clean_email
    WHERE id = target_user_id;

    IF NOT EXISTS (
      SELECT 1
      FROM auth.identities
      WHERE user_id = target_user_id AND provider = 'email'
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

  IF EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = target_user_id
  ) THEN
    RAISE EXCEPTION 'O usuário % já é membro desta organização.', clean_email;
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (p_org_id, target_user_id, p_role);

  IF p_modules IS NOT NULL THEN
    FOREACH mod_code IN ARRAY p_modules
    LOOP
      INSERT INTO public.organization_member_modules (organization_id, user_id, module_code)
      VALUES (p_org_id, target_user_id, mod_code)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'userId', target_user_id,
    'email', clean_email,
    'name', clean_name,
    'role', p_role
  );
END;
$$;
