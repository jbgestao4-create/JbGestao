import { describe, it, expect } from 'vitest'
import { recalculateQuote } from './quote-calculations'

describe('Quote Calculations Domain', () => {
  it('deve recalcular itens, subtotal e total com desconto', () => {
    const rawItems = [
      { description: 'Pintura de Fachada', quantity: '2.0000', unitPrice: '150.00' },
      { description: 'Tinta Acrílica Premium (Lata 18L)', quantity: '3.0000', unitPrice: '220.00' },
    ]

    const result = recalculateQuote(rawItems, '60.00')

    // Item 1: 2 * 150 = 300.00
    expect(result.items[0].total).toBe('300.00')
    // Item 2: 3 * 220 = 660.00
    expect(result.items[1].total).toBe('660.00')

    // Subtotal: 300 + 660 = 960.00
    expect(result.subtotal).toBe('960.00')
    // Desconto: 60.00
    expect(result.discount).toBe('60.00')
    // Total: 960 - 60 = 900.00
    expect(result.total).toBe('900.00')
  })

  it('deve garantir que o total nunca seja negativo com desconto excessivo', () => {
    const rawItems = [{ description: 'Consulta técnica', quantity: '1.0000', unitPrice: '100.00' }]
    const result = recalculateQuote(rawItems, '200.00')

    expect(result.subtotal).toBe('100.00')
    expect(result.total).toBe('0.00')
  })
})

