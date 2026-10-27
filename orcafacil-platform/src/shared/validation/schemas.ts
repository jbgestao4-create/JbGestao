import { z } from 'zod'

/**
 * Schemas de validação compartilhados entre módulos.
 * Usados nas fronteiras da aplicação (formulários, API responses).
 */

/** UUID válido */
export const uuidSchema = z.string().uuid('ID inválido')

/** E-mail com tamanho máximo razoável */
export const emailSchema = z
  .string()
  .min(1, 'E-mail é obrigatório')
  .email('Formato de e-mail inválido')
  .max(254, 'E-mail muito longo')
  .toLowerCase()

/** Senha com requisitos mínimos de segurança */
export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter no mínimo 8 caracteres')
  .max(128, 'A senha não pode ter mais de 128 caracteres')

/** Nome de organização */
export const organizationNameSchema = z
  .string()
  .min(2, 'O nome deve ter no mínimo 2 caracteres')
  .max(100, 'O nome não pode ter mais de 100 caracteres')
  .trim()

/** Slug de organização: apenas letras minúsculas, números e hífens */
export const organizationSlugSchema = z
  .string()
  .min(2, 'O slug deve ter no mínimo 2 caracteres')
  .max(50, 'O slug não pode ter mais de 50 caracteres')
  .regex(/^[a-z0-9-]+$/, 'O slug deve conter apenas letras minúsculas, números e hífens')
  .trim()

/** Nome de pessoa ou entidade */
export const displayNameSchema = z
  .string()
  .min(2, 'O nome deve ter no mínimo 2 caracteres')
  .max(100, 'O nome não pode ter mais de 100 caracteres')
  .trim()

/** Valor decimal monetário como string */
export const decimalStringSchema = z.string().regex(/^\d+(\.\d{1,4})?$/, 'Valor decimal inválido')

/** Quantidade com até 4 casas decimais */
export const quantitySchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'Quantidade inválida')
  .refine((v) => parseFloat(v) > 0, 'A quantidade deve ser maior que zero')

/** Valor unitário com até 4 casas decimais */
export const unitPriceSchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'Valor unitário inválido')
  .refine((v) => parseFloat(v) >= 0, 'O valor não pode ser negativo')

/** Telefone brasileiro (aceita formatos variados) */
export const phoneSchema = z.string().max(20, 'Telefone muito longo').optional().nullable()

/** Endereço textual */
export const addressSchema = z.string().max(500, 'Endereço muito longo').optional().nullable()
