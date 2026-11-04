-- 00042_link_quotes_and_sales.sql
-- Vincula orçamentos e vendas bidirecionalmente e armazena o vendedor

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS origin_quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_name TEXT;

CREATE INDEX IF NOT EXISTS quotes_origin_quote_idx
  ON public.quotes (origin_quote_id)
  WHERE origin_quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS quotes_sale_id_idx
  ON public.quotes (sale_id)
  WHERE sale_id IS NOT NULL;

