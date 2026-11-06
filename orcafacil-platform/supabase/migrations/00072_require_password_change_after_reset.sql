-- Mark reset credentials as temporary and provide a user-scoped password-change RPC.
DO $migration$
DECLARE
  v_function_oid OID;
  v_definition TEXT;
  v_updated_definition TEXT;
BEGIN
  SELECT p.oid
  INTO v_function_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'admin_reset_company_user_password'
    AND p.pronargs = 4;

  IF v_function_oid IS NULL THEN
    RAISE EXCEPTION 'admin_reset_company_user_password(UUID, TEXT, TEXT, TEXT) was not found.';
  END IF;

  v_definition := pg_get_functiondef(v_function_oid);
  v_updated_definition := replace(
    v_definition,
    $old$'{"provider":"email","providers":["email"]}',$old$,
    $new$jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email'),
        'must_change_password', true
      ),$new$
  );
  v_updated_definition := replace(
    v_updated_definition,
    $old$SET encrypted_password = encrypted_pw,
      email_confirmed_at$old$,
    $new$SET encrypted_password = encrypted_pw,
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('must_change_password', true),
      email_confirmed_at$new$
  );

  IF position('must_change_password' IN v_definition) = 0 THEN
    IF v_updated_definition = v_definition THEN
      RAISE EXCEPTION 'Could not update the company password reset function.';
    END IF;
    EXECUTE v_updated_definition;
  END IF;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.complete_forced_password_change(p_new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'É necessário estar autenticado para alterar a senha.';
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RAISE EXCEPTION 'A nova senha deve ter pelo menos 8 caracteres.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) - 'must_change_password',
      updated_at = NOW()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário autenticado não encontrado.';
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_forced_password_change(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_forced_password_change(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
