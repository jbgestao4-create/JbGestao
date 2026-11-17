export type LicenseStatusType = 'active' | 'grace_period' | 'blocked_overdue' | 'unlimited'

export interface CompanyLicenseStatus {
  /** Dias até a expiração do ciclo de 30 dias */
  daysRemaining: number
  /** Data de validade formatada DD/MM/AAAA */
  expirationDate: string | null
  /** Status formal da licença */
  status: LicenseStatusType
  /** Dias de carência restantes (de 5 até 0) */
  graceDaysRemaining: number
  /** Dias em atraso após o vencimento */
  daysOverdue: number
  /** Título/texto para badge */
  badgeText: string
  /** Variante visual */
  badgeVariant: 'active' | 'grace' | 'blocked' | 'unlimited'
  /** Detalhe descritivo */
  description: string
  /** Está efetivamente bloqueado por inadimplência? */
  isBlockedByOverdue: boolean
}

/**
 * Calcula os dias restantes de licença, o período de tolerância/carência de 5 dias
 * e a suspensão por inadimplência.
 *
 * Regras:
 * - Cada pagamento conta 30 dias de acesso normal + 5 dias de carência.
 * - Enquanto faltarem dias (> 0): Acesso ativo.
 * - Ao vencer (dias <= 0): Entra no período de 5 dias de carência para solicitar nova licença.
 * - Após o 5º dia de carência sem pagamento: Bloqueado por inadimplência.
 */
export function calculateCompanyLicenseStatus(
  trialEndsAt?: string | null,
  _isManualActive = true,
): CompanyLicenseStatus {
  if (!trialEndsAt) {
    return {
      daysRemaining: 9999,
      expirationDate: null,
      status: 'unlimited',
      graceDaysRemaining: 0,
      daysOverdue: 0,
      badgeText: 'Acesso Livre / Ilimitado',
      badgeVariant: 'unlimited',
      description: 'Sem expiração configurada',
      isBlockedByOverdue: false,
    }
  }

  const expiry = new Date(trialEndsAt)
  const now = new Date()
  const diffMs = expiry.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const formattedDate = expiry.toLocaleDateString('pt-BR')

  // Se diffDays > 0, licença ativa
  if (diffDays > 0) {
    return {
      daysRemaining: diffDays,
      expirationDate: formattedDate,
      status: 'active',
      graceDaysRemaining: 5,
      daysOverdue: 0,
      badgeText: `${diffDays} ${diffDays === 1 ? 'dia restante' : 'dias restantes'}`,
      badgeVariant: 'active',
      description: `Até ${formattedDate} (+5d carência)`,
      isBlockedByOverdue: false,
    }
  }

  // Licença venceu: calcula atraso
  const daysOverdue = Math.abs(diffDays)
  const graceDaysRemaining = Math.max(0, 5 - daysOverdue)

  // Se venceu há 5 dias ou menos, está no período de carência de 5 dias
  if (daysOverdue <= 5) {
    return {
      daysRemaining: 0,
      expirationDate: formattedDate,
      status: 'grace_period',
      graceDaysRemaining,
      daysOverdue,
      badgeText: `Carência (${graceDaysRemaining}d para bloqueio)`,
      badgeVariant: 'grace',
      description: `Venceu em ${formattedDate}. Renove em até ${graceDaysRemaining} dias.`,
      isBlockedByOverdue: false,
    }
  }

  // Passou de 5 dias de atraso -> Bloqueado por inadimplência
  return {
    daysRemaining: 0,
    expirationDate: formattedDate,
    status: 'blocked_overdue',
    graceDaysRemaining: 0,
    daysOverdue,
    badgeText: 'Bloqueado por Inadimplência',
    badgeVariant: 'blocked',
    description: `Acesso suspenso (vencido há ${daysOverdue} dias)`,
    isBlockedByOverdue: true,
  }
}
