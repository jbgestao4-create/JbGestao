-- 00140_fix_dashboard_module_permissions_and_dependencies.sql
-- Atualiza enum dashboard_module_code com MOD-11, suporta superadmin/proprietário do sistema
-- e aprimora as funções update_member_dashboard_modules e add_organization_member eliminando falsos positivos.

-- 1. Garante que MOD-11 e MOD-12 existam no enum dashboard_module_code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'dashboard_module_code' AND e.enumlabel = 'MOD-11'
  ) THEN
    ALTER TYPE public.dashboard_module_code ADD VALUE IF NOT EXISTS 'MOD-11';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'dashboard_module_code' AND e.enumlabel = 'MOD-12'
  ) THEN
    ALTER TYPE public.dashboard_module_code ADD VALUE IF NOT EXISTS 'MOD-12';
  END IF;
END;
$$;

-- 2. Atualiza a função update_member_dashboard_modules com validação flexível e suporte ao Proprietário do Sistema
CREATE OR REPLACE FUNCTION public.update_member_dashboard_modules(
  p_org_id UUID,
  p_user_id UUID,
  p_modules public.dashboard_module_code[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_role organization_role;
  target_role organization_role;
  v_module_code public.dashboard_module_code;
  v_is_sys_owner BOOLEAN := false;
BEGIN
  -- Verifica se quem chamou é Proprietário do Sistema ou Admin/Owner da empresa
  BEGIN
    v_is_sys_owner := public.is_system_owner(auth.uid());
  EXCEPTION WHEN OTHERS THEN
    v_is_sys_owner := false;
  END;

  caller_role := public.get_user_organization_role(p_org_id, auth.uid());
  IF NOT v_is_sys_owner AND (caller_role IS NULL OR caller_role NOT IN ('owner', 'admin')) THEN
    RAISE EXCEPTION 'Apenas administradores e proprietários podem alterar permissões dos módulos.';
  END IF;

  SELECT role INTO target_role
  FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  -- Se o membro ainda não tiver papel explícito registrado, assume 'member' por padrão
  IF target_role IS NULL THEN
    target_role := 'member';
  END IF;

  IF target_role IS DISTINCT FROM 'member' AND NOT v_is_sys_owner THEN
    RAISE EXCEPTION 'As permissões só podem ser alteradas para membros operacionais.';
  END IF;

  -- Limpa permissões anteriores
  DELETE FROM public.organization_member_dashboard_modules
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  -- Insere os módulos informados
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

  -- Sincroniza módulos legados se a tabela existir
  BEGIN
    DELETE FROM public.organization_member_modules
    WHERE organization_id = p_org_id
      AND user_id = p_user_id
      AND module_code IN ('orcafacil', 'estoqueleve');

    IF 'MOD-02'::public.dashboard_module_code = ANY(p_modules) THEN
      INSERT INTO public.organization_member_modules (organization_id, user_id, module_code)
      VALUES (p_org_id, p_user_id, 'estoqueleve')
      ON CONFLICT DO NOTHING;
    END IF;

    IF 'MOD-01'::public.dashboard_module_code = ANY(p_modules) 
       OR 'MOD-03'::public.dashboard_module_code = ANY(p_modules) 
       OR 'MOD-04'::public.dashboard_module_code = ANY(p_modules) 
       OR 'MOD-08'::public.dashboard_module_code = ANY(p_modules) THEN
      INSERT INTO public.organization_member_modules (organization_id, user_id, module_code)
      VALUES (p_org_id, p_user_id, 'orcafacil')
      ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- ignora falhas em tabelas legadas
  END;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_member_dashboard_modules(
  UUID, UUID, public.dashboard_module_code[]
) TO authenticated;

-- 3. Atualiza add_organization_member para reconhecer o Proprietário do Sistema
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
  v_is_sys_owner BOOLEAN := false;
BEGIN
  BEGIN
    v_is_sys_owner := public.is_system_owner(auth.uid());
  EXCEPTION WHEN OTHERS THEN
    v_is_sys_owner := false;
  END;

  caller_role := public.get_user_organization_role(p_org_id, auth.uid());
  IF NOT v_is_sys_owner AND (caller_role IS NULL OR caller_role NOT IN ('owner', 'admin')) THEN
    RAISE EXCEPTION 'Apenas proprietários e administradores podem adicionar membros.';
  END IF;

  IF p_password IS NULL OR length(trim(p_password)) < 6 THEN
    RAISE EXCEPTION 'A senha inicial deve ter pelo menos 6 caracteres.';
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

  IF p_role = 'member' AND p_dashboard_modules IS NOT NULL THEN
    PERFORM public.update_member_dashboard_modules(
      p_org_id,
      target_user_id,
      p_dashboard_modules
    );
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_organization_member(
  UUID, TEXT, TEXT, TEXT, organization_role, module_code[], TEXT, dashboard_module_code[]
) TO authenticated;

-- 4. Atualiza políticas RLS para garantir permissão ao Proprietário do Sistema
DROP POLICY IF EXISTS "Admins podem gerenciar modulos de membros da sua org" ON public.organization_member_dashboard_modules;
CREATE POLICY "Admins podem gerenciar modulos de membros da sua org"
  ON public.organization_member_dashboard_modules FOR ALL
  USING (
    public.is_system_owner(auth.uid()) OR
    public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
  )
  WITH CHECK (
    public.is_system_owner(auth.uid()) OR
    public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "Admins podem gerenciar membros na sua organização" ON public.organization_members;
CREATE POLICY "Admins podem gerenciar membros na sua organização"
  ON public.organization_members FOR ALL
  USING (
    public.is_system_owner(auth.uid()) OR
    public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
  )
  WITH CHECK (
    public.is_system_owner(auth.uid()) OR
    public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
  );
