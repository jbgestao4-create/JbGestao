CREATE OR REPLACE FUNCTION public.add_organization_member(
  p_org_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_password TEXT,
  p_role organization_role,
  p_modules module_code[],
  p_job_title TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_role organization_role;
  result JSONB;
  target_user_id UUID;
  mod_code module_code;
  clean_job_title TEXT;
BEGIN
  caller_role := public.get_user_organization_role(p_org_id, auth.uid());
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Apenas proprietários e administradores podem adicionar membros.';
  END IF;

  IF COALESCE(cardinality(p_modules), 0) > 0 AND p_role <> 'member' THEN
    RAISE EXCEPTION 'Permissões específicas de módulos só podem ser atribuídas a membros operacionais.';
  END IF;

  result := public.add_organization_member(
    p_org_id,
    p_email,
    p_name,
    p_password,
    p_role,
    ARRAY[]::module_code[]
  );
  target_user_id := (result->>'userId')::UUID;
  clean_job_title := NULLIF(trim(p_job_title), '');

  UPDATE public.organization_members
  SET job_title = clean_job_title
  WHERE organization_id = p_org_id AND user_id = target_user_id;

  IF p_role = 'member' AND p_modules IS NOT NULL THEN
    FOREACH mod_code IN ARRAY p_modules
    LOOP
      INSERT INTO public.organization_member_modules (organization_id, user_id, module_code)
      VALUES (p_org_id, target_user_id, mod_code)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN result || jsonb_build_object('jobTitle', clean_job_title);
END;
$$;
