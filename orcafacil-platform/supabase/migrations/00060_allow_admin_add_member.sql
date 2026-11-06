-- Migration 00060: Permite aos Administradores cadastrar novos funcionários/usuários

-- 1. Atualiza is_org_member para reconhecer o admin da organização e o proprietário do sistema
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  u_email TEXT;
BEGIN
  -- 1.1. Verifica se já consta na tabela organization_members
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id AND user_id = uid
  ) THEN
    RETURN TRUE;
  END IF;

  -- 1.2. Verifica se é o Proprietário do Sistema
  SELECT lower(email) INTO u_email FROM auth.users WHERE id = uid LIMIT 1;
  IF u_email IS NOT NULL AND u_email = 'bryanmendes968@gmail.com' THEN
    RETURN TRUE;
  END IF;

  -- 1.3. Verifica se o e-mail corresponde ao admin_email da empresa
  IF u_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id AND lower(trim(COALESCE(admin_email, ''))) = u_email
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 2. Atualiza get_user_organization_role para reconhecer o admin tanto por organization_members quanto por admin_email
CREATE OR REPLACE FUNCTION public.get_user_organization_role(org_id UUID, uid UUID)
RETURNS organization_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role organization_role;
  u_email TEXT;
BEGIN
  -- 2.1. Verifica se já existe papel explícito na tabela organization_members
  SELECT role INTO v_role
  FROM public.organization_members
  WHERE organization_id = org_id AND user_id = uid
  LIMIT 1;

  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  -- 2.2. Se o usuário for o Proprietário do Sistema
  SELECT lower(email) INTO u_email FROM auth.users WHERE id = uid LIMIT 1;
  IF u_email IS NOT NULL AND u_email = 'bryanmendes968@gmail.com' THEN
    RETURN 'owner'::organization_role;
  END IF;

  -- 2.3. Se o e-mail do usuário corresponder ao admin_email cadastrado na organização
  IF u_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id AND lower(trim(COALESCE(admin_email, ''))) = u_email
  ) THEN
    RETURN 'admin'::organization_role;
  END IF;

  RETURN NULL;
END;
$$;

-- 3. Atualiza add_organization_member para aceitar senha mínima de 6 caracteres e permitir ao admin criar usuários
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

REVOKE ALL ON FUNCTION public.add_organization_member(
  UUID, TEXT, TEXT, TEXT, organization_role, module_code[], TEXT, dashboard_module_code[]
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_organization_member(
  UUID, TEXT, TEXT, TEXT, organization_role, module_code[], TEXT, dashboard_module_code[]
) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_organization_member(
  UUID, TEXT, TEXT, TEXT, organization_role, module_code[], TEXT, dashboard_module_code[]
) TO authenticated;

-- 4. Políticas de RLS para que administradores gerenciem membros e módulos da sua organização
DROP POLICY IF EXISTS "Admins podem gerenciar membros na sua organização" ON public.organization_members;
CREATE POLICY "Admins podem gerenciar membros na sua organização"
  ON public.organization_members FOR ALL
  USING (
    public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "Admins podem gerenciar modulos de membros da sua org" ON public.organization_member_dashboard_modules;
CREATE POLICY "Admins podem gerenciar modulos de membros da sua org"
  ON public.organization_member_dashboard_modules FOR ALL
  USING (
    public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
  );
