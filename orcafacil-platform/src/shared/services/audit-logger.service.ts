import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'

export function inferAuditModuleFromPath(pathname: string): string {
  const path = pathname.toLowerCase()
  if (path.includes('/pdv')) return 'PDV'
  if (path.includes('/sales') || path.includes('/vendas')) return 'VENDAS'
  if (path.includes('/inventory') || path.includes('/estoque')) return 'ESTOQUE'
  if (path.includes('/cash') || path.includes('/caixa')) return 'CAIXA'
  if (path.includes('/service-orders') || path.includes('/os')) return 'OS'
  if (path.includes('/customers') || path.includes('/clientes')) return 'CLIENTES'
  if (path.includes('/reports') || path.includes('/relatorios')) return 'FINANCEIRO'
  if (path.includes('/settings') || path.includes('/admin')) return 'CONFIGURACOES'
  return 'SISTEMA'
}

export interface EmitAuditLogParams {
  empresaId: string
  modulo: string
  acao: 'CRIACAO' | 'EDICAO' | 'EXCLUSAO' | 'CANCELAMENTO' | string
  descricao: string
  entidade?: string | null
  entidadeId?: string | null
  dadosAnteriores?: Record<string, unknown> | null
  dadosNovos?: Record<string, unknown> | null
}

/**
 * Grava um log de auditoria imediatamente a partir de qualquer serviço (sem depender de hook React).
 * Não bloqueia a operação principal em caso de falha.
 */
export async function emitAuditLog(params: EmitAuditLogParams): Promise<void> {
  try {
    if (!params.empresaId) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) return

    const meta = (user.user_metadata || {}) as Record<string, unknown>
    const usuarioNome =
      (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
      (typeof meta.display_name === 'string' && meta.display_name.trim()) ||
      user.email ||
      'Usuário'

    const { error } = await supabase.from('audit_logs').insert({
      empresa_id: params.empresaId,
      usuario_id: user.id,
      usuario_nome: usuarioNome,
      modulo: params.modulo.toUpperCase(),
      acao: params.acao.toUpperCase(),
      descricao: params.descricao,
      entidade: params.entidade ?? null,
      entidade_id: params.entidadeId ?? null,
      dados_anteriores: params.dadosAnteriores ?? null,
      dados_novos: params.dadosNovos ?? null,
    })

    if (error) {
      logger.warn('Aviso ao registrar audit_log no serviço', { message: error.message })
    }
  } catch {
    // non-blocking
  }
}
