import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UUID } from '@shared/types/common'

export type SystemUpdateType = 'feature' | 'improvement' | 'bugfix' | 'security' | 'maintenance'

export interface SystemUpdate {
  id: UUID
  version?: string | null
  title: string
  description: string
  type: SystemUpdateType
  authorName: string
  authorEmail?: string | null
  modules?: string[] | null
  performedAt: string
  createdAt: string
  updatedAt: string
  isCurrent?: boolean
}

export interface CreateSystemUpdateParams {
  version?: string | null
  title: string
  description: string
  type: SystemUpdateType
  authorName: string
  authorEmail?: string | null
  modules?: string[] | null
  performedAt?: string | null
  isCurrent?: boolean
}

export interface UpdateSystemUpdateParams {
  version?: string | null
  title?: string
  description?: string
  type?: SystemUpdateType
  authorName?: string
  authorEmail?: string | null
  modules?: string[] | null
  performedAt?: string | null
  isCurrent?: boolean
}

const LOCAL_STORAGE_KEY = 'jb_system_updates_cache'
const LATEST_VERSION_STORAGE_KEY = 'jb_system_latest_version'
export const DEFAULT_SYSTEM_VERSION = 'v1.0'

export function formatSystemVersion(raw?: string | null): string {
  if (!raw || !raw.trim()) return DEFAULT_SYSTEM_VERSION
  const trimmed = raw.trim()
  if (/^[0-9]/.test(trimmed)) {
    return `v${trimmed}`
  }
  return trimmed
}

function getLocalCache(): SystemUpdate[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // ignore
  }
  return []
}

function setLocalCache(items: SystemUpdate[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore
  }
}

// BroadcastChannel para sincronização instantânea entre abas
let broadcastChannel: BroadcastChannel | null = null
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('jb_system_version_bus')
  }
} catch {
  broadcastChannel = null
}

let realtimeInitialized = false

export function initSystemVersionRealtime(): void {
  if (realtimeInitialized || typeof window === 'undefined') return
  realtimeInitialized = true

  try {
    const channelName = `sys-ver-live-${Math.random().toString(36).substring(2, 9)}`
    supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_updates',
        },
        () => {
          void systemUpdateService.getLatestVersion()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: 'key=eq.system_version',
        },
        (payload) => {
          const newRow = payload.new as { value?: { version?: string } } | undefined
          if (newRow?.value?.version) {
            systemUpdateService.notifyVersionChange(newRow.value.version)
          } else {
            void systemUpdateService.getLatestVersion()
          }
        },
      )
      .subscribe()
  } catch (err) {
    logger.warn('Aviso ao inicializar canal realtime de versão:', { error: String(err) })
  }
}

export const systemUpdateService = {
  notifyVersionChange(version: string): void {
    try {
      const formatted = formatSystemVersion(version)
      localStorage.setItem(LATEST_VERSION_STORAGE_KEY, formatted)

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('system-version-changed', { detail: { version: formatted } }),
        )
      }

      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'system-version-changed', version: formatted })
      }
    } catch {
      // ignore
    }
  },

  async setCurrentVersion(version: string, updateId?: string): Promise<ServiceResult<string>> {
    const formatted = formatSystemVersion(version)
    systemUpdateService.notifyVersionChange(formatted)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // 1. Salva na tabela global system_settings
      await supabase.from('system_settings').upsert({
        key: 'system_version',
        value: {
          version: formatted,
          update_id: updateId || null,
          updated_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
      })

      // 2. Se houver id de atualização, atualiza is_current na tabela system_updates
      if (updateId) {
        // Remove is_current de outras atualizações
        await supabase
          .from('system_updates')
          .update({ is_current: false })
          .neq('id', updateId)

        // Marca esta como is_current = true
        await supabase
          .from('system_updates')
          .update({ is_current: true })
          .eq('id', updateId)
      }

      return { success: true, data: formatted }
    } catch (err) {
      logger.warn('Erro ao persistir versão atual no banco:', { error: String(err) })
      return { success: true, data: formatted }
    }
  },

  async getLatestVersion(): Promise<string> {
    // 1. Primeiro tenta obter a versão oficial definida em system_settings
    try {
      const { data: settingData, error: settingError } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'system_version')
        .maybeSingle()

      if (!settingError && settingData?.value) {
        const val = settingData.value as { version?: string }
        if (val?.version && val.version.trim()) {
          const formatted = formatSystemVersion(val.version)
          systemUpdateService.notifyVersionChange(formatted)
          return formatted
        }
      }
    } catch {
      // prossegue para tentar system_updates
    }

    // 2. Tenta obter a atualização explicitamente marcada como is_current = true
    try {
      const { data: currentUpdate } = await supabase
        .from('system_updates')
        .select('version')
        .eq('is_current', true)
        .not('version', 'is', null)
        .neq('version', '')
        .limit(1)
        .maybeSingle()

      if (currentUpdate?.version) {
        const formatted = formatSystemVersion(currentUpdate.version)
        systemUpdateService.notifyVersionChange(formatted)
        return formatted
      }
    } catch {
      // prossegue para tentar a mais recente por data
    }

    // 3. Busca a versão da atualização mais recente por data de realização / criação
    try {
      const { data, error } = await supabase
        .from('system_updates')
        .select('version')
        .not('version', 'is', null)
        .neq('version', '')
        .order('performed_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!error && data?.version) {
        const v = formatSystemVersion(data.version)
        systemUpdateService.notifyVersionChange(v)
        return v
      }
    } catch (err) {
      logger.warn('Erro ao obter versão mais recente do sistema:', { error: String(err) })
    }

    // 4. Fallback no cache local
    try {
      const cached = localStorage.getItem(LATEST_VERSION_STORAGE_KEY)
      if (cached && cached.trim()) return formatSystemVersion(cached)
      const list = getLocalCache()
      const found = list.find((item) => item.version && item.version.trim().length > 0)
      if (found?.version) {
        const v = formatSystemVersion(found.version)
        localStorage.setItem(LATEST_VERSION_STORAGE_KEY, v)
        return v
      }
    } catch {
      // ignore
    }

    return DEFAULT_SYSTEM_VERSION
  },

  async listAll(): Promise<ServiceResult<SystemUpdate[]>> {
    try {
      const { data, error } = await supabase
        .from('system_updates')
        .select('*')
        .order('performed_at', { ascending: false })

      if (error) {
        logger.warn('Erro ao carregar atualizações do Supabase, usando cache:', {
          message: error.message,
        })
        return { success: true, data: getLocalCache() }
      }

      const mapped: SystemUpdate[] = (data || []).map((row) => ({
        id: row.id,
        version: row.version,
        title: row.title,
        description: row.description,
        type: (row.type as SystemUpdateType) || 'feature',
        authorName: row.author_name,
        authorEmail: row.author_email,
        modules: row.modules || [],
        performedAt: row.performed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isCurrent: Boolean(row.is_current),
      }))

      setLocalCache(mapped)

      // Atualiza o cache da versão mais recente a partir da lista retornada
      const currentMarked = mapped.find((item) => item.isCurrent && item.version)
      const latestWithVersion = currentMarked || mapped.find((item) => item.version && item.version.trim().length > 0)
      if (latestWithVersion?.version) {
        systemUpdateService.notifyVersionChange(formatSystemVersion(latestWithVersion.version))
      }

      return { success: true, data: mapped }
    } catch (err) {
      logger.error('Exceção ao listar atualizações do sistema:', { error: String(err) })
      return { success: true, data: getLocalCache() }
    }
  },

  async create(params: CreateSystemUpdateParams): Promise<ServiceResult<SystemUpdate>> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const shouldBeCurrent = params.isCurrent ?? Boolean(params.version && params.version.trim().length > 0)

      // Se esta for marcada como versão atual, desmarca as anteriores
      if (shouldBeCurrent) {
        try {
          await supabase.from('system_updates').update({ is_current: false }).eq('is_current', true)
        } catch {
          // ignora se a coluna is_current ainda não estiver disponível
        }
      }

      const payload = {
        version: params.version?.trim() || null,
        title: params.title.trim(),
        description: params.description.trim(),
        type: params.type || 'feature',
        author_name: params.authorName.trim(),
        author_email: params.authorEmail?.trim() || null,
        modules: params.modules || [],
        performed_at: params.performedAt || new Date().toISOString(),
        is_current: shouldBeCurrent,
        created_by: user?.id || null,
      }

      const { data, error } = await supabase
        .from('system_updates')
        .insert(payload)
        .select('*')
        .single()

      if (error) {
        logger.error('Erro ao cadastrar atualização do sistema:', { message: error.message })
        return { success: false, error: error.message }
      }

      const created: SystemUpdate = {
        id: data.id,
        version: data.version,
        title: data.title,
        description: data.description,
        type: data.type,
        authorName: data.author_name,
        authorEmail: data.author_email,
        modules: data.modules || [],
        performedAt: data.performed_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        isCurrent: Boolean(data.is_current),
      }

      // Atualiza o cache local
      const currentCache = getLocalCache()
      setLocalCache([created, ...currentCache.filter((u) => u.id !== created.id)])

      // Notifica e atualiza versão mais recente imediatamente
      if (shouldBeCurrent && created.version) {
        void systemUpdateService.setCurrentVersion(created.version, created.id)
      } else if (created.version) {
        systemUpdateService.notifyVersionChange(formatSystemVersion(created.version))
        void systemUpdateService.getLatestVersion()
      }

      return { success: true, data: created }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar atualização'
      logger.error('Exceção ao criar atualização:', { error: String(err) })
      return { success: false, error: msg }
    }
  },

  async update(id: UUID, params: UpdateSystemUpdateParams): Promise<ServiceResult<SystemUpdate>> {
    try {
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }

      if (params.version !== undefined) payload.version = params.version?.trim() || null
      if (params.title !== undefined) payload.title = params.title.trim()
      if (params.description !== undefined) payload.description = params.description.trim()
      if (params.type !== undefined) payload.type = params.type
      if (params.authorName !== undefined) payload.author_name = params.authorName.trim()
      if (params.authorEmail !== undefined) payload.author_email = params.authorEmail?.trim() || null
      if (params.modules !== undefined) payload.modules = params.modules
      if (params.performedAt !== undefined) payload.performed_at = params.performedAt
      if (params.isCurrent !== undefined) payload.is_current = params.isCurrent

      if (params.isCurrent) {
        try {
          await supabase.from('system_updates').update({ is_current: false }).neq('id', id)
        } catch {
          // ignore
        }
      }

      const { data, error } = await supabase
        .from('system_updates')
        .update(payload)
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        logger.error('Erro ao atualizar registro de atualização:', { message: error.message })
        return { success: false, error: error.message }
      }

      const updated: SystemUpdate = {
        id: data.id,
        version: data.version,
        title: data.title,
        description: data.description,
        type: data.type,
        authorName: data.author_name,
        authorEmail: data.author_email,
        modules: data.modules || [],
        performedAt: data.performed_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        isCurrent: Boolean(data.is_current),
      }

      // Atualiza cache local
      const currentCache = getLocalCache()
      setLocalCache(currentCache.map((u) => (u.id === updated.id ? updated : u)))

      // Notifica e atualiza versão mais recente imediatamente
      if (params.isCurrent && updated.version) {
        void systemUpdateService.setCurrentVersion(updated.version, updated.id)
      } else if (updated.version) {
        systemUpdateService.notifyVersionChange(formatSystemVersion(updated.version))
        void systemUpdateService.getLatestVersion()
      }

      return { success: true, data: updated }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao editar atualização'
      logger.error('Exceção ao atualizar registro:', { error: String(err) })
      return { success: false, error: msg }
    }
  },

  async delete(id: UUID): Promise<ServiceResult<boolean>> {
    try {
      const { error } = await supabase.from('system_updates').delete().eq('id', id)

      if (error) {
        return { success: false, error: error.message }
      }

      const currentCache = getLocalCache().filter((u) => u.id !== id)
      setLocalCache(currentCache)

      // Atualiza versão mais recente após exclusão
      void systemUpdateService.getLatestVersion()

      return { success: true, data: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao excluir registro'
      return { success: false, error: msg }
    }
  },
}
