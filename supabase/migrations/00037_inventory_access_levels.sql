-- Migration 00037: Níveis de acesso ao estoque para membros operacionais
-- Nível 1 = Consultar Estoque apenas (não pode editar nem cadastrar)
-- Nível 2 = Consulta e cadastro de estoque (não pode editar, apenas cadastrar novos)
-- Nível 3 = Acesso geral ao estoque (consulta, cadastro, edição e movimentação)

ALTER TABLE public.organization_members
ADD COLUMN IF NOT EXISTS inventory_access_level INTEGER NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.organization_members.inventory_access_level IS
'Nível de acesso ao estoque (MOD-02): 1 = Consulta apenas, 2 = Consulta e cadastro de novos produtos, 3 = Acesso geral';

