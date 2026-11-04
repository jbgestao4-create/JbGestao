-- 00048_customer_portal_reject_quote.sql
-- Permite ao cliente recusar um orçamento pelo portal público via link token.

CREATE OR REPLACE FUNCTION public.reject_customer_portal_quote(
  p_token TEXT,
  p_quote_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_record RECORD;
  v_quote_record RECORD;
BEGIN
  -- 1. Localiza e valida o token
  SELECT id, organization_id, customer_id, expires_at
  INTO v_token_record
  FROM public.customer_portal_tokens
  WHERE token = p_token;

  IF v_token_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TOKEN_NOT_FOUND',
      'message', 'Link de orçamento inválido ou não encontrado.'
    );
  END IF;

  IF v_token_record.expires_at IS NOT NULL AND v_token_record.expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TOKEN_EXPIRED',
      'message', 'Este link de orçamento expirou. Solicite um novo link atualizado à empresa.'
    );
  END IF;

  -- 2. Localiza o orçamento vinculado à mesma organização e ao mesmo cliente
  SELECT id, quote_number, status
  INTO v_quote_record
  FROM public.quotes
  WHERE id = p_quote_id
    AND organization_id = v_token_record.organization_id
    AND customer_id = v_token_record.customer_id;

  IF v_quote_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'QUOTE_NOT_FOUND',
      'message', 'Orçamento não encontrado para este cliente.'
    );
  END IF;

  IF v_quote_record.status = 'rejected' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Este orçamento já se encontra recusado.'
    );
  END IF;

  IF v_quote_record.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'QUOTE_ALREADY_COMPLETED',
      'message', 'Este orçamento já foi concluído ou faturado.'
    );
  END IF;

  IF v_quote_record.status = 'approved' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'QUOTE_ALREADY_APPROVED',
      'message', 'Este orçamento já foi aprovado e não pode ser recusado pelo portal.'
    );
  END IF;

  -- 3. Atualiza orçamento para recusado
  UPDATE public.quotes
  SET status = 'rejected',
      approved_by = NULL,
      updated_at = NOW()
  WHERE id = v_quote_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Orçamento recusado com sucesso.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_customer_portal_quote(TEXT, UUID) TO anon, authenticated;

