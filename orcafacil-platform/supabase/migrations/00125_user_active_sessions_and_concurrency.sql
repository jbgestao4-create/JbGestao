-- 00125_user_active_sessions_and_concurrency.sql
-- 1. Tabela para rastreamento de sessão ativa única por usuário e heartbeat online
CREATE TABLE IF NOT EXISTS public.user_active_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  session_token TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_active_sessions_org ON public.user_active_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_active_sessions_heartbeat ON public.user_active_sessions(last_heartbeat);

-- Habilita RLS
ALTER TABLE public.user_active_sessions ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler/atualizar sua própria sessão e verificar status
CREATE POLICY "Allow users to manage their own active session"
  ON public.user_active_sessions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Permissão anônima para verificar antes do login se email já está logado
CREATE POLICY "Allow anon read user_active_sessions"
  ON public.user_active_sessions
  FOR SELECT
  TO anon
  USING (true);

-- 2. Função RPC para registrar ou renovar heartbeat de sessão ativa
CREATE OR REPLACE FUNCTION public.register_user_session(
  p_email TEXT,
  p_session_token TEXT,
  p_org_id UUID DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_clean_email TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  v_clean_email := lower(trim(COALESCE(p_email, '')));

  INSERT INTO public.user_active_sessions (
    user_id,
    email,
    session_token,
    organization_id,
    last_heartbeat,
    ip_address,
    user_agent,
    created_at
  )
  VALUES (
    v_uid,
    v_clean_email,
    p_session_token,
    p_org_id,
    NOW(),
    p_ip,
    p_user_agent,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    session_token = EXCLUDED.session_token,
    organization_id = COALESCE(EXCLUDED.organization_id, public.user_active_sessions.organization_id),
    last_heartbeat = NOW(),
    ip_address = COALESCE(EXCLUDED.ip_address, public.user_active_sessions.ip_address),
    user_agent = COALESCE(EXCLUDED.user_agent, public.user_active_sessions.user_agent);

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_user_session(TEXT, TEXT, UUID, TEXT, TEXT) TO authenticated;

-- 3. Função RPC para verificar se email já possui sessão ativa recente (últimos 90 segundos)
-- Ignora se for o usuário proprietário (controlesoft@outlook.com ou marcado como owner)
CREATE OR REPLACE FUNCTION public.check_user_concurrent_session(
  p_email TEXT,
  p_current_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_clean_email TEXT;
  v_session RECORD;
  v_is_owner BOOLEAN := FALSE;
BEGIN
  v_clean_email := lower(trim(p_email));

  -- Proprietário do sistema tem privilégio de múltiplos logins simultâneos
  IF v_clean_email IN (
    'controlesoft@outlook.com',
    'bryanmendes968@gmail.com',
    'bryan@administrador.com',
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br'
  ) THEN
    RETURN jsonb_build_object('is_blocked', false, 'is_owner', true);
  END IF;

  SELECT 1 INTO v_is_owner
  FROM public.system_settings ss
  JOIN auth.users u ON (ss.value->>'user_id')::uuid = u.id
  WHERE ss.key = 'system_owner_user_id'
    AND lower(u.email) = v_clean_email;

  IF FOUND THEN
    RETURN jsonb_build_object('is_blocked', false, 'is_owner', true);
  END IF;

  -- Busca sessão ativa com heartbeat recente (menos de 90 segundos)
  SELECT * INTO v_session
  FROM public.user_active_sessions
  WHERE lower(email) = v_clean_email
    AND last_heartbeat > (NOW() - INTERVAL '90 seconds');

  IF FOUND THEN
    -- Se o token for exatamente o mesmo do mesmo navegador, permite
    IF p_current_token IS NOT NULL AND v_session.session_token = p_current_token THEN
      RETURN jsonb_build_object('is_blocked', false, 'same_session', true);
    END IF;

    RETURN jsonb_build_object(
      'is_blocked', true,
      'error', 'Já consta um usuário logado com esta conta.',
      'last_seen', v_session.last_heartbeat
    );
  END IF;

  RETURN jsonb_build_object('is_blocked', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_concurrent_session(TEXT, TEXT) TO anon, authenticated;

-- 4. Função RPC para encerrar a sessão ativa no logout
CREATE OR REPLACE FUNCTION public.clear_user_session()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NOT NULL THEN
    DELETE FROM public.user_active_sessions WHERE user_id = v_uid;
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_user_session() TO authenticated;

-- 5. Atualização da RPC admin_get_all_organizations para retornar logged_users_count
DROP FUNCTION IF EXISTS public.admin_get_all_organizations();

CREATE FUNCTION public.admin_get_all_organizations()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  is_active boolean,
  trial_ends_at timestamptz,
  created_at timestamptz,
  admin_email text,
  admin_name text,
  cnpj text,
  address text,
  responsible text,
  notes text,
  members_count bigint,
  modules text[],
  access_plan_id uuid,
  access_plan_name text,
  access_plan_description text,
  last_access_at timestamptz,
  logged_users_count bigint
)
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.is_access_plan_manager() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Apenas o proprietário do sistema pode consultar empresas cadastradas.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    o.is_active,
    o.trial_ends_at,
    o.created_at,
    COALESCE(o.admin_email, '')::text,
    COALESCE(o.admin_name, 'Administrador')::text,
    COALESCE(o.cnpj, '')::text,
    COALESCE(o.address, '')::text,
    COALESCE(o.responsible, '')::text,
    COALESCE(o.notes, '')::text,
    COUNT(DISTINCT om.user_id),
    COALESCE(array_agg(DISTINCT odm.module_code) FILTER (WHERE odm.module_code IS NOT NULL), '{}'),
    o.access_plan_id,
    ap.name,
    ap.description,
    COALESCE(o.last_access_at, MAX(p.last_access_at)) AS last_access_at,
    COUNT(DISTINCT uas.user_id) FILTER (WHERE uas.last_heartbeat > (NOW() - INTERVAL '90 seconds')) AS logged_users_count
  FROM public.organizations o
  LEFT JOIN public.organization_members om ON om.organization_id = o.id
  LEFT JOIN public.profiles p ON p.id = om.user_id
  LEFT JOIN public.organization_dashboard_modules odm ON odm.organization_id = o.id
  LEFT JOIN public.access_plans ap ON ap.id = o.access_plan_id
  LEFT JOIN public.user_active_sessions uas ON uas.organization_id = o.id
  GROUP BY
    o.id, o.name, o.slug, o.is_active, o.trial_ends_at, o.created_at,
    o.admin_email, o.admin_name, o.cnpj, o.address, o.responsible, o.notes,
    o.access_plan_id, ap.name, ap.description, o.last_access_at
  ORDER BY o.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_all_organizations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_all_organizations() TO authenticated;
