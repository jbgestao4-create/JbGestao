import type { QuoteStatus } from '@shared/types/database'
import type { OrganizationRole } from '@shared/types/common'

/**
 * Máquina de estados finita (FSM) dos orçamentos da plataforma JB Software.
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
  approved: ['completed'],
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
  const isOperationallyEditable = status === 'draft' || status === 'sent' || status === 'approved'
  return role !== null && (isOperationallyEditable || role === 'owner' || role === 'admin')
}

export function isQuotePrintable(status: QuoteStatus): boolean {
  return status === 'sent' || status === 'approved' || status === 'completed'
}

/**
 * Rótulo amigável em português para o status do orçamento.
 */
export function getStatusLabel(status: QuoteStatus): string {
  switch (status) {
    case 'draft':
      return 'Rascunho'
    case 'sent':
      return 'Enviado'
    case 'approved':
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
 */
export function getStatusBadgeClasses(status: QuoteStatus): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-700 border-gray-300'
    case 'sent':
      return 'bg-blue-100 text-blue-700 border-blue-300'
    case 'approved':
      return 'bg-green-100 text-green-700 border-green-300'
    case 'completed':
      return 'bg-purple-100 text-purple-700 border-purple-300'
    case 'rejected':
      return 'bg-red-100 text-red-700 border-red-300'
    case 'expired':
      return 'bg-amber-100 text-amber-700 border-amber-300'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}
