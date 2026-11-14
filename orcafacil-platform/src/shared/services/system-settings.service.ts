import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult } from '@shared/types/common'

const INACTIVITY_STORAGE_KEY = 'jb_inactivity_timeout_minutes'
export const DEFAULT_INACTIVITY_MINUTES = 2

export interface InactivitySettings {
  timeoutMinutes: number
  updatedAt: string
  updatedBy?: string | null
}

export const systemSettingsService = {
  /**
   * Retorna o tempo de inatividade em minutos atualmente em cache local.
   */
  getLocalInactivityTimeoutMinutes(): number {
    try {
      const stored = localStorage.getItem(INACTIVITY_STORAGE_KEY)
      if (stored) {
        const val = Number(stored)
        if (!isNaN(val) && val >= 1 && val <= 480) {
          return val
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_INACTIVITY_MINUTES
  },

  /**
   * Consulta a configuração global de inatividade no Supabase e atualiza o cache local.
   */
  async getInactivitySettings(): Promise<ServiceResult<InactivitySettings>> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'inactivity_timeout')
        .single()

      if (error || !data) {
        const localVal = this.getLocalInactivityTimeoutMinutes()
        return {
          success: true,
          data: {
            timeoutMinutes: localVal,
            updatedAt: new Date().toISOString(),
          },
        }
      }

      const val = data.value as any
      const timeoutMinutes =
        typeof val?.timeout_minutes === 'number' && val.timeout_minutes >= 1
          ? val.timeout_minutes
          : DEFAULT_INACTIVITY_MINUTES

      try {
        localStorage.setItem(INACTIVITY_STORAGE_KEY, String(timeoutMinutes))
      } catch {
        // ignore
      }

      return {
        success: true,
        data: {
          timeoutMinutes,
          updatedAt: data.updated_at || new Date().toISOString(),
          updatedBy: data.updated_by || null,
        },
      }
    } catch (err: any) {
      logger.warn('Falha ao obter tempo de inatividade remoto, usando valor local', {
        error: String(err),
      })
      return {
        success: true,
        data: {
          timeoutMinutes: this.getLocalInactivityTimeoutMinutes(),
          updatedAt: new Date().toISOString(),
        },
      }
    }
  },

  /**
   * Atualiza o tempo de inatividade global no Supabase e propaga para todas as abas.
   */
  async setInactivityTimeoutMinutes(
    minutes: number,
    userId?: string,
  ): Promise<ServiceResult<InactivitySettings>> {
    const cleanMinutes = Math.max(1, Math.min(480, Math.round(minutes)))
    const now = new Date().toISOString()

    try {
      localStorage.setItem(INACTIVITY_STORAGE_KEY, String(cleanMinutes))
      window.dispatchEvent(
        new CustomEvent('inactivity-timeout-changed', {
          detail: { timeoutMinutes: cleanMinutes },
        }),
      )
    } catch {
      // ignore
    }

    try {
      const payload: any = {
        key: 'inactivity_timeout',
        value: {
          timeout_minutes: cleanMinutes,
          updated_at: now,
        },
        updated_at: now,
      }
      if (userId) {
        payload.updated_by = userId
      }

      const { error } = await supabase.from('system_settings').upsert(payload)

      if (error) {
        logger.error('Erro ao atualizar system_settings no Supabase', error)
        return {
          success: true,
          data: {
            timeoutMinutes: cleanMinutes,
            updatedAt: now,
          },
        }
      }

      return {
        success: true,
        data: {
          timeoutMinutes: cleanMinutes,
          updatedAt: now,
          updatedBy: userId || null,
        },
      }
    } catch (err: any) {
      logger.error('Erro ao salvar tempo de inatividade no Supabase', err)
      return {
        success: true,
        data: {
          timeoutMinutes: cleanMinutes,
          updatedAt: now,
        },
      }
    }
  },
}
