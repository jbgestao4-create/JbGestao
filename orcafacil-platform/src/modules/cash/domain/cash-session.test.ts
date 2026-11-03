import { describe, expect, it } from 'vitest'
import {
  calculateExpectedMoney,
  reconcileCash,
  validateSessionClosure,
  toCents,
  toMoneyString,
} from './cash-session'

describe('cash-session domain calculations', () => {
  it('converts monetary values to cents accurately', () => {
    expect(toCents('150.50')).toBe(15050)
    expect(toCents('0.00')).toBe(0)
    expect(toCents('1234,56')).toBe(123456)
    expect(toCents(99.99)).toBe(9999)
  })

  it('formats cents to standard decimal string', () => {
    expect(toMoneyString(15050)).toBe('150.50')
    expect(toMoneyString(0)).toBe('0.00')
    expect(toMoneyString(5)).toBe('0.05')
  })

  it('calculates expected money correctly with sales, supplies, and withdrawals', () => {
    // Saldo inicial 100 + Vendas 350 + Suprimento 50 - Sangria 80 - Estorno 20 = 400
    const result = calculateExpectedMoney({
      openingBalance: '100.00',
      totalMoney: '350.00',
      totalAdditionalEntries: '50.00',
      totalWithdrawals: '80.00',
      totalCancellations: '20.00',
    })

    expect(result.cents).toBe(40000)
    expect(result.formatted).toBe('400.00')
  })

  it('reconciles balanced cash correctly', () => {
    const reconciliation = reconcileCash('400.00', '400.00')
    expect(reconciliation.isBalanced).toBe(true)
    expect(reconciliation.discrepancyType).toBe('correct')
    expect(reconciliation.difference).toBe(0)
    expect(reconciliation.requiresJustification).toBe(false)
  })

  it('detects cash shortage (falta de caixa)', () => {
    // Físico 380 vs Esperado 400 = Falta de 20
    const reconciliation = reconcileCash('380.00', '400.00')
    expect(reconciliation.isBalanced).toBe(false)
    expect(reconciliation.discrepancyType).toBe('shortage')
    expect(reconciliation.difference).toBe(-20)
    expect(reconciliation.formattedDifference).toBe('20.00')
    expect(reconciliation.requiresJustification).toBe(true)
  })

  it('detects cash surplus (sobra de caixa)', () => {
    // Físico 415.50 vs Esperado 400 = Sobra de 15.50
    const reconciliation = reconcileCash('415.50', '400.00')
    expect(reconciliation.isBalanced).toBe(false)
    expect(reconciliation.discrepancyType).toBe('surplus')
    expect(reconciliation.difference).toBe(15.5)
    expect(reconciliation.formattedDifference).toBe('15.50')
    expect(reconciliation.requiresJustification).toBe(true)
  })

  it('validates session closure requiring justification when divergent', () => {
    // Sem justificativa -> falha
    const invalidClosure = validateSessionClosure({
      countedMoney: '350.00',
      expectedMoney: '400.00',
      justification: '',
    })
    expect(invalidClosure.valid).toBe(false)
    expect(invalidClosure.error).toContain('justificativa')

    // Com justificativa -> sucesso
    const validClosure = validateSessionClosure({
      countedMoney: '350.00',
      expectedMoney: '400.00',
      justification: 'Falta de troco autorizada pelo gerente de turno',
    })
    expect(validClosure.valid).toBe(true)

    // Caixa correto sem justificativa -> sucesso
    const balancedClosure = validateSessionClosure({
      countedMoney: '400.00',
      expectedMoney: '400.00',
    })
    expect(balancedClosure.valid).toBe(true)
  })
})

