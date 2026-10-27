-- ==============================================================================
-- MIGRAÇÃO 00002: FUNÇÃO SEGURA DE CHECAGEM DE MEMBRO (SEM RECURSÃO RLS)
-- ==============================================================================

-- 1. Cria a função STABLE SECURITY DEFINER para verificar se o usuário pertence à organização
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id AND user_id = uid
  );
$$;

-- 2. Atualiza a política de SELECT de organizations
DROP POLICY IF EXISTS "Membros podem ver suas organizações" ON public.organizations;
CREATE POLICY "Membros podem ver suas organizações"
  ON public.organizations FOR SELECT
  USING (
    public.is_org_member(id, auth.uid())
  );

-- 3. Atualiza a política de SELECT de organization_members (permite ver se for o próprio usuário OU se for colega na mesma org)
DROP POLICY IF EXISTS "Membros podem listar colegas da mesma organização" ON public.organization_members;
CREATE POLICY "Membros podem listar colegas da mesma organização"
  ON public.organization_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_org_member(organization_id, auth.uid())
  );

-- 4. Otimiza as políticas das outras tabelas para usar is_org_member (alta performance e sem recursão)
DROP POLICY IF EXISTS "Membros podem ver os módulos concedidos à sua organização" ON public.organization_modules;
CREATE POLICY "Membros podem ver os módulos concedidos à sua organização"
  ON public.organization_modules FOR SELECT
  USING (
    public.is_org_member(organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "Membros podem ver a assinatura da sua organização" ON public.subscriptions;
CREATE POLICY "Membros podem ver a assinatura da sua organização"
  ON public.subscriptions FOR SELECT
  USING (
    public.is_org_member(organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "Membros podem visualizar clientes de sua organização" ON public.customers;
CREATE POLICY "Membros podem visualizar clientes de sua organização"
  ON public.customers FOR SELECT
  USING (
    public.is_org_member(organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "Membros podem cadastrar clientes em sua organização" ON public.customers;
CREATE POLICY "Membros podem cadastrar clientes em sua organização"
  ON public.customers FOR INSERT
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "Membros podem atualizar clientes de sua organização" ON public.customers;
CREATE POLICY "Membros podem atualizar clientes de sua organização"
  ON public.customers FOR UPDATE
  USING (
    public.is_org_member(organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "Membros podem ver orçamentos da sua organização" ON public.quotes;
CREATE POLICY "Membros podem ver orçamentos da sua organização"
  ON public.quotes FOR SELECT
  USING (
    public.is_org_member(organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "Membros podem criar orçamentos na sua organização" ON public.quotes;
CREATE POLICY "Membros podem criar orçamentos na sua organização"
  ON public.quotes FOR INSERT
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "Membros podem atualizar orçamentos da sua organização" ON public.quotes;
CREATE POLICY "Membros podem atualizar orçamentos da sua organização"
  ON public.quotes FOR UPDATE
  USING (
    public.is_org_member(organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "Membros podem ver itens de orçamentos de sua organização" ON public.quote_items;
CREATE POLICY "Membros podem ver itens de orçamentos de sua organização"
  ON public.quote_items FOR SELECT
  USING (
    public.is_org_member(organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "Membros podem inserir itens em orçamentos de sua organização" ON public.quote_items;
CREATE POLICY "Membros podem inserir itens em orçamentos de sua organização"
  ON public.quote_items FOR INSERT
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "Membros podem atualizar itens de orçamentos de sua organização" ON public.quote_items;
CREATE POLICY "Membros podem atualizar itens de orçamentos de sua organização"
  ON public.quote_items FOR UPDATE
  USING (
    public.is_org_member(organization_id, auth.uid())
  );

DROP POLICY IF EXISTS "Membros podem excluir itens de orçamentos de sua organização" ON public.quote_items;
CREATE POLICY "Membros podem excluir itens de orçamentos de sua organização"
  ON public.quote_items FOR DELETE
  USING (
    public.is_org_member(organization_id, auth.uid())
  );

