-- 00136_organization_and_supplier_document_validation.sql
-- Validação matemática obrigatória de CNPJ em Empresas (organizations) e Fornecedores (suppliers)
-- Utiliza os algoritmos matemáticos oficiais da Receita Federal já definidos em fn_validate_cnpj_mathematical

-- 1. Trigger para a tabela public.organizations (campo cnpj)
CREATE OR REPLACE FUNCTION public.fn_trg_validate_organization_cnpj()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_clean text;
BEGIN
  IF NEW.cnpj IS NOT NULL AND trim(NEW.cnpj) <> '' THEN
    v_clean := upper(regexp_replace(NEW.cnpj, '[.\-/ ]', '', 'g'));
    IF NOT public.fn_validate_cnpj_mathematical(v_clean) THEN
      RAISE EXCEPTION 'CNPJ inválido. Os dígitos verificadores não conferem.' USING ERRCODE = '23514';
    END IF;
    NEW.cnpj := v_clean;
  ELSE
    NEW.cnpj := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_organization_cnpj ON public.organizations;
CREATE TRIGGER trg_validate_organization_cnpj
  BEFORE INSERT OR UPDATE OF cnpj ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_validate_organization_cnpj();

-- 2. Trigger para a tabela public.suppliers (campo document)
CREATE OR REPLACE FUNCTION public.fn_trg_validate_supplier_document()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_clean text;
BEGIN
  IF NEW.document IS NOT NULL AND trim(NEW.document) <> '' THEN
    v_clean := upper(regexp_replace(NEW.document, '[.\-/ ]', '', 'g'));
    IF NOT public.fn_validate_cnpj_mathematical(v_clean) THEN
      RAISE EXCEPTION 'CNPJ inválido. Os dígitos verificadores não conferem.' USING ERRCODE = '23514';
    END IF;
    NEW.document := v_clean;
  ELSE
    NEW.document := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_supplier_document ON public.suppliers;
CREATE TRIGGER trg_validate_supplier_document
  BEFORE INSERT OR UPDATE OF document ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_validate_supplier_document();
