-- Migration 00118: Configuração global de tempo de inatividade do sistema
INSERT INTO public.system_settings (key, value, updated_at)
VALUES (
  'inactivity_timeout',
  jsonb_build_object(
    'timeout_minutes', 2,
    'updated_at', NOW()
  ),
  NOW()
)
ON CONFLICT (key) DO NOTHING;
