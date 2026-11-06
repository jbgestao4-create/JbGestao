-- Remove the legacy six-argument overload so PostgREST can resolve the
-- current registration function, whose additional arguments have defaults.
DROP FUNCTION IF EXISTS public.admin_register_company_with_admin(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT[]
);

REVOKE ALL ON FUNCTION public.admin_register_company_with_admin(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT[],
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_register_company_with_admin(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT[],
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
