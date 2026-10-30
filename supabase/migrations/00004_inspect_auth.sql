CREATE OR REPLACE FUNCTION public.get_auth_schema_info()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_users JSONB;
  v_identities JSONB;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'column_name', column_name,
    'data_type', data_type,
    'is_nullable', is_nullable,
    'column_default', column_default
  )) INTO v_users
  FROM information_schema.columns
  WHERE table_schema = 'auth' AND table_name = 'users';

  SELECT jsonb_agg(jsonb_build_object(
    'column_name', column_name,
    'data_type', data_type,
    'is_nullable', is_nullable,
    'column_default', column_default
  )) INTO v_identities
  FROM information_schema.columns
  WHERE table_schema = 'auth' AND table_name = 'identities';

  RETURN jsonb_build_object(
    'users', v_users,
    'identities', v_identities
  );
END;
$$;

