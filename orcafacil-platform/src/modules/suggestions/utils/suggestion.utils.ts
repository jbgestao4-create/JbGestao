import type { SuggestionStatus, SuggestionType } from '../types/suggestion.types'
import { SUGGESTION_STATUS_LABELS, SUGGESTION_TYPE_LABELS } from '../types/suggestion.types'

export const MAX_SUGGESTION_IMAGE_SIZE = 5 * 1024 * 1024
export const ALLOWED_SUGGESTION_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function formatUnreadSuggestionCount(count: number): string {
  return count > 99 ? '99+' : String(count)
}

export function getSuggestionModuleLabel(pathname: string): string {
  if (pathname.startsWith('/cash')) return 'Caixa'
  if (pathname.startsWith('/orcafacil/sales')) return 'Vendas'
  if (pathname.startsWith('/orcafacil/inventory')) return 'Estoque'
  if (pathname.startsWith('/orcafacil/quotes')) return 'Orçamentos'
  if (pathname.startsWith('/orcafacil/customers')) return 'Clientes'
  if (pathname.startsWith('/orcafacil/suppliers')) return 'Fornecedores'
  if (pathname.startsWith('/service-orders')) return 'Ordens de Serviço'
  if (pathname.startsWith('/services')) return 'Serviços'
  if (pathname.startsWith('/orcafacil/reports')) return 'Relatórios'
  if (pathname.startsWith('/settings')) return 'Configurações'
  if (pathname === '/') return 'Página inicial'
  return 'OrçaFácil'
}

export function validateSuggestionImage(file: File): string | null {
  if (!ALLOWED_SUGGESTION_IMAGE_TYPES.includes(file.type)) {
    return 'Escolha uma imagem JPG, PNG ou WEBP.'
  }
  if (file.size > MAX_SUGGESTION_IMAGE_SIZE) {
    return 'A imagem deve ter no máximo 5 MB.'
  }
  return null
}

export function getSuggestionStatusTone(status: SuggestionStatus): string {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'rejected') return 'bg-rose-50 text-rose-700 border-rose-200'
  if (status === 'in_development' || status === 'approved') {
    return 'bg-violet-50 text-violet-700 border-violet-200'
  }
  if (status === 'in_review') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-sky-50 text-sky-700 border-sky-200'
}

export function getSuggestionTypeLabel(type: SuggestionType): string {
  return SUGGESTION_TYPE_LABELS[type]
}

export function getSuggestionStatusLabel(status: SuggestionStatus): string {
  return SUGGESTION_STATUS_LABELS[status]
}
