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
  has_unread_reply?: boolean
  has_owner_reply?: boolean
  owner_replies_count?: number
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

export interface FeedbackMessage {
  id: UUID
  organization_id: UUID
  suggestion_id: UUID
  sender_id: UUID
  sender_name: string
  sender_role: 'owner' | 'user'
  message: string
  read_by_user: boolean
  read_by_owner: boolean
  created_at: string
}

export interface DeveloperTechnicalAnalysis {
  resumo_problema: string
  causa_provavel: string
  componentes_afetados: string[]
  passos_reproducao: string[]
  sugestao_tecnica_ponto_a_ponto: string[]
}

export interface SupportAiToolCallPayload {
  resposta_cliente: string
  requer_analise_dev: boolean
  analise_desenvolvedor?: DeveloperTechnicalAnalysis
}

export interface FeedbackAiDiagnostic {
  id: UUID
  organization_id: UUID
  suggestion_id: UUID
  requer_analise_dev: boolean
  resumo_problema: string | null
  causa_provavel: string | null
  componentes_afetados: string[]
  passos_reproducao: string[]
  sugestao_tecnica_ponto_a_ponto: string[]
  raw_payload?: SupportAiToolCallPayload | null
  created_at: string
}

