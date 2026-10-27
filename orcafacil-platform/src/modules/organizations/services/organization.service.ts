import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type {
  ModuleCode,
  Organization,
  OrganizationMemberDetail,
  OrganizationMembership,
  OrganizationRole,
  ServiceResult,
  UUID,
} from '@shared/types/common'

export interface AddMemberParams {
  organizationId: UUID
  email: string
  name: string
  password?: string
  role: OrganizationRole
  modules: ModuleCode[]
}

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
   * Lista os membros de uma organização com dados básicos.
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
   * Lista membros da organização com detalhes de perfil e módulos permitidos.
   */
  async getMembersWithDetails(orgId: UUID): Promise<ServiceResult<OrganizationMemberDetail[]>> {
    try {
      const { data, error } = await supabase.rpc('get_organization_members_with_details', {
        p_org_id: orgId,
      })

      if (error) {
        logger.error('Erro ao listar membros detalhados', error)
        return { success: false, error: 'Não foi possível carregar a lista de funcionários.' }
      }

      return {
        success: true,
        data: (data ?? []).map((row: any) => ({
          userId: row.user_id,
          organizationId: row.organization_id,
          role: row.role as OrganizationRole,
          displayName: row.display_name,
          email: row.email,
          modules: (row.modules ?? []) as ModuleCode[],
          createdAt: row.created_at,
        })),
      }
    } catch (err) {
      logger.error('Exceção ao listar detalhes dos membros', err)
      return { success: false, error: 'Erro inesperado ao carregar membros.' }
    }
  },

  /**
   * Cadastra ou adiciona um funcionário/membro e concede permissões de módulos.
   */
  async addMember(params: AddMemberParams): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.rpc('add_organization_member', {
        p_org_id: params.organizationId,
        p_email: params.email.trim(),
        p_name: params.name.trim(),
        p_password: params.password ? params.password.trim() : null,
        p_role: params.role,
        p_modules: params.modules,
      })

      if (error) {
        logger.warn('Erro ao adicionar membro', { message: error.message })
        return { success: false, error: error.message }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao adicionar membro', err)
      return { success: false, error: 'Erro inesperado ao cadastrar funcionário.' }
    }
  },

  /**
   * Remove um funcionário/membro da organização.
   */
  async removeMember(orgId: UUID, userId: UUID): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.rpc('remove_organization_member', {
        p_org_id: orgId,
        p_user_id: userId,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao remover membro', err)
      return { success: false, error: 'Erro inesperado ao remover membro.' }
    }
  },

  /**
   * Atualiza as permissões de módulos de um membro.
   */
  async updateMemberModules(
    orgId: UUID,
    userId: UUID,
    modules: ModuleCode[],
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.rpc('update_member_modules', {
        p_org_id: orgId,
        p_user_id: userId,
        p_modules: modules,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao atualizar permissões de módulos do membro', err)
      return { success: false, error: 'Erro inesperado ao atualizar permissões.' }
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
