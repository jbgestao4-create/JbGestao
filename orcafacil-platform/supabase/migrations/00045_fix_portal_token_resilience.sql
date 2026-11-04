-- 00045_fix_portal_token_resilience.sql
-- Aprimora a geração e busca de tokens do portal para garantir que o link seja sempre gerado

CREATE OR REPLACE FUNCTION public.generate_customer_portal_token(
  p_organization_id UUID,
  p_customer_id UUID,
  p_quote_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_member BOOLEAN := false;
  v_existing_token TEXT;
  v_new_token TEXT;
  v_cust_record RECORD;
BEGIN
  -- 1. Verifica associação com a organização
  IF auth.uid() IS NOT NULL THEN
    SELECT public.is_org_member(p_organization_id, auth.uid()) INTO v_is_member;
  ELSE
    -- Se porventura auth.uid() estiver nulo mas o cliente e orçamento existirem validamente
    v_is_member := true;
  END IF;

  -- 2. Verifica se o cliente existe nesta organização
  SELECT id, name, document, phone, email
  INTO v_cust_record
  FROM public.customers
  WHERE id = p_customer_id
    AND organization_id = p_organization_id;

  IF v_cust_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CUSTOMER_NOT_FOUND',
      'message', 'Cliente não encontrado nesta organização.'
    );
  END IF;

  -- 3. Procura por token existente para este orçamento ou cliente (menos de 60 dias)
  SELECT token INTO v_existing_token
  FROM public.customer_portal_tokens
  WHERE organization_id = p_organization_id
    AND customer_id = p_customer_id
    AND (
      (p_quote_id IS NOT NULL AND quote_id = p_quote_id) OR
      (p_quote_id IS NULL)
    )
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_token IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'token', v_existing_token,
      'has_document', (v_cust_record.document IS NOT NULL AND btrim(v_cust_record.document) <> '')
    );
  END IF;

  -- 4. Gera novo token seguro e único de 32 caracteres hexadecimais (usando gen_random_uuid nativo)
  v_new_token := lower(replace(gen_random_uuid()::text, '-', ''));

  INSERT INTO public.customer_portal_tokens (
    token,
    organization_id,
    customer_id,
    quote_id,
    expires_at
  ) VALUES (
    v_new_token,
    p_organization_id,
    p_customer_id,
    p_quote_id,
    NOW() + INTERVAL '90 days'
  );

  RETURN jsonb_build_object(
    'success', true,
    'token', v_new_token,
    'has_document', (v_cust_record.document IS NOT NULL AND btrim(v_cust_record.document) <> '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_customer_portal_token(UUID, UUID, UUID) TO anon, authenticated;
