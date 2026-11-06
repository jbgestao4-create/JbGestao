CREATE OR REPLACE FUNCTION public.reset_organization_member_password(
  p_org_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'É necessário estar autenticado.';
  END IF;

  IF public.get_user_organization_role(p_org_id, auth.uid())
    IS DISTINCT FROM 'admin'::public.organization_role THEN
    RAISE EXCEPTION 'Apenas administradores desta organização podem redefinir senhas.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é possível redefinir a própria senha por esta função.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = p_user_id
      AND role <> 'owner'::public.organization_role
  ) THEN
    RAISE EXCEPTION 'O usuário selecionado não pertence a esta organização.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt('12345678', gen_salt('bf', 10)),
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('must_change_password', true),
      updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta de autenticação do usuário não encontrada.';
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reset_organization_member_password(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_organization_member_password(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
