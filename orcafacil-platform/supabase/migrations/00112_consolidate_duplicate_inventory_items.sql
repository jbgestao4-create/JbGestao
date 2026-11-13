-- 00112_consolidate_duplicate_inventory_items.sql
-- Unifica produtos em estoque que possuam o mesmo código (SKU ou código de barras) na mesma organização.
-- Soma as quantidades físicas, preserva vínculos e remove duplicidades.

-- Garante que as colunas deleted_at e delete_reason existam
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS delete_reason TEXT;

CREATE OR REPLACE FUNCTION public.consolidate_duplicate_inventory_items(
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  dup_rec RECORD;
  v_master_id UUID;
  v_master_sku TEXT;
  v_total_qty NUMERIC(12, 4);
  v_dup_qty NUMERIC(12, 4);
  v_best_purchase_price NUMERIC(12, 4);
  v_best_unit_price NUMERIC(12, 4);
  v_groups_merged INTEGER := 0;
  v_items_merged INTEGER := 0;
BEGIN
  -- 1. Agrupar produtos com o mesmo lower(btrim(sku)) que estejam ativos
  FOR rec IN (
    SELECT lower(btrim(sku)) as norm_code, count(*) as cnt
      FROM public.inventory_items
     WHERE organization_id = p_organization_id
       AND deleted_at IS NULL
       AND sku IS NOT NULL
       AND btrim(sku) <> ''
     GROUP BY lower(btrim(sku))
    HAVING count(*) > 1
  ) LOOP
    -- Identificar o produto principal (preferindo o com maior quantidade ou mais antigo)
    SELECT id, sku, quantity_on_hand, purchase_price, unit_price
      INTO v_master_id, v_master_sku, v_total_qty, v_best_purchase_price, v_best_unit_price
      FROM public.inventory_items
     WHERE organization_id = p_organization_id
       AND deleted_at IS NULL
       AND lower(btrim(sku)) = rec.norm_code
     ORDER BY quantity_on_hand DESC, created_at ASC
     LIMIT 1;

    -- Iterar pelos outros itens duplicados deste grupo
    FOR dup_rec IN (
      SELECT id, sku, quantity_on_hand, purchase_price, unit_price
        FROM public.inventory_items
       WHERE organization_id = p_organization_id
         AND deleted_at IS NULL
         AND lower(btrim(sku)) = rec.norm_code
         AND id <> v_master_id
    ) LOOP
      v_dup_qty := COALESCE(dup_rec.quantity_on_hand, 0);
      v_total_qty := v_total_qty + v_dup_qty;

      IF dup_rec.purchase_price > v_best_purchase_price THEN
        v_best_purchase_price := dup_rec.purchase_price;
      END IF;

      IF (v_best_unit_price IS NULL OR v_best_unit_price <= 0) AND dup_rec.unit_price > 0 THEN
        v_best_unit_price := dup_rec.unit_price;
      END IF;

      -- Reatribuir chaves estrangeiras
      UPDATE public.inventory_movements
         SET inventory_item_id = v_master_id
       WHERE inventory_item_id = dup_rec.id;

      UPDATE public.quote_items
         SET inventory_item_id = v_master_id
       WHERE inventory_item_id = dup_rec.id;

      UPDATE public.service_materials
         SET material_id = v_master_id
       WHERE material_id = dup_rec.id;

      UPDATE public.service_order_items
         SET inventory_item_id = v_master_id
       WHERE inventory_item_id = dup_rec.id;

      -- Soft delete do item duplicado
      UPDATE public.inventory_items
         SET is_active = false,
             deleted_at = NOW(),
             delete_reason = 'Unificado automaticamente no produto principal #' || COALESCE(v_master_sku, v_master_id::TEXT),
             updated_at = NOW()
       WHERE id = dup_rec.id;

      v_items_merged := v_items_merged + 1;
    END LOOP;

    -- Atualizar o produto principal com o saldo consolidado
    UPDATE public.inventory_items
       SET quantity_on_hand = v_total_qty,
           purchase_price = v_best_purchase_price,
           last_purchase_price = v_best_purchase_price,
           unit_price = v_best_unit_price,
           updated_at = NOW()
     WHERE id = v_master_id;

    v_groups_merged := v_groups_merged + 1;
  END LOOP;

  -- 2. Repetir para códigos de barras idênticos (onde sku era diferente mas o código de barras é o mesmo)
  FOR rec IN (
    SELECT btrim(barcode) as norm_barcode, count(*) as cnt
      FROM public.inventory_items
     WHERE organization_id = p_organization_id
       AND deleted_at IS NULL
       AND barcode IS NOT NULL
       AND btrim(barcode) <> ''
       AND upper(btrim(barcode)) NOT IN ('SEM GTIN', 'SEMGTIN', '0')
     GROUP BY btrim(barcode)
    HAVING count(*) > 1
  ) LOOP
    SELECT id, sku, quantity_on_hand, purchase_price, unit_price
      INTO v_master_id, v_master_sku, v_total_qty, v_best_purchase_price, v_best_unit_price
      FROM public.inventory_items
     WHERE organization_id = p_organization_id
       AND deleted_at IS NULL
       AND btrim(barcode) = rec.norm_barcode
     ORDER BY quantity_on_hand DESC, created_at ASC
     LIMIT 1;

    FOR dup_rec IN (
      SELECT id, sku, quantity_on_hand, purchase_price, unit_price
        FROM public.inventory_items
       WHERE organization_id = p_organization_id
         AND deleted_at IS NULL
         AND btrim(barcode) = rec.norm_barcode
         AND id <> v_master_id
    ) LOOP
      v_dup_qty := COALESCE(dup_rec.quantity_on_hand, 0);
      v_total_qty := v_total_qty + v_dup_qty;

      IF dup_rec.purchase_price > v_best_purchase_price THEN
        v_best_purchase_price := dup_rec.purchase_price;
      END IF;

      IF (v_best_unit_price IS NULL OR v_best_unit_price <= 0) AND dup_rec.unit_price > 0 THEN
        v_best_unit_price := dup_rec.unit_price;
      END IF;

      UPDATE public.inventory_movements
         SET inventory_item_id = v_master_id
       WHERE inventory_item_id = dup_rec.id;

      UPDATE public.quote_items
         SET inventory_item_id = v_master_id
       WHERE inventory_item_id = dup_rec.id;

      UPDATE public.service_materials
         SET material_id = v_master_id
       WHERE material_id = dup_rec.id;

      UPDATE public.service_order_items
         SET inventory_item_id = v_master_id
       WHERE inventory_item_id = dup_rec.id;

      UPDATE public.inventory_items
         SET is_active = false,
             deleted_at = NOW(),
             delete_reason = 'Unificado automaticamente por código de barras no produto principal #' || COALESCE(v_master_sku, v_master_id::TEXT),
             updated_at = NOW()
       WHERE id = dup_rec.id;

      v_items_merged := v_items_merged + 1;
    END LOOP;

    UPDATE public.inventory_items
       SET quantity_on_hand = v_total_qty,
           purchase_price = v_best_purchase_price,
           last_purchase_price = v_best_purchase_price,
           unit_price = v_best_unit_price,
           updated_at = NOW()
     WHERE id = v_master_id;

    v_groups_merged := v_groups_merged + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'groupsMerged', v_groups_merged,
    'itemsMerged', v_items_merged
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consolidate_duplicate_inventory_items(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consolidate_duplicate_inventory_items(UUID) TO authenticated;

-- Executa a unificação para todas as organizações cadastradas atualmente
DO $$
DECLARE
  org_rec RECORD;
BEGIN
  FOR org_rec IN (SELECT id FROM public.organizations) LOOP
    PERFORM public.consolidate_duplicate_inventory_items(org_rec.id);
  END LOOP;
END;
$$;
