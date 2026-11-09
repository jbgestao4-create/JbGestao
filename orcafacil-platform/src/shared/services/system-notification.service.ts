import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UUID } from '@shared/types/common'

export type SystemNotificationType = 'info' | 'warning' | 'urgent' | 'contact'
export type SystemNotificationTargetType = 'all' | 'organization' | 'user'

export interface SystemNotification {
  id: UUID
  title: string
  message: string
  type: SystemNotificationType
  targetType: SystemNotificationTargetType
  organizationId?: UUID | null
  targetUserId?: UUID | null
  targetUserEmail?: string | null
  targetUserName?: string | null
  targetOrganizationName?: string | null
  contactWhatsapp?: string | null
  contactEmail?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  isRead?: boolean
}

export interface CreateNotificationParams {
  title: string
  message: string
  type?: SystemNotificationType
  targetType: SystemNotificationTargetType
  organizationId?: UUID | null
  targetUserId?: UUID | null
  targetUserEmail?: string | null
  targetUserName?: string | null
  targetOrganizationName?: string | null
  contactWhatsapp?: string | null
  contactEmail?: string | null
}

export const systemNotificationService = {
  async listAll(): Promise<ServiceResult<SystemNotification[]>> {
    try {
      const { data, error } = await supabase
        .from('system_notifications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Erro ao listar notificações do sistema:', error)
        return { success: false, error: error.message }
      }

      const mapped: SystemNotification[] = (data || []).map((row) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        type: (row.type as SystemNotificationType) || 'info',
        targetType: (row.target_type as SystemNotificationTargetType) || 'all',
        organizationId: row.organization_id,
        targetUserId: row.target_user_id,
        targetUserEmail: row.target_user_email,
        targetUserName: row.target_user_name,
        targetOrganizationName: row.target_organization_name,
        contactWhatsapp: row.contact_whatsapp,
        contactEmail: row.contact_email,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))

      return { success: true, data: mapped }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao listar notificações'
      logger.error('Exceção ao listar notificações:', err)
      return { success: false, error: msg }
    }
  },

  async getMyActiveNotifications(orgId?: UUID | null): Promise<ServiceResult<SystemNotification[]>> {
    try {
      const { data, error } = await supabase.rpc('get_my_system_notifications', {
        p_org_id: orgId || null,
      })

      if (error) {
        logger.warn('Erro ao carregar notificações via RPC, tentando consulta direta:', {
          message: error.message,
        })
        const { data: directData, error: directError } = await supabase
          .from('system_notifications')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        if (directError) {
          return { success: false, error: directError.message }
        }

        const filtered = (directData || []).filter((row) => {
          if (row.target_type === 'all') return true
          if (row.target_type === 'organization' && orgId && row.organization_id === orgId) return true
          return false
        })

        const mapped: SystemNotification[] = filtered.map((row) => ({
          id: row.id,
          title: row.title,
          message: row.message,
          type: (row.type as SystemNotificationType) || 'info',
          targetType: (row.target_type as SystemNotificationTargetType) || 'all',
          organizationId: row.organization_id,
          targetUserId: row.target_user_id,
          targetUserEmail: row.target_user_email,
          targetUserName: row.target_user_name,
          targetOrganizationName: row.target_organization_name,
          contactWhatsapp: row.contact_whatsapp,
          contactEmail: row.contact_email,
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          isRead: false,
        }))

        return { success: true, data: mapped }
      }

      const mapped: SystemNotification[] = (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        type: (row.type as SystemNotificationType) || 'info',
        targetType: (row.target_type as SystemNotificationTargetType) || 'all',
        organizationId: row.organization_id,
        targetUserId: row.target_user_id,
        contactWhatsapp: row.contact_whatsapp,
        contactEmail: row.contact_email,
        isActive: true,
        createdAt: row.created_at,
        updatedAt: row.created_at,
        isRead: Boolean(row.is_read),
      }))

      return { success: true, data: mapped }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao buscar notificações ativas'
      logger.error('Exceção ao buscar notificações ativas:', err)
      return { success: false, error: msg }
    }
  },

  async create(params: CreateNotificationParams): Promise<ServiceResult<SystemNotification>> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const payload = {
        title: params.title.trim(),
        message: params.message.trim(),
        type: params.type || 'info',
        target_type: params.targetType,
        organization_id: params.targetType === 'all' ? null : params.organizationId || null,
        target_user_id: params.targetType === 'user' ? params.targetUserId || null : null,
        target_user_email: params.targetType === 'user' ? params.targetUserEmail || null : null,
        target_user_name: params.targetType === 'user' ? params.targetUserName || null : null,
        target_organization_name:
          params.targetType === 'all' ? 'Todas as Empresas' : params.targetOrganizationName || null,
        contact_whatsapp: params.contactWhatsapp?.trim() || null,
        contact_email: params.contactEmail?.trim() || null,
        is_active: true,
        created_by: user?.id || null,
      }

      const { data, error } = await supabase
        .from('system_notifications')
        .insert(payload)
        .select('*')
        .single()

      if (error) {
        logger.error('Erro ao criar notificação no banco:', error)
        return { success: false, error: error.message }
      }

      const created: SystemNotification = {
        id: data.id,
        title: data.title,
        message: data.message,
        type: data.type,
        targetType: data.target_type,
        organizationId: data.organization_id,
        targetUserId: data.target_user_id,
        targetUserEmail: data.target_user_email,
        targetUserName: data.target_user_name,
        targetOrganizationName: data.target_organization_name,
        contactWhatsapp: data.contact_whatsapp,
        contactEmail: data.contact_email,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }

      return { success: true, data: created }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao criar notificação'
      logger.error('Exceção ao criar notificação:', err)
      return { success: false, error: msg }
    }
  },

  async toggleActive(id: UUID, isActive: boolean): Promise<ServiceResult<boolean>> {
    try {
      const { error } = await supabase
        .from('system_notifications')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao alterar status da notificação'
      return { success: false, error: msg }
    }
  },

  async delete(id: UUID): Promise<ServiceResult<boolean>> {
    try {
      const { error } = await supabase.from('system_notifications').delete().eq('id', id)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao excluir notificação'
      return { success: false, error: msg }
    }
  },

  async markAsRead(notificationId: UUID): Promise<ServiceResult<boolean>> {
    try {
      const { error } = await supabase.rpc('mark_system_notification_read', {
        p_notification_id: notificationId,
      })

      if (error) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('system_notification_reads').upsert({
            notification_id: notificationId,
            user_id: user.id,
            read_at: new Date().toISOString(),
          })
        }
      }

      return { success: true, data: true }
    } catch (err) {
      logger.warn('Erro ao marcar notificação como lida:', { error: String(err) })
      return { success: true, data: true }
    }
  },
}
