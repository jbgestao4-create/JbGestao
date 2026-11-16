import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { DashboardModuleCode, ServiceResult, UUID } from '@shared/types/common'

export interface AccessPlan {
  id: UUID
  name: string
  description: string
  modules: DashboardModuleCode[]
  isActive: boolean
  isSystem: boolean
  isLocked: boolean
  monthlyPrice?: number
}

export interface SaveAccessPlanParams {
  id?: UUID
  name: string
  description: string
  modules: DashboardModuleCode[]
  isActive: boolean
  monthlyPrice?: number
}

const PUBLIC_PLANS_CACHE_KEY = 'jb_public_access_plans_cache'

const DEFAULT_PLAN_PRICES_BY_ID: Record<string, number> = {
  '00000000-0000-4000-8000-000000000001': 99.9,
  '00000000-0000-4000-8000-000000000002': 129.9,
  '00000000-0000-4000-8000-000000000003': 159.9,
  '00000000-0000-4000-8000-000000000004': 199.9,
}

export const SYSTEM_DEFAULT_ACCESS_PLANS: AccessPlan[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Básico',
    description:
      'Recursos essenciais para vendas, estoque, clientes, caixa, fornecedores e organização.',
    modules: [
      'MOD-01',
      'MOD-01_QUICK_SALE',
      'MOD-01_SEARCH',
      'MOD-02',
      'MOD-02_CREATE',
      'MOD-02_SEARCH',
      'MOD-02_MOVEMENTS',
      'MOD-02_IMPORT_NFE',
      'MOD-03',
      'MOD-03_CREATE',
      'MOD-03_SEARCH',
      'MOD-05',
      'MOD-05_SESSION',
      'MOD-05_MOVEMENTS',
      'MOD-05_BILLS',
      'MOD-06',
      'MOD-06_CREATE',
      'MOD-06_SEARCH',
      'MOD-07',
      'MOD-07_DETAILS',
      'MOD-07_MEMBERS',
    ],
    isActive: true,
    isSystem: true,
    isLocked: false,
    monthlyPrice: 99.9,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Básico + PDV sem NF-e',
    description: 'Plano Básico com Ponto de Venda, sem emissão de NF-e ou NFC-e.',
    modules: [
      'MOD-01',
      'MOD-01_QUICK_SALE',
      'MOD-01_SEARCH',
      'MOD-01_PDV',
      'MOD-02',
      'MOD-02_CREATE',
      'MOD-02_SEARCH',
      'MOD-02_MOVEMENTS',
      'MOD-02_IMPORT_NFE',
      'MOD-03',
      'MOD-03_CREATE',
      'MOD-03_SEARCH',
      'MOD-05',
      'MOD-05_SESSION',
      'MOD-05_MOVEMENTS',
      'MOD-05_BILLS',
      'MOD-06',
      'MOD-06_CREATE',
      'MOD-06_SEARCH',
      'MOD-07',
      'MOD-07_DETAILS',
      'MOD-07_MEMBERS',
    ],
    isActive: true,
    isSystem: true,
    isLocked: false,
    monthlyPrice: 129.9,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Completo sem emissão de NF-e e NFC-e',
    description: 'Acesso a todas as funções disponíveis, exceto emissão de NF-e e NFC-e.',
    modules: [
      'MOD-01',
      'MOD-01_QUICK_SALE',
      'MOD-01_PDV',
      'MOD-01_SEARCH',
      'MOD-02',
      'MOD-02_CREATE',
      'MOD-02_SEARCH',
      'MOD-02_IMPORT_NFE',
      'MOD-02_MOVEMENTS',
      'MOD-03',
      'MOD-03_CREATE',
      'MOD-03_SEARCH',
      'MOD-04',
      'MOD-04_CREATE',
      'MOD-04_SEARCH',
      'MOD-05',
      'MOD-05_SESSION',
      'MOD-05_MOVEMENTS',
      'MOD-05_BILLS',
      'MOD-06',
      'MOD-06_CREATE',
      'MOD-06_SEARCH',
      'MOD-07',
      'MOD-07_DETAILS',
      'MOD-07_MEMBERS',
      'MOD-08',
      'MOD-08_SALES',
      'MOD-08_INVENTORY',
      'MOD-09',
      'MOD-09_CREATE',
      'MOD-09_SEARCH',
      'MOD-10',
      'MOD-10_CREATE',
      'MOD-10_SEARCH',
      'MOD-11',
      'MOD-11_EXECUTE',
    ],
    isActive: true,
    isSystem: true,
    isLocked: false,
    monthlyPrice: 159.9,
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    name: 'Completo com emissão de NF-e e NFC-e',
    description:
      'Plano em desenvolvimento. Será disponibilizado quando a emissão fiscal estiver pronta.',
    modules: [
      'MOD-01',
      'MOD-01_QUICK_SALE',
      'MOD-01_PDV',
      'MOD-01_INVOICES',
      'MOD-01_SEARCH',
      'MOD-02',
      'MOD-02_CREATE',
      'MOD-02_SEARCH',
      'MOD-02_IMPORT_NFE',
      'MOD-02_MOVEMENTS',
      'MOD-03',
      'MOD-03_CREATE',
      'MOD-03_SEARCH',
      'MOD-04',
      'MOD-04_CREATE',
      'MOD-04_SEARCH',
      'MOD-05',
      'MOD-05_SESSION',
      'MOD-05_MOVEMENTS',
      'MOD-05_BILLS',
      'MOD-06',
      'MOD-06_CREATE',
      'MOD-06_SEARCH',
      'MOD-07',
      'MOD-07_DETAILS',
      'MOD-07_MEMBERS',
      'MOD-08',
      'MOD-08_SALES',
      'MOD-08_INVENTORY',
      'MOD-09',
      'MOD-09_CREATE',
      'MOD-09_SEARCH',
      'MOD-10',
      'MOD-10_CREATE',
      'MOD-10_SEARCH',
      'MOD-11',
      'MOD-11_EXECUTE',
    ],
    isActive: false,
    isSystem: true,
    isLocked: true,
    monthlyPrice: 199.9,
  },
]

function savePlansCache(plans: AccessPlan[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PUBLIC_PLANS_CACHE_KEY, JSON.stringify(plans))
  } catch {
    // ignore storage errors
  }
}

function getCachedPlans(): AccessPlan[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PUBLIC_PLANS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as AccessPlan[]
    }
    return null
  } catch {
    return null
  }
}

interface RpcResponse {
  data: unknown
  error: unknown
}

function parseRpcResponse(value: unknown): RpcResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Resposta inválida do servidor.')
  }
  const response = value as Record<string, unknown>
  return { data: response.data, error: response.error }
}

function getRpcErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('message' in error)) return null
  return typeof error.message === 'string' ? error.message : null
}

function mapAccessPlan(value: unknown): AccessPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('O servidor retornou um plano inválido.')
  }
  const plan = value as Record<string, unknown>
  if (
    typeof plan.id !== 'string' ||
    typeof plan.name !== 'string' ||
    typeof plan.description !== 'string' ||
    !Array.isArray(plan.module_codes) ||
    !plan.module_codes.every((code) => typeof code === 'string')
  ) {
    throw new Error('O servidor retornou um plano incompleto ou inválido.')
  }

  const rawPrice = Number(plan.monthly_price ?? plan.monthlyPrice)
  const monthlyPrice =
    !isNaN(rawPrice) && rawPrice > 0
      ? rawPrice
      : (DEFAULT_PLAN_PRICES_BY_ID[plan.id] ?? 149.9)

  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    modules: plan.module_codes,
    isActive: plan.is_active === true,
    isSystem: plan.is_system === true,
    isLocked: plan.is_locked === true,
    monthlyPrice,
  }
}

export const accessPlanService = {
  async listPublic(): Promise<AccessPlan[]> {
    try {
      const publicRpc = await supabase.rpc('public_list_access_plans')
      if (!publicRpc.error && Array.isArray(publicRpc.data) && publicRpc.data.length > 0) {
        const mapped = publicRpc.data.map(mapAccessPlan)
        savePlansCache(mapped)
        return mapped
      }
    } catch {
      // fallback below
    }

    try {
      const adminRpc = await supabase.rpc('admin_list_access_plans')
      if (!adminRpc.error && Array.isArray(adminRpc.data) && adminRpc.data.length > 0) {
        const mapped = adminRpc.data.map(mapAccessPlan)
        savePlansCache(mapped)
        return mapped
      }
    } catch {
      // fallback below
    }

    const cached = getCachedPlans()
    if (cached && cached.length > 0) {
      return cached
    }

    return SYSTEM_DEFAULT_ACCESS_PLANS
  },

  async assignToCompany(
    companyId: UUID,
    plan: AccessPlan,
  ): Promise<ServiceResult<void>> {
    try {
      const response = parseRpcResponse(
        await supabase.rpc('admin_assign_access_plan_to_company', {
          p_org_id: companyId,
          p_plan_id: plan.id,
        }),
      )
      if (response.error) {
        logger.error('Erro ao definir plano de acesso para empresa', response.error)
        return {
          success: false,
          error: getRpcErrorMessage(response.error) || 'Não foi possível definir o plano para a empresa.',
        }
      }

      return { success: true, data: undefined }
    } catch (error) {
      logger.error('Exceção ao definir plano de acesso para empresa', error)
      return { success: false, error: 'Erro inesperado ao definir o plano para a empresa.' }
    }
  },

  async list(): Promise<ServiceResult<AccessPlan[]>> {
    try {
      const response = parseRpcResponse(await supabase.rpc('admin_list_access_plans'))
      if (response.error) {
        logger.error('Erro ao carregar planos de acesso', response.error)
        return { success: false, error: 'Não foi possível carregar os planos de acesso.' }
      }
      if (!Array.isArray(response.data)) {
        throw new Error('O servidor retornou uma lista de planos inválida.')
      }

      const mapped = response.data.map(mapAccessPlan)
      savePlansCache(mapped)
      return {
        success: true,
        data: mapped,
      }
    } catch (error) {
      logger.error('Exceção ao carregar planos de acesso', error)
      return { success: false, error: 'Erro inesperado ao carregar planos de acesso.' }
    }
  },

  async save(params: SaveAccessPlanParams): Promise<ServiceResult<AccessPlan>> {
    try {
      const response = parseRpcResponse(await supabase.rpc('admin_save_access_plan', {
        p_id: params.id ?? null,
        p_name: params.name.trim(),
        p_description: params.description.trim(),
        p_module_codes: params.modules,
        p_is_active: params.isActive,
        p_monthly_price:
          typeof params.monthlyPrice === 'number' && params.monthlyPrice >= 0
            ? params.monthlyPrice
            : null,
      }))

      if (response.error) {
        logger.error('Erro ao salvar plano de acesso', response.error)
        return {
          success: false,
          error: getRpcErrorMessage(response.error) || 'Não foi possível salvar o plano.',
        }
      }

      const saved = mapAccessPlan(response.data)
      if (typeof params.monthlyPrice === 'number' && params.monthlyPrice > 0) {
        saved.monthlyPrice = params.monthlyPrice
      }
      const currentCached = getCachedPlans() ?? [...SYSTEM_DEFAULT_ACCESS_PLANS]
      const idx = currentCached.findIndex((p) => p.id === saved.id)
      if (idx >= 0) {
        currentCached[idx] = saved
      } else {
        currentCached.push(saved)
      }
      savePlansCache(currentCached)

      return { success: true, data: saved }
    } catch (error) {
      logger.error('Exceção ao salvar plano de acesso', error)
      return { success: false, error: 'Erro inesperado ao salvar o plano.' }
    }
  },

  async remove(id: UUID): Promise<ServiceResult<void>> {
    try {
      const response = parseRpcResponse(await supabase.rpc('admin_delete_access_plan', { p_id: id }))
      if (response.error) {
        logger.error('Erro ao remover plano de acesso', response.error)
        return {
          success: false,
          error: getRpcErrorMessage(response.error) || 'Não foi possível remover o plano.',
        }
      }
      const currentCached = getCachedPlans()
      if (currentCached) {
        savePlansCache(currentCached.filter((p) => p.id !== id))
      }
      return { success: true, data: undefined }
    } catch (error) {
      logger.error('Exceção ao remover plano de acesso', error)
      return { success: false, error: 'Erro inesperado ao remover o plano.' }
    }
  },
}
