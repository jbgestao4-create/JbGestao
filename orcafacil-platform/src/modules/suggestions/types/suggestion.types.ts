import type { UUID } from '@shared/types/common'

export const SUGGESTION_TYPES = [
  'improvement',
  'feature',
  'problem',
  'criticism',
  'praise',
] as const

export type SuggestionType = (typeof SUGGESTION_TYPES)[number]

export const SUGGESTION_TYPE_LABELS: Record<SuggestionType, string> = {
  improvement: 'Sugestão de melhoria',
  feature: 'Nova funcionalidade',
  problem: 'Relato de problema',
  criticism: 'Crítica',
  praise: 'Elogio',
}

export const SUGGESTION_STATUSES = [
  'received',
  'in_review',
  'approved',
  'in_development',
  'completed',
  'rejected',
] as const

export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number]

export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  received: 'Recebida',
  in_review: 'Em análise',
  approved: 'Aprovada',
  in_development: 'Em desenvolvimento',
  completed: 'Concluída',
  rejected: 'Recusada',
}

export interface FeedbackSuggestion {
  id: UUID
  organization_id: UUID
  submitted_by: UUID
  submitted_by_name: string
  organization_name: string
  type: SuggestionType
  title: string
  description: string
  additional_info: string | null
  module_origin: string
  origin_route: string
  status: SuggestionStatus
  created_at: string
  updated_at: string
}

export interface FeedbackAttachment {
  id: UUID
  organization_id: UUID
  suggestion_id: UUID
  storage_path: string
  original_name: string
  mime_type: string
  size_bytes: number
  created_at: string
}

export interface FeedbackHistory {
  id: UUID
  suggestion_id: UUID
  changed_by: UUID | null
  previous_status: SuggestionStatus | null
  new_status: SuggestionStatus
  observation: string | null
  created_at: string
}

export interface FeedbackInternalNote {
  id: UUID
  suggestion_id: UUID
  owner_id: UUID
  content: string
  created_at: string
}
