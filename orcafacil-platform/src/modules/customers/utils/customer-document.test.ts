import { describe, expect, it } from 'vitest'
import {
  formatCustomerDocument,
  validateCustomerDocument,
  validateCpf,
  validateCnpj,
  validateCnpjAlphanumeric,
  validateCnpjNumeric,
} from './customer-document'

describe('customer-document utils & re-exports', () => {
  describe('formatCustomerDocument', () => {
    it('aplica máscara de CPF e limita a 11 dígitos', () => {
      expect(formatCustomerDocument('12345678901', 'individual')).toBe('123.456.789-01')
      expect(formatCustomerDocument('123456789012', 'individual')).toBe('123.456.789-01')
    })

    it('aplica máscara de CNPJ numérico e limita a 14 dígitos', () => {
      expect(formatCustomerDocument('12345678000199', 'company')).toBe('12.345.678/0001-99')
      expect(formatCustomerDocument('123456780001999', 'company')).toBe('12.345.678/0001-99')
    })

    it('aplica máscara de CNPJ alfanumérico preservando letras maiúsculas', () => {
      expect(formatCustomerDocument('12abc34501de35', 'company')).toBe('12.ABC.345/01DE-35')
      expect(formatCustomerDocument('00abc000000145', 'company')).toBe('00.ABC.000/0001-45')
    })
  })

  describe('re-exported validators', () => {
    it('valida CPF via re-export', () => {
      expect(validateCpf('529.982.247-25').isValid).toBe(true)
      expect(validateCpf('529.982.247-00').isValid).toBe(false)
    })

    it('valida CNPJ numérico e alfanumérico via re-export', () => {
      expect(validateCnpjNumeric('00.000.000/0001-91').isValid).toBe(true)
      expect(validateCnpjAlphanumeric('12.ABC.345/01DE-35').isValid).toBe(true)
      expect(validateCnpj('12.ABC.345/01DE-35').isValid).toBe(true)
      expect(validateCustomerDocument('12.ABC.345/01DE-35', 'company').isValid).toBe(true)
    })
  })
})
