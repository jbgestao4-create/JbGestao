import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import { recalculateQuote, type QuoteItemCalculationInput } from '../domain/quote-calculations'
import { isValidStatusTransition } from '../domain/quote-status'
import { getMinimumSalePriceViolations } from '../domain/minimum-sale-price'
import type { QuoteStatus } from '@shared/types/database'
import type { ServiceResult, UUID } from '@shared/types/common'
import { formatCurrency } from '@shared/utils/monetary'

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
  inventoryItemId: UUID | null
  unit: string | null
}

interface QuoteItemRow {
  id: string
  description: string
  quantity: string
  unit_price: string
  total: string
  sort_order: number
  inventory_item_id: UUID | null
  unit: string | null
}

interface InventoryMinimumPriceRow {
  id: string
  name: string
  minimum_sale_price: string | null
}

export interface QuoteItemInput extends QuoteItemCalculationInput {
  inventoryItemId?: UUID | null
  unit?: string | null
}

export interface QuoteDetail extends QuoteListItem {
  notes: string | null
  creatorName: string | null
  customerPhone: string | null
  customerEmail: string | null
  customerAddress: string | null
  items: QuoteDetailItem[]
}

export interface CreateQuoteParams {
  customerId: UUID
  notes?: string | null
  validUntil?: string | null
  discount?: string
  items: QuoteItemInput[]
}

export interface UpdateQuoteParams {
  customerId: UUID
  notes: string | null
  validUntil: string | null
  discount: string
  items: QuoteItemInput[]
}

async function validateMinimumSalePrices(
  organizationId: UUID,
  items: QuoteItemInput[],
): Promise<ServiceResult<void>> {
  const inventoryItemIds = [...new Set(items.map((item) => item.inventoryItemId).filter(Boolean))]
  if (inventoryItemIds.length === 0) return { success: true, data: undefined }

  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, name, minimum_sale_price')
    .eq('organization_id', organizationId)
    .in('id', inventoryItemIds)
    // The shared Supabase client is untyped; this keeps the response typed locally.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    .returns<InventoryMinimumPriceRow[]>()

  if (error) {
    logger.error('Erro ao validar preço mínimo dos produtos do orçamento', error)
    return {
      success: false,
      error: 'Não foi possível validar os preços mínimos do estoque. Tente novamente.',
    }
  }

  const violations = getMinimumSalePriceViolations(
    items.map((item, itemIndex) => ({
      itemIndex,
      inventoryItemId: item.inventoryItemId ?? '',
      unitPrice: item.unitPrice,
    })),
    data.map((item) => ({
      id: item.id,
      name: item.name,
      minimumSalePrice: item.minimum_sale_price,
    })),
  )

  if (violations.length > 0) {
    const descriptions = violations.map(
      (violation) =>
        `${violation.productName}: mínimo ${formatCurrency(violation.minimumSalePrice)}`,
    )
    return {
      success: false,
      error: `O valor de venda está abaixo do mínimo cadastrado para: ${descriptions.join('; ')}.`,
    }
  }

  return { success: true, data: undefined }
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
          creator_name,
          created_at,
          updated_at,
          customers (
            name,
            phone,
            email,
            address,
            address_number
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
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<QuoteItemRow[]>()

      if (itemsError) {
        logger.error('Erro ao carregar itens do orçamento', itemsError)
        return { success: false, error: 'Não foi possível carregar os itens do orçamento.' }
      }

      const cust = Array.isArray(quote.customers) ? quote.customers[0] : quote.customers
      const customerAddress = [cust?.address, cust?.address_number].filter(Boolean).join(', ')

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
          creatorName: quote.creator_name,
          createdAt: quote.created_at,
          updatedAt: quote.updated_at,
          customerPhone: cust?.phone ?? null,
          customerEmail: cust?.email ?? null,
          customerAddress: customerAddress || null,
          items: (items ?? []).map((item) => ({
            id: item.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            total: item.total,
            sortOrder: item.sort_order,
            inventoryItemId: item.inventory_item_id,
            unit: item.unit,
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
      const minimumPriceValidation = await validateMinimumSalePrices(organizationId, params.items)
      if (!minimumPriceValidation.success) return minimumPriceValidation

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
        logger.error('Erro ao criar orçamento', quoteError, {
          code: quoteError?.code,
          message: quoteError?.message,
          details: quoteError?.details,
          hint: quoteError?.hint,
        })

        if (quoteError?.code === '42501') {
          return {
            success: false,
            error:
              'O banco de dados bloqueou a criação do orçamento. Aplique a migração 00028_fix_quote_creator_permissions.sql no Supabase e tente novamente.',
          }
        }

        if (quoteError?.code === '23503') {
          return {
            success: false,
            error:
              'O cliente selecionado não pertence à organização atual ou não está mais disponível. Selecione o cliente novamente.',
          }
        }

        if (quoteError?.code === '23505') {
          return {
            success: false,
            error: 'O número do orçamento já está em uso. Tente criar novamente.',
          }
        }

        return {
          success: false,
          error: quoteError?.message
            ? `Não foi possível criar o orçamento: ${quoteError.message}`
            : 'Não foi possível criar o orçamento.',
        }
      }

      // 4. Insere os itens vinculados à organização e ao orçamento
      if (calculated.items.length > 0) {
        const itemsToInsert = calculated.items.map((item, index) => ({
          organization_id: organizationId,
          quote_id: quote.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total: item.total,
          sort_order: item.sortOrder,
          inventory_item_id: params.items[index]?.inventoryItemId ?? null,
          unit: params.items[index]?.unit?.trim() || null,
        }))

        const { error: itemsError } = await supabase.from('quote_items').insert(itemsToInsert)

        if (itemsError) {
          logger.error('Erro ao inserir itens do orçamento', itemsError)
          // Tenta limpar o cabeçalho em caso de falha nos itens
          await supabase.from('quotes').delete().eq('id', quote.id)
          if (
            itemsError.code === '23514' &&
            itemsError.message.includes('QUOTE_ITEM_BELOW_MINIMUM_SALE_PRICE')
          ) {
            return {
              success: false,
              error: 'O preço de venda de um material está abaixo do mínimo cadastrado no estoque.',
            }
          }
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
   * Atualiza os dados e itens de um orçamento editável em uma única transação.
   */
  async updateQuote(
    organizationId: UUID,
    quoteId: UUID,
    params: UpdateQuoteParams,
  ): Promise<ServiceResult<void>> {
    try {
      const minimumPriceValidation = await validateMinimumSalePrices(organizationId, params.items)
      if (!minimumPriceValidation.success) return minimumPriceValidation

      const calculated = recalculateQuote(params.items, params.discount)
      const { error } = await supabase.rpc('update_quote_with_items', {
        p_organization_id: organizationId,
        p_quote_id: quoteId,
        p_customer_id: params.customerId,
        p_valid_until: params.validUntil,
        p_notes: params.notes,
        p_discount: calculated.discount,
        p_subtotal: calculated.subtotal,
        p_total: calculated.total,
        p_items: calculated.items.map((item, index) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total: item.total,
          sort_order: item.sortOrder,
          inventory_item_id: params.items[index]?.inventoryItemId ?? null,
          unit: params.items[index]?.unit?.trim() || null,
        })),
      })

      if (error) {
        logger.error('Erro ao editar orçamento', new Error(error.message), {
          code: error.code,
          details: error.details,
          hint: error.hint,
        })

        if (error.code === 'PGRST202' || error.code === '42883') {
          return {
            success: false,
            error:
              'A edição de orçamentos ainda não está habilitada no banco. Aplique as migrações 00024_edit_quotes.sql, 00027_owner_admin_edit_any_quote.sql e 00029_operational_members_edit_active_quotes.sql no Supabase, em ordem, e tente novamente.',
          }
        }

        if (error.code === '42501') {
          return {
            success: false,
            error:
              'Membros podem editar orçamentos em Rascunho, Enviado ou Aprovado. Orçamentos em outros status só podem ser editados por proprietários ou administradores.',
          }
        }
        if (error.code === 'P0001' && error.message.includes('INSUFFICIENT_STOCK')) {
          return {
            success: false,
            error:
              'O saldo disponível de um ou mais materiais não é suficiente para salvar este orçamento.',
          }
        }
        if (error.code === 'P0001' && error.message.includes('INVENTORY_UNIT_IN_USE')) {
          return {
            success: false,
            error:
              'A unidade de um material não pode ser alterada enquanto ele estiver em orçamentos.',
          }
        }
        if (
          error.code === '23514' &&
          error.message.includes('QUOTE_ITEM_BELOW_MINIMUM_SALE_PRICE')
        ) {
          return {
            success: false,
            error: 'O preço de venda de um material está abaixo do mínimo cadastrado no estoque.',
          }
        }

        return { success: false, error: 'Não foi possível salvar as alterações do orçamento.' }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao editar orçamento', err)
      return { success: false, error: 'Erro inesperado ao editar orçamento.' }
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
        logger.error('Erro ao atualizar status do orçamento', new Error(updateError.message), {
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint,
        })

        if (
          updateError.code === '22P02' &&
          updateError.message.includes('quote_status') &&
          newStatus === 'completed'
        ) {
          return {
            success: false,
            error:
              'O banco ainda não reconhece o status Concluído. Aplique a migração 00023_quote_completed_status.sql no Supabase e tente novamente.',
          }
        }

        if (updateError.code === '42501') {
          return {
            success: false,
            error: 'Você não tem permissão para alterar o status deste orçamento.',
          }
        }
        if (updateError.code === 'P0001' && updateError.message.includes('INSUFFICIENT_STOCK')) {
          return {
            success: false,
            error:
              'O saldo disponível de um ou mais materiais não é suficiente para aprovar este orçamento.',
          }
        }

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
