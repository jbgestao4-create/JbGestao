CREATE OR REPLACE FUNCTION public.is_access_plan_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      COALESCE(
        lower(auth.jwt() ->> 'email') IN (
          'adm@adm.com', 'admin@adm.com', 'proprietario@jbsoftware.com.br',
          'owner@jbsoftware.com.br', 'bryan@administrador.com', 'bryanmendes968@gmail.com'
        ),
        false
      )
      OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_platform_owner' = 'true', false)
    );
$$;

CREATE OR REPLACE FUNCTION public.admin_list_access_plans()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF public.is_access_plan_manager() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Apenas o proprietário do sistema pode gerenciar planos.'
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.is_locked, p.name) FROM public.access_plans p),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_access_plan(
  p_id uuid,
  p_name text,
  p_description text,
  p_module_codes text[],
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  saved_plan public.access_plans;
BEGIN
  IF public.is_access_plan_manager() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Apenas o proprietário do sistema pode gerenciar planos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'O nome do plano deve ter entre 2 e 100 caracteres.'
      USING ERRCODE = '22023';
  END IF;
  IF p_description IS NOT NULL AND char_length(p_description) > 500 THEN
    RAISE EXCEPTION 'A descrição do plano não pode ultrapassar 500 caracteres.'
      USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.access_plans (name, description, module_codes, is_active)
    VALUES (btrim(p_name), COALESCE(p_description, ''), COALESCE(p_module_codes, '{}'), COALESCE(p_is_active, false))
    RETURNING * INTO saved_plan;
  ELSE
    UPDATE public.access_plans
    SET name = btrim(p_name),
        description = COALESCE(p_description, ''),
        module_codes = COALESCE(p_module_codes, '{}'),
        is_active = CASE WHEN is_locked THEN false ELSE COALESCE(p_is_active, false) END,
        updated_at = now()
    WHERE id = p_id AND NOT is_locked
    RETURNING * INTO saved_plan;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Plano não encontrado ou protegido contra alterações.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN to_jsonb(saved_plan);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_access_plan(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF public.is_access_plan_manager() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Apenas o proprietário do sistema pode gerenciar planos.'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.access_plans
  WHERE id = p_id AND NOT is_system AND NOT is_locked;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano não encontrado ou protegido contra exclusão.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.is_access_plan_manager() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_access_plan_manager() TO authenticated;
