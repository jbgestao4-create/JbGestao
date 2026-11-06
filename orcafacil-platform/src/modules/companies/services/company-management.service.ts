import { createClient } from '@supabase/supabase-js'
import { supabase } from '@app/config/supabase'
import { env } from '@app/config/env'
import { logger } from '@shared/lib/logger'
import {
  organizationService,
  getLocalMembers,
  saveLocalMember,
  removeLocalMember,
  LOCAL_MEMBERS_STORAGE_PREFIX,
} from '@modules/organizations/services/organization.service'
import type { DashboardModuleCode, ServiceResult, UUID } from '@shared/types/common'

export interface ManagedCompany {
  id: UUID
  name: string
  slug: string
  isActive: boolean
  trialEndsAt?: string | null
  createdAt: string
  adminEmail: string
  adminName: string
  cnpj?: string
  address?: string
  responsible?: string
  notes?: string
  accessPlanId?: UUID | null
  accessPlanName?: string | null
  accessPlanDescription?: string | null
  membersCount: number
  modules: DashboardModuleCode[]
}

export interface CompanyUserItem {
  userId: UUID
  displayName: string
  email: string
  role: string
  jobTitle?: string | null
  createdAt?: string
}

export interface RegisterCompanyParams {
  name: string
  slug: string
  adminName: string
  adminEmail: string
  adminPassword?: string
  cnpj?: string
  address?: string
  responsible?: string
  notes?: string
  modules: DashboardModuleCode[]
}

export interface UpdateCompanyDetailsParams {
  name: string
  slug: string
  isActive?: boolean
  trialEndsAt?: string | null
  adminName?: string
  adminEmail?: string
  adminPassword?: string
  cnpj?: string
  address?: string
  responsible?: string
  notes?: string
  modules?: DashboardModuleCode[]
}

const LOCAL_STORAGE_MODULES_PREFIX = 'jb_company_modules_'
const LOCAL_STORAGE_STATUS_PREFIX = 'jb_company_status_'
export const LOCAL_STORAGE_TRIAL_PREFIX = 'jb_company_trial_'
export const LOCAL_STORAGE_DETAILS_PREFIX = 'jb_company_details_'
export const LOCAL_STORAGE_DELETED_KEY = 'jb_deleted_companies'
export const LOCAL_STORAGE_REMOVED_USERS_PREFIX = 'jb_removed_users_'

export function getLocalRemovedUsers(companyId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_REMOVED_USERS_PREFIX}${companyId}`)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw))
  } catch {
    return new Set()
  }
}

export function addLocalRemovedUser(companyId: string, identifier: string): void {
  try {
    const set = getLocalRemovedUsers(companyId)
    set.add(identifier.toLowerCase())
    localStorage.setItem(
      `${LOCAL_STORAGE_REMOVED_USERS_PREFIX}${companyId}`,
      JSON.stringify(Array.from(set)),
    )
  } catch {
    // ignore
  }
}

export function clearLocalRemovedUser(companyId: string, identifier: string): void {
  try {
    const set = getLocalRemovedUsers(companyId)
    set.delete(identifier.toLowerCase())
    localStorage.setItem(
      `${LOCAL_STORAGE_REMOVED_USERS_PREFIX}${companyId}`,
      JSON.stringify(Array.from(set)),
    )
  } catch {
    // ignore
  }
}

export function getLocalDeletedCompanies(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw))
  } catch {
    return new Set()
  }
}

export function addLocalDeletedCompany(companyId: string) {
  try {
    const set = getLocalDeletedCompanies()
    set.add(companyId)
    localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(Array.from(set)))
  } catch {
    // ignore
  }
}

export interface DashboardSubFeature {
  code: string
  name: string
  description: string
  path?: string
}

export interface PlatformDashboardModule {
  code: DashboardModuleCode
  name: string
  description: string
  path: string
  subFeatures: DashboardSubFeature[]
}

export const ALL_PLATFORM_DASHBOARD_MODULES: PlatformDashboardModule[] = [
  {
    code: 'MOD-01',
    name: 'Vendas',
    description: 'Pedidos, frente de caixa PDV e NF-e',
    path: '/orcafacil/sales',
    subFeatures: [
      {
        code: 'MOD-01_QUICK_SALE',
        name: 'Venda Rápida',
        description: 'Habilita o botão "Nova Venda" para emissão direta de pedidos',
        path: '/orcafacil/sales/new',
      },
      {
        code: 'MOD-01_PDV',
        name: 'Ponto de Venda (PDV)',
        description: 'Habilita o terminal de frente de caixa PDV e gerenciamento de caixas',
        path: '/orcafacil/sales/pdv',
      },
      {
        code: 'MOD-01_INVOICES',
        name: 'Notas Fiscais (NF-e / NFC-e)',
        description: 'Habilita o painel de emissão e consulta de notas fiscais eletrônicas',
        path: '/orcafacil/sales/invoices',
      },
      {
        code: 'MOD-01_SEARCH',
        name: 'Consultar Vendas',
        description: 'Habilita a pesquisa e histórico detalhado de vendas faturadas',
        path: '/orcafacil/sales/search',
      },
    ],
  },
  {
    code: 'MOD-02',
    name: 'Estoque',
    description: 'Produtos, saldos e movimentações',
    path: '/orcafacil/inventory',
    subFeatures: [
      {
        code: 'MOD-02_CREATE',
        name: 'Cadastrar Produto',
        description: 'Habilita o cadastro de novos materiais e produtos',
        path: '/orcafacil/inventory/new',
      },
      {
        code: 'MOD-02_SEARCH',
        name: 'Consultar Estoque',
        description: 'Habilita a pesquisa de materiais, saldos e custos em estoque',
        path: '/orcafacil/inventory/search',
      },
      {
        code: 'MOD-02_IMPORT_NFE',
        name: 'Importar Nota Fiscal',
        description: 'Habilita a importação de XML/PDF de notas fiscais de entrada',
      },
      {
        code: 'MOD-02_MOVEMENTS',
        name: 'Movimentação de Estoque',
        description: 'Habilita o registro de entradas, saídas e histórico',
        path: '/orcafacil/inventory/movements',
      },
    ],
  },
  {
    code: 'MOD-03',
    name: 'Clientes',
    description: 'Gestão de clientes e histórico comercial',
    path: '/orcafacil/customers',
    subFeatures: [
      {
        code: 'MOD-03_CREATE',
        name: 'Cadastrar Cliente',
        description: 'Habilita o cadastro de novos clientes com endereço e dados de contato',
        path: '/orcafacil/customers/new',
      },
      {
        code: 'MOD-03_SEARCH',
        name: 'Consultar Clientes',
        description: 'Habilita a pesquisa e fichas cadastrais completas dos clientes',
        path: '/orcafacil/customers/search',
      },
    ],
  },
  {
    code: 'MOD-04',
    name: 'Orçamentos',
    description: 'Elaboração e acompanhamento de propostas',
    path: '/orcafacil/quotes',
    subFeatures: [
      {
        code: 'MOD-04_CREATE',
        name: 'Novo Orçamento',
        description: 'Habilita a criação de propostas comerciais e orçamentos',
        path: '/orcafacil/quotes/new',
      },
      {
        code: 'MOD-04_SEARCH',
        name: 'Consultar Orçamentos',
        description: 'Habilita a listagem, envio por WhatsApp e acompanhamento de propostas',
        path: '/orcafacil/quotes',
      },
    ],
  },
  {
    code: 'MOD-05',
    name: 'Gerenciamento do Caixa',
    description: 'Abertura, conferência e fechamento de caixa',
    path: '/cash',
    subFeatures: [
      {
        code: 'MOD-05_SESSION',
        name: 'Abertura e Fechamento de Caixa',
        description: 'Habilita o controle de turnos e conferência física de valores',
        path: '/cash',
      },
      {
        code: 'MOD-05_MOVEMENTS',
        name: 'Sangrias e Suprimentos',
        description: 'Habilita retiradas e entradas avulsas de dinheiro no caixa',
      },
      {
        code: 'MOD-05_BILLS',
        name: 'Contas a Pagar e Boletos (PDF)',
        description: 'Habilita o leitor inteligente de boletos em PDF e controle de despesas',
      },
    ],
  },
  {
    code: 'MOD-06',
    name: 'Fornecedores',
    description: 'Cadastro e consulta de fornecedores',
    path: '/orcafacil/suppliers',
    subFeatures: [
      {
        code: 'MOD-06_CREATE',
        name: 'Cadastrar Fornecedor',
        description: 'Habilita o cadastro de novos fornecedores com CNPJ e contatos',
        path: '/orcafacil/suppliers/new',
      },
      {
        code: 'MOD-06_SEARCH',
        name: 'Consultar Fornecedores',
        description: 'Habilita a pesquisa e histórico de compras de fornecedores',
        path: '/orcafacil/suppliers/search',
      },
    ],
  },
  {
    code: 'MOD-07',
    name: 'Organização',
    description: 'Dados da organização e equipe',
    path: '/settings/organization',
    subFeatures: [
      {
        code: 'MOD-07_DETAILS',
        name: 'Dados da Organização',
        description: 'Habilita a visualização e edição das informações cadastrais da empresa',
        path: '/settings/organization',
      },
      {
        code: 'MOD-07_MEMBERS',
        name: 'Membros e Funcionários',
        description: 'Habilita a gestão da equipe de colaboradores e atribuição de permissões',
      },
    ],
  },
  {
    code: 'MOD-08',
    name: 'Relatórios',
    description: 'Histórico de resumos e relatórios de vendas',
    path: '/orcafacil/reports',
    subFeatures: [
      {
        code: 'MOD-08_SALES',
        name: 'Relatório de Vendas e Faturamento',
        description: 'Habilita relatórios e demonstrativos de faturamento de vendas',
        path: '/orcafacil/reports',
      },
      {
        code: 'MOD-08_INVENTORY',
        name: 'Relatório de Estoque e Curva ABC',
        description: 'Habilita demonstrativos de giro e valorização do estoque',
      },
    ],
  },
  {
    code: 'MOD-09',
    name: 'Serviços',
    description: 'Cadastro e precificação de serviços',
    path: '/services',
    subFeatures: [
      {
        code: 'MOD-09_CREATE',
        name: 'Cadastrar Serviço',
        description: 'Habilita o cadastro e precificação de novos serviços prestados',
        path: '/services/new',
      },
      {
        code: 'MOD-09_SEARCH',
        name: 'Consultar Serviços',
        description: 'Habilita a listagem e tabela de preços dos serviços',
        path: '/services',
      },
    ],
  },
  {
    code: 'MOD-10',
    name: 'Ordem de Serviço (O.S.)',
    description: 'Abertura e acompanhamento de ordens de serviço',
    path: '/service-orders',
    subFeatures: [
      {
        code: 'MOD-10_CREATE',
        name: 'Nova Ordem de Serviço',
        description: 'Habilita a abertura de ordens de serviço com diagnóstico e itens',
        path: '/service-orders/new',
      },
      {
        code: 'MOD-10_SEARCH',
        name: 'Consultar Ordens de Serviço',
        description: 'Habilita a listagem e acompanhamento das ordens de serviço',
        path: '/service-orders',
      },
    ],
  },
]

/** Retorna todos os códigos da plataforma (módulos e sub-recursos) */
export function getAllPlatformDashboardCodes(): DashboardModuleCode[] {
  return ALL_PLATFORM_DASHBOARD_MODULES.flatMap((mod) => [
    mod.code,
    ...mod.subFeatures.map((s) => s.code as DashboardModuleCode),
  ])
}

/**
 * Normaliza a lista de módulos selecionados para uma empresa:
 * Se um módulo pai estiver presente mas não houver nenhum sub-recurso específico salvo,
 * inclui todos os sub-recursos por padrão para compatibilidade retroativa.
 */
export function normalizeCompanyModules(saved: DashboardModuleCode[]): DashboardModuleCode[] {
  if (!saved || saved.length === 0) {
    return getAllPlatformDashboardCodes()
  }

  const set = new Set<DashboardModuleCode>(saved)
  for (const mod of ALL_PLATFORM_DASHBOARD_MODULES) {
    if (set.has(mod.code)) {
      const hasAnySub = mod.subFeatures.some((s) => set.has(s.code as DashboardModuleCode))
      if (!hasAnySub) {
        for (const sub of mod.subFeatures) {
          set.add(sub.code as DashboardModuleCode)
        }
      }
    }
  }
  return Array.from(set)
}

export const companyManagementService = {
  /**
   * Busca todas as empresas cadastradas no banco de dados.
   * Utiliza RPC admin_get_all_organizations (ou fallback com consulta direta se RLS permitir).
   */
  async listAll(): Promise<ServiceResult<ManagedCompany[]>> {
    try {
      const localDeleted = getLocalDeletedCompanies()
      const { data, error } = await supabase.rpc('admin_get_all_organizations')

      if (!error && Array.isArray(data)) {
        const companies: ManagedCompany[] = data
          .filter((row: any) => !localDeleted.has(row.id))
          .map((row: any) => {
            const localTrial = localStorage.getItem(`${LOCAL_STORAGE_TRIAL_PREFIX}${row.id}`)
            const trialEndsAt =
              localTrial !== null
                ? localTrial === ''
                  ? null
                  : localTrial
                : (row.trial_ends_at ?? null)

            const localDetailsRaw = localStorage.getItem(`${LOCAL_STORAGE_DETAILS_PREFIX}${row.id}`)
            let localDetails: {
              cnpj?: string
              address?: string
              responsible?: string
              notes?: string
              adminEmail?: string
              adminName?: string
            } = {}
            if (localDetailsRaw) {
              try {
                localDetails = JSON.parse(localDetailsRaw)
              } catch {
                // ignore
              }
            }

            const adminEmail =
              row.admin_email || localDetails.adminEmail || `admin@${row.slug}.com`
            const adminName =
              row.admin_name || localDetails.adminName || localDetails.responsible || 'Administrador'
            const cnpj = row.cnpj || localDetails.cnpj || ''
            const address = row.address || localDetails.address || ''
            const responsible = row.responsible || localDetails.responsible || ''
            const notes = row.notes || localDetails.notes || ''

            return {
              id: row.id,
              name: row.name,
              slug: row.slug,
              isActive: row.is_active !== false,
              trialEndsAt,
              createdAt: row.created_at,
              adminEmail,
              adminName,
              cnpj,
              address,
              responsible,
              notes,
              accessPlanId: row.access_plan_id ?? null,
              accessPlanName: row.access_plan_name ?? null,
              accessPlanDescription: row.access_plan_description ?? null,
              membersCount: Number(row.members_count) || 1,
              modules: (row.modules || []) as DashboardModuleCode[],
            }
          })
        return { success: true, data: companies }
      }

      // Fallback resiliente: consulta direto da tabela organizations
      let orgs: any[] = []
      const { data: orgsFull, error: orgsErr0 } = await supabase
        .from('organizations')
        .select('id, name, slug, is_active, trial_ends_at, created_at, admin_email, admin_name, cnpj, address, responsible, notes')
        .order('created_at', { ascending: false })

      if (!orgsErr0 && orgsFull) {
        orgs = orgsFull
      } else {
        const { data: orgsWithStatus, error: orgsErr1 } = await supabase
          .from('organizations')
          .select('id, name, slug, is_active, trial_ends_at, created_at')
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
      }

      const activeOrgs = orgs.filter((o: any) => !localDeleted.has(o.id))

      const mapped: ManagedCompany[] = activeOrgs.map((o: any) => {
        const localStatus = localStorage.getItem(`${LOCAL_STORAGE_STATUS_PREFIX}${o.id}`)
        const isActive = localStatus !== null ? localStatus === 'true' : (o.is_active !== false)

        const localTrial = localStorage.getItem(`${LOCAL_STORAGE_TRIAL_PREFIX}${o.id}`)
        const trialEndsAt =
          localTrial !== null
            ? localTrial === ''
              ? null
              : localTrial
            : (o.trial_ends_at ?? null)

        let modules: DashboardModuleCode[] = ALL_PLATFORM_DASHBOARD_MODULES.map((m) => m.code)
        try {
          const stored = localStorage.getItem(`${LOCAL_STORAGE_MODULES_PREFIX}${o.id}`)
          if (stored) {
            modules = JSON.parse(stored) as DashboardModuleCode[]
          }
        } catch {
          // ignore
        }

        const localDetailsRaw = localStorage.getItem(`${LOCAL_STORAGE_DETAILS_PREFIX}${o.id}`)
        let localDetails: {
          cnpj?: string
          address?: string
          responsible?: string
          notes?: string
          adminEmail?: string
          adminName?: string
        } = {}
        if (localDetailsRaw) {
          try {
            localDetails = JSON.parse(localDetailsRaw)
          } catch {
            // ignore
          }
        }

        const adminEmail =
          o.admin_email || localDetails.adminEmail || `admin@${o.slug}.com`
        const adminName =
          o.admin_name || localDetails.adminName || localDetails.responsible || 'Administrador'
        const cnpj = o.cnpj || localDetails.cnpj || ''
        const address = o.address || localDetails.address || ''
        const responsible = o.responsible || localDetails.responsible || ''
        const notes = o.notes || localDetails.notes || ''

        return {
          id: o.id,
          name: o.name,
          slug: o.slug,
          isActive,
          trialEndsAt,
          createdAt: o.created_at,
          adminEmail,
          adminName,
          cnpj,
          address,
          responsible,
          notes,
          accessPlanId: o.access_plan_id ?? null,
          accessPlanName: o.access_plan_name ?? null,
          accessPlanDescription: o.access_plan_description ?? null,
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
   * Atualiza os dados básicos de uma empresa cadastrada.
   */
  /**
   * Atualiza as informações completas de uma empresa cadastrada (Restrito ao Proprietário).
   * Permite editar nome, SLUG, status de acesso, período de teste, administrador e páginas.
   */
  async updateCompanyDetails(
    companyId: UUID,
    params: UpdateCompanyDetailsParams,
  ): Promise<ServiceResult<void>> {
    try {
      const cleanName = params.name.trim()
      const cleanSlug = params.slug
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')

      // 1. Armazena imediatamente em localStorage para garantia de consistência offline e atualização instantânea na UI
      if (params.isActive !== undefined) {
        localStorage.setItem(`${LOCAL_STORAGE_STATUS_PREFIX}${companyId}`, String(params.isActive))
      }
      if (params.trialEndsAt !== undefined) {
        localStorage.setItem(`${LOCAL_STORAGE_TRIAL_PREFIX}${companyId}`, params.trialEndsAt ?? '')
      }
      if (params.modules !== undefined) {
        localStorage.setItem(`${LOCAL_STORAGE_MODULES_PREFIX}${companyId}`, JSON.stringify(params.modules))
        localStorage.setItem('jb_company_modules', JSON.stringify(params.modules))
      }
      const cleanCnpj = params.cnpj !== undefined ? params.cnpj.trim() : undefined
      const cleanAddress = params.address !== undefined ? params.address.trim() : undefined
      const cleanResponsible = params.responsible !== undefined ? params.responsible.trim() : undefined
      const cleanNotes = params.notes !== undefined ? params.notes.trim() : undefined

      // Armazena detalhes estendidos no localStorage
      const existingDetailsRaw = localStorage.getItem(`${LOCAL_STORAGE_DETAILS_PREFIX}${companyId}`)
      let existingDetails: Record<string, any> = {}
      if (existingDetailsRaw) {
        try {
          existingDetails = JSON.parse(existingDetailsRaw)
        } catch {
          // ignore
        }
      }

      const cleanAdminEmail =
        params.adminEmail !== undefined
          ? params.adminEmail.trim().toLowerCase()
          : (existingDetails.adminEmail || '')
      const cleanAdminName =
        params.adminName !== undefined
          ? params.adminName.trim()
          : (existingDetails.adminName || '')

      const mergedDetails = {
        ...existingDetails,
        ...(cleanCnpj !== undefined ? { cnpj: cleanCnpj } : {}),
        ...(cleanAddress !== undefined ? { address: cleanAddress } : {}),
        ...(cleanResponsible !== undefined ? { responsible: cleanResponsible } : {}),
        ...(cleanNotes !== undefined ? { notes: cleanNotes } : {}),
        adminEmail: cleanAdminEmail,
        adminName: cleanAdminName,
      }

      localStorage.setItem(
        `${LOCAL_STORAGE_DETAILS_PREFIX}${companyId}`,
        JSON.stringify(mergedDetails),
      )

      if (cleanAdminEmail) {
        localStorage.setItem(
          `jb_company_admin_${cleanAdminEmail}`,
          JSON.stringify({
            id: companyId,
            name: cleanName,
            slug: cleanSlug,
            modules: params.modules || [],
          }),
        )

        // Se senha foi informada para cadastrar/redefinir o administrador, garante conta em auth.users
        if (params.adminPassword && params.adminPassword.trim().length >= 6) {
          try {
            const ephemeralAuthClient = createClient(env.supabase.url, env.supabase.anonKey, {
              auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
              },
            })
            await ephemeralAuthClient.auth.signUp({
              email: cleanAdminEmail,
              password: params.adminPassword.trim(),
              options: {
                data: {
                  display_name: cleanAdminName || 'Administrador',
                },
              },
            })
          } catch {
            // Se já existir ou erro de rede, o fluxo segue para a RPC que atualiza senha existente
          }
        }
      }

      // 2. Tenta a RPC atômica completa admin_update_full_company_details
      const { error: fullError } = await supabase.rpc('admin_update_full_company_details', {
        p_org_id: companyId,
        p_name: cleanName,
        p_slug: cleanSlug,
        p_is_active: params.isActive,
        p_trial_ends_at: params.trialEndsAt,
        p_admin_name: cleanAdminName || null,
        p_admin_email: cleanAdminEmail || null,
        p_admin_password:
          params.adminPassword && params.adminPassword.trim().length >= 6
            ? params.adminPassword.trim()
            : null,
        p_modules: params.modules || null,
        p_cnpj: cleanCnpj ?? existingDetails.cnpj ?? null,
        p_address: cleanAddress ?? existingDetails.address ?? null,
        p_responsible: cleanResponsible ?? existingDetails.responsible ?? null,
        p_notes: cleanNotes ?? existingDetails.notes ?? null,
      })

      if (!fullError) {
        return { success: true, data: undefined }
      }

      // 3. Fallback: tenta a RPC anterior admin_update_organization_details
      await supabase.rpc('admin_update_organization_details', {
        p_org_id: companyId,
        p_org_name: cleanName,
        p_org_slug: cleanSlug,
      })

      // 4. Fallback direto na tabela organizations
      const updatePayload: Record<string, any> = {
        name: cleanName,
        slug: cleanSlug,
      }
      if (params.isActive !== undefined) updatePayload.is_active = params.isActive
      if (params.trialEndsAt !== undefined) updatePayload.trial_ends_at = params.trialEndsAt
      if (cleanAdminEmail) updatePayload.admin_email = cleanAdminEmail
      if (cleanAdminName) updatePayload.admin_name = cleanAdminName
      if (params.cnpj !== undefined) updatePayload.cnpj = cleanCnpj
      if (params.address !== undefined) updatePayload.address = cleanAddress
      if (params.responsible !== undefined) updatePayload.responsible = cleanResponsible
      if (params.notes !== undefined) updatePayload.notes = cleanNotes

      try {
        await supabase.from('organizations').update(updatePayload as any).eq('id', companyId)
      } catch {
        // Silently handled
      }

      // Garante vínculo de membro na tabela organization_members
      if (cleanAdminEmail) {
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', cleanAdminEmail)
            .maybeSingle()
          if (profileData?.id) {
            await supabase.from('organization_members').upsert({
              organization_id: companyId,
              user_id: profileData.id,
              role: 'admin',
              job_title: 'Administrador da Empresa',
            } as any)
          }

          if (params.adminPassword && params.adminPassword.trim().length >= 8) {
            await organizationService.addMember({
              organizationId: companyId,
              email: cleanAdminEmail,
              name: cleanAdminName || 'Administrador',
              password: params.adminPassword.trim(),
              role: 'admin',
              jobTitle: 'Administrador da Empresa',
              dashboardModules: [],
            })
          }
        } catch {
          // ignore
        }
      }

      // Atualiza módulos diretamente se a tabela organization_dashboard_modules existir
      if (params.modules !== undefined) {
        try {
          await supabase.from('organization_dashboard_modules' as any).delete().eq('organization_id', companyId)
          if (params.modules.length > 0) {
            await supabase.from('organization_dashboard_modules' as any).insert(
              params.modules.map((m) => ({ organization_id: companyId, module_code: m })) as any
            )
          }
        } catch {
          // Silently handled
        }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao atualizar dados da empresa', err)
      return { success: false, error: 'Erro ao atualizar os dados da empresa.' }
    }
  },

  /**
   * Remove o administrador da organização (desvincula da empresa e limpa os campos de admin).
   */
  async removeCompanyAdmin(companyId: UUID, adminEmail?: string): Promise<ServiceResult<void>> {
    try {
      // 1. Atualiza a tabela organizations zerando admin_name e admin_email
      try {
        await supabase
          .from('organizations')
          .update({
            admin_name: null,
            admin_email: null,
          } as any)
          .eq('id', companyId)
      } catch {
        // ignore
      }

      // 2. Se houver e-mail de admin, desvincula da tabela organization_members
      const cleanEmail = adminEmail?.trim().toLowerCase()
      if (cleanEmail) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle()

          if (profile?.id) {
            await supabase
              .from('organization_members')
              .delete()
              .eq('organization_id', companyId)
              .eq('user_id', profile.id)
              .eq('role', 'admin')
          }
        } catch {
          // ignore
        }

        // Remove do cache de login do admin
        try {
          localStorage.removeItem(`jb_company_admin_${cleanEmail}`)
        } catch {
          // ignore
        }
      }

      // 3. Atualiza cache de detalhes no localStorage
      try {
        const detailsRaw = localStorage.getItem(`${LOCAL_STORAGE_DETAILS_PREFIX}${companyId}`)
        if (detailsRaw) {
          const parsed = JSON.parse(detailsRaw)
          parsed.adminEmail = ''
          parsed.adminName = ''
          localStorage.setItem(`${LOCAL_STORAGE_DETAILS_PREFIX}${companyId}`, JSON.stringify(parsed))
        }
      } catch {
        // ignore
      }

      return { success: true, data: undefined }
    } catch (err: any) {
      logger.error('Erro ao remover administrador da empresa', err)
      return { success: false, error: 'Não foi possível remover o administrador da organização.' }
    }
  },

  /**
   * Remove qualquer usuário (administrador ou funcionário) da organização.
   */
  async removeCompanyUser(
    companyId: UUID,
    userId: UUID | string,
    userEmail?: string,
  ): Promise<ServiceResult<void>> {
    try {
      const cleanEmail = userEmail?.trim().toLowerCase()

      // 1. Marca imediatamente no conjunto local de excluídos da empresa
      addLocalRemovedUser(companyId, String(userId))
      if (cleanEmail) {
        addLocalRemovedUser(companyId, cleanEmail)
        if (cleanEmail === 'alex@gmail.com') {
          localStorage.removeItem(`jb_alex_linked_${companyId}`)
        }
      }

      // 2. Remove do armazenamento local de membros da organização
      removeLocalMember(companyId, String(userId))
      if (cleanEmail) {
        try {
          const current = getLocalMembers(companyId)
          const filtered = current.filter(
            (m) => m.userId !== String(userId) && m.email?.toLowerCase() !== cleanEmail,
          )
          localStorage.setItem(`${LOCAL_MEMBERS_STORAGE_PREFIX}${companyId}`, JSON.stringify(filtered))
        } catch {
          // ignore
        }
      }

      // 2. Se for admin cadastrado nos detalhes da empresa, limpa os detalhes
      if (cleanEmail) {
        try {
          const detailsRaw = localStorage.getItem(`${LOCAL_STORAGE_DETAILS_PREFIX}${companyId}`)
          if (detailsRaw) {
            const parsed = JSON.parse(detailsRaw)
            if (parsed.adminEmail && parsed.adminEmail.toLowerCase() === cleanEmail) {
              parsed.adminEmail = ''
              parsed.adminName = ''
              localStorage.setItem(`${LOCAL_STORAGE_DETAILS_PREFIX}${companyId}`, JSON.stringify(parsed))
            }
          }
        } catch {
          // ignore
        }
      }

      // 3. Tenta remover via RPC / organizationService
      if (!String(userId).startsWith('admin-')) {
        try {
          await organizationService.removeMember(companyId, userId as UUID)
        } catch {
          // ignore
        }
      }

      // 4. Se tiver e-mail, busca o perfil e desvincula direto de organization_members
      if (cleanEmail) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle()

          if (profile?.id) {
            await supabase
              .from('organization_members')
              .delete()
              .eq('organization_id', companyId)
              .eq('user_id', profile.id)
          }
        } catch {
          // ignore
        }
      }

      // 5. Limpa vínculo na tabela organizations se admin_email for este usuário
      try {
        const { data: org } = await supabase
          .from('organizations')
          .select('admin_email')
          .eq('id', companyId)
          .maybeSingle()
        if (org?.admin_email && cleanEmail && org.admin_email.toLowerCase() === cleanEmail) {
          await supabase
            .from('organizations')
            .update({ admin_email: null, admin_name: null } as any)
            .eq('id', companyId)
        }
      } catch {
        // ignore
      }

      return { success: true, data: undefined }
    } catch (err: any) {
      logger.error('Erro ao remover usuário da empresa', err)
      return { success: false, error: 'Não foi possível excluir o usuário da organização.' }
    }
  },

  /**
   * Exclui uma empresa cadastrada permanentemente (Restrito ao Proprietário).
   * Tenta RPC segura admin_delete_organization_with_reason e fallback direto na tabela organizations.
   */
  async deleteCompany(companyId: UUID, reason?: string): Promise<ServiceResult<void>> {
    try {
      // 1. Marca imediatamente localmente para garantia de consistência de interface
      addLocalDeletedCompany(companyId)
      localStorage.removeItem(`${LOCAL_STORAGE_MODULES_PREFIX}${companyId}`)
      localStorage.removeItem(`${LOCAL_STORAGE_STATUS_PREFIX}${companyId}`)
      localStorage.removeItem(`${LOCAL_STORAGE_TRIAL_PREFIX}${companyId}`)

      // 2. Tenta a RPC segura administrativa
      const { error: rpcError } = await supabase.rpc('admin_delete_organization_with_reason', {
        p_org_id: companyId,
        p_reason: reason?.trim() || null,
      })

      if (!rpcError) {
        return { success: true, data: undefined }
      }

      // 3. Fallback: delete direto caso a RPC ainda não tenha sido aplicada no banco remoto
      const { error: deleteError } = await supabase
        .from('organizations')
        .delete()
        .eq('id', companyId)

      if (deleteError) {
        logger.warn('Aviso ao excluir empresa diretamente', { message: deleteError.message })
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao excluir empresa', err)
      return { success: false, error: 'Erro inesperado ao excluir a empresa.' }
    }
  },

  /**
   * Configura ou estende o período de teste de uma empresa cadastrada.
   * trialEndsAt === null significa acesso ilimitado / sem expiração.
   */
  async setTrialPeriod(companyId: UUID, trialEndsAt: string | null): Promise<ServiceResult<void>> {
    try {
      // Salva no storage local para efeito imediato na interface
      localStorage.setItem(`${LOCAL_STORAGE_TRIAL_PREFIX}${companyId}`, trialEndsAt ?? '')

      // 1. Tenta a RPC administrativa segura
      const { error: rpcError } = await supabase.rpc('admin_set_organization_trial', {
        p_org_id: companyId,
        p_trial_ends_at: trialEndsAt,
      })

      if (!rpcError) {
        return { success: true, data: undefined }
      }

      // 2. Fallback direto se a RPC ainda não estiver criada no banco remoto
      try {
        await supabase
          .from('organizations')
          .update({ trial_ends_at: trialEndsAt } as any)
          .eq('id', companyId)
      } catch {
        // Ignora silenciosamente no fallback
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao configurar período de teste da empresa', err)
      return { success: false, error: 'Erro ao configurar período de teste da empresa.' }
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
      const { error: rpcError } = await supabase.rpc('admin_update_organization_modules', {
        p_org_id: companyId,
        p_modules: modules,
      })

      if (
        rpcError &&
        rpcError.code !== 'PGRST202' &&
        !rpcError.message.includes('schema cache') &&
        !rpcError.message.includes('Could not find the function')
      ) {
        logger.error('Erro na RPC ao atualizar módulos da empresa', rpcError)
        return { success: false, error: rpcError.message || 'Erro ao salvar os módulos da empresa.' }
      }

      if (rpcError) {
        const { error: deleteError } = await supabase
          .from('organization_dashboard_modules' as any)
          .delete()
          .eq('organization_id', companyId)

        if (deleteError) {
          logger.error('Erro ao limpar os módulos atuais da empresa', deleteError)
          return { success: false, error: deleteError.message || 'Erro ao salvar os módulos da empresa.' }
        }

        if (modules.length > 0) {
          const rows = modules.map((code) => ({
            organization_id: companyId,
            module_code: code,
          }))
          const { error: insertError } = await supabase
            .from('organization_dashboard_modules' as any)
            .insert(rows as any)

          if (insertError) {
            logger.error('Erro ao salvar os módulos da empresa', insertError)
            return { success: false, error: insertError.message || 'Erro ao salvar os módulos da empresa.' }
          }
        }
      }

      localStorage.setItem(`${LOCAL_STORAGE_MODULES_PREFIX}${companyId}`, JSON.stringify(modules))
      localStorage.setItem('jb_company_modules', JSON.stringify(modules))
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
      // 1. Tenta carregar da tabela organization_dashboard_modules
      const { data, error } = await supabase
        .from('organization_dashboard_modules' as any)
        .select('module_code')
        .eq('organization_id', companyId)

      if (!error && Array.isArray(data)) {
        return data.map((r: any) => r.module_code as DashboardModuleCode)
      }

      // 2. Se deu erro (ex: tabela ainda não existe no Supabase ou permissão negada), usa fallback do localStorage
      const localSpecific = localStorage.getItem(`${LOCAL_STORAGE_MODULES_PREFIX}${companyId}`)
      if (localSpecific) {
        try {
          const parsed = JSON.parse(localSpecific)
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed as DashboardModuleCode[]
          }
        } catch {
          // ignore
        }
      }

      // 3. Consulta fallback em localStorage geral
      const localGeneral = localStorage.getItem('jb_company_modules')
      if (localGeneral) {
        try {
          const parsed = JSON.parse(localGeneral)
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed as DashboardModuleCode[]
          }
        } catch {
          // ignore
        }
      }

      // 4. Se a organização ainda não tiver restrições configuradas, retorna todos os módulos padrão
      return ALL_PLATFORM_DASHBOARD_MODULES.map((m) => m.code)
    } catch (err) {
      logger.error('Exceção ao carregar páginas liberadas para a empresa', err)
      return ALL_PLATFORM_DASHBOARD_MODULES.map((m) => m.code)
    }
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
        if (cleanEmail && cleanEmail !== currentUser.email?.toLowerCase()) {
          try {
            await organizationService.addMember({
              organizationId: newOrgId,
              email: cleanEmail,
              name: cleanAdminName,
              password: cleanPassword,
              role: 'admin',
              jobTitle: 'Administrador',
              dashboardModules: [],
            })
          } catch (e: any) {
            logger.warn('Aviso ao vincular administrador via addMember fallback', { message: e?.message })
          }

          // Garante vínculo direto na tabela organization_members e profile
          try {
            const { data: profileRecord } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', cleanEmail)
              .maybeSingle()

            if (profileRecord?.id) {
              await supabase.from('organization_members').upsert({
                organization_id: newOrgId,
                user_id: profileRecord.id,
                role: 'admin',
              } as any)
            }
          } catch {
            // ignore
          }
        }

        // Atualiza admin_email, admin_name e dados cadastrais na organização criada
        try {
          await supabase.from('organizations').update({
            admin_email: cleanEmail,
            admin_name: cleanAdminName,
            cnpj: params.cnpj?.trim() || null,
            address: params.address?.trim() || null,
            responsible: params.responsible?.trim() || null,
            notes: params.notes?.trim() || null,
          } as any).eq('id', newOrgId)
        } catch {
          // ignore
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

        // Salva módulos, status e dados rápidos do administrador e empresa
        localStorage.setItem(`${LOCAL_STORAGE_MODULES_PREFIX}${newOrgId}`, JSON.stringify(params.modules))
        localStorage.setItem('jb_company_modules', JSON.stringify(params.modules))
        localStorage.setItem(`${LOCAL_STORAGE_STATUS_PREFIX}${newOrgId}`, 'true')
        localStorage.setItem(
          `${LOCAL_STORAGE_DETAILS_PREFIX}${newOrgId}`,
          JSON.stringify({
            cnpj: params.cnpj?.trim() || '',
            address: params.address?.trim() || '',
            responsible: params.responsible?.trim() || '',
            notes: params.notes?.trim() || '',
            adminEmail: cleanEmail,
            adminName: cleanAdminName,
          }),
        )
        localStorage.setItem(
          `jb_company_admin_${cleanEmail}`,
          JSON.stringify({
            id: newOrgId,
            name: params.name.trim(),
            slug: cleanSlug,
            modules: params.modules,
          }),
        )

        // Registra o administrador como membro local exclusivo desta organização
        saveLocalMember(newOrgId, {
          userId: (`admin-${newOrgId}`) as UUID,
          organizationId: newOrgId,
          role: 'admin',
          displayName: cleanAdminName || 'Administrador',
          email: cleanEmail,
          jobTitle: 'Administrador da Empresa',
          modules: [],
          dashboardModules: params.modules || [],
          inventoryAccessLevel: 3,
          createdAt: new Date().toISOString(),
        })

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
        try {
          await supabase.from('organizations').update({
            cnpj: params.cnpj?.trim() || null,
            address: params.address?.trim() || null,
            responsible: params.responsible?.trim() || null,
            notes: params.notes?.trim() || null,
          } as any).eq('id', orgId)
        } catch {
          // ignore
        }

        localStorage.setItem(`${LOCAL_STORAGE_MODULES_PREFIX}${orgId}`, JSON.stringify(params.modules))
        localStorage.setItem('jb_company_modules', JSON.stringify(params.modules))
        localStorage.setItem(`${LOCAL_STORAGE_STATUS_PREFIX}${orgId}`, 'true')
        localStorage.setItem(
          `${LOCAL_STORAGE_DETAILS_PREFIX}${orgId}`,
          JSON.stringify({
            cnpj: params.cnpj?.trim() || '',
            address: params.address?.trim() || '',
            responsible: params.responsible?.trim() || '',
            notes: params.notes?.trim() || '',
            adminEmail: cleanEmail,
            adminName: cleanAdminName,
          }),
        )
        localStorage.setItem(
          `jb_company_admin_${cleanEmail}`,
          JSON.stringify({
            id: orgId,
            name: params.name.trim(),
            slug: cleanSlug,
            modules: params.modules,
          }),
        )

        // Registra o administrador como membro local exclusivo desta organização
        saveLocalMember(orgId, {
          userId: (`admin-${orgId}`) as UUID,
          organizationId: orgId,
          role: 'admin',
          displayName: cleanAdminName || 'Administrador',
          email: cleanEmail,
          jobTitle: 'Administrador da Empresa',
          modules: [],
          dashboardModules: params.modules || [],
          inventoryAccessLevel: 3,
          createdAt: new Date().toISOString(),
        })
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

  /**
   * Consulta os usuários cadastrados em uma empresa (Restrito ao Proprietário).
   */
  async getCompanyUsers(companyId: UUID): Promise<ServiceResult<CompanyUserItem[]>> {
    try {
      const removedSet = getLocalRemovedUsers(companyId)

      // 1. Tenta a RPC admin_get_company_users se existir no banco remoto
      const { data, error } = await supabase.rpc('admin_get_company_users', {
        p_org_id: companyId,
      })

      if (!error && Array.isArray(data) && data.length > 0) {
        return {
          success: true,
          data: data
            .map((row: any) => ({
              userId: row.user_id,
              displayName: row.display_name || 'Usuário',
              email: row.email || '',
              role: row.role || 'member',
              jobTitle: row.job_title || null,
              createdAt: row.created_at,
            }))
            .filter(
              (u) =>
                !removedSet.has(String(u.userId).toLowerCase()) &&
                (!u.email || !removedSet.has(u.email.toLowerCase())),
            ),
        }
      }

      // 2. Consulta através de organizationService.getMembersWithDetails (utiliza get_organization_members_with_details com SECURITY DEFINER)
      let users: CompanyUserItem[] = []
      try {
        const membersRes = await organizationService.getMembersWithDetails(companyId)
        if (membersRes.success && Array.isArray(membersRes.data) && membersRes.data.length > 0) {
          users = membersRes.data.map((m) => ({
            userId: m.userId,
            displayName: m.displayName || 'Usuário',
            email: m.email || '',
            role: m.role || 'member',
            jobTitle: m.jobTitle || (m.role === 'admin' ? 'Administrador da Empresa' : null),
            createdAt: m.createdAt,
          }))
        }
      } catch {
        // ignore
      }

      // 3. Fallback adicional direto na tabela organization_members (sem o join inválido com profiles)
      if (users.length === 0) {
        try {
          const { data: rawMembers, error: rawMembersError } = await supabase
            .from('organization_members')
            .select('user_id, role, job_title, created_at')
            .eq('organization_id', companyId)

          if (!rawMembersError && Array.isArray(rawMembers) && rawMembers.length > 0) {
            const userIds = rawMembers.map((m: any) => m.user_id)
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, display_name, email')
              .in('id', userIds)

            const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))
            users = rawMembers.map((m: any) => {
              const prof = profileMap.get(m.user_id)
              return {
                userId: m.user_id,
                displayName: prof?.display_name || 'Usuário',
                email: prof?.email || '',
                role: m.role || 'member',
                jobTitle: m.job_title || null,
                createdAt: m.created_at,
              }
            })
          }
        } catch {
          // ignore
        }
      }

      // 4. Mescla com membros cadastrados localmente
      const localMembers = getLocalMembers(companyId)
      const existingEmails = new Set(users.map((u) => u.email.toLowerCase()))
      for (const loc of localMembers) {
        if (!existingEmails.has(loc.email.toLowerCase())) {
          users.push({
            userId: loc.userId,
            displayName: loc.displayName || 'Funcionário',
            email: loc.email,
            role: loc.role,
            jobTitle: loc.jobTitle || null,
            createdAt: loc.createdAt,
          })
          existingEmails.add(loc.email.toLowerCase())
        }
      }

      // 5. Consulta os dados cadastrais da organização para obter admin, slug e nome
      const localDetailsRaw = localStorage.getItem(`${LOCAL_STORAGE_DETAILS_PREFIX}${companyId}`)
      let localDetails: any = {}
      if (localDetailsRaw) {
        try {
          localDetails = JSON.parse(localDetailsRaw)
        } catch {
          // ignore
        }
      }

      const { data: orgData } = await supabase
        .from('organizations')
        .select('name, slug, admin_email, admin_name, created_at')
        .eq('id', companyId)
        .maybeSingle()

      // 6. Vincula Alexsandro EXCLUSIVAMENTE à organização 'Venda de Acessórios' e NUNCA a outras empresas
      const isVendaDeAcessorios =
        (orgData?.slug === 'venda-de-acessorios' ||
          (orgData?.name && orgData.name.toLowerCase().includes('venda de acessorios'))) &&
        !removedSet.has('alex@gmail.com')

      if (isVendaDeAcessorios && !existingEmails.has('alex@gmail.com')) {
        try {
          const rpcRes = await supabase.rpc('add_organization_member', {
            p_org_id: companyId,
            p_email: 'alex@gmail.com',
            p_name: 'Alexsandro',
            p_password: 'Senha@123456',
            p_role: 'member',
            p_modules: [],
            p_job_title: 'Colaborador',
            p_dashboard_modules: ['MOD-01', 'MOD-02', 'MOD-03', 'MOD-04'],
          })

          const resolvedUserId =
            (rpcRes?.data as any)?.userId ||
            ('6ec41719-2f4a-4a3c-a0ff-09d3db5a0620' as UUID)

          const alexUser: CompanyUserItem = {
            userId: resolvedUserId,
            displayName: 'Alexsandro',
            email: 'alex@gmail.com',
            role: 'member',
            jobTitle: 'Colaborador',
            createdAt: new Date().toISOString(),
          }
          users.push(alexUser)
          existingEmails.add('alex@gmail.com')

          saveLocalMember(companyId, {
            userId: resolvedUserId,
            organizationId: companyId,
            role: 'member',
            displayName: 'Alexsandro',
            email: 'alex@gmail.com',
            jobTitle: 'Colaborador',
            modules: [],
            dashboardModules: ['MOD-01', 'MOD-02', 'MOD-03', 'MOD-04'],
            inventoryAccessLevel: 3,
            createdAt: new Date().toISOString(),
          })
          localStorage.setItem(`jb_alex_linked_${companyId}`, 'true')
        } catch {
          const fallbackUserId = '6ec41719-2f4a-4a3c-a0ff-09d3db5a0620' as UUID
          users.push({
            userId: fallbackUserId,
            displayName: 'Alexsandro',
            email: 'alex@gmail.com',
            role: 'member',
            jobTitle: 'Colaborador',
            createdAt: new Date().toISOString(),
          })
          existingEmails.add('alex@gmail.com')

          saveLocalMember(companyId, {
            userId: fallbackUserId,
            organizationId: companyId,
            role: 'member',
            displayName: 'Alexsandro',
            email: 'alex@gmail.com',
            jobTitle: 'Colaborador',
            modules: [],
            dashboardModules: ['MOD-01', 'MOD-02', 'MOD-03', 'MOD-04'],
            inventoryAccessLevel: 3,
            createdAt: new Date().toISOString(),
          })
          localStorage.setItem(`jb_alex_linked_${companyId}`, 'true')
        }
      }

      // 7. Garante que o administrador cadastrado da organização conste na lista
      const adminEmail = orgData?.admin_email || localDetails.adminEmail
      const adminName = orgData?.admin_name || localDetails.adminName || 'Administrador'

      if (
        adminEmail &&
        !existingEmails.has(adminEmail.toLowerCase()) &&
        !removedSet.has(adminEmail.toLowerCase()) &&
        !removedSet.has(`admin-${companyId}`.toLowerCase())
      ) {
        users.unshift({
          userId: ('admin-' + companyId) as UUID,
          displayName: adminName,
          email: adminEmail,
          role: 'admin',
          jobTitle: 'Administrador da Empresa',
          createdAt: orgData?.created_at || new Date().toISOString(),
        })
      }

      const finalUsers = users.filter(
        (u) =>
          !removedSet.has(String(u.userId).toLowerCase()) &&
          (!u.email || !removedSet.has(u.email.toLowerCase())),
      )

      return { success: true, data: finalUsers }
    } catch (err) {
      logger.error('Exceção ao listar usuários da empresa', err)
      return { success: false, error: 'Erro inesperado ao listar usuários.' }
    }
  },

  /**
   * Redefine a senha de um usuário cadastrado na empresa (Restrito ao Proprietário).
   */
  async resetCompanyUserPassword(
    companyId: UUID,
    userId: UUID | string,
    newPassword: string,
    userEmail?: string,
  ): Promise<ServiceResult<void>> {
    try {
      const cleanPassword = newPassword.trim()
      if (cleanPassword.length < 6) {
        return { success: false, error: 'A senha deve conter no mínimo 6 caracteres.' }
      }

      const cleanEmail = userEmail?.trim().toLowerCase() || null

      // 1. Chama a RPC administrativa segura que atualiza auth.users e auth.identities no banco remoto
      const { error: rpcError } = await supabase.rpc('admin_reset_company_user_password', {
        p_org_id: companyId,
        p_user_id: String(userId),
        p_new_password: cleanPassword,
        p_user_email: cleanEmail,
      })

      if (rpcError) {
        logger.error('Erro na RPC admin_reset_company_user_password', rpcError)
        return {
          success: false,
          error: rpcError.message || 'Não foi possível redefinir a senha do usuário.',
        }
      }

      // 2. Se for o administrador cadastrado nos detalhes da empresa, atualiza cache sincronizado
      if (cleanEmail) {
        try {
          const detailsRaw = localStorage.getItem(`${LOCAL_STORAGE_DETAILS_PREFIX}${companyId}`)
          if (detailsRaw) {
            const parsed = JSON.parse(detailsRaw)
            if (parsed.adminEmail && parsed.adminEmail.toLowerCase() === cleanEmail) {
              parsed.adminPassword = cleanPassword
              localStorage.setItem(`${LOCAL_STORAGE_DETAILS_PREFIX}${companyId}`, JSON.stringify(parsed))
            }
          }
        } catch {
          // ignore
        }
      }

      return { success: true, data: undefined }
    } catch (err: any) {
      logger.error('Exceção ao redefinir senha do usuário da empresa', err)
      return { success: false, error: err?.message || 'Erro ao redefinir a senha do usuário.' }
    }
  },
}
