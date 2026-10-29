import { describe, expect, it } from 'vitest'
import { formatPhoneNumber } from './phone'

describe('formatPhoneNumber', () => {
  it('formata o telefone celular brasileiro', () => {
    expect(formatPhoneNumber('31987654321')).toBe('(31) 98765-4321')
  })

  it('remove caracteres não numéricos e limita a 11 dígitos', () => {
    expect(formatPhoneNumber('(31) 98765-432199')).toBe('(31) 98765-4321')
  })

  it('formata o número parcialmente durante a digitação', () => {
    expect(formatPhoneNumber('31')).toBe('(31')
    expect(formatPhoneNumber('3198765')).toBe('(31) 98765')
    expect(formatPhoneNumber('31987654')).toBe('(31) 98765-4')
  })

  it('retorna uma string vazia quando não há números', () => {
    expect(formatPhoneNumber('')).toBe('')
    expect(formatPhoneNumber('() -')).toBe('')
  })
})
