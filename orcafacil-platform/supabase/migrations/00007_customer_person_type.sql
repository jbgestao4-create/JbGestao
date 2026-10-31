ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS person_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (person_type IN ('individual', 'company')),
  ADD COLUMN IF NOT EXISTS document TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;
