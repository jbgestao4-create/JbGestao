CREATE OR REPLACE FUNCTION public.is_feedback_owner(p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION public.is_feedback_owner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_feedback_owner(UUID) TO authenticated;

CREATE TABLE public.feedback_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  submitted_by_name TEXT NOT NULL DEFAULT '',
  organization_name TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('improvement', 'feature', 'problem', 'criticism', 'praise')),
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 160),
  description TEXT NOT NULL CHECK (char_length(trim(description)) BETWEEN 10 AND 10000),
  additional_info TEXT CHECK (additional_info IS NULL OR char_length(additional_info) <= 5000),
  module_origin TEXT NOT NULL CHECK (char_length(module_origin) BETWEEN 1 AND 120),
  origin_route TEXT NOT NULL CHECK (char_length(origin_route) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'in_review', 'approved', 'in_development', 'completed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_feedback_suggestions_organization_id UNIQUE (organization_id, id)
);

CREATE OR REPLACE FUNCTION public.is_feedback_submitter(
  p_organization_id UUID,
  p_suggestion_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.feedback_suggestions
    WHERE organization_id = p_organization_id
      AND id = p_suggestion_id
      AND submitted_by = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_feedback_submitter(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_feedback_submitter(UUID, UUID) TO authenticated;

CREATE INDEX idx_feedback_suggestions_org_created
  ON public.feedback_suggestions (organization_id, created_at DESC);
CREATE INDEX idx_feedback_suggestions_org_status
  ON public.feedback_suggestions (organization_id, status);
CREATE INDEX idx_feedback_suggestions_org_type
  ON public.feedback_suggestions (organization_id, type);
CREATE INDEX idx_feedback_suggestions_org_submitter
  ON public.feedback_suggestions (organization_id, submitted_by);
CREATE INDEX idx_feedback_suggestions_org_module
  ON public.feedback_suggestions (organization_id, module_origin);

CREATE TABLE public.feedback_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  suggestion_id UUID NOT NULL,
  uploaded_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL CHECK (char_length(original_name) BETWEEN 1 AND 255),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_feedback_attachment_suggestion
    FOREIGN KEY (organization_id, suggestion_id)
    REFERENCES public.feedback_suggestions(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_feedback_attachments_suggestion
  ON public.feedback_attachments (organization_id, suggestion_id);

CREATE TABLE public.feedback_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  suggestion_id UUID NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_status TEXT CHECK (previous_status IS NULL OR previous_status IN ('received', 'in_review', 'approved', 'in_development', 'completed', 'rejected')),
  new_status TEXT NOT NULL CHECK (new_status IN ('received', 'in_review', 'approved', 'in_development', 'completed', 'rejected')),
  observation TEXT CHECK (observation IS NULL OR char_length(observation) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_feedback_history_suggestion
    FOREIGN KEY (organization_id, suggestion_id)
    REFERENCES public.feedback_suggestions(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_feedback_history_suggestion
  ON public.feedback_history (organization_id, suggestion_id, created_at);

CREATE TABLE public.feedback_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  suggestion_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  content TEXT NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_feedback_note_suggestion
    FOREIGN KEY (organization_id, suggestion_id)
    REFERENCES public.feedback_suggestions(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_feedback_internal_notes_suggestion
  ON public.feedback_internal_notes (organization_id, suggestion_id, created_at);

CREATE OR REPLACE FUNCTION public.prepare_feedback_suggestion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_org_member(NEW.organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'Usuário não pertence à empresa informada' USING ERRCODE = '42501';
  END IF;

  NEW.submitted_by := auth.uid();
  NEW.submitted_by_name := COALESCE(
    (SELECT NULLIF(trim(display_name), '') FROM public.profiles WHERE id = auth.uid()),
    (SELECT NULLIF(trim(raw_user_meta_data->>'display_name'), '') FROM auth.users WHERE id = auth.uid()),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'Usuário'
  );
  NEW.organization_name := (
    SELECT name FROM public.organizations WHERE id = NEW.organization_id
  );
  NEW.status := 'received';
  NEW.created_at := NOW();
  NEW.updated_at := NEW.created_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prepare_feedback_suggestion
  BEFORE INSERT ON public.feedback_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.prepare_feedback_suggestion();

CREATE TRIGGER trg_feedback_suggestions_updated_at
  BEFORE UPDATE ON public.feedback_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.record_feedback_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.feedback_history (
      organization_id, suggestion_id, changed_by, previous_status, new_status
    ) VALUES (
      NEW.organization_id, NEW.id, auth.uid(), NULL, NEW.status
    );
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.feedback_history (
      organization_id, suggestion_id, changed_by, previous_status, new_status
    ) VALUES (
      NEW.organization_id, NEW.id, auth.uid(), OLD.status, NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_feedback_suggestion_history_insert
  AFTER INSERT ON public.feedback_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.record_feedback_status_change();

CREATE TRIGGER trg_feedback_suggestion_history_update
  AFTER UPDATE OF status ON public.feedback_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.record_feedback_status_change();

ALTER TABLE public.feedback_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem enviar feedback à própria empresa"
  ON public.feedback_suggestions FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND public.is_org_member(organization_id, auth.uid())
  );

CREATE POLICY "Somente proprietários consultam feedback da própria empresa"
  ON public.feedback_suggestions FOR SELECT TO authenticated
  USING (public.is_feedback_owner(organization_id));

CREATE POLICY "Somente proprietários alteram status do feedback da própria empresa"
  ON public.feedback_suggestions FOR UPDATE TO authenticated
  USING (public.is_feedback_owner(organization_id))
  WITH CHECK (public.is_feedback_owner(organization_id));

CREATE POLICY "Somente proprietários consultam anexos da própria empresa"
  ON public.feedback_attachments FOR SELECT TO authenticated
  USING (public.is_feedback_owner(organization_id));

CREATE POLICY "Autor anexa arquivo somente à própria sugestão"
  ON public.feedback_attachments FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.is_feedback_submitter(organization_id, suggestion_id)
  );

CREATE POLICY "Somente proprietários consultam histórico da própria empresa"
  ON public.feedback_history FOR SELECT TO authenticated
  USING (public.is_feedback_owner(organization_id));

CREATE POLICY "Somente proprietários consultam observações internas"
  ON public.feedback_internal_notes FOR SELECT TO authenticated
  USING (public.is_feedback_owner(organization_id));

CREATE POLICY "Somente proprietários registram observações internas"
  ON public.feedback_internal_notes FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.is_feedback_owner(organization_id)
  );

REVOKE ALL ON public.feedback_suggestions FROM anon, authenticated;
GRANT SELECT, INSERT ON public.feedback_suggestions TO authenticated;
GRANT UPDATE (status) ON public.feedback_suggestions TO authenticated;
REVOKE ALL ON public.feedback_attachments FROM anon, authenticated;
GRANT SELECT, INSERT ON public.feedback_attachments TO authenticated;
REVOKE ALL ON public.feedback_history FROM anon, authenticated;
GRANT SELECT ON public.feedback_history TO authenticated;
REVOKE ALL ON public.feedback_internal_notes FROM anon, authenticated;
GRANT SELECT, INSERT ON public.feedback_internal_notes TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('feedback-attachments', 'feedback-attachments', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

CREATE POLICY "Autores enviam anexos das próprias sugestões"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-attachments'
    AND cardinality(storage.foldername(name)) = 2
    AND public.is_feedback_submitter(
      (storage.foldername(name))[1]::UUID,
      (storage.foldername(name))[2]::UUID
    )
  );

CREATE POLICY "Proprietários visualizam anexos da própria empresa"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-attachments'
    AND cardinality(storage.foldername(name)) = 2
    AND public.is_feedback_owner((storage.foldername(name))[1]::UUID)
  );
