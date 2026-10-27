import { describe, it, expect } from 'vitest'
import {
  emailSchema,
  passwordSchema,
  organizationNameSchema,
  organizationSlugSchema,
  quantitySchema,
} from './schemas'

describe('Validation Schemas (Zod)', () => {
  it('deve validar e-mails com formato correto', () => {
    expect(emailSchema.safeParse('usuario@empresa.com').success).toBe(true)
    expect(emailSchema.safeParse('invalido').success).toBe(false)
    expect(emailSchema.safeParse('').success).toBe(false)
  })

  it('deve validar comprimento mínimo de senha de 8 caracteres', () => {
    expect(passwordSchema.safeParse('12345678').success).toBe(true)
    expect(passwordSchema.safeParse('1234567').success).toBe(false)
  })

  it('deve validar slug de organização permitindo apenas minúsculas, números e hífens', () => {
    expect(organizationSlugSchema.safeParse('minha-empresa-123').success).toBe(true)
    expect(organizationSlugSchema.safeParse('Minha Empresa').success).toBe(false)
    expect(organizationSlugSchema.safeParse('empresa_invalida').success).toBe(false)
  })

  it('deve validar nome de organização', () => {
    expect(organizationNameSchema.safeParse('Alfa Pinturas').success).toBe(true)
    expect(organizationNameSchema.safeParse('A').success).toBe(false)
  })

  it('deve exigir quantidade maior que zero', () => {
    expect(quantitySchema.safeParse('1.5').success).toBe(true)
    expect(quantitySchema.safeParse('0').success).toBe(false)
  })
})

