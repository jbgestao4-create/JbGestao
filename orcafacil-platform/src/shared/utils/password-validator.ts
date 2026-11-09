export interface PasswordValidationResult {
  isValid: boolean
  hasMinLength: boolean
  hasUpperCase: boolean
  hasLowerCase: boolean
  hasNumber: boolean
  hasSpecialChar: boolean
  errors: string[]
}

/**
 * Validador de força de senha para redefinição e atualização de senhas.
 *
 * Regras obrigatórias:
 * - Mínimo de 8 caracteres
 * - Pelo menos uma letra maiúscula (A-Z)
 * - Pelo menos uma letra minúscula (a-z)
 * - Pelo menos um número (0-9)
 * - Pelo menos um caractere especial (!@#$%^&*...)
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const pwd = password || ''

  const hasMinLength = pwd.length >= 8
  const hasUpperCase = /[A-Z]/.test(pwd)
  const hasLowerCase = /[a-z]/.test(pwd)
  const hasNumber = /[0-9]/.test(pwd)
  // Caractere especial: qualquer caractere que não seja letra, dígito ou espaço em branco
  const hasSpecialChar = /[^A-Za-z0-9\s]/.test(pwd)

  const errors: string[] = []
  if (!hasMinLength) {
    errors.push('No mínimo 8 caracteres.')
  }
  if (!hasUpperCase) {
    errors.push('Pelo menos uma letra maiúscula.')
  }
  if (!hasLowerCase) {
    errors.push('Pelo menos uma letra minúscula.')
  }
  if (!hasNumber) {
    errors.push('Pelo menos um número.')
  }
  if (!hasSpecialChar) {
    errors.push('Pelo menos um caractere especial (ex: ! @ # $ % * &).')
  }

  const isValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar

  return {
    isValid,
    hasMinLength,
    hasUpperCase,
    hasLowerCase,
    hasNumber,
    hasSpecialChar,
    errors,
  }
}
