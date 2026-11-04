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
  customerPhone?: string | null
  quoteNumber: string
  status: QuoteStatus
  approvedBy?: 'client' | 'user' | string | null
  approvedAt?: string | null
  subtotal: string
  discount: string
  total: string
  validUntil: string | null
  createdAt: string
  updatedAt: string
  creatorName?: string | null
  sellerName?: string | null
  saleId?: string | null
  saleNumber?: string | null
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
  itemType?: 'product' | 'service'
  serviceId?: UUID | null
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
  item_type?: 'product' | 'service'
  service_id?: UUID | null
}

interface InventoryMinimumPriceRow {
  id: string
  name: string
  minimum_sale_price: string | null
  can_sell?: boolean | null
  attributes?: Record<string, unknown> | null
}

export interface QuoteItemInput extends QuoteItemCalculationInput {
  inventoryItemId?: UUID | null
  unit?: string | null
  itemType?: 'product' | 'service'
  serviceId?: UUID | null
}

export interface QuoteDetail extends QuoteListItem {
  notes: string | null
  creatorName: string | null
  sellerName?: string | null
  saleId?: string | null
  saleNumber?: string | null
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
    .select('id, name, minimum_sale_price, can_sell, attributes')
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

  const pendingItem = data.find(
    (item) => item.can_sell === false || item.attributes?.registration_status === 'awaiting_information',
  )
  if (pendingItem) {
    return {
      success: false,
      error: `O material "${pendingItem.name}" está com status "Aguardando informação" e não pode ser utilizado em orçamentos até que o cadastro esteja concluído no estoque.`,
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

async function validateServiceMinimumPrices(
  organizationId: UUID,
  items: QuoteItemInput[],
): Promise<ServiceResult<void>> {
  const serviceIds = [...new Set(items.map((i) => i.serviceId).filter(Boolean))] as string[]
  if (serviceIds.length === 0) return { success: true, data: undefined }

  const { data, error } = await supabase
    .from('services')
    .select('id, name, minimum_sale_price')
    .eq('organization_id', organizationId)
    .in('id', serviceIds)

  if (error || !data) return { success: true, data: undefined }

  for (const s of data) {
    const min = Number(s.minimum_sale_price) || 0
    if (min <= 0) continue

    const matchingItems = items.filter((i) => i.serviceId === s.id)
    for (const mi of matchingItems) {
      const price = Number(mi.unitPrice) || 0
      if (price < min) {
        return {
          success: false,
          error: `O preço do serviço "${s.name}" (${formatCurrency(price)}) está abaixo do preço mínimo cadastrado (${formatCurrency(min)}).`,
        }
      }
    }
  }

  return { success: true, data: undefined }
}

function isMissingTrackingColumnsError(
  err: { code?: string; message?: string; details?: string; hint?: string } | null | undefined,
): boolean {
  if (!err) return false
  const code = String(err.code || '')
  const msg = String(err.message || '').toLowerCase()
  const details = String(err.details || '').toLowerCase()
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    msg.includes('approved_by') ||
    msg.includes('approved_at') ||
    msg.includes('approved') ||
    msg.includes('schema cache') ||
    details.includes('approved')
  )
}

export const quoteService = {
  /**
   * Lista todos os orçamentos da organização (excluindo vendas VND).
   */
  async listQuotes(organizationId: UUID): Promise<ServiceResult<QuoteListItem[]>> {
    try {
      let { data, error } = await supabase
        .from('quotes')
        .select(
          `
          id,
          organization_id,
          customer_id,
          quote_number,
          status,
          approved_by,
          approved_at,
          subtotal,
          discount,
          total,
          valid_until,
          creator_name,
          seller_name,
          sale_id,
          created_at,
          updated_at,
          sale:sale_id (
            id,
            quote_number,
            seller_name,
            creator_name
          ),
          customers (
            name,
            phone
          )
        `,
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error && isMissingTrackingColumnsError(error)) {
        const fallback = await supabase
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
            creator_name,
            seller_name,
            sale_id,
            created_at,
            updated_at,
            sale:sale_id (
              id,
              quote_number,
              seller_name,
              creator_name
            ),
            customers (
              name,
              phone
            )
          `,
          )
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
        data = fallback.data as typeof data
        error = fallback.error
      }

      if (error) {
        logger.error('Erro ao listar orçamentos', error)
        return { success: false, error: 'Não foi possível carregar os orçamentos.' }
      }

      const list: QuoteListItem[] = (data ?? [])
        .filter((q) => !q.quote_number?.startsWith('VND-'))
        .map((q) => {
          const cust = Array.isArray(q.customers) ? q.customers[0] : q.customers
          const linkedSale = q.sale as unknown as {
            id: string
            quote_number: string
            seller_name: string | null
            creator_name: string | null
          } | null

          const rawQuote = q as unknown as {
            approved_by?: string | null
            approved_at?: string | null
          }

          return {
            id: q.id,
            organizationId: q.organization_id,
            customerId: q.customer_id,
            customerName: cust?.name ?? 'Cliente Desconhecido',
            customerPhone: cust?.phone ?? null,
            quoteNumber: q.quote_number,
            status: q.status as QuoteStatus,
            approvedBy: (rawQuote.approved_by as 'client' | 'user' | null) ?? null,
            approvedAt: rawQuote.approved_at ?? null,
            subtotal: q.subtotal,
            discount: q.discount,
            total: q.total,
            validUntil: q.valid_until,
            createdAt: q.created_at,
            updatedAt: q.updated_at,
            creatorName: q.creator_name || null,
            sellerName: q.seller_name || linkedSale?.seller_name || linkedSale?.creator_name || null,
            saleId: q.sale_id || linkedSale?.id || null,
            saleNumber: linkedSale?.quote_number || null,
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
      let { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select(
          `
          id,
          organization_id,
          customer_id,
          quote_number,
          status,
          approved_by,
          approved_at,
          subtotal,
          discount,
          total,
          valid_until,
          notes,
          creator_name,
          seller_name,
          sale_id,
          created_at,
          updated_at,
          sale:sale_id (
            id,
            quote_number,
            seller_name,
            creator_name
          ),
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

      if (quoteError && isMissingTrackingColumnsError(quoteError)) {
        const fallback = await supabase
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
            seller_name,
            sale_id,
            created_at,
            updated_at,
            sale:sale_id (
              id,
              quote_number,
              seller_name,
              creator_name
            ),
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
        quote = fallback.data as typeof quote
        quoteError = fallback.error
      }

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
      const linkedSale = quote.sale as unknown as {
        id: string
        quote_number: string
        seller_name: string | null
        creator_name: string | null
      } | null

      const rawQuote = quote as unknown as {
        approved_by?: string | null
        approved_at?: string | null
      }

      return {
        success: true,
        data: {
          id: quote.id,
          organizationId: quote.organization_id,
          customerId: quote.customer_id,
          customerName: cust?.name ?? '',
          quoteNumber: quote.quote_number,
          status: quote.status as QuoteStatus,
          approvedBy: (rawQuote.approved_by as 'client' | 'user' | null) ?? null,
          approvedAt: rawQuote.approved_at ?? null,
          subtotal: quote.subtotal,
          discount: quote.discount,
          total: quote.total,
          validUntil: quote.valid_until,
          notes: quote.notes,
          creatorName: quote.creator_name || null,
          sellerName: quote.seller_name || linkedSale?.seller_name || linkedSale?.creator_name || null,
          saleId: quote.sale_id || linkedSale?.id || null,
          saleNumber: linkedSale?.quote_number || null,
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
            itemType: (item.item_type as 'product' | 'service') || (item.service_id ? 'service' : 'product'),
            serviceId: item.service_id,
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

      const servicePriceValidation = await validateServiceMinimumPrices(organizationId, params.items)
      if (!servicePriceValidation.success) return servicePriceValidation

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
          item_type: params.items[index]?.itemType || (params.items[index]?.serviceId ? 'service' : 'product'),
          service_id: params.items[index]?.serviceId ?? null,
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

      // 3. Aplica alteração (registra aprovação pelo usuário se newStatus for 'approved')
      let updateError: { code?: string; message: string; details?: string; hint?: string } | null = null

      if (newStatus === 'approved') {
        const updatePayload: Record<string, unknown> = {
          status: newStatus,
          approved_by: 'user',
          approved_at: new Date().toISOString(),
        }

        const res = await supabase
          .from('quotes')
          .update(updatePayload)
          .eq('organization_id', organizationId)
          .eq('id', quoteId)

        updateError = res.error

        if (updateError && isMissingTrackingColumnsError(updateError)) {
          const fallback = await supabase
            .from('quotes')
            .update({ status: newStatus })
            .eq('organization_id', organizationId)
            .eq('id', quoteId)
          updateError = fallback.error
        }
      } else {
        const updatePayload: Record<string, unknown> = { status: newStatus }
        if (currentStatus === 'approved') {
          updatePayload.approved_by = null
          updatePayload.approved_at = null
        }

        const res = await supabase
          .from('quotes')
          .update(updatePayload)
          .eq('organization_id', organizationId)
          .eq('id', quoteId)

        updateError = res.error

        if (updateError && isMissingTrackingColumnsError(updateError)) {
          const fallback = await supabase
            .from('quotes')
            .update({ status: newStatus })
            .eq('organization_id', organizationId)
            .eq('id', quoteId)
          updateError = fallback.error
        }
      }

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
        if (
          updateError.code === 'P0001' &&
          updateError.message.includes('QUOTE_ITEM_BELOW_MINIMUM_SALE_PRICE')
        ) {
          return {
            success: false,
            error:
              'Não é possível aprovar ou alterar o orçamento pois há itens com preço de venda abaixo do mínimo permitido.',
          }
        }

        return {
          success: false,
          error: updateError.message || 'Não foi possível atualizar o status do orçamento.',
        }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao atualizar status', err)
      return { success: false, error: 'Erro inesperado ao atualizar status.' }
    }
  },

  /**
   * Exclui um orçamento e seus itens (via CASCADE e estorno seguro de lançamentos).
   */
  async deleteQuote(organizationId: UUID, quoteId: UUID): Promise<ServiceResult<void>> {
    try {
      // 1. Tenta exclusão segura via RPC delete_quote (trata pagamentos, lançamentos de caixa e estoque)
      const { error: rpcError } = await supabase.rpc('delete_quote', {
        p_organization_id: organizationId,
        p_quote_id: quoteId,
      })

      if (!rpcError) {
        return { success: true, data: undefined }
      }

      logger.warn('Falha na RPC delete_quote, tentando exclusão direta', {
        message: rpcError.message,
      })

      // 2. Fallback para exclusão direta na tabela quotes
      const { error: directError } = await supabase
        .from('quotes')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', quoteId)

      if (directError) {
        logger.error('Erro ao excluir orçamento', {
          rpcMessage: rpcError.message,
          directMessage: directError.message,
        })
        return { success: false, error: directError.message || 'Não foi possível excluir o orçamento.' }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao excluir orçamento', err)
      return { success: false, error: 'Erro inesperado ao excluir o orçamento.' }
    }
  },
}
