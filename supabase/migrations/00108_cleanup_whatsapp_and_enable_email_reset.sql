-- Migration 00108: Limpeza de funcoes de WhatsApp e retorno definitivo para reset de senha por Email
-- O envio do codigo de confirmacao passa a ser realizado exclusivamente pelo email cadastrado pelo funcionario.

DROP FUNCTION IF EXISTS public.request_whatsapp_password_reset(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.verify_whatsapp_password_reset_code(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.complete_whatsapp_password_reset(TEXT, TEXT, TEXT, TEXT);
DROP TABLE IF EXISTS public.password_reset_codes CASCADE;
