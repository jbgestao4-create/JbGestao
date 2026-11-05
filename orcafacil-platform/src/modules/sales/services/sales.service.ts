import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UUID } from '@shared/types/common'
import type { QuoteStatus } from '@shared/types/database'
import { cashService } from '@modules/cash/services/cash.service'
import { cashSessionService } from '@modules/cash/services/cash-session.service'
import {
  calculateItemTotal,
  calculateSubtotal,
  calculateTotal,
} from '@shared/utils/monetary'

export type PaymentMethod =
  | 'money'
  | 'pix'
  | 'credit_card'
  | 'debit_card'
  | 'on_credit'
  | 'other'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  money: 'Dinheiro',
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  on_credit: 'A Prazo / Crediário',
  other: 'Outro',
}

export interface FiscalInvoiceData {
  type: 'nfce' | 'nfe'
  number: string
  series: string
  accessKey: string
  protocol: string
  emittedAt: string
  qrCodeUrl: string
  status: 'authorized' | 'contingency'
  cfop: string
  taxEnvironment: 'homologacao' | 'producao'
}

export interface SaleMetadata {
  isSale?: boolean
  isPdv?: boolean
  paymentMethod?: PaymentMethod
  fiscalInvoice?: FiscalInvoiceData
  customerDocument?: string
  customerName?: string
  userNotes?: string
  sessionId?: string
  amountReceived?: string
  changeAmount?: string
  operatorId?: string
  operatorName?: string
  sellerName?: string
  originQuoteId?: string
  originQuoteNumber?: string
  originQuoteCreatorName?: string
  originServiceOrderId?: string
  originServiceOrderNumber?: string
}

export interface SaleItemInput {
  inventoryItemId?: string | null
  serviceId?: string | null
  itemType?: 'product' | 'service'
  description: string
  unit: string
  quantity: string
  unitPrice: string
}

export interface CreateSaleParams {
  customerId?: string | null
  customerName?: string
  customerDocument?: string
  items: SaleItemInput[]
  discount?: string
  paymentMethod: PaymentMethod
  notes?: string
  isPdv?: boolean
  emitFiscalNow?: boolean
  fiscalType?: 'nfce' | 'nfe'
  sessionId?: string
  amountReceived?: string
  changeAmount?: string
  operatorId?: string
  operatorName?: string
  sellerName?: string
  originQuoteId?: string
  originQuoteNumber?: string
  originQuoteCreatorName?: string
  originServiceOrderId?: string
  originServiceOrderNumber?: string
}

export interface SaleListItem {
  id: UUID
  saleNumber: string
  customerId: UUID
  customerName: string
  customerDocument: string | null
  total: string
  subtotal: string
  discount: string
  status: QuoteStatus
  createdAt: string
  paymentMethod: PaymentMethod
  itemsCount: number
  isPdv: boolean
  hasFiscalInvoice: boolean
  fiscalInvoice?: FiscalInvoiceData
  creatorName?: string | null
  sellerName?: string | null
  sessionId?: string | null
  originQuoteId?: string | null
  originQuoteNumber?: string | null
  originQuoteCreatorName?: string | null
  originServiceOrderId?: string | null
  originServiceOrderNumber?: string | null
}

export interface SaleItemDetail {
  id: UUID
  inventoryItemId: string | null
  serviceId?: string | null
  itemType?: 'product' | 'service'
  description: string
  unit: string
  quantity: string
  unitPrice: string
  total: string
  sku?: string
}

export interface SaleDetail {
  id: UUID
  saleNumber: string
  organizationId: UUID
  customerId: UUID
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  customerDocument: string | null
  customerAddress: string | null
  creatorName: string | null
  sellerName?: string | null
  operatorName?: string | null
  originQuoteId?: string | null
  originQuoteNumber?: string | null
  originQuoteCreatorName?: string | null
  status: QuoteStatus
  subtotal: string
  discount: string
  total: string
  productsSubtotal?: string
  servicesSubtotal?: string
  paymentMethod: PaymentMethod
  notes: string | null
  createdAt: string
  updatedAt: string
  isPdv: boolean
  items: SaleItemDetail[]
  fiscalInvoice?: FiscalInvoiceData
}

/**
 * Gera uma Chave de Acesso simulada e válida estruturalmente para NF-e/NFC-e (44 dígitos)
 */
export function generateFiscalAccessKey(uf = '35', model = '65', cnpj = '00000000000191'): string {
  const now = new Date()
  const aamm = `${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`
  const cleanDoc = cnpj.replace(/\D/g, '').padStart(14, '0').slice(-14)
  const series = '001'
  const number = String(Math.floor(100000000 + Math.random() * 900000000))
  const emissionType = '1'
  const randomCode = String(Math.floor(10000000 + Math.random() * 90000000))

  const base43 = `${uf}${aamm}${cleanDoc}${model}${series}${number}${emissionType}${randomCode}`
  // Dígito verificador ponderado módulo 11
  let sum = 0
  let weight = 2
  for (let i = base43.length - 1; i >= 0; i--) {
    sum += Number(base43[i]) * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  const remainder = sum % 11
  const dv = remainder === 0 || remainder === 1 ? 0 : 11 - remainder

  return `${base43}${dv}`
}

export function parseSaleNotes(rawNotes: string | null | undefined): {
  metadata: SaleMetadata
  cleanNotes: string
} {
  if (!rawNotes) {
    return { metadata: {}, cleanNotes: '' }
  }
  try {
    if (rawNotes.startsWith('__SALES_META__')) {
      const parts = rawNotes.split('__SALES_META__')
      const meta = JSON.parse(parts[1]) as SaleMetadata
      return { metadata: meta, cleanNotes: parts[2] || '' }
    }
  } catch {
    // fallback if parse fails
  }
  return { metadata: {}, cleanNotes: rawNotes }
}

export function encodeSaleNotes(metadata: SaleMetadata, userNotes?: string): string {
  return `__SALES_META__${JSON.stringify(metadata)}__SALES_META__${userNotes || ''}`
}

export const salesService = {
  /**
   * Lista todas as vendas da organização (excluindo orçamentos puros)
   */
  async listSales(organizationId: UUID): Promise<ServiceResult<SaleListItem[]>> {
    try {
      const { data: quotes, error } = await supabase
        .from('quotes')
        .select(`
          id,
          quote_number,
          customer_id,
          creator_name,
          seller_name,
          origin_quote_id,
          sale_id,
          total,
          subtotal,
          discount,
          status,
          notes,
          created_at,
          origin_quote:origin_quote_id (
            id,
            quote_number,
            creator_name
          ),
          customers (
            id,
            name,
            document
          ),
          quote_items (
            id
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Erro ao listar vendas', error)
        return { success: false, error: 'Não foi possível carregar as vendas da organização.' }
      }

      const list: SaleListItem[] = (quotes || [])
        .filter((q) => {
          const { metadata } = parseSaleNotes(q.notes)
          // Exclui orçamentos gerados (ORC-...) que não sejam vendas
          return q.quote_number?.startsWith('VND-') || metadata.isSale === true
        })
        .map((q) => {
          const { metadata } = parseSaleNotes(q.notes)
          const isVnd = q.quote_number.startsWith('VND-') || metadata.isSale
          const customer = q.customers as unknown as { id: string; name: string; document: string | null } | null
          const origin = q.origin_quote as unknown as { id: string; quote_number: string; creator_name: string | null } | null

          return {
            id: q.id,
            saleNumber: q.quote_number,
            customerId: q.customer_id,
            customerName: metadata.customerName || customer?.name || 'Consumidor Final',
            customerDocument: metadata.customerDocument || customer?.document || null,
            total: q.total,
            subtotal: q.subtotal,
            discount: q.discount,
            status: q.status as QuoteStatus,
            createdAt: q.created_at,
            paymentMethod: metadata.paymentMethod || 'money',
            itemsCount: q.quote_items?.length || 0,
            isPdv: metadata.isPdv ?? isVnd,
            hasFiscalInvoice: Boolean(metadata.fiscalInvoice),
            fiscalInvoice: metadata.fiscalInvoice,
            creatorName: q.creator_name || null,
            sellerName: q.seller_name || metadata.sellerName || metadata.operatorName || q.creator_name || null,
            sessionId: metadata.sessionId || null,
            originQuoteId: q.origin_quote_id || metadata.originQuoteId || origin?.id || null,
            originQuoteNumber: origin?.quote_number || metadata.originQuoteNumber || null,
            originQuoteCreatorName: origin?.creator_name || metadata.originQuoteCreatorName || null,
            originServiceOrderId: metadata.originServiceOrderId || null,
            originServiceOrderNumber: metadata.originServiceOrderNumber || null,
          }
        })

      return { success: true, data: list }
    } catch (err) {
      logger.error('Exceção ao listar vendas', err)
      return { success: false, error: 'Erro inesperado ao buscar vendas.' }
    }
  },

  /**
   * Obtém detalhes completos de uma venda
   */
  async getSaleById(organizationId: UUID, saleId: UUID): Promise<ServiceResult<SaleDetail>> {
    try {
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select(`
          id,
          quote_number,
          organization_id,
          customer_id,
          creator_name,
          seller_name,
          origin_quote_id,
          sale_id,
          status,
          subtotal,
          discount,
          total,
          notes,
          created_at,
          updated_at,
          origin_quote:origin_quote_id (
            id,
            quote_number,
            creator_name
          ),
          customers (
            id,
            name,
            email,
            phone,
            document,
            address,
            address_number,
            postal_code
          )
        `)
        .eq('organization_id', organizationId)
        .eq('id', saleId)
        .single()

      if (quoteError || !quote) {
        return { success: false, error: 'Venda não localizada.' }
      }

      const { data: items, error: itemsError } = await supabase
        .from('quote_items')
        .select(`
          id,
          inventory_item_id,
          service_id,
          item_type,
          description,
          unit,
          quantity,
          unit_price,
          total,
          sort_order
        `)
        .eq('organization_id', organizationId)
        .eq('quote_id', saleId)
        .order('sort_order', { ascending: true })

      if (itemsError) {
        return { success: false, error: 'Não foi possível carregar os itens da venda.' }
      }

      const { metadata, cleanNotes } = parseSaleNotes(quote.notes)
      const customer = quote.customers as unknown as {
        id: string
        name: string
        email: string | null
        phone: string | null
        document: string | null
        address: string | null
        address_number: string | null
        postal_code: string | null
      } | null

      const origin = quote.origin_quote as unknown as {
        id: string
        quote_number: string
        creator_name: string | null
      } | null

      const fullAddress = [
        customer?.address,
        customer?.address_number ? `nº ${customer.address_number}` : '',
        customer?.postal_code ? `CEP ${customer.postal_code}` : '',
      ]
        .filter(Boolean)
        .join(', ')

      const mappedItems: SaleItemDetail[] = (items || []).map((it) => ({
        id: it.id,
        inventoryItemId: it.inventory_item_id,
        serviceId: it.service_id,
        itemType: (it.item_type as 'product' | 'service') || (it.service_id ? 'service' : 'product'),
        description: it.description,
        unit: it.unit || 'UN',
        quantity: it.quantity,
        unitPrice: it.unit_price,
        total: it.total,
      }))

      const productsSubtotal = mappedItems
        .filter((it) => it.itemType !== 'service')
        .reduce((acc, it) => acc + Number(it.total || 0), 0)
        .toFixed(2)

      const servicesSubtotal = mappedItems
        .filter((it) => it.itemType === 'service')
        .reduce((acc, it) => acc + Number(it.total || 0), 0)
        .toFixed(2)

      return {
        success: true,
        data: {
          id: quote.id,
          saleNumber: quote.quote_number,
          organizationId: quote.organization_id,
          customerId: quote.customer_id,
          customerName: metadata.customerName || customer?.name || 'Consumidor Final',
          customerEmail: customer?.email || null,
          customerPhone: customer?.phone || null,
          customerDocument: metadata.customerDocument || customer?.document || null,
          customerAddress: fullAddress || null,
          creatorName: quote.creator_name || null,
          sellerName: quote.seller_name || metadata.sellerName || metadata.operatorName || quote.creator_name || null,
          operatorName: metadata.operatorName || quote.seller_name || quote.creator_name || null,
          originQuoteId: quote.origin_quote_id || metadata.originQuoteId || origin?.id || null,
          originQuoteNumber: origin?.quote_number || metadata.originQuoteNumber || null,
          originQuoteCreatorName: origin?.creator_name || metadata.originQuoteCreatorName || null,
          status: quote.status as QuoteStatus,
          subtotal: quote.subtotal,
          discount: quote.discount,
          total: quote.total,
          productsSubtotal,
          servicesSubtotal,
          paymentMethod: metadata.paymentMethod || 'money',
          notes: cleanNotes || null,
          createdAt: quote.created_at,
          updatedAt: quote.updated_at,
          isPdv: metadata.isPdv ?? quote.quote_number.startsWith('VND-'),
          fiscalInvoice: metadata.fiscalInvoice,
          items: mappedItems,
        },
      }
    } catch (err) {
      logger.error('Exceção ao buscar detalhes da venda', err)
      return { success: false, error: 'Erro inesperado ao consultar a venda.' }
    }
  },

  /**
   * Cria e finaliza uma nova venda / pedido de venda no sistema
   */
  async createSale(
    organizationId: UUID,
    params: CreateSaleParams,
  ): Promise<ServiceResult<{ saleId: UUID; saleNumber: string; fiscalInvoice?: FiscalInvoiceData }>> {
    try {
      if (!params.items || params.items.length === 0) {
        return { success: false, error: 'Adicione pelo menos um item à venda.' }
      }

      // Validação de quantidade dos itens
      for (const item of params.items) {
        const qty = Number(item.quantity)
        if (!Number.isFinite(qty) || qty <= 0) {
          return { success: false, error: `Quantidade inválida para o item "${item.description}".` }
        }
        const price = Number(item.unitPrice)
        if (!Number.isFinite(price) || price < 0) {
          return { success: false, error: `Valor unitário inválido para o item "${item.description}".` }
        }
      }

      // Se nenhum cliente foi fornecido, localiza ou usa o primeiro cliente da organização como fallback
      let finalCustomerId = params.customerId
      if (!finalCustomerId) {
        const { data: firstCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('organization_id', organizationId)
          .limit(1)
          .maybeSingle()

        if (firstCustomer) {
          finalCustomerId = firstCustomer.id
        } else {
          // Cria o cliente "Consumidor Final" automaticamente se a empresa não tiver nenhum
          const { data: createdCustomer, error: createCustErr } = await supabase
            .from('customers')
            .insert({
              organization_id: organizationId,
              name: 'Consumidor Final',
              person_type: 'individual',
            })
            .select('id')
            .single()

          if (createCustErr || !createdCustomer) {
            return {
              success: false,
              error: 'Cadastre pelo menos um cliente para emitir vendas ou selecione um cliente existente.',
            }
          }
          finalCustomerId = createdCustomer.id
        }
      }

      // Recalcula totais
      const itemsWithTotals = params.items.map((item, index) => {
        const itemTotal = calculateItemTotal(item.quantity, item.unitPrice)
        return {
          ...item,
          total: itemTotal,
          sortOrder: index,
        }
      })

      const subtotal = calculateSubtotal(itemsWithTotals.map((item) => item.total))
      const discount = params.discount || '0.00'
      const total = calculateTotal(subtotal, discount)

      // Gera número da venda
      const saleNumber = `VND-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`

      // Prepara dados fiscais se solicitado
      let fiscalInvoice: FiscalInvoiceData | undefined
      if (params.emitFiscalNow) {
        const fiscalType = params.fiscalType || 'nfce'
        const accessKey = generateFiscalAccessKey('35', fiscalType === 'nfce' ? '65' : '55')
        const invoiceNum = String(Math.floor(1000 + Math.random() * 9000))
        fiscalInvoice = {
          type: fiscalType,
          number: invoiceNum,
          series: '1',
          accessKey,
          protocol: `1352600${Math.floor(10000000 + Math.random() * 90000000)}`,
          emittedAt: new Date().toISOString(),
          qrCodeUrl: `https://www.nfce.fazenda.sp.gov.br/consulta?p=${accessKey}`,
          status: 'authorized',
          cfop: '5.102',
          taxEnvironment: 'homologacao',
        }
      }

      // Localiza sessão de caixa aberta automaticamente caso não tenha sido informada explicitamente
      let resolvedSessionId = params.sessionId
      if (!resolvedSessionId) {
        const openSession = await cashSessionService.findBestOpenSession(
          organizationId,
          params.operatorId,
        )
        if (openSession) {
          resolvedSessionId = openSession.id
        }
      }

      const metadata: SaleMetadata = {
        isSale: true,
        isPdv: params.isPdv ?? true,
        paymentMethod: params.paymentMethod,
        customerName: params.customerName,
        customerDocument: params.customerDocument,
        fiscalInvoice,
        sessionId: resolvedSessionId,
        amountReceived: params.amountReceived,
        changeAmount: params.changeAmount,
        operatorId: params.operatorId,
        operatorName: params.operatorName,
        sellerName: params.sellerName || params.operatorName,
        originQuoteId: params.originQuoteId,
        originQuoteNumber: params.originQuoteNumber,
        originQuoteCreatorName: params.originQuoteCreatorName,
        originServiceOrderId: params.originServiceOrderId,
        originServiceOrderNumber: params.originServiceOrderNumber,
      }

      const fullNotes = encodeSaleNotes(metadata, params.notes)

      // Validação de integridade do estoque: não permitir itens com cadastro pendente
      const invIds = [...new Set(params.items.map((i) => i.inventoryItemId).filter(Boolean))] as string[]
      if (invIds.length > 0) {
        const { data: invItems } = await supabase
          .from('inventory_items')
          .select('id, name, can_sell, attributes')
          .eq('organization_id', organizationId)
          .in('id', invIds)

        const pending = invItems?.find(
          (i) =>
            i.can_sell === false ||
            (i.attributes as Record<string, unknown>)?.registration_status === 'awaiting_information',
        )
        if (pending) {
          return {
            success: false,
            error: `O produto "${pending.name}" está com status "Aguardando informação" e não pode ser vendido até que o cadastro seja concluído no estoque.`,
          }
        }
      }

      // 1. Insere o cabeçalho como 'draft'
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          organization_id: organizationId,
          customer_id: finalCustomerId,
          quote_number: saleNumber,
          status: 'draft',
          subtotal,
          discount,
          total,
          notes: fullNotes,
          origin_quote_id: params.originQuoteId || null,
          seller_name: params.sellerName || params.operatorName || null,
        })
        .select('id, creator_name')
        .single()

      if (quoteError || !quote) {
        logger.error('Erro ao criar registro de venda', quoteError)
        return { success: false, error: 'Não foi possível registrar a venda.' }
      }

      const saleId = quote.id

      // 2. Insere os itens da venda
      const itemsPayload = itemsWithTotals.map((item) => ({
        quote_id: saleId,
        organization_id: organizationId,
        description: item.description,
        unit: item.unit || 'UN',
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total,
        sort_order: item.sortOrder,
        inventory_item_id: item.itemType === 'service' ? null : (item.inventoryItemId || null),
        item_type: item.itemType || (item.serviceId ? 'service' : 'product'),
        service_id: item.serviceId || null,
      }))

      const { error: itemsError } = await supabase.from('quote_items').insert(itemsPayload)
      if (itemsError) {
        logger.error('Erro ao salvar itens da venda', itemsError)
        await supabase.from('quotes').delete().eq('id', saleId)
        return { success: false, error: 'Erro ao registrar itens da venda no estoque.' }
      }

      // 3. Atualiza o status para 'approved'
      // O trigger consume_inventory_for_approved_quote faz a validação e baixa de estoque automaticamente!
      const { error: sentError } = await supabase
        .from('quotes')
        .update({ status: 'sent' })
        .eq('id', saleId)

      if (sentError) {
        logger.error('Erro na transição preliminar da venda', sentError)
      }

      const { error: approveError } = await supabase
        .from('quotes')
        .update({ status: 'approved' })
        .eq('id', saleId)

      if (approveError) {
        logger.error('Erro ao aprovar e baixar estoque da venda', approveError)
        if (approveError.message.includes('INSUFFICIENT_STOCK')) {
          // Exclui a venda não finalizada
          await supabase.from('quote_items').delete().eq('quote_id', saleId)
          await supabase.from('quotes').delete().eq('id', saleId)
          return {
            success: false,
            error: 'Estoque insuficiente para um ou mais produtos selecionados.',
          }
        }
        return {
          success: false,
          error: 'A venda foi salva, mas ocorreu um erro ao registrar a baixa de estoque.',
        }
      }

      // 4. Marca como concluída (completed) e salva o vendedor
      await supabase
        .from('quotes')
        .update({
          status: 'completed',
          seller_name: params.sellerName || params.operatorName || quote.creator_name || null,
        })
        .eq('id', saleId)

      // Baixa de estoque dos insumos vinculados aos serviços vendidos
      const serviceItems = itemsWithTotals.filter(
        (i) => (i.itemType === 'service' || i.serviceId) && i.serviceId,
      )
      if (serviceItems.length > 0) {
        const serviceIds = [...new Set(serviceItems.map((i) => i.serviceId).filter(Boolean))] as string[]
        if (serviceIds.length > 0) {
          const { data: svcMaterials } = await supabase
            .from('service_materials')
            .select('service_id, inventory_item_id, quantity, unit')
            .eq('organization_id', organizationId)
            .in('service_id', serviceIds)

          if (svcMaterials && svcMaterials.length > 0) {
            for (const sItem of serviceItems) {
              const mats = svcMaterials.filter((m) => m.service_id === sItem.serviceId)
              for (const mat of mats) {
                const deductQty = (Number(sItem.quantity) || 1) * (Number(mat.quantity) || 1)
                const { data: currentStock } = await supabase
                  .from('inventory_items')
                  .select('id, quantity_on_hand, name')
                  .eq('organization_id', organizationId)
                  .eq('id', mat.inventory_item_id)
                  .single()

                if (currentStock) {
                  const beforeBalance = Number(currentStock.quantity_on_hand) || 0
                  const afterBalance = beforeBalance - deductQty
                  await supabase
                    .from('inventory_items')
                    .update({ quantity_on_hand: afterBalance })
                    .eq('organization_id', organizationId)
                    .eq('id', mat.inventory_item_id)

                  await supabase.from('inventory_movements').insert({
                    organization_id: organizationId,
                    inventory_item_id: mat.inventory_item_id,
                    movement_type: 'quote_approval',
                    quantity: deductQty,
                    balance_before: beforeBalance,
                    balance_after: afterBalance,
                    reason: `Baixa de insumos do serviço "${sItem.description}" na venda ${saleNumber}`,
                    quote_id: saleId,
                    user_id: params.operatorId || null,
                  })
                }
              }
            }
          }
        }
      }

      // Se originou de um orçamento, atualiza o orçamento com o ID da venda, status completed e vendedor
      if (params.originQuoteId) {
        await supabase
          .from('quotes')
          .update({
            status: 'completed',
            sale_id: saleId,
            seller_name: params.sellerName || params.operatorName || quote.creator_name || null,
          })
          .eq('organization_id', organizationId)
          .eq('id', params.originQuoteId)
      }

      // 5. Integra com o Caixa (Recebível / Cash Entry)
      void cashService.createQuoteReceivable(organizationId, saleId).catch((cashErr) => {
        logger.warn('Não foi possível registrar o recebível de caixa para a venda', cashErr)
      })

      // 6. Registra automaticamente a receita na Sessão de Caixa aberta (Vendas, PDV, O.S. e Orçamentos)
      if (resolvedSessionId) {
        await cashSessionService.recordSaleInSession(organizationId, resolvedSessionId, {
          total,
          paymentMethod: params.paymentMethod,
          amountReceived: params.amountReceived,
        }).catch((sessionErr) => {
          logger.warn('Falha ao registrar venda na sessão de caixa ativa', sessionErr)
        })
      }

      return {
        success: true,
        data: {
          saleId,
          saleNumber,
          fiscalInvoice,
        },
      }
    } catch (err) {
      logger.error('Exceção ao criar venda', err)
      return { success: false, error: 'Erro inesperado ao registrar a venda.' }
    }
  },

  /**
   * Emite Nota Fiscal Eletrônica (NF-e ou NFC-e) para uma venda já finalizada
   */
  async emitFiscalInvoice(
    organizationId: UUID,
    saleId: UUID,
    fiscalType: 'nfce' | 'nfe',
  ): Promise<ServiceResult<FiscalInvoiceData>> {
    try {
      const { data: quote, error: fetchErr } = await supabase
        .from('quotes')
        .select('id, notes')
        .eq('organization_id', organizationId)
        .eq('id', saleId)
        .single()

      if (fetchErr || !quote) {
        return { success: false, error: 'Venda não localizada para emissão fiscal.' }
      }

      const { metadata, cleanNotes } = parseSaleNotes(quote.notes)

      const accessKey = generateFiscalAccessKey('35', fiscalType === 'nfce' ? '65' : '55')
      const invoiceNum = String(Math.floor(1000 + Math.random() * 9000))

      const fiscalInvoice: FiscalInvoiceData = {
        type: fiscalType,
        number: invoiceNum,
        series: '1',
        accessKey,
        protocol: `1352600${Math.floor(10000000 + Math.random() * 90000000)}`,
        emittedAt: new Date().toISOString(),
        qrCodeUrl: `https://www.nfce.fazenda.sp.gov.br/consulta?p=${accessKey}`,
        status: 'authorized',
        cfop: '5.102',
        taxEnvironment: 'homologacao',
      }

      const updatedMetadata: SaleMetadata = {
        ...metadata,
        fiscalInvoice,
      }

      const updatedNotes = encodeSaleNotes(updatedMetadata, cleanNotes)

      const { error: updateErr } = await supabase
        .from('quotes')
        .update({ notes: updatedNotes })
        .eq('id', saleId)

      if (updateErr) {
        return { success: false, error: 'Erro ao registrar dados da nota fiscal na venda.' }
      }

      return { success: true, data: fiscalInvoice }
    } catch (err) {
      logger.error('Exceção ao emitir nota fiscal', err)
      return { success: false, error: 'Erro inesperado ao emitir documento fiscal.' }
    }
  },

  /**
   * Fatura um orçamento aprovado existente
   */
  async faturarOrcamento(
    organizationId: UUID,
    quoteId: UUID,
    paymentMethod: PaymentMethod,
  ): Promise<ServiceResult<void>> {
    try {
      const { data: quote, error } = await supabase
        .from('quotes')
        .select('id, status, notes')
        .eq('organization_id', organizationId)
        .eq('id', quoteId)
        .single()

      if (error || !quote) {
        return { success: false, error: 'Orçamento não encontrado.' }
      }

      const { metadata, cleanNotes } = parseSaleNotes(quote.notes)
      const updatedMetadata: SaleMetadata = {
        ...metadata,
        isSale: true,
        paymentMethod,
      }

      // Se ainda não estiver approved, aprova
      if (quote.status === 'draft' || quote.status === 'sent') {
        await supabase.from('quotes').update({ status: 'sent' }).eq('id', quoteId)
        await supabase.from('quotes').update({ status: 'approved' }).eq('id', quoteId)
      }

      // Conclui
      await supabase
        .from('quotes')
        .update({
          status: 'completed',
          notes: encodeSaleNotes(updatedMetadata, cleanNotes),
        })
        .eq('id', quoteId)

      void cashService.createQuoteReceivable(organizationId, quoteId).catch(() => {})

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao faturar orçamento', err)
      return { success: false, error: 'Erro inesperado ao faturar orçamento.' }
    }
  },
}
