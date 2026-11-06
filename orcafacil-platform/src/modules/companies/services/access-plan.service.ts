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
}

export interface SaveAccessPlanParams {
  id?: UUID
  name: string
  description: string
  modules: DashboardModuleCode[]
  isActive: boolean
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

  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    modules: plan.module_codes,
    isActive: plan.is_active === true,
    isSystem: plan.is_system === true,
    isLocked: plan.is_locked === true,
  }
}

export const accessPlanService = {
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

      return {
        success: true,
        data: response.data.map(mapAccessPlan),
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
      }))

      if (response.error) {
        logger.error('Erro ao salvar plano de acesso', response.error)
        return {
          success: false,
          error: getRpcErrorMessage(response.error) || 'Não foi possível salvar o plano.',
        }
      }

      return { success: true, data: mapAccessPlan(response.data) }
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
      return { success: true, data: undefined }
    } catch (error) {
      logger.error('Exceção ao remover plano de acesso', error)
      return { success: false, error: 'Erro inesperado ao remover o plano.' }
    }
  },
}
