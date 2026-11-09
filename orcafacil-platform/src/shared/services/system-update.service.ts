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
    } catch {
      // ignore
    }
  },

  async getLatestVersion(): Promise<string> {
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
      }))

      setLocalCache(mapped)

      // Atualiza o cache da versão mais recente a partir da lista retornada
      const latestWithVersion = mapped.find((item) => item.version && item.version.trim().length > 0)
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

      const payload = {
        version: params.version?.trim() || null,
        title: params.title.trim(),
        description: params.description.trim(),
        type: params.type || 'feature',
        author_name: params.authorName.trim(),
        author_email: params.authorEmail?.trim() || null,
        modules: params.modules || [],
        performed_at: params.performedAt || new Date().toISOString(),
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
      }

      // Notifica e atualiza versão mais recente imediatamente
      if (created.version) {
        systemUpdateService.notifyVersionChange(formatSystemVersion(created.version))
      }
      void systemUpdateService.getLatestVersion()

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

      const { data, error } = await supabase
        .from('system_updates')
        .update(payload)
        .eq('id', id)
        .select('*')
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
      }

      // Notifica e atualiza versão mais recente imediatamente
      if (updated.version) {
        systemUpdateService.notifyVersionChange(formatSystemVersion(updated.version))
      }
      void systemUpdateService.getLatestVersion()

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

      // Atualiza versão mais recente após exclusão
      void systemUpdateService.getLatestVersion()

      return { success: true, data: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao excluir registro'
      return { success: false, error: msg }
    }
  },
}
