-- Migration 00050: Garante que cada operador tenha no máximo um caixa aberto por vez na organização
-- Caso existam múltiplos caixas abertos pelo mesmo usuário, mantém apenas o primeiro aberto e encerra os demais

WITH ranked_open AS (
  SELECT
    id,
    expected_money,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, opened_by
      ORDER BY opened_at ASC
    ) AS rn
  FROM public.cash_sessions
  WHERE status = 'open'
)
UPDATE public.cash_sessions cs
SET
  status = 'closed',
  closed_by = cs.opened_by,
  closed_at = NOW(),
  counted_money = cs.expected_money,
  difference = 0,
  notes = COALESCE(cs.notes || E'\n', '') || '[Fechado automaticamente: limite de 1 caixa aberto por usuário]',
  updated_at = NOW()
FROM ranked_open ro
WHERE cs.id = ro.id
  AND ro.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_one_open_per_operator
  ON public.cash_sessions (organization_id, opened_by)
  WHERE status = 'open';

