-- Migration 00098: Adiciona system_updates na publicacao supabase_realtime para sincronizacao em tempo real

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
      AND pc.relname = 'system_updates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_updates;
  END IF;
END $$;
