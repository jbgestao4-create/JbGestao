-- Migration 00105: Redefinição de Senha via Código de 4 Dígitos por WhatsApp
-- Permite que usuários redefinam sua senha solicitando envio de código para o WhatsApp cadastrado.

-- 1. Garante que profiles possui a coluna phone
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Tabela para armazenar os códigos de redefinição de senha
CREATE TABLE IF NOT EXISTS public.password_reset_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  attempts INT NOT NULL DEFAULT 0,
  is_used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_lookup
  ON public.password_reset_codes (email, token, is_used, expires_at);

ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;
-- Acesso restrito: somente funções SECURITY DEFINER podem manipular esta tabela
DROP POLICY IF EXISTS "password_reset_codes_no_direct_access" ON public.password_reset_codes;
CREATE POLICY "password_reset_codes_no_direct_access"
  ON public.password_reset_codes
  FOR ALL
  USING (false);

-- 3. Função para solicitar código de 4 dígitos via WhatsApp
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

-- 4. Função para validar o código de 4 dígitos
CREATE OR REPLACE FUNCTION public.verify_whatsapp_password_reset_code(
  p_email TEXT,
  p_code TEXT,
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_record RECORD;
BEGIN
  SELECT * INTO v_record
  FROM public.password_reset_codes
  WHERE email = lower(trim(p_email))
    AND token = trim(p_token)
    AND is_used = false
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Sessão de redefinição não encontrada ou expirada. Solicite um novo código.'
    );
  END IF;

  IF v_record.expires_at < NOW() THEN
    UPDATE public.password_reset_codes
    SET is_used = true
    WHERE id = v_record.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'O código de verificação expirou (validade de 15 minutos). Solicite um novo código.'
    );
  END IF;

  IF v_record.attempts >= 5 THEN
    UPDATE public.password_reset_codes
    SET is_used = true
    WHERE id = v_record.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Número máximo de tentativas excedido. Solicite um novo código.'
    );
  END IF;

  IF trim(v_record.code) <> trim(p_code) THEN
    UPDATE public.password_reset_codes
    SET attempts = attempts + 1
    WHERE id = v_record.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Código de verificação incorreto. Verifique os 4 dígitos informados.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'verified', true
  );
END;
$$;

-- 5. Função para concluir a redefinição com a nova senha
CREATE OR REPLACE FUNCTION public.complete_whatsapp_password_reset(
  p_email TEXT,
  p_code TEXT,
  p_token TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_record RECORD;
  v_encrypted_password TEXT;
  v_pwd TEXT;
BEGIN
  v_pwd := trim(p_new_password);

  -- Validação de força da senha
  IF length(v_pwd) < 8 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'A senha deve conter no mínimo 8 caracteres.'
    );
  END IF;

  IF v_pwd !~ '[A-Z]' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'A senha deve conter pelo menos uma letra maiúscula.'
    );
  END IF;

  IF v_pwd !~ '[a-z]' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'A senha deve conter pelo menos uma letra minúscula.'
    );
  END IF;

  IF v_pwd !~ '[0-9]' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'A senha deve conter pelo menos um número.'
    );
  END IF;

  IF v_pwd !~ '[^a-zA-Z0-9\s]' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'A senha deve conter pelo menos um caractere especial (!@#$%...).'
    );
  END IF;

  -- Valida código e token
  SELECT * INTO v_record
  FROM public.password_reset_codes
  WHERE email = lower(trim(p_email))
    AND token = trim(p_token)
    AND is_used = false
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_record IS NULL OR trim(v_record.code) <> trim(p_code) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Código inválido ou sessão expirada. Por favor, reinicie o processo.'
    );
  END IF;

  -- Criptografa nova senha com Blowfish
  v_encrypted_password := crypt(v_pwd, gen_salt('bf', 10));

  -- Atualiza em auth.users
  UPDATE auth.users
  SET encrypted_password = v_encrypted_password,
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) - 'must_change_password',
      updated_at = NOW()
  WHERE id = v_record.user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não encontrado para atualização.'
    );
  END IF;

  -- Marca o código como utilizado
  UPDATE public.password_reset_codes
  SET is_used = true
  WHERE id = v_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Senha redefinida com sucesso!'
  );
END;
$$;

-- Permissões de execução para anon e authenticated
REVOKE ALL ON FUNCTION public.request_whatsapp_password_reset(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_whatsapp_password_reset(TEXT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.verify_whatsapp_password_reset_code(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_whatsapp_password_reset_code(TEXT, TEXT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.complete_whatsapp_password_reset(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_whatsapp_password_reset(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
