import { describe, expect, it } from 'vitest'
import {
  calculateCpfCheckDigits,
  calculateCnpjNumericCheckDigits,
  calculateCnpjAlphanumericCheckDigits,
  validateCpf,
  validateCnpjNumeric,
  validateCnpjAlphanumeric,
  validateCnpj,
  validateCustomerDocument,
  formatCustomerDocument,
  sanitizeCustomerDocument,
  isAlphanumericCnpj,
  isAllSameChars,
  CPF_INVALID_ERROR,
  CNPJ_INVALID_ERROR,
  customerDocumentValidatorService,
} from './document-validator.service'

describe('Validador Matemático de Documentos (CPF e CNPJ)', () => {
  describe('1. Algoritmo de CPF', () => {
    it('calcula corretamente os dígitos verificadores do CPF', () => {
      const { dv1, dv2 } = calculateCpfCheckDigits('529982247')
      expect(dv1).toBe(2)
      expect(dv2).toBe(5)
    })

    it('valida CPF correto sem formatação', () => {
      const result = validateCpf('52998224725')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.calculatedDigits).toEqual({ dv1: 2, dv2: 5 })
    })

    it('valida CPF correto com formatação e espaços', () => {
      const result = validateCpf('  529.982.247-25  ')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('valida CPF com zero à esquerda', () => {
      // 012345678 -> DV1=9, DV2=0
      const result = validateCpf('01234567890')
      expect(result.isValid).toBe(true)
      expect(result.calculatedDigits).toEqual({ dv1: 9, dv2: 0 })

      const formattedResult = validateCpf('012.345.678-90')
      expect(formattedResult.isValid).toBe(true)
    })

    it('rejeita CPF inválido com primeiro dígito verificador incorreto', () => {
      // Correto seria 52998224725, informando 52998224795 (DV1 incorreto)
      const result = validateCpf('52998224795')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe(CPF_INVALID_ERROR)
      expect(result.calculatedDigits).toEqual({ dv1: 2, dv2: 5 })
    })

    it('rejeita CPF inválido com segundo dígito verificador incorreto', () => {
      // Correto seria 52998224725, informando 52998224729 (DV2 incorreto)
      const result = validateCpf('52998224729')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe(CPF_INVALID_ERROR)
      expect(result.calculatedDigits).toEqual({ dv1: 2, dv2: 5 })
    })

    it('rejeita CPF com todos os dígitos repetidos', () => {
      const repeatedCases = [
        '00000000000',
        '11111111111',
        '222.222.222-22',
        '33333333333',
        '44444444444',
        '55555555555',
        '66666666666',
        '77777777777',
        '88888888888',
        '99999999999',
      ]
      for (const cpf of repeatedCases) {
        const result = validateCpf(cpf)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe(CPF_INVALID_ERROR)
      }
    })

    it('rejeita CPF incompleto informando a quantidade de dígitos necessária', () => {
      const result = validateCpf('123456789')
      expect(result.isValid).toBe(false)
      expect(result.isPartial).toBe(true)
      expect(result.error).toBe('Informe o CPF completo com 11 dígitos.')
    })

    it('rejeita CPF com quantidade de dígitos superior a 11', () => {
      const result = validateCpf('529982247259')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe(CPF_INVALID_ERROR)
    })
  })

  describe('2. Algoritmo de CNPJ numérico', () => {
    it('calcula corretamente os dígitos verificadores do CNPJ numérico (ex: Banco do Brasil)', () => {
      // 000000000001 -> DV1=9, DV2=1
      const { dv1, dv2 } = calculateCnpjNumericCheckDigits('000000000001')
      expect(dv1).toBe(9)
      expect(dv2).toBe(1)
    })

    it('valida CNPJ numérico correto sem formatação e com zeros à esquerda preservados', () => {
      const result = validateCnpjNumeric('00000000000191')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.calculatedDigits).toEqual({ dv1: 9, dv2: 1 })
    })

    it('valida CNPJ numérico correto com formatação', () => {
      const result = validateCnpjNumeric('00.000.000/0001-91')
      expect(result.isValid).toBe(true)

      const result2 = validateCnpjNumeric('11.222.333/0001-81')
      expect(result2.isValid).toBe(true)
      expect(result2.calculatedDigits).toEqual({ dv1: 8, dv2: 1 })
    })

    it('rejeita CNPJ numérico com primeiro dígito verificador incorreto', () => {
      // Correto: 00000000000191; informado: 00000000000131 (DV1=3 em vez de 9)
      const result = validateCnpjNumeric('00000000000131')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe(CNPJ_INVALID_ERROR)
      expect(result.calculatedDigits).toEqual({ dv1: 9, dv2: 1 })
    })

    it('rejeita CNPJ numérico com segundo dígito verificador incorreto', () => {
      // Correto: 00000000000191; informado: 00000000000194 (DV2=4 em vez de 1)
      const result = validateCnpjNumeric('00000000000194')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe(CNPJ_INVALID_ERROR)
      expect(result.calculatedDigits).toEqual({ dv1: 9, dv2: 1 })
    })

    it('rejeita CNPJ numérico com todos os dígitos repetidos', () => {
      const repeatedCases = [
        '00000000000000',
        '11111111111111',
        '11.111.111/1111-11',
        '22222222222222',
        '99999999999999',
      ]
      for (const cnpj of repeatedCases) {
        const result = validateCnpjNumeric(cnpj)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe(CNPJ_INVALID_ERROR)
      }
    })

    it('rejeita CNPJ incompleto', () => {
      const result = validateCnpjNumeric('123456780001')
      expect(result.isValid).toBe(false)
      expect(result.isPartial).toBe(true)
      expect(result.error).toBe('Informe o CNPJ completo com 14 caracteres.')
    })
  })

  describe('3. Algoritmo de CNPJ alfanumérico (IN RFB 2.229/2024)', () => {
    it('detecta se um CNPJ possui caracteres alfanuméricos', () => {
      expect(isAlphanumericCnpj('12ABC34501DE35')).toBe(true)
      expect(isAlphanumericCnpj('00.ABC.000/0001-45')).toBe(true)
      expect(isAlphanumericCnpj('00000000000191')).toBe(false)
    })

    it('calcula os dígitos verificadores conforme a regra oficial ASCII - 48', () => {
      // 12ABC34501DE -> DV1=3, DV2=5
      const { dv1, dv2 } = calculateCnpjAlphanumericCheckDigits('12ABC34501DE')
      expect(dv1).toBe(3)
      expect(dv2).toBe(5)
    })

    it('valida CNPJ alfanumérico correto sem formatação', () => {
      const result = validateCnpjAlphanumeric('12ABC34501DE35')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.calculatedDigits).toEqual({ dv1: 3, dv2: 5 })
    })

    it('valida CNPJ alfanumérico correto com formatação', () => {
      const result = validateCnpjAlphanumeric('12.ABC.345/01DE-35')
      expect(result.isValid).toBe(true)
    })

    it('valida CNPJ alfanumérico com zeros à esquerda', () => {
      // 00ABC0000001 -> DV1=4, DV2=5
      const result = validateCnpjAlphanumeric('00ABC000000145')
      expect(result.isValid).toBe(true)
      expect(result.calculatedDigits).toEqual({ dv1: 4, dv2: 5 })

      const formatted = validateCnpjAlphanumeric('00.ABC.000/0001-45')
      expect(formatted.isValid).toBe(true)
    })

    it('valida CNPJ alfanumérico com letras minúsculas (convertidas para maiúsculas)', () => {
      const result = validateCnpjAlphanumeric('12abc34501de35')
      expect(result.isValid).toBe(true)
      expect(result.calculatedDigits).toEqual({ dv1: 3, dv2: 5 })
    })

    it('valida caso onde o segundo dígito verificador resulta em 0', () => {
      // AB1234CD0001 -> DV1=6, DV2=0
      const result = validateCnpjAlphanumeric('AB1234CD000160')
      expect(result.isValid).toBe(true)
      expect(result.calculatedDigits).toEqual({ dv1: 6, dv2: 0 })
    })

    it('rejeita CNPJ alfanumérico com primeiro dígito verificador incorreto', () => {
      // Correto: 12ABC34501DE35; informado: 12ABC34501DE85
      const result = validateCnpjAlphanumeric('12ABC34501DE85')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe(CNPJ_INVALID_ERROR)
      expect(result.calculatedDigits).toEqual({ dv1: 3, dv2: 5 })
    })

    it('rejeita CNPJ alfanumérico com segundo dígito verificador incorreto', () => {
      // Correto: 12ABC34501DE35; informado: 12ABC34501DE39
      const result = validateCnpjAlphanumeric('12ABC34501DE39')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe(CNPJ_INVALID_ERROR)
      expect(result.calculatedDigits).toEqual({ dv1: 3, dv2: 5 })
    })

    it('rejeita CNPJ alfanumérico com todos os caracteres repetidos', () => {
      const result = validateCnpjAlphanumeric('AAAAAAAAAAAAAA')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe(CNPJ_INVALID_ERROR)
    })

    it('rejeita CNPJ alfanumérico com caracteres não numéricos nos dígitos verificadores', () => {
      const result = validateCnpjAlphanumeric('12ABC34501DEAB')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe(CNPJ_INVALID_ERROR)
    })
  })

  describe('4. Método unificado validateCnpj e validateCustomerDocument', () => {
    it('roteia corretamente CNPJ numérico para validação numérica', () => {
      const valid = validateCnpj('00.000.000/0001-91')
      expect(valid.isValid).toBe(true)

      const invalid = validateCnpj('00.000.000/0001-00')
      expect(invalid.isValid).toBe(false)
      expect(invalid.error).toBe(CNPJ_INVALID_ERROR)
    })

    it('roteia corretamente CNPJ alfanumérico para validação alfanumérica', () => {
      const valid = validateCnpj('12.ABC.345/01DE-35')
      expect(valid.isValid).toBe(true)

      const invalid = validateCnpj('12.ABC.345/01DE-00')
      expect(invalid.isValid).toBe(false)
      expect(invalid.error).toBe(CNPJ_INVALID_ERROR)
    })

    it('validateCustomerDocument valida individual como CPF e company como CNPJ', () => {
      const validPf = validateCustomerDocument('529.982.247-25', 'individual')
      expect(validPf.isValid).toBe(true)

      const invalidPf = validateCustomerDocument('529.982.247-00', 'individual')
      expect(invalidPf.isValid).toBe(false)
      expect(invalidPf.error).toBe(CPF_INVALID_ERROR)

      const validPjNumeric = validateCustomerDocument('00.000.000/0001-91', 'company')
      expect(validPjNumeric.isValid).toBe(true)

      const validPjAlpha = validateCustomerDocument('12.ABC.345/01DE-35', 'company')
      expect(validPjAlpha.isValid).toBe(true)

      const invalidPj = validateCustomerDocument('12.ABC.345/01DE-99', 'company')
      expect(invalidPj.isValid).toBe(false)
      expect(invalidPj.error).toBe(CNPJ_INVALID_ERROR)
    })
  })

  describe('5. Formatação e Sanitização', () => {
    it('formata CPF corretamente', () => {
      expect(formatCustomerDocument('52998224725', 'individual')).toBe('529.982.247-25')
      expect(formatCustomerDocument('01234567890', 'individual')).toBe('012.345.678-90')
    })

    it('formata CNPJ numérico corretamente', () => {
      expect(formatCustomerDocument('00000000000191', 'company')).toBe('00.000.000/0001-91')
    })

    it('formata CNPJ alfanumérico com letras maiúsculas e máscara padrão', () => {
      expect(formatCustomerDocument('12abc34501de35', 'company')).toBe('12.ABC.345/01DE-35')
      expect(formatCustomerDocument('00abc000000145', 'company')).toBe('00.ABC.000/0001-45')
    })

    it('sanitiza CPF removendo pontuação e espaços', () => {
      expect(sanitizeCustomerDocument('  529.982.247-25  ', 'individual')).toBe('52998224725')
    })

    it('sanitiza CNPJ preservando letras em maiúsculas e dígitos', () => {
      expect(sanitizeCustomerDocument('  12.abc.345/01de-35  ', 'company')).toBe('12ABC34501DE35')
      expect(sanitizeCustomerDocument('00.000.000/0001-91', 'company')).toBe('00000000000191')
    })

    it('isAllSameChars identifica corretamente strings com caracteres repetidos', () => {
      expect(isAllSameChars('11111111111')).toBe(true)
      expect(isAllSameChars('AAAAAAAAAAAAAA')).toBe(true)
      expect(isAllSameChars('00000000000000')).toBe(true)
      expect(isAllSameChars('11111111112')).toBe(false)
      expect(isAllSameChars('12ABC34501DE35')).toBe(false)
    })
  })

  describe('6. Objeto de serviço centralizado', () => {
    it('expõe todos os métodos no singleton do serviço', () => {
      expect(customerDocumentValidatorService.validateCpf).toBeDefined()
      expect(customerDocumentValidatorService.validateCnpjNumeric).toBeDefined()
      expect(customerDocumentValidatorService.validateCnpjAlphanumeric).toBeDefined()
      expect(customerDocumentValidatorService.validateCnpj).toBeDefined()
      expect(customerDocumentValidatorService.validateCustomerDocument).toBeDefined()
      expect(customerDocumentValidatorService.formatCustomerDocument).toBeDefined()
      expect(customerDocumentValidatorService.sanitizeCustomerDocument).toBeDefined()
    })
  })
})
