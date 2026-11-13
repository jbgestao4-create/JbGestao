-- Migração 00089: Ajustar nome da coluna de estoque em inventory_items na RPC de vendas offline

CREATE OR REPLACE FUNCTION public.processar_venda_offline_idempotente(
    p_uuid_venda UUID,
    p_data_hora TIMESTAMPTZ,
    p_usuario_id UUID,
    p_organizacao_id UUID,
    p_itens JSONB,
    p_valor_total NUMERIC,
    p_forma_pagamento TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_quote_id UUID;
    v_next_number BIGINT;
    v_item RECORD;
BEGIN
    -- 1. Checagem de idempotência: se o uuid_offline já existe, não duplica
    SELECT id INTO v_quote_id FROM public.quotes WHERE uuid_offline = p_uuid_venda;
    IF FOUND THEN
        RETURN jsonb_build_object('sucesso', true, 'ja_existia', true, 'sale_id', v_quote_id);
    END IF;

    -- 2. Gera o próximo número de pedido para a organização
    SELECT COALESCE(MAX(quote_number), 0) + 1 INTO v_next_number
    FROM public.quotes
    WHERE organization_id = p_organizacao_id;

    -- 3. Insere a venda no cabeçalho quotes como aprovada
    INSERT INTO public.quotes (
        organization_id,
        quote_number,
        status,
        subtotal,
        discount,
        total,
        notes,
        seller_name,
        created_at,
        uuid_offline
    ) VALUES (
        p_organizacao_id,
        v_next_number,
        'approved',
        p_valor_total,
        0,
        p_valor_total,
        concat('Venda emitida em contingência offline no PDV. Pagamento: ', p_forma_pagamento),
        'Operador PDV Offline',
        p_data_hora,
        p_uuid_venda
    ) RETURNING id INTO v_quote_id;

    -- 4. Insere cada item e abate o estoque correspondente
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_itens) AS x(
        produto_id UUID,
        quantidade NUMERIC,
        preco_unitario NUMERIC,
        subtotal NUMERIC,
        nome TEXT
    )
    LOOP
        INSERT INTO public.quote_items (
            quote_id,
            organization_id,
            item_type,
            inventory_item_id,
            description,
            unit,
            quantity,
            unit_price,
            total
        ) VALUES (
            v_quote_id,
            p_organizacao_id,
            'product',
            v_item.produto_id,
            COALESCE(v_item.nome, 'Produto PDV'),
            'UN',
            v_item.quantidade,
            v_item.preco_unitario,
            v_item.subtotal
        );

        -- Abate o estoque central no inventory_items usando a coluna quantity_on_hand
        IF v_item.produto_id IS NOT NULL THEN
            UPDATE public.inventory_items
            SET quantity_on_hand = GREATEST(0, (COALESCE(quantity_on_hand::numeric, 0) - v_item.quantidade)::numeric)::text,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_item.produto_id AND organization_id = p_organizacao_id;
        END IF;
    END LOOP;

    -- Atualiza último sync do dispositivo do usuário
    UPDATE public.offline_devices
    SET ultimo_sync_em = timezone('utc'::text, now())
    WHERE usuario_id = p_usuario_id;

    RETURN jsonb_build_object(
        'sucesso', true,
        'ja_existia', false,
        'sale_id', v_quote_id
    );
END;
$$;
