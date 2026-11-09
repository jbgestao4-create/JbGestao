import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'

export interface MemberActivityData {
  userId: string
  screenTimeSeconds: number
  lastAccessAt: string | null
}

const LOCAL_STORAGE_PREFIX = 'jb_user_screen_time_'

/**
 * Formata o tempo de tela total em segundos para o formato HH:MM:SS (ex: 00:30:00).
 */
export function formatScreenTime(totalSeconds: number | null | undefined): string {
  const seconds = Math.max(0, Math.floor(totalSeconds ?? 0))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`
}

/**
 * Formata a data e hora do último acesso no padrão brasileiro (DD/MM/AAAA às HH:MM:SS).
 */
export function formatLastAccess(dateString: string | null | undefined): string {
  if (!dateString) return 'Nunca acessou'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Nunca acessou'

    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')

    return `${day}/${month}/${year} às ${hours}:${minutes}:${seconds}`
  } catch {
    return 'Nunca acessou'
  }
}

export const screenTimeService = {
  /**
   * Salva o tempo acumulado no Supabase e atualiza o timestamp de último acesso do usuário e da organização.
   */
  async recordScreenTime(userId: string, seconds: number, orgId?: string | null): Promise<void> {
    if (!userId) return

    const sanitizedSeconds = Math.max(0, Math.floor(seconds))
    const nowIso = new Date().toISOString()

    // 1. Atualiza cache local imediatamente
    try {
      const cached = this.getLocalActivity(userId)
      const newTotal = (cached?.screenTimeSeconds || 0) + sanitizedSeconds
      localStorage.setItem(
        `${LOCAL_STORAGE_PREFIX}${userId}`,
        JSON.stringify({
          screenTimeSeconds: newTotal,
          lastAccessAt: nowIso,
        }),
      )
    } catch {
      // localStorage pode estar desativado ou cheio, ignorar silenciosamente
    }

    // 2. Envia para o Supabase via RPC atômica
    try {
      const rpcParams: Record<string, unknown> = {
        p_seconds: sanitizedSeconds,
        p_user_id: userId,
      }
      if (orgId) {
        rpcParams.p_org_id = orgId
      }

      const { error: rpcError } = await supabase.rpc('record_user_screen_time', rpcParams as any)

      if (!rpcError) {
        return
      }

      logger.warn('Aviso: RPC record_user_screen_time falhou, tentando fallback na tabela profiles', {
        error: rpcError.message,
      })
    } catch (err) {
      logger.warn('Exceção ao chamar record_user_screen_time', {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    // 3. Fallback: Atualização direta na tabela profiles
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('screen_time_seconds')
        .eq('id', userId)
        .maybeSingle()

      const currentSecs = Number(profile?.screen_time_seconds || 0)
      await supabase
        .from('profiles')
        .update({
          screen_time_seconds: currentSecs + sanitizedSeconds,
          last_access_at: nowIso,
        })
        .eq('id', userId)
    } catch (fallbackErr) {
      logger.error('Falha no fallback de registro de tempo de tela', {
        error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
      })
    }
  },

  /**
   * Obtém atividade salva localmente no navegador (fallback offline / tempo real).
   */
  getLocalActivity(userId: string): { screenTimeSeconds: number; lastAccessAt: string | null } | null {
    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}`)
      if (!raw) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  },

  /**
   * Consulta a atividade (tempo de tela total e último acesso) de todos os membros de uma organização.
   */
  async getOrganizationMembersActivity(
    orgId: string,
  ): Promise<Map<string, { screenTimeSeconds: number; lastAccessAt: string | null }>> {
    const activityMap = new Map<string, { screenTimeSeconds: number; lastAccessAt: string | null }>()

    if (!orgId) return activityMap

    // 1. Tenta via RPC
    try {
      const { data, error } = await supabase.rpc('get_organization_members_activity', {
        p_org_id: orgId,
      })

      if (!error && Array.isArray(data)) {
        data.forEach((row: any) => {
          if (row.user_id) {
            const local = this.getLocalActivity(row.user_id)
            const remoteSecs = Number(row.screen_time_seconds || 0)
            const localSecs = Number(local?.screenTimeSeconds || 0)
            activityMap.set(row.user_id, {
              screenTimeSeconds: Math.max(remoteSecs, localSecs),
              lastAccessAt: local?.lastAccessAt || row.last_access_at || null,
            })
          }
        })
        return activityMap
      }
    } catch (err) {
      logger.warn('Aviso ao consultar atividade via RPC get_organization_members_activity', {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    // 2. Fallback: Consulta direta na tabela profiles
    try {
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', orgId)

      if (members && members.length > 0) {
        const userIds = members.map((m: any) => m.user_id)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, screen_time_seconds, last_access_at')
          .in('id', userIds)

        profiles?.forEach((p: any) => {
          activityMap.set(p.id, {
            screenTimeSeconds: Number(p.screen_time_seconds || 0),
            lastAccessAt: p.last_access_at || null,
          })
        })
      }
    } catch (err) {
      logger.error('Erro no fallback de consulta de perfis para tempo de tela', {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    return activityMap
  },
}
