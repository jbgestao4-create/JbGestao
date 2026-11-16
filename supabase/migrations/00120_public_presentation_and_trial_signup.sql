-- 00119_public_presentation_and_trial_signup.sql
-- Permite listagem pública dos planos cadastrados na tela de apresentação
-- e auto-cadastro de novas empresas com 1 mês de teste grátis vinculado ao plano escolhido e aos Termos de Uso.

ALTER TABLE public.access_plans
  ADD COLUMN IF NOT EXISTS monthly_price NUMERIC(12,2) NOT NULL DEFAULT 149.90;

UPDATE public.access_plans SET monthly_price = 99.90 WHERE id = '00000000-0000-4000-8000-000000000001';
UPDATE public.access_plans SET monthly_price = 129.90 WHERE id = '00000000-0000-4000-8000-000000000002';
UPDATE public.access_plans SET monthly_price = 159.90 WHERE id = '00000000-0000-4000-8000-000000000003';
UPDATE public.access_plans SET monthly_price = 199.90 WHERE id = '00000000-0000-4000-8000-000000000004';

-- 1. Listagem pública de planos cadastrados para exibição na tela de apresentação
CREATE OR REPLACE FUNCTION public.public_list_access_plans()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.is_locked ASC, p.monthly_price ASC, p.name ASC)
      FROM public.access_plans p
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_list_access_plans() TO anon, authenticated;

-- 2. Auto-cadastro de empresa na escolha de plano com 1 mês de teste grátis
CREATE OR REPLACE FUNCTION public.public_register_company_trial_plan(
  p_org_name TEXT,
  p_org_slug TEXT,
  p_cnpj TEXT,
  p_responsible_name TEXT,
  p_whatsapp TEXT,
  p_admin_email TEXT,
  p_plan_id UUID,
  p_has_trial BOOLEAN DEFAULT TRUE,
  p_billing_day INTEGER DEFAULT 10,
  p_payment_method TEXT DEFAULT 'PIX / Boleto Bancário',
  p_terms_version TEXT DEFAULT '2.0',
  p_terms_ip TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_plan public.access_plans;
  v_new_org_id UUID;
  v_trial_ends_at TIMESTAMPTZ;
  v_contract_id UUID;
  v_contract_number TEXT;
  v_mod_code TEXT;
  v_orcafacil_mod_id UUID;
  v_clean_slug TEXT;
  v_clean_email TEXT;
  v_next_due_date DATE;
  v_ref_month_1 TEXT;
  v_ref_month_2 TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário precisa estar autenticado para concluir o vínculo da empresa.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_plan
  FROM public.access_plans
  WHERE id = p_plan_id;

  IF NOT FOUND OR NOT v_plan.is_active OR v_plan.is_locked THEN
    RAISE EXCEPTION 'O plano selecionado não está disponível para contratação no momento.'
      USING ERRCODE = '22023';
  END IF;

  v_clean_slug := lower(trim(p_org_slug));
  v_clean_email := lower(trim(p_admin_email));

  -- Evita colisão de slug adicionando sufixo curto se já existir
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_clean_slug) THEN
    v_clean_slug := v_clean_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
  END IF;

  IF COALESCE(p_has_trial, TRUE) THEN
    v_trial_ends_at := NOW() + INTERVAL '1 month';
  ELSE
    v_trial_ends_at := NULL;
  END IF;

  -- Cria a organização com trial de 1 mês e plano vinculado
  INSERT INTO public.organizations (
    name,
    slug,
    is_active,
    trial_ends_at,
    access_plan_id,
    cnpj,
    responsible_name,
    whatsapp,
    email_contact,
    admin_email,
    admin_name
  )
  VALUES (
    trim(p_org_name),
    v_clean_slug,
    TRUE,
    v_trial_ends_at,
    v_plan.id,
    NULLIF(trim(COALESCE(p_cnpj, '')), ''),
    trim(p_responsible_name),
    NULLIF(trim(COALESCE(p_whatsapp, '')), ''),
    v_clean_email,
    v_clean_email,
    trim(p_responsible_name)
  )
  RETURNING id INTO v_new_org_id;

  -- Atualiza perfil
  INSERT INTO public.profiles (id, display_name, email, phone)
  VALUES (v_uid, trim(p_responsible_name), v_clean_email, NULLIF(trim(COALESCE(p_whatsapp, '')), ''))
  ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      email = EXCLUDED.email,
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  -- Vincula usuário como admin da organização
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_new_org_id, v_uid, 'admin')
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET role = 'admin';

  -- Habilita módulo base ControleSoft (orcafacil)
  SELECT id INTO v_orcafacil_mod_id FROM public.modules WHERE code = 'orcafacil' LIMIT 1;
  IF v_orcafacil_mod_id IS NOT NULL THEN
    INSERT INTO public.organization_modules (organization_id, module_id, status)
    VALUES (v_new_org_id, v_orcafacil_mod_id, 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Concede os módulos do plano escolhido
  IF v_plan.module_codes IS NOT NULL AND cardinality(v_plan.module_codes) > 0 THEN
    FOREACH v_mod_code IN ARRAY v_plan.module_codes LOOP
      INSERT INTO public.organization_dashboard_modules (organization_id, module_code)
      VALUES (v_new_org_id, v_mod_code)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Gera contrato digital assinado com cláusula de 1 mês grátis e suspensão automática por inadimplência
  v_contract_number := 'CTR-' || to_char(NOW(), 'YYYY') || '-' || upper(substr(replace(v_new_org_id::text, '-', ''), 1, 6));
  INSERT INTO public.software_contracts (
    company_id,
    contract_number,
    client_name,
    client_document,
    client_responsible_name,
    client_email,
    client_phone,
    plan_name,
    monthly_amount,
    setup_fee,
    billing_day,
    payment_method,
    start_date,
    duration_months,
    has_trial_period,
    trial_duration_months,
    trial_ends_at,
    is_signed,
    signed_at,
    status,
    included_modules,
    custom_terms,
    created_by
  )
  VALUES (
    v_new_org_id,
    v_contract_number,
    trim(p_org_name),
    COALESCE(NULLIF(trim(p_cnpj), ''), 'Não informado'),
    trim(p_responsible_name),
    v_clean_email,
    NULLIF(trim(COALESCE(p_whatsapp, '')), ''),
    v_plan.name,
    COALESCE(v_plan.monthly_price, 149.90),
    0.00,
    COALESCE(p_billing_day, 10),
    COALESCE(p_payment_method, 'PIX / Boleto Bancário'),
    CURRENT_DATE,
    12,
    COALESCE(p_has_trial, TRUE),
    1,
    v_trial_ends_at,
    TRUE,
    NOW(),
    'active',
    to_jsonb(v_plan.module_codes),
    format(
      'Adesão online com aceite dos Termos de Uso v%s e Política de Privacidade (IP: %s). 1º mês gratuito para avaliação; a partir do próximo mês o pagamento é obrigatório para manutenção do acesso, ocorrendo suspensão automática em caso de inadimplência.',
      COALESCE(p_terms_version, '2.0'),
      COALESCE(p_terms_ip, 'registrado na sessão')
    ),
    v_uid
  )
  RETURNING id INTO v_contract_id;

  -- Gera a 1ª fatura (Mês 1 - Isenta / Teste Grátis) e a 2ª fatura (Próximo Mês - A Vencer ao final do teste)
  v_ref_month_1 := to_char(CURRENT_DATE, 'MM/YYYY');
  v_next_due_date := (CURRENT_DATE + INTERVAL '1 month')::date;
  v_ref_month_2 := to_char(v_next_due_date, 'MM/YYYY');

  IF COALESCE(p_has_trial, TRUE) THEN
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
    )
    VALUES (
      v_contract_id,
      v_new_org_id,
      replace(v_contract_number, 'CTR-', 'FAT-') || '-01',
      trim(p_org_name),
      NULLIF(trim(COALESCE(p_cnpj, '')), ''),
      v_ref_month_1,
      0.00,
      CURRENT_DATE,
      CURRENT_DATE,
      'Isenção / 1º Mês Grátis',
      'paid',
      format('Período de Teste Gratuito de 1 Mês (30 dias) - Isenção total no 1º mês (%s)', v_plan.name)
    );
  END IF;

  INSERT INTO public.software_contract_invoices (
    contract_id,
    company_id,
    invoice_number,
    client_name,
    client_document,
    reference_month,
    amount,
    due_date,
    payment_method,
    status,
    notes
  )
  VALUES (
    v_contract_id,
    v_new_org_id,
    replace(v_contract_number, 'CTR-', 'FAT-') || '-02',
    trim(p_org_name),
    NULLIF(trim(COALESCE(p_cnpj, '')), ''),
    v_ref_month_2,
    COALESCE(v_plan.monthly_price, 149.90),
    v_next_due_date,
    COALESCE(p_payment_method, 'PIX / Boleto Bancário'),
    'pending',
    format('Mensalidade do 2º mês pós-teste gratuito (%s). O não pagamento até o vencimento suspende o acesso conforme os Termos de Uso.', v_plan.name)
  );

  RETURN jsonb_build_object(
    'organizationId', v_new_org_id,
    'slug', v_clean_slug,
    'contractId', v_contract_id,
    'contractNumber', v_contract_number,
    'trialEndsAt', v_trial_ends_at,
    'planName', v_plan.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_register_company_trial_plan(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
