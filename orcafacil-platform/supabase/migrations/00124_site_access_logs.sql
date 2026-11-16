-- 00124_site_access_logs.sql
-- Tabela para registro e cálculo de acessos diários e mensais ao site (endereço IP, rota, user-agent, referer, dispositivo)
-- Apenas o Proprietário do Sistema pode visualizar todos os logs, e qualquer visitante (anon/auth) pode registrar visitas.

CREATE TABLE IF NOT EXISTS public.site_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '/',
  user_agent TEXT,
  referrer TEXT,
  is_mobile BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para buscas rápidas por data e agrupamentos de IP
CREATE INDEX IF NOT EXISTS idx_site_access_logs_created_at ON public.site_access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_access_logs_ip ON public.site_access_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_site_access_logs_date_ip ON public.site_access_logs(created_at, ip_address);

-- Habilita RLS
ALTER TABLE public.site_access_logs ENABLE ROW LEVEL SECURITY;

-- Visitantes e usuários logados podem registrar visitas
CREATE POLICY "Allow public insert to site_access_logs"
  ON public.site_access_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Apenas o proprietário do sistema pode consultar os logs
CREATE POLICY "Allow system owner select on site_access_logs"
  ON public.site_access_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.system_settings
      WHERE key = 'system_owner_user_id'
        AND (value->>'user_id')::uuid = auth.uid()
    )
    OR auth.email() = 'controlesoft@outlook.com'
  );

-- RPC atômica para registro rápido de visita com detecção de IP se passado
CREATE OR REPLACE FUNCTION public.record_site_visit(
  p_ip TEXT,
  p_path TEXT DEFAULT '/',
  p_user_agent TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL,
  p_is_mobile BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted_id UUID;
  v_clean_ip TEXT;
BEGIN
  v_clean_ip := COALESCE(NULLIF(TRIM(p_ip), ''), 'Desconhecido');

  INSERT INTO public.site_access_logs (
    ip_address,
    path,
    user_agent,
    referrer,
    is_mobile,
    created_at
  )
  VALUES (
    v_clean_ip,
    COALESCE(NULLIF(TRIM(p_path), ''), '/'),
    p_user_agent,
    p_referrer,
    COALESCE(p_is_mobile, FALSE),
    NOW()
  )
  RETURNING id INTO v_inserted_id;

  RETURN jsonb_build_object('success', true, 'id', v_inserted_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_site_visit(TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;
