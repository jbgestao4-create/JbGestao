-- Migration 00107: Correcão da funcao request_whatsapp_password_reset
-- Ajusta a busca de telefone do usuario para nao depender de colunas inexistentes na tabela organizations.

CREATE OR REPLACE FUNCTION public.request_whatsapp_password_reset(
  p_email TEXT,
  p_custom_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_phone TEXT;
  v_clean_phone TEXT;
  v_masked_phone TEXT;
  v_code TEXT;
  v_token TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_email := lower(trim(p_email));

  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Informe um endereço de e-mail válido.'
    );
  END IF;

  -- 1. Localiza o usuário em auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Nenhuma conta encontrada com este endereço de e-mail.'
    );
  END IF;

  -- 2. Localiza o telefone/WhatsApp cadastrado
  -- Primeiro verifica se foi passado explicitamente (ex: primeiro cadastro sem telefone)
  IF p_custom_phone IS NOT NULL AND trim(p_custom_phone) <> '' THEN
    v_clean_phone := regexp_replace(p_custom_phone, '\D', '', 'g');
    IF length(v_clean_phone) >= 10 THEN
      v_phone := v_clean_phone;
      -- Atualiza no perfil se não estiver preenchido
      UPDATE public.profiles
      SET phone = v_clean_phone
      WHERE id = v_user_id AND (phone IS NULL OR phone = '');
    END IF;
  END IF;

  -- Se ainda não tem telefone, busca no perfil do usuário
  IF v_phone IS NULL OR v_phone = '' THEN
    SELECT regexp_replace(phone, '\D', '', 'g') INTO v_phone
    FROM public.profiles
    WHERE id = v_user_id AND phone IS NOT NULL AND trim(phone) <> '';
  END IF;

  -- Se não encontrou no perfil, busca em auth.users.phone ou metadados
  IF v_phone IS NULL OR v_phone = '' THEN
    SELECT regexp_replace(COALESCE(phone, raw_user_meta_data->>'phone', ''), '\D', '', 'g') INTO v_phone
    FROM auth.users
    WHERE id = v_user_id AND (phone IS NOT NULL OR raw_user_meta_data->>'phone' IS NOT NULL);
  END IF;

  -- Se ainda não encontrou telefone cadastrado:
  IF v_phone IS NULL OR length(v_phone) < 10 THEN
    RETURN jsonb_build_object(
      'success', false,
      'needs_phone', true,
      'error', 'Nenhum número de WhatsApp encontrado para este usuário. Informe seu número de WhatsApp com DDD para receber o código.'
    );
  END IF;

  -- Remove prefixo 55 se houver mais de 11 dígitos
  IF length(v_phone) > 11 AND starts_with(v_phone, '55') THEN
    v_phone := substring(v_phone from 3);
  END IF;

  -- 3. Gera código numérico de 4 dígitos
  v_code := lpad((floor(random() * 9000) + 1000)::text, 4, '0');
  v_token := encode(gen_random_bytes(24), 'hex');
  v_expires_at := NOW() + INTERVAL '15 minutes';

  -- Desativa códigos anteriores para este e-mail
  UPDATE public.password_reset_codes
  SET is_used = true
  WHERE email = v_email AND is_used = false;

  -- Insere o novo código
  INSERT INTO public.password_reset_codes (
    user_id,
    email,
    phone,
    code,
    token,
    expires_at
  ) VALUES (
    v_user_id,
    v_email,
    v_phone,
    v_code,
    v_token,
    v_expires_at
  );

  -- Gera número mascarado: (31) 9****-8490
  IF length(v_phone) = 11 THEN
    v_masked_phone := '(' || substring(v_phone from 1 for 2) || ') ' ||
                      substring(v_phone from 3 for 1) || '****-' ||
                      substring(v_phone from 8 for 4);
  ELSIF length(v_phone) = 10 THEN
    v_masked_phone := '(' || substring(v_phone from 1 for 2) || ') ' ||
                      '****-' || substring(v_phone from 7 for 4);
  ELSE
    v_masked_phone := substring(v_phone from 1 for 3) || '***' || substring(v_phone from length(v_phone) - 2);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'phone', v_phone,
    'masked_phone', v_masked_phone,
    'code', v_code,
    'expires_at', v_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_whatsapp_password_reset(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_whatsapp_password_reset(TEXT, TEXT) TO anon, authenticated;
