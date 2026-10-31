CREATE OR REPLACE FUNCTION public.update_organization_member(
  p_org_id UUID,
  p_user_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_job_title TEXT,
  p_role organization_role
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_role organization_role;
  target_role organization_role;
  clean_name TEXT;
  clean_email TEXT;
  clean_job_title TEXT;
BEGIN
  caller_role := public.get_user_organization_role(p_org_id, auth.uid());
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Apenas proprietários e administradores podem editar funcionários.';
  END IF;

  SELECT role
  INTO target_role
  FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Funcionário não encontrado nesta empresa.';
  END IF;

  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'O proprietário da empresa não pode ser editado por esta opção.';
  END IF;

  IF p_role IS NULL OR p_role = 'owner' THEN
    RAISE EXCEPTION 'O papel selecionado não é válido.';
  END IF;

  clean_name := trim(COALESCE(p_name, ''));
  clean_email := lower(trim(COALESCE(p_email, '')));
  clean_job_title := NULLIF(trim(COALESCE(p_job_title, '')), '');

  IF clean_name = '' THEN
    RAISE EXCEPTION 'O nome do funcionário é obrigatório.';
  END IF;

  IF clean_email = '' OR position('@' IN clean_email) < 2 THEN
    RAISE EXCEPTION 'Informe um e-mail válido.';
  END IF;

  IF length(clean_name) > 100 OR length(clean_job_title) > 100 THEN
    RAISE EXCEPTION 'Nome e cargo devem ter no máximo 100 caracteres.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = clean_email AND id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'Este e-mail já está sendo usado por outra conta.';
  END IF;

  UPDATE auth.users
  SET email = clean_email,
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('display_name', clean_name, 'email', clean_email),
      updated_at = NOW()
  WHERE id = p_user_id;

  UPDATE auth.identities
  SET identity_data = COALESCE(identity_data, '{}'::jsonb)
        || jsonb_build_object('email', clean_email, 'sub', p_user_id::text),
      updated_at = NOW()
  WHERE user_id = p_user_id AND provider = 'email';

  UPDATE public.profiles
  SET display_name = clean_name,
      email = clean_email
  WHERE id = p_user_id;

  UPDATE public.organization_members
  SET job_title = clean_job_title,
      role = p_role
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.update_organization_member(
  UUID, UUID, TEXT, TEXT, TEXT, organization_role
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_organization_member(
  UUID, UUID, TEXT, TEXT, TEXT, organization_role
) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_organization_member(
  UUID, UUID, TEXT, TEXT, TEXT, organization_role
) TO authenticated;
