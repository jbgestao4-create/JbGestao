import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UUID } from '@shared/types/common'

const SUPPLIER_INVOICE_BUCKET = 'supplier-invoices'
export const MAX_SUPPLIER_INVOICE_SIZE_BYTES = 20 * 1024 * 1024

interface SupplierInvoiceRow {
  id: string
  organization_id: string
  supplier_id: string
  invoice_number: string | null
  received_at: string
  file_path: string
  file_name: string
  content_type: string
  file_size: number
  created_at: string
}

export interface SupplierInvoice {
  id: UUID
  organizationId: UUID
  supplierId: UUID
  invoiceNumber: string | null
  receivedAt: string
  filePath: string
  fileName: string
  contentType: string
  fileSize: number
  createdAt: string
}

export interface UploadSupplierInvoiceParams {
  file: File
  invoiceNumber: string
  receivedAt: string
}

function mapInvoice(row: SupplierInvoiceRow): SupplierInvoice {
  return {
    id: row.id,
    organizationId: row.organization_id,
    supplierId: row.supplier_id,
    invoiceNumber: row.invoice_number,
    receivedAt: row.received_at,
    filePath: row.file_path,
    fileName: row.file_name,
    contentType: row.content_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
  }
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(-120)
}

function getInvoiceError(error: { code?: string; message?: string } | null) {
  if (error?.code === '42501') {
    return 'Seu usuário não tem acesso às notas fiscais deste fornecedor.'
  }
  if (error?.code === 'PGRST204' || error?.code === 'PGRST205' || error?.code === '42P01') {
    return 'O armazenamento de notas fiscais ainda não está configurado. Aplique a migração 00015_supplier_invoices.sql no Supabase.'
  }
  const message = error?.message?.toLowerCase() ?? ''
  if (message.includes('bucket not found')) {
    return 'O armazenamento de notas fiscais não está configurado. Aplique a migração 00015_supplier_invoices.sql no Supabase.'
  }
  if (
    message.includes('row-level security') ||
    message.includes('permission denied') ||
    message.includes('unauthorized')
  ) {
    return 'O Supabase bloqueou o acesso ao arquivo. Verifique a permissão do MOD-06 e aplique a migração 00015.'
  }
  if (message.includes('mime type') || message.includes('content-type')) {
    return 'Formato de arquivo não permitido. Anexe um PDF, JPG ou PNG.'
  }
  if (message.includes('too large') || message.includes('maximum allowed size')) {
    return 'O arquivo excede o limite de 20 MB.'
  }
  return 'Não foi possível processar a nota fiscal. Verifique a conexão e tente novamente.'
}

export const supplierInvoiceService = {
  async list(organizationId: UUID, supplierId: UUID): Promise<ServiceResult<SupplierInvoice[]>> {
    try {
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('supplier_id', supplierId)
        .order('received_at', { ascending: false })
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<SupplierInvoiceRow[]>()

      if (error) {
        logger.error('Erro ao consultar notas fiscais do fornecedor', error)
        return { success: false, error: getInvoiceError(error) }
      }
      return { success: true, data: data.map(mapInvoice) }
    } catch (error) {
      logger.error('Exceção ao consultar notas fiscais do fornecedor', error)
      return { success: false, error: 'Erro inesperado ao consultar notas fiscais.' }
    }
  },

  async upload(
    organizationId: UUID,
    supplierId: UUID,
    params: UploadSupplierInvoiceParams,
  ): Promise<ServiceResult<SupplierInvoice>> {
    const { file } = params
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      return { success: false, error: 'Anexe uma nota em PDF, JPG ou PNG.' }
    }
    if (file.size <= 0 || file.size > MAX_SUPPLIER_INVOICE_SIZE_BYTES) {
      return { success: false, error: 'O arquivo deve ter até 20 MB e não pode estar vazio.' }
    }
    if (!params.receivedAt || Number.isNaN(Date.parse(`${params.receivedAt}T00:00:00`))) {
      return { success: false, error: 'Informe uma data válida de recebimento da nota.' }
    }

    const filePath = `${organizationId}/${supplierId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
    try {
      const { error: uploadError } = await supabase.storage
        .from(SUPPLIER_INVOICE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        logger.error('Erro ao enviar nota fiscal do fornecedor', uploadError)
        return { success: false, error: getInvoiceError(uploadError) }
      }

      const { data, error } = await supabase
        .from('supplier_invoices')
        .insert({
          organization_id: organizationId,
          supplier_id: supplierId,
          invoice_number: params.invoiceNumber.trim() || null,
          received_at: params.receivedAt,
          file_path: filePath,
          file_name: file.name,
          content_type: file.type,
          file_size: file.size,
        })
        .select('*')
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<SupplierInvoiceRow[]>()
        .single()

      if (error) {
        logger.error('Erro ao salvar os dados da nota fiscal', error)
        const { error: cleanupError } = await supabase.storage
          .from(SUPPLIER_INVOICE_BUCKET)
          .remove([filePath])
        if (cleanupError) logger.error('Erro ao remover arquivo enviado sem registro', cleanupError)
        return { success: false, error: getInvoiceError(error) }
      }

      return { success: true, data: mapInvoice(data) }
    } catch (error) {
      logger.error('Exceção ao anexar nota fiscal do fornecedor', error)
      return { success: false, error: 'Erro inesperado ao anexar a nota fiscal.' }
    }
  },

  async getDownloadUrl(filePath: string): Promise<ServiceResult<string>> {
    try {
      const { data, error } = await supabase.storage
        .from(SUPPLIER_INVOICE_BUCKET)
        .createSignedUrl(filePath, 60)
      if (error) {
        logger.error('Erro ao criar link para nota fiscal', error)
        return { success: false, error: 'Não foi possível abrir o arquivo da nota fiscal.' }
      }
      return { success: true, data: data.signedUrl }
    } catch (error) {
      logger.error('Exceção ao criar link da nota fiscal', error)
      return { success: false, error: 'Erro inesperado ao abrir a nota fiscal.' }
    }
  },

  async delete(organizationId: UUID, invoice: SupplierInvoice): Promise<ServiceResult<void>> {
    try {
      const { error: storageError } = await supabase.storage
        .from(SUPPLIER_INVOICE_BUCKET)
        .remove([invoice.filePath])
      if (storageError) {
        logger.error('Erro ao remover arquivo da nota fiscal', storageError)
        return { success: false, error: 'Não foi possível remover o arquivo da nota fiscal.' }
      }

      const { data, error } = await supabase
        .from('supplier_invoices')
        .delete()
        .eq('organization_id', organizationId)
        .eq('supplier_id', invoice.supplierId)
        .eq('id', invoice.id)
        .select('id')
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<{ id: string }[]>()
        .maybeSingle()

      if (error) {
        logger.error('Erro ao excluir registro da nota fiscal', error)
        return { success: false, error: getInvoiceError(error) }
      }
      if (!data) {
        return { success: false, error: 'Nota fiscal não encontrada nesta ficha.' }
      }
      return { success: true, data: undefined }
    } catch (error) {
      logger.error('Exceção ao excluir nota fiscal do fornecedor', error)
      return { success: false, error: 'Erro inesperado ao excluir a nota fiscal.' }
    }
  },
}
