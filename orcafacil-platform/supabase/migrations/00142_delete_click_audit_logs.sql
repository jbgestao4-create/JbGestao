-- Migração 00142: Remove registros legados de ação CLIQUE da tabela audit_logs
DELETE FROM public.audit_logs
WHERE acao = 'CLIQUE';
