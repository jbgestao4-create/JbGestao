-- GoTrue expects Auth token columns to contain empty strings rather than NULL.
UPDATE auth.users u
SET
  confirmation_token = COALESCE(u.confirmation_token, ''),
  recovery_token = COALESCE(u.recovery_token, ''),
  email_change_token_new = COALESCE(u.email_change_token_new, ''),
  email_change = COALESCE(u.email_change, ''),
  phone_change_token = COALESCE(u.phone_change_token, ''),
  phone_change = COALESCE(u.phone_change, ''),
  reauthentication_token = COALESCE(u.reauthentication_token, ''),
  email_change_token_current = COALESCE(u.email_change_token_current, '')
WHERE EXISTS (
  SELECT 1
  FROM public.organization_members om
  WHERE om.user_id = u.id
)
AND (
  u.confirmation_token IS NULL
  OR u.recovery_token IS NULL
  OR u.email_change_token_new IS NULL
  OR u.email_change IS NULL
  OR u.phone_change_token IS NULL
  OR u.phone_change IS NULL
  OR u.reauthentication_token IS NULL
  OR u.email_change_token_current IS NULL
);

CREATE OR REPLACE FUNCTION public.normalize_empty_user_tokens()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_temp
AS $$
BEGIN
  NEW.confirmation_token := COALESCE(NEW.confirmation_token, '');
  NEW.recovery_token := COALESCE(NEW.recovery_token, '');
  NEW.email_change_token_new := COALESCE(NEW.email_change_token_new, '');
  NEW.email_change := COALESCE(NEW.email_change, '');
  NEW.phone_change_token := COALESCE(NEW.phone_change_token, '');
  NEW.phone_change := COALESCE(NEW.phone_change, '');
  NEW.reauthentication_token := COALESCE(NEW.reauthentication_token, '');
  NEW.email_change_token_current := COALESCE(NEW.email_change_token_current, '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_empty_user_tokens ON auth.users;
CREATE TRIGGER normalize_empty_user_tokens
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_empty_user_tokens();
