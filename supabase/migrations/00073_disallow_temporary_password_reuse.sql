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

  IF COALESCE(
    (SELECT u.raw_app_meta_data->>'must_change_password' FROM auth.users u WHERE u.id = auth.uid()),
    'false'
  ) <> 'true' THEN
    RAISE EXCEPTION 'Não há uma redefinição obrigatória de senha pendente.';
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RAISE EXCEPTION 'A nova senha deve ter pelo menos 8 caracteres.';
  END IF;

  IF p_new_password = '12345678' THEN
    RAISE EXCEPTION 'A nova senha não pode ser igual à senha temporária.';
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
