CREATE TABLE IF NOT EXISTS public.inventory_item_code_counters (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  last_code NUMERIC(20, 0) NOT NULL DEFAULT 0 CHECK (last_code >= 0)
);

INSERT INTO public.inventory_item_code_counters (organization_id, last_code)
SELECT organization_id, MAX(sku::NUMERIC)
FROM public.inventory_items
WHERE sku ~ '^[0-9]+$'
GROUP BY organization_id
ON CONFLICT (organization_id) DO UPDATE
SET last_code = GREATEST(
  public.inventory_item_code_counters.last_code,
  EXCLUDED.last_code
);

ALTER TABLE public.inventory_item_code_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.inventory_item_code_counters FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assign_inventory_item_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  next_code NUMERIC(20, 0);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.sku := OLD.sku;
    RETURN NEW;
  END IF;

  INSERT INTO public.inventory_item_code_counters (organization_id, last_code)
  VALUES (NEW.organization_id, 0)
  ON CONFLICT (organization_id) DO NOTHING;

  UPDATE public.inventory_item_code_counters
     SET last_code = last_code + 1
   WHERE organization_id = NEW.organization_id
   RETURNING last_code INTO next_code;

  NEW.sku := next_code::TEXT;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_inventory_item_code() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS assign_inventory_item_code ON public.inventory_items;
CREATE TRIGGER assign_inventory_item_code
  BEFORE INSERT OR UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_inventory_item_code();
