import { describe, it, expect } from 'vitest'
import { calculateCompanyLicenseStatus, calculateNewLicenseExpiry } from './license.utils'

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

describe('calculateNewLicenseExpiry', () => {
  it('deve aumentar dias corretamente para uma empresa ativa', () => {
    const future = new Date()
    future.setDate(future.getDate() + 20)

    const res = calculateNewLicenseExpiry(future.toISOString(), 'increase', 10)
    expect(res.newRemainingDays).toBeGreaterThanOrEqual(29)
    expect(new Date(res.newExpiryIso).getTime()).toBeGreaterThan(future.getTime())
  })

  it('deve diminuir dias corretamente sem ficar negativo', () => {
    const future = new Date()
    future.setDate(future.getDate() + 20)

    const res = calculateNewLicenseExpiry(future.toISOString(), 'decrease', 5)
    expect(res.newRemainingDays).toBeLessThanOrEqual(16)
    expect(res.newRemainingDays).toBeGreaterThanOrEqual(14)

    // Diminuindo mais que o saldo disponível
    const resZero = calculateNewLicenseExpiry(future.toISOString(), 'decrease', 50)
    expect(resZero.newRemainingDays).toBe(0)
    expect(new Date(resZero.newExpiryIso).getTime()).toBeLessThan(Date.now())
  })

  it('deve adicionar dias a partir de hoje para empresa vencida ou sem data', () => {
    const resNull = calculateNewLicenseExpiry(null, 'increase', 30)
    expect(resNull.newRemainingDays).toBe(30)
    expect(resNull.previousRemainingDays).toBe(0)

    const past = new Date()
    past.setDate(past.getDate() - 10)
    const resPast = calculateNewLicenseExpiry(past.toISOString(), 'increase', 15)
    expect(resPast.newRemainingDays).toBe(15)
  })

  it('deve zerar licença e bloquear imediatamente com actionType reset_block', () => {
    const future = new Date()
    future.setDate(future.getDate() + 30)

    const res = calculateNewLicenseExpiry(future.toISOString(), 'reset_block', 0)
    expect(res.newRemainingDays).toBe(0)
    expect(res.newGraceDaysRemaining).toBe(0)
    expect(res.isBlocked).toBe(true)
    expect(res.statusBadge).toBe('Bloqueado por Inadimplência')
    expect(res.daysDelta).toBe(-999)
    expect(new Date(res.newExpiryIso).getTime()).toBeLessThan(Date.now() - 5 * 24 * 60 * 60 * 1000)
  })

  it('deve permitir diminuir dias durante a carência de 5 dias até bloquear o acesso', () => {
    // Empresa vencida há 2 dias (estava na carência com 3 dias restantes de tolerância)
    const past2Days = new Date()
    past2Days.setDate(past2Days.getDate() - 2)

    // Reduzir mais 4 dias: atraso vai para 6 dias (> 5 dias), devendo bloquear totalmente
    const res = calculateNewLicenseExpiry(past2Days.toISOString(), 'decrease', 4)
    expect(res.newRemainingDays).toBe(0)
    expect(res.newGraceDaysRemaining).toBe(0)
    expect(res.isBlocked).toBe(true)
    expect(res.statusBadge).toBe('Bloqueado por Inadimplência')
  })
})
