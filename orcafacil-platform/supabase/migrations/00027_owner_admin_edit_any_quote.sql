CREATE OR REPLACE FUNCTION public.update_quote_with_items(
  p_organization_id UUID,
  p_quote_id UUID,
  p_customer_id UUID,
  p_valid_until DATE,
  p_notes TEXT,
  p_discount TEXT,
  p_subtotal TEXT,
  p_total TEXT,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  caller_role public.organization_role;
BEGIN
  caller_role := public.get_user_organization_role(p_organization_id, auth.uid());
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Somente proprietários e administradores podem editar orçamentos.'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'A lista de itens do orçamento é inválida.'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'O orçamento precisa ter pelo menos um item.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.quotes
     SET customer_id = p_customer_id,
         valid_until = p_valid_until,
         notes = p_notes,
         discount = p_discount::NUMERIC,
         subtotal = p_subtotal::NUMERIC,
         total = p_total::NUMERIC
   WHERE organization_id = p_organization_id
     AND id = p_quote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.'
      USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.quote_items
   WHERE organization_id = p_organization_id
     AND quote_id = p_quote_id;

  INSERT INTO public.quote_items (
    organization_id,
    quote_id,
    description,
    quantity,
    unit_price,
    total,
    sort_order
  )
  SELECT
    p_organization_id,
    p_quote_id,
    item.value->>'description',
    (item.value->>'quantity')::NUMERIC,
    (item.value->>'unit_price')::NUMERIC,
    (item.value->>'total')::NUMERIC,
    (item.ordinality - 1)::INTEGER
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS item(value, ordinality);
END;
$$;

REVOKE ALL ON FUNCTION public.update_quote_with_items(
  UUID, UUID, UUID, DATE, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_quote_with_items(
  UUID, UUID, UUID, DATE, TEXT, TEXT, TEXT, TEXT, JSONB
) TO authenticated;
