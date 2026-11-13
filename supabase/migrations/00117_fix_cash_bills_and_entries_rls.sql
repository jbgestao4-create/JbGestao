-- Migration 00117: Correção de políticas RLS para cash_bills, cash_entries e cash_registers
-- Resolve o erro "new row violates row-level security policy for table cash_bills" (code 42501)
-- Garante que membros de empresas, administradores e superadmins possam consultar, cadastrar, atualizar e pagar boletos e lançamentos do caixa.

-- 1. Atualiza e robustece is_org_member para aceitar membros, superadmins e proprietários do sistema
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF uid IS NULL OR org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Pertence explicitamente à organização em organization_members
  IF EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id = uid
  ) THEN
    RETURN TRUE;
  END IF;

  -- 2. É Superadmin da plataforma
  IF public.is_system_superadmin(uid) THEN
    RETURN TRUE;
  END IF;

  -- 3. É Proprietário da plataforma (is_system_owner)
  BEGIN
    IF public.is_system_owner(uid) THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback se a função não existir no schema
  END;

  -- 4. É o administrador cadastrado diretamente na tabela organizations (admin_email)
  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = uid LIMIT 1;
  IF v_email IS NULL THEN
    SELECT lower(p.email) INTO v_email FROM public.profiles p WHERE p.id = uid LIMIT 1;
  END IF;

  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_id AND lower(trim(COALESCE(o.admin_email, ''))) = v_email
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.is_org_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID, UUID) TO authenticated, service_role;

-- 2. Atualiza get_user_organization_role
CREATE OR REPLACE FUNCTION public.get_user_organization_role(org_id UUID, uid UUID DEFAULT auth.uid())
RETURNS organization_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role organization_role;
  v_email TEXT;
BEGIN
  IF uid IS NULL OR org_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT om.role INTO v_role
  FROM public.organization_members om
  WHERE om.organization_id = org_id
    AND om.user_id = uid
  LIMIT 1;

  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  IF public.is_system_superadmin(uid) THEN
    RETURN 'owner'::organization_role;
  END IF;

  BEGIN
    IF public.is_system_owner(uid) THEN
      RETURN 'owner'::organization_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
  END;

  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = uid LIMIT 1;
  IF v_email IS NULL THEN
    SELECT lower(p.email) INTO v_email FROM public.profiles p WHERE p.id = uid LIMIT 1;
  END IF;

  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_id AND lower(trim(COALESCE(o.admin_email, ''))) = v_email
  ) THEN
    RETURN 'admin'::organization_role;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_organization_role(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_organization_role(UUID, UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. Políticas RLS para public.cash_bills
-- ------------------------------------------------------------------------------
ALTER TABLE public.cash_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_bills_select_org_member" ON public.cash_bills;
DROP POLICY IF EXISTS "Usuários com acesso ao caixa consultam boletos" ON public.cash_bills;
CREATE POLICY "cash_bills_select_org_member"
  ON public.cash_bills
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(cash_bills.organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "cash_bills_insert_org_member" ON public.cash_bills;
DROP POLICY IF EXISTS "Usuários com acesso ao caixa gerenciam boletos" ON public.cash_bills;
CREATE POLICY "cash_bills_insert_org_member"
  ON public.cash_bills
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(cash_bills.organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "cash_bills_update_org_member" ON public.cash_bills;
CREATE POLICY "cash_bills_update_org_member"
  ON public.cash_bills
  FOR UPDATE
  TO authenticated
  USING (
    public.is_org_member(cash_bills.organization_id, auth.uid())
  )
  WITH CHECK (
    public.is_org_member(cash_bills.organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "cash_bills_delete_org_member" ON public.cash_bills;
CREATE POLICY "cash_bills_delete_org_member"
  ON public.cash_bills
  FOR DELETE
  TO authenticated
  USING (
    public.is_org_member(cash_bills.organization_id, auth.uid())
  );

-- ------------------------------------------------------------------------------
-- 4. Políticas RLS para public.cash_entries
-- ------------------------------------------------------------------------------
ALTER TABLE public.cash_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_entries_select_org_member" ON public.cash_entries;
DROP POLICY IF EXISTS "Membros autorizados consultam lançamentos do caixa" ON public.cash_entries;
CREATE POLICY "cash_entries_select_org_member"
  ON public.cash_entries
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(cash_entries.organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "cash_entries_insert_org_member" ON public.cash_entries;
DROP POLICY IF EXISTS "Membros autorizados gerenciam lançamentos do caixa" ON public.cash_entries;
CREATE POLICY "cash_entries_insert_org_member"
  ON public.cash_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(cash_entries.organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "cash_entries_update_org_member" ON public.cash_entries;
CREATE POLICY "cash_entries_update_org_member"
  ON public.cash_entries
  FOR UPDATE
  TO authenticated
  USING (
    public.is_org_member(cash_entries.organization_id, auth.uid())
  )
  WITH CHECK (
    public.is_org_member(cash_entries.organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "cash_entries_delete_owner_or_admin" ON public.cash_entries;
CREATE POLICY "cash_entries_delete_owner_or_admin"
  ON public.cash_entries
  FOR DELETE
  TO authenticated
  USING (
    public.is_system_superadmin(auth.uid())
    OR public.get_user_organization_role(cash_entries.organization_id, auth.uid()) IN ('owner', 'admin')
  );

-- ------------------------------------------------------------------------------
-- 5. Políticas RLS para public.cash_registers
-- ------------------------------------------------------------------------------
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_registers_select_org_member" ON public.cash_registers;
CREATE POLICY "cash_registers_select_org_member"
  ON public.cash_registers
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(cash_registers.organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "cash_registers_insert_org_member" ON public.cash_registers;
CREATE POLICY "cash_registers_insert_org_member"
  ON public.cash_registers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(cash_registers.organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "cash_registers_update_org_member" ON public.cash_registers;
CREATE POLICY "cash_registers_update_org_member"
  ON public.cash_registers
  FOR UPDATE
  TO authenticated
  USING (
    public.is_org_member(cash_registers.organization_id, auth.uid())
  )
  WITH CHECK (
    public.is_org_member(cash_registers.organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "cash_registers_delete_owner_or_admin" ON public.cash_registers;
CREATE POLICY "cash_registers_delete_owner_or_admin"
  ON public.cash_registers
  FOR DELETE
  TO authenticated
  USING (
    public.is_system_superadmin(auth.uid())
    OR public.get_user_organization_role(cash_registers.organization_id, auth.uid()) IN ('owner', 'admin')
  );

-- ------------------------------------------------------------------------------
-- 6. Garante permissões de tabela para authenticated e service_role
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cash_bills TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cash_entries TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cash_registers TO authenticated, service_role;
