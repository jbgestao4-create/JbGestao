export type CashSessionStatus = 'open' | 'closed'
export type DiscrepancyType = 'correct' | 'surplus' | 'shortage'

export interface CashRegister {
  id: string
  organizationId: string
  name: string // ex: "Caixa 01", "Caixa 02", "Balcão"
  description?: string | null
  isActive: boolean
  createdAt: string
}

export interface CashSessionMovement {
  id: string
  sessionId: string
  type: 'supply' | 'bleed' // supply = suprimento (entrada), bleed = sangria (retirada)
  amount: string
  reason: string
  createdBy?: string | null
  createdAt: string
}

export interface CashSession {
  id: string
  organizationId: string
  registerId: string // ex: "Caixa 01"
  openedBy: string
  closedBy?: string | null
  operatorName: string
  status: CashSessionStatus
  openingBalance: string // Saldo inicial / fundo de troco
  openedAt: string
  closedAt?: string | null

  // Totais financeiros acumulados da sessão
  totalSales: string
  totalMoney: string
  totalPix: string
  totalCreditCard: string
  totalDebitCard: string
  totalAdditionalEntries: string // Suprimentos
  totalWithdrawals: string // Sangrias
  totalCancellations: string // Cancelamentos / estornos

  // Conferência e fechamento
  expectedMoney: string
  countedMoney?: string | null
  difference?: string | null
  conferenceAttempts: number
  discrepancyJustification?: string | null
  supervisorAuthorizedBy?: string | null

  salesCount: number
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface CashReconciliationResult {
  expectedMoney: number
  countedMoney: number
  difference: number
  discrepancyType: DiscrepancyType
  formattedDifference: string
  isBalanced: boolean
  requiresJustification: boolean
}

/**
 * Converte valor monetário em centavos inteiros para evitar problemas de ponto flutuante
 */
export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const parsed = typeof value === 'number' ? value : parseFloat(value.toString().replace(',', '.'))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

/**
 * Converte centavos inteiros de volta para número decimal de 2 casas
 */
export function fromCents(cents: number): number {
  return cents / 100
}

/**
 * Formata um valor numérico para string decimal padrão (ex: "150.00")
 */
export function toMoneyString(cents: number): string {
  return (cents / 100).toFixed(2)
}

/**
 * Calcula o saldo esperado em dinheiro para o caixa da sessão:
 * Saldo esperado = Saldo inicial + Recebimentos em dinheiro + Suprimentos - Sangrias - Estornos em dinheiro
 */
export function calculateExpectedMoney(params: {
  openingBalance: string | number
  totalMoney: string | number
  totalAdditionalEntries: string | number
  totalWithdrawals: string | number
  totalCancellations?: string | number
}): { cents: number; formatted: string } {
  const opening = toCents(params.openingBalance)
  const money = toCents(params.totalMoney)
  const supplies = toCents(params.totalAdditionalEntries)
  const withdrawals = toCents(params.totalWithdrawals)
  const cancellations = toCents(params.totalCancellations)

  const expectedCents = opening + money + supplies - withdrawals - cancellations
  const safeExpectedCents = Math.max(0, expectedCents)

  return {
    cents: safeExpectedCents,
    formatted: toMoneyString(safeExpectedCents),
  }
}

/**
 * Realiza a conferência entre o valor físico contado pelo operador e o esperado pelo sistema
 */
export function reconcileCash(
  countedValue: string | number,
  expectedValue: string | number,
): CashReconciliationResult {
  const countedCents = toCents(countedValue)
  const expectedCents = toCents(expectedValue)
  const diffCents = countedCents - expectedCents

  let discrepancyType: DiscrepancyType = 'correct'
  if (diffCents > 0) {
    discrepancyType = 'surplus'
  } else if (diffCents < 0) {
    discrepancyType = 'shortage'
  }

  const diffDecimal = fromCents(diffCents)
  const isBalanced = diffCents === 0

  return {
    expectedMoney: fromCents(expectedCents),
    countedMoney: fromCents(countedCents),
    difference: diffDecimal,
    discrepancyType,
    formattedDifference: toMoneyString(Math.abs(diffCents)),
    isBalanced,
    requiresJustification: !isBalanced,
  }
}

/**
 * Valida os dados de fechamento de caixa
 */
export function validateSessionClosure(params: {
  countedMoney: string | number
  expectedMoney: string | number
  justification?: string | null
  isSupervisorAuthorized?: boolean
}): { valid: boolean; error?: string } {
  const countedCents = toCents(params.countedMoney)
  if (countedCents < 0) {
    return { valid: false, error: 'O valor contado em dinheiro não pode ser negativo.' }
  }

  const reconciliation = reconcileCash(params.countedMoney, params.expectedMoney)
  if (!reconciliation.isBalanced) {
    const justification = params.justification?.trim()
    if (!justification || justification.length < 5) {
      return {
        valid: false,
        error:
          'Existe divergência no fechamento do caixa. Informe uma justificativa detalhada (mínimo de 5 caracteres).',
      }
    }
  }

  return { valid: true }
}
