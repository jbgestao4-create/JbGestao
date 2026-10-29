DROP POLICY IF EXISTS "Admins podem gerenciar permissões de módulos de membros"
  ON public.organization_member_modules;

CREATE POLICY "Admins e proprietários podem gerenciar permissões de módulos"
  ON public.organization_member_modules FOR ALL
  USING (
    public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
  )
  WITH CHECK (
    public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
  );

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
  target_role organization_role;
  mod_code module_code;
BEGIN
  caller_role := public.get_user_organization_role(p_org_id, auth.uid());
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores e proprietários podem alterar permissões de módulos.';
  END IF;

  SELECT role INTO target_role
  FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  IF target_role IS DISTINCT FROM 'member' THEN
    RAISE EXCEPTION 'As permissões de módulos só podem ser alteradas para membros operacionais.';
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
