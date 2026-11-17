import { describe, it, expect } from 'vitest'
import { calculateCompanyLicenseStatus } from './license.utils'

describe('calculateCompanyLicenseStatus', () => {
  it('deve retornar status ilimitado quando trialEndsAt for nulo ou indefinido', () => {
    const res1 = calculateCompanyLicenseStatus(null)
    expect(res1.status).toBe('unlimited')
    expect(res1.isBlockedByOverdue).toBe(false)
    expect(res1.badgeVariant).toBe('unlimited')

    const res2 = calculateCompanyLicenseStatus(undefined)
    expect(res2.status).toBe('unlimited')
    expect(res2.isBlockedByOverdue).toBe(false)
  })

  it('deve retornar licença ativa quando a validade for futura', () => {
    const future = new Date()
    future.setDate(future.getDate() + 25)
    const res = calculateCompanyLicenseStatus(future.toISOString())

    expect(res.status).toBe('active')
    expect(res.daysRemaining).toBeGreaterThanOrEqual(24)
    expect(res.isBlockedByOverdue).toBe(false)
    expect(res.badgeVariant).toBe('active')
    expect(res.badgeText).toContain('dias restantes')
  })

  it('deve retornar período de carência nos primeiros 5 dias de atraso', () => {
    const past2Days = new Date()
    past2Days.setDate(past2Days.getDate() - 2)
    const res = calculateCompanyLicenseStatus(past2Days.toISOString())

    expect(res.status).toBe('grace_period')
    expect(res.daysRemaining).toBe(0)
    expect(res.isBlockedByOverdue).toBe(false)
    expect(res.badgeVariant).toBe('grace')
    expect(res.badgeText).toContain('Carência')
    expect(res.graceDaysRemaining).toBeLessThanOrEqual(4)
  })

  it('deve retornar bloqueado por inadimplência após mais de 5 dias de atraso', () => {
    const past7Days = new Date()
    past7Days.setDate(past7Days.getDate() - 7)
    const res = calculateCompanyLicenseStatus(past7Days.toISOString())

    expect(res.status).toBe('blocked_overdue')
    expect(res.daysRemaining).toBe(0)
    expect(res.isBlockedByOverdue).toBe(true)
    expect(res.badgeVariant).toBe('blocked')
    expect(res.badgeText).toBe('Bloqueado por Inadimplência')
  })
})
