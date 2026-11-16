import type {
  ServiceOrderDetail,
  ServiceOrderItem,
  ServiceOrderListItem,
  ServiceOrderPhoto,
  ServiceOrderPriority,
  ServiceOrderStatus,
} from '../domain/service-order'
import {
  buildApprovedQuoteSnapshot,
  canFinalizeServiceOrder,
  canGenerateOsFromQuote,
  compareCommercialScope,
  encodeOsInternalNotes,
  mapServiceOrderItemsToQuoteItems,
  parseOsInternalNotes,
  type CommercialScopeSnapshot,
  type QuoteOsHistoryEntry,
} from '../domain/quote-os-integration'
import { quoteService } from '@modules/orcafacil/services/quote.service'
import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UUID } from '@shared/types/common'
import {
  calculateItemTotal,
  calculateSubtotal,
  calculateTotal,
  formatCurrency,
} from '@shared/utils/monetary'

export type {
  ServiceOrderDetail,
  ServiceOrderItem,
  ServiceOrderListItem,
  ServiceOrderPhoto,
  ServiceOrderPriority,
  ServiceOrderStatus,
} from '../domain/service-order'

interface ServiceOrderRow {
  id: string
  organization_id: string
  order_number: string
  status: string
  priority: ServiceOrderPriority
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  customer_document: string | null
  equipment_name: string
  equipment_brand: string | null
  equipment_model: string | null
  serial_number: string | null
  equipment_color: string | null
  accessories: string | null
  device_password: string | null
  damage_notes: string | null
  damage_checklist: unknown
  photos: unknown
  reported_problem: string
  technical_diagnosis: string | null
  solution_applied: string | null
  technician_name: string | null
  estimated_delivery_date: string | null
  warranty_days: number
  warranty_terms: string | null
  internal_notes: string | null
  products_subtotal: string | number
  services_subtotal: string | number
  subtotal: string | number
  discount: string | number
  total: string | number
  quote_id?: string | null
  quote_number?: string | null
  quote_version?: number | null
  approved_quote_snapshot?: unknown
  status_history?: unknown
  sale_id: string | null
  sale_number: string | null
  created_by: string | null
  creator_name: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

interface ServiceOrderItemRow {
  id: string
  organization_id: string
  service_order_id: string
  item_type: 'product' | 'service'
  inventory_item_id: string | null
  service_id: string | null
  description: string
  unit: string
  quantity: string | number
  unit_price: string | number
  total: string | number
  created_at: string
}

export interface SaveServiceOrderParams {
  orderNumber?: string
  status: ServiceOrderStatus
  priority: ServiceOrderPriority
  customerId?: string | null
  customerName: string
  customerPhone?: string | null
  customerDocument?: string | null
  equipmentName: string
  equipmentBrand?: string | null
  equipmentModel?: string | null
  serialNumber?: string | null
  equipmentColor?: string | null
  accessories?: string | null
  devicePassword?: string | null
  damageNotes?: string | null
  damageChecklist: string[]
  photos: ServiceOrderPhoto[]
  reportedProblem: string
  technicalDiagnosis?: string | null
  solutionApplied?: string | null
  technicianName?: string | null
  estimatedDeliveryDate?: string | null
  warrantyDays?: number
  warrantyTerms?: string | null
  internalNotes?: string | null
  pendingReason?: string | null
  discount?: string
  quoteId?: string | null
  quoteNumber?: string | null
  items: Array<{
    id?: string
    itemType: 'product' | 'service'
    inventoryItemId?: string | null
    serviceId?: string | null
    description: string
    unit: string
    quantity: string
    unitPrice: string
  }>
  createdBy?: string | null
  creatorName?: string | null
}

function parsePhotos(raw: unknown): ServiceOrderPhoto[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
    .map((p, idx) => ({
      id: typeof p.id === 'string' ? p.id : `photo-${idx}`,
      dataUrl: typeof p.dataUrl === 'string' ? p.dataUrl : '',
      caption: typeof p.caption === 'string' ? p.caption : undefined,
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
    }))
    .filter((p) => Boolean(p.dataUrl))
}

function parseChecklist(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === 'string')
}

function normalizeStatus(raw: string, logicalStatus?: ServiceOrderStatus): ServiceOrderStatus {
  if (logicalStatus) return logicalStatus
  if (raw === 'approved' || raw === 'pending_approval') {
    return raw
  }
  if (raw === 'queue' || raw === 'waiting_parts') {
    return 'queue'
  }
  if (raw === 'in_maintenance' || raw === 'closed') {
    return raw
  }
  if (raw === 'ready' || raw === 'finalized') {
    return 'ready'
  }
  return 'pending'
}

function toDbStatus(status: ServiceOrderStatus, useLegacyConstraintFallback = false): string {
  if (useLegacyConstraintFallback) {
    if (status === 'queue') return 'waiting_parts'
    if (status === 'approved') return 'in_maintenance'
    if (status === 'pending_approval') return 'pending'
    return status
  }
  return status === 'queue' ? 'waiting_parts' : status
}

function parseSnapshot(raw: unknown): CommercialScopeSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.items)) return null
  return obj as unknown as CommercialScopeSnapshot
}

function parseHistory(raw: unknown): QuoteOsHistoryEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((e): e is QuoteOsHistoryEntry => typeof e === 'object' && e !== null)
}

function mapRowToListItem(row: ServiceOrderRow): ServiceOrderListItem {
  const photos = parsePhotos(row.photos)
  const checklist = parseChecklist(row.damage_checklist)
  const { metadata, cleanNotes } = parseOsInternalNotes(row.internal_notes)
  const hasDamage =
    Boolean(row.damage_notes?.trim()) ||
    checklist.some(
      (c) => c !== 'Sem Avarias identificadas' && c !== 'Sem avarias externas aparentes',
    )

  return {
    id: row.id,
    organizationId: row.organization_id,
    orderNumber: row.order_number,
    status: normalizeStatus(row.status, metadata.logicalStatus),
    priority: row.priority,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerDocument: row.customer_document,
    equipmentName: row.equipment_name,
    equipmentBrand: row.equipment_brand,
    equipmentModel: row.equipment_model,
    serialNumber: row.serial_number,
    reportedProblem: row.reported_problem,
    pendingReason: cleanNotes,
    solutionApplied: row.solution_applied,
    technicianName: row.technician_name,
    estimatedDeliveryDate: row.estimated_delivery_date,
    photosCount: photos.length,
    firstPhotoUrl: photos[0]?.dataUrl ?? null,
    hasDamage,
    productsSubtotal: String(Number(row.products_subtotal ?? 0).toFixed(2)),
    servicesSubtotal: String(Number(row.services_subtotal ?? 0).toFixed(2)),
    subtotal: String(Number(row.subtotal ?? 0).toFixed(2)),
    discount: String(Number(row.discount ?? 0).toFixed(2)),
    total: String(Number(row.total ?? 0).toFixed(2)),
    quoteId: row.quote_id ?? metadata.quoteId ?? null,
    quoteNumber: row.quote_number ?? metadata.quoteNumber ?? null,
    quoteVersion: Number(row.quote_version ?? metadata.quoteVersion ?? 1),
    saleId: row.sale_id,
    saleNumber: row.sale_number,
    creatorName: row.creator_name,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapRowToDetail(row: ServiceOrderRow, itemRows: ServiceOrderItemRow[]): ServiceOrderDetail {
  const { metadata, cleanNotes } = parseOsInternalNotes(row.internal_notes)
  const items: ServiceOrderItem[] = itemRows.map((it) => ({
    id: it.id,
    itemType: it.item_type,
    inventoryItemId: it.inventory_item_id,
    serviceId: it.service_id,
    description: it.description,
    unit: it.unit || 'UN',
    quantity: String(Number(it.quantity)),
    unitPrice: String(Number(it.unit_price).toFixed(2)),
    total: String(Number(it.total).toFixed(2)),
  }))

  const snapshot = parseSnapshot(row.approved_quote_snapshot) ?? metadata.approvedQuoteSnapshot ?? null
  const history =
    parseHistory(row.status_history).length > 0
      ? parseHistory(row.status_history)
      : (metadata.statusHistory ?? [])

  return {
    id: row.id,
    organizationId: row.organization_id,
    orderNumber: row.order_number,
    status: normalizeStatus(row.status, metadata.logicalStatus),
    priority: row.priority,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerDocument: row.customer_document,
    equipmentName: row.equipment_name,
    equipmentBrand: row.equipment_brand,
    equipmentModel: row.equipment_model,
    serialNumber: row.serial_number,
    equipmentColor: row.equipment_color,
    accessories: row.accessories,
    devicePassword: row.device_password,
    damageNotes: row.damage_notes,
    damageChecklist: parseChecklist(row.damage_checklist),
    photos: parsePhotos(row.photos),
    reportedProblem: row.reported_problem,
    technicalDiagnosis: row.technical_diagnosis,
    solutionApplied: row.solution_applied,
    technicianName: row.technician_name,
    estimatedDeliveryDate: row.estimated_delivery_date,
    warrantyDays: Number(row.warranty_days ?? 90),
    warrantyTerms: row.warranty_terms,
    internalNotes: cleanNotes,
    pendingReason: cleanNotes,
    productsSubtotal: String(Number(row.products_subtotal ?? 0).toFixed(2)),
    servicesSubtotal: String(Number(row.services_subtotal ?? 0).toFixed(2)),
    subtotal: String(Number(row.subtotal ?? 0).toFixed(2)),
    discount: String(Number(row.discount ?? 0).toFixed(2)),
    total: String(Number(row.total ?? 0).toFixed(2)),
    quoteId: row.quote_id ?? metadata.quoteId ?? null,
    quoteNumber: row.quote_number ?? metadata.quoteNumber ?? null,
    quoteVersion: Number(row.quote_version ?? metadata.quoteVersion ?? 1),
    approvedQuoteSnapshot: snapshot,
    statusHistory: history,
    saleId: row.sale_id,
    saleNumber: row.sale_number,
    creatorName: row.creator_name,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
  }
}

export const serviceOrderService = {
  async list(organizationId: UUID): Promise<ServiceResult<ServiceOrderListItem[]>> {
    try {
      let { data, error } = await supabase
        .from('service_orders')
        .select(`
          id,
          organization_id,
          order_number,
          status,
          priority,
          customer_id,
          customer_name,
          customer_phone,
          customer_document,
          equipment_name,
          equipment_brand,
          equipment_model,
          serial_number,
          reported_problem,
          solution_applied,
          technician_name,
          estimated_delivery_date,
          damage_notes,
          damage_checklist,
          internal_notes,
          products_subtotal,
          services_subtotal,
          subtotal,
          discount,
          total,
          quote_id,
          quote_number,
          quote_version,
          sale_id,
          sale_number,
          creator_name,
          closed_at,
          created_at,
          updated_at
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) {
        const fallback = await supabase
          .from('service_orders')
          .select(`
            id,
            organization_id,
            order_number,
            status,
            priority,
            customer_id,
            customer_name,
            customer_phone,
            customer_document,
            equipment_name,
            equipment_brand,
            equipment_model,
            serial_number,
            reported_problem,
            solution_applied,
            technician_name,
            estimated_delivery_date,
            damage_notes,
            damage_checklist,
            internal_notes,
            products_subtotal,
            services_subtotal,
            subtotal,
            discount,
            total,
            sale_id,
            sale_number,
            creator_name,
            closed_at,
            created_at,
            updated_at
          `)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
        data = fallback.data as typeof data
        error = fallback.error
      }

      if (error) {
        logger.error('Erro ao listar O.S. no Supabase', error)
        return { success: false, error: 'Não foi possível carregar as Ordens de Serviço.' }
      }

      return {
        success: true,
        data: ((data ?? []) as ServiceOrderRow[]).map(mapRowToListItem),
      }
    } catch (err) {
      logger.error('Erro inesperado ao listar O.S. no Supabase', err)
      return { success: false, error: 'Não foi possível carregar as Ordens de Serviço.' }
    }
  },

  async getById(organizationId: UUID, id: UUID): Promise<ServiceResult<ServiceOrderDetail>> {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('service_orders')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('id', id)
        .maybeSingle()

      if (orderError) {
        logger.error('Erro ao consultar Ordem de Serviço no Supabase', orderError)
        return { success: false, error: 'Erro ao carregar Ordem de Serviço.' }
      }
      if (!orderData) {
        return { success: false, error: 'Ordem de Serviço não encontrada.' }
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from('service_order_items')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('service_order_id', id)
        .order('created_at', { ascending: true })

      if (itemsError) {
        logger.error('Erro ao carregar itens da Ordem de Serviço', itemsError)
        return { success: false, error: 'Erro ao carregar os itens da Ordem de Serviço.' }
      }

      return {
        success: true,
        data: mapRowToDetail(
          orderData as ServiceOrderRow,
          (itemsData as ServiceOrderItemRow[]) ?? [],
        ),
      }
    } catch {
      return { success: false, error: 'Erro ao carregar Ordem de Serviço.' }
    }
  },

  async getByQuoteId(
    organizationId: UUID,
    quoteId: UUID,
  ): Promise<ServiceResult<ServiceOrderDetail | null>> {
    try {
      const listRes = await this.list(organizationId)
      if (!listRes.success) {
        return { success: false, error: listRes.error }
      }
      const match = listRes.data.find((os) => os.quoteId === quoteId)
      if (!match) {
        return { success: true, data: null }
      }
      return await this.getById(organizationId, match.id)
    } catch {
      return { success: false, error: 'Erro ao consultar Ordem de Serviço vinculada ao orçamento.' }
    }
  },

  async getNextOrderNumber(organizationId: UUID): Promise<string> {
    const year = new Date().getFullYear()
    const prefix = `OS-${String(year)}-`

    const listRes = await this.list(organizationId)
    const items = listRes.success ? listRes.data : []

    let maxSeq = 0
    for (const item of items) {
      if (item.orderNumber.startsWith(prefix)) {
        const numPart = parseInt(item.orderNumber.slice(prefix.length), 10)
        if (Number.isFinite(numPart) && numPart > maxSeq) {
          maxSeq = numPart
        }
      }
    }

    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`
  },

  async create(
    organizationId: UUID,
    params: SaveServiceOrderParams,
  ): Promise<ServiceResult<ServiceOrderDetail>> {
    try {
      if (!params.customerName.trim()) {
        return { success: false, error: 'Informe o nome do cliente.' }
      }
      if (!params.equipmentName.trim()) {
        return { success: false, error: 'Informe o nome/descrição do equipamento.' }
      }
      if (!params.reportedProblem.trim()) {
        return { success: false, error: 'Informe o problema/defeito relatado.' }
      }

      const computedItems: ServiceOrderItem[] = params.items.map((it) => ({
        id: it.id || crypto.randomUUID(),
        itemType: it.itemType,
        inventoryItemId: it.inventoryItemId || null,
        serviceId: it.serviceId || null,
        description: it.description.trim(),
        unit: it.unit || 'UN',
        quantity: String(Number(it.quantity.replace(',', '.'))),
        unitPrice: Number(it.unitPrice.replace(',', '.') || 0).toFixed(2),
        total: calculateItemTotal(
          String(Number(it.quantity.replace(',', '.'))),
          Number(it.unitPrice.replace(',', '.') || 0).toFixed(2),
        ),
      }))

      const productsSubtotal = calculateSubtotal(
        computedItems.filter((i) => i.itemType === 'product').map((i) => i.total),
      )
      const servicesSubtotal = calculateSubtotal(
        computedItems.filter((i) => i.itemType === 'service').map((i) => i.total),
      )
      const subtotal = calculateSubtotal(computedItems.map((i) => i.total))
      const discount = Number((params.discount || '0').replace(',', '.')).toFixed(2)
      const total = calculateTotal(subtotal, discount)
      const nowIso = new Date().toISOString()

      let effectiveStatus: ServiceOrderStatus = params.status
      let resolvedQuoteNumber: string | null = params.quoteNumber || null
      let resolvedQuoteVersion = 1
      let approvedSnapshot: CommercialScopeSnapshot | null = null
      const statusHistory: QuoteOsHistoryEntry[] = []
      let initialCommercialComparison: ReturnType<typeof compareCommercialScope> | null = null

      // Fluxo 1: Validação e vínculo quando a O.S. é originada de um orçamento aprovado
      if (params.quoteId) {
        const existingOsRes = await this.getByQuoteId(organizationId, params.quoteId)
        if (existingOsRes.success && existingOsRes.data) {
          return {
            success: false,
            error: `Este orçamento já possui a Ordem de Serviço #${existingOsRes.data.orderNumber} vinculada. Não é permitido gerar O.S. duplicada.`,
          }
        }

        const quoteRes = await quoteService.getQuote(organizationId, params.quoteId)
        if (!quoteRes.success) {
          return { success: false, error: quoteRes.error }
        }

        const originQuote = quoteRes.data
        const validation = canGenerateOsFromQuote({
          status: originQuote.status,
          saleId: originQuote.saleId,
          serviceOrderId: originQuote.serviceOrderId,
        })
        if (!validation.allowed) {
          return {
            success: false,
            error: validation.reason || 'Não é possível gerar O.S. para este orçamento.',
          }
        }

        resolvedQuoteNumber = originQuote.quoteNumber
        resolvedQuoteVersion = originQuote.version || 1

        approvedSnapshot = buildApprovedQuoteSnapshot({
          version: resolvedQuoteVersion,
          subtotal: originQuote.subtotal,
          discount: originQuote.discount,
          total: originQuote.total,
          approvedBy: originQuote.approvedBy,
          approvedAt: originQuote.approvedAt || nowIso,
          items: originQuote.items.map((it) => ({
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

        initialCommercialComparison = compareCommercialScope(approvedSnapshot, {
          items: computedItems,
          discount,
          total,
        })

        if (initialCommercialComparison.hasCommercialChange) {
          effectiveStatus = 'pending_approval'
          statusHistory.push({
            id: crypto.randomUUID(),
            timestamp: nowIso,
            eventType: 'os_created_from_quote',
            quoteVersion: resolvedQuoteVersion,
            previousQuoteStatus: 'approved',
            newQuoteStatus: 'sent',
            newOsStatus: 'pending_approval',
            previousTotal: originQuote.total,
            newTotal: total,
            actorName: params.creatorName || 'Técnico / Operador',
            description: `O.S. gerada a partir do Orçamento #${originQuote.quoteNumber} já com alterações comerciais (${initialCommercialComparison.summaryText}). Orçamento retornado para ENVIADO e O.S. marcada como PENDENTE DE APROVAÇÃO.`,
            changes: initialCommercialComparison.changes,
          })
        } else {
          // Regra do Fluxo 1: A OS deverá iniciar com o status APROVADA
          effectiveStatus = 'approved'
          statusHistory.push({
            id: crypto.randomUUID(),
            timestamp: nowIso,
            eventType: 'os_created_from_quote',
            quoteVersion: resolvedQuoteVersion,
            previousQuoteStatus: 'approved',
            newQuoteStatus: 'approved',
            newOsStatus: 'approved',
            previousTotal: originQuote.total,
            newTotal: total,
            actorName: params.creatorName || 'Técnico / Operador',
            description: `Ordem de Serviço gerada a partir do Orçamento aprovado #${originQuote.quoteNumber} (${formatCurrency(total)}) com status inicial APROVADA.`,
          })
        }
      }

      const orderNumber = params.orderNumber?.trim() || (await this.getNextOrderNumber(organizationId))
      const userCleanNotes = (params.pendingReason ?? params.internalNotes)?.trim() || null
      const encodedInternalNotes = encodeOsInternalNotes(
        {
          quoteId: params.quoteId || null,
          quoteNumber: resolvedQuoteNumber,
          quoteVersion: resolvedQuoteVersion,
          logicalStatus: effectiveStatus,
          approvedQuoteSnapshot: approvedSnapshot,
          statusHistory,
        },
        userCleanNotes,
      )

      const baseInsertPayload = {
        organization_id: organizationId,
        order_number: orderNumber,
        priority: params.priority,
        customer_id: params.customerId || null,
        customer_name: params.customerName.trim(),
        customer_phone: params.customerPhone?.trim() || null,
        customer_document: params.customerDocument?.trim() || null,
        equipment_name: params.equipmentName.trim(),
        equipment_brand: params.equipmentBrand?.trim() || null,
        equipment_model: params.equipmentModel?.trim() || null,
        serial_number: params.serialNumber?.trim() || null,
        equipment_color: params.equipmentColor?.trim() || null,
        accessories: params.accessories?.trim() || null,
        device_password: params.devicePassword?.trim() || null,
        damage_notes: params.damageNotes?.trim() || null,
        damage_checklist: params.damageChecklist,
        photos: params.photos,
        reported_problem: params.reportedProblem.trim(),
        technical_diagnosis: params.technicalDiagnosis?.trim() || null,
        solution_applied: params.solutionApplied?.trim() || null,
        technician_name: params.technicianName?.trim() || null,
        estimated_delivery_date: params.estimatedDeliveryDate || null,
        warranty_days: params.warrantyDays ?? 90,
        warranty_terms: params.warrantyTerms?.trim() || null,
        internal_notes: encodedInternalNotes,
        products_subtotal: productsSubtotal,
        services_subtotal: servicesSubtotal,
        subtotal,
        discount,
        total,
        created_by: params.createdBy || null,
        creator_name: params.creatorName || null,
        closed_at: effectiveStatus === 'closed' ? nowIso : null,
      }

      let { data: insertedOrder, error: insertError } = await supabase
        .from('service_orders')
        .insert({
          ...baseInsertPayload,
          status: toDbStatus(effectiveStatus, false),
          quote_id: params.quoteId || null,
          quote_number: resolvedQuoteNumber,
          quote_version: resolvedQuoteVersion,
          approved_quote_snapshot: approvedSnapshot,
          status_history: statusHistory,
        })
        .select('*')
        .single()

      if (insertError) {
        const fallbackInsert = await supabase
          .from('service_orders')
          .insert({
            ...baseInsertPayload,
            status: toDbStatus(effectiveStatus, true),
          })
          .select('*')
          .single()
        insertedOrder = fallbackInsert.data
        insertError = fallbackInsert.error
      }

      if (insertError || !insertedOrder) {
        logger.error('Erro ao criar Ordem de Serviço no Supabase', insertError)
        if (insertError?.code === '23505') {
          return {
            success: false,
            error: 'Já existe uma Ordem de Serviço gerada para este orçamento ou número de O.S.',
          }
        }
        return { success: false, error: 'Não foi possível salvar a Ordem de Serviço no Supabase.' }
      }

      const orderRow = insertedOrder as ServiceOrderRow
      let insertedItemRows: ServiceOrderItemRow[] = []

      if (computedItems.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('service_order_items')
          .insert(
            computedItems.map((it) => ({
              organization_id: organizationId,
              service_order_id: orderRow.id,
              item_type: it.itemType,
              inventory_item_id: it.inventoryItemId || null,
              service_id: it.serviceId || null,
              description: it.description,
              unit: it.unit,
              quantity: it.quantity,
              unit_price: it.unitPrice,
              total: it.total,
            })),
          )
          .select('*')

        if (itemsError) {
          logger.error('Erro ao salvar itens da Ordem de Serviço no Supabase', itemsError)
          return { success: false, error: 'Não foi possível salvar os itens da Ordem de Serviço.' }
        }
        insertedItemRows = (itemsData as ServiceOrderItemRow[]) ?? []
      }

      // Atualiza vínculo no orçamento de origem e aplica sincronização caso tenha havido alteração comercial
      if (params.quoteId) {
        if (initialCommercialComparison?.hasCommercialChange) {
          const syncRes = await quoteService.syncCommercialChangesFromServiceOrder(
            organizationId,
            params.quoteId,
            {
              serviceOrderId: orderRow.id,
              serviceOrderNumber: orderRow.order_number,
              discount,
              items: mapServiceOrderItemsToQuoteItems(computedItems),
              changes: initialCommercialComparison.changes,
              actorName: params.creatorName || params.technicianName || 'Técnico',
            },
          )
          if (!syncRes.success) {
            return { success: false, error: syncRes.error }
          }
          resolvedQuoteVersion = syncRes.data.newVersion
        } else {
          await supabase
            .from('quotes')
            .update({
              service_order_id: orderRow.id,
              service_order_number: orderRow.order_number,
            } as any)
            .eq('organization_id', organizationId)
            .eq('id', params.quoteId)
            .then(() => {})

          await supabase
            .from('quote_service_order_history' as any)
            .insert({
              organization_id: organizationId,
              quote_id: params.quoteId,
              service_order_id: orderRow.id,
              event_type: 'os_created_from_quote',
              quote_version: resolvedQuoteVersion,
              previous_quote_status: 'approved',
              new_quote_status: 'approved',
              new_os_status: 'approved',
              previous_total: total,
              new_total: total,
              description: statusHistory[0]?.description || `O.S. #${orderRow.order_number} gerada a partir do orçamento aprovado.`,
              actor_name: params.creatorName || 'Técnico / Operador',
            })
            .then(() => {})
        }
      }

      return { success: true, data: mapRowToDetail(orderRow, insertedItemRows) }
    } catch (err) {
      logger.error('Erro ao criar Ordem de Serviço', err)
      return { success: false, error: 'Erro inesperado ao salvar Ordem de Serviço.' }
    }
  },

  async update(
    organizationId: UUID,
    id: UUID,
    params: SaveServiceOrderParams,
  ): Promise<ServiceResult<ServiceOrderDetail>> {
    try {
      if (!params.customerName.trim()) {
        return { success: false, error: 'Informe o nome do cliente.' }
      }
      if (!params.equipmentName.trim()) {
        return { success: false, error: 'Informe o nome/descrição do equipamento.' }
      }
      if (!params.reportedProblem.trim()) {
        return { success: false, error: 'Informe o problema/defeito relatado.' }
      }

      const existingOrderRes = await this.getById(organizationId, id)
      if (!existingOrderRes.success) {
        return { success: false, error: existingOrderRes.error }
      }
      const existingOrder = existingOrderRes.data

      const computedItems: ServiceOrderItem[] = params.items.map((it) => ({
        id: it.id || crypto.randomUUID(),
        itemType: it.itemType,
        inventoryItemId: it.inventoryItemId || null,
        serviceId: it.serviceId || null,
        description: it.description.trim(),
        unit: it.unit || 'UN',
        quantity: String(Number(it.quantity.replace(',', '.'))),
        unitPrice: Number(it.unitPrice.replace(',', '.') || 0).toFixed(2),
        total: calculateItemTotal(
          String(Number(it.quantity.replace(',', '.'))),
          Number(it.unitPrice.replace(',', '.') || 0).toFixed(2),
        ),
      }))

      const productsSubtotal = calculateSubtotal(
        computedItems.filter((i) => i.itemType === 'product').map((i) => i.total),
      )
      const servicesSubtotal = calculateSubtotal(
        computedItems.filter((i) => i.itemType === 'service').map((i) => i.total),
      )
      const subtotal = calculateSubtotal(computedItems.map((i) => i.total))
      const discount = Number((params.discount || '0').replace(',', '.')).toFixed(2)
      const total = calculateTotal(subtotal, discount)
      const nowIso = new Date().toISOString()

      const effectiveQuoteId = params.quoteId ?? existingOrder.quoteId
      let effectiveQuoteNumber = params.quoteNumber ?? existingOrder.quoteNumber
      let effectiveQuoteVersion = existingOrder.quoteVersion || 1
      let effectiveStatus: ServiceOrderStatus = params.status
      let approvedSnapshot: CommercialScopeSnapshot | null = existingOrder.approvedQuoteSnapshot
      const updatedHistory: QuoteOsHistoryEntry[] = [...(existingOrder.statusHistory || [])]

      // Fluxos 2, 3 e 4: Verificação de alterações comerciais e controle de status quando vinculada a um Orçamento
      if (effectiveQuoteId) {
        const quoteRes = await quoteService.getQuote(organizationId, effectiveQuoteId)
        if (quoteRes.success) {
          const linkedQuote = quoteRes.data
          effectiveQuoteNumber = linkedQuote.quoteNumber
          effectiveQuoteVersion = linkedQuote.version || effectiveQuoteVersion

          // Se o orçamento no banco já foi aprovado em uma versão mais recente e a O.S. ainda estava em pending_approval, sincroniza snapshot
          if (
            linkedQuote.status === 'approved' &&
            (!approvedSnapshot || (linkedQuote.version || 1) >= (approvedSnapshot.version || 1))
          ) {
            approvedSnapshot = buildApprovedQuoteSnapshot({
              version: linkedQuote.version || 1,
              subtotal: linkedQuote.subtotal,
              discount: linkedQuote.discount,
              total: linkedQuote.total,
              approvedBy: linkedQuote.approvedBy,
              approvedAt: linkedQuote.approvedAt,
              items: linkedQuote.items.map((it) => ({
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
          }

          // Baseline para comparação: itens atuais do orçamento vinculado
          const currentQuoteBaseline = {
            items: linkedQuote.items.map((it) => ({
              id: it.id,
              itemType: (it.itemType || (it.serviceId ? 'service' : 'product')) as 'product' | 'service',
              inventoryItemId: it.inventoryItemId,
              serviceId: it.serviceId,
              description: it.description,
              unit: it.unit || 'UN',
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              total: it.total,
            })),
            discount: linkedQuote.discount,
            total: linkedQuote.total,
          }

          const comparisonWithQuote = compareCommercialScope(currentQuoteBaseline, {
            items: computedItems,
            discount,
            total,
          })

          if (comparisonWithQuote.hasCommercialChange) {
            // Fluxo 2: Houve adição/alteração comercial na O.S.!
            // 1. Atualiza o orçamento original com os novos itens/valores e retorna para ENVIADO ('sent')
            const syncRes = await quoteService.syncCommercialChangesFromServiceOrder(
              organizationId,
              effectiveQuoteId,
              {
                serviceOrderId: id,
                serviceOrderNumber: existingOrder.orderNumber,
                discount,
                items: mapServiceOrderItemsToQuoteItems(computedItems),
                changes: comparisonWithQuote.changes,
                actorName: params.technicianName || params.creatorName || 'Técnico / Operador',
              },
            )

            if (!syncRes.success) {
              return { success: false, error: syncRes.error }
            }

            effectiveQuoteVersion = syncRes.data.newVersion
            // 2. A O.S. muda obrigatoriamente para PENDENTE DE APROVAÇÃO, ficando bloqueada para finalização
            effectiveStatus = 'pending_approval'
            updatedHistory.push(syncRes.data.historyEntry)
          } else {
            // Não houve nova alteração nos itens em relação ao orçamento atual.
            // Verifica se o orçamento vinculado ainda está aguardando aprovação do cliente ('sent', 'draft', 'rejected')
            if (linkedQuote.status !== 'approved' && linkedQuote.status !== 'completed') {
              if (params.status === 'ready' || params.status === 'closed') {
                return {
                  success: false,
                  error:
                    'Não é possível finalizar a Ordem de Serviço enquanto existir uma alteração comercial aguardando aprovação do cliente no orçamento vinculado.',
                }
              }
              effectiveStatus = 'pending_approval'
            } else if (existingOrder.status === 'pending_approval' && linkedQuote.status === 'approved') {
              // Caso o orçamento já tenha sido aprovado e o usuário esteja salvando a O.S.
              effectiveStatus = params.status === 'pending_approval' ? 'approved' : params.status
            }
          }
        }
      } else if (existingOrder.status === 'pending_approval' && (params.status === 'ready' || params.status === 'closed')) {
        return {
          success: false,
          error:
            'Não é possível finalizar uma Ordem de Serviço que está Pendente de Aprovação do cliente.',
        }
      }

      // Se a O.S. está sendo finalizada ('ready'), garante solução preenchida
      let effectiveSolution = params.solutionApplied?.trim() || null
      if (effectiveStatus === 'ready' && !effectiveSolution) {
        if (effectiveQuoteId) {
          effectiveSolution = 'Serviço executado conforme orçamento aprovado.'
        } else {
          return {
            success: false,
            error: 'Para fechar a O.S. e marcar como Finalizada, é necessário adicionar a solução do problema.',
          }
        }
      }

      if (effectiveStatus === 'ready' && existingOrder.status !== 'ready') {
        updatedHistory.push({
          id: crypto.randomUUID(),
          timestamp: nowIso,
          eventType: 'os_finalized',
          quoteVersion: effectiveQuoteVersion,
          previousOsStatus: existingOrder.status,
          newOsStatus: 'ready',
          newTotal: total,
          actorName: params.technicianName || params.creatorName || 'Técnico / Operador',
          description: `Ordem de Serviço #${existingOrder.orderNumber} finalizada (${formatCurrency(total)}) e liberada para envio à venda.`,
        })
      }

      const userCleanNotes = (params.pendingReason ?? params.internalNotes)?.trim() || null
      const encodedInternalNotes = encodeOsInternalNotes(
        {
          quoteId: effectiveQuoteId || null,
          quoteNumber: effectiveQuoteNumber || null,
          quoteVersion: effectiveQuoteVersion,
          logicalStatus: effectiveStatus,
          approvedQuoteSnapshot: approvedSnapshot,
          statusHistory: updatedHistory,
        },
        userCleanNotes,
      )

      const baseUpdatePayload = {
        priority: params.priority,
        customer_id: params.customerId || null,
        customer_name: params.customerName.trim(),
        customer_phone: params.customerPhone?.trim() || null,
        customer_document: params.customerDocument?.trim() || null,
        equipment_name: params.equipmentName.trim(),
        equipment_brand: params.equipmentBrand?.trim() || null,
        equipment_model: params.equipmentModel?.trim() || null,
        serial_number: params.serialNumber?.trim() || null,
        equipment_color: params.equipmentColor?.trim() || null,
        accessories: params.accessories?.trim() || null,
        device_password: params.devicePassword?.trim() || null,
        damage_notes: params.damageNotes?.trim() || null,
        damage_checklist: params.damageChecklist,
        photos: params.photos,
        reported_problem: params.reportedProblem.trim(),
        technical_diagnosis: params.technicalDiagnosis?.trim() || null,
        solution_applied: effectiveSolution,
        technician_name: params.technicianName?.trim() || null,
        estimated_delivery_date: params.estimatedDeliveryDate || null,
        warranty_days: params.warrantyDays ?? 90,
        warranty_terms: params.warrantyTerms?.trim() || null,
        internal_notes: encodedInternalNotes,
        products_subtotal: productsSubtotal,
        services_subtotal: servicesSubtotal,
        subtotal,
        discount,
        total,
        closed_at: effectiveStatus === 'closed' ? nowIso : null,
        updated_at: nowIso,
      }

      let { data: updatedOrder, error: updateError } = await supabase
        .from('service_orders')
        .update({
          ...baseUpdatePayload,
          status: toDbStatus(effectiveStatus, false),
          quote_id: effectiveQuoteId || null,
          quote_number: effectiveQuoteNumber || null,
          quote_version: effectiveQuoteVersion,
          approved_quote_snapshot: approvedSnapshot,
          status_history: updatedHistory,
        })
        .eq('organization_id', organizationId)
        .eq('id', id)
        .select('*')
        .single()

      if (updateError) {
        const fallbackUpdate = await supabase
          .from('service_orders')
          .update({
            ...baseUpdatePayload,
            status: toDbStatus(effectiveStatus, true),
          })
          .eq('organization_id', organizationId)
          .eq('id', id)
          .select('*')
          .single()
        updatedOrder = fallbackUpdate.data
        updateError = fallbackUpdate.error
      }

      if (updateError || !updatedOrder) {
        logger.error('Erro ao atualizar Ordem de Serviço no Supabase', updateError)
        return {
          success: false,
          error: updateError?.message || 'Não foi possível atualizar a Ordem de Serviço no Supabase.',
        }
      }

      const orderRow = updatedOrder as ServiceOrderRow

      await supabase
        .from('service_order_items')
        .delete()
        .eq('organization_id', organizationId)
        .eq('service_order_id', id)

      let insertedItemRows: ServiceOrderItemRow[] = []
      if (computedItems.length > 0) {
        const { data: itemsData } = await supabase
          .from('service_order_items')
          .insert(
            computedItems.map((it) => ({
              organization_id: organizationId,
              service_order_id: id,
              item_type: it.itemType,
              inventory_item_id: it.inventoryItemId || null,
              service_id: it.serviceId || null,
              description: it.description,
              unit: it.unit,
              quantity: it.quantity,
              unit_price: it.unitPrice,
              total: it.total,
            })),
          )
          .select('*')

        insertedItemRows = (itemsData as ServiceOrderItemRow[]) ?? []
      }

      return { success: true, data: mapRowToDetail(orderRow, insertedItemRows) }
    } catch (err) {
      logger.error('Erro ao atualizar Ordem de Serviço', err)
      return { success: false, error: 'Erro inesperado ao atualizar Ordem de Serviço.' }
    }
  },

  async updateStatus(
    organizationId: UUID,
    id: UUID,
    status: ServiceOrderStatus,
    pendingReason?: string | null,
    solutionApplied?: string | null,
  ): Promise<ServiceResult<void>> {
    try {
      const orderResult = await this.getById(organizationId, id)
      if (!orderResult.success) {
        return { success: false, error: orderResult.error }
      }
      const order = orderResult.data

      // Regra de bloqueio: Não permite finalizar ('ready') ou encerrar O.S. com aprovação comercial pendente
      if (status === 'ready' || status === 'closed') {
        if (order.status === 'pending_approval') {
          return {
            success: false,
            error:
              'A Ordem de Serviço está PENDENTE DE APROVAÇÃO do cliente. Aguarde a aprovação da nova versão do orçamento antes de finalizar a O.S.',
          }
        }

        if (order.quoteId) {
          const quoteRes = await quoteService.getQuote(organizationId, order.quoteId)
          if (quoteRes.success) {
            const quote = quoteRes.data
            const comparison = compareCommercialScope(
              {
                items: quote.items.map((it) => ({
                  itemType: (it.itemType || (it.serviceId ? 'service' : 'product')) as 'product' | 'service',
                  inventoryItemId: it.inventoryItemId,
                  serviceId: it.serviceId,
                  description: it.description,
                  unit: it.unit || 'UN',
                  quantity: it.quantity,
                  unitPrice: it.unitPrice,
                  total: it.total,
                })),
                discount: quote.discount,
                total: quote.total,
              },
              {
                items: order.items,
                discount: order.discount,
                total: order.total,
              },
            )

            const finalizeValidation = canFinalizeServiceOrder({
              osStatus: order.status,
              quoteId: order.quoteId,
              quoteStatus: quote.status,
              hasUnapprovedCommercialChanges: comparison.hasCommercialChange,
            })

            if (!finalizeValidation.allowed) {
              return {
                success: false,
                error:
                  finalizeValidation.reason ||
                  'Não é possível finalizar a O.S. enquanto houver pendência de aprovação do orçamento.',
              }
            }
          }
        }
      }

      let effectiveSolution =
        (solutionApplied !== undefined && solutionApplied !== null
          ? solutionApplied
          : order.solutionApplied)?.trim() || ''

      if (status === 'ready' && !effectiveSolution) {
        if (order.quoteId) {
          effectiveSolution = 'Serviço executado conforme orçamento aprovado.'
        } else {
          return {
            success: false,
            error: 'Para fechar a O.S. é necessário adicionar a solução do problema.',
          }
        }
      }

      const nowIso = new Date().toISOString()
      const updatedHistory = [...(order.statusHistory || [])]
      if (status === 'ready' && order.status !== 'ready') {
        updatedHistory.push({
          id: crypto.randomUUID(),
          timestamp: nowIso,
          eventType: 'os_finalized',
          quoteVersion: order.quoteVersion || 1,
          previousOsStatus: order.status,
          newOsStatus: 'ready',
          newTotal: order.total,
          description: `Ordem de Serviço #${order.orderNumber} finalizada e pronta para envio à venda.`,
        })
      }

      const nextUserNotes =
        pendingReason !== undefined ? pendingReason?.trim() || null : order.internalNotes

      const encodedInternalNotes = encodeOsInternalNotes(
        {
          quoteId: order.quoteId,
          quoteNumber: order.quoteNumber,
          quoteVersion: order.quoteVersion,
          logicalStatus: status,
          approvedQuoteSnapshot: order.approvedQuoteSnapshot,
          statusHistory: updatedHistory,
        },
        nextUserNotes,
      )

      const updatePayload: Record<string, unknown> = {
        status: toDbStatus(status, false),
        closed_at: status === 'closed' ? nowIso : null,
        internal_notes: encodedInternalNotes,
        status_history: updatedHistory,
        updated_at: nowIso,
      }
      if (effectiveSolution) {
        updatePayload.solution_applied = effectiveSolution
      }

      let { error } = await supabase
        .from('service_orders')
        .update(updatePayload)
        .eq('organization_id', organizationId)
        .eq('id', id)

      if (error) {
        const fallbackPayload: Record<string, unknown> = {
          status: toDbStatus(status, true),
          closed_at: status === 'closed' ? nowIso : null,
          internal_notes: encodedInternalNotes,
          updated_at: nowIso,
        }
        if (effectiveSolution) {
          fallbackPayload.solution_applied = effectiveSolution
        }
        const fallback = await supabase
          .from('service_orders')
          .update(fallbackPayload)
          .eq('organization_id', organizationId)
          .eq('id', id)
        error = fallback.error
      }

      if (error) {
        logger.error('Erro ao alterar status da O.S. no Supabase', error)
        return { success: false, error: error.message || 'Erro ao alterar status da O.S.' }
      }

      return { success: true, data: undefined }
    } catch {
      return { success: false, error: 'Erro ao atualizar status da Ordem de Serviço.' }
    }
  },

  async markClosedWithSale(
    organizationId: UUID,
    id: UUID,
    saleId: string,
    saleNumber?: string,
  ): Promise<ServiceResult<void>> {
    try {
      const orderResult = await this.getById(organizationId, id)
      const existingOrder = orderResult.success ? orderResult.data : null
      const nowIso = new Date().toISOString()

      const updatedHistory: QuoteOsHistoryEntry[] = [
        ...(existingOrder?.statusHistory || []),
        {
          id: crypto.randomUUID(),
          timestamp: nowIso,
          eventType: 'sent_to_sale',
          quoteVersion: existingOrder?.quoteVersion || 1,
          previousOsStatus: existingOrder?.status ?? 'ready',
          newOsStatus: 'closed',
          newTotal: existingOrder?.total ?? null,
          description: `O.S. enviada para venda e faturada (${saleNumber || saleId}).`,
        },
      ]

      const encodedInternalNotes = existingOrder
        ? encodeOsInternalNotes(
            {
              quoteId: existingOrder.quoteId,
              quoteNumber: existingOrder.quoteNumber,
              quoteVersion: existingOrder.quoteVersion,
              logicalStatus: 'closed',
              approvedQuoteSnapshot: existingOrder.approvedQuoteSnapshot,
              statusHistory: updatedHistory,
            },
            existingOrder.internalNotes,
          )
        : undefined

      const updatePayload: Record<string, unknown> = {
        status: 'closed',
        sale_id: saleId,
        sale_number: saleNumber || null,
        closed_at: nowIso,
        updated_at: nowIso,
      }
      if (encodedInternalNotes !== undefined) {
        updatePayload.internal_notes = encodedInternalNotes
      }

      const { error } = await supabase
        .from('service_orders')
        .update(updatePayload)
        .eq('organization_id', organizationId)
        .eq('id', id)

      if (error) {
        logger.error('Erro ao vincular venda à Ordem de Serviço no Supabase', error)
        return { success: false, error: 'Erro ao vincular venda à Ordem de Serviço.' }
      }
      return { success: true, data: undefined }
    } catch {
      return { success: false, error: 'Erro ao vincular venda à Ordem de Serviço.' }
    }
  },

  async delete(organizationId: UUID, id: UUID): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('service_orders')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', id)

      if (error) {
        logger.error('Erro ao excluir Ordem de Serviço no Supabase', error)
        return { success: false, error: 'Erro ao excluir Ordem de Serviço.' }
      }
      return { success: true, data: undefined }
    } catch {
      return { success: false, error: 'Erro ao excluir Ordem de Serviço.' }
    }
  },

  async listEquipmentCatalog(organizationId: UUID): Promise<ServiceResult<string[]>> {
    try {
      const { data, error } = await supabase
        .from('service_order_equipment_catalog' as any)
        .select('name')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true })

      if (error) {
        logger.error('Erro ao carregar catálogo de equipamentos', error)
        return { success: false, error: 'Não foi possível carregar o catálogo de equipamentos.' }
      }

      return {
        success: true,
        data: (data ?? []).map((row: { name: string }) => row.name),
      }
    } catch (error) {
      logger.error('Exceção ao carregar catálogo de equipamentos', error)
      return { success: false, error: 'Não foi possível carregar o catálogo de equipamentos.' }
    }
  },

  async addEquipmentToCatalog(
    organizationId: UUID,
    equipmentName: string,
  ): Promise<ServiceResult<string[]>> {
    const clean = equipmentName.trim()
    if (!clean) {
      return { success: false, error: 'Informe o nome do equipamento / aparelho.' }
    }

    try {
      const normalizedName = clean.toLocaleLowerCase('pt-BR')
      const { data: existing, error: lookupError } = await supabase
        .from('service_order_equipment_catalog' as any)
        .select('id')
        .eq('organization_id', organizationId)
        .eq('normalized_name', normalizedName)
        .maybeSingle()

      if (lookupError) {
        logger.error('Erro ao verificar catálogo de equipamentos', lookupError)
        return { success: false, error: 'Não foi possível verificar o catálogo de equipamentos.' }
      }

      if (!existing) {
        const { error: insertError } = await supabase
          .from('service_order_equipment_catalog' as any)
          .insert({ organization_id: organizationId, name: clean })

        if (insertError) {
          logger.error('Erro ao cadastrar equipamento no Supabase', insertError)
          return { success: false, error: 'Não foi possível cadastrar o equipamento no Supabase.' }
        }
      }

      return await this.listEquipmentCatalog(organizationId)
    } catch (error) {
      logger.error('Exceção ao cadastrar equipamento no catálogo', error)
      return { success: false, error: 'Não foi possível cadastrar o equipamento no Supabase.' }
    }
  },

  async removeEquipmentFromCatalog(
    organizationId: UUID,
    equipmentName: string,
  ): Promise<ServiceResult<string[]>> {
    const normalizedName = equipmentName.trim().toLocaleLowerCase('pt-BR')
    try {
      const { error } = await supabase
        .from('service_order_equipment_catalog' as any)
        .delete()
        .eq('organization_id', organizationId)
        .eq('normalized_name', normalizedName)

      if (error) {
        logger.error('Erro ao remover equipamento do catálogo', error)
        return { success: false, error: 'Não foi possível remover o equipamento do catálogo.' }
      }

      return await this.listEquipmentCatalog(organizationId)
    } catch (error) {
      logger.error('Exceção ao remover equipamento do catálogo', error)
      return { success: false, error: 'Não foi possível remover o equipamento do catálogo.' }
    }
  },
}
