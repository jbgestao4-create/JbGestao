import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ModuleCode } from '@shared/types/database'
import type { ServiceResult, UUID } from '@shared/types/common'

export interface PlatformModule {
  id: UUID
  code: ModuleCode
  name: string
  isGloballyAvailable: boolean
  description: string
  status: 'available' | 'coming_soon' | 'planned'
}

export interface GrantedModule {
  moduleId: UUID
  code: ModuleCode
  name: string
  status: 'active' | 'inactive' | 'suspended'
  activatedAt: string | null
  expiresAt: string | null
}

/** Catálogo estático e documentado dos módulos da plataforma */
export const PLATFORM_MODULES_CATALOG: PlatformModule[] = [
  {
    id: '1',
    code: 'orcafacil',
    name: 'OrçaFácil',
    isGloballyAvailable: true,
    description: 'Gestão comercial, clientes, serviços, materiais e propostas profissionais.',
    status: 'available',
  },
  {
    id: '2',
    code: 'agendapro',
    name: 'AgendaPro',
    isGloballyAvailable: false,
    description: 'Agendamentos inteligentes, gestão de horários, atendimentos e clientes.',
    status: 'coming_soon',
  },
  {
    id: '3',
    code: 'estoqueleve',
    name: 'EstoqueLeve',
    isGloballyAvailable: false,
    description: 'Controle simplificado de estoque, movimentações, compras e alertas de reposição.',
    status: 'planned',
  },
]

export const moduleAccessService = {
  /**
   * Obtém a lista de todos os módulos disponíveis na plataforma.
   */
  async getAllModules(): Promise<ServiceResult<PlatformModule[]>> {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .order('name', { ascending: true })

      if (error || !data) {
        // Fallback para o catálogo estático se o banco não responder
        return { success: true, data: PLATFORM_MODULES_CATALOG }
      }

      const modules: PlatformModule[] = data.map((m) => {
        const meta = PLATFORM_MODULES_CATALOG.find((cat) => cat.code === m.code)
        return {
          id: m.id,
          code: m.code as ModuleCode,
          name: m.name,
          isGloballyAvailable: m.is_globally_available,
          description: meta?.description ?? 'Módulo da plataforma OrçaFácil',
          status: meta?.status ?? (m.is_globally_available ? 'available' : 'coming_soon'),
        }
      })

      return { success: true, data: modules }
    } catch (err) {
      logger.error('Erro ao consultar módulos', err)
      return { success: true, data: PLATFORM_MODULES_CATALOG }
    }
  },

  /**
   * Obtém os módulos concedidos à organização especificada.
   */
  async getOrganizationModules(organizationId: UUID): Promise<ServiceResult<GrantedModule[]>> {
    try {
      const { data, error } = await supabase
        .from('organization_modules')
        .select(
          `
          module_id,
          status,
          activated_at,
          expires_at,
          modules (
            id,
            code,
            name,
            is_globally_available
          )
        `,
        )
        .eq('organization_id', organizationId)
        .eq('status', 'active')

      if (error) {
        logger.error('Erro ao buscar módulos da organização', error)
        return { success: false, error: 'Não foi possível verificar as permissões dos módulos.' }
      }

      const granted: GrantedModule[] = (data ?? [])
        .filter((item) => item.modules !== null)
        .map((item) => {
          // Normaliza o join
          const mod = Array.isArray(item.modules) ? item.modules[0] : item.modules
          return {
            moduleId: item.module_id,
            code: mod.code as ModuleCode,
            name: mod.name,
            status: item.status,
            activatedAt: item.activated_at,
            expiresAt: item.expires_at,
          }
        })

      return { success: true, data: granted }
    } catch (err) {
      logger.error('Exceção ao buscar módulos da organização', err)
      return { success: false, error: 'Erro inesperado na checagem de módulos.' }
    }
  },

  /**
   * Verifica de forma segura se a organização possui acesso ativo ao módulo especificado.
   */
  async canAccessModule(organizationId: UUID, moduleCode: ModuleCode): Promise<boolean> {
    const result = await this.getOrganizationModules(organizationId)
    if (!result.success) return false

    return result.data.some(
      (m) =>
        m.code === moduleCode &&
        m.status === 'active' &&
        (!m.expiresAt || new Date(m.expiresAt) > new Date()),
    )
  },
}
