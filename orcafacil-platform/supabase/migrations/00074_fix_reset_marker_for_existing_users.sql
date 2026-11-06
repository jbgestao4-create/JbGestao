-- Ensure password resets mark existing users, not only newly created auth users.
DO $migration$
DECLARE
  v_function_oid OID;
  v_definition TEXT;
  v_updated_definition TEXT;
  v_update_position INTEGER;
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

  IF position('must_change_password' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'The password reset function is missing the temporary-password marker.';
  END IF;

  IF position('raw_app_meta_data = COALESCE(raw_app_meta_data' IN v_definition) = 0 THEN
    IF (
      length(v_definition) -
      length(replace(v_definition, 'SET encrypted_password = encrypted_pw,', ''))
    ) / length('SET encrypted_password = encrypted_pw,') <> 1 THEN
      RAISE EXCEPTION 'Expected one existing-user password update in the reset function.';
    END IF;

    v_updated_definition := replace(
      v_definition,
      $old$SET encrypted_password = encrypted_pw,$old$,
      $new$SET encrypted_password = encrypted_pw,
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('must_change_password', true),$new$
    );

    v_update_position := position('SET encrypted_password = encrypted_pw,' IN v_updated_definition);
    IF v_update_position = 0 OR position(
      'raw_app_meta_data = COALESCE(raw_app_meta_data' IN substring(v_updated_definition FROM v_update_position)
    ) = 0 THEN
      RAISE EXCEPTION 'Could not add the temporary-password marker to the existing-user update.';
    END IF;

    EXECUTE v_updated_definition;
  END IF;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
