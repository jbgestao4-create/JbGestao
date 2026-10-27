import { calculateItemTotal, calculateSubtotal, calculateTotal } from '@shared/utils/monetary'

export interface QuoteItemCalculationInput {
  description: string
  quantity: string
  unitPrice: string
}

export interface QuoteCalculatedItem extends QuoteItemCalculationInput {
  total: string
  sortOrder: number
}

export interface QuoteCalculationResult {
  items: QuoteCalculatedItem[]
  subtotal: string
  discount: string
  total: string
}

/**
 * Calcula e revalida confiavelmente os totais do orçamento.
 * NUNCA confia nos valores de total calculados ou enviados pelo navegador.
 */
export function recalculateQuote(
  rawItems: QuoteItemCalculationInput[],
  rawDiscount: string = '0.00',
): QuoteCalculationResult {
  const items: QuoteCalculatedItem[] = rawItems.map((item, index) => {
    const itemTotal = calculateItemTotal(item.quantity, item.unitPrice)
    return {
      description: item.description.trim(),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: itemTotal,
      sortOrder: index,
    }
  })

  const itemTotals = items.map((i) => i.total)
  const subtotal = calculateSubtotal(itemTotals)
  const total = calculateTotal(subtotal, rawDiscount)

  return {
    items,
    subtotal,
    discount: rawDiscount,
    total,
  }
}

