ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS address_number TEXT;
