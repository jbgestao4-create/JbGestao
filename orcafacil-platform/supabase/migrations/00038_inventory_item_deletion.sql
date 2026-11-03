-- 00038_inventory_item_deletion.sql
-- Adiciona suporte a exclusão lógica auditada com motivo para produtos de estoque.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delete_reason TEXT,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Atualiza índices únicos de SKU e código de barras para ignorar itens excluídos
DROP INDEX IF EXISTS inventory_items_org_sku_key;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_org_sku_key
  ON public.inventory_items (organization_id, lower(sku))
  WHERE sku IS NOT NULL AND btrim(sku) <> '' AND deleted_at IS NULL;

DROP INDEX IF EXISTS inventory_items_org_barcode_key;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_org_barcode_key
  ON public.inventory_items (organization_id, barcode)
  WHERE barcode IS NOT NULL AND btrim(barcode) <> '' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_items_org_deleted_at_idx
  ON public.inventory_items (organization_id, deleted_at);

-- Função RPC para exclusão de material com motivo e verificação de permissão (Admin ou Nível 3)
CREATE OR REPLACE FUNCTION public.soft_delete_inventory_item(
  p_organization_id UUID,
  p_inventory_item_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role public.organization_role;
  inv_level INTEGER;
BEGIN
  caller_role := public.get_user_organization_role(p_organization_id, auth.uid());
  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: usuário não pertence a esta organização.'
      USING ERRCODE = '42501';
  END IF;

  IF caller_role NOT IN ('owner', 'admin') THEN
    SELECT inventory_access_level INTO inv_level
      FROM public.organization_members
     WHERE organization_id = p_organization_id
       AND user_id = auth.uid();

    IF COALESCE(inv_level, 3) < 3 THEN
      RAISE EXCEPTION 'Acesso negado: permissão insuficiente para excluir produto (requer Nível 3).'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'O motivo da exclusão é obrigatório.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.inventory_items
     SET is_active = false,
         deleted_at = NOW(),
         delete_reason = btrim(p_reason),
         deleted_by = auth.uid(),
         updated_at = NOW()
   WHERE organization_id = p_organization_id
     AND id = p_inventory_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado.'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_inventory_item(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_inventory_item(UUID, UUID, TEXT) TO authenticated;

