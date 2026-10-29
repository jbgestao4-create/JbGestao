import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, Supplier, UUID } from '@shared/types/common'

interface SupplierRow {
  id: string
  organization_id: string
  name: string
  document: string | null
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SupplierParams {
  name: string
  document: string
  contactName: string
  phone: string
  email: string
  address: string
  notes: string
}

function mapSupplier(row: {
  id: string
  organization_id: string
  name: string
  document: string | null
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}): Supplier {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    document: row.document,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function getSupplierError(error: { code?: string } | null, operation: string): string {
  if (error?.code === '23505') {
    return 'Já existe um fornecedor com este CNPJ nesta organização.'
  }
  if (error?.code === '42501') {
    return 'Seu usuário não tem acesso ao cadastro de fornecedores desta organização.'
  }
  if (error?.code === 'PGRST204' || error?.code === 'PGRST205' || error?.code === '42P01') {
    return 'O cadastro de fornecedores ainda não está disponível no banco. Aplique as migrações do Supabase.'
  }
  return `Não foi possível ${operation} o fornecedor. Verifique sua conexão e tente novamente.`
}

export const supplierService = {
  async getById(organizationId: UUID, supplierId: UUID): Promise<ServiceResult<Supplier>> {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('id', supplierId)
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<SupplierRow[]>()
        .maybeSingle()

      if (error) {
        logger.error('Erro ao consultar fornecedor', error)
        return { success: false, error: 'Não foi possível carregar os dados do fornecedor.' }
      }
      if (!data) return { success: false, error: 'Fornecedor não encontrado.' }
      return { success: true, data: mapSupplier(data) }
    } catch (error) {
      logger.error('Exceção ao consultar fornecedor', error)
      return { success: false, error: 'Erro inesperado ao consultar fornecedor.' }
    }
  },

  async list(organizationId: UUID): Promise<ServiceResult<Supplier[]>> {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true })
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<SupplierRow[]>()

      if (error) {
        logger.error('Erro ao listar fornecedores', error)
        return { success: false, error: getSupplierError(error, 'consultar') }
      }

      return { success: true, data: data.map(mapSupplier) }
    } catch (error) {
      logger.error('Exceção ao listar fornecedores', error)
      return { success: false, error: 'Erro inesperado ao consultar fornecedores.' }
    }
  },

  async create(organizationId: UUID, params: SupplierParams): Promise<ServiceResult<Supplier>> {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          organization_id: organizationId,
          name: params.name.trim(),
          document: params.document.replace(/\D/g, '') || null,
          contact_name: params.contactName.trim() || null,
          phone: params.phone.trim() || null,
          email: params.email.trim() || null,
          address: params.address.trim() || null,
          notes: params.notes.trim() || null,
        })
        .select()
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<SupplierRow[]>()
        .single()

      if (error) {
        logger.error('Erro ao cadastrar fornecedor', error)
        return { success: false, error: getSupplierError(error, 'cadastrar') }
      }
      return { success: true, data: mapSupplier(data) }
    } catch (error) {
      logger.error('Exceção ao cadastrar fornecedor', error)
      return { success: false, error: 'Erro inesperado ao cadastrar fornecedor.' }
    }
  },

  async update(
    organizationId: UUID,
    supplierId: UUID,
    params: SupplierParams,
  ): Promise<ServiceResult<void>> {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .update({
          name: params.name.trim(),
          document: params.document.replace(/\D/g, '') || null,
          contact_name: params.contactName.trim() || null,
          phone: params.phone.trim() || null,
          email: params.email.trim() || null,
          address: params.address.trim() || null,
          notes: params.notes.trim() || null,
        })
        .eq('organization_id', organizationId)
        .eq('id', supplierId)
        .select('id')
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<{ id: string }[]>()
        .maybeSingle()

      if (error) {
        logger.error('Erro ao atualizar fornecedor', error)
        return { success: false, error: getSupplierError(error, 'atualizar') }
      }
      if (!data) {
        return {
          success: false,
          error: 'Fornecedor não encontrado ou usuário sem acesso a este cadastro.',
        }
      }

      return { success: true, data: undefined }
    } catch (error) {
      logger.error('Exceção ao atualizar fornecedor', error)
      return { success: false, error: 'Erro inesperado ao atualizar fornecedor.' }
    }
  },

  async delete(organizationId: UUID, supplierId: UUID): Promise<ServiceResult<void>> {
    try {
      const { count, error: invoiceCountError } = await supabase
        .from('supplier_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('supplier_id', supplierId)
      if (invoiceCountError) {
        logger.error(
          'Erro ao verificar notas fiscais antes de excluir fornecedor',
          invoiceCountError,
        )
        return {
          success: false,
          error: 'Não foi possível verificar as notas fiscais deste fornecedor antes da exclusão.',
        }
      }
      if (count && count > 0) {
        return {
          success: false,
          error: 'Remova as notas fiscais anexadas à ficha antes de excluir este fornecedor.',
        }
      }

      const { data, error } = await supabase
        .from('suppliers')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', supplierId)
        .select('id')
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<{ id: string }[]>()
        .maybeSingle()

      if (error) {
        logger.error('Erro ao excluir fornecedor', error)
        return { success: false, error: getSupplierError(error, 'excluir') }
      }
      if (!data) {
        return {
          success: false,
          error: 'Fornecedor não encontrado ou usuário sem acesso a este cadastro.',
        }
      }

      return { success: true, data: undefined }
    } catch (error) {
      logger.error('Exceção ao excluir fornecedor', error)
      return { success: false, error: 'Erro inesperado ao excluir fornecedor.' }
    }
  },
}
