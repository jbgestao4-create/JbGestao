-- 00041_add_mod_08_dashboard_module.sql
-- Adiciona MOD-08 ao enum dashboard_module_code e atualiza permissões de membros

ALTER TYPE public.dashboard_module_code ADD VALUE IF NOT EXISTS 'MOD-08';

CREATE OR REPLACE FUNCTION public.update_member_dashboard_modules(
  p_org_id UUID,
  p_user_id UUID,
  p_modules public.dashboard_module_code[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role organization_role;
  target_role organization_role;
  v_module_code public.dashboard_module_code;
BEGIN
  caller_role := public.get_user_organization_role(p_org_id, auth.uid());
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores e proprietários podem alterar permissões dos módulos.';
  END IF;

  SELECT role INTO target_role
  FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  IF target_role IS DISTINCT FROM 'member' THEN
    RAISE EXCEPTION 'As permissões só podem ser alteradas para membros operacionais.';
  END IF;

  DELETE FROM public.organization_member_dashboard_modules
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  IF p_modules IS NOT NULL THEN
    FOREACH v_module_code IN ARRAY p_modules
    LOOP
      INSERT INTO public.organization_member_dashboard_modules (
        organization_id,
        user_id,
        module_code
      )
      VALUES (p_org_id, p_user_id, v_module_code)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  DELETE FROM public.organization_member_modules
  WHERE organization_id = p_org_id
    AND user_id = p_user_id
    AND module_code IN ('orcafacil', 'estoqueleve');

  IF 'MOD-02' = ANY(p_modules) THEN
    INSERT INTO public.organization_member_modules (organization_id, user_id, module_code)
    VALUES (p_org_id, p_user_id, 'estoqueleve')
    ON CONFLICT DO NOTHING;
  END IF;

  IF 'MOD-01' = ANY(p_modules) OR 'MOD-03' = ANY(p_modules) OR 'MOD-04' = ANY(p_modules) OR 'MOD-08' = ANY(p_modules) THEN
    INSERT INTO public.organization_member_modules (organization_id, user_id, module_code)
    VALUES (p_org_id, p_user_id, 'orcafacil')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN true;
END;
$$;

