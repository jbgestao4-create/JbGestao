-- 00040_allow_members_delete_quotes.sql
-- Permite que membros da organização excluam orçamentos e adiciona função RPC delete_quote com cascata em lançamentos de caixa

DROP POLICY IF EXISTS "Owners e admins podem excluir orçamentos" ON public.quotes;
DROP POLICY IF EXISTS "Membros podem excluir orçamentos da sua organização" ON public.quotes;

CREATE POLICY "Membros podem excluir orçamentos da sua organização"
  ON public.quotes FOR DELETE
  USING (
    public.is_org_member(organization_id, auth.uid())
  );

CREATE OR REPLACE FUNCTION public.delete_quote(
  p_organization_id UUID,
  p_quote_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role public.organization_role;
BEGIN
  IF auth.role() <> 'service_role' THEN
    caller_role := public.get_user_organization_role(p_organization_id, auth.uid());
    IF caller_role IS NULL THEN
      RAISE EXCEPTION 'Usuário não pertence a esta organização.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 1. Exclui pagamentos e lançamentos de caixa vinculados caso existam
  DELETE FROM public.cash_payments
   WHERE entry_id IN (
     SELECT id FROM public.cash_entries
      WHERE organization_id = p_organization_id
        AND quote_id = p_quote_id
   );

  DELETE FROM public.cash_entries
   WHERE organization_id = p_organization_id
     AND quote_id = p_quote_id;

  -- 2. Exclui o orçamento (o trigger restore_inventory_before_quote_delete restaura estoque e itens sofrem cascade)
  DELETE FROM public.quotes
   WHERE organization_id = p_organization_id
     AND id = p_quote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_quote(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_quote(UUID, UUID) TO authenticated, service_role;
