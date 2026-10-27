import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UUID } from '@shared/types/common'

export interface Customer {
  id: UUID
  organizationId: UUID
  name: string
  phone: string | null
  email: string | null
  address: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateCustomerParams {
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
}

export interface UpdateCustomerParams {
  name?: string
  phone?: string | null
  email?: string | null
  address?: string | null
}

export const customerService = {
  /**
   * Lista todos os clientes da organização especificada.
   */
  async list(organizationId: UUID): Promise<ServiceResult<Customer[]>> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true })

      if (error) {
        logger.error('Erro ao listar clientes', error)
        return { success: false, error: 'Não foi possível carregar os clientes.' }
      }

      return {
        success: true,
        data: (data ?? []).map((c) => ({
          id: c.id,
          organizationId: c.organization_id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          address: c.address,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        })),
      }
    } catch (err) {
      logger.error('Exceção ao listar clientes', err)
      return { success: false, error: 'Erro inesperado ao consultar clientes.' }
    }
  },

  /**
   * Obtém um cliente específico pelo ID e organização.
   */
  async getById(organizationId: UUID, customerId: UUID): Promise<ServiceResult<Customer>> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('id', customerId)
        .maybeSingle()

      if (error || !data) {
        return { success: false, error: 'Cliente não encontrado.' }
      }

      return {
        success: true,
        data: {
          id: data.id,
          organizationId: data.organization_id,
          name: data.name,
          phone: data.phone,
          email: data.email,
          address: data.address,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      }
    } catch (err) {
      logger.error('Exceção ao buscar cliente', err)
      return { success: false, error: 'Erro inesperado ao consultar cliente.' }
    }
  },

  /**
   * Cadastra um novo cliente vinculado à organização do contexto.
   */
  async create(
    organizationId: UUID,
    params: CreateCustomerParams,
  ): Promise<ServiceResult<Customer>> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          organization_id: organizationId,
          name: params.name.trim(),
          phone: params.phone?.trim() || null,
          email: params.email?.trim() || null,
          address: params.address?.trim() || null,
        })
        .select()
        .single()

      if (error || !data) {
        logger.error('Erro ao cadastrar cliente', error)
        return { success: false, error: 'Não foi possível cadastrar o cliente.' }
      }

      return {
        success: true,
        data: {
          id: data.id,
          organizationId: data.organization_id,
          name: data.name,
          phone: data.phone,
          email: data.email,
          address: data.address,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      }
    } catch (err) {
      logger.error('Exceção ao cadastrar cliente', err)
      return { success: false, error: 'Erro inesperado ao cadastrar cliente.' }
    }
  },

  /**
   * Atualiza os dados de um cliente existente.
   */
  async update(
    organizationId: UUID,
    customerId: UUID,
    params: UpdateCustomerParams,
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          name: params.name?.trim(),
          phone: params.phone?.trim() ?? null,
          email: params.email?.trim() ?? null,
          address: params.address?.trim() ?? null,
        })
        .eq('organization_id', organizationId)
        .eq('id', customerId)

      if (error) {
        logger.error('Erro ao atualizar cliente', error)
        return { success: false, error: 'Falha ao salvar alterações do cliente.' }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao atualizar cliente', err)
      return { success: false, error: 'Erro inesperado ao atualizar cliente.' }
    }
  },

  /**
   * Remove um cliente (apenas se não houver orçamentos vinculados devido à FK RESTRICT).
   */
  async delete(organizationId: UUID, customerId: UUID): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', customerId)

      if (error) {
        if (error.code === '23503') {
          return {
            success: false,
            error: 'Não é possível excluir o cliente pois ele possui orçamentos associados.',
          }
        }
        return { success: false, error: 'Falha ao excluir o cliente.' }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao excluir cliente', err)
      return { success: false, error: 'Erro inesperado ao excluir o cliente.' }
    }
  },
}
