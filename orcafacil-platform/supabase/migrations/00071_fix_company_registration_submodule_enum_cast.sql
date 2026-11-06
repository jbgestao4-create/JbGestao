-- Company-level module codes include subfeatures such as MOD-01_QUICK_SALE.
-- organization_dashboard_modules.module_code is TEXT, so do not cast these
-- values to dashboard_module_code (which only contains top-level modules).
DO $migration$
DECLARE
  v_function_oid OID;
  v_function_definition TEXT;
  v_fixed_function_definition TEXT;
BEGIN
  SELECT p.oid
  INTO v_function_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'admin_register_company_with_admin'
    AND p.pronargs = 22;

  IF v_function_oid IS NULL THEN
    RAISE EXCEPTION 'Expected admin_register_company_with_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], INTEGER, 15 TEXT) was not found.';
  END IF;

  v_function_definition := pg_get_functiondef(v_function_oid);

  IF position('mod_code::dashboard_module_code' IN v_function_definition) > 0 THEN
    v_fixed_function_definition := replace(
      v_function_definition,
      'mod_code::dashboard_module_code',
      'mod_code'
    );
    EXECUTE v_fixed_function_definition;
  ELSIF position('VALUES (new_org_id, mod_code)' IN v_function_definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected admin_register_company_with_admin implementation; refusing to apply an incomplete fix.';
  END IF;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
