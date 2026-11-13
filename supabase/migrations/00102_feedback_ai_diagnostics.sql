-- Migration 00102: Diagnósticos técnicos da IA de Suporte Integrado
-- Armazena o retorno estruturado da ferramenta registrar_analise_suporte

CREATE TABLE IF NOT EXISTS public.feedback_ai_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  suggestion_id UUID NOT NULL,
  requer_analise_dev BOOLEAN NOT NULL DEFAULT false,
  resumo_problema TEXT,
  causa_provavel TEXT,
  componentes_afetados TEXT[] DEFAULT '{}',
  passos_reproducao TEXT[] DEFAULT '{}',
  sugestao_tecnica_ponto_a_ponto TEXT[] DEFAULT '{}',
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_feedback_ai_diagnostics_suggestion
    FOREIGN KEY (organization_id, suggestion_id)
    REFERENCES public.feedback_suggestions(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feedback_ai_diagnostics_suggestion
  ON public.feedback_ai_diagnostics (organization_id, suggestion_id, created_at DESC);

ALTER TABLE public.feedback_ai_diagnostics ENABLE ROW LEVEL SECURITY;

-- Proprietários e desenvolvedores autorizados podem ler diagnósticos técnicos
DROP POLICY IF EXISTS "Proprietarios leem diagnosticos de suporte da IA" ON public.feedback_ai_diagnostics;
CREATE POLICY "Proprietarios leem diagnosticos de suporte da IA"
  ON public.feedback_ai_diagnostics FOR SELECT TO authenticated
  USING (
    public.is_feedback_owner(organization_id)
  );

-- Inserção de diagnósticos por usuários autenticados da organização (ao abrir chamado / executar IA)
DROP POLICY IF EXISTS "Membros gravam diagnosticos de suporte da IA" ON public.feedback_ai_diagnostics;
CREATE POLICY "Membros gravam diagnosticos de suporte da IA"
  ON public.feedback_ai_diagnostics FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
    OR public.is_feedback_owner(organization_id)
  );

-- Atualização de diagnósticos pelos proprietários
DROP POLICY IF EXISTS "Proprietarios atualizam diagnosticos de suporte da IA" ON public.feedback_ai_diagnostics;
CREATE POLICY "Proprietarios atualizam diagnosticos de suporte da IA"
  ON public.feedback_ai_diagnostics FOR UPDATE TO authenticated
  USING (
    public.is_feedback_owner(organization_id)
  )
  WITH CHECK (
    public.is_feedback_owner(organization_id)
  );

GRANT SELECT, INSERT, UPDATE ON public.feedback_ai_diagnostics TO authenticated;

-- Adicionar feedback_ai_diagnostics na publicacao supabase_realtime
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class pc ON pr.prrelid = pc.oid
    JOIN pg_publication pp ON pr.prpubid = pp.oid
    WHERE pp.pubname = 'supabase_realtime'
      AND pc.relname = 'feedback_ai_diagnostics'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_ai_diagnostics;
  END IF;
END;
$$;
