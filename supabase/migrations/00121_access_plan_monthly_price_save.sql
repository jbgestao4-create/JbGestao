-- 00121_access_plan_monthly_price_save.sql
-- Permite salvar o valor mensal do plano (monthly_price) pelo gerenciamento de planos.
-- O valor é refletido automaticamente na tela de apresentação via public_list_access_plans.

DROP FUNCTION IF EXISTS public.admin_save_access_plan(uuid, text, text, text[], boolean);

CREATE OR REPLACE FUNCTION public.admin_save_access_plan(
  p_id uuid,
  p_name text,
  p_description text,
  p_module_codes text[],
  p_is_active boolean,
  p_monthly_price numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  saved_plan public.access_plans;
BEGIN
  IF public.is_access_plan_manager() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Apenas o proprietário do sistema pode gerenciar planos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'O nome do plano deve ter entre 2 e 100 caracteres.'
      USING ERRCODE = '22023';
  END IF;
  IF p_description IS NOT NULL AND char_length(p_description) > 500 THEN
    RAISE EXCEPTION 'A descrição do plano não pode ultrapassar 500 caracteres.'
      USING ERRCODE = '22023';
  END IF;
  IF p_monthly_price IS NOT NULL AND (p_monthly_price < 0 OR p_monthly_price > 99999999) THEN
    RAISE EXCEPTION 'Valor mensal do plano inválido.'
      USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.access_plans (name, description, module_codes, is_active, monthly_price)
    VALUES (
      btrim(p_name),
      COALESCE(p_description, ''),
      COALESCE(p_module_codes, '{}'),
      COALESCE(p_is_active, false),
      COALESCE(p_monthly_price, 149.90)
    )
    RETURNING * INTO saved_plan;
  ELSE
    UPDATE public.access_plans
    SET name = btrim(p_name),
        description = COALESCE(p_description, ''),
        module_codes = COALESCE(p_module_codes, '{}'),
        is_active = CASE WHEN is_locked THEN false ELSE COALESCE(p_is_active, false) END,
        monthly_price = COALESCE(p_monthly_price, monthly_price),
        updated_at = now()
    WHERE id = p_id AND NOT is_locked
    RETURNING * INTO saved_plan;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Plano não encontrado ou protegido contra alterações.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN to_jsonb(saved_plan);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_access_plan(uuid, text, text, text[], boolean, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_access_plan(uuid, text, text, text[], boolean, numeric) TO authenticated;
