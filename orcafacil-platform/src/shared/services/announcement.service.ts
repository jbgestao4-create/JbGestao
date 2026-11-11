import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult } from '@shared/types/common'

export type AnnouncementTargetPage = 'dashboard' | 'login'

export interface SystemAnnouncement {
  id: string
  title?: string | null
  imageUrl: string
  linkUrl?: string | null
  summary?: string | null
  orderIndex: number
  isActive: boolean
  targetPage?: AnnouncementTargetPage
  createdAt: string
  updatedAt: string
}

const LOCAL_STORAGE_KEY = 'jb_system_announcements_cache'

function getLocalCache(): SystemAnnouncement[] {
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

function setLocalCache(items: SystemAnnouncement[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore
  }
}

export const announcementService = {
  getCachedActive(targetPage: AnnouncementTargetPage = 'dashboard'): SystemAnnouncement[] {
    return getLocalCache().filter(
      (a) => a.isActive && (a.targetPage || 'dashboard') === targetPage,
    )
  },

  async listActive(
    targetPage: AnnouncementTargetPage = 'dashboard',
  ): Promise<ServiceResult<SystemAnnouncement[]>> {
    try {
      let query = supabase
        .from('system_announcements')
        .select('*')
        .eq('is_active', true)

      if (targetPage) {
        query = query.eq('target_page', targetPage)
      }

      const { data, error } = await query
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) {
        logger.warn('Erro ao carregar anúncios remotos, usando cache:', { message: error.message })
        const cached = getLocalCache().filter(
          (a) => a.isActive && (a.targetPage || 'dashboard') === targetPage,
        )
        return { success: true, data: cached }
      }

      const mapped: SystemAnnouncement[] = (data || []).map((row) => ({
        id: row.id,
        title: row.title,
        imageUrl: row.image_url,
        linkUrl: row.link_url,
        summary: row.summary,
        orderIndex: row.order_index,
        isActive: row.is_active,
        targetPage: (row.target_page as AnnouncementTargetPage) || 'dashboard',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))

      // Atualiza o cache mesclando
      const currentCache = getLocalCache().filter(
        (c) => (c.targetPage || 'dashboard') !== targetPage,
      )
      setLocalCache([...currentCache, ...mapped])
      return { success: true, data: mapped }
    } catch (err) {
      logger.error('Exceção ao listar anúncios ativos:', err)
      const cached = getLocalCache().filter(
        (a) => a.isActive && (a.targetPage || 'dashboard') === targetPage,
      )
      return { success: true, data: cached }
    }
  },

  async listAll(
    targetPage?: AnnouncementTargetPage,
  ): Promise<ServiceResult<SystemAnnouncement[]>> {
    try {
      let query = supabase.from('system_announcements').select('*')

      if (targetPage) {
        query = query.eq('target_page', targetPage)
      }

      const { data, error } = await query
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) {
        logger.warn('Erro ao carregar todos os anúncios remotos:', { message: error.message })
        const cached = targetPage
          ? getLocalCache().filter((a) => (a.targetPage || 'dashboard') === targetPage)
          : getLocalCache()
        return { success: true, data: cached }
      }

      const mapped: SystemAnnouncement[] = (data || []).map((row) => ({
        id: row.id,
        title: row.title,
        imageUrl: row.image_url,
        linkUrl: row.link_url,
        summary: row.summary,
        orderIndex: row.order_index,
        isActive: row.is_active,
        targetPage: (row.target_page as AnnouncementTargetPage) || 'dashboard',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))

      if (targetPage) {
        const currentCache = getLocalCache().filter(
          (c) => (c.targetPage || 'dashboard') !== targetPage,
        )
        setLocalCache([...currentCache, ...mapped])
      } else {
        setLocalCache(mapped)
      }

      return { success: true, data: mapped }
    } catch (err) {
      logger.error('Exceção ao listar todos os anúncios:', err)
      const cached = targetPage
        ? getLocalCache().filter((a) => (a.targetPage || 'dashboard') === targetPage)
        : getLocalCache()
      return { success: true, data: cached }
    }
  },

  async create(params: {
    imageUrl: string
    title?: string
    linkUrl?: string
    summary?: string
    orderIndex?: number
    targetPage?: AnnouncementTargetPage
  }): Promise<ServiceResult<SystemAnnouncement>> {
    const targetPage = params.targetPage || 'dashboard'
    try {
      const { data, error } = await supabase
        .from('system_announcements')
        .insert({
          image_url: params.imageUrl,
          title: params.title?.trim() || null,
          link_url: params.linkUrl?.trim() || null,
          summary: params.summary?.trim() || null,
          order_index: params.orderIndex ?? 0,
          target_page: targetPage,
          is_active: true,
        })
        .select('*')
        .single()

      if (error || !data) {
        logger.error('Erro ao criar anúncio no Supabase:', error)
        // Fallback local
        const localItem: SystemAnnouncement = {
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: params.title || null,
          imageUrl: params.imageUrl,
          linkUrl: params.linkUrl || null,
          summary: params.summary || null,
          orderIndex: params.orderIndex ?? 0,
          isActive: true,
          targetPage,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        const cached = getLocalCache()
        cached.push(localItem)
        setLocalCache(cached)
        return { success: true, data: localItem }
      }

      const created: SystemAnnouncement = {
        id: data.id,
        title: data.title,
        imageUrl: data.image_url,
        linkUrl: data.link_url,
        summary: data.summary,
        orderIndex: data.order_index,
        isActive: data.is_active,
        targetPage: (data.target_page as AnnouncementTargetPage) || targetPage,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }

      const cached = getLocalCache().filter((c) => c.id !== created.id)
      cached.push(created)
      setLocalCache(cached)

      return { success: true, data: created }
    } catch (err) {
      logger.error('Exceção ao criar anúncio:', err)
      return { success: false, error: 'Erro ao cadastrar anúncio' }
    }
  },

  async update(
    id: string,
    params: {
      title?: string | null
      linkUrl?: string | null
      summary?: string | null
      isActive?: boolean
      targetPage?: AnnouncementTargetPage
    }
  ): Promise<ServiceResult<SystemAnnouncement>> {
    try {
      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      }
      if (params.title !== undefined) payload.title = params.title?.trim() || null
      if (params.linkUrl !== undefined) payload.link_url = params.linkUrl?.trim() || null
      if (params.summary !== undefined) payload.summary = params.summary?.trim() || null
      if (params.isActive !== undefined) payload.is_active = params.isActive
      if (params.targetPage !== undefined) payload.target_page = params.targetPage

      const { data, error } = await supabase
        .from('system_announcements')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single()

      if (error || !data) {
        // Atualiza no cache local se falhar ou estiver em modo local
        const cached = getLocalCache()
        const existing = cached.find((c) => c.id === id)
        if (existing) {
          if (params.title !== undefined) existing.title = params.title
          if (params.linkUrl !== undefined) existing.linkUrl = params.linkUrl
          if (params.summary !== undefined) existing.summary = params.summary
          if (params.isActive !== undefined) existing.isActive = params.isActive
          if (params.targetPage !== undefined) existing.targetPage = params.targetPage
          existing.updatedAt = new Date().toISOString()
          setLocalCache(cached)
          return { success: true, data: existing }
        }
        return { success: false, error: 'Erro ao salvar alterações do anúncio' }
      }

      const updated: SystemAnnouncement = {
        id: data.id,
        title: data.title,
        imageUrl: data.image_url,
        linkUrl: data.link_url,
        summary: data.summary,
        orderIndex: data.order_index,
        isActive: data.is_active,
        targetPage: (data.target_page as AnnouncementTargetPage) || 'dashboard',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }

      const cached = getLocalCache().map((c) => (c.id === id ? updated : c))
      setLocalCache(cached)

      return { success: true, data: updated }
    } catch (err) {
      logger.error('Exceção ao atualizar anúncio:', err)
      return { success: false, error: 'Erro ao atualizar dados do anúncio' }
    }
  },

  async delete(id: string): Promise<ServiceResult<void>> {
    try {
      await supabase.from('system_announcements').delete().eq('id', id)
      const cached = getLocalCache().filter((a) => a.id !== id)
      setLocalCache(cached)
      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao deletar anúncio:', err)
      return { success: false, error: 'Erro ao excluir anúncio' }
    }
  },

  async updateOrder(items: { id: string; orderIndex: number }[]): Promise<ServiceResult<void>> {
    try {
      for (const it of items) {
        await supabase
          .from('system_announcements')
          .update({ order_index: it.orderIndex, updated_at: new Date().toISOString() })
          .eq('id', it.id)
      }
      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao atualizar ordem:', err)
      return { success: false, error: 'Erro ao reordenar anúncios' }
    }
  },
}
