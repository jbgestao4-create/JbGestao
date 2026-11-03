import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cashSessionService } from './cash-session.service'

vi.mock('@app/config/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: { code: 'PGRST205' } }),
            }),
            order: () => Promise.resolve({ data: null, error: { code: 'PGRST205' } }),
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: { code: 'PGRST205' } }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
  },
}))

describe('cashSessionService', () => {
  const orgId = 'test-org-123'

  beforeEach(() => {
    localStorage.clear()
  })

  it('opens a new cash session with opening balance and prevents concurrent opening by another operator', async () => {
    // 1. Abre sessão para Operador 1
    const res = await cashSessionService.openSession(orgId, {
      registerId: 'Caixa 01',
      operatorId: 'user-op-1',
      operatorName: 'Operador Carlos',
      openingBalance: '100.00',
    })

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.status).toBe('open')
    expect(res.data.openingBalance).toBe('100.00')
    expect(res.data.expectedMoney).toBe('100.00')
    expect(res.data.operatorName).toBe('Operador Carlos')

    // 2. Operador 2 tenta abrir o mesmo caixa sem fechamento do anterior
    const blockedRes = await cashSessionService.openSession(orgId, {
      registerId: 'Caixa 01',
      operatorId: 'user-op-2',
      operatorName: 'Operadora Mariana',
      openingBalance: '50.00',
    })

    expect(blockedRes.success).toBe(false)
    if (!blockedRes.success) {
      expect(blockedRes.error).toContain('já está aberto pelo operador "Operador Carlos"')
    }
  })

  it('accumulates sales by payment methods and recalculates expected cash', async () => {
    const openRes = await cashSessionService.openSession(orgId, {
      registerId: 'Caixa 01',
      operatorId: 'user-op-1',
      operatorName: 'Carlos',
      openingBalance: '50.00',
    })
    expect(openRes.success).toBe(true)
    if (!openRes.success) return
    const sessionId = openRes.data.id

    // Venda 1: Dinheiro R$ 120.00
    await cashSessionService.recordSaleInSession(orgId, sessionId, {
      total: '120.00',
      paymentMethod: 'money',
      amountReceived: '150.00',
    })

    // Venda 2: PIX R$ 80.50
    await cashSessionService.recordSaleInSession(orgId, sessionId, {
      total: '80.50',
      paymentMethod: 'pix',
    })

    // Venda 3: Cartão de Crédito R$ 200.00
    await cashSessionService.recordSaleInSession(orgId, sessionId, {
      total: '200.00',
      paymentMethod: 'credit_card',
    })

    // Venda 4: Cartão de Débito R$ 50.00
    const finalSale = await cashSessionService.recordSaleInSession(orgId, sessionId, {
      total: '50.00',
      paymentMethod: 'debit_card',
    })

    expect(finalSale.success).toBe(true)
    if (!finalSale.success) return

    expect(finalSale.data.salesCount).toBe(4)
    expect(finalSale.data.totalSales).toBe('450.50')
    expect(finalSale.data.totalMoney).toBe('120.00')
    expect(finalSale.data.totalPix).toBe('80.50')
    expect(finalSale.data.totalCreditCard).toBe('200.00')
    expect(finalSale.data.totalDebitCard).toBe('50.00')
    // Esperado em dinheiro = Saldo inicial (50.00) + Vendas dinheiro (120.00) = 170.00
    expect(finalSale.data.expectedMoney).toBe('170.00')
  })

  it('adjusts expected money with suprimento (supply) and sangria (bleed)', async () => {
    const openRes = await cashSessionService.openSession(orgId, {
      registerId: 'Caixa 01',
      operatorId: 'user-op-1',
      operatorName: 'Carlos',
      openingBalance: '100.00',
    })
    if (!openRes.success) return
    const sessionId = openRes.data.id

    // Suprimento de troco R$ 50.00
    const supplyRes = await cashSessionService.recordMovement(orgId, sessionId, {
      type: 'supply',
      amount: '50.00',
      reason: 'Reforço de moedas e cédulas pequenas',
    })
    expect(supplyRes.success).toBe(true)
    if (!supplyRes.success) return
    // 100 + 50 = 150
    expect(supplyRes.data.expectedMoney).toBe('150.00')

    // Sangria R$ 80.00
    const bleedRes = await cashSessionService.recordMovement(orgId, sessionId, {
      type: 'bleed',
      amount: '80.00',
      reason: 'Recolhimento para o cofre',
    })
    expect(bleedRes.success).toBe(true)
    if (!bleedRes.success) return
    // 150 - 80 = 70
    expect(bleedRes.data.expectedMoney).toBe('70.00')
  })

  it('validates closure, blocks unverified discrepancies without justification, and records closure history', async () => {
    const openRes = await cashSessionService.openSession(orgId, {
      registerId: 'Caixa 01',
      operatorId: 'user-op-1',
      operatorName: 'Carlos',
      openingBalance: '100.00',
    })
    if (!openRes.success) return
    const sessionId = openRes.data.id

    // Venda em dinheiro R$ 100.00 -> Esperado em dinheiro = 200.00
    await cashSessionService.recordSaleInSession(orgId, sessionId, {
      total: '100.00',
      paymentMethod: 'money',
    })

    // Tentativa de fechar informando R$ 180 (Falta de 20) SEM justificativa
    const invalidClose = await cashSessionService.closeSession(orgId, sessionId, {
      countedMoney: '180.00',
      justification: '',
      closedBy: 'user-op-1',
    })
    expect(invalidClose.success).toBe(false)
    if (!invalidClose.success) {
      expect(invalidClose.error).toContain('justificativa')
    }

    // Fechamento informando R$ 180 COM justificativa
    const validClose = await cashSessionService.closeSession(orgId, sessionId, {
      countedMoney: '180.00',
      justification: 'Falta autorizada por erro de troco da manhã',
      supervisorAuth: 'Gerente Roberto',
      closedBy: 'user-op-1',
    })
    expect(validClose.success).toBe(true)
    if (!validClose.success) return
    expect(validClose.data.status).toBe('closed')
    expect(validClose.data.difference).toBe('20.00')
    expect(validClose.data.discrepancyJustification).toBe(
      'Falta autorizada por erro de troco da manhã',
    )

    // Após fechamento, o caixa está liberado para o próximo operador!
    const nextOperatorOpen = await cashSessionService.openSession(orgId, {
      registerId: 'Caixa 01',
      operatorId: 'user-op-2',
      operatorName: 'Mariana',
      openingBalance: '100.00',
    })
    expect(nextOperatorOpen.success).toBe(true)
    if (!nextOperatorOpen.success) return
    expect(nextOperatorOpen.data.operatorName).toBe('Mariana')
  })
})
