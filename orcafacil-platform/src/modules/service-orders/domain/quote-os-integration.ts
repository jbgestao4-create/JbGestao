import type { QuoteStatus } from '@shared/types/database'
import {
  calculateItemTotal,
  calculateSubtotal,
  calculateTotal,
  formatCurrency,
} from '@shared/utils/monetary'
import type { ServiceOrderItem, ServiceOrderStatus } from './service-order'

export interface CommercialScopeItem {
  id?: string
  itemType: 'product' | 'service'
  inventoryItemId?: string | null
  serviceId?: string | null
  description: string
  unit?: string | null
  quantity: string | number
  unitPrice: string | number
  total?: string | number
}

export interface CommercialScopeSnapshot {
  version: number
  subtotal: string
  discount: string
  total: string
  approvedBy?: 'client' | 'user' | string | null
  approvedAt?: string | null
  items: CommercialScopeItem[]
}

export type CommercialChangeType =
  | 'added_material'
  | 'added_service'
  | 'removed_material'
  | 'removed_service'
  | 'quantity_changed'
  | 'unit_price_changed'
  | 'discount_changed'
  | 'total_changed'

export interface CommercialChangeEntry {
  type: CommercialChangeType
  itemType?: 'product' | 'service'
  description: string
  previousQuantity?: string
  newQuantity?: string
  previousUnitPrice?: string
  newUnitPrice?: string
  previousTotal?: string
  newTotal?: string
  summary: string
}

export interface CommercialScopeComparisonResult {
  hasCommercialChange: boolean
  previousSubtotal: string
  newSubtotal: string
  previousDiscount: string
  newDiscount: string
  previousTotal: string
  newTotal: string
  changes: CommercialChangeEntry[]
  summaryText: string
}

export interface QuoteOsHistoryEntry {
  id: string
  timestamp: string
  eventType:
    | 'os_created_from_quote'
    | 'commercial_change_detected'
    | 'quote_reapproved'
    | 'quote_rejected'
    | 'os_finalized'
    | 'sent_to_sale'
    | 'status_changed'
  quoteVersion: number
  previousQuoteStatus?: QuoteStatus | null
  newQuoteStatus?: QuoteStatus | null
  previousOsStatus?: ServiceOrderStatus | null
  newOsStatus?: ServiceOrderStatus | null
  previousTotal?: string | null
  newTotal?: string | null
  actorName?: string | null
  description: string
  changes?: CommercialChangeEntry[]
}

export interface ServiceOrderMetadata {
  quoteId?: string | null
  quoteNumber?: string | null
  quoteVersion?: number
  logicalStatus?: ServiceOrderStatus
  approvedQuoteSnapshot?: CommercialScopeSnapshot | null
  statusHistory?: QuoteOsHistoryEntry[]
}

const OS_META_DELIMITER = '__OS_META__'

export function encodeOsInternalNotes(
  metadata: ServiceOrderMetadata,
  userNotes?: string | null,
): string | null {
  const cleanUserNotes = userNotes?.trim() || ''
  const hasMeta =
    Boolean(metadata.quoteId) ||
    Boolean(metadata.quoteNumber) ||
    Boolean(metadata.logicalStatus) ||
    Boolean(metadata.approvedQuoteSnapshot) ||
    Boolean(metadata.statusHistory && metadata.statusHistory.length > 0)

  if (!hasMeta) {
    return cleanUserNotes || null
  }

  return `${OS_META_DELIMITER}${JSON.stringify(metadata)}${OS_META_DELIMITER}${cleanUserNotes}`
}

export function parseOsInternalNotes(rawNotes: string | null | undefined): {
  metadata: ServiceOrderMetadata
  cleanNotes: string | null
} {
  if (!rawNotes) {
    return { metadata: {}, cleanNotes: null }
  }

  try {
    if (rawNotes.startsWith(OS_META_DELIMITER)) {
      const parts = rawNotes.split(OS_META_DELIMITER)
      const parsed = JSON.parse(parts[1] || '{}') as ServiceOrderMetadata
      const clean = (parts.slice(2).join(OS_META_DELIMITER) || '').trim()
      return {
        metadata: parsed,
        cleanNotes: clean || null,
      }
    }
  } catch {
    // Fallback para nota simples caso não seja JSON válido
  }

  return { metadata: {}, cleanNotes: rawNotes.trim() || null }
}

function normalizeNumber(val: string | number | null | undefined): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0
  if (!val) return 0
  const parsed = Number(String(val).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function buildItemMatchKey(item: CommercialScopeItem): string {
  const type = item.itemType === 'service' || Boolean(item.serviceId) ? 'service' : 'product'
  if (type === 'product' && item.inventoryItemId) {
    return `product:id:${item.inventoryItemId.trim().toLowerCase()}`
  }
  if (type === 'service' && item.serviceId) {
    return `service:id:${item.serviceId.trim().toLowerCase()}`
  }
  const normalizedDesc = item.description.trim().toLocaleLowerCase('pt-BR')
  return `${type}:desc:${normalizedDesc}`
}

/**
 * Converte os itens de um orçamento aprovado para itens de Ordem de Serviço.
 */
export function mapQuoteItemsToServiceOrderItems(
  quoteItems: Array<{
    id?: string
    description: string
    quantity: string | number
    unitPrice: string | number
    total?: string | number
    inventoryItemId?: string | null
    serviceId?: string | null
    itemType?: 'product' | 'service'
    unit?: string | null
  }>,
): ServiceOrderItem[] {
  return quoteItems.map((it, idx) => {
    const itemType: 'product' | 'service' =
      it.itemType === 'service' || Boolean(it.serviceId) ? 'service' : 'product'
    const quantity = String(normalizeNumber(it.quantity))
    const unitPrice = normalizeNumber(it.unitPrice).toFixed(2)
    const total =
      it.total !== undefined
        ? normalizeNumber(it.total).toFixed(2)
        : calculateItemTotal(quantity, unitPrice)

    return {
      id: it.id || `quote-os-item-${idx + 1}`,
      itemType,
      inventoryItemId: itemType === 'product' ? (it.inventoryItemId ?? null) : null,
      serviceId: itemType === 'service' ? (it.serviceId ?? null) : null,
      description: it.description.trim(),
      unit: it.unit?.trim() || 'UN',
      quantity,
      unitPrice,
      total,
    }
  })
}

/**
 * Converte os itens da Ordem de Serviço de volta para o formato de atualização do Orçamento.
 */
export function mapServiceOrderItemsToQuoteItems(
  osItems: Array<{
    itemType: 'product' | 'service'
    inventoryItemId?: string | null
    serviceId?: string | null
    description: string
    unit?: string | null
    quantity: string | number
    unitPrice: string | number
  }>,
) {
  return osItems.map((it) => {
    const itemType: 'product' | 'service' =
      it.itemType === 'service' || Boolean(it.serviceId) ? 'service' : 'product'
    return {
      description: it.description.trim(),
      quantity: String(normalizeNumber(it.quantity)),
      unitPrice: normalizeNumber(it.unitPrice).toFixed(2),
      inventoryItemId: itemType === 'product' ? (it.inventoryItemId ?? null) : null,
      serviceId: itemType === 'service' ? (it.serviceId ?? null) : null,
      itemType,
      unit: it.unit?.trim() || 'UN',
    }
  })
}

/**
 * Constrói um snapshot imutável dos dados comerciais aprovados no orçamento.
 */
export function buildApprovedQuoteSnapshot(params: {
  version?: number
  subtotal?: string | number
  discount?: string | number
  total?: string | number
  approvedBy?: 'client' | 'user' | string | null
  approvedAt?: string | null
  items: CommercialScopeItem[]
}): CommercialScopeSnapshot {
  const normalizedItems: CommercialScopeItem[] = params.items.map((it) => {
    const itemType: 'product' | 'service' =
      it.itemType === 'service' || Boolean(it.serviceId) ? 'service' : 'product'
    const qtyStr = String(normalizeNumber(it.quantity))
    const priceStr = normalizeNumber(it.unitPrice).toFixed(2)
    const itemTotal = calculateItemTotal(qtyStr, priceStr)
    return {
      id: it.id,
      itemType,
      inventoryItemId: itemType === 'product' ? (it.inventoryItemId ?? null) : null,
      serviceId: itemType === 'service' ? (it.serviceId ?? null) : null,
      description: it.description.trim(),
      unit: it.unit?.trim() || 'UN',
      quantity: qtyStr,
      unitPrice: priceStr,
      total: itemTotal,
    }
  })

  const subtotal =
    params.subtotal !== undefined
      ? normalizeNumber(params.subtotal).toFixed(2)
      : calculateSubtotal(normalizedItems.map((i) => String(i.total)))
  const discount = normalizeNumber(params.discount).toFixed(2)
  const total =
    params.total !== undefined
      ? normalizeNumber(params.total).toFixed(2)
      : calculateTotal(subtotal, discount)

  return {
    version: params.version ?? 1,
    subtotal,
    discount,
    total,
    approvedBy: params.approvedBy ?? null,
    approvedAt: params.approvedAt ?? new Date().toISOString(),
    items: normalizedItems,
  }
}

/**
 * Compara o escopo comercial aprovado no orçamento com o escopo atual da Ordem de Serviço.
 * Identifica:
 * - Inclusão ou remoção de materiais (produtos/peças)
 * - Inclusão ou remoção de serviços
 * - Alteração de quantidades
 * - Alteração de valores unitários
 * - Alteração de descontos ou do valor total aprovado
 *
 * Ignora informações operacionais da O.S. (observações internas, diagnóstico, solução, fotos, avarias).
 */
export function compareCommercialScope(
  baseline: {
    items: CommercialScopeItem[]
    discount?: string | number | null
    total?: string | number | null
  },
  current: {
    items: CommercialScopeItem[]
    discount?: string | number | null
    total?: string | number | null
  },
): CommercialScopeComparisonResult {
  const changes: CommercialChangeEntry[] = []

  const baseBuckets = new Map<string, Array<{ item: CommercialScopeItem; used: boolean }>>()
  for (const bItem of baseline.items) {
    const key = buildItemMatchKey(bItem)
    const list = baseBuckets.get(key) ?? []
    list.push({ item: bItem, used: false })
    baseBuckets.set(key, list)
  }

  for (const cItem of current.items) {
    const key = buildItemMatchKey(cItem)
    const candidates = baseBuckets.get(key)
    const matchedEntry = candidates?.find((entry) => !entry.used)
    const cType: 'product' | 'service' =
      cItem.itemType === 'service' || Boolean(cItem.serviceId) ? 'service' : 'product'
    const cQty = normalizeNumber(cItem.quantity)
    const cPrice = normalizeNumber(cItem.unitPrice)
    const cTotal = calculateItemTotal(String(cQty), cPrice.toFixed(2))

    if (!matchedEntry) {
      if (cType === 'service') {
        changes.push({
          type: 'added_service',
          itemType: 'service',
          description: cItem.description.trim(),
          newQuantity: String(cQty),
          newUnitPrice: cPrice.toFixed(2),
          newTotal: cTotal,
          summary: `Novo serviço adicionado: "${cItem.description.trim()}" (${cQty}x ${formatCurrency(cPrice)})`,
        })
      } else {
        changes.push({
          type: 'added_material',
          itemType: 'product',
          description: cItem.description.trim(),
          newQuantity: String(cQty),
          newUnitPrice: cPrice.toFixed(2),
          newTotal: cTotal,
          summary: `Novo material adicionado: "${cItem.description.trim()}" (${cQty}x ${formatCurrency(cPrice)})`,
        })
      }
      continue
    }

    matchedEntry.used = true
    const bItem = matchedEntry.item
    const bQty = normalizeNumber(bItem.quantity)
    const bPrice = normalizeNumber(bItem.unitPrice)
    const bTotal = calculateItemTotal(String(bQty), bPrice.toFixed(2))

    if (Math.abs(cQty - bQty) > 0.0001) {
      changes.push({
        type: 'quantity_changed',
        itemType: cType,
        description: cItem.description.trim(),
        previousQuantity: String(bQty),
        newQuantity: String(cQty),
        previousUnitPrice: bPrice.toFixed(2),
        newUnitPrice: cPrice.toFixed(2),
        previousTotal: bTotal,
        newTotal: cTotal,
        summary: `Quantidade alterada em "${cItem.description.trim()}": de ${bQty} para ${cQty}`,
      })
    }

    if (Math.abs(cPrice - bPrice) > 0.005) {
      changes.push({
        type: 'unit_price_changed',
        itemType: cType,
        description: cItem.description.trim(),
        previousQuantity: String(bQty),
        newQuantity: String(cQty),
        previousUnitPrice: bPrice.toFixed(2),
        newUnitPrice: cPrice.toFixed(2),
        previousTotal: bTotal,
        newTotal: cTotal,
        summary: `Valor unitário alterado em "${cItem.description.trim()}": de ${formatCurrency(bPrice)} para ${formatCurrency(cPrice)}`,
      })
    }
  }

  for (const entries of baseBuckets.values()) {
    for (const entry of entries) {
      if (!entry.used) {
        const bItem = entry.item
        const bType: 'product' | 'service' =
          bItem.itemType === 'service' || Boolean(bItem.serviceId) ? 'service' : 'product'
        const bQty = normalizeNumber(bItem.quantity)
        const bPrice = normalizeNumber(bItem.unitPrice)
        const bTotal = calculateItemTotal(String(bQty), bPrice.toFixed(2))
        changes.push({
          type: bType === 'service' ? 'removed_service' : 'removed_material',
          itemType: bType,
          description: bItem.description.trim(),
          previousQuantity: String(bQty),
          previousUnitPrice: bPrice.toFixed(2),
          previousTotal: bTotal,
          summary: `${bType === 'service' ? 'Serviço' : 'Material'} removido: "${bItem.description.trim()}"`,
        })
      }
    }
  }

  const baseSubtotal = calculateSubtotal(
    baseline.items.map((it) =>
      calculateItemTotal(
        String(normalizeNumber(it.quantity)),
        normalizeNumber(it.unitPrice).toFixed(2),
      ),
    ),
  )
  const curSubtotal = calculateSubtotal(
    current.items.map((it) =>
      calculateItemTotal(
        String(normalizeNumber(it.quantity)),
        normalizeNumber(it.unitPrice).toFixed(2),
      ),
    ),
  )

  const baseDiscountNum = normalizeNumber(baseline.discount)
  const curDiscountNum = normalizeNumber(current.discount)
  const previousDiscount = baseDiscountNum.toFixed(2)
  const newDiscount = curDiscountNum.toFixed(2)

  if (Math.abs(curDiscountNum - baseDiscountNum) > 0.005) {
    changes.push({
      type: 'discount_changed',
      description: 'Desconto comercial',
      previousTotal: previousDiscount,
      newTotal: newDiscount,
      summary: `Desconto alterado de ${formatCurrency(previousDiscount)} para ${formatCurrency(newDiscount)}`,
    })
  }

  const previousTotal =
    baseline.total !== undefined && baseline.total !== null
      ? normalizeNumber(baseline.total).toFixed(2)
      : calculateTotal(baseSubtotal, previousDiscount)
  const newTotal =
    current.total !== undefined && current.total !== null
      ? normalizeNumber(current.total).toFixed(2)
      : calculateTotal(curSubtotal, newDiscount)

  if (
    changes.length === 0 &&
    Math.abs(normalizeNumber(newTotal) - normalizeNumber(previousTotal)) > 0.005
  ) {
    changes.push({
      type: 'total_changed',
      description: 'Valor total do orçamento',
      previousTotal,
      newTotal,
      summary: `Valor total alterado de ${formatCurrency(previousTotal)} para ${formatCurrency(newTotal)}`,
    })
  }

  const hasCommercialChange = changes.length > 0
  const summaryText = hasCommercialChange
    ? changes.map((c) => c.summary).join('; ')
    : 'Nenhuma alteração comercial em relação ao orçamento aprovado.'

  return {
    hasCommercialChange,
    previousSubtotal: baseSubtotal,
    newSubtotal: curSubtotal,
    previousDiscount,
    newDiscount,
    previousTotal,
    newTotal,
    changes,
    summaryText,
  }
}

/**
 * Valida se um orçamento pode gerar uma nova Ordem de Serviço (Fluxo 1).
 */
export function canGenerateOsFromQuote(quote: {
  status: QuoteStatus
  saleId?: string | null
  serviceOrderId?: string | null
}): { allowed: boolean; reason?: string } {
  if (quote.saleId) {
    return {
      allowed: false,
      reason: 'Este orçamento já foi enviado para venda e não pode gerar uma nova O.S.',
    }
  }
  if (quote.serviceOrderId) {
    return {
      allowed: false,
      reason: 'Este orçamento já possui uma Ordem de Serviço vinculada. Não é permitido gerar O.S. duplicada.',
    }
  }
  if (quote.status !== 'approved') {
    return {
      allowed: false,
      reason: 'Somente orçamentos com status APROVADO podem gerar uma Ordem de Serviço.',
    }
  }
  return { allowed: true }
}

/**
 * Valida se uma Ordem de Serviço pode ser finalizada (Fluxos 2, 3 e 4).
 */
export function canFinalizeServiceOrder(params: {
  osStatus: ServiceOrderStatus
  quoteId?: string | null
  quoteStatus?: QuoteStatus | null
  hasUnapprovedCommercialChanges?: boolean
}): { allowed: boolean; reason?: string } {
  if (params.osStatus === 'closed') {
    return {
      allowed: false,
      reason: 'Esta Ordem de Serviço já se encontra encerrada.',
    }
  }
  if (params.osStatus === 'pending_approval') {
    return {
      allowed: false,
      reason:
        'A Ordem de Serviço está PENDENTE DE APROVAÇÃO do cliente. Aguarde a aprovação da nova versão do orçamento antes de finalizar a O.S.',
    }
  }
  if (params.hasUnapprovedCommercialChanges) {
    return {
      allowed: false,
      reason:
        'Foram identificadas alterações comerciais (materiais, serviços, quantidades ou valores). O orçamento deverá ser reenviado e aprovado pelo cliente antes de finalizar a O.S.',
    }
  }
  if (params.quoteId && params.quoteStatus && params.quoteStatus !== 'approved') {
    return {
      allowed: false,
      reason:
        'O orçamento vinculado não está com status APROVADO. A Ordem de Serviço só pode ser finalizada após a aprovação do cliente.',
    }
  }
  return { allowed: true }
}

/**
 * Valida se uma Ordem de Serviço pode ser enviada para venda (Fluxo 4).
 */
export function canSendServiceOrderToSale(params: {
  osStatus: ServiceOrderStatus
  saleId?: string | null
  quoteId?: string | null
  quoteStatus?: QuoteStatus | null
  quoteSaleId?: string | null
  hasUnapprovedCommercialChanges?: boolean
}): { allowed: boolean; reason?: string } {
  if (params.saleId || params.quoteSaleId) {
    return {
      allowed: false,
      reason: 'Esta Ordem de Serviço já possui uma venda vinculada. Não é permitido gerar cobrança duplicada.',
    }
  }
  if (params.osStatus === 'pending_approval' || params.hasUnapprovedCommercialChanges) {
    return {
      allowed: false,
      reason:
        'Não é permitido enviar para venda uma Ordem de Serviço com alterações comerciais pendentes de aprovação do cliente.',
    }
  }
  if (params.quoteId && params.quoteStatus && params.quoteStatus !== 'approved') {
    return {
      allowed: false,
      reason:
        'O orçamento vinculado precisa estar APROVADO pelo cliente antes de enviar a Ordem de Serviço para venda.',
    }
  }
  if (params.osStatus !== 'ready') {
    return {
      allowed: false,
      reason: 'A Ordem de Serviço precisa estar com status FINALIZADA antes de ser enviada para venda.',
    }
  }
  return { allowed: true }
}

/**
 * Valida se um orçamento aprovado pode ser enviado diretamente para venda (Caminho A vs Caminho B).
 */
export function canSendQuoteDirectlyToSale(params: {
  quoteStatus: QuoteStatus
  saleId?: string | null
  serviceOrderId?: string | null
  serviceOrderStatus?: ServiceOrderStatus | null
}): { allowed: boolean; reason?: string } {
  if (params.saleId || params.quoteStatus === 'completed') {
    return {
      allowed: false,
      reason: 'Este orçamento já foi faturado em uma venda. Não é permitido gerar venda duplicada.',
    }
  }
  if (params.quoteStatus !== 'approved') {
    return {
      allowed: false,
      reason: 'O orçamento precisa estar APROVADO antes de ser enviado para venda.',
    }
  }
  if (
    params.serviceOrderId &&
    params.serviceOrderStatus &&
    params.serviceOrderStatus !== 'ready'
  ) {
    return {
      allowed: false,
      reason:
        'Este orçamento possui uma Ordem de Serviço em execução ou pendente de aprovação. Finalize a O.S. antes de prosseguir para a venda.',
    }
  }
  return { allowed: true }
}
