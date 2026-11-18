-- 00135_customer_document_mathematical_validation.sql
-- Validação matemática obrigatória de CPF e CNPJ (numérico e alfanumérico)
-- Implementação dos algoritmos oficiais da Receita Federal do Brasil (módulo 11)

-- 1. Função para validação matemática de CPF
CREATE OR REPLACE FUNCTION public.fn_validate_cpf_mathematical(p_cpf text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_doc text;
  v_sum1 integer := 0;
  v_sum2 integer := 0;
  v_r1 integer;
  v_r2 integer;
  v_dv1 integer;
  v_dv2 integer;
  i integer;
BEGIN
  -- Remove pontuação, traços e espaços
  v_doc := regexp_replace(COALESCE(p_cpf, ''), '[^0-9]', '', 'g');

  -- CPF deve conter exatamente 11 dígitos
  IF length(v_doc) <> 11 THEN
    RETURN FALSE;
  END IF;

  -- Rejeita sequências com todos os dígitos iguais (ex: 00000000000, 11111111111)
  IF v_doc ~ '^([0-9])\1{10}$' THEN
    RETURN FALSE;
  END IF;

  -- 1º Dígito Verificador (pesos de 10 a 2)
  FOR i IN 1..9 LOOP
    v_sum1 := v_sum1 + substring(v_doc FROM i FOR 1)::integer * (11 - i);
  END LOOP;

  v_r1 := v_sum1 % 11;
  IF v_r1 < 2 THEN
    v_dv1 := 0;
  ELSE
    v_dv1 := 11 - v_r1;
  END IF;

  IF v_dv1 <> substring(v_doc FROM 10 FOR 1)::integer THEN
    RETURN FALSE;
  END IF;

  -- 2º Dígito Verificador (pesos de 11 a 2)
  FOR i IN 1..9 LOOP
    v_sum2 := v_sum2 + substring(v_doc FROM i FOR 1)::integer * (12 - i);
  END LOOP;
  v_sum2 := v_sum2 + (v_dv1 * 2);

  v_r2 := v_sum2 % 11;
  IF v_r2 < 2 THEN
    v_dv2 := 0;
  ELSE
    v_dv2 := 11 - v_r2;
  END IF;

  IF v_dv2 <> substring(v_doc FROM 11 FOR 1)::integer THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- 2. Função para validação matemática de CNPJ (numérico e alfanumérico conforme IN RFB 2.229/2024)
CREATE OR REPLACE FUNCTION public.fn_validate_cnpj_mathematical(p_cnpj text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_doc text;
  v_sum1 integer := 0;
  v_sum2 integer := 0;
  v_r1 integer;
  v_r2 integer;
  v_dv1 integer;
  v_dv2 integer;
  v_val integer;
  v_weights1 integer[] := ARRAY[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  v_weights2 integer[] := ARRAY[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  i integer;
BEGIN
  -- Remove pontuação e espaços, e converte para maiúsculo
  v_doc := upper(regexp_replace(COALESCE(p_cnpj, ''), '[.\-/ ]', '', 'g'));

  -- CNPJ deve ter exatamente 14 caracteres
  IF length(v_doc) <> 14 THEN
    RETURN FALSE;
  END IF;

  -- Primeiras 12 posições: alfanuméricas [0-9A-Z]
  IF NOT (substring(v_doc FROM 1 FOR 12) ~ '^[0-9A-Z]{12}$') THEN
    RETURN FALSE;
  END IF;

  -- Últimas 2 posições: dígitos verificadores numéricos [0-9]
  IF NOT (substring(v_doc FROM 13 FOR 2) ~ '^[0-9]{2}$') THEN
    RETURN FALSE;
  END IF;

  -- Rejeita sequências com todos os caracteres iguais (ex: 00000000000000, AAAAAAAAAAAAAA)
  IF v_doc ~ '^([0-9A-Z])\1{13}$' THEN
    RETURN FALSE;
  END IF;

  -- 1º Dígito Verificador: conversão ASCII - 48 e pesos 5,4,3,2,9,8,7,6,5,4,3,2
  FOR i IN 1..12 LOOP
    v_val := ascii(substring(v_doc FROM i FOR 1)) - 48;
    v_sum1 := v_sum1 + v_val * v_weights1[i];
  END LOOP;

  v_r1 := v_sum1 % 11;
  IF v_r1 < 2 THEN
    v_dv1 := 0;
  ELSE
    v_dv1 := 11 - v_r1;
  END IF;

  IF v_dv1 <> substring(v_doc FROM 13 FOR 1)::integer THEN
    RETURN FALSE;
  END IF;

  -- 2º Dígito Verificador: conversão ASCII - 48 e pesos 6,5,4,3,2,9,8,7,6,5,4,3,2
  FOR i IN 1..12 LOOP
    v_val := ascii(substring(v_doc FROM i FOR 1)) - 48;
    v_sum2 := v_sum2 + v_val * v_weights2[i];
  END LOOP;
  v_sum2 := v_sum2 + (v_dv1 * 2);

  v_r2 := v_sum2 % 11;
  IF v_r2 < 2 THEN
    v_dv2 := 0;
  ELSE
    v_dv2 := 11 - v_r2;
  END IF;

  IF v_dv2 <> substring(v_doc FROM 14 FOR 1)::integer THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- 3. Função de Trigger para validação antes de gravar no banco de dados
CREATE OR REPLACE FUNCTION public.fn_trg_validate_customer_document()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_clean text;
BEGIN
  IF NEW.document IS NOT NULL AND trim(NEW.document) <> '' THEN
    IF NEW.person_type = 'individual' THEN
      v_clean := regexp_replace(NEW.document, '[.\-/ ]', '', 'g');
      IF NOT public.fn_validate_cpf_mathematical(v_clean) THEN
        RAISE EXCEPTION 'CPF inválido. Os dígitos verificadores não conferem.' USING ERRCODE = '23514';
      END IF;
      NEW.document := v_clean;
    ELSE
      v_clean := upper(regexp_replace(NEW.document, '[.\-/ ]', '', 'g'));
      IF NOT public.fn_validate_cnpj_mathematical(v_clean) THEN
        RAISE EXCEPTION 'CNPJ inválido. Os dígitos verificadores não conferem.' USING ERRCODE = '23514';
      END IF;
      NEW.document := v_clean;
    END IF;
  ELSE
    NEW.document := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Trigger na tabela public.customers
DROP TRIGGER IF EXISTS trg_validate_customer_document ON public.customers;
CREATE TRIGGER trg_validate_customer_document
  BEFORE INSERT OR UPDATE OF document, person_type ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_validate_customer_document();
