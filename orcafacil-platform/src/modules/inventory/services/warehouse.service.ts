import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UUID } from '@shared/types/common'

export interface Warehouse {
  id: UUID
  name: string
}

function getWarehouseError(error: { code?: string } | null, operation: string): string {
  if (error?.code === '23505') return 'Já existe um depósito com esse nome.'
  if (error?.code === '42501') return 'Seu usuário não tem permissão para gerenciar depósitos.'
  if (error?.code === 'PGRST204' || error?.code === 'PGRST205' || error?.code === '42P01') {
    return 'O cadastro de depósitos ainda não está disponível no banco. Aplique as migrações do Supabase.'
  }
  return `Não foi possível ${operation} o depósito. Tente novamente.`
}

export const warehouseService = {
  async list(organizationId: UUID): Promise<ServiceResult<Warehouse[]>> {
    try {
      const { data, error } = await supabase
        .from('inventory_warehouses')
        .select('id, name')
        .eq('organization_id', organizationId)
        .order('name')
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<Warehouse[]>()
      if (error) {
        logger.error('Erro ao listar depósitos', error)
        return { success: false, error: getWarehouseError(error, 'carregar') }
      }
      return { success: true, data }
    } catch (error) {
      logger.error('Exceção ao listar depósitos', error)
      return { success: false, error: 'Erro inesperado ao carregar depósitos.' }
    }
  },

  async create(organizationId: UUID, name: string): Promise<ServiceResult<Warehouse>> {
    try {
      const { data, error } = await supabase
        .from('inventory_warehouses')
        .insert({ organization_id: organizationId, name: name.trim() })
        .select('id, name')
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<Warehouse[]>()
        .single()
      if (error) {
        logger.error('Erro ao criar depósito', error)
        return { success: false, error: getWarehouseError(error, 'criar') }
      }
      return { success: true, data }
    } catch (error) {
      logger.error('Exceção ao criar depósito', error)
      return { success: false, error: 'Erro inesperado ao criar depósito.' }
    }
  },
}

