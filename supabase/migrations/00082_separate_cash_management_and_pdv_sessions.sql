-- Migration 00082: Separação de escopo de sessões de caixa (PDV vs Gestão de Caixa /cash)
-- Permite que a abertura do Caixa Geral (/cash) seja totalmente independente dos Caixas do PDV (/orcafacil/sales)

-- 1. Coluna de tipo de sessão ('pdv' para terminais de venda e 'cash_management' para Caixa Geral)
ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'pdv'
  CHECK (session_type IN ('pdv', 'cash_management'));

-- Atualiza sessões que tenham identificador de Caixa Geral
UPDATE public.cash_sessions
SET session_type = 'cash_management'
WHERE register_id IN ('Caixa Geral', 'Caixa Diário', 'Gestão de Caixa', 'reg-padrao-01');

-- 2. Remove os índices únicos anteriores que misturavam o caixa geral com os caixas de PDV
DROP INDEX IF EXISTS public.cash_sessions_one_open_per_operator;
DROP INDEX IF EXISTS public.cash_sessions_one_open_per_register;

-- 3. Índice único para operadores de PDV: cada operador pode ter no máximo 1 caixa de PDV aberto
CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_one_open_per_operator_pdv
  ON public.cash_sessions (organization_id, opened_by)
  WHERE status = 'open' AND session_type = 'pdv';

-- 4. Índice único para terminais de PDV: cada terminal (ex: 'Caixa 01') só pode ter 1 sessão de PDV aberta
CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_one_open_per_register_pdv
  ON public.cash_sessions (organization_id, register_id)
  WHERE status = 'open' AND session_type = 'pdv';

-- 5. Índice único para Gestão de Caixa (/cash): no máximo 1 Caixa Geral aberto por organização
CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_one_open_cash_management
  ON public.cash_sessions (organization_id)
  WHERE status = 'open' AND session_type = 'cash_management';

-- 6. Índice de busca para consultas de sessões por organização, tipo e status
CREATE INDEX IF NOT EXISTS cash_sessions_org_type_status_idx
  ON public.cash_sessions (organization_id, session_type, status);

