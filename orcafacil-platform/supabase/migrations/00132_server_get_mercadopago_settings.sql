-- 00132_server_get_mercadopago_settings.sql
-- Permite leitura das configurações do Mercado Pago pelo backend serverless e endpoints da API

CREATE OR REPLACE FUNCTION public.server_get_mercadopago_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  cfg public.mercadopago_settings%ROWTYPE;
BEGIN
  SELECT * INTO cfg
  FROM public.mercadopago_settings
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'access_token', '',
      'public_key', '',
      'webhook_secret', '',
      'is_sandbox', true,
      'notification_url', 'https://controlesoft.vercel.app/api/mercadopago/webhook',
      'pix_key', '',
      'auto_activate_license', true,
      'license_duration_days', 30,
      'is_active', true
    );
  END IF;

  RETURN jsonb_build_object(
    'id', cfg.id,
    'access_token', cfg.access_token,
    'public_key', cfg.public_key,
    'webhook_secret', cfg.webhook_secret,
    'is_sandbox', cfg.is_sandbox,
    'notification_url', cfg.notification_url,
    'pix_key', cfg.pix_key,
    'auto_activate_license', cfg.auto_activate_license,
    'license_duration_days', cfg.license_duration_days,
    'is_active', cfg.is_active,
    'updated_at', cfg.updated_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.server_get_mercadopago_settings() TO anon, authenticated, service_role;
