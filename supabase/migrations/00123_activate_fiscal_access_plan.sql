-- 00123_activate_fiscal_access_plan.sql
-- Desbloqueia e ativa o Plano Completo com Emissão Fiscal para exibição e contratação direta na página inicial

UPDATE public.access_plans
SET is_locked = false,
    is_active = true
WHERE id = '00000000-0000-4000-8000-000000000004';
