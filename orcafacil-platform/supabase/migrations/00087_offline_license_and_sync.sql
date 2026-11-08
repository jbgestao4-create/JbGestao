-- Migração 00087: Suporte a PWA Offline-First, Licença de Dispositivo Único e Sincronização Idempotente

-- 1. Tabela para vincular 1 dispositivo por usuário da organização
CREATE TABLE IF NOT EXISTS public.offline_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organizacao_id UUID NOT NULL,
    device_fingerprint TEXT NOT NULL,
    token_licenca TEXT NOT NULL,
    nome_identificador TEXT DEFAULT 'Estação PDV Local',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    ultimo_sync_em TIMESTAMPTZ,
    CONSTRAINT uk_usuario_offline_ativo UNIQUE (usuario_id)
);

-- RLS para offline_devices
ALTER TABLE public.offline_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem visualizar sua própria estação offline"
    ON public.offline_devices
    FOR SELECT
    USING (auth.uid() = usuario_id);

-- 2. Adicionar coluna de idempotência para vendas offline na tabela quotes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotes' AND column_name = 'uuid_offline'
    ) THEN
        ALTER TABLE public.quotes ADD COLUMN uuid_offline UUID UNIQUE;
    END IF;
END $$;

-- 3. Função RPC para Ativação e Validação da Licença Offline de Uso Único
CREATE OR REPLACE FUNCTION public.ativar_licenca_offline(
    p_device_fingerprint TEXT,
    p_nome_identificador TEXT DEFAULT 'Estação PDV Local'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_token TEXT;
    v_existente RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso não autenticado.' USING ERRCODE = '401';
    END IF;

    -- Localiza a organização ativa do membro
    SELECT organization_id INTO v_org_id 
    FROM public.organization_members 
    WHERE user_id = v_user_id 
    LIMIT 1;

    IF v_org_id IS NULL THEN
        SELECT id INTO v_org_id 
        FROM public.organizations 
        WHERE created_by = v_user_id 
        LIMIT 1;
    END IF;

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object(
            'sucesso', false,
            'codigo_erro', 'ORGANIZATION_NOT_FOUND',
            'mensagem', 'Organização não encontrada para o usuário autenticado.'
        );
    END IF;

    -- Verifica se já existe um dispositivo registrado para este usuário
    SELECT * INTO v_existente 
    FROM public.offline_devices 
    WHERE usuario_id = v_user_id;

    IF FOUND THEN
        -- Se já existe cadastro e o fingerprint é diferente, bloqueia conforme a regra de licença de uso único
        IF v_existente.device_fingerprint <> p_device_fingerprint THEN
            RETURN jsonb_build_object(
                'sucesso', false,
                'codigo_erro', 'LICENSE_ALREADY_ASSIGNED',
                'mensagem', 'Licença Offline já ativada em outro dispositivo. Cada usuário só pode possuir 1 estação local vinculada.'
            );
        ELSE
            -- Mesmo dispositivo: confirma e retorna o token existente
            UPDATE public.offline_devices 
            SET ultimo_sync_em = timezone('utc'::text, now())
            WHERE id = v_existente.id;

            RETURN jsonb_build_object(
                'sucesso', true,
                'token_licenca', v_existente.token_licenca,
                'mensagem', 'Dispositivo já autorizado e reconectado com sucesso.'
            );
        END IF;
    END IF;

    -- Primeiro registro: gera o token exclusivo da estação
    v_token := encode(gen_random_bytes(32), 'hex');

    INSERT INTO public.offline_devices (
        usuario_id,
        organizacao_id,
        device_fingerprint,
        token_licenca,
        nome_identificador,
        ultimo_sync_em
    ) VALUES (
        v_user_id,
        v_org_id,
        p_device_fingerprint,
        v_token,
        COALESCE(p_nome_identificador, 'Estação PDV Local'),
        timezone('utc'::text, now())
    );

    RETURN jsonb_build_object(
        'sucesso', true,
        'token_licenca', v_token,
        'mensagem', 'Licença Offline ativada com sucesso neste dispositivo.'
    );
END;
$$;

-- 4. Função RPC para Recebimento Idempotente das Vendas Offline
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

        -- Abate o estoque central no inventory_items
        IF v_item.produto_id IS NOT NULL THEN
            UPDATE public.inventory_items
            SET current_stock = GREATEST(0, current_stock - v_item.quantidade),
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
