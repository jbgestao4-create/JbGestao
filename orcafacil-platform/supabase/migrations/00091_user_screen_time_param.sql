-- Migration 00091: Permite passar p_user_id opcionalmente em record_user_screen_time
CREATE OR REPLACE FUNCTION public.record_user_screen_time(
  p_seconds INT DEFAULT 0,
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := COALESCE(p_user_id, auth.uid());
  v_secs BIGINT := GREATEST(0, COALESCE(p_seconds, 0));
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.profiles (id, display_name, screen_time_seconds, last_access_at)
  VALUES (v_uid, 'Usuário', v_secs, NOW())
  ON CONFLICT (id) DO UPDATE
  SET
    screen_time_seconds = COALESCE(public.profiles.screen_time_seconds, 0) + v_secs,
    last_access_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_user_screen_time(INT, UUID) TO authenticated, anon;
