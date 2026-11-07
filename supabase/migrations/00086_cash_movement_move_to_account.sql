-- Migration 00086: Adiciona flag move_to_account na tabela de movimentações de caixa (sangria para a conta bancária)
ALTER TABLE public.cash_session_movements
  ADD COLUMN IF NOT EXISTS move_to_account BOOLEAN NOT NULL DEFAULT FALSE;

