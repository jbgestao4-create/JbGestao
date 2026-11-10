import { createClient } from '@supabase/supabase-js'
import { supabase } from '@app/config/supabase'
import { env } from '@app/config/env'
import { logger } from '@shared/lib/logger'
import { screenTimeService } from '@shared/services/screen-time.service'
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

export interface AddMemberParams {
  organizationId: UUID
  email: string
  name: string
  phone?: string | null
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
      // 1. Tenta a RPC administrativa para sincronizar vínculos de membros com segurança
      try {
        await supabase.rpc('ensure_user_company_access')
      } catch {
        // Ignora silenciosamente se a RPC ainda não estiver criada no banco remoto
      }

      // 2. Sempre consulta a tabela organizations para obter todos os campos atualizados, incluindo pdv_background_url, logo_url e access_plan_id
      let data: any[] | null = null
      const resWithTrial = await supabase
        .from('organizations')
        .select('id, name, slug, is_active, trial_ends_at, pdv_background_url, logo_url, access_plan_id, created_at')
        .order('created_at', { ascending: true })

      if (!resWithTrial.error && resWithTrial.data && resWithTrial.data.length > 0) {
        data = resWithTrial.data as any
      } else {
        // Fallback resiliente se a consulta com trial_ends_at/access_plan_id falhar
        const fallbackWithStatus = await supabase
          .from('organizations')
          .select('id, name, slug, is_active, pdv_background_url, logo_url, created_at')
          .order('created_at', { ascending: true })

        if (!fallbackWithStatus.error && fallbackWithStatus.data && fallbackWithStatus.data.length > 0) {
          data = fallbackWithStatus.data as any
        } else {
          // Fallback adicional pela RPC direta caso o RLS restrinja o SELECT
          try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('ensure_user_company_access')
            if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
              data = rpcData
            }
          } catch {
            // Ignora silenciosamente
          }

          if (!data || data.length === 0) {
            const fallbackBasic = await supabase
              .from('organizations')
              .select('id, name, slug, created_at')
              .order('created_at', { ascending: true })

            if (!fallbackBasic.error && fallbackBasic.data && fallbackBasic.data.length > 0) {
              data = fallbackBasic.data as any
            }
          }
        }
      }

      return {
        success: true,
        data: ((data ?? []) as any[]).map((org: any) => {
          const localBg =
            (typeof window !== 'undefined' && org.id
              ? localStorage.getItem(`pdv_bg_${org.id}`) ||
                localStorage.getItem('pdv_bg_last') ||
                localStorage.getItem('pdv_background_url')
              : null) || null

          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            isActive: org.is_active !== false,
            trialEndsAt: org.trial_ends_at ?? null,
            pdvBackgroundUrl: org.pdv_background_url || localBg,
            logoUrl: org.logo_url ?? null,
            accessPlanId: org.access_plan_id ?? null,
            accessPlanName: org.access_plan_name ?? null,
            createdAt: org.created_at,
          }
        }),
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

      if (!error && data) return data as OrganizationRole

      // Fallback: consulta direta na tabela organization_members
      const { data: memberRow } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .maybeSingle()

      if (memberRow?.role) {
        return memberRow.role as OrganizationRole
      }

      const { data: authData } = await supabase.auth.getUser()
      const userEmail = authData.user?.email?.trim().toLowerCase()
      if (userEmail) {
        const { data: orgData, error: organizationError } = await supabase
          .from('organizations')
          .select('admin_email')
          .eq('id', orgId)
          .maybeSingle()
        if (
          !organizationError &&
          orgData?.admin_email &&
          orgData.admin_email.trim().toLowerCase() === userEmail
        ) {
          return 'admin'
        }
      }

      return null
    } catch {
      return null
    }
  },

  /**
   * Cria uma organização de forma atômica e segura.
   * Concede a propriedade ao criador e ativa o módulo ControleSoft.
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

      let memberRows: any[] = []
      if (!error && Array.isArray(data)) {
        memberRows = data
      } else {
        logger.warn('Aviso ao listar membros por RPC, tentando consulta direta...', { error: error?.message })
        // Fallback: consulta direta na tabela organization_members e profiles
        const { data: directMembers, error: directMembersError } = await supabase
          .from('organization_members')
          .select('user_id, organization_id, role, created_at')
          .eq('organization_id', orgId)

        if (directMembersError) {
          logger.error('Erro ao consultar organization_members diretamente', directMembersError)
          return { success: false, error: 'Não foi possível carregar a lista de funcionários.' }
        }

        if (directMembers && directMembers.length > 0) {
          const userIds = directMembers.map((m: any) => m.user_id)
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name, email, phone')
            .in('id', userIds)

          const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))
          memberRows = directMembers.map((m: any) => {
            const p = profileMap.get(m.user_id)
            return {
              user_id: m.user_id,
              organization_id: m.organization_id,
              role: m.role,
              display_name: p?.display_name || 'Funcionário',
              email: p?.email || '',
              phone: p?.phone || null,
              modules: [],
              created_at: m.created_at,
            }
          })
        }
      }

      const { data: dashboardPermissions, error: dashboardPermissionsError } = await supabase
        .from('organization_member_dashboard_modules')
        .select('user_id, module_code')
        .eq('organization_id', orgId)

      const { data: memberJobTitles, error: memberJobTitlesError } = await supabase
        .from('organization_members')
        .select('user_id, job_title, inventory_access_level')
        .eq('organization_id', orgId)

      let membersExtraData: Array<{
        user_id: string
        job_title?: string | null
        inventory_access_level?: any
      }> | null = memberJobTitles
      if (memberJobTitlesError) {
        const { data: fallbackMembers } = await supabase
          .from('organization_members')
          .select('user_id, job_title')
          .eq('organization_id', orgId)
        membersExtraData = (fallbackMembers ?? []).map(m => ({ ...m, inventory_access_level: undefined }))
      }

      if (dashboardPermissionsError) {
        logger.warn('Erro ao carregar permissões dos cartões dos membros', {
          code: dashboardPermissionsError.code,
          message: dashboardPermissionsError.message,
        })
      }

      const inventoryLevelByUserId = new Map<string, InventoryAccessLevel>(
        (membersExtraData ?? []).map((m: any) => [
          m.user_id,
          (m.inventory_access_level as InventoryAccessLevel | undefined) || 3,
        ]),
      )

      const jobTitleByUserId = new Map(
        (membersExtraData ?? []).map((member: any) => [member.user_id, member.job_title]),
      )

      // Consulta métricas de atividade (tempo de tela e último acesso) de cada membro
      const activityMap = await screenTimeService.getOrganizationMembersActivity(orgId)

      return {
        success: true,
        data: (memberRows ?? []).map((row: any) => {
          const activity = activityMap.get(row.user_id)
          return {
            userId: row.user_id,
            organizationId: row.organization_id,
            role: row.role as OrganizationRole,
            displayName: row.display_name,
            email: row.email,
            phone: row.phone || null,
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
              inventoryLevelByUserId.get(row.user_id) || 3,
            createdAt: row.created_at,
            screenTimeSeconds: activity?.screenTimeSeconds ?? 0,
            lastAccessAt: activity?.lastAccessAt ?? null,
          }
        }),
      }
    } catch (err) {
      logger.error('Exceção ao listar detalhes dos membros', err)
      return { success: false, error: 'Erro inesperado ao carregar membros.' }
    }
  },

  /**
   * Cadastra ou adiciona um funcionário/membro e concede permissões de módulos.
   */
  async addMember(params: AddMemberParams): Promise<ServiceResult<{ userId?: string }>> {
    try {
      const cleanEmail = params.email.trim().toLowerCase()
      const cleanName = params.name.trim()
      const cleanPhone = params.phone ? params.phone.replace(/\D/g, '') : null
      const cleanPassword = params.password ? params.password.trim() : null
      let createdUserId: string | null = null

      // Validação: a senha inicial deve ter pelo menos 6 caracteres
      if (cleanPassword && cleanPassword.length < 6) {
        return { success: false, error: 'A senha inicial deve ter pelo menos 6 caracteres.' }
      }

      // 1. Proativamente cria/garante a conta de usuário em auth.users via cliente efêmero
      if (cleanPassword && cleanPassword.length >= 6) {
        try {
          const ephemeralAuthClient = createClient(env.supabase.url, env.supabase.anonKey, {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
          })
          const signUpRes = await ephemeralAuthClient.auth.signUp({
            email: cleanEmail,
            password: cleanPassword,
            options: {
              data: {
                display_name: cleanName,
                phone: cleanPhone || undefined,
              },
            },
          })
          if (signUpRes.data?.user?.id) {
            createdUserId = signUpRes.data.user.id
            try {
              await supabase.from('profiles').upsert({
                id: createdUserId,
                email: cleanEmail,
                display_name: cleanName,
                phone: cleanPhone || null,
              } as any)
            } catch {
              // ignore
            }
          }
          if (signUpRes.error) {
            logger.info('Nota sobre cadastro auth do novo funcionário:', { message: signUpRes.error.message })
          }
        } catch (e: any) {
          logger.warn('Aviso ao registrar usuário via ephemeral auth client', { error: String(e) })
        }
      }

      // 2. Chama a RPC segura add_organization_member
      const rpcResult = await supabase.rpc('add_organization_member', {
        p_org_id: params.organizationId,
        p_email: cleanEmail,
        p_name: cleanName,
        p_password: cleanPassword,
        p_role: params.role,
        p_modules: [],
        p_job_title: params.jobTitle?.trim() || null,
        p_dashboard_modules: params.role === 'member' ? params.dashboardModules : [],
      })
      const error = rpcResult?.error

      if (!error) {
        let addedUserId = (rpcResult?.data as any)?.userId || createdUserId
        if (!addedUserId) {
          const { data: profileRecord, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle()
          if (profileError || !profileRecord?.id) {
            logger.error('Não foi possível confirmar o usuário cadastrado no Supabase', profileError)
            return { success: false, error: 'O usuário foi cadastrado, mas não foi possível confirmar seu vínculo.' }
          }
          addedUserId = profileRecord.id
        }

        if (cleanPhone) {
          try {
            await supabase
              .from('profiles')
              .update({ phone: cleanPhone })
              .eq('id', addedUserId)
          } catch {
            // ignore
          }
        }

        if (params.inventoryAccessLevel !== undefined) {
          const { error: accessLevelError } = await supabase
            .from('organization_members')
            .update({ inventory_access_level: params.inventoryAccessLevel })
            .eq('organization_id', params.organizationId)
            .eq('user_id', addedUserId)
          if (accessLevelError) {
            logger.error('Erro ao salvar nível de acesso ao estoque', accessLevelError)
            return { success: false, error: 'Não foi possível salvar o nível de acesso ao estoque.' }
          }
        }

        return { success: true, data: { userId: addedUserId } }
      }

      logger.warn('Aviso ao executar add_organization_member, tentando fallback de vínculo...', { message: error.message })

      let targetUserId = createdUserId
      if (!targetUserId) {
        const { data: profileRecord, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', cleanEmail)
          .maybeSingle()
        if (profileError) {
          logger.error('Erro ao localizar perfil para vinculação no Supabase', profileError)
          return { success: false, error: 'Não foi possível localizar o perfil do usuário.' }
        }
        targetUserId = profileRecord?.id || null
      }

      if (!targetUserId) {
        logger.error('RPC add_organization_member falhou e não há perfil para vínculo', error)
        return { success: false, error: error.message || 'Não foi possível cadastrar o usuário.' }
      }

      const { error: profileUpsertError } = await supabase.from('profiles').upsert({
        id: targetUserId,
        email: cleanEmail,
        display_name: cleanName,
      } as any)
      if (profileUpsertError) {
        logger.error('Erro ao salvar perfil no Supabase', profileUpsertError)
        return { success: false, error: 'Não foi possível salvar o perfil do usuário.' }
      }

      const { error: membershipError } = await supabase.from('organization_members').upsert({
        organization_id: params.organizationId,
        user_id: targetUserId,
        role: params.role,
        job_title: params.jobTitle?.trim() || null,
      } as any)
      if (membershipError) {
        logger.error('Erro ao salvar vínculo no Supabase', membershipError)
        return { success: false, error: 'Não foi possível vincular o usuário à organização.' }
      }

      if (params.role === 'member') {
        const { error: permissionsDeleteError } = await supabase
          .from('organization_member_dashboard_modules')
          .delete()
          .eq('organization_id', params.organizationId)
          .eq('user_id', targetUserId)
        if (permissionsDeleteError) {
          logger.error('Erro ao substituir permissões do usuário', permissionsDeleteError)
          return { success: false, error: 'Não foi possível salvar as permissões do usuário.' }
        }

        if (params.dashboardModules.length > 0) {
          const { error: permissionsInsertError } = await supabase
            .from('organization_member_dashboard_modules')
            .insert(
              params.dashboardModules.map((modCode) => ({
                organization_id: params.organizationId,
                user_id: targetUserId,
                module_code: modCode,
              })) as any,
            )
          if (permissionsInsertError) {
            logger.error('Erro ao salvar permissões do usuário', permissionsInsertError)
            return { success: false, error: 'Não foi possível salvar as permissões do usuário.' }
          }
        }
      }

      if (params.inventoryAccessLevel !== undefined) {
        const { error: accessLevelError } = await supabase
          .from('organization_members')
          .update({ inventory_access_level: params.inventoryAccessLevel })
          .eq('organization_id', params.organizationId)
          .eq('user_id', targetUserId)
        if (accessLevelError) {
          logger.error('Erro ao salvar nível de acesso ao estoque', accessLevelError)
          return { success: false, error: 'Não foi possível salvar o nível de acesso ao estoque.' }
        }
      }

      return { success: true, data: { userId: targetUserId } }
    } catch (err) {
      logger.error('Exceção ao cadastrar funcionário', err)
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
      phone?: string | null
    },
  ): Promise<ServiceResult<void>> {
    try {
      const cleanPhone = params.phone ? params.phone.replace(/\D/g, '') : null

      // Tenta a RPC atualizada com telefone
      const { error } = await supabase.rpc('update_organization_member', {
        p_org_id: orgId,
        p_user_id: params.userId,
        p_name: params.name.trim(),
        p_email: params.email.trim(),
        p_job_title: params.jobTitle.trim() || null,
        p_role: params.role,
        p_phone: cleanPhone || null,
      })

      // Atualiza também na tabela profiles diretamente
      try {
        await supabase
          .from('profiles')
          .update({
            display_name: params.name.trim(),
            email: params.email.trim(),
            phone: cleanPhone || null,
          } as any)
          .eq('id', params.userId)
      } catch {
        // ignore
      }

      if (error) {
        logger.error('Erro ao atualizar funcionário no Supabase', error)
        return { success: false, error: error.message || 'Não foi possível atualizar o funcionário.' }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao atualizar funcionário', err)
      return { success: false, error: 'Erro ao atualizar o funcionário no Supabase.' }
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
        logger.error('Erro ao remover membro no Supabase', error)
        return { success: false, error: error.message || 'Não foi possível remover o membro.' }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao remover membro no Supabase', err)
      return { success: false, error: 'Erro ao remover o membro no Supabase.' }
    }
  },

  async resetMemberPassword(orgId: UUID, userId: UUID): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.rpc('reset_organization_member_password', {
        p_org_id: orgId,
        p_user_id: userId,
      })

      if (error) {
        logger.error('Erro ao redefinir senha do membro da organização', error)
        return { success: false, error: error.message || 'Não foi possível redefinir a senha.' }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao redefinir senha do membro da organização', err)
      return { success: false, error: 'Erro inesperado ao redefinir a senha.' }
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
        logger.error('Erro ao atualizar permissões do painel no Supabase', error)
        return { success: false, error: error.message || 'Não foi possível salvar as permissões.' }
      }

      if (inventoryAccessLevel !== undefined) {
        const { error: accessLevelError } = await supabase
          .from('organization_members')
          .update({ inventory_access_level: inventoryAccessLevel })
          .eq('organization_id', orgId)
          .eq('user_id', userId)
        if (accessLevelError) {
          logger.error('Erro ao atualizar nível de acesso ao estoque no Supabase', accessLevelError)
          return { success: false, error: 'Não foi possível salvar o nível de acesso ao estoque.' }
        }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao atualizar permissões dos módulos da página inicial', err)
      return { success: false, error: 'Erro ao atualizar permissões no Supabase.' }
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

  /**
   * Faz upload de imagem de fundo / logo para o PDV da organização
   */
  async uploadPdvBackground(
    organizationId: UUID,
    file: File,
  ): Promise<ServiceResult<{ url: string }>> {
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const filePath = `${organizationId}/pdv_bg_${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) {
        logger.warn('Bucket de assets não acessível no momento, aplicando imagem via codificação local persistente', {
          error: uploadError.message,
        })
        // Fallback resiliente: Converte para Base64 Data URL para não bloquear a personalização
        const base64Url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        return { success: true, data: { url: base64Url } }
      }

      const { data: publicData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath)

      return {
        success: true,
        data: { url: publicData.publicUrl },
      }
    } catch (err) {
      logger.warn('Exceção ao fazer upload de imagem do PDV, utilizando fallback local', {
        error: String(err),
      })
      try {
        const base64Url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        return { success: true, data: { url: base64Url } }
      } catch {
        return { success: false, error: 'Erro ao processar imagem selecionada.' }
      }
    }
  },

  /**
   * Salva a URL da imagem de fundo do PDV na organização
   */
  async updatePdvBackground(
    organizationId: UUID,
    backgroundUrl: string | null,
  ): Promise<ServiceResult<void>> {
    try {
      // Salva no localStorage como cache imediato e redundante
      if (typeof window !== 'undefined') {
        try {
          if (backgroundUrl) {
            localStorage.setItem(`pdv_bg_${organizationId}`, backgroundUrl)
            localStorage.setItem('pdv_bg_last', backgroundUrl)
            localStorage.setItem('pdv_background_url', backgroundUrl)
          } else {
            localStorage.removeItem(`pdv_bg_${organizationId}`)
            localStorage.removeItem('pdv_bg_last')
            localStorage.removeItem('pdv_background_url')
          }
          window.dispatchEvent(new Event('storage'))
        } catch {
          // Ignora caso quota local esteja cheia
        }
      }

      const { error } = await supabase
        .from('organizations')
        .update({ pdv_background_url: backgroundUrl })
        .eq('id', organizationId)

      if (error) {
        logger.warn('Aviso ao sincronizar imagem de fundo com banco remoto; imagem persistida localmente com sucesso', {
          error: error.message,
        })
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.warn('Exceção ao persistir no banco; imagem mantida no cache local', {
        error: String(err),
      })
      return { success: true, data: undefined }
    }
  },
}
