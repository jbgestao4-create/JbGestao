CREATE TABLE IF NOT EXISTS public.cash_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  account_type TEXT NOT NULL DEFAULT 'bank'
    CHECK (account_type IN ('cash', 'bank', 'digital', 'other')),
  opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cash_accounts_org_id_name_key UNIQUE (organization_id, name),
  CONSTRAINT cash_accounts_org_id_key UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS public.cash_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
  description TEXT NOT NULL CHECK (char_length(btrim(description)) BETWEEN 2 AND 240),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL CHECK (char_length(btrim(category)) BETWEEN 2 AND 80),
  due_date DATE,
  customer_id UUID,
  supplier_id UUID,
  quote_id UUID,
  inventory_movement_id UUID,
  notes TEXT,
  canceled_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cash_entries_org_id_key UNIQUE (organization_id, id),
  CONSTRAINT cash_entries_customer_org_fk
    FOREIGN KEY (organization_id, customer_id)
    REFERENCES public.customers(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT cash_entries_supplier_org_fk
    FOREIGN KEY (organization_id, supplier_id)
    REFERENCES public.suppliers(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT cash_entries_quote_org_fk
    FOREIGN KEY (organization_id, quote_id)
    REFERENCES public.quotes(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT cash_entries_inventory_movement_org_fk
    FOREIGN KEY (organization_id, inventory_movement_id)
    REFERENCES public.inventory_movements(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT cash_entries_quote_direction_check
    CHECK (quote_id IS NULL OR direction = 'income'),
  CONSTRAINT cash_entries_movement_direction_check
    CHECK (inventory_movement_id IS NULL OR direction = 'expense')
);

CREATE UNIQUE INDEX IF NOT EXISTS cash_entries_one_per_quote
  ON public.cash_entries (organization_id, quote_id)
  WHERE quote_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cash_entries_one_per_inventory_movement
  ON public.cash_entries (organization_id, inventory_movement_id)
  WHERE inventory_movement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cash_entries_org_due_date
  ON public.cash_entries (organization_id, due_date)
  WHERE canceled_at IS NULL;
CREATE INDEX IF NOT EXISTS cash_entries_org_created
  ON public.cash_entries (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.cash_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  entry_id UUID NOT NULL,
  account_id UUID NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (
    payment_method IN ('cash', 'pix', 'debit_card', 'credit_card', 'bank_transfer', 'boleto', 'check', 'other')
  ),
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  available_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cash_payments_entry_org_fk
    FOREIGN KEY (organization_id, entry_id)
    REFERENCES public.cash_entries(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT cash_payments_account_org_fk
    FOREIGN KEY (organization_id, account_id)
    REFERENCES public.cash_accounts(organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS cash_payments_org_available_at
  ON public.cash_payments (organization_id, available_at);
CREATE INDEX IF NOT EXISTS cash_payments_entry
  ON public.cash_payments (organization_id, entry_id);

CREATE OR REPLACE FUNCTION public.can_access_cash(p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT public.is_org_member(p_organization_id, auth.uid())
    AND (
      public.get_user_organization_role(p_organization_id, auth.uid()) IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.organization_member_dashboard_modules permission
        WHERE permission.organization_id = p_organization_id
          AND permission.user_id = auth.uid()
          AND permission.module_code = 'MOD-05'
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_cash(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_cash(UUID) TO authenticated;

ALTER TABLE public.cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros autorizados consultam contas do caixa" ON public.cash_accounts;
CREATE POLICY "Membros autorizados consultam contas do caixa"
  ON public.cash_accounts FOR SELECT
  USING (public.can_access_cash(organization_id));

DROP POLICY IF EXISTS "Membros autorizados gerenciam contas do caixa" ON public.cash_accounts;
CREATE POLICY "Membros autorizados gerenciam contas do caixa"
  ON public.cash_accounts FOR ALL
  USING (public.can_access_cash(organization_id))
  WITH CHECK (public.can_access_cash(organization_id));

DROP POLICY IF EXISTS "Membros autorizados consultam lançamentos do caixa" ON public.cash_entries;
CREATE POLICY "Membros autorizados consultam lançamentos do caixa"
  ON public.cash_entries FOR SELECT
  USING (public.can_access_cash(organization_id));

DROP POLICY IF EXISTS "Membros autorizados gerenciam lançamentos do caixa" ON public.cash_entries;
CREATE POLICY "Membros autorizados gerenciam lançamentos do caixa"
  ON public.cash_entries FOR ALL
  USING (public.can_access_cash(organization_id))
  WITH CHECK (public.can_access_cash(organization_id));

DROP POLICY IF EXISTS "Membros autorizados consultam pagamentos do caixa" ON public.cash_payments;
CREATE POLICY "Membros autorizados consultam pagamentos do caixa"
  ON public.cash_payments FOR SELECT
  USING (public.can_access_cash(organization_id));

DROP POLICY IF EXISTS "Membros autorizados inserem pagamentos do caixa" ON public.cash_payments;
CREATE POLICY "Membros autorizados inserem pagamentos do caixa"
  ON public.cash_payments FOR INSERT
  WITH CHECK (public.can_access_cash(organization_id));

DROP POLICY IF EXISTS "Membros do caixa consultam orçamentos vinculados" ON public.quotes;
CREATE POLICY "Membros do caixa consultam orçamentos vinculados"
  ON public.quotes FOR SELECT
  USING (public.can_access_cash(organization_id));

DROP POLICY IF EXISTS "Membros do caixa consultam clientes vinculados" ON public.customers;
CREATE POLICY "Membros do caixa consultam clientes vinculados"
  ON public.customers FOR SELECT
  USING (public.can_access_cash(organization_id));

DROP POLICY IF EXISTS "Membros do caixa consultam fornecedores vinculados" ON public.suppliers;
CREATE POLICY "Membros do caixa consultam fornecedores vinculados"
  ON public.suppliers FOR SELECT
  USING (public.can_access_cash(organization_id));

DROP POLICY IF EXISTS "Membros do caixa consultam movimentos vinculados"
  ON public.inventory_movements;
CREATE POLICY "Membros do caixa consultam movimentos vinculados"
  ON public.inventory_movements FOR SELECT
  USING (public.can_access_cash(organization_id));

DROP POLICY IF EXISTS "Membros do caixa consultam materiais vinculados"
  ON public.inventory_items;
CREATE POLICY "Membros do caixa consultam materiais vinculados"
  ON public.inventory_items FOR SELECT
  USING (public.can_access_cash(organization_id));

CREATE OR REPLACE FUNCTION public.set_cash_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cash_accounts_set_updated_at ON public.cash_accounts;
CREATE TRIGGER cash_accounts_set_updated_at
  BEFORE UPDATE ON public.cash_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_cash_updated_at();

DROP TRIGGER IF EXISTS cash_entries_set_updated_at ON public.cash_entries;
CREATE TRIGGER cash_entries_set_updated_at
  BEFORE UPDATE ON public.cash_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_cash_updated_at();

CREATE OR REPLACE FUNCTION public.create_default_cash_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.cash_accounts (organization_id, name, account_type)
  VALUES (NEW.id, 'Conta principal', 'bank')
  ON CONFLICT (organization_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_default_cash_account ON public.organizations;
CREATE TRIGGER create_default_cash_account
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.create_default_cash_account();

INSERT INTO public.cash_accounts (organization_id, name, account_type)
SELECT organization.id, 'Conta principal', 'bank'
FROM public.organizations organization
ON CONFLICT (organization_id, name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.record_cash_payment(
  p_organization_id UUID,
  p_entry_id UUID,
  p_account_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_paid_at DATE,
  p_available_at DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  entry_row public.cash_entries%ROWTYPE;
  paid_total NUMERIC(12, 2);
  payment_id UUID;
BEGIN
  IF NOT public.can_access_cash(p_organization_id) THEN
    RAISE EXCEPTION 'Acesso negado ao gerenciamento do caixa.'
      USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor do pagamento deve ser maior que zero.'
      USING ERRCODE = '23514';
  END IF;

  SELECT *
    INTO entry_row
    FROM public.cash_entries
   WHERE organization_id = p_organization_id
     AND id = p_entry_id
   FOR UPDATE;

  IF NOT FOUND OR entry_row.canceled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Lançamento financeiro não encontrado ou cancelado.'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.cash_accounts account
    WHERE account.organization_id = p_organization_id
      AND account.id = p_account_id
      AND account.is_active
  ) THEN
    RAISE EXCEPTION 'Selecione uma conta ativa da organização.'
      USING ERRCODE = '23503';
  END IF;

  SELECT COALESCE(SUM(payment.amount), 0)
    INTO paid_total
    FROM public.cash_payments payment
   WHERE payment.organization_id = p_organization_id
     AND payment.entry_id = p_entry_id;

  IF p_amount > entry_row.amount - paid_total THEN
    RAISE EXCEPTION 'O pagamento excede o valor pendente.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.cash_payments (
    organization_id, entry_id, account_id, amount, payment_method,
    paid_at, available_at, notes, created_by
  ) VALUES (
    p_organization_id, p_entry_id, p_account_id, p_amount, p_payment_method,
    COALESCE(p_paid_at, CURRENT_DATE), COALESCE(p_available_at, COALESCE(p_paid_at, CURRENT_DATE)),
    NULLIF(btrim(p_notes), ''), auth.uid()
  )
  RETURNING id INTO payment_id;

  RETURN payment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_cash_payment(UUID, UUID, UUID, NUMERIC, TEXT, DATE, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_cash_payment(UUID, UUID, UUID, NUMERIC, TEXT, DATE, DATE, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_cash_entry(
  p_organization_id UUID,
  p_entry_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.can_access_cash(p_organization_id) THEN
    RAISE EXCEPTION 'Acesso negado ao gerenciamento do caixa.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1
    FROM public.cash_entries
   WHERE organization_id = p_organization_id
     AND id = p_entry_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lançamento financeiro não encontrado.'
      USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cash_payments
    WHERE organization_id = p_organization_id
      AND entry_id = p_entry_id
  ) THEN
    RAISE EXCEPTION 'Não é possível cancelar um lançamento com pagamentos registrados.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.cash_entries
     SET canceled_at = NOW()
   WHERE organization_id = p_organization_id
     AND id = p_entry_id
     AND canceled_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_cash_entry(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_cash_entry(UUID, UUID) TO authenticated;
