-- Creates an isolated organization for system-owner testing.
-- The owner can still access client organizations globally, but is a member of this
-- dedicated organization only, so test data is kept separate from client data.

INSERT INTO public.organizations (name, slug, is_active)
VALUES ('Ambiente de Testes do Proprietário', 'ambiente-testes-proprietario', true)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.organizations
SET admin_email = NULL,
    admin_name = NULL
WHERE slug <> 'ambiente-testes-proprietario'
  AND lower(trim(COALESCE(admin_email, ''))) IN (
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br',
    'bryan@administrador.com',
    'bryanmendes968@gmail.com'
  );

CREATE OR REPLACE FUNCTION public.check_developer_not_organization_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_email TEXT;
  v_test_org_id UUID;
BEGIN
  SELECT lower(email) INTO v_email
  FROM auth.users
  WHERE id = NEW.user_id
  LIMIT 1;

  IF v_email IS NULL OR v_email NOT IN (
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br',
    'bryan@administrador.com',
    'bryanmendes968@gmail.com'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_test_org_id
  FROM public.organizations
  WHERE slug = 'ambiente-testes-proprietario'
  LIMIT 1;

  IF NEW.organization_id IS DISTINCT FROM v_test_org_id THEN
    RETURN NULL;
  END IF;

  NEW.role := 'owner';
  RETURN NEW;
END;
$$;

-- Keep the developer accounts out of all client organizations, including any
-- membership that may have been created before the dedicated test organization.
DELETE FROM public.organization_member_dashboard_modules
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE lower(email) IN (
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br',
    'bryan@administrador.com',
    'bryanmendes968@gmail.com'
  )
);

DELETE FROM public.organization_member_modules
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE lower(email) IN (
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br',
    'bryan@administrador.com',
    'bryanmendes968@gmail.com'
  )
);

DELETE FROM public.organization_members
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE lower(email) IN (
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br',
    'bryan@administrador.com',
    'bryanmendes968@gmail.com'
  )
);

INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT o.id, u.id, 'owner'::public.organization_role
FROM public.organizations o
CROSS JOIN auth.users u
WHERE o.slug = 'ambiente-testes-proprietario'
  AND lower(u.email) IN (
    'adm@adm.com',
    'admin@adm.com',
    'proprietario@jbsoftware.com.br',
    'owner@jbsoftware.com.br',
    'bryan@administrador.com',
    'bryanmendes968@gmail.com'
  )
ON CONFLICT (organization_id, user_id) DO UPDATE
SET role = 'owner';

INSERT INTO public.organization_modules (organization_id, module_id, status)
SELECT o.id, m.id, 'active'
FROM public.organizations o
CROSS JOIN public.modules m
WHERE o.slug = 'ambiente-testes-proprietario'
  AND m.code = 'orcafacil'
ON CONFLICT (organization_id, module_id) DO UPDATE
SET status = 'active';

INSERT INTO public.organization_dashboard_modules (organization_id, module_code)
SELECT o.id, module_code
FROM public.organizations o
CROSS JOIN unnest(ARRAY[
  'MOD-01', 'MOD-02', 'MOD-03', 'MOD-04', 'MOD-05',
  'MOD-06', 'MOD-07', 'MOD-08', 'MOD-09', 'MOD-10'
]) AS modules(module_code)
WHERE o.slug = 'ambiente-testes-proprietario'
ON CONFLICT (organization_id, module_code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.prevent_owner_test_organization_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.slug = 'ambiente-testes-proprietario' THEN
    RAISE EXCEPTION 'A organização de testes do Proprietário não pode ser excluída.';
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.slug = 'ambiente-testes-proprietario'
    AND NEW.slug <> OLD.slug THEN
    RAISE EXCEPTION 'O identificador da organização de testes do Proprietário não pode ser alterado.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_owner_test_organization_deletion ON public.organizations;
CREATE TRIGGER trg_prevent_owner_test_organization_deletion
  BEFORE DELETE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_owner_test_organization_deletion();

DROP TRIGGER IF EXISTS trg_prevent_owner_test_organization_slug_change ON public.organizations;
CREATE TRIGGER trg_prevent_owner_test_organization_slug_change
  BEFORE UPDATE OF slug ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_owner_test_organization_deletion();
