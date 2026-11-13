CREATE OR REPLACE FUNCTION public.add_organization_member(
  p_org_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_password TEXT,
  p_role organization_role,
  p_modules module_code[],
  p_job_title TEXT,
  p_dashboard_modules dashboard_module_code[]
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
BEGIN
  caller_role := public.get_user_organization_role(p_org_id, auth.uid());
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Apenas proprietários e administradores podem adicionar membros.';
  END IF;

  IF p_password IS NULL OR length(trim(p_password)) < 8 THEN
    RAISE EXCEPTION 'A senha inicial deve ter pelo menos 8 caracteres.';
  END IF;

  IF p_role = 'member' AND COALESCE(cardinality(p_dashboard_modules), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um módulo para o membro operacional.';
  END IF;

  IF p_role <> 'member' AND COALESCE(cardinality(p_dashboard_modules), 0) > 0 THEN
    RAISE EXCEPTION 'Permissões específicas só podem ser atribuídas a membros operacionais.';
  END IF;

  result := public.add_organization_member(
    p_org_id,
    p_email,
    p_name,
    p_password,
    p_role,
    p_modules,
    p_job_title
  );
  target_user_id := (result->>'userId')::UUID;

  IF p_role = 'member' THEN
    PERFORM public.update_member_dashboard_modules(
      p_org_id,
      target_user_id,
      p_dashboard_modules
    );
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.add_organization_member(
  UUID, TEXT, TEXT, TEXT, organization_role, module_code[], TEXT, dashboard_module_code[]
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_organization_member(
  UUID, TEXT, TEXT, TEXT, organization_role, module_code[], TEXT, dashboard_module_code[]
) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_organization_member(
  UUID, TEXT, TEXT, TEXT, organization_role, module_code[], TEXT, dashboard_module_code[]
) TO authenticated;
