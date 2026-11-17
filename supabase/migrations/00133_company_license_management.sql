-- Migração 00133: Gestão de Licença com 30 dias de ciclo + 5 dias de carência e bloqueio por inadimplência

-- 1. Função RPC para somar dias de licença à empresa (estendendo se já estiver ativa ou iniciando de hoje)
CREATE OR REPLACE FUNCTION public.admin_add_company_license_days(
  p_company_id UUID,
  p_days INT DEFAULT 30
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_expiry TIMESTAMPTZ;
  v_new_expiry TIMESTAMPTZ;
BEGIN
  SELECT trial_ends_at INTO v_current_expiry
  FROM public.organizations
  WHERE id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organização não encontrada: %', p_company_id;
  END IF;

  -- Se a licença atual ainda estiver ativa (futura), soma aos dias que restam
  IF v_current_expiry IS NOT NULL AND v_current_expiry > NOW() THEN
    v_new_expiry := v_current_expiry + (p_days || ' days')::INTERVAL;
  ELSE
    -- Se estava vencida, em carência ou sem data, inicia 30 dias a partir de agora
    v_new_expiry := NOW() + (p_days || ' days')::INTERVAL;
  END IF;

  UPDATE public.organizations
  SET 
    is_active = true,
    trial_ends_at = v_new_expiry,
    updated_at = NOW()
  WHERE id = p_company_id;

  RETURN v_new_expiry;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_add_company_license_days(UUID, INT) TO anon, authenticated, service_role;

-- 2. Atualiza a RPC de aprovação de pagamento Mercado Pago para garantir soma consistente de 30 dias
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
BEGIN
  -- 1. Busca a transação PIX
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

  -- 2. Se já aprovada e licença ativada, evita processamento duplicado
  IF v_tx.status = 'approved' AND v_tx.license_activated = true THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'organization_id', v_tx.organization_id
    );
  END IF;

  v_days_to_add := COALESCE(v_tx.license_days_granted, 30);

  -- 3. Busca a organização vinculada
  SELECT * INTO v_org
  FROM public.organizations
  WHERE id = v_tx.organization_id
  FOR UPDATE;

  IF FOUND THEN
    -- Calcula a nova data de expiração adicionando dias à data atual ou estendendo a data futura se ainda estiver ativa
    v_current_expiry := v_org.trial_ends_at;
    IF v_current_expiry IS NOT NULL AND v_current_expiry > NOW() THEN
      v_new_expiry := v_current_expiry + (v_days_to_add || ' days')::INTERVAL;
    ELSE
      v_new_expiry := NOW() + (v_days_to_add || ' days')::INTERVAL;
    END IF;

    -- Atualiza a organização para ATIVA e define a nova validade
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
  END IF;

  -- 4. Se a transação estiver atrelada a uma fatura de contrato, marca como PAGA
  IF v_tx.contract_invoice_id IS NOT NULL THEN
    UPDATE public.software_contract_invoices
    SET 
      status = 'paid',
      payment_date = CURRENT_DATE,
      payment_method = 'PIX',
      updated_at = NOW()
    WHERE id = v_tx.contract_invoice_id;
  END IF;

  -- 5. Atualiza o registro da transação PIX com status de sucesso
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
    'new_expiry', v_new_expiry
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_mercadopago_payment_approval(BIGINT, JSONB, TEXT) TO anon, authenticated, service_role;
