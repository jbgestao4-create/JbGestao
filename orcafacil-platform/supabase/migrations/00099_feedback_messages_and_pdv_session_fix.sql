-- Migration 00099: Mensagens e respostas em sugestoes (feedback_messages) e correcao de sessao Caixa Geral vs PDV

-- 1. Normalizar registros anteriores com 'default-caixa-01' para 'Caixa 01'
UPDATE public.cash_sessions
SET register_id = 'Caixa 01'
WHERE register_id = 'default-caixa-01';

-- 2. Garantir que qualquer sessao de Caixa Geral tenha session_type = 'cash_management'
UPDATE public.cash_sessions
SET session_type = 'cash_management'
WHERE register_id IN ('Caixa Geral', 'Caixa Diário', 'Gestão de Caixa');

-- 3. Criar tabela de mensagens e respostas entre proprietario e usuario nas sugestoes
CREATE TABLE IF NOT EXISTS public.feedback_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  suggestion_id UUID NOT NULL,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'user' CHECK (sender_role IN ('owner', 'user')),
  message TEXT NOT NULL CHECK (char_length(trim(message)) >= 1),
  read_by_user BOOLEAN NOT NULL DEFAULT false,
  read_by_owner BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_feedback_message_suggestion
    FOREIGN KEY (organization_id, suggestion_id)
    REFERENCES public.feedback_suggestions(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_suggestion
  ON public.feedback_messages (organization_id, suggestion_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_unread_user
  ON public.feedback_messages (organization_id, read_by_user)
  WHERE sender_role = 'owner';

CREATE INDEX IF NOT EXISTS idx_feedback_messages_unread_owner
  ON public.feedback_messages (organization_id, read_by_owner)
  WHERE sender_role = 'user';

ALTER TABLE public.feedback_messages ENABLE ROW LEVEL SECURITY;

-- Politica de SELECT: O proprietario ou o autor da sugestao podem ler as mensagens
DROP POLICY IF EXISTS "Proprietarios e autores leem mensagens da sugestao" ON public.feedback_messages;
CREATE POLICY "Proprietarios e autores leem mensagens da sugestao"
  ON public.feedback_messages FOR SELECT TO authenticated
  USING (
    public.is_feedback_owner(organization_id)
    OR public.is_feedback_submitter(organization_id, suggestion_id)
  );

-- Politica de INSERT: O proprietario ou o autor da sugestao podem enviar mensagens
DROP POLICY IF EXISTS "Proprietarios e autores enviam mensagens na sugestao" ON public.feedback_messages;
CREATE POLICY "Proprietarios e autores enviam mensagens na sugestao"
  ON public.feedback_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.is_feedback_owner(organization_id)
      OR public.is_feedback_submitter(organization_id, suggestion_id)
    )
  );

-- Politica de UPDATE: Para marcar mensagens como lidas
DROP POLICY IF EXISTS "Proprietarios e autores atualizam status de leitura" ON public.feedback_messages;
CREATE POLICY "Proprietarios e autores atualizam status de leitura"
  ON public.feedback_messages FOR UPDATE TO authenticated
  USING (
    public.is_feedback_owner(organization_id)
    OR public.is_feedback_submitter(organization_id, suggestion_id)
  )
  WITH CHECK (
    public.is_feedback_owner(organization_id)
    OR public.is_feedback_submitter(organization_id, suggestion_id)
  );

GRANT SELECT, INSERT, UPDATE ON public.feedback_messages TO authenticated;

-- Funcao para consultar quantidade de respostas nao lidas pelo usuario
CREATE OR REPLACE FUNCTION public.get_unread_user_feedback_count(
  p_organization_id UUID
)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  RETURN (
    SELECT COUNT(m.id)
    FROM public.feedback_messages m
    JOIN public.feedback_suggestions s
      ON s.organization_id = m.organization_id AND s.id = m.suggestion_id
    WHERE m.organization_id = p_organization_id
      AND s.submitted_by = auth.uid()
      AND m.sender_role = 'owner'
      AND m.read_by_user = false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_user_feedback_count(UUID) TO authenticated;

-- Funcao para marcar mensagens como lidas pelo usuario
CREATE OR REPLACE FUNCTION public.mark_feedback_messages_read_by_user(
  p_organization_id UUID,
  p_suggestion_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.feedback_messages m
  SET read_by_user = true
  WHERE m.organization_id = p_organization_id
    AND m.suggestion_id = p_suggestion_id
    AND m.sender_role = 'owner'
    AND m.read_by_user = false
    AND EXISTS (
      SELECT 1 FROM public.feedback_suggestions s
      WHERE s.organization_id = p_organization_id
        AND s.id = p_suggestion_id
        AND s.submitted_by = auth.uid()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_feedback_messages_read_by_user(UUID, UUID) TO authenticated;

-- Adicionar feedback_messages na publicacao supabase_realtime
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
      AND pc.relname = 'feedback_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_messages;
  END IF;
END $$;
