ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS created_by UUID
  REFERENCES auth.users(id) ON DELETE SET NULL
  DEFAULT auth.uid();

CREATE OR REPLACE FUNCTION public.set_quote_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSIF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'O responsável pela criação do orçamento não pode ser alterado.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_quote_creator ON public.quotes;
CREATE TRIGGER trg_set_quote_creator
  BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_quote_creator();
