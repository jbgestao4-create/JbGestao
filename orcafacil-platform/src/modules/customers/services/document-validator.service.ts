/**
 * Serviço centralizado de validação matemática de CPF e CNPJ (numérico e alfanumérico).
 * Implementa as especificações oficiais da Secretaria da Receita Federal do Brasil (RFB).
 *
 * Especificações implementadas:
 * 1. Algoritmo oficial de CPF (módulo 11, pesos de 10 a 2 para DV1 e 11 a 2 para DV2).
 * 2. Algoritmo oficial de CNPJ numérico (módulo 11, pesos 5..2 e 9..2).
 * 3. Algoritmo oficial de CNPJ alfanumérico (Instrução Normativa RFB nº 2.229/2024 / Nota Técnica Conjunta):
 *    - Posições 1 a 12: aceita números de 0 a 9 e letras de A a Z.
 *    - Conversão: valor ASCII do caractere menos 48 ('0'-'9' => 0-9; 'A'-'Z' => 17-42).
 *    - Posições 13 e 14: dígitos verificadores numéricos.
 *    - Pesos e módulo 11 idênticos ao cálculo do CNPJ padrão.
 */

import type { CustomerType } from '@shared/types/common'

export interface DocumentValidationResult {
  isValid: boolean
  error?: string
  isPartial?: boolean
  calculatedDigits?: { dv1: number; dv2: number }
}

export interface CheckDigitsResult {
  dv1: number
  dv2: number
}

// Pesos oficiais para cálculo dos dígitos verificadores
export const CPF_WEIGHTS_1 = [10, 9, 8, 7, 6, 5, 4, 3, 2] as const
export const CPF_WEIGHTS_2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2] as const

export const CNPJ_WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const
export const CNPJ_WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const

export const CPF_INVALID_ERROR = 'CPF inválido. Os dígitos verificadores não conferem.'
export const CNPJ_INVALID_ERROR = 'CNPJ inválido. Os dígitos verificadores não conferem.'

/**
 * Executa o cálculo padrão de módulo 11 conforme a especificação da Receita Federal:
 * 1. Multiplica cada valor de entrada pelo peso correspondente e soma todos os produtos.
 * 2. Calcula o resto da divisão da soma por 11.
 * 3. Se resto < 2, dígito verificador é 0. Caso contrário, é (11 - resto).
 */
export function calculateMod11(values: number[], weights: readonly number[]): number {
  const sum = values.reduce((acc, val, idx) => acc + val * weights[idx], 0)
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

/**
 * Remove formatação (. - / e espaços) de um CPF.
 */
export function sanitizeCpf(value: string): string {
  return value.trim().replace(/[.\-/ ]/g, '')
}

/**
 * Remove formatação (. - / e espaços) de um CNPJ e converte para maiúsculas.
 */
export function sanitizeCnpj(value: string): string {
  return value.trim().toUpperCase().replace(/[.\-/ ]/g, '')
}

/**
 * Sanitiza o documento de acordo com o tipo de pessoa do cliente.
 */
export function sanitizeCustomerDocument(value: string, personType: CustomerType): string {
  return personType === 'individual' ? sanitizeCpf(value) : sanitizeCnpj(value)
}

/**
 * Verifica se todos os caracteres da string são idênticos (ex: "11111111111", "00000000000000").
 */
export function isAllSameChars(value: string): boolean {
  if (value.length <= 1) return false
  const first = value[0]
  for (let i = 1; i < value.length; i++) {
    if (value[i] !== first) return false
  }
  return true
}

/**
 * Verifica se a base de 12 posições do CNPJ contém letras, indicando o novo formato alfanumérico.
 */
export function isAlphanumericCnpj(cleanCnpj: string): boolean {
  const base = cleanCnpj.slice(0, 12).toUpperCase()
  return /[A-Z]/.test(base)
}

/**
 * Calcula os dois dígitos verificadores do CPF utilizando os 9 primeiros dígitos.
 */
export function calculateCpfCheckDigits(cleanCpf: string): CheckDigitsResult {
  const digits = cleanCpf.slice(0, 9).split('').map(Number)
  const dv1 = calculateMod11(digits, CPF_WEIGHTS_1)
  const dv2 = calculateMod11([...digits, dv1], CPF_WEIGHTS_2)
  return { dv1, dv2 }
}

/**
 * Calcula os dois dígitos verificadores do CNPJ numérico utilizando os 12 primeiros dígitos.
 */
export function calculateCnpjNumericCheckDigits(cleanCnpj: string): CheckDigitsResult {
  const digits = cleanCnpj.slice(0, 12).split('').map(Number)
  const dv1 = calculateMod11(digits, CNPJ_WEIGHTS_1)
  const dv2 = calculateMod11([...digits, dv1], CNPJ_WEIGHTS_2)
  return { dv1, dv2 }
}

/**
 * Calcula os dois dígitos verificadores do CNPJ alfanumérico conforme a especificação da Receita Federal:
 * - Cada caractere das primeiras 12 posições é convertido para seu valor numérico: código ASCII menos 48.
 * - São aplicados os mesmos pesos e a regra de módulo 11 do CNPJ tradicional.
 */
export function calculateCnpjAlphanumericCheckDigits(cleanCnpj: string): CheckDigitsResult {
  const normalized = cleanCnpj.toUpperCase().slice(0, 12)
  const values = normalized.split('').map((char) => char.charCodeAt(0) - 48)
  const dv1 = calculateMod11(values, CNPJ_WEIGHTS_1)
  const dv2 = calculateMod11([...values, dv1], CNPJ_WEIGHTS_2)
  return { dv1, dv2 }
}

/**
 * Valida matematicamente um CPF:
 * - Remove formatação.
 * - Rejeita tamanho diferente de 11 dígitos.
 * - Rejeita dígitos não numéricos.
 * - Rejeita documentos com todos os caracteres repetidos.
 * - Recalcula os dígitos verificadores e compara com os informados.
 */
export function validateCpf(cpf: string): DocumentValidationResult {
  const clean = sanitizeCpf(cpf)

  if (clean.length === 0) {
    return { isValid: false, error: 'Informe o CPF completo com 11 dígitos.', isPartial: true }
  }

  if (clean.length < 11) {
    return { isValid: false, error: 'Informe o CPF completo com 11 dígitos.', isPartial: true }
  }

  if (clean.length > 11 || !/^\d{11}$/.test(clean)) {
    return { isValid: false, error: CPF_INVALID_ERROR }
  }

  if (isAllSameChars(clean)) {
    return { isValid: false, error: CPF_INVALID_ERROR }
  }

  const { dv1, dv2 } = calculateCpfCheckDigits(clean)
  const givenDv1 = Number(clean[9])
  const givenDv2 = Number(clean[10])

  if (dv1 !== givenDv1 || dv2 !== givenDv2) {
    return {
      isValid: false,
      error: CPF_INVALID_ERROR,
      calculatedDigits: { dv1, dv2 },
    }
  }

  return {
    isValid: true,
    calculatedDigits: { dv1, dv2 },
  }
}

/**
 * Valida matematicamente um CNPJ estritamente numérico:
 * - Remove formatação.
 * - Rejeita tamanho diferente de 14 dígitos.
 * - Rejeita documentos com todos os dígitos repetidos.
 * - Recalcula os dígitos verificadores com os pesos do CNPJ e compara.
 */
export function validateCnpjNumeric(cnpj: string): DocumentValidationResult {
  const clean = sanitizeCnpj(cnpj)

  if (clean.length === 0) {
    return { isValid: false, error: 'Informe o CNPJ completo com 14 caracteres.', isPartial: true }
  }

  if (clean.length < 14) {
    return { isValid: false, error: 'Informe o CNPJ completo com 14 caracteres.', isPartial: true }
  }

  if (clean.length > 14 || !/^\d{14}$/.test(clean)) {
    return { isValid: false, error: CNPJ_INVALID_ERROR }
  }

  if (isAllSameChars(clean)) {
    return { isValid: false, error: CNPJ_INVALID_ERROR }
  }

  const { dv1, dv2 } = calculateCnpjNumericCheckDigits(clean)
  const givenDv1 = Number(clean[12])
  const givenDv2 = Number(clean[13])

  if (dv1 !== givenDv1 || dv2 !== givenDv2) {
    return {
      isValid: false,
      error: CNPJ_INVALID_ERROR,
      calculatedDigits: { dv1, dv2 },
    }
  }

  return {
    isValid: true,
    calculatedDigits: { dv1, dv2 },
  }
}

/**
 * Valida matematicamente um CNPJ alfanumérico conforme regra oficial RFB:
 * - 12 posições alfanuméricas [0-9A-Z] + 2 dígitos verificadores numéricos [0-9].
 * - Conversão de caracteres via ASCII - 48.
 * - Aplicação de módulo 11 e comparação dos dígitos.
 */
export function validateCnpjAlphanumeric(cnpj: string): DocumentValidationResult {
  const clean = sanitizeCnpj(cnpj)

  if (clean.length === 0) {
    return { isValid: false, error: 'Informe o CNPJ completo com 14 caracteres.', isPartial: true }
  }

  if (clean.length < 14) {
    return { isValid: false, error: 'Informe o CNPJ completo com 14 caracteres.', isPartial: true }
  }

  if (clean.length > 14) {
    return { isValid: false, error: CNPJ_INVALID_ERROR }
  }

  const base = clean.slice(0, 12)
  const dv = clean.slice(12, 14)

  // As primeiras 12 posições devem ser alfanuméricas [0-9A-Z]
  if (!/^[0-9A-Z]{12}$/.test(base)) {
    return { isValid: false, error: CNPJ_INVALID_ERROR }
  }

  // Os 2 dígitos verificadores finais devem ser estritamente numéricos [0-9]
  if (!/^[0-9]{2}$/.test(dv)) {
    return { isValid: false, error: CNPJ_INVALID_ERROR }
  }

  // Rejeita documentos com todos os caracteres idênticos
  if (isAllSameChars(clean)) {
    return { isValid: false, error: CNPJ_INVALID_ERROR }
  }

  const { dv1, dv2 } = calculateCnpjAlphanumericCheckDigits(clean)
  const givenDv1 = Number(dv[0])
  const givenDv2 = Number(dv[1])

  if (dv1 !== givenDv1 || dv2 !== givenDv2) {
    return {
      isValid: false,
      error: CNPJ_INVALID_ERROR,
      calculatedDigits: { dv1, dv2 },
    }
  }

  return {
    isValid: true,
    calculatedDigits: { dv1, dv2 },
  }
}

/**
 * Valida matematicamente um CNPJ identificando se o formato é numérico ou alfanumérico.
 */
export function validateCnpj(cnpj: string): DocumentValidationResult {
  const clean = sanitizeCnpj(cnpj)

  if (clean.length === 0) {
    return { isValid: false, error: 'Informe o CNPJ completo com 14 caracteres.', isPartial: true }
  }

  if (clean.length < 14) {
    return { isValid: false, error: 'Informe o CNPJ completo com 14 caracteres.', isPartial: true }
  }

  if (isAlphanumericCnpj(clean)) {
    return validateCnpjAlphanumeric(clean)
  }

  return validateCnpjNumeric(clean)
}

/**
 * Validação universal para o documento do cliente (CPF ou CNPJ).
 */
export function validateCustomerDocument(
  document: string,
  personType: CustomerType,
): DocumentValidationResult {
  if (personType === 'individual') {
    return validateCpf(document)
  }
  return validateCnpj(document)
}

/**
 * Formata um documento para exibição, respeitando CPF (000.000.000-00)
 * e CNPJ numérico ou alfanumérico (XX.XXX.XXX/XXXX-XX).
 */
export function formatCustomerDocument(value: string, personType: CustomerType): string {
  if (personType === 'individual') {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
  }

  // CNPJ (numérico ou alfanumérico)
  const chars = value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 14)
  if (chars.length <= 2) return chars
  if (chars.length <= 5) return `${chars.slice(0, 2)}.${chars.slice(2)}`
  if (chars.length <= 8) return `${chars.slice(0, 2)}.${chars.slice(2, 5)}.${chars.slice(5)}`
  if (chars.length <= 12) {
    return `${chars.slice(0, 2)}.${chars.slice(2, 5)}.${chars.slice(5, 8)}/${chars.slice(8)}`
  }
  return `${chars.slice(0, 2)}.${chars.slice(2, 5)}.${chars.slice(5, 8)}/${chars.slice(8, 12)}-${chars.slice(12)}`
}

/**
 * Objeto de serviço centralizado com todas as funções para injeção e reutilização.
 */
export const customerDocumentValidatorService = {
  calculateMod11,
  calculateCpfCheckDigits,
  calculateCnpjNumericCheckDigits,
  calculateCnpjAlphanumericCheckDigits,
  sanitizeCpf,
  sanitizeCnpj,
  sanitizeCustomerDocument,
  isAllSameChars,
  isAlphanumericCnpj,
  validateCpf,
  validateCnpjNumeric,
  validateCnpjAlphanumeric,
  validateCnpj,
  validateCustomerDocument,
  formatCustomerDocument,
}
