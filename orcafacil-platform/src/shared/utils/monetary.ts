/**
 * Utilitários para operações monetárias.
 *
 * REGRA: Todos os valores monetários são armazenados como strings decimais
 * no banco (numeric/decimal PostgreSQL) e convertidos apenas para exibição.
 * Nunca use ponto flutuante binário (float/number JS) para persistir dinheiro.
 *
 * Estratégia de arredondamento: HALF_UP com 2 casas decimais.
 * Quantidades: até 4 casas decimais.
 * Valores unitários: até 4 casas decimais.
 * Subtotais e totais: 2 casas decimais.
 */

const MONETARY_DECIMALS = 2
const QUANTITY_DECIMALS = 4
const UNIT_PRICE_DECIMALS = 4

/**
 * Arredonda um número para o número especificado de casas decimais
 * usando a estratégia HALF_UP.
 */
function roundHalfUp(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

/**
 * Multiplica quantidade por valor unitário e retorna o total do item
 * como string decimal com 2 casas decimais.
 *
 * @param quantity - Quantidade (string decimal, ex: "2.5000")
 * @param unitPrice - Valor unitário (string decimal, ex: "100.0000")
 * @returns Total como string decimal (ex: "250.00")
 */
export function calculateItemTotal(quantity: string, unitPrice: string): string {
  const qty = parseFloat(quantity)
  const price = parseFloat(unitPrice)

  if (!isFinite(qty) || !isFinite(price)) {
    return '0.00'
  }

  const total = roundHalfUp(qty * price, MONETARY_DECIMALS)
  return total.toFixed(MONETARY_DECIMALS)
}

/**
 * Soma os totais de uma lista de itens e retorna o subtotal.
 *
 * @param itemTotals - Array de totais de itens (strings decimais)
 * @returns Subtotal como string decimal
 */
export function calculateSubtotal(itemTotals: string[]): string {
  const sum = itemTotals.reduce((acc, total) => {
    const value = parseFloat(total)
    return acc + (isFinite(value) ? value : 0)
  }, 0)

  return roundHalfUp(sum, MONETARY_DECIMALS).toFixed(MONETARY_DECIMALS)
}

/**
 * Aplica desconto e calcula o total final.
 *
 * @param subtotal - Subtotal (string decimal)
 * @param discount - Desconto em valor absoluto (string decimal)
 * @returns Total como string decimal (mínimo "0.00")
 */
export function calculateTotal(subtotal: string, discount: string): string {
  const sub = parseFloat(subtotal)
  const disc = parseFloat(discount)

  if (!isFinite(sub)) return '0.00'
  const discValue = isFinite(disc) ? disc : 0

  const total = Math.max(0, roundHalfUp(sub - discValue, MONETARY_DECIMALS))
  return total.toFixed(MONETARY_DECIMALS)
}

/**
 * Formata um valor monetário para exibição em BRL.
 *
 * @param value - Valor como string decimal ou number
 * @returns Valor formatado (ex: "R$ 1.250,00")
 */
export function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (!isFinite(num)) return 'R$ 0,00'

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * Valida se uma string representa um valor decimal válido para uso monetário.
 */
export function isValidDecimal(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value.trim()) && isFinite(parseFloat(value))
}

/**
 * Normaliza um valor de quantidade para a precisão correta.
 */
export function normalizeQuantity(value: string): string {
  const num = parseFloat(value)
  if (!isFinite(num) || num <= 0) return '1.0000'
  return roundHalfUp(num, QUANTITY_DECIMALS).toFixed(QUANTITY_DECIMALS)
}

/**
 * Normaliza um valor unitário para a precisão correta.
 */
export function normalizeUnitPrice(value: string): string {
  const num = parseFloat(value)
  if (!isFinite(num) || num < 0) return '0.0000'
  return roundHalfUp(num, UNIT_PRICE_DECIMALS).toFixed(UNIT_PRICE_DECIMALS)
}
