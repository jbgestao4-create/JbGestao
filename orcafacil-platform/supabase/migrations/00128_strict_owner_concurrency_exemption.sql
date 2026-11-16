-- Migration 00128: Restrição estrita de login simultâneo para todos os administradores e operadores
-- Apenas o e-mail oficial do proprietário (controlesoft@outlook.com) possui privilégio de login em múltiplos locais

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

  -- Apenas o e-mail oficial proprietário do sistema tem privilégio de múltiplos logins simultâneos
  IF v_clean_email = 'controlesoft@outlook.com' THEN
    RETURN jsonb_build_object('is_blocked', false, 'is_owner', true);
  END IF;

  -- Todos os administradores e operadores: busca sessão ativa com heartbeat recente (menos de 60 segundos)
  SELECT * INTO v_session
  FROM public.user_active_sessions
  WHERE lower(email) = v_clean_email
    AND last_heartbeat > (NOW() - INTERVAL '60 seconds');

  IF FOUND THEN
    -- Se o token for exatamente o mesmo da mesma aba, permite
    IF p_current_token IS NOT NULL AND v_session.session_token = p_current_token THEN
      RETURN jsonb_build_object('is_blocked', false, 'same_session', true);
    END IF;

    -- Caso contrário (aba anônima, outro navegador ou outra máquina): BLOQUEIA
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
