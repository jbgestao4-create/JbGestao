CREATE TABLE public.feedback_suggestion_reads (
  organization_id UUID NOT NULL,
  suggestion_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, suggestion_id, owner_id),
  CONSTRAINT fk_feedback_suggestion_read
    FOREIGN KEY (organization_id, suggestion_id)
    REFERENCES public.feedback_suggestions(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_feedback_suggestion_reads_owner
  ON public.feedback_suggestion_reads (organization_id, owner_id);

ALTER TABLE public.feedback_suggestion_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proprietários consultam suas próprias visualizações"
  ON public.feedback_suggestion_reads FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    AND public.is_feedback_owner(organization_id)
  );

CREATE POLICY "Proprietários registram suas próprias visualizações"
  ON public.feedback_suggestion_reads FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.is_feedback_owner(organization_id)
  );

REVOKE ALL ON public.feedback_suggestion_reads FROM anon, authenticated;
GRANT SELECT, INSERT ON public.feedback_suggestion_reads TO authenticated;

CREATE OR REPLACE FUNCTION public.get_unread_feedback_suggestion_count(
  p_organization_id UUID
)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_feedback_owner(p_organization_id) THEN
    RAISE EXCEPTION 'Apenas o proprietário pode consultar sugestões não visualizadas'
      USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COUNT(*)
    FROM public.feedback_suggestions suggestion
    WHERE suggestion.organization_id = p_organization_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.feedback_suggestion_reads read_record
        WHERE read_record.organization_id = suggestion.organization_id
          AND read_record.suggestion_id = suggestion.id
          AND read_record.owner_id = auth.uid()
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_unread_feedback_suggestion_count(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_feedback_suggestion_count(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_feedback_suggestion_read(
  p_organization_id UUID,
  p_suggestion_id UUID
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_feedback_owner(p_organization_id) THEN
    RAISE EXCEPTION 'Apenas o proprietário pode marcar sugestões como visualizadas'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.feedback_suggestions
    WHERE organization_id = p_organization_id
      AND id = p_suggestion_id
  ) THEN
    RAISE EXCEPTION 'Sugestão não encontrada nesta empresa'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.feedback_suggestion_reads (
    organization_id, suggestion_id, owner_id
  ) VALUES (
    p_organization_id, p_suggestion_id, auth.uid()
  )
  ON CONFLICT (organization_id, suggestion_id, owner_id) DO NOTHING;

  RETURN public.get_unread_feedback_suggestion_count(p_organization_id);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_feedback_suggestion_read(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_feedback_suggestion_read(UUID, UUID) TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'feedback_suggestions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_suggestions;
  END IF;
END;
$$;
