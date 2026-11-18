-- Script de Limpeza Completa do Banco de Dados
-- Mantém estritamente:
--   - A empresa com nome "Desenvolvimento" (ID: 11111111-1111-1111-1111-111111111111)
--   - O usuário "adm@adm.com" (ID: c5077813-59cf-469f-9f50-64b641937906)
-- Remove todos os registros operacionais (estoques, orçamentos, vendas, ordens de serviço, clientes, contas, etc.)
-- Remove todas as outras empresas e usuários
-- NENHUMA ESTRUTURA OU TABELA É ALTERADA.

DO $$
DECLARE
  v_dev_org_id UUID;
  v_admin_user_id UUID;
BEGIN
  -- Desativa temporariamente triggers de sessão para execução sem bloqueios transitórios
  SET session_replication_role = 'replica';

  -- 1. Obter ou garantir ID da organização Desenvolvimento
  SELECT id INTO v_dev_org_id 
  FROM public.organizations 
  WHERE LOWER(name) = 'desenvolvimento' OR LOWER(slug) = 'desenvolvimento'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_dev_org_id IS NULL THEN
    v_dev_org_id := '11111111-1111-1111-1111-111111111111'::uuid;
    INSERT INTO public.organizations (id, name, slug, is_active, created_at, updated_at)
    VALUES (v_dev_org_id, 'Desenvolvimento', 'desenvolvimento', true, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET name = 'Desenvolvimento', slug = 'desenvolvimento', is_active = true;
  ELSE
    UPDATE public.organizations
    SET 
      name = 'Desenvolvimento',
      is_active = true,
      trial_ends_at = NULL,
      updated_at = NOW()
    WHERE id = v_dev_org_id;
  END IF;

  -- 2. Obter ID do usuário adm@adm.com
  SELECT id INTO v_admin_user_id 
  FROM auth.users 
  WHERE LOWER(email) = 'adm@adm.com'
  LIMIT 1;

  -- 3. Limpar todas as tabelas de movimentações, estoques, orçamentos, serviços, financeiro e logs
  TRUNCATE TABLE
    public.quote_service_order_history,
    public.quote_items,
    public.quotes,
    public.customer_portal_tokens,
    public.customers,
    public.inventory_movements,
    public.inventory_item_suppliers,
    public.inventory_items,
    public.inventory_warehouses,
    public.supplier_invoices,
    public.suppliers,
    public.service_order_items,
    public.service_orders,
    public.service_order_equipment_catalog,
    public.service_materials,
    public.service_price_history,
    public.services,
    public.service_categories,
    public.cash_session_movements,
    public.cash_sessions,
    public.cash_bills,
    public.cash_payments,
    public.cash_entries,
    public.cash_registers,
    public.cash_accounts,
    public.appointments,
    public.system_notification_reads,
    public.system_notifications,
    public.feedback_messages,
    public.feedback_history,
    public.feedback_internal_notes,
    public.feedback_suggestion_reads,
    public.feedback_attachments,
    public.feedback_suggestions,
    public.feedback_ai_diagnostics,
    public.offline_devices,
    public.software_contract_invoices,
    public.software_contracts,
    public.mercadopago_webhook_logs,
    public.mercadopago_pix_transactions,
    public.subscriptions,
    public.organization_dashboard_modules,
    public.organization_member_dashboard_modules,
    public.organization_member_modules,
    public.site_access_logs,
    public.user_active_sessions
  CASCADE;

  -- 4. Limpar vínculos de empresas e membros, mantendo apenas Desenvolvimento e adm@adm.com
  DELETE FROM public.organization_modules WHERE organization_id <> v_dev_org_id;
  DELETE FROM public.organization_members WHERE organization_id <> v_dev_org_id;
  IF v_admin_user_id IS NOT NULL THEN
    DELETE FROM public.organization_members WHERE user_id <> v_admin_user_id;
  END IF;

  -- 5. Excluir todas as outras empresas (organizations)
  DELETE FROM public.organizations WHERE id <> v_dev_org_id;

  -- 6. Excluir perfis e usuários do auth exceto adm@adm.com
  IF v_admin_user_id IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id <> v_admin_user_id;
    DELETE FROM auth.users WHERE id <> v_admin_user_id;
  ELSE
    DELETE FROM public.profiles WHERE LOWER(email) <> 'adm@adm.com';
    DELETE FROM auth.users WHERE LOWER(email) <> 'adm@adm.com';
  END IF;

  -- 7. Garantir o perfil e vinculação de adm@adm.com com a organização Desenvolvimento
  IF v_admin_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, display_name, created_at, updated_at)
    VALUES (v_admin_user_id, 'adm@adm.com', 'Desenvolvimento', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE
    SET email = 'adm@adm.com', display_name = 'Desenvolvimento', updated_at = NOW();

    INSERT INTO public.organization_members (
      organization_id,
      user_id,
      role,
      created_at,
      updated_at
    ) VALUES (
      v_dev_org_id,
      v_admin_user_id,
      'owner',
      NOW(),
      NOW()
    )
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = 'owner', updated_at = NOW();

    -- Vincular todos os módulos do sistema para a organização Desenvolvimento
    INSERT INTO public.organization_modules (organization_id, module_id, status)
    SELECT v_dev_org_id, id, 'active'::public.module_grant_status
    FROM public.modules
    ON CONFLICT (organization_id, module_id) DO UPDATE
    SET status = 'active';

    -- Vincular módulos ao usuário adm@adm.com
    INSERT INTO public.organization_member_modules (organization_id, user_id, module_code)
    SELECT v_dev_org_id, v_admin_user_id, code
    FROM public.modules
    ON CONFLICT (organization_id, user_id, module_code) DO NOTHING;
  END IF;

  -- Reativa os triggers normalmente
  SET session_replication_role = 'origin';

END $$;
