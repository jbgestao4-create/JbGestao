-- 00131_mercadopago_pix_integration.sql
-- Integração Completa com a API Oficial do Mercado Pago para Pagamentos PIX,
-- Webhook, Confirmação Automática e Liberação Instantânea de Licenças/Planos.

-- 1. TABELA DE CONFIGURAÇÕES DO GATEWAY MERCADO PAGO
CREATE TABLE IF NOT EXISTS public.mercadopago_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT NOT NULL DEFAULT '',
  public_key TEXT DEFAULT '',
  webhook_secret TEXT DEFAULT '',
  is_sandbox BOOLEAN NOT NULL DEFAULT true,
  notification_url TEXT DEFAULT 'https://controlesoft.vercel.app/api/mercadopago/webhook',
  pix_key TEXT DEFAULT '',
  auto_activate_license BOOLEAN NOT NULL DEFAULT true,
  license_duration_days INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inserir registro padrão se ainda não existir
INSERT INTO public.mercadopago_settings (
  id,
  is_sandbox,
  notification_url,
  auto_activate_license,
  license_duration_days,
  is_active
)
SELECT 
  '00000000-0000-4000-8000-000000000099'::uuid,
  true,
  'https://controlesoft.vercel.app/api/mercadopago/webhook',
  true,
  30,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.mercadopago_settings LIMIT 1
);

-- 2. TABELA DE TRANSAÇÕES E COBRANÇAS PIX DO MERCADO PAGO
CREATE TABLE IF NOT EXISTS public.mercadopago_pix_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contract_invoice_id UUID REFERENCES public.software_contract_invoices(id) ON DELETE SET NULL,
  access_plan_id UUID REFERENCES public.access_plans(id) ON DELETE SET NULL,
  access_plan_name TEXT,
  mp_payment_id BIGINT UNIQUE,
  idempotency_key UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled', 'refunded'
  status_detail TEXT,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  qr_code TEXT, -- Código PIX Copia e Cola
  qr_code_base64 TEXT, -- Imagem em Base64 do QR Code gerado pelo Mercado Pago
  ticket_url TEXT, -- Link para comprovante/ticket oficial
  payer_name TEXT,
  payer_email TEXT,
  payer_document TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  license_days_granted INTEGER NOT NULL DEFAULT 30,
  license_activated BOOLEAN NOT NULL DEFAULT false,
  raw_response JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de consulta de alta performance
CREATE INDEX IF NOT EXISTS idx_mp_pix_org_id ON public.mercadopago_pix_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_mp_pix_mp_id ON public.mercadopago_pix_transactions(mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_mp_pix_status ON public.mercadopago_pix_transactions(status);
CREATE INDEX IF NOT EXISTS idx_mp_pix_created_at ON public.mercadopago_pix_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_pix_invoice_id ON public.mercadopago_pix_transactions(contract_invoice_id);

-- 3. TABELA DE LOGS DE NOTIFICAÇÕES WEBHOOK DO MERCADO PAGO
CREATE TABLE IF NOT EXISTS public.mercadopago_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_payment_id BIGINT,
  event_type TEXT,
  action TEXT,
  payload JSONB,
  processed BOOLEAN NOT NULL DEFAULT false,
  result_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_webhook_logs_mp_id ON public.mercadopago_webhook_logs(mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_mp_webhook_logs_created_at ON public.mercadopago_webhook_logs(created_at DESC);

-- 4. HABILITAÇÃO DO ROW LEVEL SECURITY (RLS)
ALTER TABLE public.mercadopago_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercadopago_pix_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercadopago_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para mercadopago_settings (exclusivo para donos/administradores do sistema)
DROP POLICY IF EXISTS "Admins can manage mercadopago_settings" ON public.mercadopago_settings;
CREATE POLICY "Admins can manage mercadopago_settings"
ON public.mercadopago_settings
FOR ALL
TO authenticated
USING (
  public.is_access_plan_manager()
)
WITH CHECK (
  public.is_access_plan_manager()
);

-- Políticas para mercadopago_pix_transactions
DROP POLICY IF EXISTS "Admins can view and manage all transactions" ON public.mercadopago_pix_transactions;
CREATE POLICY "Admins can view and manage all transactions"
ON public.mercadopago_pix_transactions
FOR ALL
TO authenticated
USING (
  public.is_access_plan_manager()
)
WITH CHECK (
  public.is_access_plan_manager()
);

DROP POLICY IF EXISTS "Members can view their own organization transactions" ON public.mercadopago_pix_transactions;
CREATE POLICY "Members can view their own organization transactions"
ON public.mercadopago_pix_transactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = public.mercadopago_pix_transactions.organization_id
      AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can create transactions for their organization" ON public.mercadopago_pix_transactions;
CREATE POLICY "Members can create transactions for their organization"
ON public.mercadopago_pix_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = public.mercadopago_pix_transactions.organization_id
      AND om.user_id = auth.uid()
  )
);

-- Políticas para mercadopago_webhook_logs
DROP POLICY IF EXISTS "Admins can view webhook logs" ON public.mercadopago_webhook_logs;
CREATE POLICY "Admins can view webhook logs"
ON public.mercadopago_webhook_logs
FOR ALL
TO authenticated
USING (
  public.is_access_plan_manager()
)
WITH CHECK (
  public.is_access_plan_manager()
);

-- Permissões gerais
GRANT ALL ON TABLE public.mercadopago_settings TO authenticated;
GRANT ALL ON TABLE public.mercadopago_pix_transactions TO authenticated;
GRANT ALL ON TABLE public.mercadopago_webhook_logs TO authenticated;

-- Habilita Realtime para que a tela do cliente atualize instantaneamente quando aprovado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mercadopago_pix_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mercadopago_pix_transactions;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- 5. FUNÇÃO RPC: CONSULTAR CONFIGURAÇÕES PÚBLICAS DO GATEWAY
CREATE OR REPLACE FUNCTION public.get_public_mercadopago_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT jsonb_build_object(
    'is_active', COALESCE(s.is_active, false),
    'is_sandbox', COALESCE(s.is_sandbox, true),
    'public_key', COALESCE(s.public_key, ''),
    'pix_key', COALESCE(s.pix_key, ''),
    'license_duration_days', COALESCE(s.license_duration_days, 30)
  )
  FROM public.mercadopago_settings s
  ORDER BY s.updated_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_mercadopago_config() TO authenticated, anon;

-- 6. FUNÇÃO RPC: OBTER CONFIGURAÇÕES ADMINISTRATIVAS COMPLETAS
CREATE OR REPLACE FUNCTION public.admin_get_mercadopago_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  cfg public.mercadopago_settings%ROWTYPE;
BEGIN
  IF public.is_access_plan_manager() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas o desenvolvedor/proprietário pode gerenciar credenciais de pagamento.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO cfg
  FROM public.mercadopago_settings
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'access_token', '',
      'public_key', '',
      'webhook_secret', '',
      'is_sandbox', true,
      'notification_url', 'https://controlesoft.vercel.app/api/mercadopago/webhook',
      'pix_key', '',
      'auto_activate_license', true,
      'license_duration_days', 30,
      'is_active', true
    );
  END IF;

  RETURN jsonb_build_object(
    'id', cfg.id,
    'access_token', cfg.access_token,
    'public_key', cfg.public_key,
    'webhook_secret', cfg.webhook_secret,
    'is_sandbox', cfg.is_sandbox,
    'notification_url', cfg.notification_url,
    'pix_key', cfg.pix_key,
    'auto_activate_license', cfg.auto_activate_license,
    'license_duration_days', cfg.license_duration_days,
    'is_active', cfg.is_active,
    'updated_at', cfg.updated_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_mercadopago_settings() TO authenticated;

-- 7. FUNÇÃO RPC: SALVAR CONFIGURAÇÕES ADMINISTRATIVAS
CREATE OR REPLACE FUNCTION public.admin_save_mercadopago_settings(
  p_access_token TEXT,
  p_public_key TEXT DEFAULT '',
  p_webhook_secret TEXT DEFAULT '',
  p_is_sandbox BOOLEAN DEFAULT true,
  p_notification_url TEXT DEFAULT '',
  p_pix_key TEXT DEFAULT '',
  p_auto_activate_license BOOLEAN DEFAULT true,
  p_license_duration_days INTEGER DEFAULT 30,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF public.is_access_plan_manager() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas o desenvolvedor/proprietário pode salvar credenciais de pagamento.'
      USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_id FROM public.mercadopago_settings LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.mercadopago_settings
    SET 
      access_token = TRIM(p_access_token),
      public_key = TRIM(p_public_key),
      webhook_secret = TRIM(p_webhook_secret),
      is_sandbox = p_is_sandbox,
      notification_url = TRIM(p_notification_url),
      pix_key = TRIM(p_pix_key),
      auto_activate_license = p_auto_activate_license,
      license_duration_days = GREATEST(1, p_license_duration_days),
      is_active = p_is_active,
      updated_by = auth.uid(),
      updated_at = NOW()
    WHERE id = v_id;
  ELSE
    INSERT INTO public.mercadopago_settings (
      access_token,
      public_key,
      webhook_secret,
      is_sandbox,
      notification_url,
      pix_key,
      auto_activate_license,
      license_duration_days,
      is_active,
      updated_by,
      updated_at
    ) VALUES (
      TRIM(p_access_token),
      TRIM(p_public_key),
      TRIM(p_webhook_secret),
      p_is_sandbox,
      TRIM(p_notification_url),
      TRIM(p_pix_key),
      p_auto_activate_license,
      GREATEST(1, p_license_duration_days),
      p_is_active,
      auth.uid(),
      NOW()
    ) RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Configurações do Mercado Pago salvas com sucesso.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_save_mercadopago_settings(TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, BOOLEAN, INTEGER, BOOLEAN) TO authenticated;

-- 8. FUNÇÃO RPC NÚCLEO: PROCESSAR APROVAÇÃO DE PAGAMENTO E LIBERAR O SISTEMA
-- Garante IDEMPOTÊNCIA rigorosa para evitar ativações ou renovações duplicadas
CREATE OR REPLACE FUNCTION public.process_mercadopago_payment_approval(
  p_mp_payment_id BIGINT,
  p_raw_data JSONB DEFAULT '{}'::jsonb,
  p_status_detail TEXT DEFAULT 'accredited'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_tx public.mercadopago_pix_transactions%ROWTYPE;
  v_org public.organizations%ROWTYPE;
  v_plan public.access_plans%ROWTYPE;
  v_days_to_add INTEGER := 30;
  v_current_expiry TIMESTAMPTZ;
  v_new_expiry TIMESTAMPTZ;
  v_already_activated BOOLEAN := false;
BEGIN
  -- 1. Localiza a transação pelo ID do Mercado Pago
  SELECT * INTO v_tx
  FROM public.mercadopago_pix_transactions
  WHERE mp_payment_id = p_mp_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transação PIX não encontrada para o ID Mercado Pago: ' || p_mp_payment_id
    );
  END IF;

  -- 2. Verificação de IDEMPOTÊNCIA: Se já foi aprovado e a licença já foi liberada, não duplica
  IF v_tx.status = 'approved' AND v_tx.license_activated = true THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'message', 'Pagamento já processado e acesso previamente concedido.',
      'transaction_id', v_tx.id,
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

    -- Se um plano de acesso estiver associado, sincroniza os módulos nos organization_dashboard_modules
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
      payment_method = 'PIX (Mercado Pago)',
      notes = COALESCE(notes, '') || ' [Pago via MP Transação #' || p_mp_payment_id || ' em ' || TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI') || ']',
      updated_at = NOW()
    WHERE id = v_tx.contract_invoice_id;
  END IF;

  -- 5. Atualiza o status da cobrança PIX para APPROVED
  UPDATE public.mercadopago_pix_transactions
  SET 
    status = 'approved',
    status_detail = COALESCE(p_status_detail, 'accredited'),
    paid_at = NOW(),
    license_activated = true,
    raw_response = CASE 
      WHEN p_raw_data != '{}'::jsonb THEN p_raw_data 
      ELSE raw_response 
    END,
    updated_at = NOW()
  WHERE id = v_tx.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Pagamento aprovado e acesso ao sistema liberado com sucesso!',
    'transaction_id', v_tx.id,
    'organization_id', v_tx.organization_id,
    'new_expiry', v_new_expiry,
    'amount', v_tx.amount,
    'mp_payment_id', p_mp_payment_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_mercadopago_payment_approval(BIGINT, JSONB, TEXT) TO authenticated, service_role;

-- 9. FUNÇÃO RPC: LISTAGEM ADMINISTRATIVA DE PAGAMENTOS COM FILTROS
CREATE OR REPLACE FUNCTION public.admin_list_pix_transactions(
  p_status TEXT DEFAULT 'all',
  p_search TEXT DEFAULT '',
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_results JSONB;
  v_total_approved NUMERIC(12,2) := 0;
  v_count_approved BIGINT := 0;
  v_count_pending BIGINT := 0;
  v_count_rejected BIGINT := 0;
  v_count_cancelled BIGINT := 0;
  v_total_count BIGINT := 0;
BEGIN
  IF public.is_access_plan_manager() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem visualizar transações PIX.'
      USING ERRCODE = '42501';
  END IF;

  -- Métricas globais
  SELECT 
    COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0),
    COUNT(*) FILTER (WHERE status = 'approved'),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'rejected'),
    COUNT(*) FILTER (WHERE status IN ('cancelled', 'refunded')),
    COUNT(*)
  INTO 
    v_total_approved,
    v_count_approved,
    v_count_pending,
    v_count_rejected,
    v_count_cancelled,
    v_total_count
  FROM public.mercadopago_pix_transactions;

  -- Lista filtrada
  SELECT jsonb_agg(item) INTO v_results
  FROM (
    SELECT 
      t.id,
      t.organization_id,
      o.name AS organization_name,
      o.slug AS organization_slug,
      t.contract_invoice_id,
      t.access_plan_id,
      COALESCE(t.access_plan_name, p.name, 'Plano Padrão') AS access_plan_name,
      t.mp_payment_id,
      t.idempotency_key,
      t.status,
      t.status_detail,
      t.amount,
      t.description,
      t.qr_code,
      t.qr_code_base64,
      t.ticket_url,
      t.payer_name,
      t.payer_email,
      t.payer_document,
      t.expires_at,
      t.paid_at,
      t.license_days_granted,
      t.license_activated,
      t.created_at,
      t.updated_at
    FROM public.mercadopago_pix_transactions t
    LEFT JOIN public.organizations o ON o.id = t.organization_id
    LEFT JOIN public.access_plans p ON p.id = t.access_plan_id
    WHERE 
      (p_status = 'all' OR t.status = p_status)
      AND (
        p_search IS NULL OR p_search = '' 
        OR o.name ILIKE '%' || p_search || '%'
        OR t.payer_name ILIKE '%' || p_search || '%'
        OR t.payer_email ILIKE '%' || p_search || '%'
        OR t.payer_document ILIKE '%' || p_search || '%'
        OR t.mp_payment_id::text ILIKE '%' || p_search || '%'
        OR t.id::text ILIKE '%' || p_search || '%'
      )
    ORDER BY t.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) item;

  RETURN jsonb_build_object(
    'metrics', jsonb_build_object(
      'total_approved_amount', v_total_approved,
      'count_approved', v_count_approved,
      'count_pending', v_count_pending,
      'count_rejected', v_count_rejected,
      'count_cancelled', v_count_cancelled,
      'total_count', v_total_count
    ),
    'transactions', COALESCE(v_results, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_pix_transactions(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

-- 10. FUNÇÃO RPC: SIMULAÇÃO DE PAGAMENTO APROVADO (SANDBOX/TESTES)
-- Permite que o administrador teste o fluxo de ponta a ponta em ambiente de homologação
CREATE OR REPLACE FUNCTION public.admin_simulate_pix_payment_approval(
  p_transaction_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_tx public.mercadopago_pix_transactions%ROWTYPE;
  v_fake_mp_id BIGINT;
BEGIN
  IF public.is_access_plan_manager() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar simulação.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tx
  FROM public.mercadopago_pix_transactions
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  v_fake_mp_id := COALESCE(v_tx.mp_payment_id, floor(random() * 9000000000 + 1000000000)::bigint);

  -- Atualiza o mp_payment_id se estiver nulo
  IF v_tx.mp_payment_id IS NULL THEN
    UPDATE public.mercadopago_pix_transactions
    SET mp_payment_id = v_fake_mp_id
    WHERE id = v_tx.id;
  END IF;

  -- Processa a aprovação oficial
  RETURN public.process_mercadopago_payment_approval(
    v_fake_mp_id,
    jsonb_build_object('simulation', true, 'simulated_by', auth.uid(), 'timestamp', NOW()),
    'simulated_accredited'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_simulate_pix_payment_approval(UUID) TO authenticated;
