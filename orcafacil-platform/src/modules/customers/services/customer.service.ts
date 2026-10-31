import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { CustomerType, ServiceResult, UUID } from '@shared/types/common'

export interface Customer {
  id: UUID
  organizationId: UUID
  name: string
  personType: CustomerType
  document: string | null
  phone: string | null
  email: string | null
  address: string | null
  postalCode: string | null
  addressNumber: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateCustomerParams {
  name: string
  personType: CustomerType
  document?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  postalCode?: string | null
  addressNumber?: string | null
  notes?: string | null
}

export interface UpdateCustomerParams {
  name?: string
  personType?: CustomerType
  document?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  postalCode?: string | null
  addressNumber?: string | null
  notes?: string | null
}

function getCustomerCreateErrorMessage(error: { code?: string; message?: string } | null) {
  if (error?.code === 'PGRST204' || error?.code === '42703') {
    return 'O esquema da tabela de clientes no Supabase está desatualizado. Sincronize as migrações e tente novamente.'
  }

  if (error?.code === '42501') {
    return 'Sem permissão para cadastrar clientes nesta organização. Verifique se seu usuário pertence à organização selecionada.'
  }

  if (error?.code === '23502') {
    return 'Preencha todos os campos obrigatórios antes de salvar o cliente.'
  }

  if (error?.code === '23503') {
    return 'Não foi possível vincular o cliente à organização selecionada. Atualize a página e tente novamente.'
  }

  if (error?.code === 'PGRST116') {
    return 'O cliente não pôde ser confirmado após o cadastro. Verifique as permissões de leitura da organização antes de tentar novamente.'
  }

  return 'Não foi possível cadastrar o cliente. Verifique sua conexão e tente novamente.'
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
          personType: c.person_type ?? 'individual',
          document: c.document ?? null,
          phone: c.phone,
          email: c.email,
          address: c.address,
          postalCode: c.postal_code ?? null,
          addressNumber: c.address_number ?? null,
          notes: c.notes ?? null,
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
          personType: data.person_type ?? 'individual',
          document: data.document ?? null,
          phone: data.phone,
          email: data.email,
          address: data.address,
          postalCode: data.postal_code ?? null,
          addressNumber: data.address_number ?? null,
          notes: data.notes ?? null,
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
          person_type: params.personType,
          document: params.document?.replace(/\D/g, '') || null,
          phone: params.phone?.trim() || null,
          email: params.email?.trim() || null,
          address: params.address?.trim() || null,
          postal_code: params.postalCode?.replace(/\D/g, '') || null,
          address_number: params.addressNumber?.trim() || null,
          notes: params.notes?.trim() || null,
        })
        .select()
        .single()

      if (error || !data) {
        logger.error('Erro ao cadastrar cliente', error, {
          code: error?.code,
          message: error?.message,
        })
        return {
          success: false,
          error: getCustomerCreateErrorMessage(error),
          ...(error?.code && { code: error.code }),
        }
      }

      return {
        success: true,
        data: {
          id: data.id,
          organizationId: data.organization_id,
          name: data.name,
          personType: data.person_type ?? 'individual',
          document: data.document ?? null,
          phone: data.phone,
          email: data.email,
          address: data.address,
          postalCode: data.postal_code ?? null,
          addressNumber: data.address_number ?? null,
          notes: data.notes ?? null,
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
          ...(params.personType !== undefined && { person_type: params.personType }),
          ...(params.document !== undefined && {
            document: params.document?.replace(/\D/g, '') || null,
          }),
          ...(params.phone !== undefined && { phone: params.phone?.trim() || null }),
          ...(params.email !== undefined && { email: params.email?.trim() || null }),
          ...(params.address !== undefined && { address: params.address?.trim() || null }),
          ...(params.postalCode !== undefined && {
            postal_code: params.postalCode?.replace(/\D/g, '') || null,
          }),
          ...(params.addressNumber !== undefined && {
            address_number: params.addressNumber?.trim() || null,
          }),
          ...(params.notes !== undefined && { notes: params.notes?.trim() || null }),
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
