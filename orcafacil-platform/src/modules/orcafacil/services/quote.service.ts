import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import { recalculateQuote, type QuoteItemCalculationInput } from '../domain/quote-calculations'
import { isValidStatusTransition } from '../domain/quote-status'
import { getMinimumSalePriceViolations } from '../domain/minimum-sale-price'
import type { QuoteStatus } from '@shared/types/database'
import type { ServiceResult, UUID } from '@shared/types/common'
import { formatCurrency } from '@shared/utils/monetary'
import type { ServiceOrderStatus } from '@modules/service-orders/domain/service-order'
import {
  buildApprovedQuoteSnapshot,
  encodeOsInternalNotes,
  parseOsInternalNotes,
  type CommercialChangeEntry,
  type CommercialScopeSnapshot,
  type QuoteOsHistoryEntry,
} from '@modules/service-orders/domain/quote-os-integration'

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
  serviceOrderId?: string | null
  serviceOrderNumber?: string | null
  serviceOrderStatus?: ServiceOrderStatus | null
  version?: number
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
  serviceOrderId?: string | null
  serviceOrderNumber?: string | null
  serviceOrderStatus?: ServiceOrderStatus | null
  version?: number
  approvalHistory?: QuoteOsHistoryEntry[]
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

export interface SyncQuoteFromServiceOrderParams {
  serviceOrderId: UUID
  serviceOrderNumber: string
  discount: string
  items: QuoteItemInput[]
  changes: CommercialChangeEntry[]
  actorName?: string | null
}

interface LinkedOsSummary {
  id: string
  orderNumber: string
  status: ServiceOrderStatus
  quoteVersion: number
  history: QuoteOsHistoryEntry[]
}

function normalizeLinkedOsStatus(rawStatus: string, logicalStatus?: ServiceOrderStatus): ServiceOrderStatus {
  if (logicalStatus) return logicalStatus
  if (rawStatus === 'approved' || rawStatus === 'pending_approval') return rawStatus
  if (rawStatus === 'queue' || rawStatus === 'waiting_parts') return 'queue'
  if (rawStatus === 'in_maintenance' || rawStatus === 'closed') return rawStatus
  if (rawStatus === 'ready' || rawStatus === 'finalized') return 'ready'
  return 'pending'
}

async function fetchLinkedServiceOrdersByQuoteMap(
  organizationId: UUID,
): Promise<Map<string, LinkedOsSummary>> {
  const map = new Map<string, LinkedOsSummary>()
  try {
    let { data, error } = await supabase
      .from('service_orders')
      .select('id, order_number, status, internal_notes, quote_id, quote_version, status_history')
      .eq('organization_id', organizationId)

    if (error) {
      const fallback = await supabase
        .from('service_orders')
        .select('id, order_number, status, internal_notes')
        .eq('organization_id', organizationId)
      data = fallback.data as typeof data
    }

    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const { metadata } = parseOsInternalNotes(row.internal_notes as string | null)
      const qId = (row.quote_id as string | null) || metadata.quoteId || null
      if (!qId) continue

      const status = normalizeLinkedOsStatus(
        String(row.status || 'pending'),
        metadata.logicalStatus,
      )
      const version = Number(row.quote_version || metadata.quoteVersion || 1)
      const history = Array.isArray(row.status_history)
        ? (row.status_history as QuoteOsHistoryEntry[])
        : metadata.statusHistory || []

      map.set(qId, {
        id: String(row.id),
        orderNumber: String(row.order_number),
        status,
        quoteVersion: version,
        history,
      })
    }
  } catch {
    // Ignora falha silenciosa de lookup secundário
  }
  return map
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
    msg.includes('service_order') ||
    msg.includes('version') ||
    msg.includes('approval_history') ||
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
          service_order_id,
          service_order_number,
          version,
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

        if (fallback.error && isMissingTrackingColumnsError(fallback.error)) {
          const minimalFallback = await supabase
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
          data = minimalFallback.data as typeof data
          error = minimalFallback.error
        } else {
          data = fallback.data as typeof data
          error = fallback.error
        }
      }

      if (error) {
        logger.error('Erro ao listar orçamentos', error)
        return { success: false, error: 'Não foi possível carregar os orçamentos.' }
      }

      const linkedOsMap = await fetchLinkedServiceOrdersByQuoteMap(organizationId)

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
            service_order_id?: string | null
            service_order_number?: string | null
            version?: number | null
          }

          const linkedOs = linkedOsMap.get(q.id)

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
            serviceOrderId: rawQuote.service_order_id || linkedOs?.id || null,
            serviceOrderNumber: rawQuote.service_order_number || linkedOs?.orderNumber || null,
            serviceOrderStatus: linkedOs?.status ?? null,
            version: Number(rawQuote.version || linkedOs?.quoteVersion || 1),
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
          service_order_id,
          service_order_number,
          version,
          approval_history,
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

        if (fallback.error && isMissingTrackingColumnsError(fallback.error)) {
          const minimalFallback = await supabase
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
          quote = minimalFallback.data as typeof quote
          quoteError = minimalFallback.error
        } else {
          quote = fallback.data as typeof quote
          quoteError = fallback.error
        }
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
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<QuoteItemRow[]>()

      if (itemsError) {
        logger.error('Erro ao carregar itens do orçamento', itemsError)
        return { success: false, error: 'Não foi possível carregar os itens do orçamento.' }
      }

      const linkedOsMap = await fetchLinkedServiceOrdersByQuoteMap(organizationId)
      const linkedOs = linkedOsMap.get(quoteId)

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
        service_order_id?: string | null
        service_order_number?: string | null
        version?: number | null
        approval_history?: unknown
      }

      const approvalHistory = Array.isArray(rawQuote.approval_history)
        ? (rawQuote.approval_history as QuoteOsHistoryEntry[])
        : linkedOs?.history || []

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
          serviceOrderId: rawQuote.service_order_id || linkedOs?.id || null,
          serviceOrderNumber: rawQuote.service_order_number || linkedOs?.orderNumber || null,
          serviceOrderStatus: linkedOs?.status ?? null,
          version: Number(rawQuote.version || linkedOs?.quoteVersion || 1),
          approvalHistory,
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

      const servicePriceValidation = await validateServiceMinimumPrices(organizationId, params.items)
      if (!servicePriceValidation.success) return servicePriceValidation

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
          item_type: params.items[index]?.itemType || (params.items[index]?.serviceId ? 'service' : 'product'),
          service_id: params.items[index]?.serviceId ?? null,
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

      // Garante que item_type e service_id estejam preenchidos mesmo caso a RPC no banco seja a versão anterior à 00119
      for (let index = 0; index < calculated.items.length; index++) {
        const inputItem = params.items[index]
        if (inputItem?.itemType === 'service' || inputItem?.serviceId) {
          await supabase
            .from('quote_items')
            .update({
              item_type: 'service',
              service_id: inputItem.serviceId ?? null,
            })
            .eq('organization_id', organizationId)
            .eq('quote_id', quoteId)
            .eq('sort_order', calculated.items[index].sortOrder)
        }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao editar orçamento', err)
      return { success: false, error: 'Erro inesperado ao editar orçamento.' }
    }
  },

  /**
   * Fluxo 2: Incorpora alterações comerciais (novos materiais/serviços, quantidades, valores ou descontos)
   * originadas na Ordem de Serviço ao orçamento vinculado, retornando o orçamento para o status 'sent' (ENVIADO)
   * e preservando o histórico da aprovação anterior.
   */
  async syncCommercialChangesFromServiceOrder(
    organizationId: UUID,
    quoteId: UUID,
    params: SyncQuoteFromServiceOrderParams,
  ): Promise<
    ServiceResult<{
      newVersion: number
      subtotal: string
      discount: string
      total: string
      historyEntry: QuoteOsHistoryEntry
    }>
  > {
    try {
      const minimumPriceValidation = await validateMinimumSalePrices(organizationId, params.items)
      if (!minimumPriceValidation.success) return minimumPriceValidation

      const servicePriceValidation = await validateServiceMinimumPrices(organizationId, params.items)
      if (!servicePriceValidation.success) return servicePriceValidation

      const quoteRes = await this.getQuote(organizationId, quoteId)
      if (!quoteRes.success) {
        return { success: false, error: quoteRes.error }
      }

      const currentQuote = quoteRes.data
      const calculated = recalculateQuote(params.items, params.discount || '0.00')
      const nextVersion = (currentQuote.version || 1) + 1
      const nowIso = new Date().toISOString()

      const historyEntry: QuoteOsHistoryEntry = {
        id: crypto.randomUUID(),
        timestamp: nowIso,
        eventType: 'commercial_change_detected',
        quoteVersion: nextVersion,
        previousQuoteStatus: currentQuote.status,
        newQuoteStatus: 'sent',
        previousOsStatus: currentQuote.serviceOrderStatus ?? 'approved',
        newOsStatus: 'pending_approval',
        previousTotal: currentQuote.total,
        newTotal: calculated.total,
        actorName: params.actorName || 'Técnico / Operador',
        description: `Alteração comercial na O.S. #${params.serviceOrderNumber}: orçamento atualizado para v${String(nextVersion)} e retornado para ENVIADO aguardando nova aprovação do cliente.`,
        changes: params.changes,
      }

      const updatedHistory = [...(currentQuote.approvalHistory || []), historyEntry]

      // 1. Remove os quote_items antigos enquanto o status atual é 'approved' (devolve reserva anterior ao estoque se aplicável)
      const { error: deleteItemsError } = await supabase
        .from('quote_items')
        .delete()
        .eq('organization_id', organizationId)
        .eq('quote_id', quoteId)

      if (deleteItemsError) {
        logger.error('Erro ao limpar itens do orçamento para sincronização com O.S.', deleteItemsError)
        return {
          success: false,
          error: 'Não foi possível atualizar os itens do orçamento vinculado.',
        }
      }

      // 2. Atualiza cabeçalho do orçamento retornando status para 'sent' (ENVIADO)
      const fullUpdatePayload: Record<string, unknown> = {
        status: 'sent',
        approved_by: null,
        approved_at: null,
        subtotal: calculated.subtotal,
        discount: calculated.discount,
        total: calculated.total,
        service_order_id: params.serviceOrderId,
        service_order_number: params.serviceOrderNumber,
        version: nextVersion,
        approval_history: updatedHistory,
        updated_at: nowIso,
      }

      let { error: updateQuoteError } = await supabase
        .from('quotes')
        .update(fullUpdatePayload)
        .eq('organization_id', organizationId)
        .eq('id', quoteId)

      if (updateQuoteError && isMissingTrackingColumnsError(updateQuoteError)) {
        const fallbackUpdate = await supabase
          .from('quotes')
          .update({
            status: 'sent',
            subtotal: calculated.subtotal,
            discount: calculated.discount,
            total: calculated.total,
            updated_at: nowIso,
          })
          .eq('organization_id', organizationId)
          .eq('id', quoteId)
        updateQuoteError = fallbackUpdate.error
      }

      if (updateQuoteError) {
        logger.error('Erro ao retornar orçamento para ENVIADO após alteração na O.S.', updateQuoteError)
        return {
          success: false,
          error: 'Não foi possível atualizar o status do orçamento para Enviado.',
        }
      }

      // 3. Insere os novos itens consolidados da O.S. no orçamento (status 'sent')
      if (calculated.items.length > 0) {
        const itemsToInsert = calculated.items.map((item, index) => ({
          organization_id: organizationId,
          quote_id: quoteId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total: item.total,
          sort_order: item.sortOrder,
          inventory_item_id:
            params.items[index]?.itemType === 'service'
              ? null
              : (params.items[index]?.inventoryItemId ?? null),
          unit: params.items[index]?.unit?.trim() || 'UN',
          item_type:
            params.items[index]?.itemType ||
            (params.items[index]?.serviceId ? 'service' : 'product'),
          service_id:
            params.items[index]?.itemType === 'service'
              ? (params.items[index]?.serviceId ?? null)
              : null,
        }))

        const { error: insertItemsError } = await supabase.from('quote_items').insert(itemsToInsert)
        if (insertItemsError) {
          logger.error('Erro ao inserir novos itens do orçamento sincronizado com O.S.', insertItemsError)
          return {
            success: false,
            error: 'Não foi possível registrar os novos materiais/serviços no orçamento.',
          }
        }
      }

      // 4. Registra na tabela de histórico se existir
      await supabase
        .from('quote_service_order_history' as any)
        .insert({
          organization_id: organizationId,
          quote_id: quoteId,
          service_order_id: params.serviceOrderId,
          event_type: 'commercial_change_detected',
          quote_version: nextVersion,
          previous_quote_status: currentQuote.status,
          new_quote_status: 'sent',
          previous_os_status: currentQuote.serviceOrderStatus ?? 'approved',
          new_os_status: 'pending_approval',
          previous_total: currentQuote.total,
          new_total: calculated.total,
          description: historyEntry.description,
          changes_summary: params.changes,
          actor_name: params.actorName || 'Técnico / Operador',
        })
        .then(() => {})

      return {
        success: true,
        data: {
          newVersion: nextVersion,
          subtotal: calculated.subtotal,
          discount: calculated.discount,
          total: calculated.total,
          historyEntry,
        },
      }
    } catch (err) {
      logger.error('Exceção ao sincronizar alterações comerciais da O.S. com o orçamento', err)
      return {
        success: false,
        error: 'Erro inesperado ao atualizar o orçamento com as alterações da O.S.',
      }
    }
  },

  /**
   * Altera o status do orçamento com validação estrita da máquina de estados.
   * Fluxo 3: Quando um orçamento vinculado a uma O.S. é aprovado novamente,
   * identifica automaticamente a O.S. vinculada e atualiza seu status para APROVADA.
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
        .select('status, quote_number, subtotal, discount, total')
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
      const nowIso = new Date().toISOString()
      let updateError: { code?: string; message: string; details?: string; hint?: string } | null = null

      if (newStatus === 'approved') {
        const updatePayload: Record<string, unknown> = {
          status: newStatus,
          approved_by: 'user',
          approved_at: nowIso,
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

      // 4. Fluxo 3: Se o orçamento possui O.S. vinculada, reflete a nova aprovação (ou recusa) automaticamente na O.S.!
      if (newStatus === 'approved' || newStatus === 'rejected') {
        await this.reflectQuoteDecisionOnLinkedServiceOrder(
          organizationId,
          quoteId,
          newStatus,
          'user',
        )
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao atualizar status', err)
      return { success: false, error: 'Erro inesperado ao atualizar status.' }
    }
  },

  /**
   * Fluxo 3: Identifica automaticamente a O.S. vinculada ao orçamento e,
   * quando o orçamento é aprovado, atualiza o status da O.S. para APROVADA e atualiza o snapshot aprovado.
   * Caso o orçamento seja recusado, mantém a O.S. bloqueada em PENDENTE DE APROVAÇÃO registrando o evento.
   */
  async reflectQuoteDecisionOnLinkedServiceOrder(
    organizationId: UUID,
    quoteId: UUID,
    decision: 'approved' | 'rejected',
    approvedBy: 'client' | 'user' = 'user',
  ): Promise<void> {
    try {
      const quoteDetailRes = await this.getQuote(organizationId, quoteId)
      if (!quoteDetailRes.success) return

      const quote = quoteDetailRes.data
      const linkedOsId = quote.serviceOrderId
      if (!linkedOsId) return

      const { data: osRow } = await supabase
        .from('service_orders')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('id', linkedOsId)
        .maybeSingle()

      if (!osRow) return

      const rawOs = osRow as Record<string, unknown>
      const { metadata, cleanNotes } = parseOsInternalNotes(rawOs.internal_notes as string | null)
      const currentOsStatus = normalizeLinkedOsStatus(
        String(rawOs.status || 'pending'),
        metadata.logicalStatus,
      )

      const nowIso = new Date().toISOString()
      const currentVersion = quote.version || metadata.quoteVersion || 1
      const existingHistory: QuoteOsHistoryEntry[] = Array.isArray(rawOs.status_history)
        ? (rawOs.status_history as QuoteOsHistoryEntry[])
        : metadata.statusHistory || []

      if (decision === 'approved') {
        // Somente reativa para 'approved' se a O.S. estava bloqueada aguardando aprovação
        if (
          currentOsStatus !== 'pending_approval' &&
          currentOsStatus !== 'pending' &&
          currentOsStatus !== 'queue'
        ) {
          return
        }

        const newSnapshot: CommercialScopeSnapshot = buildApprovedQuoteSnapshot({
          version: currentVersion,
          subtotal: quote.subtotal,
          discount: quote.discount,
          total: quote.total,
          approvedBy,
          approvedAt: nowIso,
          items: quote.items.map((it) => ({
            id: it.id,
            itemType: it.itemType || (it.serviceId ? 'service' : 'product'),
            inventoryItemId: it.inventoryItemId,
            serviceId: it.serviceId,
            description: it.description,
            unit: it.unit || 'UN',
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            total: it.total,
          })),
        })

        const reapprovalEntry: QuoteOsHistoryEntry = {
          id: crypto.randomUUID(),
          timestamp: nowIso,
          eventType: 'quote_reapproved',
          quoteVersion: currentVersion,
          previousQuoteStatus: 'sent',
          newQuoteStatus: 'approved',
          previousOsStatus: currentOsStatus,
          newOsStatus: 'approved',
          newTotal: quote.total,
          actorName: approvedBy === 'client' ? 'Cliente (Portal)' : 'Operador / Usuário',
          description: `Orçamento #${quote.quoteNumber} (v${String(currentVersion)}) aprovado (${formatCurrency(quote.total)}). O.S. #${String(rawOs.order_number)} atualizada para APROVADA e liberada para execução/finalização.`,
        }

        const updatedHistory = [...existingHistory, reapprovalEntry]
        const updatedNotes = encodeOsInternalNotes(
          {
            ...metadata,
            quoteId: quote.id,
            quoteNumber: quote.quoteNumber,
            quoteVersion: currentVersion,
            logicalStatus: 'approved',
            approvedQuoteSnapshot: newSnapshot,
            statusHistory: updatedHistory,
          },
          cleanNotes,
        )

        const { error: osUpdateErr } = await supabase
          .from('service_orders')
          .update({
            status: 'approved',
            quote_id: quote.id,
            quote_number: quote.quoteNumber,
            quote_version: currentVersion,
            approved_quote_snapshot: newSnapshot,
            status_history: updatedHistory,
            internal_notes: updatedNotes,
            updated_at: nowIso,
          })
          .eq('organization_id', organizationId)
          .eq('id', linkedOsId)

        if (osUpdateErr) {
          await supabase
            .from('service_orders')
            .update({
              status: 'in_maintenance',
              internal_notes: updatedNotes,
              updated_at: nowIso,
            })
            .eq('organization_id', organizationId)
            .eq('id', linkedOsId)
        }

        await supabase
          .from('quote_service_order_history' as any)
          .insert({
            organization_id: organizationId,
            quote_id: quote.id,
            service_order_id: linkedOsId,
            event_type: 'quote_reapproved',
            quote_version: currentVersion,
            previous_quote_status: 'sent',
            new_quote_status: 'approved',
            previous_os_status: currentOsStatus,
            new_os_status: 'approved',
            new_total: quote.total,
            description: reapprovalEntry.description,
            actor_name: reapprovalEntry.actorName,
          })
          .then(() => {})
      } else if (decision === 'rejected') {
        const rejectionEntry: QuoteOsHistoryEntry = {
          id: crypto.randomUUID(),
          timestamp: nowIso,
          eventType: 'quote_rejected',
          quoteVersion: currentVersion,
          previousQuoteStatus: 'sent',
          newQuoteStatus: 'rejected',
          previousOsStatus: currentOsStatus,
          newOsStatus: 'pending_approval',
          newTotal: quote.total,
          actorName: approvedBy === 'client' ? 'Cliente (Portal)' : 'Operador / Usuário',
          description: `Alteração comercial do Orçamento #${quote.quoteNumber} (v${String(currentVersion)}) não foi aprovada pelo cliente. A O.S. permanece bloqueada para finalização.`,
        }

        const updatedHistory = [...existingHistory, rejectionEntry]
        const updatedNotes = encodeOsInternalNotes(
          {
            ...metadata,
            quoteId: quote.id,
            quoteNumber: quote.quoteNumber,
            quoteVersion: currentVersion,
            logicalStatus: 'pending_approval',
            statusHistory: updatedHistory,
          },
          cleanNotes || 'Orçamento recusado pelo cliente — O.S. bloqueada aguardando decisão.',
        )

        const { error: osRejectErr } = await supabase
          .from('service_orders')
          .update({
            status: 'pending_approval',
            status_history: updatedHistory,
            internal_notes: updatedNotes,
            updated_at: nowIso,
          })
          .eq('organization_id', organizationId)
          .eq('id', linkedOsId)

        if (osRejectErr) {
          await supabase
            .from('service_orders')
            .update({
              status: 'pending',
              internal_notes: updatedNotes,
              updated_at: nowIso,
            })
            .eq('organization_id', organizationId)
            .eq('id', linkedOsId)
        }
      }
    } catch (err) {
      logger.warn('Aviso ao refletir decisão do orçamento na O.S. vinculada', { error: err })
    }
  },

  /**
   * Restaura um orçamento recusado/expirado para Rascunho ('draft') registrando o motivo nas observações.
   */
  async restoreQuote(
    organizationId: UUID,
    quoteId: UUID,
    reason: string,
  ): Promise<ServiceResult<void>> {
    try {
      const trimmedReason = reason.trim()
      if (!trimmedReason) {
        return { success: false, error: 'Informe o motivo para restaurar o orçamento.' }
      }

      const { data: current, error: fetchError } = await supabase
        .from('quotes')
        .select('status, notes')
        .eq('organization_id', organizationId)
        .eq('id', quoteId)
        .single()

      if (fetchError || !current) {
        return { success: false, error: 'Orçamento não encontrado.' }
      }

      const currentStatus = current.status as QuoteStatus
      if (!isValidStatusTransition(currentStatus, 'draft')) {
        return {
          success: false,
          error: `Transição de status inválida de "${currentStatus}" para "draft".`,
        }
      }

      const dateStr = new Date().toLocaleDateString('pt-BR')
      const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const reasonLine = `[Restaurado em ${dateStr} às ${timeStr}] Motivo: ${trimmedReason}`
      const existingNotes = (current.notes as string | null)?.trim() || ''
      const updatedNotes = existingNotes ? `${existingNotes}\n${reasonLine}` : reasonLine

      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          status: 'draft',
          notes: updatedNotes,
        })
        .eq('organization_id', organizationId)
        .eq('id', quoteId)

      if (updateError) {
        logger.error('Erro ao restaurar orçamento', new Error(updateError.message), {
          code: updateError.code,
          details: updateError.details,
        })
        return {
          success: false,
          error: updateError.message || 'Não foi possível restaurar o orçamento.',
        }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao restaurar orçamento', err)
      return { success: false, error: 'Erro inesperado ao restaurar o orçamento.' }
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
