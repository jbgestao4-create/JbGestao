CREATE OR REPLACE FUNCTION public.enforce_quote_item_minimum_sale_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  minimum_sale_price NUMERIC(12, 4);
  product_name TEXT;
BEGIN
  IF NEW.inventory_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT item.minimum_sale_price, item.name
    INTO minimum_sale_price, product_name
    FROM public.inventory_items item
   WHERE item.organization_id = NEW.organization_id
     AND item.id = NEW.inventory_item_id;

  IF minimum_sale_price IS NOT NULL AND NEW.unit_price < minimum_sale_price THEN
    RAISE EXCEPTION 'QUOTE_ITEM_BELOW_MINIMUM_SALE_PRICE: %', product_name
      USING ERRCODE = '23514',
            MESSAGE = 'QUOTE_ITEM_BELOW_MINIMUM_SALE_PRICE';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_quote_item_minimum_sale_price ON public.quote_items;
CREATE TRIGGER enforce_quote_item_minimum_sale_price
  BEFORE INSERT OR UPDATE OF organization_id, inventory_item_id, unit_price
  ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quote_item_minimum_sale_price();

CREATE OR REPLACE FUNCTION public.enforce_quote_minimum_sale_price_before_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  invalid_product_name TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     OR NEW.status NOT IN ('sent', 'approved') THEN
    RETURN NEW;
  END IF;

  SELECT item.name
    INTO invalid_product_name
    FROM public.quote_items quote_item
    JOIN public.inventory_items item
      ON item.organization_id = quote_item.organization_id
     AND item.id = quote_item.inventory_item_id
   WHERE quote_item.organization_id = NEW.organization_id
     AND quote_item.quote_id = NEW.id
     AND item.minimum_sale_price IS NOT NULL
     AND quote_item.unit_price < item.minimum_sale_price
   LIMIT 1;

  IF invalid_product_name IS NOT NULL THEN
    RAISE EXCEPTION 'QUOTE_ITEM_BELOW_MINIMUM_SALE_PRICE: %', invalid_product_name
      USING ERRCODE = '23514',
            MESSAGE = 'QUOTE_ITEM_BELOW_MINIMUM_SALE_PRICE';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_quote_minimum_sale_price_before_status_change
  ON public.quotes;
CREATE TRIGGER enforce_quote_minimum_sale_price_before_status_change
  BEFORE UPDATE OF status ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quote_minimum_sale_price_before_status_change();
