import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type {
  Organization,
  OrganizationMembership,
  OrganizationRole,
  ServiceResult,
  UUID,
} from '@shared/types/common'

export const organizationService = {
  /**
   * Lista todas as organizações das quais o usuário é membro.
   */
  async getUserOrganizations(): Promise<ServiceResult<Organization[]>> {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug, created_at')
        .order('created_at', { ascending: true })

      if (error) {
        logger.error('Erro ao listar organizações do usuário', error)
        return { success: false, error: 'Não foi possível carregar suas organizações.' }
      }

      return {
        success: true,
        data: (data ?? []).map((org) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          createdAt: org.created_at,
        })),
      }
    } catch (err) {
      logger.error('Exceção ao listar organizações', err)
      return { success: false, error: 'Erro inesperado ao consultar organizações.' }
    }
  },

  /**
   * Obtém o papel do usuário na organização especificada.
   */
  async getUserRole(orgId: UUID, userId: UUID): Promise<OrganizationRole | null> {
    try {
      const { data, error } = await supabase.rpc('get_user_organization_role', {
        org_id: orgId,
        uid: userId,
      })

      if (error || !data) return null
      return data as OrganizationRole
    } catch {
      return null
    }
  },

  /**
   * Cria uma organização de forma atômica e segura.
   * Concede a propriedade ao criador e ativa o módulo OrçaFácil.
   */
  async createOrganization(
    name: string,
    slug: string,
    ownerUserId: UUID,
  ): Promise<ServiceResult<UUID>> {
    try {
      const { data, error } = await supabase.rpc('create_organization_with_owner', {
        org_name: name.trim(),
        org_slug: slug.trim().toLowerCase(),
        owner_user_id: ownerUserId,
      })

      if (error) {
        logger.warn('Erro ao criar organização', { message: error.message })
        if (error.message.includes('unique') || error.message.includes('slug')) {
          return {
            success: false,
            error: 'Este identificador (slug) já está em uso por outra organização.',
          }
        }
        return {
          success: false,
          error: 'Não foi possível criar a organização. Verifique os dados.',
        }
      }

      return { success: true, data: data as UUID }
    } catch (err) {
      logger.error('Exceção ao criar organização', err)
      return { success: false, error: 'Erro interno ao criar organização.' }
    }
  },

  /**
   * Lista os membros de uma organização.
   */
  async getMembers(orgId: UUID): Promise<ServiceResult<OrganizationMembership[]>> {
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id, user_id, role')
        .eq('organization_id', orgId)

      if (error) {
        logger.error('Erro ao listar membros da organização', error)
        return { success: false, error: 'Não foi possível listar os membros da organização.' }
      }

      return {
        success: true,
        data: (data ?? []).map((m) => ({
          organizationId: m.organization_id,
          userId: m.user_id,
          role: m.role as OrganizationRole,
        })),
      }
    } catch (err) {
      logger.error('Exceção ao listar membros', err)
      return { success: false, error: 'Erro inesperado ao buscar membros.' }
    }
  },

  /**
   * Atualiza as informações básicas da organização.
   */
  async updateOrganization(
    orgId: UUID,
    params: { name?: string; slug?: string },
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.from('organizations').update(params).eq('id', orgId)

      if (error) {
        return { success: false, error: 'Falha ao atualizar dados da organização.' }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao atualizar organização', err)
      return { success: false, error: 'Erro inesperado ao atualizar a organização.' }
    }
  },
}
