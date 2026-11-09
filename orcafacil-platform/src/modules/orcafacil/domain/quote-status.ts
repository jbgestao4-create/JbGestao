import type { QuoteStatus } from '@shared/types/database'
import type { OrganizationRole } from '@shared/types/common'

/**
 * Máquina de estados finita (FSM) dos orçamentos da plataforma ControleSoft.
 *
 * Transições permitidas:
 * - draft: sent, rejected
 * - sent: approved, rejected, expired, draft
 * - approved: completed
 * - rejected: draft (reabertura para ajuste)
 * - expired: draft (renovação de proposta)
 * - completed: estado final
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['sent', 'rejected'],
  sent: ['approved', 'rejected', 'expired', 'draft'],
  approved: ['completed', 'rejected'],
  completed: [],
  rejected: ['draft'],
  expired: ['draft'],
}

/**
 * Valida se a transição entre o status atual e o novo status é permitida.
 */
export function isValidStatusTransition(
  currentStatus: QuoteStatus,
  newStatus: QuoteStatus,
): boolean {
  if (currentStatus === newStatus) return true
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus]
  return allowed.includes(newStatus)
}

export function canEditQuote(status: QuoteStatus, role: OrganizationRole | null): boolean {
  if (status === 'approved' || status === 'completed') return false
  const isOperationallyEditable = status === 'draft' || status === 'sent'
  return role !== null && (isOperationallyEditable || role === 'owner' || role === 'admin')
}

export function isQuotePrintable(status: QuoteStatus): boolean {
  return status === 'sent' || status === 'approved' || status === 'completed'
}

/**
 * Rótulo amigável em português para o status do orçamento.
 * Suporta distinção de aprovação pelo cliente ("Aprovado pelo cliente") ou pelo usuário ("Aprovado pelo usuário").
 */
export function getStatusLabel(
  status: QuoteStatus,
  approvedBy?: 'client' | 'user' | string | null,
): string {
  switch (status) {
    case 'draft':
      return 'Rascunho'
    case 'sent':
      return 'Enviado'
    case 'approved':
      if (approvedBy === 'client' || approvedBy === 'customer') {
        return 'Aprovado pelo cliente'
      }
      if (approvedBy === 'user') {
        return 'Aprovado pelo usuário'
      }
      return 'Aprovado'
    case 'completed':
      return 'Concluído'
    case 'rejected':
      return 'Recusado'
    case 'expired':
      return 'Expirado'
    default:
      return status
  }
}

/**
 * Classes Tailwind para badge do status.
 * Diferencia a cor verde entre aprovação pelo cliente (Esmeralda) e pelo usuário interno (Teal/Verde-petróleo).
 */
export function getStatusBadgeClasses(
  status: QuoteStatus,
  approvedBy?: 'client' | 'user' | string | null,
): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    case 'sent':
      return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700'
    case 'approved':
      if (approvedBy === 'client' || approvedBy === 'customer') {
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700'
      }
      return 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-700'
    case 'completed':
      return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-700'
    case 'rejected':
      return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-700'
    case 'expired':
      return 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}
