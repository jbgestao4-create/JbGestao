export type CashDirection = 'income' | 'expense'
export type CashStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled'

export interface CashPayment {
  id: string
  accountId: string
  amount: string
  paymentMethod: string
  paidAt: string
  availableAt: string
}

export interface CashEntry {
  id: string
  organizationId: string
  direction: CashDirection
  description: string
  amount: string
  category: string
  dueDate: string | null
  customerId: string | null
  customerName: string | null
  supplierId: string | null
  supplierName: string | null
  quoteId: string | null
  quoteNumber: string | null
  inventoryMovementId: string | null
  notes: string | null
  canceledAt: string | null
  createdAt: string
  payments: CashPayment[]
}

export interface CashAccount {
  id: string
  name: string
  accountType: 'cash' | 'bank' | 'digital' | 'other'
  openingBalance: string
  isActive: boolean
}

export interface CashPeriod {
  start: string
  end: string
}

export interface CashSummary {
  availableBalance: number
  periodIncome: number
  periodExpense: number
  receivable: number
  payable: number
  periodResult: number
  inventoryCost: number
  inventorySaleValue: number
  inventoryEstimatedDifference: number
}

function amountInCents(value: string | number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

function amountFromCents(value: number): number {
  return value / 100
}

export function getPaidAmount(entry: CashEntry): number {
  return amountFromCents(
    entry.payments.reduce((total, payment) => total + amountInCents(payment.amount), 0),
  )
}

export function getPendingAmount(entry: CashEntry): number {
  if (entry.canceledAt) return 0
  return Math.max(0, Number(entry.amount) - getPaidAmount(entry))
}

export function getCashEntryStatus(entry: CashEntry, today = new Date()): CashStatus {
  if (entry.canceledAt) return 'cancelled'
  const pending = getPendingAmount(entry)
  if (pending === 0) return 'paid'
  if (entry.dueDate && entry.dueDate < formatLocalDate(today)) return 'overdue'
  return getPaidAmount(entry) > 0 ? 'partial' : 'pending'
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${String(year)}-${month}-${day}`
}

export function getCashSummary(
  accounts: CashAccount[],
  entries: CashEntry[],
  period: CashPeriod,
  inventory: { quantityOnHand: string; averageCost: string; unitPrice: string }[],
  today = formatLocalDate(new Date()),
): CashSummary {
  let availableBalanceCents = accounts.reduce(
    (total, account) => total + amountInCents(account.openingBalance),
    0,
  )
  let periodIncomeCents = 0
  let periodExpenseCents = 0
  let receivableCents = 0
  let payableCents = 0

  for (const entry of entries) {
    if (entry.canceledAt) continue
    const paid = entry.payments.reduce((total, payment) => {
      const cents = amountInCents(payment.amount)
      if (payment.availableAt <= today) {
        availableBalanceCents += entry.direction === 'income' ? cents : -cents
      }
      if (payment.paidAt >= period.start && payment.paidAt <= period.end) {
        if (entry.direction === 'income') periodIncomeCents += cents
        else periodExpenseCents += cents
      }
      return total + cents
    }, 0)
    const pending = Math.max(0, amountInCents(entry.amount) - paid)
    if (entry.direction === 'income') receivableCents += pending
    else payableCents += pending
  }

  const inventoryCostCents = inventory.reduce(
    (total, item) => total + Math.round(Number(item.quantityOnHand) * Number(item.averageCost) * 100),
    0,
  )
  const inventorySaleValueCents = inventory.reduce(
    (total, item) => total + Math.round(Number(item.quantityOnHand) * Number(item.unitPrice) * 100),
    0,
  )

  return {
    availableBalance: amountFromCents(availableBalanceCents),
    periodIncome: amountFromCents(periodIncomeCents),
    periodExpense: amountFromCents(periodExpenseCents),
    receivable: amountFromCents(receivableCents),
    payable: amountFromCents(payableCents),
    periodResult: amountFromCents(periodIncomeCents - periodExpenseCents),
    inventoryCost: amountFromCents(inventoryCostCents),
    inventorySaleValue: amountFromCents(inventorySaleValueCents),
    inventoryEstimatedDifference: amountFromCents(inventorySaleValueCents - inventoryCostCents),
  }
}

export function getCashPeriod(period: string, now = new Date()): CashPeriod {
  const today = formatLocalDate(now)
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const firstOfYear = new Date(now.getFullYear(), 0, 1)
  const format = formatLocalDate

  switch (period) {
    case 'yesterday':
      return { start: format(yesterday), end: format(yesterday) }
    case 'last7':
      return {
        start: format(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)),
        end: today,
      }
    case 'last30':
      return {
        start: format(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)),
        end: today,
      }
    case 'thisMonth':
      return { start: format(firstOfMonth), end: today }
    case 'lastMonth':
      return { start: format(firstOfLastMonth), end: format(lastOfLastMonth) }
    case 'thisYear':
      return { start: format(firstOfYear), end: today }
    case 'today':
    default:
      return { start: today, end: today }
  }
}
