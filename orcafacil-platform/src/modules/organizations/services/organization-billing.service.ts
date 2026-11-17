import {
  contractService,
  type SoftwareContract,
  type ContractInvoice,
  getInvoiceEffectiveStatus,
} from '@modules/companies/services/contract.service'
import { calculateCompanyLicenseStatus } from '@modules/companies/utils/license.utils'

export interface OrganizationBillingInfo {
  isTrial: boolean
  trialEndsAt?: string | null
  trialDaysRemaining: number
  contract: SoftwareContract | null
  invoices: ContractInvoice[]
  unpaidInvoices: ContractInvoice[]
  paidInvoices: ContractInvoice[]
  // Alerta pré-vencimento (3 dias antes até o dia do vencimento)
  hasUpcomingWarning: boolean
  upcomingInvoice: ContractInvoice | null
  daysUntilDue: number
  // Alerta pós-vencimento diário (1 a 6 dias em atraso)
  hasOverdueWarning: boolean
  overdueInvoice: ContractInvoice | null
  daysOverdue: number
  // Suspensão por inadimplência (mais de 5 dias de atraso)
  isSuspended: boolean
  oldestOverdueInvoice: ContractInvoice | null
  maxDaysOverdue: number
  // Controle pós-teste de 1 mês: indica se já pagou o mês seguinte ou se está pendente de pagamento pós-trial
  hasPaidPostTrialInvoice?: boolean
  isPostTrialUnpaid?: boolean
}

/**
 * Verifica se a organização está dentro do período de testes gratuito.
 * Quando o plano estiver em período de teste, NÃO gera custo, cobrança ou suspensão ao usuário.
 */
export function isOrganizationInTrial(trialEndsAt?: string | null): boolean {
  if (!trialEndsAt) return false
  const end = new Date(trialEndsAt).getTime()
  return !isNaN(end) && end > Date.now()
}

/**
 * Calcula a diferença em dias corridos entre uma data YYYY-MM-DD e o dia de hoje (meia-noite local).
 * Retorna positivo se estiver no futuro, 0 se for hoje, negativo se estiver no passado.
 */
export function getDiffDaysFromToday(targetDateStr: string): number {
  try {
    const [y, m, d] = targetDateStr.split('-').map(Number)
    const target = new Date(y, m - 1, d)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    target.setHours(0, 0, 0, 0)

    const diffMs = target.getTime() - today.getTime()
    return Math.round(diffMs / (1000 * 60 * 60 * 24))
  } catch {
    return 0
  }
}

export const organizationBillingService = {
  /**
   * Obtém as informações financeiras completas da organização:
   * Contrato, histórico de faturas pagas e a vencer, status de teste,
   * alertas de 3 dias para vencer, cobrança diária de atraso e suspensão por inadimplência após 5 dias.
   */
  async getBillingInfo(org: {
    id: string
    name: string
    trialEndsAt?: string | null
  }): Promise<OrganizationBillingInfo> {
    // Executa rotina de renovação automática
    try {
      await contractService.autoGenerateInvoicesDueSoon()
    } catch {
      // non-blocking
    }

    const [contract, invoices] = await Promise.all([
      contractService.getContractForOrganization(org.id, org.name),
      contractService.listInvoicesForOrganization(org.id, org.name),
    ])

    let isTrial = isOrganizationInTrial(org.trialEndsAt)
    let effectiveTrialEndsAt = org.trialEndsAt || null

    // Se a organização não tem trial configurado no cadastro mas o contrato possui período de teste de 1 mês
    if (!isTrial && contract?.hasTrialPeriod) {
      let contractTrialEnd = contract.trialEndsAt || null
      if (!contractTrialEnd && contract.startDate) {
        try {
          const d = new Date(contract.startDate)
          d.setMonth(d.getMonth() + 1)
          contractTrialEnd = d.toISOString()
        } catch {
          contractTrialEnd = null
        }
      }
      if (contractTrialEnd && isOrganizationInTrial(contractTrialEnd)) {
        isTrial = true
        effectiveTrialEndsAt = contractTrialEnd
      }
    }

    let trialDaysRemaining = 0
    if (isTrial && effectiveTrialEndsAt) {
      const end = new Date(effectiveTrialEndsAt).getTime()
      trialDaysRemaining = Math.max(0, Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24)))
    }

    const paidInvoices: ContractInvoice[] = []
    const unpaidInvoices: ContractInvoice[] = []

    for (const inv of invoices) {
      const eff = getInvoiceEffectiveStatus(inv)
      if (eff === 'paid') {
        paidInvoices.push(inv)
      } else if (eff !== 'cancelled') {
        unpaidInvoices.push(inv)
      }
    }

    // Se estiver em período de testes gratuito e sem faturas em aberto, não gera custos nem alertas de cobrança/bloqueio
    if (isTrial && unpaidInvoices.length === 0) {
      return {
        isTrial: true,
        trialEndsAt: effectiveTrialEndsAt,
        trialDaysRemaining,
        contract,
        invoices,
        unpaidInvoices,
        paidInvoices,
        hasUpcomingWarning: false,
        upcomingInvoice: null,
        daysUntilDue: 0,
        hasOverdueWarning: false,
        overdueInvoice: null,
        daysOverdue: 0,
        isSuspended: false,
        oldestOverdueInvoice: null,
        maxDaysOverdue: 0,
      }
    }

    // Análise de vencimento das faturas não pagas
    let hasUpcomingWarning = false
    let upcomingInvoice: ContractInvoice | null = null
    let minDaysUntilDue = 999

    let hasOverdueWarning = false
    let overdueInvoice: ContractInvoice | null = null
    let maxDaysOverdue = 0

    let isSuspended = false
    let oldestOverdueInvoice: ContractInvoice | null = null

    const licenseStatus = calculateCompanyLicenseStatus(org.trialEndsAt, true)
    const hasRemainingLicenseDays =
      licenseStatus.status === 'active' && licenseStatus.daysRemaining > 0

    for (const inv of unpaidInvoices) {
      const diff = getDiffDaysFromToday(inv.dueDate)

      if (diff >= 0 && diff <= 3) {
        // Falta 3 dias ou menos para o vencimento (incluindo o dia de hoje)
        hasUpcomingWarning = true
        if (diff < minDaysUntilDue) {
          minDaysUntilDue = diff
          upcomingInvoice = inv
        }
      } else if (diff < 0) {
        // Fatura vencida
        const daysLate = Math.abs(diff)
        if (daysLate > 5 && !hasRemainingLicenseDays) {
          // Passou dos 5 dias de carência E não tem mais dias restantes de licença -> Bloqueado por inadimplência
          isSuspended = true
          if (daysLate > maxDaysOverdue) {
            maxDaysOverdue = daysLate
            oldestOverdueInvoice = inv
          }
        } else {
          // Dentro dos 5 dias de carência OU ainda possui dias restantes de licença -> Apenas notifica atraso (sem bloquear)
          hasOverdueWarning = true
          if (daysLate > maxDaysOverdue) {
            maxDaysOverdue = daysLate
            overdueInvoice = inv
          }
        }
      }
    }

    const hasPaidPostTrialInvoice = paidInvoices.some((inv) => inv.amount > 0) && maxDaysOverdue === 0
    const hadExpiredTrial = Boolean(
      effectiveTrialEndsAt && new Date(effectiveTrialEndsAt).getTime() < Date.now(),
    )
    const isPostTrialUnpaid = hadExpiredTrial && !hasPaidPostTrialInvoice

    return {
      isTrial: false,
      trialEndsAt: org.trialEndsAt,
      trialDaysRemaining: 0,
      contract,
      invoices,
      unpaidInvoices,
      paidInvoices,
      hasUpcomingWarning,
      upcomingInvoice,
      daysUntilDue: minDaysUntilDue !== 999 ? minDaysUntilDue : 0,
      hasOverdueWarning,
      overdueInvoice,
      daysOverdue: maxDaysOverdue,
      isSuspended,
      oldestOverdueInvoice,
      maxDaysOverdue,
      hasPaidPostTrialInvoice,
      isPostTrialUnpaid,
    }
  },
}
