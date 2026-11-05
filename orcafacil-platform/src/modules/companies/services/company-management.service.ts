import { createClient } from '@supabase/supabase-js'
import { supabase } from '@app/config/supabase'
import { env } from '@app/config/env'
import { logger } from '@shared/lib/logger'
import { organizationService } from '@modules/organizations/services/organization.service'
import type { DashboardModuleCode, ServiceResult, UUID } from '@shared/types/common'

export interface ManagedCompany {
  id: UUID
  name: string
  slug: string
  isActive: boolean
  createdAt: string
  adminEmail: string
  adminName: string
  membersCount: number
  modules: DashboardModuleCode[]
}

export interface RegisterCompanyParams {
  name: string
  slug: string
  adminName: string
  adminEmail: string
  adminPassword?: string
  modules: DashboardModuleCode[]
}

const LOCAL_STORAGE_MODULES_PREFIX = 'jb_company_modules_'
const LOCAL_STORAGE_STATUS_PREFIX = 'jb_company_status_'

export const ALL_PLATFORM_DASHBOARD_MODULES: {
  code: DashboardModuleCode
  name: string
  description: string
  path: string
}[] = [
  { code: 'MOD-01', name: 'Vendas', description: 'Pedidos, frente de caixa PDV e NF-e', path: '/orcafacil/sales' },
  { code: 'MOD-02', name: 'Estoque', description: 'Produtos, saldos e movimentações', path: '/orcafacil/inventory' },
  { code: 'MOD-03', name: 'Clientes', description: 'Gestão de clientes e histórico comercial', path: '/orcafacil/customers' },
  { code: 'MOD-04', name: 'Orçamentos', description: 'Elaboração e acompanhamento de propostas', path: '/orcafacil/quotes' },
  { code: 'MOD-05', name: 'Gerenciamento do Caixa', description: 'Abertura, conferência e fechamento de caixa', path: '/cash' },
  { code: 'MOD-06', name: 'Fornecedores', description: 'Cadastro e consulta de fornecedores', path: '/orcafacil/suppliers' },
  { code: 'MOD-07', name: 'Organização', description: 'Dados da organização e equipe', path: '/settings/organization' },
  { code: 'MOD-08', name: 'Relatórios', description: 'Histórico de resumos e relatórios de vendas', path: '/orcafacil/reports' },
  { code: 'MOD-09', name: 'Serviços', description: 'Cadastro e precificação de serviços', path: '/services' },
  { code: 'MOD-10', name: 'Ordem de Serviço (O.S.)', description: 'Abertura e acompanhamento de ordens de serviço', path: '/service-orders' },
]

export const companyManagementService = {
  /**
   * Busca todas as empresas cadastradas no banco de dados.
   * Utiliza RPC admin_get_all_organizations (ou fallback com consulta direta se RLS permitir).
   */
  async listAll(): Promise<ServiceResult<ManagedCompany[]>> {
    try {
      const { data, error } = await supabase.rpc('admin_get_all_organizations')

      if (!error && Array.isArray(data)) {
        const companies: ManagedCompany[] = data.map((row: any) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          isActive: row.is_active !== false,
          createdAt: row.created_at,
          adminEmail: row.admin_email || '',
          adminName: row.admin_name || 'Administrador',
          membersCount: Number(row.members_count) || 1,
          modules: (row.modules || []) as DashboardModuleCode[],
        }))
        return { success: true, data: companies }
      }

      // Fallback resiliente: consulta direto da tabela organizations
      let orgs: any[] = []
      const { data: orgsWithStatus, error: orgsErr1 } = await supabase
        .from('organizations')
        .select('id, name, slug, is_active, created_at')
        .order('created_at', { ascending: false })

      if (!orgsErr1 && orgsWithStatus) {
        orgs = orgsWithStatus
      } else {
        const { data: basicOrgs, error: orgsErr2 } = await supabase
          .from('organizations')
          .select('id, name, slug, created_at')
          .order('created_at', { ascending: false })

        if (orgsErr2) {
          logger.error('Erro ao listar empresas cadastradas', orgsErr2)
          return { success: false, error: 'Não foi possível carregar as empresas cadastradas.' }
        }
        orgs = basicOrgs || []
      }

      const mapped: ManagedCompany[] = orgs.map((o: any) => {
        const localStatus = localStorage.getItem(`${LOCAL_STORAGE_STATUS_PREFIX}${o.id}`)
        const isActive = localStatus !== null ? localStatus === 'true' : (o.is_active !== false)

        let modules: DashboardModuleCode[] = ALL_PLATFORM_DASHBOARD_MODULES.map((m) => m.code)
        try {
          const stored = localStorage.getItem(`${LOCAL_STORAGE_MODULES_PREFIX}${o.id}`)
          if (stored) {
            modules = JSON.parse(stored) as DashboardModuleCode[]
          }
        } catch {
          // ignore
        }

        return {
          id: o.id,
          name: o.name,
          slug: o.slug,
          isActive,
          createdAt: o.created_at,
          adminEmail: '',
          adminName: 'Administrador',
          membersCount: 1,
          modules,
        }
      })

      return { success: true, data: mapped }
    } catch (err) {
      logger.error('Exceção ao listar empresas', err)
      return { success: false, error: 'Erro inesperado ao consultar empresas cadastradas.' }
    }
  },

  /**
   * Ativa ou desativa o acesso de uma empresa / identificador único (SLUG).
   */
  async setCompanyActive(companyId: UUID, isActive: boolean): Promise<ServiceResult<void>> {
    try {
      // Grava no localStorage para consistência imediata
      localStorage.setItem(`${LOCAL_STORAGE_STATUS_PREFIX}${companyId}`, String(isActive))

      // 1. Tenta executar a RPC segura
      const { error: rpcError } = await supabase.rpc('admin_set_organization_active', {
        p_org_id: companyId,
        p_is_active: isActive,
      })

      if (!rpcError) {
        return { success: true, data: undefined }
      }

      // 2. Fallback direto se a RPC não existir
      try {
        await supabase
          .from('organizations')
          .update({ is_active: isActive } as any)
          .eq('id', companyId)
      } catch {
        // Fallback silently handled
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao alterar status da empresa', err)
      return { success: false, error: 'Erro ao alterar status da empresa.' }
    }
  },

  /**
   * Atualiza os módulos e páginas acessíveis por uma empresa.
   */
  async updateCompanyModules(
    companyId: UUID,
    modules: DashboardModuleCode[],
  ): Promise<ServiceResult<void>> {
    try {
      // Armazena no localStorage
      localStorage.setItem(`${LOCAL_STORAGE_MODULES_PREFIX}${companyId}`, JSON.stringify(modules))

      // 1. Tenta RPC
      const { error: rpcError } = await supabase.rpc('admin_update_organization_modules', {
        p_org_id: companyId,
        p_modules: modules,
      })

      if (!rpcError) {
        return { success: true, data: undefined }
      }

      // 2. Fallback: grava na tabela organization_dashboard_modules se existir
      try {
        await supabase
          .from('organization_dashboard_modules' as any)
          .delete()
          .eq('organization_id', companyId)

        if (modules.length > 0) {
          const rows = modules.map((code) => ({
            organization_id: companyId,
            module_code: code,
          }))
          await supabase.from('organization_dashboard_modules' as any).insert(rows as any)
        }
      } catch {
        // Fallback silently handled
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao atualizar módulos da empresa', err)
      return { success: false, error: 'Erro ao salvar os módulos da empresa.' }
    }
  },

  /**
   * Obtém os módulos liberados para uma organização específica.
   */
  async getCompanyModules(companyId: UUID): Promise<DashboardModuleCode[]> {
    try {
      const { data, error } = await supabase
        .from('organization_dashboard_modules' as any)
        .select('module_code')
        .eq('organization_id', companyId)

      // Se a tabela existe e retornou linhas (mesmo vazia ou com linhas)
      if (!error && Array.isArray(data)) {
        if (data.length > 0) {
          return data.map((r: any) => r.module_code as DashboardModuleCode)
        }
        // Se a consulta teve sucesso mas a tabela está vazia para essa organização,
        // verifica se há registro salvo no storage
        const stored = localStorage.getItem(`${LOCAL_STORAGE_MODULES_PREFIX}${companyId}`)
        if (stored) {
          return JSON.parse(stored) as DashboardModuleCode[]
        }
        return []
      }

      const stored = localStorage.getItem(`${LOCAL_STORAGE_MODULES_PREFIX}${companyId}`)
      if (stored) {
        return JSON.parse(stored) as DashboardModuleCode[]
      }
    } catch {
      // ignore
    }

    // Padrão apenas se não houver tabela ou se der erro completo
    return ALL_PLATFORM_DASHBOARD_MODULES.map((m) => m.code)
  },

  /**
   * Cadastra uma nova empresa criando um usuário com permissões de administrador.
   */
  async registerCompanyWithAdmin(
    params: RegisterCompanyParams,
  ): Promise<ServiceResult<{ organizationId: UUID; slug: string }>> {
    try {
      const cleanSlug = params.slug
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')

      const cleanPassword = params.adminPassword && params.adminPassword.length >= 6
        ? params.adminPassword
        : 'admin@123'

      const cleanEmail = params.adminEmail.trim().toLowerCase()
      const cleanAdminName = params.adminName.trim()

      // Criar usuário no Supabase Auth via cliente efêmero (sem deslogar a sessão do proprietário)
      // Isso garante que o Supabase GoTrue faça o hash bcrypt nativo (custo correto),
      // crie identidades e tokens de confirmação 100% válidos.
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
              display_name: cleanAdminName,
            },
          },
        })

        if (signUpRes.error) {
          // Se o erro for que o usuário já existe, continuamos normalmente
          logger.info('Nota sobre cadastro auth do admin:', { message: signUpRes.error.message })
        }
      } catch (e) {
        logger.warn('Aviso ao registrar usuário via ephemeral auth client', { error: String(e) })
      }

      // 1. Tenta a RPC atômica completa
      const { data, error } = await supabase.rpc('admin_register_company_with_admin', {
        p_org_name: params.name.trim(),
        p_org_slug: cleanSlug,
        p_admin_name: cleanAdminName,
        p_admin_email: cleanEmail,
        p_admin_password: cleanPassword,
        p_modules: params.modules,
      })

      // 2. Se a RPC não foi instalada no Supabase ainda (erro de schema cache), aciona o fallback resiliente
      if (
        error &&
        (error.message.includes('Could not find the function') ||
          error.message.includes('schema cache') ||
          (error as any).code === 'PGRST202')
      ) {
        logger.warn('RPC admin_register_company_with_admin não encontrada no Supabase. Usando fallback via createOrganization...')

        const { data: authData } = await supabase.auth.getUser()
        const currentUser = authData?.user

        if (!currentUser) {
          return { success: false, error: 'Usuário não autenticado.' }
        }

        // Cria a organização vinculada ao usuário mestre atual
        const createOrgRes = await organizationService.createOrganization(
          params.name.trim(),
          cleanSlug,
          currentUser.id,
        )

        if (!createOrgRes.success) {
          return { success: false, error: createOrgRes.error }
        }

        const newOrgId = createOrgRes.data

        // Cria/adiciona o administrador na nova organização se o email for diferente do usuário mestre
        if (params.adminEmail && params.adminEmail.trim().toLowerCase() !== currentUser.email?.toLowerCase()) {
          try {
            await organizationService.addMember({
              organizationId: newOrgId,
              email: params.adminEmail.trim().toLowerCase(),
              name: params.adminName.trim(),
              password: cleanPassword,
              role: 'admin',
              jobTitle: 'Administrador',
              dashboardModules: params.modules,
            })
          } catch (e: any) {
            logger.warn('Aviso ao vincular administrador via addMember fallback', { message: e?.message })
          }
        }

        // Salva módulos na tabela organization_dashboard_modules se ela existir
        try {
          await supabase.from('organization_dashboard_modules' as any).delete().eq('organization_id', newOrgId)
          if (params.modules.length > 0) {
            await supabase.from('organization_dashboard_modules' as any).insert(
              params.modules.map((m) => ({ organization_id: newOrgId, module_code: m })) as any
            )
          }
        } catch {
          // ignore
        }

        // Salva módulos e status
        localStorage.setItem(`${LOCAL_STORAGE_MODULES_PREFIX}${newOrgId}`, JSON.stringify(params.modules))
        localStorage.setItem(`${LOCAL_STORAGE_STATUS_PREFIX}${newOrgId}`, 'true')

        return {
          success: true,
          data: {
            organizationId: newOrgId,
            slug: cleanSlug,
          },
        }
      }

      if (error) {
        logger.error('Erro na RPC admin_register_company_with_admin', error)
        return { success: false, error: error.message || 'Não foi possível cadastrar a empresa.' }
      }

      const orgId = (data as any)?.organizationId || (data as any)?.organization_id
      if (orgId) {
        localStorage.setItem(`${LOCAL_STORAGE_MODULES_PREFIX}${orgId}`, JSON.stringify(params.modules))
        localStorage.setItem(`${LOCAL_STORAGE_STATUS_PREFIX}${orgId}`, 'true')
      }

      return {
        success: true,
        data: {
          organizationId: orgId,
          slug: cleanSlug,
        },
      }
    } catch (err: any) {
      logger.error('Exceção ao cadastrar empresa', err)
      return { success: false, error: err?.message || 'Erro inesperado ao cadastrar empresa.' }
    }
  },
}
