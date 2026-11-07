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

  it('does not open a session when the remote cash-session table is unavailable', async () => {
    const res = await cashSessionService.openSession(orgId, {
      registerId: 'Caixa 01',
      operatorId: 'user-op-1',
      operatorName: 'Operador Carlos',
      openingBalance: '100.00',
    })

    expect(res).toEqual({
      success: false,
      error: 'Não foi possível consultar o Caixa Geral.',
    })
    expect(localStorage.length).toBe(0)
  })

  it('does not record sales against a session missing from Supabase', async () => {
    const result = await cashSessionService.recordSaleInSession(orgId, 'remote-session', {
      total: '120.00',
      paymentMethod: 'money',
    })

    expect(result).toEqual({
      success: false,
      error: 'Sessão de caixa não encontrada ou já encerrada.',
    })
  })

  it('does not record movements against a session missing from Supabase', async () => {
    const result = await cashSessionService.recordMovement(orgId, 'remote-session', {
      type: 'supply',
      amount: '50.00',
      reason: 'Reforço de troco',
    })

    expect(result.success).toBe(false)
  })

  it('does not close a session that cannot be fetched from Supabase', async () => {
    const result = await cashSessionService.closeSession(orgId, 'remote-session', {
      countedMoney: '100.00',
      closedBy: 'user-op-1',
    })

    expect(result).toEqual({
      success: false,
      error: 'Sessão de caixa não encontrada ou já encerrada.',
    })
  })

  it('fails gracefully when querying last closed session and table is unavailable', async () => {
    const result = await cashSessionService.getLastClosedSession(orgId, 'cash_management')
    expect(result.success).toBe(false)
  })

  it('blocks opening PDV session when Caixa Geral is not open', async () => {
    vi.spyOn(cashSessionService, 'getOpenCashManagementSession').mockResolvedValueOnce({
      success: true,
      data: null,
    })

    const res = await cashSessionService.openSession(orgId, {
      registerId: 'Caixa 01',
      sessionType: 'pdv',
      operatorId: 'user-op-1',
      operatorName: 'Operador Carlos',
      openingBalance: '100.00',
    })

    expect(res).toEqual({
      success: false,
      error: 'Caixa Geral ainda não aberto, procure o seu administrador',
    })
  })
})
