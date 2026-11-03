/**
 * Máscara de dinheiro estilo "caixa": os dígitos entram pela direita e o valor
 * sempre mantém duas casas decimais (ex.: digitar 1, 2, 3, 4 resulta em 12,34).
 * O valor interno é uma string decimal com ponto (ex.: "12.34"), ou '' quando zerado.
 */

const MAX_MONEY_DIGITS = 12

/** Converte o texto digitado (apenas dígitos importam) na string decimal "0.00". */
export function moneyDigitsToDecimal(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_MONEY_DIGITS)
  if (digits === '') return ''
  const padded = digits.padStart(3, '0')
  return `${padded.slice(0, -2)}.${padded.slice(-2)}`
}

/** Converte a string decimal (ex.: "1234.5" ou "1234.50") em texto exibido (ex.: "1.234,50"). */
export function decimalToMoneyDisplay(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const num = typeof value === 'number' ? value : parseFloat(value)
  if (!isFinite(num)) return ''
  const cents = Math.round(num * 100)
  if (cents <= 0) return '0,00'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

