CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id UUID,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) >= 2),
  unit TEXT NOT NULL CHECK (char_length(btrim(unit)) BETWEEN 1 AND 30),
  quantity_on_hand NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  minimum_quantity NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (minimum_quantity >= 0),
  unit_price NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inventory_items_org_id UNIQUE (organization_id, id),
  CONSTRAINT fk_inventory_items_supplier_org
    FOREIGN KEY (organization_id, supplier_id)
    REFERENCES public.suppliers(organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS inventory_items_organization_name_idx
  ON public.inventory_items (organization_id, name);

CREATE INDEX IF NOT EXISTS inventory_items_supplier_idx
  ON public.inventory_items (organization_id, supplier_id);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros com acesso podem visualizar materiais"
  ON public.inventory_items;
CREATE POLICY "Membros com acesso podem visualizar materiais"
  ON public.inventory_items FOR SELECT
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = inventory_items.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code IN ('MOD-04', 'MOD-06')
      )
    )
  );

DROP POLICY IF EXISTS "Membros com acesso podem gerenciar materiais"
  ON public.inventory_items;
CREATE POLICY "Membros com acesso podem gerenciar materiais"
  ON public.inventory_items FOR ALL
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = inventory_items.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code = 'MOD-06'
      )
    )
  )
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = inventory_items.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code = 'MOD-06'
      )
    )
  );

CREATE OR REPLACE FUNCTION public.set_inventory_item_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_inventory_item_updated_at ON public.inventory_items;
CREATE TRIGGER set_inventory_item_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_inventory_item_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_inventory_unit_change_when_used()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.unit IS DISTINCT FROM OLD.unit
     AND EXISTS (
       SELECT 1
       FROM public.quote_items
       WHERE organization_id = OLD.organization_id
         AND inventory_item_id = OLD.id
     ) THEN
    RAISE EXCEPTION 'A unidade não pode ser alterada enquanto o material estiver em orçamentos.'
      USING ERRCODE = 'P0001', MESSAGE = 'INVENTORY_UNIT_IN_USE';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_inventory_unit_change_when_used ON public.inventory_items;
CREATE TRIGGER prevent_inventory_unit_change_when_used
  BEFORE UPDATE OF unit ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_inventory_unit_change_when_used();

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS inventory_item_id UUID,
  ADD COLUMN IF NOT EXISTS unit TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_quote_items_inventory_item_org'
      AND conrelid = 'public.quote_items'::regclass
  ) THEN
    ALTER TABLE public.quote_items
      ADD CONSTRAINT fk_quote_items_inventory_item_org
      FOREIGN KEY (organization_id, inventory_item_id)
      REFERENCES public.inventory_items(organization_id, id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_inventory_for_quote_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_status public.quote_status;
  new_status public.quote_status;
  affected_quote_id UUID;
  item_label TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_quote_id := OLD.quote_id;
    IF current_setting('jb.restoring_quote_id', true) = affected_quote_id::TEXT THEN
      RETURN OLD;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.inventory_item_id IS NOT DISTINCT FROM NEW.inventory_item_id
       AND OLD.quantity IS NOT DISTINCT FROM NEW.quantity THEN
      RETURN NEW;
    END IF;
    affected_quote_id := OLD.quote_id;
  ELSE
    affected_quote_id := NEW.quote_id;
  END IF;

  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    SELECT status
      INTO old_status
      FROM public.quotes
     WHERE id = affected_quote_id
       AND organization_id = OLD.organization_id;

    IF old_status = 'approved' AND OLD.inventory_item_id IS NOT NULL THEN
      UPDATE public.inventory_items
         SET quantity_on_hand = quantity_on_hand + OLD.quantity
       WHERE organization_id = OLD.organization_id
         AND id = OLD.inventory_item_id;
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT status
      INTO new_status
      FROM public.quotes
     WHERE id = NEW.quote_id
       AND organization_id = NEW.organization_id;

    IF new_status = 'approved' AND NEW.inventory_item_id IS NOT NULL THEN
      UPDATE public.inventory_items
         SET quantity_on_hand = quantity_on_hand - NEW.quantity
       WHERE organization_id = NEW.organization_id
         AND id = NEW.inventory_item_id
         AND quantity_on_hand >= NEW.quantity;

      IF NOT FOUND THEN
        SELECT name INTO item_label
          FROM public.inventory_items
         WHERE organization_id = NEW.organization_id
           AND id = NEW.inventory_item_id;
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: %', COALESCE(item_label, 'material')
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sync_inventory_for_quote_item_change ON public.quote_items;
CREATE TRIGGER sync_inventory_for_quote_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_inventory_for_quote_item_change();

CREATE OR REPLACE FUNCTION public.consume_inventory_for_approved_quote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  material RECORD;
BEGIN
  FOR material IN
    SELECT items.inventory_item_id, SUM(items.quantity) AS quantity, MAX(stock.name) AS name
      FROM public.quote_items items
      JOIN public.inventory_items stock
        ON stock.organization_id = items.organization_id
       AND stock.id = items.inventory_item_id
     WHERE items.organization_id = NEW.organization_id
       AND items.quote_id = NEW.id
       AND items.inventory_item_id IS NOT NULL
     GROUP BY items.inventory_item_id
     ORDER BY items.inventory_item_id
  LOOP
    UPDATE public.inventory_items
       SET quantity_on_hand = quantity_on_hand - material.quantity
     WHERE organization_id = NEW.organization_id
       AND id = material.inventory_item_id
       AND quantity_on_hand >= material.quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: %', material.name
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consume_inventory_for_approved_quote ON public.quotes;
CREATE TRIGGER consume_inventory_for_approved_quote
  AFTER UPDATE OF status ON public.quotes
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.consume_inventory_for_approved_quote();

CREATE OR REPLACE FUNCTION public.restore_inventory_before_quote_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'approved' THEN
    UPDATE public.inventory_items stock
       SET quantity_on_hand = stock.quantity_on_hand + items.quantity
      FROM (
        SELECT inventory_item_id, SUM(quantity) AS quantity
          FROM public.quote_items
         WHERE organization_id = OLD.organization_id
           AND quote_id = OLD.id
           AND inventory_item_id IS NOT NULL
         GROUP BY inventory_item_id
      ) items
     WHERE stock.organization_id = OLD.organization_id
       AND stock.id = items.inventory_item_id;
    PERFORM set_config('jb.restoring_quote_id', OLD.id::TEXT, true);
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS restore_inventory_before_quote_delete ON public.quotes;
CREATE TRIGGER restore_inventory_before_quote_delete
  BEFORE DELETE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_inventory_before_quote_delete();

CREATE OR REPLACE FUNCTION public.update_quote_with_items(
  p_organization_id UUID,
  p_quote_id UUID,
  p_customer_id UUID,
  p_valid_until DATE,
  p_notes TEXT,
  p_discount TEXT,
  p_subtotal TEXT,
  p_total TEXT,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_status public.quote_status;
  caller_role public.organization_role;
BEGIN
  caller_role := public.get_user_organization_role(p_organization_id, auth.uid());
  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence a esta organização.'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'A lista de itens do orçamento é inválida.'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'O orçamento precisa ter pelo menos um item.'
      USING ERRCODE = '22023';
  END IF;

  SELECT status
    INTO current_status
    FROM public.quotes
   WHERE organization_id = p_organization_id
     AND id = p_quote_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.'
      USING ERRCODE = 'P0002';
  END IF;

  IF current_status NOT IN ('draft', 'sent', 'approved')
     AND caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Este orçamento só pode ser editado por um proprietário ou administrador.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.quotes
     SET customer_id = p_customer_id,
         valid_until = p_valid_until,
         notes = p_notes,
         discount = p_discount::NUMERIC,
         subtotal = p_subtotal::NUMERIC,
         total = p_total::NUMERIC
   WHERE organization_id = p_organization_id
     AND id = p_quote_id;

  DELETE FROM public.quote_items
   WHERE organization_id = p_organization_id
     AND quote_id = p_quote_id;

  INSERT INTO public.quote_items (
    organization_id,
    quote_id,
    description,
    quantity,
    unit_price,
    total,
    sort_order,
    inventory_item_id,
    unit
  )
  SELECT
    p_organization_id,
    p_quote_id,
    item.value->>'description',
    (item.value->>'quantity')::NUMERIC,
    (item.value->>'unit_price')::NUMERIC,
    (item.value->>'total')::NUMERIC,
    (item.ordinality - 1)::INTEGER,
    NULLIF(item.value->>'inventory_item_id', '')::UUID,
    NULLIF(item.value->>'unit', '')
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS item(value, ordinality);
END;
$$;

REVOKE ALL ON FUNCTION public.update_quote_with_items(
  UUID, UUID, UUID, DATE, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_quote_with_items(
  UUID, UUID, UUID, DATE, TEXT, TEXT, TEXT, TEXT, JSONB
) TO authenticated;
