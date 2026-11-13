DO $$
BEGIN
  CREATE TYPE public.dashboard_module_code AS ENUM (
    'MOD-01',
    'MOD-02',
    'MOD-03',
    'MOD-04',
    'MOD-05',
    'MOD-06'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.organization_member_dashboard_modules (
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  module_code public.dashboard_module_code NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id, module_code),
  FOREIGN KEY (organization_id, user_id)
    REFERENCES public.organization_members(organization_id, user_id) ON DELETE CASCADE
);

ALTER TABLE public.organization_member_dashboard_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros podem ver permissões dos cartões da página inicial"
  ON public.organization_member_dashboard_modules;
CREATE POLICY "Membros podem ver permissões dos cartões da página inicial"
  ON public.organization_member_dashboard_modules FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Admins e proprietários podem gerenciar permissões dos cartões"
  ON public.organization_member_dashboard_modules;
CREATE POLICY "Admins e proprietários podem gerenciar permissões dos cartões"
  ON public.organization_member_dashboard_modules FOR ALL
  USING (
    public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
  )
  WITH CHECK (
    public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
  );

CREATE OR REPLACE FUNCTION public.grant_default_dashboard_modules_to_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'member' THEN
    INSERT INTO public.organization_member_dashboard_modules (
      organization_id,
      user_id,
      module_code
    )
    SELECT NEW.organization_id, NEW.user_id, dashboard_modules.code
    FROM unnest(enum_range(NULL::public.dashboard_module_code)) AS dashboard_modules(code)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grant_default_dashboard_modules
  ON public.organization_members;
CREATE TRIGGER grant_default_dashboard_modules
  AFTER INSERT ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_default_dashboard_modules_to_member();

INSERT INTO public.organization_member_dashboard_modules (
  organization_id,
  user_id,
  module_code
)
SELECT om.organization_id, om.user_id, dashboard_modules.code
FROM public.organization_members om
CROSS JOIN unnest(enum_range(NULL::public.dashboard_module_code)) AS dashboard_modules(code)
WHERE om.role = 'member'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_member_dashboard_modules(
  p_org_id UUID,
  p_user_id UUID,
  p_modules public.dashboard_module_code[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role organization_role;
  target_role organization_role;
  v_module_code public.dashboard_module_code;
BEGIN
  caller_role := public.get_user_organization_role(p_org_id, auth.uid());
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores e proprietários podem alterar permissões dos módulos.';
  END IF;

  SELECT role INTO target_role
  FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  IF target_role IS DISTINCT FROM 'member' THEN
    RAISE EXCEPTION 'As permissões só podem ser alteradas para membros operacionais.';
  END IF;

  DELETE FROM public.organization_member_dashboard_modules
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  IF p_modules IS NOT NULL THEN
    FOREACH v_module_code IN ARRAY p_modules
    LOOP
      INSERT INTO public.organization_member_dashboard_modules (
        organization_id,
        user_id,
        module_code
      )
      VALUES (p_org_id, p_user_id, v_module_code)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  DELETE FROM public.organization_member_modules
  WHERE organization_id = p_org_id
    AND user_id = p_user_id
    AND module_code IN ('orcafacil', 'estoqueleve');

  IF 'MOD-02' = ANY(p_modules) THEN
    INSERT INTO public.organization_member_modules (organization_id, user_id, module_code)
    VALUES (p_org_id, p_user_id, 'estoqueleve')
    ON CONFLICT DO NOTHING;
  END IF;

  IF 'MOD-03' = ANY(p_modules) OR 'MOD-04' = ANY(p_modules) THEN
    INSERT INTO public.organization_member_modules (organization_id, user_id, module_code)
    VALUES (p_org_id, p_user_id, 'orcafacil')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN true;
END;
$$;
