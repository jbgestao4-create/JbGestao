-- 00134_mercadopago_auto_invoice_settlement.sql
-- Baixa automática de faturas do sistema e contratos ao aprovar pagamento PIX Mercado Pago
-- Permissões RLS para membros de organizações visualizarem suas faturas e contratos

-- 1. Políticas RLS para visualização de contratos e faturas por membros da organização
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'software_contracts' 
      AND policyname = 'Organization members can view own software contracts'
  ) THEN
    CREATE POLICY "Organization members can view own software contracts"
    ON public.software_contracts
    FOR SELECT
    TO authenticated
    USING (
      company_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'software_contract_invoices' 
      AND policyname = 'Organization members can view own software contract invoices'
  ) THEN
    CREATE POLICY "Organization members can view own software contract invoices"
    ON public.software_contract_invoices
    FOR SELECT
    TO authenticated
    USING (
      company_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
      )
      OR contract_id IN (
        SELECT id 
        FROM public.software_contracts 
        WHERE company_id IN (
          SELECT organization_id 
          FROM public.organization_members 
          WHERE user_id = auth.uid()
        )
      )
    );
  END IF;
END $$;

-- 2. Atualização completa da RPC de processamento e baixa automática de pagamentos Mercado Pago
CREATE OR REPLACE FUNCTION public.process_mercadopago_payment_approval(
  p_mp_payment_id BIGINT,
  p_raw_data JSONB DEFAULT NULL,
  p_status_detail TEXT DEFAULT 'accredited'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tx RECORD;
  v_org RECORD;
  v_plan RECORD;
  v_current_expiry TIMESTAMPTZ;
  v_new_expiry TIMESTAMPTZ;
  v_days_to_add INT;
  v_inv_id UUID;
  v_contract RECORD;
  v_inv_num TEXT;
BEGIN
  -- 1. Busca a transação PIX pelo ID do Mercado Pago
  SELECT * INTO v_tx
  FROM public.mercadopago_pix_transactions
  WHERE mp_payment_id = p_mp_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transação PIX não encontrada para o pagamento ' || p_mp_payment_id
    );
  END IF;

  -- 2. Se já foi aprovada e a licença foi ativada anteriormente, garante apenas que a fatura pendente seja baixada (sem somar +30 dias de novo)
  IF v_tx.status = 'approved' AND v_tx.license_activated = true THEN
    IF v_tx.contract_invoice_id IS NOT NULL THEN
      UPDATE public.software_contract_invoices
      SET status = 'paid', payment_date = COALESCE(payment_date, CURRENT_DATE), payment_method = COALESCE(payment_method, 'PIX'), updated_at = NOW()
      WHERE id = v_tx.contract_invoice_id AND status IN ('pending', 'overdue');
    ELSIF v_tx.organization_id IS NOT NULL THEN
      SELECT name INTO v_org FROM public.organizations WHERE id = v_tx.organization_id;
      UPDATE public.software_contract_invoices
      SET status = 'paid', payment_date = COALESCE(payment_date, CURRENT_DATE), payment_method = COALESCE(payment_method, 'PIX'), updated_at = NOW()
      WHERE id = (
        SELECT id FROM public.software_contract_invoices
        WHERE (
          company_id = v_tx.organization_id
          OR contract_id IN (SELECT id FROM public.software_contracts WHERE company_id = v_tx.organization_id)
          OR (v_org.name IS NOT NULL AND LOWER(TRIM(client_name)) = LOWER(TRIM(v_org.name)))
          OR (v_tx.payer_name IS NOT NULL AND LOWER(TRIM(client_name)) = LOWER(TRIM(v_tx.payer_name)))
        )
        AND status IN ('pending', 'overdue')
        ORDER BY due_date ASC
        LIMIT 1
      );
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'organization_id', v_tx.organization_id
    );
  END IF;

  v_days_to_add := COALESCE(v_tx.license_days_granted, 30);

  -- 3. Atualiza a organização vinculada (renovando +30 dias de licença)
  SELECT * INTO v_org
  FROM public.organizations
  WHERE id = v_tx.organization_id
  FOR UPDATE;

  IF FOUND THEN
    v_current_expiry := v_org.trial_ends_at;
    IF v_current_expiry IS NOT NULL AND v_current_expiry > NOW() THEN
      v_new_expiry := v_current_expiry + (v_days_to_add || ' days')::INTERVAL;
    ELSE
      v_new_expiry := NOW() + (v_days_to_add || ' days')::INTERVAL;
    END IF;

    -- Atualiza a organização para ATIVA e define a nova data de expiração
    UPDATE public.organizations
    SET 
      is_active = true,
      trial_ends_at = v_new_expiry,
      access_plan_id = COALESCE(v_tx.access_plan_id, v_org.access_plan_id),
      updated_at = NOW()
    WHERE id = v_org.id;

    -- Se um plano de acesso estiver associado, sincroniza os módulos
    IF v_tx.access_plan_id IS NOT NULL THEN
      SELECT * INTO v_plan
      FROM public.access_plans
      WHERE id = v_tx.access_plan_id;

      IF FOUND AND v_plan.module_codes IS NOT NULL THEN
        DELETE FROM public.organization_dashboard_modules
        WHERE organization_id = v_org.id;

        INSERT INTO public.organization_dashboard_modules (organization_id, module_code)
        SELECT v_org.id, module_code
        FROM unnest(v_plan.module_codes) AS module_code
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    -- Se houver contrato de software suspenso ou rascunho, reativa-o
    UPDATE public.software_contracts
    SET 
      status = 'active',
      updated_at = NOW()
    WHERE company_id = v_org.id
      AND status IN ('suspended', 'draft');
  END IF;

  -- 4. BAIXA AUTOMÁTICA NA FATURA DA EMPRESA
  -- Caso 4A: A transação foi criada atrelada a uma fatura específica
  IF v_tx.contract_invoice_id IS NOT NULL THEN
    UPDATE public.software_contract_invoices
    SET 
      status = 'paid',
      payment_date = CURRENT_DATE,
      payment_method = 'PIX',
      updated_at = NOW()
    WHERE id = v_tx.contract_invoice_id;

  -- Caso 4B: A transação não possui contract_invoice_id explícito, mas possui organização vinculada
  ELSIF v_tx.organization_id IS NOT NULL THEN
    -- Busca a fatura mais antiga pendente ou vencida da empresa, do seu contrato ou pelo nome do cliente
    SELECT id INTO v_inv_id
    FROM public.software_contract_invoices
    WHERE (
      company_id = v_tx.organization_id
      OR contract_id IN (SELECT id FROM public.software_contracts WHERE company_id = v_tx.organization_id)
      OR (v_org.name IS NOT NULL AND LOWER(TRIM(client_name)) = LOWER(TRIM(v_org.name)))
      OR (v_tx.payer_name IS NOT NULL AND LOWER(TRIM(client_name)) = LOWER(TRIM(v_tx.payer_name)))
    )
      AND status IN ('pending', 'overdue')
    ORDER BY due_date ASC
    LIMIT 1;

    IF v_inv_id IS NOT NULL THEN
      -- Dá baixa na fatura encontrada
      UPDATE public.software_contract_invoices
      SET 
        status = 'paid',
        payment_date = CURRENT_DATE,
        payment_method = 'PIX',
        updated_at = NOW()
      WHERE id = v_inv_id;

      -- Associa à transação PIX
      UPDATE public.mercadopago_pix_transactions
      SET contract_invoice_id = v_inv_id
      WHERE id = v_tx.id;
    ELSE
      -- Se não existia fatura aberta, verifica se há um contrato cadastrado e gera o recibo/fatura quitada
      SELECT * INTO v_contract
      FROM public.software_contracts
      WHERE company_id = v_tx.organization_id
      LIMIT 1;

      IF FOUND THEN
        v_inv_num := 'FAT-' || REPLACE(v_contract.contract_number, 'CTR-', '') || '-' || TO_CHAR(NOW(), 'YYMMDDHH24MI');
        
        INSERT INTO public.software_contract_invoices (
          contract_id,
          company_id,
          invoice_number,
          client_name,
          client_document,
          reference_month,
          amount,
          due_date,
          payment_date,
          payment_method,
          status,
          notes
        ) VALUES (
          v_contract.id,
          v_tx.organization_id,
          v_inv_num,
          v_contract.client_name,
          v_contract.client_document,
          TO_CHAR(CURRENT_DATE, 'MM/YYYY'),
          COALESCE(v_tx.amount, v_contract.monthly_fee),
          CURRENT_DATE,
          CURRENT_DATE,
          'PIX',
          'paid',
          'Fatura quitada automaticamente via PIX Mercado Pago (Renovação de Licença).'
        )
        RETURNING id INTO v_inv_id;

        UPDATE public.mercadopago_pix_transactions
        SET contract_invoice_id = v_inv_id
        WHERE id = v_tx.id;
      END IF;
    END IF;
  END IF;

  -- 5. Atualiza o status da transação PIX para APROVADA
  UPDATE public.mercadopago_pix_transactions
  SET 
    status = 'approved',
    status_detail = p_status_detail,
    paid_at = NOW(),
    license_activated = true,
    raw_response = COALESCE(p_raw_data, raw_response),
    updated_at = NOW()
  WHERE id = v_tx.id;

  RETURN jsonb_build_object(
    'success', true,
    'mp_payment_id', p_mp_payment_id,
    'organization_id', v_tx.organization_id,
    'days_added', v_days_to_add,
    'new_expiry', v_new_expiry,
    'invoice_settled_id', COALESCE(v_tx.contract_invoice_id, v_inv_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_mercadopago_payment_approval(BIGINT, JSONB, TEXT) TO anon, authenticated, service_role;
