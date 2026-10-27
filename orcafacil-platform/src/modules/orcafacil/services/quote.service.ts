import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import { recalculateQuote, type QuoteItemCalculationInput } from '../domain/quote-calculations'
import { isValidStatusTransition } from '../domain/quote-status'
import type { QuoteStatus } from '@shared/types/database'
import type { ServiceResult, UUID } from '@shared/types/common'

export interface QuoteListItem {
  id: UUID
  organizationId: UUID
  customerId: UUID
  customerName: string
  quoteNumber: string
  status: QuoteStatus
  subtotal: string
  discount: string
  total: string
  validUntil: string | null
  createdAt: string
  updatedAt: string
}

export interface QuoteDetailItem {
  id: UUID
  description: string
  quantity: string
  unitPrice: string
  total: string
  sortOrder: number
}

export interface QuoteDetail extends QuoteListItem {
  notes: string | null
  items: QuoteDetailItem[]
}

export interface CreateQuoteParams {
  customerId: UUID
  notes?: string | null
  validUntil?: string | null
  discount?: string
  items: QuoteItemCalculationInput[]
}

export interface UpdateQuoteParams {
  customerId?: UUID
  notes?: string | null
  validUntil?: string | null
  discount?: string
  status?: QuoteStatus
  items?: QuoteItemCalculationInput[]
}

export const quoteService = {
  /**
   * Lista todos os orçamentos da organização.
   */
  async listQuotes(organizationId: UUID): Promise<ServiceResult<QuoteListItem[]>> {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(
          `
          id,
          organization_id,
          customer_id,
          quote_number,
          status,
          subtotal,
          discount,
          total,
          valid_until,
          created_at,
          updated_at,
          customers (
            name
          )
        `,
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Erro ao listar orçamentos', error)
        return { success: false, error: 'Não foi possível carregar os orçamentos.' }
      }

      const list: QuoteListItem[] = (data ?? []).map((q) => {
        const cust = Array.isArray(q.customers) ? q.customers[0] : q.customers
        return {
          id: q.id,
          organizationId: q.organization_id,
          customerId: q.customer_id,
          customerName: cust?.name ?? 'Cliente Desconhecido',
          quoteNumber: q.quote_number,
          status: q.status as QuoteStatus,
          subtotal: q.subtotal,
          discount: q.discount,
          total: q.total,
          validUntil: q.valid_until,
          createdAt: q.created_at,
          updatedAt: q.updated_at,
        }
      })

      return { success: true, data: list }
    } catch (err) {
      logger.error('Exceção ao listar orçamentos', err)
      return { success: false, error: 'Erro inesperado ao consultar orçamentos.' }
    }
  },

  /**
   * Obtém os detalhes completos de um orçamento com seus itens.
   */
  async getQuote(organizationId: UUID, quoteId: UUID): Promise<ServiceResult<QuoteDetail>> {
    try {
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select(
          `
          id,
          organization_id,
          customer_id,
          quote_number,
          status,
          subtotal,
          discount,
          total,
          valid_until,
          notes,
          created_at,
          updated_at,
          customers (
            name
          )
        `,
        )
        .eq('organization_id', organizationId)
        .eq('id', quoteId)
        .maybeSingle()

      if (quoteError || !quote) {
        return { success: false, error: 'Orçamento não encontrado.' }
      }

      const { data: items, error: itemsError } = await supabase
        .from('quote_items')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('quote_id', quoteId)
        .order('sort_order', { ascending: true })

      if (itemsError) {
        logger.error('Erro ao carregar itens do orçamento', itemsError)
        return { success: false, error: 'Não foi possível carregar os itens do orçamento.' }
      }

      const cust = Array.isArray(quote.customers) ? quote.customers[0] : quote.customers

      return {
        success: true,
        data: {
          id: quote.id,
          organizationId: quote.organization_id,
          customerId: quote.customer_id,
          customerName: cust?.name ?? '',
          quoteNumber: quote.quote_number,
          status: quote.status as QuoteStatus,
          subtotal: quote.subtotal,
          discount: quote.discount,
          total: quote.total,
          validUntil: quote.valid_until,
          notes: quote.notes,
          createdAt: quote.created_at,
          updatedAt: quote.updated_at,
          items: (items ?? []).map((item) => ({
            id: item.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            total: item.total,
            sortOrder: item.sort_order,
          })),
        },
      }
    } catch (err) {
      logger.error('Exceção ao obter orçamento', err)
      return { success: false, error: 'Erro inesperado ao consultar orçamento.' }
    }
  },

  /**
   * Cria um novo orçamento com seus itens de forma atômica e recalculada.
   */
  async createQuote(organizationId: UUID, params: CreateQuoteParams): Promise<ServiceResult<UUID>> {
    try {
      // 1. Recalcula valores de forma confiável
      const calculated = recalculateQuote(params.items, params.discount ?? '0.00')

      // 2. Gera número do orçamento baseado no timestamp
      const quoteNumber = `ORC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`

      // 3. Insere cabeçalho do orçamento
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          organization_id: organizationId,
          customer_id: params.customerId,
          quote_number: quoteNumber,
          status: 'draft',
          subtotal: calculated.subtotal,
          discount: calculated.discount,
          total: calculated.total,
          valid_until: params.validUntil || null,
          notes: params.notes || null,
        })
        .select('id')
        .single()

      if (quoteError || !quote) {
        logger.error('Erro ao criar orçamento', quoteError)
        return { success: false, error: 'Não foi possível criar o orçamento.' }
      }

      // 4. Insere os itens vinculados à organização e ao orçamento
      if (calculated.items.length > 0) {
        const itemsToInsert = calculated.items.map((item) => ({
          organization_id: organizationId,
          quote_id: quote.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total: item.total,
          sort_order: item.sortOrder,
        }))

        const { error: itemsError } = await supabase.from('quote_items').insert(itemsToInsert)

        if (itemsError) {
          logger.error('Erro ao inserir itens do orçamento', itemsError)
          // Tenta limpar o cabeçalho em caso de falha nos itens
          await supabase.from('quotes').delete().eq('id', quote.id)
          return { success: false, error: 'Falha ao salvar os itens do orçamento.' }
        }
      }

      return { success: true, data: quote.id }
    } catch (err) {
      logger.error('Exceção ao criar orçamento', err)
      return { success: false, error: 'Erro inesperado ao cadastrar orçamento.' }
    }
  },

  /**
   * Altera o status do orçamento com validação estrita da máquina de estados.
   */
  async updateStatus(
    organizationId: UUID,
    quoteId: UUID,
    newStatus: QuoteStatus,
  ): Promise<ServiceResult<void>> {
    try {
      // 1. Consulta status atual
      const { data: current, error: fetchError } = await supabase
        .from('quotes')
        .select('status')
        .eq('organization_id', organizationId)
        .eq('id', quoteId)
        .single()

      if (fetchError || !current) {
        return { success: false, error: 'Orçamento não encontrado.' }
      }

      const currentStatus = current.status as QuoteStatus

      // 2. Valida transição permitida
      if (!isValidStatusTransition(currentStatus, newStatus)) {
        return {
          success: false,
          error: `Transição de status inválida de "${currentStatus}" para "${newStatus}".`,
        }
      }

      // 3. Aplica alteração
      const { error: updateError } = await supabase
        .from('quotes')
        .update({ status: newStatus })
        .eq('organization_id', organizationId)
        .eq('id', quoteId)

      if (updateError) {
        return { success: false, error: 'Não foi possível atualizar o status do orçamento.' }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao atualizar status', err)
      return { success: false, error: 'Erro inesperado ao atualizar status.' }
    }
  },

  /**
   * Exclui um orçamento e seus itens (via CASCADE no banco).
   */
  async deleteQuote(organizationId: UUID, quoteId: UUID): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', quoteId)

      if (error) {
        logger.error('Erro ao excluir orçamento', error)
        return { success: false, error: 'Não foi possível excluir o orçamento.' }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao excluir orçamento', err)
      return { success: false, error: 'Erro inesperado ao excluir o orçamento.' }
    }
  },
}
