import { describe, it, expect } from 'vitest'
import { validatePasswordStrength } from './password-validator'

describe('validatePasswordStrength', () => {
  it('fails when password is too short', () => {
    const res = validatePasswordStrength('Ab1!')
    expect(res.isValid).toBe(false)
    expect(res.hasMinLength).toBe(false)
    expect(res.hasUpperCase).toBe(true)
    expect(res.hasLowerCase).toBe(true)
    expect(res.hasNumber).toBe(true)
    expect(res.hasSpecialChar).toBe(true)
  })

  it('fails when missing uppercase letter', () => {
    const res = validatePasswordStrength('password123!')
    expect(res.isValid).toBe(false)
    expect(res.hasUpperCase).toBe(false)
    expect(res.errors).toContain('Pelo menos uma letra maiúscula.')
  })

  it('fails when missing lowercase letter', () => {
    const res = validatePasswordStrength('PASSWORD123!')
    expect(res.isValid).toBe(false)
    expect(res.hasLowerCase).toBe(false)
    expect(res.errors).toContain('Pelo menos uma letra minúscula.')
  })

  it('fails when missing number', () => {
    const res = validatePasswordStrength('Password!@#')
    expect(res.isValid).toBe(false)
    expect(res.hasNumber).toBe(false)
    expect(res.errors).toContain('Pelo menos um número.')
  })

  it('fails when missing special character', () => {
    const res = validatePasswordStrength('Password123')
    expect(res.isValid).toBe(false)
    expect(res.hasSpecialChar).toBe(false)
    expect(res.errors).toContain('Pelo menos um caractere especial (ex: ! @ # $ % * &).')
  })

  it('passes when all criteria are met', () => {
    const res = validatePasswordStrength('SenhaForte@2026')
    expect(res.isValid).toBe(true)
    expect(res.errors).toHaveLength(0)
    expect(res.hasMinLength).toBe(true)
    expect(res.hasUpperCase).toBe(true)
    expect(res.hasLowerCase).toBe(true)
    expect(res.hasNumber).toBe(true)
    expect(res.hasSpecialChar).toBe(true)
  })
})
