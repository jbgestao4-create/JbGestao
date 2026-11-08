-- Migração 00088: Função RPC para Desvincular Estação Offline e Liberar Licença para Novo Computador

CREATE OR REPLACE FUNCTION public.desvincular_estacao_offline(
    p_device_fingerprint TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_total_removidos INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso não autenticado.' USING ERRCODE = '401';
    END IF;

    -- Remove o vínculo da estação para este usuário
    DELETE FROM public.offline_devices
    WHERE usuario_id = v_user_id;

    GET DIAGNOSTICS v_total_removidos = ROW_COUNT;

    RETURN jsonb_build_object(
        'sucesso', true,
        'removidos', v_total_removidos,
        'mensagem', 'Estação offline desvinculada com sucesso! A licença deste usuário foi liberada para ativação em um novo computador.'
    );
END;
$$;
