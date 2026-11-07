export type CashSessionStatus = 'open' | 'closed'
export type CashSessionType = 'pdv' | 'cash_management'
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
  category?: string | null // ex: "Troco", "Sangria", "Pagamento de Boleto", "Pagamento Fornecedor"
  referenceId?: string | null
  attachmentUrl?: string | null
  attachmentName?: string | null
  moveToAccount?: boolean
  operatorName?: string | null
  createdBy?: string | null
  createdAt: string
}

export interface CashSession {
  id: string
  organizationId: string
  registerId: string
  registerName?: string | null
  operatorId?: string | null // ex: "Caixa 01"
  openedBy: string
  closedBy?: string | null
  operatorName: string
  status: CashSessionStatus
  sessionType?: CashSessionType
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
  totalBillPayments?: string // Baixas de boletos/fornecedores no caixa

  // Conferência e fechamento
  expectedMoney: string
  countedMoney?: string | null
  countedPix?: string | null
  countedCreditCard?: string | null
  countedDebitCard?: string | null
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
  expected: number
  counted: number
  difference: number
  discrepancyType: DiscrepancyType
  formattedDifference: string
  isBalanced: boolean
  requiresJustification: boolean
}

export interface FullSessionReconciliation {
  money: CashReconciliationResult
  pix: CashReconciliationResult
  creditCard: CashReconciliationResult
  debitCard: CashReconciliationResult
  expectedTotal: number
  countedTotal: number
  totalDifference: number
  formattedTotalDifference: string
  isFullyBalanced: boolean
  hasDiscrepancy: boolean
  requiresJustification: boolean
  totals: {
    expected: number
    counted: number
    difference: number
    totalExpected: number
    totalCounted: number
    totalDifference: number
    formattedDifference: string
  }
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
    expected: fromCents(expectedCents),
    counted: fromCents(countedCents),
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
 * Realiza a conferência completa de todos os meios de pagamento (Espécie, PIX, Cartão de Crédito e Débito)
 */
export function reconcileFullSession(
  param1: {
    expectedMoney?: string | number
    countedMoney?: string | number | null
    expectedPix?: string | number
    countedPix?: string | number
    expectedCreditCard?: string | number
    countedCreditCard?: string | number
    expectedDebitCard?: string | number
    countedDebitCard?: string | number
    totalMoney?: string
    totalPix?: string
    totalCreditCard?: string
    totalDebitCard?: string
  },
  param2?: {
    countedMoney?: string | number | null
    countedPix?: string | number
    countedCreditCard?: string | number
    countedDebitCard?: string | number
  }
): FullSessionReconciliation {
  const expMoney = param2 ? (param1.expectedMoney ?? param1.totalMoney ?? 0) : (param1.expectedMoney ?? 0)
  const expPix = param2 ? (param1.expectedPix ?? param1.totalPix ?? 0) : (param1.expectedPix ?? 0)
  const expCredit = param2 ? (param1.expectedCreditCard ?? param1.totalCreditCard ?? 0) : (param1.expectedCreditCard ?? 0)
  const expDebit = param2 ? (param1.expectedDebitCard ?? param1.totalDebitCard ?? 0) : (param1.expectedDebitCard ?? 0)

  const cntMoney = param2 ? (param2.countedMoney ?? 0) : (param1.countedMoney ?? 0)
  const cntPix = param2 ? param2.countedPix : param1.countedPix
  const cntCredit = param2 ? param2.countedCreditCard : param1.countedCreditCard
  const cntDebit = param2 ? param2.countedDebitCard : param1.countedDebitCard

  const money = reconcileCash(cntMoney, expMoney)
  const pix = reconcileCash(
    cntPix !== undefined && cntPix !== '' ? cntPix : expPix,
    expPix,
  )
  const creditCard = reconcileCash(
    cntCredit !== undefined && cntCredit !== ''
      ? cntCredit
      : expCredit,
    expCredit,
  )
  const debitCard = reconcileCash(
    cntDebit !== undefined && cntDebit !== ''
      ? cntDebit
      : expDebit,
    expDebit,
  )

  const expectedTotalCents =
    toCents(expMoney) +
    toCents(expPix) +
    toCents(expCredit) +
    toCents(expDebit)

  const countedTotalCents =
    toCents(money.countedMoney) +
    toCents(pix.countedMoney) +
    toCents(creditCard.countedMoney) +
    toCents(debitCard.countedMoney)

  const totalDiffCents = countedTotalCents - expectedTotalCents
  const isFullyBalanced =
    money.isBalanced && pix.isBalanced && creditCard.isBalanced && debitCard.isBalanced

  const expTotal = fromCents(expectedTotalCents)
  const cntTotal = fromCents(countedTotalCents)
  const totDiff = fromCents(totalDiffCents)

  return {
    money,
    pix,
    creditCard,
    debitCard,
    expectedTotal: expTotal,
    countedTotal: cntTotal,
    totalDifference: totDiff,
    formattedTotalDifference: toMoneyString(Math.abs(totalDiffCents)),
    isFullyBalanced,
    hasDiscrepancy: !isFullyBalanced,
    requiresJustification: !isFullyBalanced,
    totals: {
      expected: expTotal,
      counted: cntTotal,
      difference: totDiff,
      totalExpected: expTotal,
      totalCounted: cntTotal,
      totalDifference: totDiff,
      formattedDifference: toMoneyString(Math.abs(totalDiffCents)),
    },
  }
}

/**
 * Valida os dados de fechamento de caixa (espécie e opcionalmente cartões/PIX)
 */
export function validateSessionClosure(
  param1: {
    expectedMoney?: string | number
    countedMoney?: string | number | null
    expectedPix?: string | number
    countedPix?: string | number
    expectedCreditCard?: string | number
    countedCreditCard?: string | number
    expectedDebitCard?: string | number
    countedDebitCard?: string | number
    justification?: string | null
    isSupervisorAuthorized?: boolean
    totalMoney?: string
    totalPix?: string
    totalCreditCard?: string
    totalDebitCard?: string
  },
  param2?: {
    countedMoney?: string | number | null
    countedPix?: string | number
    countedCreditCard?: string | number
    countedDebitCard?: string | number
    closureReason?: string | null
    justification?: string | null
  }
): { valid: boolean; isValid: boolean; error?: string; errors?: string[] } {
  const cntMoney = param2 ? param2.countedMoney : param1.countedMoney
  const countedCents = toCents(cntMoney)
  if (countedCents < 0) {
    const err = 'O valor contado em dinheiro não pode ser negativo.'; return { valid: false, isValid: false, error: err, errors: [err] }
  }

  const fullRec = reconcileFullSession(param1, param2)

  if (!fullRec.isFullyBalanced) {
    const justification = (param2 ? (param2.closureReason || param2.justification) : param1.justification)?.trim()
    if (!justification || justification.length < 5) {
      const err = 'Existe divergência nos valores declarados em relação ao sistema. Informe uma justificativa detalhada (mínimo de 5 caracteres).'; return { valid: false, isValid: false, error: err, errors: [err] }
    }
  }

  return { valid: true, isValid: true, errors: [] }
}
