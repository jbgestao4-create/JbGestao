-- Migration 00111: Adiciona coluna target_page em system_announcements para suportar anúncios da Tela Inicial e da Tela de Login

ALTER TABLE public.system_announcements
  ADD COLUMN IF NOT EXISTS target_page TEXT NOT NULL DEFAULT 'dashboard'
  CHECK (target_page IN ('dashboard', 'login'));

CREATE INDEX IF NOT EXISTS idx_system_announcements_target_order
  ON public.system_announcements (target_page, is_active, order_index ASC, created_at DESC);
