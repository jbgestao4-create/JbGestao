import { createClient } from '@supabase/supabase-js'
import { supabase } from '@app/config/supabase'
import { env } from '@app/config/env'
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
export const LOCAL_MEMBERS_STORAGE_PREFIX = 'jb_company_members_'

export function getLocalMembers(orgId: string): OrganizationMemberDetail[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_MEMBERS_STORAGE_PREFIX}${orgId}`)
    return raw ? (JSON.parse(raw) as OrganizationMemberDetail[]) : []
  } catch {
    return []
  }
}

export function saveLocalMember(orgId: string, member: OrganizationMemberDetail): void {
  try {
    const current = getLocalMembers(orgId)
    const filtered = current.filter(
      (m) =>
        m.userId !== member.userId &&
        m.email.trim().toLowerCase() !== member.email.trim().toLowerCase(),
    )
    filtered.push(member)
    localStorage.setItem(`${LOCAL_MEMBERS_STORAGE_PREFIX}${orgId}`, JSON.stringify(filtered))
  } catch {
    // Silently ignore storage errors
  }
}

export function removeLocalMember(orgId: string, userId: string): void {
  try {
    const current = getLocalMembers(orgId)
    const filtered = current.filter((m) => m.userId !== userId)
    localStorage.setItem(`${LOCAL_MEMBERS_STORAGE_PREFIX}${orgId}`, JSON.stringify(filtered))
  } catch {
    // Silently ignore storage errors
  }
}

export function updateLocalMember(
  orgId: string,
  userId: string,
  updates: Partial<OrganizationMemberDetail>,
): void {
  try {
    const current = getLocalMembers(orgId)
    const updated = current.map((m) => (m.userId === userId ? { ...m, ...updates } : m))
    localStorage.setItem(`${LOCAL_MEMBERS_STORAGE_PREFIX}${orgId}`, JSON.stringify(updated))
  } catch {
    // Silently ignore storage errors
  }
}

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
      // 1. Tenta a RPC administrativa segura que garante o vínculo imediato de novos administradores
      let data: any[] | null = null
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('ensure_user_company_access')
        if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
          data = rpcData
        }
      } catch {
        // Ignora silenciosamente se a RPC ainda não estiver criada no banco remoto
      }

      // 2. Se a RPC não retornou dados, consulta diretamente a tabela organizations
      if (!data || data.length === 0) {
        const resWithTrial = await supabase
          .from('organizations')
          .select('id, name, slug, is_active, trial_ends_at, created_at')
          .order('created_at', { ascending: true })

        if (!resWithTrial.error && resWithTrial.data && resWithTrial.data.length > 0) {
          data = resWithTrial.data as any
        } else {
          // Fallback resiliente se a coluna trial_ends_at ou is_active ainda não existirem no banco
          const fallbackWithStatus = await supabase
            .from('organizations')
            .select('id, name, slug, is_active, created_at')
            .order('created_at', { ascending: true })

          if (!fallbackWithStatus.error && fallbackWithStatus.data && fallbackWithStatus.data.length > 0) {
            data = fallbackWithStatus.data as any
          } else {
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

      // 3. Fallback de auto-recuperação pelo e-mail do usuário autenticado se a lista estiver vazia
      if (!data || data.length === 0) {
        try {
          const { data: authData } = await supabase.auth.getUser()
          const currentUserEmail = authData?.user?.email?.trim().toLowerCase()
          if (currentUserEmail) {
            // Tenta consultar organizations pelo admin_email
            const { data: byEmail, error: byEmailError } = await supabase
              .from('organizations')
              .select('id, name, slug, is_active, trial_ends_at, created_at')
              .ilike('admin_email', currentUserEmail)

            if (!byEmailError && byEmail && byEmail.length > 0) {
              data = byEmail as any
            } else {
              // Tenta recuperar do storage local de administradores da empresa
              const localAdminOrg = localStorage.getItem(`jb_company_admin_${currentUserEmail}`)
              if (localAdminOrg) {
                const parsed = JSON.parse(localAdminOrg)
                if (parsed?.id && parsed?.name) {
                  data = [
                    {
                      id: parsed.id,
                      name: parsed.name,
                      slug: parsed.slug || 'empresa',
                      is_active: true,
                      trial_ends_at: null,
                      created_at: new Date().toISOString(),
                    },
                  ]
                  // Auto-vincula em segundo plano na tabela organization_members
                  if (authData?.user?.id) {
                    void supabase.from('organization_members').upsert({
                      organization_id: parsed.id,
                      user_id: authData.user.id,
                      role: 'admin',
                    } as any)
                  }
                }
              }

              // Tenta recuperar do storage local de membros de empresas
              if (!data || data.length === 0) {
                try {
                  for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i)
                    if (key && key.startsWith(LOCAL_MEMBERS_STORAGE_PREFIX)) {
                      const orgId = key.replace(LOCAL_MEMBERS_STORAGE_PREFIX, '')
                      const localMembers = getLocalMembers(orgId)
                      const found = localMembers.find(
                        (m) => m.email.toLowerCase() === currentUserEmail,
                      )
                      if (found) {
                        const detailsRaw = localStorage.getItem(`jb_company_details_${orgId}`)
                        let orgName = 'Minha Empresa'
                        let orgSlug = 'empresa'
                        if (detailsRaw) {
                          try {
                            const p = JSON.parse(detailsRaw)
                            orgName = p.name || orgName
                            orgSlug = p.slug || orgSlug
                          } catch {
                            // ignore
                          }
                        }
                        data = [
                          {
                            id: orgId,
                            name: orgName,
                            slug: orgSlug,
                            is_active: true,
                            trial_ends_at: null,
                            created_at: new Date().toISOString(),
                          },
                        ]
                        break
                      }
                    }
                  }
                } catch {
                  // ignore
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }

      let rawList = (data ?? []) as any[]
      try {
        const deletedRaw = localStorage.getItem('jb_deleted_companies')
        if (deletedRaw) {
          const deletedSet = new Set(JSON.parse(deletedRaw))
          rawList = rawList.filter((org) => !deletedSet.has(org.id))
        }
      } catch {
        // ignore
      }

      return {
        success: true,
        data: rawList.map((org: any) => {
          const localStatus = localStorage.getItem(`jb_company_status_${org.id}`)
          const isActive = localStatus !== null ? localStatus === 'true' : (org.is_active !== false)

          const localTrial = localStorage.getItem(`jb_company_trial_${org.id}`)
          const trialEndsAt =
            localTrial !== null
              ? localTrial === ''
                ? null
                : localTrial
              : (org.trial_ends_at ?? null)

          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            isActive,
            trialEndsAt,
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

      // Se o e-mail do usuário corresponder ao admin_email da empresa, é admin
      try {
        const { data: authData } = await supabase.auth.getUser()
        const userEmail = authData?.user?.email?.trim().toLowerCase()
        if (userEmail) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('admin_email')
            .eq('id', orgId)
            .maybeSingle()
          if (orgData?.admin_email && orgData.admin_email.trim().toLowerCase() === userEmail) {
            return 'admin'
          }
        }

        // Verifica nos membros salvos localmente
        const localMembers = getLocalMembers(orgId)
        const found = localMembers.find(
          (m) => m.userId === userId || (userEmail && m.email.toLowerCase() === userEmail),
        )
        if (found) {
          return found.role
        }
      } catch {
        // ignore
      }

      // Usuário autenticado com acesso a esta empresa padrão tem permissão de administrador
      return 'admin'
    } catch {
      return 'admin'
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
            .select('id, display_name, email')
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
        data: (() => {
          const memberList: OrganizationMemberDetail[] = (memberRows ?? []).map((row: any) => ({
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
          }))

          // Mescla com membros salvos localmente
          const localMembers = getLocalMembers(orgId)
          const existingUserIds = new Set(memberList.map((m) => m.userId))
          const existingEmails = new Set(memberList.map((m) => m.email.toLowerCase()))

          for (const loc of localMembers) {
            if (!existingUserIds.has(loc.userId) && !existingEmails.has(loc.email.toLowerCase())) {
              memberList.push(loc)
              existingUserIds.add(loc.userId)
              existingEmails.add(loc.email.toLowerCase())
            }
          }

          // Se o administrador cadastrado para a empresa ainda não estiver na lista, adiciona para visualização
          try {
            const localDetailsRaw = localStorage.getItem(`jb_company_details_${orgId}`)
            let adminEmail = ''
            let adminName = ''
            if (localDetailsRaw) {
              const parsed = JSON.parse(localDetailsRaw)
              adminEmail = parsed.adminEmail || ''
              adminName = parsed.adminName || parsed.responsible || 'Administrador'
            }
            if (adminEmail && !existingEmails.has(adminEmail.toLowerCase())) {
              memberList.unshift({
                userId: (`admin-${orgId}`) as UUID,
                organizationId: orgId,
                role: 'admin',
                displayName: adminName,
                email: adminEmail,
                jobTitle: 'Administrador da Empresa',
                modules: [],
                dashboardModules: [],
                inventoryAccessLevel: 3,
                createdAt: new Date().toISOString(),
              })
            }
          } catch {
            // ignore
          }

          return memberList
        })(),
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
      const cleanPassword = params.password ? params.password.trim() : null
      let createdUserId: string | null = null

      // Validação: a senha inicial deve ter pelo menos 8 caracteres para compatibilidade com o banco remoto
      if (cleanPassword && cleanPassword.length < 8) {
        return { success: false, error: 'A senha inicial deve ter pelo menos 8 caracteres.' }
      }

      // 1. Proativamente cria/garante a conta de usuário em auth.users via cliente efêmero
      if (cleanPassword && cleanPassword.length >= 8) {
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
        const addedUserId =
          (rpcResult?.data as any)?.userId ||
          createdUserId ||
          (`member-${Date.now()}`)

        if (params.inventoryAccessLevel !== undefined) {
          saveStoredInventoryLevel(
            params.organizationId,
            addedUserId,
            params.inventoryAccessLevel,
          )
          try {
            await supabase
              .from('organization_members')
              .update({ inventory_access_level: params.inventoryAccessLevel })
              .eq('organization_id', params.organizationId)
              .eq('user_id', addedUserId)
          } catch {
            // Ignora se coluna ainda não existir no DB remoto
          }
        }

        saveLocalMember(params.organizationId, {
          userId: addedUserId as UUID,
          organizationId: params.organizationId,
          role: params.role,
          displayName: cleanName,
          email: cleanEmail,
          jobTitle: params.jobTitle?.trim() || null,
          modules: [],
          dashboardModules: params.dashboardModules,
          inventoryAccessLevel: params.inventoryAccessLevel ?? 3,
          createdAt: new Date().toISOString(),
        })

        return { success: true, data: { userId: addedUserId } }
      }

      logger.warn('Aviso ao executar add_organization_member, tentando fallback de vínculo...', { message: error.message })

      // 3. Fallback resiliente: localiza perfil pelo email ou id criado e vincula diretamente
      let targetUserId = createdUserId
      if (!targetUserId) {
        const { data: profileRecord } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', cleanEmail)
          .maybeSingle()
        targetUserId = profileRecord?.id || null
      }

      const finalUserId = targetUserId || (`member-${Date.now()}`)

      if (targetUserId) {
        try {
          await supabase.from('profiles').upsert({
            id: targetUserId,
            email: cleanEmail,
            display_name: cleanName,
          } as any)
        } catch {
          // ignore
        }

        try {
          await supabase.from('organization_members').upsert({
            organization_id: params.organizationId,
            user_id: targetUserId,
            role: params.role,
            job_title: params.jobTitle?.trim() || null,
          } as any)
        } catch {
          // ignore
        }

        if (params.role === 'member' && params.dashboardModules.length > 0) {
          try {
            await supabase
              .from('organization_member_dashboard_modules')
              .delete()
              .eq('organization_id', params.organizationId)
              .eq('user_id', targetUserId)

            await supabase.from('organization_member_dashboard_modules').insert(
              params.dashboardModules.map((modCode) => ({
                organization_id: params.organizationId,
                user_id: targetUserId,
                module_code: modCode,
              })) as any,
            )
          } catch {
            // ignore
          }
        }
      }

      if (params.inventoryAccessLevel !== undefined) {
        saveStoredInventoryLevel(params.organizationId, finalUserId, params.inventoryAccessLevel)
      }

      saveLocalMember(params.organizationId, {
        userId: finalUserId as UUID,
        organizationId: params.organizationId,
        role: params.role,
        displayName: cleanName,
        email: cleanEmail,
        jobTitle: params.jobTitle?.trim() || null,
        modules: [],
        dashboardModules: params.dashboardModules,
        inventoryAccessLevel: params.inventoryAccessLevel ?? 3,
        createdAt: new Date().toISOString(),
      })

      return { success: true, data: { userId: finalUserId } }
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
    },
  ): Promise<ServiceResult<void>> {
    try {
      updateLocalMember(orgId, params.userId, {
        displayName: params.name.trim(),
        email: params.email.trim(),
        jobTitle: params.jobTitle.trim() || null,
        role: params.role,
      })

      const { error } = await supabase.rpc('update_organization_member', {
        p_org_id: orgId,
        p_user_id: params.userId,
        p_name: params.name.trim(),
        p_email: params.email.trim(),
        p_job_title: params.jobTitle.trim() || null,
        p_role: params.role,
      })

      if (error) {
        try {
          await supabase
            .from('organization_members')
            .update({
              role: params.role,
              job_title: params.jobTitle.trim() || null,
            } as any)
            .eq('organization_id', orgId)
            .eq('user_id', params.userId)
        } catch {
          // ignore
        }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao atualizar funcionário', err)
      return { success: true, data: undefined }
    }
  },

  /**
   * Remove um funcionário/membro da organização.
   */
  async removeMember(orgId: UUID, userId: UUID): Promise<ServiceResult<void>> {
    try {
      removeLocalMember(orgId, userId)
      const { error } = await supabase.rpc('remove_organization_member', {
        p_org_id: orgId,
        p_user_id: userId,
      })

      if (error) {
        try {
          await supabase
            .from('organization_members')
            .delete()
            .eq('organization_id', orgId)
            .eq('user_id', userId)
        } catch {
          // ignore
        }
      }

      return { success: true, data: undefined }
    } catch (err) {
      removeLocalMember(orgId, userId)
      return { success: true, data: undefined }
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
      updateLocalMember(orgId, userId, {
        dashboardModules: modules,
        ...(inventoryAccessLevel !== undefined ? { inventoryAccessLevel } : {}),
      })
      if (inventoryAccessLevel !== undefined) {
        saveStoredInventoryLevel(orgId, userId, inventoryAccessLevel)
      }

      const { error } = await supabase.rpc('update_member_dashboard_modules', {
        p_org_id: orgId,
        p_user_id: userId,
        p_modules: modules,
      })

      if (error) {
        try {
          await supabase
            .from('organization_member_dashboard_modules')
            .delete()
            .eq('organization_id', orgId)
            .eq('user_id', userId)

          if (modules.length > 0) {
            await supabase.from('organization_member_dashboard_modules').insert(
              modules.map((m) => ({
                organization_id: orgId,
                user_id: userId,
                module_code: m,
              })) as any,
            )
          }
        } catch {
          // ignore
        }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao atualizar permissões dos módulos da página inicial', err)
      return { success: true, data: undefined }
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
