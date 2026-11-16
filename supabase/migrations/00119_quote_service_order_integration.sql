-- 00119_quote_service_order_integration.sql
-- Integração completa entre Orçamentos (quotes), Ordens de Serviço (service_orders) e Vendas (sales)
-- Contempla vínculo bidirecional, controle de versão do orçamento, detecção de alterações comerciais,
-- bloqueio de finalização enquanto pendente de aprovação, reaprovação automática e histórico auditável.

-- 1. Novos campos na tabela quotes para vínculo com O.S., versionamento e histórico de aprovações
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS service_order_id UUID,
  ADD COLUMN IF NOT EXISTS service_order_number TEXT,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approval_history JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.quotes.service_order_id IS 'Ordem de Serviço (O.S.) gerada a partir deste orçamento aprovado';
COMMENT ON COLUMN public.quotes.service_order_number IS 'Número da Ordem de Serviço vinculada (ex: OS-2026-0001)';
COMMENT ON COLUMN public.quotes.version IS 'Versão comercial do orçamento (incrementada a cada revisão originada na O.S.)';
COMMENT ON COLUMN public.quotes.approval_history IS 'Histórico preservado das aprovações anteriores e revisões comerciais';

-- 2. Novos campos na tabela service_orders para vínculo com Orçamento, snapshot aprovado e histórico
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quote_number TEXT,
  ADD COLUMN IF NOT EXISTS quote_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approved_quote_snapshot JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.service_orders.quote_id IS 'Orçamento de origem vinculado a esta Ordem de Serviço';
COMMENT ON COLUMN public.service_orders.quote_number IS 'Número do orçamento de origem (ex: ORC-2026-1234)';
COMMENT ON COLUMN public.service_orders.quote_version IS 'Versão do orçamento com a qual a O.S. está sincronizada';
COMMENT ON COLUMN public.service_orders.approved_quote_snapshot IS 'Snapshot comercial dos itens e valores aprovados pelo cliente';
COMMENT ON COLUMN public.service_orders.status_history IS 'Histórico de transições de status e eventos comerciais da O.S.';

-- 3. Vincula FK de quotes.service_order_id para service_orders.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_quotes_service_order_id'
      AND conrelid = 'public.quotes'::regclass
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT fk_quotes_service_order_id
      FOREIGN KEY (service_order_id)
      REFERENCES public.service_orders(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- 4. Atualiza constraint de status de service_orders para suportar 'approved', 'pending_approval', 'queue', 'finalized'
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = ANY(con.conkey)
    WHERE con.conrelid = 'public.service_orders'::regclass
      AND con.contype = 'c'
      AND att.attname = 'status'
  LOOP
    EXECUTE format('ALTER TABLE public.service_orders DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.service_orders
  ADD CONSTRAINT service_orders_status_check CHECK (
    status IN (
      'queue',
      'pending',
      'in_maintenance',
      'waiting_parts',
      'approved',
      'pending_approval',
      'finalized',
      'ready',
      'closed'
    )
  );

-- 5. Índices e proteção contra duplicidade de O.S. para o mesmo orçamento
CREATE INDEX IF NOT EXISTS idx_quotes_service_order_id
  ON public.quotes (organization_id, service_order_id)
  WHERE service_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_orders_quote_id
  ON public.service_orders (organization_id, quote_id)
  WHERE quote_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_orders_org_quote
  ON public.service_orders (organization_id, quote_id)
  WHERE quote_id IS NOT NULL;

-- 6. Tabela dedicada de histórico de integração entre Orçamento, O.S. e Venda
CREATE TABLE IF NOT EXISTS public.quote_service_order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE,
  service_order_id UUID REFERENCES public.service_orders(id) ON DELETE CASCADE,
  sale_id UUID,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'os_created_from_quote',
      'commercial_change_detected',
      'quote_reapproved',
      'quote_rejected',
      'os_finalized',
      'sent_to_sale',
      'status_changed'
    )
  ),
  quote_version INTEGER NOT NULL DEFAULT 1,
  previous_quote_status TEXT,
  new_quote_status TEXT,
  previous_os_status TEXT,
  new_os_status TEXT,
  previous_total NUMERIC(12, 2),
  new_total NUMERIC(12, 2),
  description TEXT NOT NULL,
  changes_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_os_history_quote
  ON public.quote_service_order_history (organization_id, quote_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_os_history_os
  ON public.quote_service_order_history (organization_id, service_order_id, created_at DESC);

ALTER TABLE public.quote_service_order_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros consultam historico orcamento os" ON public.quote_service_order_history;
CREATE POLICY "Membros consultam historico orcamento os"
  ON public.quote_service_order_history FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Membros registram historico orcamento os" ON public.quote_service_order_history;
CREATE POLICY "Membros registram historico orcamento os"
  ON public.quote_service_order_history FOR INSERT
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- 7. Atualiza RPC update_quote_with_items para preservar item_type e service_id nos itens do orçamento
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
         total = p_total::NUMERIC,
         updated_at = NOW()
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
    unit,
    item_type,
    service_id
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
    NULLIF(item.value->>'unit', ''),
    COALESCE(NULLIF(item.value->>'item_type', ''), CASE WHEN NULLIF(item.value->>'service_id', '') IS NOT NULL THEN 'service' ELSE 'product' END),
    NULLIF(item.value->>'service_id', '')::UUID
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS item(value, ordinality);
END;
$$;

-- 8. Evita baixa duplicada de estoque quando uma Venda (VND-...) é gerada a partir de um Orçamento já aprovado
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
  origin_status public.quote_status;
BEGIN
  -- Se este registro for uma Venda (origin_quote_id preenchido) derivada de um orçamento já aprovado/concluído,
  -- o estoque já foi baixado na aprovação do orçamento original.
  IF NEW.origin_quote_id IS NOT NULL THEN
    SELECT status INTO origin_status
      FROM public.quotes
     WHERE id = NEW.origin_quote_id
       AND organization_id = NEW.organization_id;
    IF origin_status IN ('approved', 'completed') THEN
      RETURN NEW;
    END IF;
  END IF;

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

-- 9. Atualiza approve_customer_portal_quote para liberar automaticamente a O.S. vinculada (Fluxo 3)
CREATE OR REPLACE FUNCTION public.approve_customer_portal_quote(
  p_token TEXT,
  p_quote_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_record RECORD;
  v_quote_record RECORD;
  v_os_record RECORD;
  v_items_snapshot JSONB;
  v_snapshot JSONB;
  v_history_entry JSONB;
BEGIN
  -- 1. Localiza e valida o token
  SELECT id, organization_id, customer_id, expires_at
  INTO v_token_record
  FROM public.customer_portal_tokens
  WHERE token = p_token;

  IF v_token_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TOKEN_NOT_FOUND',
      'message', 'Link de orçamento inválido ou não encontrado.'
    );
  END IF;

  IF v_token_record.expires_at IS NOT NULL AND v_token_record.expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TOKEN_EXPIRED',
      'message', 'Este link de orçamento expirou. Solicite um novo link atualizado à empresa.'
    );
  END IF;

  -- 2. Localiza o orçamento vinculado
  SELECT id, quote_number, status, subtotal, discount, total, COALESCE(version, 1) AS version, service_order_id
  INTO v_quote_record
  FROM public.quotes
  WHERE id = p_quote_id
    AND organization_id = v_token_record.organization_id
    AND customer_id = v_token_record.customer_id;

  IF v_quote_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'QUOTE_NOT_FOUND',
      'message', 'Orçamento não encontrado para este cliente.'
    );
  END IF;

  IF v_quote_record.status = 'approved' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Este orçamento já se encontra aprovado.'
    );
  END IF;

  IF v_quote_record.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'QUOTE_ALREADY_COMPLETED',
      'message', 'Este orçamento já foi concluído ou faturado.'
    );
  END IF;

  IF v_quote_record.status = 'rejected' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'QUOTE_REJECTED',
      'message', 'Este orçamento foi cancelado ou recusado.'
    );
  END IF;

  -- 3. Monta snapshot dos itens aprovados
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', qi.id,
        'itemType', COALESCE(qi.item_type, CASE WHEN qi.service_id IS NOT NULL THEN 'service' ELSE 'product' END),
        'inventoryItemId', qi.inventory_item_id,
        'serviceId', qi.service_id,
        'description', qi.description,
        'unit', COALESCE(qi.unit, 'UN'),
        'quantity', qi.quantity::text,
        'unitPrice', qi.unit_price::text,
        'total', qi.total::text
      )
      ORDER BY qi.sort_order ASC, qi.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_items_snapshot
  FROM public.quote_items qi
  WHERE qi.quote_id = v_quote_record.id
    AND qi.organization_id = v_token_record.organization_id;

  v_snapshot := jsonb_build_object(
    'version', v_quote_record.version,
    'subtotal', v_quote_record.subtotal::text,
    'discount', v_quote_record.discount::text,
    'total', v_quote_record.total::text,
    'approvedBy', 'client',
    'approvedAt', NOW(),
    'items', v_items_snapshot
  );

  v_history_entry := jsonb_build_object(
    'id', gen_random_uuid(),
    'timestamp', NOW(),
    'eventType', CASE WHEN v_quote_record.version > 1 THEN 'quote_reapproved' ELSE 'status_changed' END,
    'quoteVersion', v_quote_record.version,
    'previousQuoteStatus', v_quote_record.status,
    'newQuoteStatus', 'approved',
    'newTotal', v_quote_record.total::text,
    'actorName', 'Cliente (Portal)',
    'description', format('Orçamento v%s aprovado pelo cliente no portal (Total: R$ %s)', v_quote_record.version, v_quote_record.total)
  );

  -- 4. Atualiza orçamento para aprovado pelo cliente
  UPDATE public.quotes
  SET status = 'approved',
      approved_by = 'client',
      approved_at = NOW(),
      approval_history = COALESCE(approval_history, '[]'::jsonb) || jsonb_build_array(v_history_entry),
      updated_at = NOW()
  WHERE id = v_quote_record.id;

  -- 5. Identifica automaticamente a O.S. vinculada e atualiza seu status para APROVADA (Fluxo 3)
  SELECT id, order_number, status
  INTO v_os_record
  FROM public.service_orders
  WHERE organization_id = v_token_record.organization_id
    AND (quote_id = v_quote_record.id OR id = v_quote_record.service_order_id)
  LIMIT 1;

  IF v_os_record.id IS NOT NULL AND v_os_record.status IN ('pending_approval', 'pending', 'waiting_parts') THEN
    UPDATE public.service_orders
    SET status = 'approved',
        quote_version = v_quote_record.version,
        approved_quote_snapshot = v_snapshot,
        status_history = COALESCE(status_history, '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object(
            'id', gen_random_uuid(),
            'timestamp', NOW(),
            'eventType', 'quote_reapproved',
            'quoteVersion', v_quote_record.version,
            'previousOsStatus', v_os_record.status,
            'newOsStatus', 'approved',
            'newTotal', v_quote_record.total::text,
            'actorName', 'Cliente (Portal)',
            'description', format('Orçamento #%s (v%s) aprovado pelo cliente. O.S. liberada com status Aprovada.', v_quote_record.quote_number, v_quote_record.version)
          )
        ),
        updated_at = NOW()
    WHERE id = v_os_record.id;

    INSERT INTO public.quote_service_order_history (
      organization_id,
      quote_id,
      service_order_id,
      event_type,
      quote_version,
      previous_quote_status,
      new_quote_status,
      previous_os_status,
      new_os_status,
      new_total,
      description,
      actor_name
    ) VALUES (
      v_token_record.organization_id,
      v_quote_record.id,
      v_os_record.id,
      'quote_reapproved',
      v_quote_record.version,
      v_quote_record.status::text,
      'approved',
      v_os_record.status,
      'approved',
      v_quote_record.total,
      format('Segunda aprovação do orçamento #%s (v%s) pelo cliente no portal. O.S. #%s atualizada para Aprovada.', v_quote_record.quote_number, v_quote_record.version, v_os_record.order_number),
      'Cliente (Portal)'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Orçamento aprovado com sucesso!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_customer_portal_quote(TEXT, UUID) TO anon, authenticated;

-- 10. Atualiza reject_customer_portal_quote para manter a O.S. bloqueada caso o cliente recuse a alteração
CREATE OR REPLACE FUNCTION public.reject_customer_portal_quote(
  p_token TEXT,
  p_quote_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_record RECORD;
  v_quote_record RECORD;
  v_os_record RECORD;
BEGIN
  SELECT id, organization_id, customer_id, expires_at
  INTO v_token_record
  FROM public.customer_portal_tokens
  WHERE token = p_token;

  IF v_token_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TOKEN_NOT_FOUND',
      'message', 'Link de orçamento inválido ou não encontrado.'
    );
  END IF;

  IF v_token_record.expires_at IS NOT NULL AND v_token_record.expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TOKEN_EXPIRED',
      'message', 'Este link de orçamento expirou. Solicite um novo link atualizado à empresa.'
    );
  END IF;

  SELECT id, quote_number, status, total, COALESCE(version, 1) AS version, service_order_id
  INTO v_quote_record
  FROM public.quotes
  WHERE id = p_quote_id
    AND organization_id = v_token_record.organization_id
    AND customer_id = v_token_record.customer_id;

  IF v_quote_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'QUOTE_NOT_FOUND',
      'message', 'Orçamento não encontrado para este cliente.'
    );
  END IF;

  IF v_quote_record.status = 'rejected' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Este orçamento já se encontra recusado.'
    );
  END IF;

  IF v_quote_record.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'QUOTE_ALREADY_COMPLETED',
      'message', 'Este orçamento já foi concluído ou faturado.'
    );
  END IF;

  IF v_quote_record.status = 'approved' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'QUOTE_ALREADY_APPROVED',
      'message', 'Este orçamento já foi aprovado e não pode ser recusado pelo portal.'
    );
  END IF;

  UPDATE public.quotes
  SET status = 'rejected',
      approved_by = NULL,
      updated_at = NOW()
  WHERE id = v_quote_record.id;

  SELECT id, order_number, status
  INTO v_os_record
  FROM public.service_orders
  WHERE organization_id = v_token_record.organization_id
    AND (quote_id = v_quote_record.id OR id = v_quote_record.service_order_id)
  LIMIT 1;

  IF v_os_record.id IS NOT NULL THEN
    UPDATE public.service_orders
    SET status = 'pending_approval',
        status_history = COALESCE(status_history, '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object(
            'id', gen_random_uuid(),
            'timestamp', NOW(),
            'eventType', 'quote_rejected',
            'quoteVersion', v_quote_record.version,
            'previousOsStatus', v_os_record.status,
            'newOsStatus', 'pending_approval',
            'newTotal', v_quote_record.total::text,
            'actorName', 'Cliente (Portal)',
            'description', format('Cliente recusou a versão v%s do Orçamento #%s no portal. A O.S. permanece bloqueada para finalização.', v_quote_record.version, v_quote_record.quote_number)
          )
        ),
        updated_at = NOW()
    WHERE id = v_os_record.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Orçamento recusado com sucesso.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_customer_portal_quote(TEXT, UUID) TO anon, authenticated;

-- 11. Atualiza access_customer_portal_quotes para expor version do orçamento no portal do cliente
CREATE OR REPLACE FUNCTION public.access_customer_portal_quotes(
  p_token TEXT,
  p_document TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_record RECORD;
  v_cust_record RECORD;
  v_org_record RECORD;
  v_input_doc TEXT;
  v_stored_doc TEXT;
  v_quotes_json JSONB;
BEGIN
  v_input_doc := regexp_replace(COALESCE(p_document, ''), '\D', '', 'g');

  IF length(v_input_doc) < 11 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_DOCUMENT_FORMAT',
      'message', 'Por favor, informe um CPF válido com 11 dígitos ou CNPJ com 14 dígitos.'
    );
  END IF;

  SELECT id, organization_id, customer_id, quote_id, expires_at
  INTO v_token_record
  FROM public.customer_portal_tokens
  WHERE token = p_token;

  IF v_token_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TOKEN_NOT_FOUND',
      'message', 'Link de orçamento inválido ou não encontrado.'
    );
  END IF;

  IF v_token_record.expires_at IS NOT NULL AND v_token_record.expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TOKEN_EXPIRED',
      'message', 'Este link de orçamento expirou. Solicite um novo link atualizado à empresa.'
    );
  END IF;

  SELECT id, organization_id, name, document, phone, email, address, address_number
  INTO v_cust_record
  FROM public.customers
  WHERE id = v_token_record.customer_id
    AND organization_id = v_token_record.organization_id;

  IF v_cust_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CUSTOMER_NOT_FOUND',
      'message', 'Cadastro do cliente não encontrado.'
    );
  END IF;

  v_stored_doc := regexp_replace(COALESCE(v_cust_record.document, ''), '\D', '', 'g');

  IF v_stored_doc = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NO_DOCUMENT_ON_FILE',
      'message', 'O cadastro deste orçamento ainda não possui CPF/CNPJ registrado. Solicite à empresa que atualize o seu documento para liberar o acesso seguro.'
    );
  END IF;

  IF v_input_doc <> v_stored_doc THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DOCUMENT_MISMATCH',
      'message', 'O CPF/CNPJ informado não coincide com o cadastro deste orçamento. Verifique os dados digitados e tente novamente.'
    );
  END IF;

  UPDATE public.customer_portal_tokens
  SET last_accessed_at = NOW(),
      access_count = access_count + 1
  WHERE id = v_token_record.id;

  SELECT id, name
  INTO v_org_record
  FROM public.organizations
  WHERE id = v_token_record.organization_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'quoteNumber', q.quote_number,
        'status', q.status,
        'version', COALESCE(q.version, 1),
        'approvedBy', q.approved_by,
        'subtotal', q.subtotal::text,
        'discount', q.discount::text,
        'total', q.total::text,
        'validUntil', q.valid_until,
        'notes', q.notes,
        'createdAt', q.created_at,
        'updatedAt', q.updated_at,
        'sellerName', q.seller_name,
        'items', (
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', qi.id,
                'description', qi.description,
                'quantity', qi.quantity::text,
                'unitPrice', qi.unit_price::text,
                'total', qi.total::text,
                'unit', qi.unit,
                'itemType', qi.item_type,
                'sortOrder', qi.sort_order
              )
              ORDER BY qi.sort_order ASC, qi.created_at ASC
            ),
            '[]'::jsonb
          )
          FROM public.quote_items qi
          WHERE qi.quote_id = q.id
        )
      )
      ORDER BY q.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_quotes_json
  FROM public.quotes q
  WHERE q.organization_id = v_token_record.organization_id
    AND q.customer_id = v_token_record.customer_id
    AND q.quote_number NOT LIKE 'VND-%';

  RETURN jsonb_build_object(
    'success', true,
    'customer', jsonb_build_object(
      'id', v_cust_record.id,
      'name', v_cust_record.name,
      'email', v_cust_record.email,
      'phone', v_cust_record.phone,
      'address', v_cust_record.address,
      'addressNumber', v_cust_record.address_number
    ),
    'organization', jsonb_build_object(
      'id', v_org_record.id,
      'name', v_org_record.name
    ),
    'highlightedQuoteId', v_token_record.quote_id,
    'quotes', v_quotes_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.access_customer_portal_quotes(TEXT, TEXT) TO anon, authenticated;
