-- Migration 00064: Inspeção segura de dados

CREATE OR REPLACE FUNCTION public.admin_debug_inspect_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_customers JSONB;
  v_suppliers JSONB;
  v_products JSONB;
  v_quotes JSONB;
  v_orgs JSONB;
  v_members JSONB;
  v_users JSONB;
BEGIN
  SELECT jsonb_agg(c) INTO v_customers FROM (SELECT id, organization_id, name, created_at FROM public.customers LIMIT 20) c;
  SELECT jsonb_agg(s) INTO v_suppliers FROM (SELECT id, organization_id, name, created_at FROM public.suppliers LIMIT 20) s;
  SELECT jsonb_agg(p) INTO v_products FROM (SELECT id, organization_id, name, created_at FROM public.inventory_items LIMIT 20) p;
  SELECT jsonb_agg(q) INTO v_quotes FROM (SELECT id, organization_id, quote_number, created_at FROM public.quotes LIMIT 20) q;
  SELECT jsonb_agg(o) INTO v_orgs FROM (SELECT id, name, slug, admin_email, created_at FROM public.organizations) o;
  SELECT jsonb_agg(m) INTO v_members FROM (SELECT organization_id, user_id, role FROM public.organization_members) m;
  SELECT jsonb_agg(u) INTO v_users FROM (SELECT id, email, created_at FROM auth.users) u;

  RETURN jsonb_build_object(
    'customers', COALESCE(v_customers, '[]'::jsonb),
    'suppliers', COALESCE(v_suppliers, '[]'::jsonb),
    'products', COALESCE(v_products, '[]'::jsonb),
    'quotes', COALESCE(v_quotes, '[]'::jsonb),
    'organizations', COALESCE(v_orgs, '[]'::jsonb),
    'members', COALESCE(v_members, '[]'::jsonb),
    'users', COALESCE(v_users, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_debug_inspect_data() TO authenticated, anon, service_role;

