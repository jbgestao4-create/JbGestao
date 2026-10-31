ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS creator_name TEXT;

UPDATE public.quotes AS quote
   SET creator_name = COALESCE(
     NULLIF(BTRIM(profile.display_name), ''),
     NULLIF(BTRIM(auth_user.email), ''),
     'Usuário não identificado'
   )
  FROM auth.users AS auth_user
  LEFT JOIN public.profiles AS profile
    ON profile.id = auth_user.id
 WHERE quote.created_by = auth_user.id
   AND quote.creator_name IS NULL;

CREATE OR REPLACE FUNCTION public.set_quote_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();

    SELECT COALESCE(
      NULLIF(BTRIM(profile.display_name), ''),
      NULLIF(BTRIM(auth_user.email), '')
    )
      INTO NEW.creator_name
      FROM auth.users AS auth_user
      LEFT JOIN public.profiles AS profile
        ON profile.id = auth_user.id
     WHERE auth_user.id = auth.uid();

    NEW.creator_name := COALESCE(NEW.creator_name, 'Usuário não identificado');
  ELSIF NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.creator_name IS DISTINCT FROM OLD.creator_name THEN
    RAISE EXCEPTION 'O responsável pela criação do orçamento não pode ser alterado.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
