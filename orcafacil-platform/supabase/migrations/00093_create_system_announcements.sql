-- Migration 00093: Criar tabela para gerenciar anúncios / banners da tela inicial (Perfil do Desenvolvedor)

CREATE TABLE IF NOT EXISTS public.system_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_announcements_order
  ON public.system_announcements (is_active, order_index ASC, created_at DESC);

ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos podem visualizar anuncios ativos" ON public.system_announcements;
CREATE POLICY "Todos podem visualizar anuncios ativos"
  ON public.system_announcements FOR SELECT
  USING (is_active = TRUE OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Desenvolvedores gerenciam anuncios" ON public.system_announcements;
CREATE POLICY "Desenvolvedores gerenciam anuncios"
  ON public.system_announcements FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
