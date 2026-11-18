export {
  formatCustomerDocument,
  validateCustomerDocument,
  validateCpf,
  validateCnpj,
  validateCnpjNumeric,
  validateCnpjAlphanumeric,
  calculateCpfCheckDigits,
  calculateCnpjNumericCheckDigits,
  calculateCnpjAlphanumericCheckDigits,
  sanitizeCustomerDocument,
  sanitizeCpf,
  sanitizeCnpj,
  customerDocumentValidatorService,
  CPF_INVALID_ERROR,
  CNPJ_INVALID_ERROR,
} from '../services/document-validator.service'
export type { DocumentValidationResult, CheckDigitsResult } from '../services/document-validator.service'
