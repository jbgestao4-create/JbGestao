-- 00046_fix_portal_org_columns.sql
-- Corrige a consulta na tabela organizations (que possui apenas id, name, slug)

CREATE OR REPLACE FUNCTION public.get_customer_portal_public_info(
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_record RECORD;
  v_cust_record RECORD;
  v_org_record RECORD;
  v_quote_record RECORD;
  v_doc_clean TEXT;
  v_masked_doc TEXT := NULL;
  v_first_name TEXT := '';
BEGIN
  -- 1. Busca o token
  SELECT id, organization_id, customer_id, quote_id, expires_at
  INTO v_token_record
  FROM public.customer_portal_tokens
  WHERE token = p_token;

  IF v_token_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'error', 'TOKEN_NOT_FOUND',
      'message', 'Link de orçamento inválido ou não encontrado.'
    );
  END IF;

  IF v_token_record.expires_at IS NOT NULL AND v_token_record.expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'found', false,
      'error', 'TOKEN_EXPIRED',
      'message', 'Este link de orçamento expirou. Solicite um novo link atualizado à empresa.'
    );
  END IF;

  -- 2. Busca Organização (apenas colunas existentes id, name)
  SELECT id, name
  INTO v_org_record
  FROM public.organizations
  WHERE id = v_token_record.organization_id;

  -- 3. Busca Cliente
  SELECT name, document
  INTO v_cust_record
  FROM public.customers
  WHERE id = v_token_record.customer_id;

  -- 4. Busca Orçamento de referência (se houver)
  IF v_token_record.quote_id IS NOT NULL THEN
    SELECT quote_number
    INTO v_quote_record
    FROM public.quotes
    WHERE id = v_token_record.quote_id;
  END IF;

  -- 5. Extrai primeiro nome para saudação
  IF v_cust_record.name IS NOT NULL THEN
    v_first_name := split_part(btrim(v_cust_record.name), ' ', 1);
  END IF;

  -- 6. Mascara documento para orientação do usuário (sem expor o CPF completo)
  v_doc_clean := regexp_replace(COALESCE(v_cust_record.document, ''), '\D', '', 'g');
  IF length(v_doc_clean) = 11 THEN
    -- CPF: ***.***.890-**
    v_masked_doc := '***.***.' || substr(v_doc_clean, 7, 3) || '-**';
  ELSIF length(v_doc_clean) = 14 THEN
    -- CNPJ: **.***.***/0001-**
    v_masked_doc := '**.***.' || substr(v_doc_clean, 6, 3) || '/' || substr(v_doc_clean, 9, 4) || '-**';
  ELSIF length(v_doc_clean) > 0 THEN
    v_masked_doc := '***.' || right(v_doc_clean, 3);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'organization_name', COALESCE(v_org_record.name, 'Empresa'),
    'customer_name', COALESCE(v_cust_record.name, 'Cliente'),
    'customer_first_name', v_first_name,
    'has_document', (v_doc_clean <> ''),
    'masked_document', v_masked_doc,
    'quote_number', v_quote_record.quote_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_portal_public_info(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.access_customer_portal_quotes(
  p_token TEXT,
  p_document TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_record RECORD;
  v_cust_record RECORD;
  v_org_record RECORD;
  v_input_doc TEXT;
  v_stored_doc TEXT;
  v_quotes_json JSONB;
BEGIN
  -- 1. Normaliza o documento informado pelo usuário (apenas dígitos)
  v_input_doc := regexp_replace(COALESCE(p_document, ''), '\D', '', 'g');

  IF length(v_input_doc) < 11 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_DOCUMENT_FORMAT',
      'message', 'Por favor, informe um CPF válido com 11 dígitos ou CNPJ com 14 dígitos.'
    );
  END IF;

  -- 2. Localiza o token
  SELECT id, organization_id, customer_id, quote_id, expires_at
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

  -- 3. Localiza o cliente
  SELECT id, organization_id, name, document, phone, email, address, address_number
  INTO v_cust_record
  FROM public.customers
  WHERE id = v_token_record.customer_id
    AND organization_id = v_token_record.organization_id;

  IF v_cust_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CUSTOMER_NOT_FOUND',
      'message', 'Cadastro do cliente não encontrado.'
    );
  END IF;

  v_stored_doc := regexp_replace(COALESCE(v_cust_record.document, ''), '\D', '', 'g');

  IF v_stored_doc = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NO_DOCUMENT_ON_FILE',
      'message', 'O cadastro deste orçamento ainda não possui CPF/CNPJ registrado. Solicite à empresa que atualize o seu documento para liberar o acesso seguro.'
    );
  END IF;

  -- 4. Compara o documento informado com o documento registrado
  IF v_input_doc <> v_stored_doc THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DOCUMENT_MISMATCH',
      'message', 'O CPF/CNPJ informado não coincide com o cadastro deste orçamento. Verifique os dados digitados e tente novamente.'
    );
  END IF;

  -- 5. Sucesso na validação! Atualiza métricas de acesso do token
  UPDATE public.customer_portal_tokens
  SET last_accessed_at = NOW(),
      access_count = access_count + 1
  WHERE id = v_token_record.id;

  -- 6. Busca dados da Organização (id e name)
  SELECT id, name
  INTO v_org_record
  FROM public.organizations
  WHERE id = v_token_record.organization_id;

  -- 7. Busca todos os orçamentos gerados para este cliente nesta organização
  -- Incluindo itens de cada orçamento agrupados
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'quoteNumber', q.quote_number,
        'status', q.status,
        'subtotal', q.subtotal::text,
        'discount', q.discount::text,
        'total', q.total::text,
        'validUntil', q.valid_until,
        'notes', q.notes,
        'createdAt', q.created_at,
        'updatedAt', q.updated_at,
        'sellerName', q.seller_name,
        'items', (
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', qi.id,
                'description', qi.description,
                'quantity', qi.quantity::text,
                'unitPrice', qi.unit_price::text,
                'total', qi.total::text,
                'unit', qi.unit,
                'itemType', qi.item_type,
                'sortOrder', qi.sort_order
              )
              ORDER BY qi.sort_order ASC, qi.created_at ASC
            ),
            '[]'::jsonb
          )
          FROM public.quote_items qi
          WHERE qi.quote_id = q.id
        )
      )
      ORDER BY q.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_quotes_json
  FROM public.quotes q
  WHERE q.organization_id = v_token_record.organization_id
    AND q.customer_id = v_token_record.customer_id;

  -- 8. Retorna payload completo
  RETURN jsonb_build_object(
    'success', true,
    'customer', jsonb_build_object(
      'id', v_cust_record.id,
      'name', v_cust_record.name,
      'email', v_cust_record.email,
      'phone', v_cust_record.phone,
      'address', v_cust_record.address,
      'addressNumber', v_cust_record.address_number
    ),
    'organization', jsonb_build_object(
      'id', v_org_record.id,
      'name', v_org_record.name
    ),
    'highlightedQuoteId', v_token_record.quote_id,
    'quotes', v_quotes_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.access_customer_portal_quotes(TEXT, TEXT) TO anon, authenticated;

