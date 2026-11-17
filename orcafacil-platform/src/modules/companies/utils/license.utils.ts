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

export type LicenseAdjustmentAction = 'increase' | 'decrease' | 'reset_block'

export interface LicenseAdjustmentResult {
  newExpiryIso: string
  newRemainingDays: number
  newGraceDaysRemaining: number
  previousRemainingDays: number
  isBlocked: boolean
  statusBadge: string
  daysDelta: number
}

/**
 * Calcula com precisão determinística a nova data de expiração ao aumentar, diminuir ou zerar dias de licença.
 * Trabalha com meia-noite local para evitar variações de fuso horário e segundos.
 * Permite diminuir dias mesmo durante a carência de 5 dias até bloquear completamente o acesso.
 */
export function calculateNewLicenseExpiry(
  currentTrialEndsAt: string | null | undefined,
  actionType: LicenseAdjustmentAction,
  daysDeltaAmount: number,
): LicenseAdjustmentResult {
  const now = new Date()
  // Meia noite de hoje (horário local)
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

  // 1. Caso especial: Zerar dias e bloquear acesso imediatamente
  if (actionType === 'reset_block') {
    // 7 dias atrás garante ultrapassar os 5 dias de tolerância/carência, bloqueando na hora
    const blockedDate = new Date(todayMidnight.getTime() - 7 * 24 * 60 * 60 * 1000)
    return {
      newExpiryIso: blockedDate.toISOString(),
      newRemainingDays: 0,
      newGraceDaysRemaining: 0,
      previousRemainingDays: 0,
      isBlocked: true,
      statusBadge: 'Bloqueado por Inadimplência',
      daysDelta: -999,
    }
  }

  // 2. Calcula a posição atual em relação a hoje (positivo se futura, negativo se em atraso)
  let currentDiffDays = 0
  if (currentTrialEndsAt) {
    const expDate = new Date(currentTrialEndsAt)
    if (!isNaN(expDate.getTime())) {
      const expMidnight = new Date(
        expDate.getFullYear(),
        expDate.getMonth(),
        expDate.getDate(),
        0,
        0,
        0,
        0,
      )
      const diffMs = expMidnight.getTime() - todayMidnight.getTime()
      currentDiffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
    }
  }

  const absDays = Math.abs(daysDeltaAmount)
  let targetDiffDays: number

  if (actionType === 'increase') {
    // Se estava vencida ou em carência, soma a partir de hoje
    const base = currentDiffDays > 0 ? currentDiffDays : 0
    targetDiffDays = base + absDays
  } else {
    // decrease: subtrai da posição atual (permitindo consumir carência e entrar em bloqueio total)
    targetDiffDays = currentDiffDays - absDays
  }

  // 3. Define a data resultante no calendário
  let newExpiryDate: Date
  if (targetDiffDays > 0) {
    // Expira em targetDiffDays dias no futuro às 23:59:59 daquele dia
    newExpiryDate = new Date(todayMidnight.getTime() + targetDiffDays * 24 * 60 * 60 * 1000 - 1)
  } else if (targetDiffDays === 0) {
    // Venceu hoje no início do dia
    newExpiryDate = new Date(todayMidnight.getTime() - 1000)
  } else {
    // Vencida há |targetDiffDays| dias atrás
    newExpiryDate = new Date(todayMidnight.getTime() + targetDiffDays * 24 * 60 * 60 * 1000)
  }

  // 4. Calcula os status decorrentes
  const daysRemaining = Math.max(0, targetDiffDays)
  const daysOverdue = targetDiffDays <= 0 ? Math.abs(targetDiffDays) : 0
  const graceRemaining = targetDiffDays <= 0 ? Math.max(0, 5 - daysOverdue) : 5
  const isBlocked = daysOverdue > 5

  let statusBadge = `${daysRemaining} dias restantes`
  if (daysRemaining === 0) {
    if (isBlocked) {
      statusBadge = 'Bloqueado por Inadimplência'
    } else {
      statusBadge = `Carência (${graceRemaining}d para bloqueio)`
    }
  }

  return {
    newExpiryIso: newExpiryDate.toISOString(),
    newRemainingDays: daysRemaining,
    newGraceDaysRemaining: graceRemaining,
    previousRemainingDays: Math.max(0, currentDiffDays),
    isBlocked,
    statusBadge,
    daysDelta: actionType === 'increase' ? absDays : -absDays,
  }
}
