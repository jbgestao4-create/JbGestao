import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import { DASHBOARD_MODULES } from '@modules/access-control/services/module-access.service'
import type {
  ModuleCode,
  DashboardModuleCode,
  InventoryAccessLevel,
  Organization,
  OrganizationMemberDetail,
  OrganizationMembership,
  OrganizationRole,
  ServiceResult,
  UUID,
} from '@shared/types/common'

const INVENTORY_LEVELS_STORAGE_KEY = 'orcafacil_inventory_access_levels'

export function getStoredInventoryLevels(orgId: string): Record<string, InventoryAccessLevel> {
  try {
    const raw = localStorage.getItem(`${INVENTORY_LEVELS_STORAGE_KEY}_${orgId}`)
    return raw ? (JSON.parse(raw) as Record<string, InventoryAccessLevel>) : {}
  } catch {
    return {}
  }
}

export function saveStoredInventoryLevel(
  orgId: string,
  userId: string,
  level: InventoryAccessLevel,
): void {
  try {
    const current = getStoredInventoryLevels(orgId)
    current[userId] = level
    localStorage.setItem(`${INVENTORY_LEVELS_STORAGE_KEY}_${orgId}`, JSON.stringify(current))
  } catch {
    // Silently ignore storage errors
  }
}

export interface AddMemberParams {
  organizationId: UUID
  email: string
  name: string
  jobTitle: string | null
  password?: string
  role: OrganizationRole
  dashboardModules: DashboardModuleCode[]
  inventoryAccessLevel?: InventoryAccessLevel
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
   * Concede a propriedade ao criador e ativa o módulo JB Software.
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

      const { data: dashboardPermissions, error: dashboardPermissionsError } = await supabase
        .from('organization_member_dashboard_modules')
        .select('user_id, module_code')
        .eq('organization_id', orgId)

      const { data: memberJobTitles, error: memberJobTitlesError } = await supabase
        .from('organization_members')
        .select('user_id, job_title, inventory_access_level')
        .eq('organization_id', orgId)

      let membersExtraData = memberJobTitles
      if (memberJobTitlesError) {
        const { data: fallbackMembers } = await supabase
          .from('organization_members')
          .select('user_id, job_title')
          .eq('organization_id', orgId)
        membersExtraData = fallbackMembers ?? []
      }

      if (dashboardPermissionsError) {
        logger.warn('Erro ao carregar permissões dos cartões dos membros', {
          code: dashboardPermissionsError.code,
          message: dashboardPermissionsError.message,
        })
      }

      const storedLevels = getStoredInventoryLevels(orgId)
      const inventoryLevelByUserId = new Map<string, InventoryAccessLevel>(
        (membersExtraData ?? []).map((m: any) => [
          m.user_id,
          ((m.inventory_access_level as InventoryAccessLevel | undefined) ||
            storedLevels[m.user_id] ||
            3),
        ]),
      )

      const jobTitleByUserId = new Map(
        (membersExtraData ?? []).map((member: any) => [member.user_id, member.job_title]),
      )

      return {
        success: true,
        data: (data ?? []).map((row: any) => ({
          userId: row.user_id,
          organizationId: row.organization_id,
          role: row.role as OrganizationRole,
          displayName: row.display_name,
          email: row.email,
          jobTitle: jobTitleByUserId.get(row.user_id) ?? null,
          modules: (row.modules ?? []) as ModuleCode[],
          dashboardModules:
            row.role !== 'member'
              ? []
              : dashboardPermissionsError
                ? DASHBOARD_MODULES.map((module) => module.code)
                : (dashboardPermissions ?? [])
                    .filter((permission) => permission.user_id === row.user_id)
                    .map((permission) => permission.module_code),
          inventoryAccessLevel:
            inventoryLevelByUserId.get(row.user_id) || storedLevels[row.user_id] || 3,
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
        p_modules: [],
        p_job_title: params.jobTitle?.trim() || null,
        p_dashboard_modules: params.dashboardModules,
      })

      if (error) {
        logger.warn('Erro ao adicionar membro', { message: error.message })
        return { success: false, error: error.message }
      }

      if (params.inventoryAccessLevel !== undefined) {
        const { data: memberRecord } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', params.organizationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (memberRecord?.user_id) {
          saveStoredInventoryLevel(
            params.organizationId,
            memberRecord.user_id,
            params.inventoryAccessLevel,
          )
          try {
            await supabase
              .from('organization_members')
              .update({ inventory_access_level: params.inventoryAccessLevel })
              .eq('organization_id', params.organizationId)
              .eq('user_id', memberRecord.user_id)
          } catch {
            // Ignora se coluna ainda não existir no DB remoto
          }
        }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao adicionar membro', err)
      return { success: false, error: 'Erro inesperado ao cadastrar funcionário.' }
    }
  },

  /**
   * Atualiza nome, e-mail, cargo e papel de um membro da organização.
   */
  async updateMemberDetails(
    orgId: UUID,
    params: {
      userId: UUID
      name: string
      jobTitle: string
      email: string
      role: OrganizationRole
    },
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.rpc('update_organization_member', {
        p_org_id: orgId,
        p_user_id: params.userId,
        p_name: params.name.trim(),
        p_email: params.email.trim(),
        p_job_title: params.jobTitle.trim() || null,
        p_role: params.role,
      })

      if (error) {
        logger.warn('Erro ao atualizar funcionário', { message: error.message })
        return { success: false, error: error.message }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao atualizar funcionário', err)
      return { success: false, error: 'Erro inesperado ao atualizar funcionário.' }
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
   * Atualiza os módulos da página inicial permitidos para um membro operacional e seu nível de estoque.
   */
  async updateMemberDashboardModules(
    orgId: UUID,
    userId: UUID,
    modules: DashboardModuleCode[],
    inventoryAccessLevel?: InventoryAccessLevel,
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.rpc('update_member_dashboard_modules', {
        p_org_id: orgId,
        p_user_id: userId,
        p_modules: modules,
      })

      if (error) {
        logger.error('Erro ao atualizar permissões dos módulos da página inicial', error)
        return { success: false, error: error.message }
      }

      if (inventoryAccessLevel !== undefined) {
        saveStoredInventoryLevel(orgId, userId, inventoryAccessLevel)
        try {
          await supabase
            .from('organization_members')
            .update({ inventory_access_level: inventoryAccessLevel })
            .eq('organization_id', orgId)
            .eq('user_id', userId)
        } catch {
          // Ignora se coluna ainda não existir no DB remoto
        }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao atualizar permissões dos módulos da página inicial', err)
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
