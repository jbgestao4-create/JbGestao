/**
 * Utilitários para formatação e manipulação de CNPJ (numérico e alfanumérico).
 * Integrado ao serviço centralizado de validação matemática da Receita Federal.
 */
import {
  formatCustomerDocument,
  sanitizeCustomerDocument,
  validateCnpj,
  CNPJ_INVALID_ERROR,
} from '@modules/customers/utils/customer-document'

export function formatCNPJ(value: string): string {
  return formatCustomerDocument(value, 'company')
}

export function cleanCNPJ(value: string): string {
  return sanitizeCustomerDocument(value, 'company')
}

export { validateCnpj, CNPJ_INVALID_ERROR }
