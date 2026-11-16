-- 00122_fix_access_plan_manager_permissions.sql
-- Garante que qualquer proprietário da plataforma possa gerenciar e salvar planos de acesso,
-- incluindo suporte a novos e-mails de proprietários e atualização em tempo real via Supabase Realtime.

CREATE OR REPLACE FUNCTION public.is_access_plan_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      public.is_system_owner(auth.uid()) = true
      OR COALESCE(
        lower(auth.jwt() ->> 'email') IN (
          'adm@adm.com',
          'admin@adm.com',
          'controlesoft@outlook.com',
          'jbgestao4@gmail.com',
          'bryan.noponto@gmail.com',
          'proprietario@jbsoftware.com.br',
          'owner@jbsoftware.com.br',
          'bryan@administrador.com',
          'bryanmendes968@gmail.com'
        ),
        false
      )
      OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_platform_owner')::boolean, false)
      OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_platform_owner')::boolean, false)
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_access_plan_manager() TO authenticated;

-- Habilita publicação no Realtime para a tabela access_plans se ainda não estiver ativa
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'access_plans'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.access_plans;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;
