import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult } from '@shared/types/common'

export interface MaintenanceStatus {
  enabled: boolean
  message: string
  updatedAt: string
}

const DEFAULT_MAINTENANCE_MESSAGE =
  'O sistema encontra-se em manutenção de emergência temporária. Solicitamos que aguardem o retorno das operações em instantes.'

const LOCAL_STORAGE_KEY = 'jb_system_maintenance_status'

function getLocalCache(): MaintenanceStatus {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        enabled: Boolean(parsed.enabled),
        message: parsed.message || DEFAULT_MAINTENANCE_MESSAGE,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      }
    }
  } catch {
    // ignore
  }
  return {
    enabled: false,
    message: DEFAULT_MAINTENANCE_MESSAGE,
    updatedAt: new Date().toISOString(),
  }
}

function setLocalCache(status: MaintenanceStatus): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(status))
  } catch {
    // ignore
  }
}

export const systemMaintenanceService = {
  async getStatus(): Promise<ServiceResult<MaintenanceStatus>> {
    try {
      const { data, error } = await supabase.rpc('get_maintenance_mode')

      if (error || !data || data.length === 0) {
        // Fallback para consulta direta na tabela system_settings
        const { data: row, error: rowError } = await supabase
          .from('system_settings')
          .select('value, updated_at')
          .eq('key', 'maintenance_mode')
          .maybeSingle()

        if (rowError || !row) {
          const cached = getLocalCache()
          return { success: true, data: cached }
        }

        const val = row.value || {}
        const status: MaintenanceStatus = {
          enabled: Boolean(val.enabled),
          message: val.message || DEFAULT_MAINTENANCE_MESSAGE,
          updatedAt: val.updated_at || row.updated_at || new Date().toISOString(),
        }
        setLocalCache(status)
        return { success: true, data: status }
      }

      const first = data[0]
      const status: MaintenanceStatus = {
        enabled: Boolean(first.enabled),
        message: first.message || DEFAULT_MAINTENANCE_MESSAGE,
        updatedAt: first.updated_at || new Date().toISOString(),
      }

      setLocalCache(status)
      return { success: true, data: status }
    } catch (err) {
      logger.warn('Erro ao consultar status de manutenção, usando cache:', {
        error: String(err),
      })
      return { success: true, data: getLocalCache() }
    }
  },

  async setMaintenanceMode(
    enabled: boolean,
    message?: string,
  ): Promise<ServiceResult<MaintenanceStatus>> {
    try {
      const finalMessage = message?.trim() || DEFAULT_MAINTENANCE_MESSAGE

      const { data, error } = await supabase.rpc('set_maintenance_mode', {
        p_enabled: enabled,
        p_message: finalMessage,
      })

      if (error) {
        logger.error('Erro na RPC set_maintenance_mode:', { message: error.message })
        // Fallback: tentar atualizar diretamente
        const payload = {
          enabled,
          message: finalMessage,
          updated_at: new Date().toISOString(),
        }

        const { error: upsertError } = await supabase
          .from('system_settings')
          .upsert({
            key: 'maintenance_mode',
            value: payload,
            updated_at: new Date().toISOString(),
          })

        if (upsertError) {
          return { success: false, error: upsertError.message }
        }

        const status: MaintenanceStatus = {
          enabled,
          message: finalMessage,
          updatedAt: payload.updated_at,
        }
        setLocalCache(status)
        return { success: true, data: status }
      }

      const status: MaintenanceStatus = {
        enabled: Boolean(data?.enabled ?? enabled),
        message: data?.message || finalMessage,
        updatedAt: data?.updated_at || new Date().toISOString(),
      }

      setLocalCache(status)
      return { success: true, data: status }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar modo de manutenção'
      logger.error('Exceção ao alterar status de manutenção:', { error: String(err) })
      return { success: false, error: msg }
    }
  },
}
