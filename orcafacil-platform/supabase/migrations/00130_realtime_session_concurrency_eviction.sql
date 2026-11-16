-- Migration 00130: Publicação Realtime para user_active_sessions e política de expulsão automática de sessão concorrente
-- Garante que apenas adm@adm.com pode ter múltiplas sessões; todos os demais têm apenas 1 sessão ativa no sistema inteiro.

-- 1. Habilita Realtime na tabela user_active_sessions para expulsão instantânea
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'user_active_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_active_sessions;
  END IF;
END $$;

-- 2. Atualiza register_user_session para registrar token e retornar se a sessão foi atualizada com sucesso
CREATE OR REPLACE FUNCTION public.register_user_session(
  p_email TEXT,
  p_session_token TEXT,
  p_org_id UUID DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_clean_email TEXT;
  v_org_id UUID := p_org_id;
  v_existing RECORD;
BEGIN
  v_clean_email := lower(trim(COALESCE(p_email, '')));
  IF v_clean_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'E-mail obrigatório');
  END IF;

  -- Se v_uid não estiver disponível pelo contexto de sessão, recupera direto em auth.users
  IF v_uid IS NULL THEN
    SELECT id INTO v_uid
    FROM auth.users
    WHERE lower(email) = v_clean_email
    LIMIT 1;
  END IF;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;

  -- Se não informou organização, busca a organização principal do usuário
  IF v_org_id IS NULL THEN
    SELECT organization_id INTO v_org_id
    FROM public.organization_members
    WHERE user_id = v_uid
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Busca se já existe registro
  SELECT * INTO v_existing
  FROM public.user_active_sessions
  WHERE user_id = v_uid;

  INSERT INTO public.user_active_sessions (
    user_id,
    email,
    session_token,
    organization_id,
    last_heartbeat,
    ip_address,
    user_agent,
    created_at
  )
  VALUES (
    v_uid,
    v_clean_email,
    p_session_token,
    v_org_id,
    NOW(),
    p_ip,
    p_user_agent,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    session_token = EXCLUDED.session_token,
    organization_id = COALESCE(v_org_id, public.user_active_sessions.organization_id),
    last_heartbeat = NOW(),
    ip_address = COALESCE(EXCLUDED.ip_address, public.user_active_sessions.ip_address),
    user_agent = COALESCE(EXCLUDED.user_agent, public.user_active_sessions.user_agent);

  -- Atualiza o último acesso na tabela profiles
  UPDATE public.profiles
  SET last_access_at = NOW()
  WHERE id = v_uid;

  -- Atualiza o último acesso na tabela organizations
  IF v_org_id IS NOT NULL THEN
    UPDATE public.organizations
    SET last_access_at = NOW()
    WHERE id = v_org_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_uid,
    'session_token', p_session_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_user_session(TEXT, TEXT, UUID, TEXT, TEXT) TO authenticated, anon;
