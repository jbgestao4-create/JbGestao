ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer_reference TEXT,
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  ADD COLUMN IF NOT EXISTS last_purchase_price NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (last_purchase_price >= 0),
  ADD COLUMN IF NOT EXISTS average_cost NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (average_cost >= 0),
  ADD COLUMN IF NOT EXISTS extra_purchase_cost NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (extra_purchase_cost >= 0),
  ADD COLUMN IF NOT EXISTS supplier_product_code TEXT,
  ADD COLUMN IF NOT EXISTS lead_time_days INTEGER CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
  ADD COLUMN IF NOT EXISTS last_purchase_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promotional_price NUMERIC(12, 4) CHECK (promotional_price IS NULL OR promotional_price >= 0),
  ADD COLUMN IF NOT EXISTS target_margin_percent NUMERIC(8, 4) CHECK (target_margin_percent IS NULL OR target_margin_percent >= 0),
  ADD COLUMN IF NOT EXISTS minimum_sale_price NUMERIC(12, 4) CHECK (minimum_sale_price IS NULL OR minimum_sale_price >= 0),
  ADD COLUMN IF NOT EXISTS maximum_quantity NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (maximum_quantity >= 0),
  ADD COLUMN IF NOT EXISTS ideal_restock_quantity NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (ideal_restock_quantity >= 0),
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS warehouse TEXT,
  ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS track_expiry BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS track_lot BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS track_serial_number BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fiscal_ncm TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_cest TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_origin TEXT,
  ADD COLUMN IF NOT EXISTS commercial_unit TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_product_code TEXT,
  ADD COLUMN IF NOT EXISTS gtin TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_sell BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_purchase BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS parent_item_id UUID,
  ADD COLUMN IF NOT EXISTS purchase_unit TEXT,
  ADD COLUMN IF NOT EXISTS purchase_unit_factor NUMERIC(12, 4) NOT NULL DEFAULT 1
    CHECK (purchase_unit_factor > 0),
  ADD COLUMN IF NOT EXISTS image_path TEXT;

ALTER TABLE public.inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_quantity_on_hand_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_items_stock_balance_check'
      AND conrelid = 'public.inventory_items'::regclass
  ) THEN
    ALTER TABLE public.inventory_items
      ADD CONSTRAINT inventory_items_stock_balance_check
      CHECK (quantity_on_hand >= 0 OR allow_negative_stock);
  END IF;
END;
$$;

UPDATE public.inventory_items
   SET purchase_price = unit_price,
       average_cost = unit_price,
       last_purchase_price = unit_price
 WHERE purchase_price = 0
   AND unit_price > 0;

UPDATE public.inventory_items
   SET sku = 'SKU-' || upper(substr(replace(id::TEXT, '-', ''), 1, 8))
 WHERE sku IS NULL OR btrim(sku) = '';

CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_org_sku_key
  ON public.inventory_items (organization_id, lower(sku))
  WHERE sku IS NOT NULL AND btrim(sku) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_org_barcode_key
  ON public.inventory_items (organization_id, barcode)
  WHERE barcode IS NOT NULL AND btrim(barcode) <> '';

CREATE INDEX IF NOT EXISTS inventory_items_org_category_idx
  ON public.inventory_items (organization_id, category);

CREATE INDEX IF NOT EXISTS inventory_items_org_parent_idx
  ON public.inventory_items (organization_id, parent_item_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_inventory_items_parent_org'
      AND conrelid = 'public.inventory_items'::regclass
  ) THEN
    ALTER TABLE public.inventory_items
      ADD CONSTRAINT fk_inventory_items_parent_org
      FOREIGN KEY (organization_id, parent_item_id)
      REFERENCES public.inventory_items(organization_id, id) ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.inventory_item_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  inventory_item_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  supplier_product_code TEXT,
  purchase_price NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  lead_time_days INTEGER CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_item_suppliers_org_item_supplier_key
    UNIQUE (organization_id, inventory_item_id, supplier_id),
  CONSTRAINT fk_inventory_item_suppliers_item
    FOREIGN KEY (organization_id, inventory_item_id)
    REFERENCES public.inventory_items(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_item_suppliers_supplier
    FOREIGN KEY (organization_id, supplier_id)
    REFERENCES public.suppliers(organization_id, id) ON DELETE RESTRICT
);

ALTER TABLE public.inventory_item_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros com acesso podem visualizar fornecedores de materiais"
  ON public.inventory_item_suppliers;
CREATE POLICY "Membros com acesso podem visualizar fornecedores de materiais"
  ON public.inventory_item_suppliers FOR SELECT
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1 FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = inventory_item_suppliers.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code IN ('MOD-02', 'MOD-04', 'MOD-06')
      )
    )
  );

DROP POLICY IF EXISTS "Membros com acesso podem gerenciar fornecedores de materiais"
  ON public.inventory_item_suppliers;
CREATE POLICY "Membros com acesso podem gerenciar fornecedores de materiais"
  ON public.inventory_item_suppliers FOR ALL
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1 FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = inventory_item_suppliers.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code IN ('MOD-02', 'MOD-06')
      )
    )
  )
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1 FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = inventory_item_suppliers.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code IN ('MOD-02', 'MOD-06')
      )
    )
  );

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'initial', 'entry', 'exit', 'sale', 'purchase', 'return',
    'adjustment', 'loss', 'damaged', 'quote_approval', 'quote_edit', 'quote_cancellation'
  )),
  quantity NUMERIC(12, 4) NOT NULL CHECK (quantity > 0),
  balance_before NUMERIC(12, 4) NOT NULL,
  balance_after NUMERIC(12, 4) NOT NULL,
  unit_price NUMERIC(12, 4) CHECK (unit_price IS NULL OR unit_price >= 0),
  reason TEXT NOT NULL,
  document_reference TEXT,
  supplier_id UUID,
  quote_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  idempotency_key UUID,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_inventory_movements_item
    FOREIGN KEY (organization_id, inventory_item_id)
    REFERENCES public.inventory_items(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_movements_supplier
    FOREIGN KEY (organization_id, supplier_id)
    REFERENCES public.suppliers(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT uq_inventory_movement_org_id UNIQUE (organization_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_idempotency_key
  ON public.inventory_movements (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_movements_item_date_idx
  ON public.inventory_movements (organization_id, inventory_item_id, moved_at DESC);

CREATE INDEX IF NOT EXISTS inventory_movements_quote_idx
  ON public.inventory_movements (organization_id, quote_id)
  WHERE quote_id IS NOT NULL;

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros com acesso podem consultar movimentações"
  ON public.inventory_movements;
CREATE POLICY "Membros com acesso podem consultar movimentações"
  ON public.inventory_movements FOR SELECT
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1 FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = inventory_movements.organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code IN ('MOD-02', 'MOD-04', 'MOD-06')
      )
    )
  );

CREATE OR REPLACE FUNCTION public.prevent_direct_inventory_balance_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.quantity_on_hand IS DISTINCT FROM OLD.quantity_on_hand
     AND current_setting('jb.inventory_movement', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'O saldo só pode ser alterado por uma movimentação registrada.'
      USING ERRCODE = 'P0001', MESSAGE = 'INVENTORY_MOVEMENT_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_direct_inventory_balance_change ON public.inventory_items;
CREATE TRIGGER prevent_direct_inventory_balance_change
  BEFORE UPDATE OF quantity_on_hand ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_direct_inventory_balance_change();

CREATE OR REPLACE FUNCTION public.record_inventory_movement(
  p_organization_id UUID,
  p_inventory_item_id UUID,
  p_movement_type TEXT,
  p_direction TEXT,
  p_quantity NUMERIC,
  p_reason TEXT,
  p_unit_price NUMERIC DEFAULT NULL,
  p_document_reference TEXT DEFAULT NULL,
  p_supplier_id UUID DEFAULT NULL,
  p_moved_at TIMESTAMPTZ DEFAULT NOW(),
  p_idempotency_key UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item public.inventory_items%ROWTYPE;
  before_balance NUMERIC(12, 4);
  after_balance NUMERIC(12, 4);
  new_movement_id UUID;
  role public.organization_role;
BEGIN
  role := public.get_user_organization_role(p_organization_id, auth.uid());
  IF role IS NULL OR (
    role NOT IN ('owner', 'admin')
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_member_dashboard_modules permission
      WHERE permission.organization_id = p_organization_id
        AND permission.user_id = auth.uid()
        AND permission.module_code IN ('MOD-02', 'MOD-06')
    )
  ) THEN
    RAISE EXCEPTION 'Usuário sem permissão para registrar movimentações de estoque.'
      USING ERRCODE = '42501';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0
     OR p_direction IS NULL OR p_direction NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'Informe uma quantidade maior que zero e uma direção válida.'
      USING ERRCODE = '22023';
  END IF;
  IF p_movement_type IS NULL OR p_movement_type NOT IN (
    'entry', 'exit', 'purchase', 'return', 'adjustment', 'loss', 'damaged'
  ) THEN
    RAISE EXCEPTION 'Tipo de movimentação inválido.'
      USING ERRCODE = '22023';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 2 THEN
    RAISE EXCEPTION 'Informe o motivo da movimentação.'
      USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(p_organization_id::TEXT || ':' || p_idempotency_key::TEXT, 0)
    );
    SELECT id INTO new_movement_id
      FROM public.inventory_movements
     WHERE organization_id = p_organization_id
       AND idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN new_movement_id; END IF;
  END IF;

  SELECT * INTO item
    FROM public.inventory_items
   WHERE organization_id = p_organization_id
     AND id = p_inventory_item_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado.'
      USING ERRCODE = 'P0002';
  END IF;
  IF NOT item.is_active THEN
    RAISE EXCEPTION 'Produtos inativos não podem receber movimentações.'
      USING ERRCODE = '22023';
  END IF;

  before_balance := item.quantity_on_hand;
  after_balance := before_balance + CASE WHEN p_direction = 'in' THEN p_quantity ELSE -p_quantity END;
  IF after_balance < 0 AND NOT item.allow_negative_stock THEN
    RAISE EXCEPTION 'O saldo disponível é insuficiente.'
      USING ERRCODE = 'P0001', MESSAGE = 'INSUFFICIENT_STOCK';
  END IF;

  PERFORM set_config('jb.inventory_movement', 'on', true);
  UPDATE public.inventory_items
     SET quantity_on_hand = after_balance,
         last_purchase_price = CASE
           WHEN p_direction = 'in' AND p_unit_price IS NOT NULL THEN p_unit_price
           ELSE last_purchase_price
         END,
         purchase_price = CASE
           WHEN p_direction = 'in' AND p_movement_type = 'purchase' AND p_unit_price IS NOT NULL
             THEN p_unit_price
           ELSE purchase_price
         END,
         average_cost = CASE
           WHEN p_direction = 'in' AND p_unit_price IS NOT NULL
             THEN CASE
               WHEN before_balance <= 0 THEN p_unit_price
               ELSE ((before_balance * average_cost) + (p_quantity * p_unit_price))
                    / (before_balance + p_quantity)
             END
           ELSE average_cost
         END,
         last_purchase_at = CASE
           WHEN p_direction = 'in' AND p_unit_price IS NOT NULL THEN p_moved_at
           ELSE last_purchase_at
         END
   WHERE organization_id = p_organization_id
     AND id = p_inventory_item_id;
  PERFORM set_config('jb.inventory_movement', 'off', true);

  INSERT INTO public.inventory_movements (
    organization_id, inventory_item_id, movement_type, quantity,
    balance_before, balance_after, unit_price, reason,
    document_reference, supplier_id, user_id, idempotency_key, moved_at
  ) VALUES (
    p_organization_id, p_inventory_item_id, p_movement_type, p_quantity,
    before_balance, after_balance, p_unit_price, btrim(p_reason),
    NULLIF(btrim(COALESCE(p_document_reference, '')), ''),
    p_supplier_id, auth.uid(), p_idempotency_key, COALESCE(p_moved_at, NOW())
  )
  RETURNING id INTO new_movement_id;

  RETURN new_movement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_inventory_movement(
  UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT, UUID, TIMESTAMPTZ, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_inventory_movement(
  UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT, UUID, TIMESTAMPTZ, UUID
) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_inventory_opening_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quantity_on_hand > 0 THEN
    INSERT INTO public.inventory_movements (
      organization_id, inventory_item_id, movement_type, quantity,
      balance_before, balance_after, unit_price, reason, user_id
    ) VALUES (
      NEW.organization_id, NEW.id, 'initial', NEW.quantity_on_hand,
      0, NEW.quantity_on_hand, NEW.purchase_price, 'Saldo inicial do cadastro', auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_inventory_opening_balance ON public.inventory_items;
CREATE TRIGGER record_inventory_opening_balance
  AFTER INSERT ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.record_inventory_opening_balance();

INSERT INTO public.inventory_movements (
  organization_id, inventory_item_id, movement_type, quantity,
  balance_before, balance_after, unit_price, reason, moved_at
)
SELECT item.organization_id, item.id, 'initial', item.quantity_on_hand,
       0, item.quantity_on_hand, item.purchase_price, 'Saldo inicial migrado', item.created_at
  FROM public.inventory_items item
 WHERE item.quantity_on_hand > 0
   AND NOT EXISTS (
     SELECT 1 FROM public.inventory_movements movement
     WHERE movement.organization_id = item.organization_id
       AND movement.inventory_item_id = item.id
   );

CREATE OR REPLACE FUNCTION public.prevent_inventory_movement_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'O histórico de movimentações não pode ser alterado ou removido.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_inventory_movement_mutation ON public.inventory_movements;
CREATE TRIGGER prevent_inventory_movement_mutation
  BEFORE UPDATE OR DELETE ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_inventory_movement_mutation();

CREATE OR REPLACE FUNCTION public.sync_inventory_for_quote_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_status public.quote_status;
  new_status public.quote_status;
  before_balance NUMERIC(12, 4);
  after_balance NUMERIC(12, 4);
  allow_negative_stock BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('jb.restoring_quote_id', true) = OLD.quote_id::TEXT THEN
      RETURN OLD;
    END IF;
    SELECT status INTO old_status
      FROM public.quotes
     WHERE id = OLD.quote_id AND organization_id = OLD.organization_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.inventory_item_id IS NOT DISTINCT FROM NEW.inventory_item_id
       AND OLD.quantity IS NOT DISTINCT FROM NEW.quantity THEN
      RETURN NEW;
    END IF;
    SELECT status INTO old_status
      FROM public.quotes
     WHERE id = OLD.quote_id AND organization_id = OLD.organization_id;
  END IF;

  IF TG_OP IN ('DELETE', 'UPDATE')
     AND old_status = 'approved'
     AND OLD.inventory_item_id IS NOT NULL THEN
    SELECT quantity_on_hand INTO before_balance
      FROM public.inventory_items
     WHERE organization_id = OLD.organization_id AND id = OLD.inventory_item_id
     FOR UPDATE;
    after_balance := before_balance + OLD.quantity;
    PERFORM set_config('jb.inventory_movement', 'on', true);
    UPDATE public.inventory_items
       SET quantity_on_hand = after_balance
     WHERE organization_id = OLD.organization_id AND id = OLD.inventory_item_id;
    PERFORM set_config('jb.inventory_movement', 'off', true);
    INSERT INTO public.inventory_movements (
      organization_id, inventory_item_id, movement_type, quantity,
      balance_before, balance_after, reason, quote_id, user_id
    ) VALUES (
      OLD.organization_id, OLD.inventory_item_id, 'quote_edit', OLD.quantity,
      before_balance, after_balance, 'Devolução por edição de orçamento aprovado',
      OLD.quote_id, auth.uid()
    );
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.inventory_item_id IS NOT NULL THEN
    SELECT status INTO new_status
      FROM public.quotes
     WHERE id = NEW.quote_id AND organization_id = NEW.organization_id;

    IF new_status = 'approved' THEN
      SELECT quantity_on_hand, allow_negative_stock
        INTO before_balance, allow_negative_stock
        FROM public.inventory_items
       WHERE organization_id = NEW.organization_id AND id = NEW.inventory_item_id
       FOR UPDATE;
      IF before_balance < NEW.quantity AND NOT allow_negative_stock THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK'
          USING ERRCODE = 'P0001', MESSAGE = 'INSUFFICIENT_STOCK';
      END IF;
      after_balance := before_balance - NEW.quantity;
      PERFORM set_config('jb.inventory_movement', 'on', true);
      UPDATE public.inventory_items
         SET quantity_on_hand = after_balance
       WHERE organization_id = NEW.organization_id AND id = NEW.inventory_item_id;
      PERFORM set_config('jb.inventory_movement', 'off', true);
      INSERT INTO public.inventory_movements (
        organization_id, inventory_item_id, movement_type, quantity,
        balance_before, balance_after, reason, quote_id, user_id
      ) VALUES (
        NEW.organization_id, NEW.inventory_item_id, 'quote_edit', NEW.quantity,
        before_balance, after_balance, 'Baixa por edição de orçamento aprovado',
        NEW.quote_id, auth.uid()
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_inventory_for_approved_quote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  material RECORD;
  before_balance NUMERIC(12, 4);
  after_balance NUMERIC(12, 4);
BEGIN
  FOR material IN
    SELECT items.inventory_item_id,
           SUM(items.quantity) AS quantity,
           MAX(stock.name) AS name,
           BOOL_OR(stock.allow_negative_stock) AS allow_negative_stock
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
    SELECT quantity_on_hand INTO before_balance
      FROM public.inventory_items
     WHERE organization_id = NEW.organization_id
       AND id = material.inventory_item_id
     FOR UPDATE;
    IF before_balance < material.quantity AND NOT material.allow_negative_stock THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: %', material.name
        USING ERRCODE = 'P0001', MESSAGE = 'INSUFFICIENT_STOCK';
    END IF;
    after_balance := before_balance - material.quantity;
    PERFORM set_config('jb.inventory_movement', 'on', true);
    UPDATE public.inventory_items
       SET quantity_on_hand = after_balance
     WHERE organization_id = NEW.organization_id
       AND id = material.inventory_item_id;
    PERFORM set_config('jb.inventory_movement', 'off', true);
    INSERT INTO public.inventory_movements (
      organization_id, inventory_item_id, movement_type, quantity,
      balance_before, balance_after, reason, quote_id, user_id
    ) VALUES (
      NEW.organization_id, material.inventory_item_id, 'quote_approval', material.quantity,
      before_balance, after_balance, 'Baixa por aprovação de orçamento',
      NEW.id, auth.uid()
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_inventory_before_quote_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  material RECORD;
  before_balance NUMERIC(12, 4);
  after_balance NUMERIC(12, 4);
BEGIN
  IF OLD.status = 'approved' THEN
    FOR material IN
      SELECT inventory_item_id, SUM(quantity) AS quantity
        FROM public.quote_items
       WHERE organization_id = OLD.organization_id
         AND quote_id = OLD.id
         AND inventory_item_id IS NOT NULL
       GROUP BY inventory_item_id
       ORDER BY inventory_item_id
    LOOP
      SELECT quantity_on_hand INTO before_balance
        FROM public.inventory_items
       WHERE organization_id = OLD.organization_id AND id = material.inventory_item_id
       FOR UPDATE;
      after_balance := before_balance + material.quantity;
      PERFORM set_config('jb.inventory_movement', 'on', true);
      UPDATE public.inventory_items
         SET quantity_on_hand = after_balance
       WHERE organization_id = OLD.organization_id AND id = material.inventory_item_id;
      PERFORM set_config('jb.inventory_movement', 'off', true);
      INSERT INTO public.inventory_movements (
        organization_id, inventory_item_id, movement_type, quantity,
        balance_before, balance_after, reason, quote_id, user_id
      ) VALUES (
        OLD.organization_id, material.inventory_item_id, 'quote_cancellation', material.quantity,
        before_balance, after_balance, 'Devolução por exclusão de orçamento aprovado',
        OLD.id, auth.uid()
      );
    END LOOP;
    PERFORM set_config('jb.restoring_quote_id', OLD.id::TEXT, true);
  END IF;
  RETURN OLD;
END;
$$;
