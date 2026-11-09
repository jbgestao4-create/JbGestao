-- Migration 00090: Rastreamento de tempo de tela total e data/hora do último acesso por usuário

-- 1. Adiciona as colunas na tabela public.profiles caso ainda não existam
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS screen_time_seconds BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN public.profiles.screen_time_seconds IS 'Tempo total em segundos que o usuário permaneceu ativo em tela no sistema';
COMMENT ON COLUMN public.profiles.last_access_at IS 'Data e hora do último acesso ou atividade do usuário no sistema';

-- 2. Função RPC segura para registrar tempo de tela acumulado e atualizar último acesso
CREATE OR REPLACE FUNCTION public.record_user_screen_time(
  p_seconds INT DEFAULT 0,
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := COALESCE(p_user_id, auth.uid());
  v_secs BIGINT := GREATEST(0, COALESCE(p_seconds, 0));
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.profiles (id, display_name, screen_time_seconds, last_access_at)
  VALUES (v_uid, 'Usuário', v_secs, NOW())
  ON CONFLICT (id) DO UPDATE
  SET
    screen_time_seconds = COALESCE(public.profiles.screen_time_seconds, 0) + v_secs,
    last_access_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_user_screen_time(INT, UUID) TO authenticated, anon;

-- 3. Função RPC para o Desenvolvedor / Administrador consultar o tempo de tela e último acesso dos membros de uma organização
CREATE OR REPLACE FUNCTION public.get_organization_members_activity(p_org_id UUID)
RETURNS TABLE (
  user_id UUID,
  screen_time_seconds BIGINT,
  last_access_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    om.user_id,
    COALESCE(p.screen_time_seconds, 0::BIGINT) AS screen_time_seconds,
    p.last_access_at
  FROM public.organization_members om
  LEFT JOIN public.profiles p ON p.id = om.user_id
  WHERE om.organization_id = p_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_members_activity(UUID) TO authenticated, anon;

-- 4. Atualiza is_feedback_owner para reconhecer o desenvolvedor / proprietário do sistema
CREATE OR REPLACE FUNCTION public.is_feedback_owner(p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 4.1. Verifica se é desenvolvedor / proprietário do sistema
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid() LIMIT 1;
  IF v_email IS NOT NULL AND v_email IN (
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br',
    'bryan@administrador.com',
    'bryanmendes968@gmail.com'
  ) THEN
    RETURN TRUE;
  END IF;

  -- 4.2. Verifica se é proprietário (owner) da organização
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_feedback_owner(UUID) TO authenticated, anon;
