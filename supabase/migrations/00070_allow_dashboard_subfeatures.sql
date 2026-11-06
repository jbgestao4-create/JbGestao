-- Organization-level dashboard configuration includes both module codes and
-- granular subfeature codes. Keep this column as text instead of the narrower
-- enum used for individual member permissions.
ALTER TABLE public.organization_dashboard_modules
  ALTER COLUMN module_code TYPE TEXT
  USING module_code::TEXT;
