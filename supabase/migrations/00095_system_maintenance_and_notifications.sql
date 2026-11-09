-- Migration 00095: Modo de Manutenção do Sistema e Notificações Direcionadas

-- 1. Tabela de configurações globais do sistema (ex: modo de manutenção)
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Inserir valor inicial para maintenance_mode
INSERT INTO public.system_settings (key, value)
VALUES (
  'maintenance_mode',
  jsonb_build_object(
    'enabled', false,
    'message', 'O sistema encontra-se em manutenção de emergência temporária. Solicitamos que aguardem o retorno das operações em instantes.',
    'updated_at', NOW()
  )
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Qualquer um pode ler configuracoes do sistema" ON public.system_settings;
CREATE POLICY "Qualquer um pode ler configuracoes do sistema"
  ON public.system_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Proprietarios gerenciam configuracoes do sistema" ON public.system_settings;
CREATE POLICY "Proprietarios gerenciam configuracoes do sistema"
  ON public.system_settings FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Tabela de notificações do sistema
CREATE TABLE IF NOT EXISTS public.system_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'urgent', 'contact'
  target_type TEXT NOT NULL DEFAULT 'all', -- 'all', 'organization', 'user'
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_email TEXT,
  target_user_name TEXT,
  target_organization_name TEXT,
  contact_whatsapp TEXT,
  contact_email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_notifications_target
  ON public.system_notifications (is_active, target_type, organization_id, target_user_id);

ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura de notificacoes do sistema" ON public.system_notifications;
CREATE POLICY "Leitura de notificacoes do sistema"
  ON public.system_notifications FOR SELECT
  USING (
    is_active = TRUE
    OR auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Gerenciamento de notificacoes do sistema" ON public.system_notifications;
CREATE POLICY "Gerenciamento de notificacoes do sistema"
  ON public.system_notifications FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Tabela de confirmação de leitura das notificações
CREATE TABLE IF NOT EXISTS public.system_notification_reads (
  notification_id UUID REFERENCES public.system_notifications(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, user_id)
);

ALTER TABLE public.system_notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios gerenciam leitura de notificacoes" ON public.system_notification_reads;
CREATE POLICY "Usuarios gerenciam leitura de notificacoes"
  ON public.system_notification_reads FOR ALL
  USING (auth.uid() = user_id OR auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- 4. Função para obter status de manutenção do sistema
CREATE OR REPLACE FUNCTION public.get_maintenance_mode()
RETURNS TABLE (
  enabled BOOLEAN,
  message TEXT,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((value->>'enabled')::BOOLEAN, false) AS enabled,
    COALESCE(value->>'message', 'O sistema encontra-se em manutenção de emergência temporária. Solicitamos que aguardem o retorno.') AS message,
    COALESCE((value->>'updated_at')::TIMESTAMPTZ, s.updated_at) AS updated_at
  FROM public.system_settings s
  WHERE key = 'maintenance_mode';
END;
$$;

-- 5. Função para o desenvolvedor ativar/desativar modo de manutenção
CREATE OR REPLACE FUNCTION public.set_maintenance_mode(
  p_enabled BOOLEAN,
  p_message TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_message TEXT;
  v_result JSONB;
BEGIN
  v_message := COALESCE(
    NULLIF(TRIM(p_message), ''),
    'O sistema encontra-se em manutenção de emergência temporária. Solicitamos que aguardem retorno.'
  );

  v_result := jsonb_build_object(
    'enabled', p_enabled,
    'message', v_message,
    'updated_at', NOW(),
    'updated_by', auth.uid()
  );

  INSERT INTO public.system_settings (key, value, updated_at, updated_by)
  VALUES ('maintenance_mode', v_result, NOW(), auth.uid())
  ON CONFLICT (key) DO UPDATE
  SET
    value = v_result,
    updated_at = NOW(),
    updated_by = auth.uid();

  RETURN v_result;
END;
$$;

-- 6. Função para o usuário logado buscar suas notificações ativas
CREATE OR REPLACE FUNCTION public.get_my_system_notifications(p_org_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  title TEXT,
  message TEXT,
  type TEXT,
  target_type TEXT,
  organization_id UUID,
  target_user_id UUID,
  contact_whatsapp TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ,
  is_read BOOLEAN
)
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    sn.id,
    sn.title,
    sn.message,
    sn.type,
    sn.target_type,
    sn.organization_id,
    sn.target_user_id,
    sn.contact_whatsapp,
    sn.contact_email,
    sn.created_at,
    (snr.read_at IS NOT NULL) AS is_read
  FROM public.system_notifications sn
  LEFT JOIN public.system_notification_reads snr
    ON snr.notification_id = sn.id AND snr.user_id = v_user_id
  WHERE sn.is_active = TRUE
    AND (
      sn.target_type = 'all'
      OR (sn.target_type = 'organization' AND sn.organization_id = p_org_id)
      OR (sn.target_type = 'user' AND sn.target_user_id = v_user_id)
    )
  ORDER BY sn.created_at DESC;
END;
$$;

-- 7. Função para marcar notificação como lida
CREATE OR REPLACE FUNCTION public.mark_system_notification_read(p_notification_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.system_notification_reads (notification_id, user_id, read_at)
  VALUES (p_notification_id, auth.uid(), NOW())
  ON CONFLICT (notification_id, user_id) DO UPDATE
  SET read_at = NOW();

  RETURN TRUE;
END;
$$;
