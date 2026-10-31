import { describe, expect, it } from 'vitest'
import { formatCustomerDocument } from './customer-document'

describe('formatCustomerDocument', () => {
  it('aplica máscara de CPF e limita a 11 dígitos', () => {
    expect(formatCustomerDocument('12345678901', 'individual')).toBe('123.456.789-01')
    expect(formatCustomerDocument('123456789012', 'individual')).toBe('123.456.789-01')
  })

  it('aplica máscara de CNPJ e limita a 14 dígitos', () => {
    expect(formatCustomerDocument('12345678000199', 'company')).toBe('12.345.678/0001-99')
    expect(formatCustomerDocument('123456780001999', 'company')).toBe('12.345.678/0001-99')
  })
})
