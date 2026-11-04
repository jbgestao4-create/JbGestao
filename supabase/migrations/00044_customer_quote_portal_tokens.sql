-- 00044_customer_quote_portal_tokens.sql
-- Portal Seguro de Orçamentos do Cliente via Link Único com Validação de CPF/CNPJ

-- 1. TABELA DE TOKENS DE ACESSO DO PORTAL DO CLIENTE
CREATE TABLE IF NOT EXISTS public.customer_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
  last_accessed_at TIMESTAMPTZ,
  access_count INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_portal_customer_org FOREIGN KEY (organization_id, customer_id)
    REFERENCES public.customers(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customer_portal_tokens_token
  ON public.customer_portal_tokens(token);

CREATE INDEX IF NOT EXISTS idx_customer_portal_tokens_cust
  ON public.customer_portal_tokens(organization_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_portal_tokens_quote
  ON public.customer_portal_tokens(quote_id);

-- 2. POLÍTICAS RLS (Row Level Security)
ALTER TABLE public.customer_portal_tokens ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados membros da organização podem consultar os tokens emitidos
CREATE POLICY "org_members_select_portal_tokens"
  ON public.customer_portal_tokens
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Usuários autenticados membros da organização podem criar tokens
CREATE POLICY "org_members_insert_portal_tokens"
  ON public.customer_portal_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- 3. FUNÇÃO RPC: Gerar Token de Acesso ao Portal (Chamada por membros autenticados)
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
  v_is_member BOOLEAN;
  v_existing_token TEXT;
  v_new_token TEXT;
  v_cust_record RECORD;
BEGIN
  -- 1. Verifica se o usuário autenticado pertence à organização
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'FORBIDDEN',
      'message', 'Sem permissão nesta organização para gerar links de acesso'
    );
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
      'message', 'Cliente não encontrado'
    );
  END IF;

  -- 3. Reutiliza token ativo criado há menos de 14 dias para o mesmo cliente e orçamento (se aplicável)
  SELECT token INTO v_existing_token
  FROM public.customer_portal_tokens
  WHERE organization_id = p_organization_id
    AND customer_id = p_customer_id
    AND (
      (p_quote_id IS NOT NULL AND quote_id = p_quote_id) OR
      (p_quote_id IS NULL)
    )
    AND (expires_at IS NULL OR expires_at > NOW())
    AND created_at >= (NOW() - INTERVAL '14 days')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_token IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'token', v_existing_token,
      'has_document', (v_cust_record.document IS NOT NULL AND btrim(v_cust_record.document) <> '')
    );
  END IF;

  -- 4. Gera novo token alfanumérico seguro com alta entropia (32 caracteres hexadecimais)
  v_new_token := lower(encode(gen_random_bytes(16), 'hex'));

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

GRANT EXECUTE ON FUNCTION public.generate_customer_portal_token(UUID, UUID, UUID) TO authenticated;

-- 4. FUNÇÃO RPC PÚBLICA: Obter Informações Preliminares do Token (Sem vazar dados sensíveis)
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

  -- 2. Busca Organização
  SELECT name, phone, email
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
    'organization_phone', v_org_record.phone,
    'customer_name', COALESCE(v_cust_record.name, 'Cliente'),
    'customer_first_name', v_first_name,
    'has_document', (v_doc_clean <> ''),
    'masked_document', v_masked_doc,
    'quote_number', v_quote_record.quote_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_portal_public_info(TEXT) TO anon, authenticated;

-- 5. FUNÇÃO RPC PÚBLICA: Validar Documento (CPF/CNPJ) e Retornar Todos os Orçamentos do Cliente
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

  -- 6. Busca dados da Organização
  SELECT id, name, phone, email
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
      'name', v_org_record.name,
      'phone', v_org_record.phone,
      'email', v_org_record.email
    ),
    'highlightedQuoteId', v_token_record.quote_id,
    'quotes', v_quotes_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.access_customer_portal_quotes(TEXT, TEXT) TO anon, authenticated;

