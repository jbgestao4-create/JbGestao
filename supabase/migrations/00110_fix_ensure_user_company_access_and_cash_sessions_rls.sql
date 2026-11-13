-- Migration 00110: Correção de ambiguidade em ensure_user_company_access e RLS de cash_sessions
-- Resolve o erro "column reference 'id' is ambiguous" e garante que membros e administradores possam abrir e operar o caixa

-- 1. Corrige ensure_user_company_access com colunas explicitamente qualificadas
CREATE OR REPLACE FUNCTION public.ensure_user_company_access()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  is_active BOOLEAN,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_is_owner BOOLEAN := FALSE;
  v_org RECORD;
  v_mod_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = v_uid;
  IF v_email IS NULL THEN
    SELECT lower(p.email) INTO v_email FROM public.profiles p WHERE p.id = v_uid;
  END IF;

  IF v_email IS NOT NULL AND v_email IN (
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br',
    'bryan@administrador.com',
    'bryanmendes968@gmail.com'
  ) THEN
    v_is_owner := TRUE;
  END IF;

  -- Se for o Desenvolvedor / Proprietário do Sistema:
  -- Tem acesso a TODAS as organizações para testes e gerenciamento sem pertencer a nenhuma
  IF v_is_owner THEN
    RETURN QUERY
    SELECT
      o.id AS id,
      o.name AS name,
      o.slug AS slug,
      COALESCE(o.is_active, true) AS is_active,
      o.trial_ends_at AS trial_ends_at,
      o.created_at AS created_at
    FROM public.organizations o
    ORDER BY
      CASE WHEN lower(o.name) LIKE '%bryan%' THEN 1 ELSE 2 END,
      o.created_at ASC;
    RETURN;
  END IF;

  -- Para usuários normais ou administradores de empresas clientes:
  -- 1. Auto-vincula o usuário como admin nas organizações onde ele foi explicitamente cadastrado como admin_email
  IF v_email IS NOT NULL AND v_email <> '' THEN
    FOR v_org IN
      SELECT o.id AS org_id
      FROM public.organizations o
      WHERE lower(trim(COALESCE(o.admin_email, ''))) = v_email
    LOOP
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (v_org.org_id, v_uid, 'admin')
      ON CONFLICT (organization_id, user_id) DO UPDATE
      SET role = 'admin';

      -- Garante módulo JB Software (orcafacil)
      SELECT m.id INTO v_mod_id FROM public.modules m WHERE m.code = 'orcafacil' LIMIT 1;
      IF v_mod_id IS NOT NULL THEN
        INSERT INTO public.organization_modules (organization_id, module_id, status)
        VALUES (v_org.org_id, v_mod_id, 'active')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- 2. Retorna a lista de empresas das quais é membro ou admin
  RETURN QUERY
  SELECT
    o.id AS id,
    o.name AS name,
    o.slug AS slug,
    COALESCE(o.is_active, true) AS is_active,
    o.trial_ends_at AS trial_ends_at,
    o.created_at AS created_at
  FROM public.organizations o
  WHERE EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = o.id AND om.user_id = v_uid
  )
  OR (v_email IS NOT NULL AND lower(trim(COALESCE(o.admin_email, ''))) = v_email)
  ORDER BY o.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_company_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_company_access() TO authenticated;

-- 2. Vincula imediatamente quaisquer administradores de empresas existentes que tenham conta em auth.users
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT o.id, u.id, 'admin'
FROM public.organizations o
JOIN auth.users u ON lower(trim(u.email)) = lower(trim(o.admin_email))
WHERE o.admin_email IS NOT NULL AND o.admin_email <> ''
ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'admin';

-- 3. Atualiza políticas RLS de cash_sessions usando is_org_member (suporta membros e superadmins)
DROP POLICY IF EXISTS "cash_sessions_select_org_member" ON public.cash_sessions;
CREATE POLICY "cash_sessions_select_org_member"
  ON public.cash_sessions
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(cash_sessions.organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "cash_sessions_insert_org_member" ON public.cash_sessions;
CREATE POLICY "cash_sessions_insert_org_member"
  ON public.cash_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(cash_sessions.organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "cash_sessions_update_org_member" ON public.cash_sessions;
CREATE POLICY "cash_sessions_update_org_member"
  ON public.cash_sessions
  FOR UPDATE
  TO authenticated
  USING (
    public.is_org_member(cash_sessions.organization_id, auth.uid())
  )
  WITH CHECK (
    public.is_org_member(cash_sessions.organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "cash_sessions_delete_owner_or_admin" ON public.cash_sessions;
CREATE POLICY "cash_sessions_delete_owner_or_admin"
  ON public.cash_sessions
  FOR DELETE
  TO authenticated
  USING (
    public.is_system_superadmin(auth.uid())
    OR public.get_user_organization_role(cash_sessions.organization_id, auth.uid()) IN ('owner', 'admin')
  );

-- 4. Atualiza políticas RLS de cash_session_movements usando is_org_member
DROP POLICY IF EXISTS "cash_session_movements_select_org_member" ON public.cash_session_movements;
CREATE POLICY "cash_session_movements_select_org_member"
  ON public.cash_session_movements
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(cash_session_movements.organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "cash_session_movements_insert_org_member" ON public.cash_session_movements;
CREATE POLICY "cash_session_movements_insert_org_member"
  ON public.cash_session_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(cash_session_movements.organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "cash_session_movements_update_org_member" ON public.cash_session_movements;
CREATE POLICY "cash_session_movements_update_org_member"
  ON public.cash_session_movements
  FOR UPDATE
  TO authenticated
  USING (
    public.is_org_member(cash_session_movements.organization_id, auth.uid())
  )
  WITH CHECK (
    public.is_org_member(cash_session_movements.organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "cash_session_movements_delete_owner_or_admin" ON public.cash_session_movements;
CREATE POLICY "cash_session_movements_delete_owner_or_admin"
  ON public.cash_session_movements
  FOR DELETE
  TO authenticated
  USING (
    public.is_system_superadmin(auth.uid())
    OR public.get_user_organization_role(cash_session_movements.organization_id, auth.uid()) IN ('owner', 'admin')
  );
