import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  organizationBillingService,
  isOrganizationInTrial,
  getDiffDaysFromToday,
} from './organization-billing.service'
import { contractService } from '@modules/companies/services/contract.service'

describe('organizationBillingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  describe('isOrganizationInTrial', () => {
    it('deve retornar true quando o período de teste estiver no futuro', () => {
      const future = new Date()
      future.setDate(future.getDate() + 10)
      expect(isOrganizationInTrial(future.toISOString())).toBe(true)
    })

    it('deve retornar false quando não houver data de teste informada', () => {
      expect(isOrganizationInTrial(null)).toBe(false)
      expect(isOrganizationInTrial(undefined)).toBe(false)
      expect(isOrganizationInTrial('')).toBe(false)
    })

    it('deve retornar false quando o período de teste já tiver expirado', () => {
      const past = new Date()
      past.setDate(past.getDate() - 2)
      expect(isOrganizationInTrial(past.toISOString())).toBe(false)
    })
  })

  describe('getDiffDaysFromToday', () => {
    it('deve retornar 0 para o dia de hoje', () => {
      const today = new Date()
      const yyyy = today.getFullYear()
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      const dd = String(today.getDate()).padStart(2, '0')
      expect(getDiffDaysFromToday(`${yyyy}-${mm}-${dd}`)).toBe(0)
    })

    it('deve retornar valor positivo para data futura', () => {
      const future = new Date()
      future.setDate(future.getDate() + 3)
      const yyyy = future.getFullYear()
      const mm = String(future.getMonth() + 1).padStart(2, '0')
      const dd = String(future.getDate()).padStart(2, '0')
      expect(getDiffDaysFromToday(`${yyyy}-${mm}-${dd}`)).toBe(3)
    })

    it('deve retornar valor negativo para data passada', () => {
      const past = new Date()
      past.setDate(past.getDate() - 5)
      const yyyy = past.getFullYear()
      const mm = String(past.getMonth() + 1).padStart(2, '0')
      const dd = String(past.getDate()).padStart(2, '0')
      expect(getDiffDaysFromToday(`${yyyy}-${mm}-${dd}`)).toBe(-5)
    })
  })

  describe('getBillingInfo', () => {
    it('quando em período de teste gratuito, não deve gerar custos nem alertas de cobrança ou bloqueio', async () => {
      const future = new Date()
      future.setDate(future.getDate() + 15)

      vi.spyOn(contractService, 'getContractForOrganization').mockResolvedValue(null)
      vi.spyOn(contractService, 'listInvoicesForOrganization').mockResolvedValue([])

      const res = await organizationBillingService.getBillingInfo({
        id: 'org-test-1',
        name: 'Empresa em Teste',
        trialEndsAt: future.toISOString(),
      })

      expect(res.isTrial).toBe(true)
      expect(res.trialDaysRemaining).toBeGreaterThanOrEqual(14)
      expect(res.hasUpcomingWarning).toBe(false)
      expect(res.hasOverdueWarning).toBe(false)
      expect(res.isSuspended).toBe(false)
    })

    it('deve identificar alerta quando a fatura vence em 3 dias ou menos', async () => {
      const in2Days = new Date()
      in2Days.setDate(in2Days.getDate() + 2)
      const yyyy = in2Days.getFullYear()
      const mm = String(in2Days.getMonth() + 1).padStart(2, '0')
      const dd = String(in2Days.getDate()).padStart(2, '0')
      const dueStr = `${yyyy}-${mm}-${dd}`

      vi.spyOn(contractService, 'getContractForOrganization').mockResolvedValue(null)
      vi.spyOn(contractService, 'listInvoicesForOrganization').mockResolvedValue([
        {
          id: 'inv-1',
          contractId: 'c-1',
          companyId: 'org-1',
          invoiceNumber: 'FAT-2026-0001',
          clientName: 'Empresa Cliente',
          referenceMonth: '11/2026',
          amount: 150,
          dueDate: dueStr,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])

      const res = await organizationBillingService.getBillingInfo({
        id: 'org-1',
        name: 'Empresa Cliente',
        trialEndsAt: null,
      })

      expect(res.isTrial).toBe(false)
      expect(res.hasUpcomingWarning).toBe(true)
      expect(res.daysUntilDue).toBe(2)
      expect(res.upcomingInvoice?.id).toBe('inv-1')
      expect(res.hasOverdueWarning).toBe(false)
      expect(res.isSuspended).toBe(false)
    })

    it('deve emitir alerta diário pós-vencimento se estiver atrasada há menos de 7 dias', async () => {
      const late3Days = new Date()
      late3Days.setDate(late3Days.getDate() - 3)
      const yyyy = late3Days.getFullYear()
      const mm = String(late3Days.getMonth() + 1).padStart(2, '0')
      const dd = String(late3Days.getDate()).padStart(2, '0')
      const dueStr = `${yyyy}-${mm}-${dd}`

      vi.spyOn(contractService, 'getContractForOrganization').mockResolvedValue(null)
      vi.spyOn(contractService, 'listInvoicesForOrganization').mockResolvedValue([
        {
          id: 'inv-late',
          contractId: 'c-1',
          companyId: 'org-1',
          invoiceNumber: 'FAT-2026-0002',
          clientName: 'Empresa Cliente',
          referenceMonth: '11/2026',
          amount: 200,
          dueDate: dueStr,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])

      const res = await organizationBillingService.getBillingInfo({
        id: 'org-1',
        name: 'Empresa Cliente',
        trialEndsAt: null,
      })

      expect(res.isTrial).toBe(false)
      expect(res.hasOverdueWarning).toBe(true)
      expect(res.daysOverdue).toBe(3)
      expect(res.overdueInvoice?.id).toBe('inv-late')
      expect(res.isSuspended).toBe(false)
    })

    it('deve acionar a suspensão por inadimplência se a fatura estiver vencida há 7 dias ou mais', async () => {
      const late8Days = new Date()
      late8Days.setDate(late8Days.getDate() - 8)
      const yyyy = late8Days.getFullYear()
      const mm = String(late8Days.getMonth() + 1).padStart(2, '0')
      const dd = String(late8Days.getDate()).padStart(2, '0')
      const dueStr = `${yyyy}-${mm}-${dd}`

      vi.spyOn(contractService, 'getContractForOrganization').mockResolvedValue(null)
      vi.spyOn(contractService, 'listInvoicesForOrganization').mockResolvedValue([
        {
          id: 'inv-suspended',
          contractId: 'c-1',
          companyId: 'org-1',
          invoiceNumber: 'FAT-2026-0003',
          clientName: 'Empresa Inadimplente',
          referenceMonth: '10/2026',
          amount: 250,
          dueDate: dueStr,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])

      const res = await organizationBillingService.getBillingInfo({
        id: 'org-1',
        name: 'Empresa Inadimplente',
        trialEndsAt: null,
      })

      expect(res.isTrial).toBe(false)
      expect(res.isSuspended).toBe(true)
      expect(res.maxDaysOverdue).toBe(8)
      expect(res.oldestOverdueInvoice?.id).toBe('inv-suspended')
    })
  })
})
