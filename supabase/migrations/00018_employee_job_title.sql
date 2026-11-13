ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS job_title TEXT;

CREATE OR REPLACE FUNCTION public.add_organization_member(
  p_org_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_password TEXT,
  p_role organization_role,
  p_modules module_code[],
  p_job_title TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  result JSONB;
  target_user_id UUID;
  clean_job_title TEXT;
BEGIN
  result := public.add_organization_member(
    p_org_id,
    p_email,
    p_name,
    p_password,
    p_role,
    p_modules
  );
  target_user_id := (result->>'userId')::UUID;
  clean_job_title := NULLIF(trim(p_job_title), '');

  UPDATE public.organization_members
  SET job_title = clean_job_title
  WHERE organization_id = p_org_id AND user_id = target_user_id;

  RETURN result || jsonb_build_object('jobTitle', clean_job_title);
END;
$$;
