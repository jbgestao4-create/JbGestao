-- Migration 00104: Gerenciamento e Sincronizacao Automatica da Versao Atual do Sistema
-- Permite que quando uma nova atualizacao for cadastrada ou marcada como versao atual,
-- ela seja propagada instantaneamente para a tela inicial (Dashboard) e todo o sistema.

-- 1. Adicionar coluna is_current na tabela system_updates (se nao existir)
ALTER TABLE public.system_updates
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_system_updates_is_current
  ON public.system_updates (is_current)
  WHERE is_current = true;

-- 2. Garantir registro de configuracao global system_version em system_settings
INSERT INTO public.system_settings (key, value, updated_at)
VALUES (
  'system_version',
  jsonb_build_object(
    'version', 'v1.0',
    'updated_at', NOW()
  ),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- 3. Permitir leitura publica (inclusive anon) especificamente da chave 'system_version'
DROP POLICY IF EXISTS "system_settings_select_version_public" ON public.system_settings;
CREATE POLICY "system_settings_select_version_public"
  ON public.system_settings
  FOR SELECT
  USING (key = 'system_version');

-- 4. Adicionar system_settings na publicacao supabase_realtime para sincronizacao em tempo real
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class pc ON pr.prrelid = pc.oid
    JOIN pg_publication pp ON pr.prpubid = pp.oid
    WHERE pp.pubname = 'supabase_realtime'
      AND pc.relname = 'system_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
  END IF;
END $$;
