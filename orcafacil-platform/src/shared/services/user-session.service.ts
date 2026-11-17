import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'

const DEVICE_TOKEN_KEY = 'cs_device_session_token'
const HEARTBEAT_INTERVAL_MS = 55000 // A cada 55 segundos atualiza heartbeat online (dentro da janela de 90s, reduzindo Egress)

/**
 * Obtém ou gera o token único de dispositivo/navegador.
 * Armazenado em localStorage para que TODAS as abas normais do mesmo navegador
 * compartilhem a mesma sessão de máquina (permitindo multitelas, espelhamento, etc.).
 * Abas anônimas ou outros computadores possuem storage isolado e terão tokens distintos.
 */
function getOrCreateDeviceToken(): string {
  if (typeof window === 'undefined') return 'server_session'
  try {
    let token = localStorage.getItem(DEVICE_TOKEN_KEY)
    if (!token) {
      token = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      localStorage.setItem(DEVICE_TOKEN_KEY, token)
    }
    return token
  } catch {
    return 'fallback_session'
  }
}

export interface CheckSessionResult {
  isBlocked: boolean
  message?: string
}

export const userSessionService = {
  getToken(): string {
    return getOrCreateDeviceToken()
  },

  /**
   * Verifica se o usuário com este e-mail já possui uma sessão ativa em outro navegador/dispositivo.
   * O proprietário do sistema possui privilégio e nunca é bloqueado.
   */
  async checkConcurrentLogin(email: string): Promise<CheckSessionResult> {
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) return { isBlocked: false }

    // Apenas o proprietário do sistema (adm@adm.com) possui privilégio de múltiplos logins simultâneos.
    // Todos os demais usuários (administradores de empresas, operadores, colaboradores) são estritamente bloqueados contra acesso concorrente.
    if (cleanEmail === 'adm@adm.com') {
      return { isBlocked: false }
    }

    const currentToken = this.getToken()

    // 1. Checagem local imediata no mesmo navegador (abas diferentes)
    try {
      const rawLocal = localStorage.getItem('cs_active_user_session')
      if (rawLocal) {
        const local = JSON.parse(rawLocal)
        if (
          local.email === cleanEmail &&
          local.sessionToken &&
          local.sessionToken !== currentToken
        ) {
          const lastMs = local.lastHeartbeat ? new Date(local.lastHeartbeat).getTime() : 0
          if (lastMs > 0 && Math.abs(Date.now() - lastMs) < 60000) {
            return {
              isBlocked: true,
              message:
                'Já consta logado um usuário com esta conta. Não é permitido acesso simultâneo com o mesmo e-mail.',
            }
          }
        }
      }
    } catch {
      // Ignora erro de storage local
    }

    // 2. Checagem remota no Supabase (entre navegadores, aba anônima e outras máquinas)
    try {
      const { data, error } = await supabase.rpc('check_user_concurrent_session', {
        p_email: cleanEmail,
        p_current_token: currentToken,
      })

      if (!error && data) {
        const res = data as { is_blocked?: boolean; error?: string; is_owner?: boolean }
        if (res.is_owner) return { isBlocked: false }
        if (res.is_blocked) {
          return {
            isBlocked: true,
            message:
              res.error ||
              'Já consta logado um usuário com esta conta. Não é permitido acesso simultâneo com o mesmo e-mail.',
          }
        }
      }
    } catch (err) {
      logger.warn('Aviso ao checar sessão concorrente', {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    return { isBlocked: false }
  },

  /**
   * Registra a sessão ativa do usuário atual e renova o heartbeat online.
   */
  async heartbeat(email: string, orgId?: string | null): Promise<void> {
    if (!email) return

    const token = this.getToken()
    const nowIso = new Date().toISOString()
    const cleanEmail = email.trim().toLowerCase()

    // 1. Grava no localStorage para presença imediata no mesmo cliente/navegador
    try {
      localStorage.setItem('cs_active_user_session', JSON.stringify({
        email: cleanEmail,
        sessionToken: token,
        orgId: orgId || null,
        lastHeartbeat: nowIso,
      }))
    } catch {
      // Ignora erro de storage
    }

    // 2. Grava na tabela user_active_sessions e/ou RPC
    try {
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''

      const { error: rpcError } = await supabase.rpc('register_user_session', {
        p_email: cleanEmail,
        p_session_token: token,
        p_org_id: orgId || null,
        p_ip: null,
        p_user_agent: userAgent,
      })

      if (rpcError) {
        // Fallback: tenta upsert direto na tabela se a RPC não estiver carregada ainda
        const { data: authData } = await supabase.auth.getUser()
        if (authData?.user?.id) {
          await supabase.from('user_active_sessions').upsert({
            user_id: authData.user.id,
            email: cleanEmail,
            session_token: token,
            organization_id: orgId || null,
            last_heartbeat: nowIso,
            user_agent: userAgent,
          })
        }
      }
    } catch (err) {
      logger.debug?.('Falha no heartbeat de sessão', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  },

  /**
   * Limpa o registro da sessão ativa ao efetuar logout.
   */
  async clearSession(email?: string): Promise<void> {
    try {
      if (email) {
        await supabase.rpc('clear_user_session', { p_email: email.trim().toLowerCase() })
      } else {
        await supabase.rpc('clear_user_session')
      }
    } catch {
      // Ignora erro
    } finally {
      try {
        localStorage.removeItem(DEVICE_TOKEN_KEY)
        localStorage.removeItem('cs_active_user_session')
      } catch {
        // Ignora
      }
    }
  },

  getHeartbeatInterval(): number {
    return HEARTBEAT_INTERVAL_MS
  },
}
