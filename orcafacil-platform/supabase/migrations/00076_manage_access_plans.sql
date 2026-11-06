CREATE TABLE IF NOT EXISTS public.access_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 100),
  description text NOT NULL DEFAULT '',
  module_codes text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.access_plans ENABLE ROW LEVEL SECURITY;

INSERT INTO public.access_plans (id, name, description, module_codes, is_active, is_system)
VALUES
  (
    '00000000-0000-4000-8000-000000000001',
    'Básico',
    'Recursos essenciais para vendas, estoque, clientes, caixa, fornecedores e organização.',
    ARRAY[
      'MOD-01', 'MOD-01_QUICK_SALE', 'MOD-01_SEARCH',
      'MOD-02', 'MOD-02_CREATE', 'MOD-02_SEARCH', 'MOD-02_MOVEMENTS', 'MOD-02_IMPORT_NFE',
      'MOD-03', 'MOD-03_CREATE', 'MOD-03_SEARCH',
      'MOD-05', 'MOD-05_SESSION', 'MOD-05_MOVEMENTS', 'MOD-05_BILLS',
      'MOD-06', 'MOD-06_CREATE', 'MOD-06_SEARCH',
      'MOD-07', 'MOD-07_DETAILS', 'MOD-07_MEMBERS'
    ],
    true,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'Básico + PDV sem NF-e',
    'Plano Básico com Ponto de Venda, sem emissão de NF-e ou NFC-e.',
    ARRAY[
      'MOD-01', 'MOD-01_QUICK_SALE', 'MOD-01_SEARCH', 'MOD-01_PDV',
      'MOD-02', 'MOD-02_CREATE', 'MOD-02_SEARCH', 'MOD-02_MOVEMENTS', 'MOD-02_IMPORT_NFE',
      'MOD-03', 'MOD-03_CREATE', 'MOD-03_SEARCH',
      'MOD-05', 'MOD-05_SESSION', 'MOD-05_MOVEMENTS', 'MOD-05_BILLS',
      'MOD-06', 'MOD-06_CREATE', 'MOD-06_SEARCH',
      'MOD-07', 'MOD-07_DETAILS', 'MOD-07_MEMBERS'
    ],
    true,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'Completo sem emissão de NF-e e NFC-e',
    'Acesso a todas as funções disponíveis, exceto emissão de NF-e e NFC-e.',
    ARRAY[
      'MOD-01', 'MOD-01_QUICK_SALE', 'MOD-01_PDV', 'MOD-01_SEARCH',
      'MOD-02', 'MOD-02_CREATE', 'MOD-02_SEARCH', 'MOD-02_IMPORT_NFE', 'MOD-02_MOVEMENTS',
      'MOD-03', 'MOD-03_CREATE', 'MOD-03_SEARCH',
      'MOD-04', 'MOD-04_CREATE', 'MOD-04_SEARCH',
      'MOD-05', 'MOD-05_SESSION', 'MOD-05_MOVEMENTS', 'MOD-05_BILLS',
      'MOD-06', 'MOD-06_CREATE', 'MOD-06_SEARCH',
      'MOD-07', 'MOD-07_DETAILS', 'MOD-07_MEMBERS',
      'MOD-08', 'MOD-08_SALES', 'MOD-08_INVENTORY',
      'MOD-09', 'MOD-09_CREATE', 'MOD-09_SEARCH',
      'MOD-10', 'MOD-10_CREATE', 'MOD-10_SEARCH'
    ],
    true,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'Completo com emissão de NF-e e NFC-e',
    'Plano em desenvolvimento. Será disponibilizado quando a emissão fiscal estiver pronta.',
    ARRAY[
      'MOD-01', 'MOD-01_QUICK_SALE', 'MOD-01_PDV', 'MOD-01_INVOICES', 'MOD-01_SEARCH',
      'MOD-02', 'MOD-02_CREATE', 'MOD-02_SEARCH', 'MOD-02_IMPORT_NFE', 'MOD-02_MOVEMENTS',
      'MOD-03', 'MOD-03_CREATE', 'MOD-03_SEARCH',
      'MOD-04', 'MOD-04_CREATE', 'MOD-04_SEARCH',
      'MOD-05', 'MOD-05_SESSION', 'MOD-05_MOVEMENTS', 'MOD-05_BILLS',
      'MOD-06', 'MOD-06_CREATE', 'MOD-06_SEARCH',
      'MOD-07', 'MOD-07_DETAILS', 'MOD-07_MEMBERS',
      'MOD-08', 'MOD-08_SALES', 'MOD-08_INVENTORY',
      'MOD-09', 'MOD-09_CREATE', 'MOD-09_SEARCH',
      'MOD-10', 'MOD-10_CREATE', 'MOD-10_SEARCH'
    ],
    false,
    true
  )
ON CONFLICT (id) DO NOTHING;

UPDATE public.access_plans
SET is_active = false,
    is_locked = true,
    updated_at = now()
WHERE id = '00000000-0000-4000-8000-000000000004';

CREATE OR REPLACE FUNCTION public.admin_list_access_plans()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    lower(auth.jwt() ->> 'email') IN (
      'adm@adm.com', 'admin@adm.com', 'proprietario@jbsoftware.com.br',
      'owner@jbsoftware.com.br', 'bryan@administrador.com', 'bryanmendes968@gmail.com'
    )
    OR auth.jwt() -> 'app_metadata' ->> 'is_platform_owner' = 'true'
  ) THEN
    RAISE EXCEPTION 'Apenas o proprietário do sistema pode gerenciar planos.'
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.is_locked, p.name) FROM public.access_plans p),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_access_plan(
  p_id uuid,
  p_name text,
  p_description text,
  p_module_codes text[],
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  saved_plan public.access_plans;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    lower(auth.jwt() ->> 'email') IN (
      'adm@adm.com', 'admin@adm.com', 'proprietario@jbsoftware.com.br',
      'owner@jbsoftware.com.br', 'bryan@administrador.com', 'bryanmendes968@gmail.com'
    )
    OR auth.jwt() -> 'app_metadata' ->> 'is_platform_owner' = 'true'
  ) THEN
    RAISE EXCEPTION 'Apenas o proprietário do sistema pode gerenciar planos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'O nome do plano deve ter entre 2 e 100 caracteres.'
      USING ERRCODE = '22023';
  END IF;
  IF p_description IS NOT NULL AND char_length(p_description) > 500 THEN
    RAISE EXCEPTION 'A descrição do plano não pode ultrapassar 500 caracteres.'
      USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.access_plans (name, description, module_codes, is_active)
    VALUES (btrim(p_name), COALESCE(p_description, ''), COALESCE(p_module_codes, '{}'), COALESCE(p_is_active, false))
    RETURNING * INTO saved_plan;
  ELSE
    UPDATE public.access_plans
    SET name = btrim(p_name),
        description = COALESCE(p_description, ''),
        module_codes = COALESCE(p_module_codes, '{}'),
        is_active = CASE WHEN is_locked THEN false ELSE COALESCE(p_is_active, false) END,
        updated_at = now()
    WHERE id = p_id AND NOT is_locked
    RETURNING * INTO saved_plan;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Plano não encontrado ou protegido contra alterações.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN to_jsonb(saved_plan);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_access_plan(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    lower(auth.jwt() ->> 'email') IN (
      'adm@adm.com', 'admin@adm.com', 'proprietario@jbsoftware.com.br',
      'owner@jbsoftware.com.br', 'bryan@administrador.com', 'bryanmendes968@gmail.com'
    )
    OR auth.jwt() -> 'app_metadata' ->> 'is_platform_owner' = 'true'
  ) THEN
    RAISE EXCEPTION 'Apenas o proprietário do sistema pode gerenciar planos.'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.access_plans
  WHERE id = p_id AND NOT is_system AND NOT is_locked;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano não encontrado ou protegido contra exclusão.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON public.access_plans FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_access_plans() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_save_access_plan(uuid, text, text, text[], boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_access_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_access_plans() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_access_plan(uuid, text, text, text[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_access_plan(uuid) TO authenticated;
