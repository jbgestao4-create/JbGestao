-- Migration 00100: Limpeza e inicialização do banco para Desenvolvimento
-- Mantém apenas a organização "Desenvolvimento" e o usuário proprietário "adm@adm.com" com senha "00000000"
-- Adiciona coluna 'summary' na tabela system_announcements para rodapé de anúncios

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Garante coluna summary em system_announcements
ALTER TABLE public.system_announcements
  ADD COLUMN IF NOT EXISTS summary TEXT;

-- 2. Limpa dados operacionais usando nomes exatos das tabelas
TRUNCATE TABLE
  public.quote_items,
  public.quotes,
  public.customer_portal_tokens,
  public.customers,
  public.inventory_movements,
  public.inventory_item_suppliers,
  public.inventory_items,
  public.supplier_invoices,
  public.suppliers,
  public.service_order_items,
  public.service_orders,
  public.service_materials,
  public.service_price_history,
  public.services,
  public.cash_session_movements,
  public.cash_sessions,
  public.cash_bills,
  public.cash_payments,
  public.cash_entries,
  public.appointments,
  public.system_notification_reads,
  public.system_notifications,
  public.feedback_messages,
  public.feedback_history,
  public.feedback_internal_notes,
  public.feedback_suggestion_reads,
  public.feedback_attachments,
  public.feedback_suggestions,
  public.offline_devices
CASCADE;

-- 3. Desativa temporariamente os triggers de proteção da organização legada
DROP TRIGGER IF EXISTS trg_prevent_owner_test_organization_deletion ON public.organizations;
DROP TRIGGER IF EXISTS trg_prevent_owner_test_organization_slug_change ON public.organizations;

-- 4. Limpa vínculos auxiliares de organizações
DELETE FROM public.subscriptions;
DELETE FROM public.cash_registers;
DELETE FROM public.cash_accounts;
DELETE FROM public.organization_members;
DELETE FROM public.organization_modules;
DELETE FROM public.organization_member_modules;
DELETE FROM public.organization_dashboard_modules;
DELETE FROM public.organization_member_dashboard_modules;

-- 5. Limpa organizações antigas
DELETE FROM public.organizations;

-- 6. Cria a organização única "Desenvolvimento"
INSERT INTO public.organizations (id, name, slug, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'Desenvolvimento',
  'desenvolvimento',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET name = 'Desenvolvimento', slug = 'desenvolvimento';

-- 7. Restaura o trigger de proteção para a nova organização "desenvolvimento"
CREATE OR REPLACE FUNCTION public.prevent_owner_test_organization_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.slug = 'desenvolvimento' THEN
    RAISE EXCEPTION 'A organização principal de Desenvolvimento não pode ser excluída.';
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.slug = 'desenvolvimento'
    AND NEW.slug <> OLD.slug THEN
    RAISE EXCEPTION 'O identificador da organização de Desenvolvimento não pode ser alterado.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_prevent_owner_test_organization_deletion
  BEFORE DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_test_organization_deletion();

CREATE TRIGGER trg_prevent_owner_test_organization_slug_change
  BEFORE UPDATE OF slug ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_test_organization_deletion();

-- Permite vincular a conta de proprietário como membro da organização Desenvolvimento
DROP TRIGGER IF EXISTS trg_prevent_developer_org_member ON public.organization_members;

-- 8. Remove todos os outros usuários de auth.users exceto adm@adm.com
DELETE FROM auth.users WHERE LOWER(email) <> 'adm@adm.com';

-- 9. Configura adm@adm.com com senha '00000000', perfil e permissões de proprietário
DO $$
DECLARE
  v_user_id UUID;
  v_encrypted_pw TEXT;
BEGIN
  v_encrypted_pw := extensions.crypt('00000000', extensions.gen_salt('bf'));

  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = 'adm@adm.com' LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      raw_app_meta_data = '{"provider":"email","providers":["email"],"is_platform_owner":true,"must_change_password":false}'::jsonb,
      raw_user_meta_data = '{"display_name":"Desenvolvimento","is_platform_owner":true}'::jsonb,
      updated_at = NOW()
    WHERE id = v_user_id;
  ELSE
    v_user_id := 'c5077813-59cf-469f-9f50-64b641937906'::uuid;
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'adm@adm.com',
      v_encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"],"is_platform_owner":true,"must_change_password":false}'::jsonb,
      '{"display_name":"Desenvolvimento","is_platform_owner":true}'::jsonb,
      NOW(),
      NOW()
    );
  END IF;

  -- Remove perfis de outros usuários
  DELETE FROM public.profiles WHERE id <> v_user_id;

  -- Garante perfil de adm@adm.com
  INSERT INTO public.profiles (id, email, display_name, created_at, updated_at)
  VALUES (v_user_id, 'adm@adm.com', 'Desenvolvimento', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
  SET email = 'adm@adm.com', display_name = 'Desenvolvimento', updated_at = NOW();

  -- Vincula como proprietário (owner) na organização Desenvolvimento
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role,
    created_at,
    updated_at
  ) VALUES (
    '11111111-1111-1111-1111-111111111111'::uuid,
    v_user_id,
    'owner',
    NOW(),
    NOW()
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET role = 'owner', updated_at = NOW();

  -- Habilita módulos para a organização Desenvolvimento
  INSERT INTO public.organization_modules (organization_id, module_id, status)
  SELECT '11111111-1111-1111-1111-111111111111'::uuid, id, 'active'::public.module_grant_status
  FROM public.modules
  ON CONFLICT (organization_id, module_id) DO UPDATE
  SET status = 'active';

  -- Habilita módulos para o usuário adm@adm.com
  INSERT INTO public.organization_member_modules (organization_id, user_id, module_code)
  SELECT '11111111-1111-1111-1111-111111111111'::uuid, v_user_id, code
  FROM public.modules
  ON CONFLICT (organization_id, user_id, module_code) DO NOTHING;

END $$;
