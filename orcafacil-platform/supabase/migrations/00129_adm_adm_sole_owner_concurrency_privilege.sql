-- Migration 00129: Concessão exclusiva de múltiplos logins para o proprietário adm@adm.com
-- Todos os demais usuários (administradores de empresas clientes, operadores, colaboradores) são bloqueados se tentarem logar simultaneamente

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
BEGIN
  v_clean_email := lower(trim(COALESCE(p_email, '')));
  IF v_clean_email = '' THEN
    RETURN jsonb_build_object('is_blocked', false);
  END IF;

  -- Apenas adm@adm.com possui o privilégio de múltiplos logins simultâneos (Proprietário)
  IF v_clean_email = 'adm@adm.com' THEN
    RETURN jsonb_build_object('is_blocked', false, 'is_owner', true);
  END IF;

  -- Todos os demais usuários (administradores de empresas clientes, operadores, colaboradores):
  -- Busca se há sessão ativa com heartbeat recente (menos de 60 segundos)
  SELECT * INTO v_session
  FROM public.user_active_sessions
  WHERE lower(email) = v_clean_email
    AND last_heartbeat > (NOW() - INTERVAL '60 seconds');

  IF FOUND THEN
    -- Se o token for exatamente o mesmo da mesma aba, permite
    IF p_current_token IS NOT NULL AND v_session.session_token = p_current_token THEN
      RETURN jsonb_build_object('is_blocked', false, 'same_session', true);
    END IF;

    -- Caso contrário (aba anônima, outro navegador ou outro computador): BLOQUEIA
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
