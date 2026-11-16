-- Migration 00127: Correção definitiva da persistência de sessão e escopo estrito de proprietário vs administrador/operador

-- 1. register_user_session busca auth.users por e-mail caso auth.uid() seja nulo
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

  RETURN jsonb_build_object('success', true, 'user_id', v_uid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_user_session(TEXT, TEXT, UUID, TEXT, TEXT) TO authenticated, anon;

-- 2. check_user_concurrent_session: apenas controlesoft@outlook.com ou adm@adm.com é isento.
-- Administradores e operadores de empresas são estritamente bloqueados contra acesso concorrente.
CREATE OR REPLACE FUNCTION public.check_user_concurrent_session(
  p_email TEXT,
  p_current_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_clean_email TEXT;
  v_session RECORD;
  v_is_owner BOOLEAN := FALSE;
BEGIN
  v_clean_email := lower(trim(COALESCE(p_email, '')));
  IF v_clean_email = '' THEN
    RETURN jsonb_build_object('is_blocked', false);
  END IF;

  -- Apenas o e-mail proprietário mestre do sistema tem privilégio de múltiplos logins
  IF v_clean_email IN ('controlesoft@outlook.com', 'adm@adm.com', 'admin@adm.com') THEN
    RETURN jsonb_build_object('is_blocked', false, 'is_owner', true);
  END IF;

  SELECT 1 INTO v_is_owner
  FROM public.system_settings ss
  JOIN auth.users u ON (ss.value->>'user_id')::uuid = u.id
  WHERE ss.key = 'system_owner_user_id'
    AND lower(u.email) = v_clean_email;

  IF FOUND THEN
    RETURN jsonb_build_object('is_blocked', false, 'is_owner', true);
  END IF;

  -- Para todos os administradores e operadores: busca sessão ativa com heartbeat recente (menos de 60 segundos)
  SELECT * INTO v_session
  FROM public.user_active_sessions
  WHERE lower(email) = v_clean_email
    AND last_heartbeat > (NOW() - INTERVAL '60 seconds');

  IF FOUND THEN
    -- Se o token for exatamente o mesmo da mesma aba, permite
    IF p_current_token IS NOT NULL AND v_session.session_token = p_current_token THEN
      RETURN jsonb_build_object('is_blocked', false, 'same_session', true);
    END IF;

    RETURN jsonb_build_object(
      'is_blocked', true,
      'error', 'Já consta logado um usuário com esta conta. Não é permitido acesso simultâneo com o mesmo e-mail.',
      'last_seen', v_session.last_heartbeat
    );
  END IF;

  RETURN jsonb_build_object('is_blocked', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_concurrent_session(TEXT, TEXT) TO anon, authenticated;

-- 3. clear_user_session
CREATE OR REPLACE FUNCTION public.clear_user_session(p_email TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_clean_email TEXT;
BEGIN
  IF v_uid IS NOT NULL THEN
    DELETE FROM public.user_active_sessions WHERE user_id = v_uid;
  END IF;

  IF p_email IS NOT NULL THEN
    v_clean_email := lower(trim(p_email));
    IF v_clean_email <> '' THEN
      DELETE FROM public.user_active_sessions WHERE lower(email) = v_clean_email;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_user_session(TEXT) TO anon, authenticated;
