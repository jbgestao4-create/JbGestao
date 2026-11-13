import type {
  ServiceOrderDetail,
  ServiceOrderItem,
  ServiceOrderListItem,
  ServiceOrderPhoto,
  ServiceOrderPriority,
  ServiceOrderStatus,
} from '../domain/service-order'
import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UUID } from '@shared/types/common'
import {
  calculateItemTotal,
  calculateSubtotal,
  calculateTotal,
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

function normalizeStatus(raw: string): ServiceOrderStatus {
  if (raw === 'queue' || raw === 'waiting_parts') {
    return 'queue'
  }
  if (raw === 'in_maintenance' || raw === 'ready' || raw === 'closed') {
    return raw
  }
  return 'pending'
}

function toDbStatus(status: ServiceOrderStatus): string {
  return status === 'queue' ? 'waiting_parts' : status
}

function mapRowToListItem(row: ServiceOrderRow): ServiceOrderListItem {
  const photos = parsePhotos(row.photos)
  const checklist = parseChecklist(row.damage_checklist)
  const hasDamage =
    Boolean(row.damage_notes?.trim()) ||
    checklist.some(
      (c) => c !== 'Sem Avarias identificadas' && c !== 'Sem avarias externas aparentes',
    )

  return {
    id: row.id,
    organizationId: row.organization_id,
    orderNumber: row.order_number,
    status: normalizeStatus(row.status),
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
    pendingReason: row.internal_notes,
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
    saleId: row.sale_id,
    saleNumber: row.sale_number,
    creatorName: row.creator_name,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapRowToDetail(row: ServiceOrderRow, itemRows: ServiceOrderItemRow[]): ServiceOrderDetail {
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

  return {
    id: row.id,
    organizationId: row.organization_id,
    orderNumber: row.order_number,
    status: normalizeStatus(row.status),
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
    internalNotes: row.internal_notes,
    pendingReason: row.internal_notes,
    productsSubtotal: String(Number(row.products_subtotal ?? 0).toFixed(2)),
    servicesSubtotal: String(Number(row.services_subtotal ?? 0).toFixed(2)),
    subtotal: String(Number(row.subtotal ?? 0).toFixed(2)),
    discount: String(Number(row.discount ?? 0).toFixed(2)),
    total: String(Number(row.total ?? 0).toFixed(2)),
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
      const { data, error } = await supabase
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

      const orderNumber = params.orderNumber?.trim() || (await this.getNextOrderNumber(organizationId))

      const computedItems: ServiceOrderItem[] = params.items.map((it) => ({
        id: it.id || crypto.randomUUID(),
        itemType: it.itemType,
        inventoryItemId: it.inventoryItemId || null,
        serviceId: it.serviceId || null,
        description: it.description.trim(),
        unit: it.unit || 'UN',
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice || 0).toFixed(2),
        total: calculateItemTotal(it.quantity, it.unitPrice),
      }))

      const productsSubtotal = calculateSubtotal(
        computedItems.filter((i) => i.itemType === 'product').map((i) => i.total),
      )
      const servicesSubtotal = calculateSubtotal(
        computedItems.filter((i) => i.itemType === 'service').map((i) => i.total),
      )
      const subtotal = calculateSubtotal(computedItems.map((i) => i.total))
      const discount = Number(params.discount || 0).toFixed(2)
      const total = calculateTotal(subtotal, discount)
      const nowIso = new Date().toISOString()

      const { data: insertedOrder, error: insertError } = await supabase
        .from('service_orders')
        .insert({
          organization_id: organizationId,
          order_number: orderNumber,
          status: toDbStatus(params.status),
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
          internal_notes: (params.pendingReason ?? params.internalNotes)?.trim() || null,
          products_subtotal: productsSubtotal,
          services_subtotal: servicesSubtotal,
          subtotal,
          discount,
          total,
          created_by: params.createdBy || null,
          creator_name: params.creatorName || null,
          closed_at: params.status === 'closed' ? nowIso : null,
        })
        .select('*')
        .single()

      if (insertError || !insertedOrder) {
        logger.error('Erro ao criar Ordem de Serviço no Supabase', insertError)
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

      const computedItems: ServiceOrderItem[] = params.items.map((it) => ({
        id: it.id || crypto.randomUUID(),
        itemType: it.itemType,
        inventoryItemId: it.inventoryItemId || null,
        serviceId: it.serviceId || null,
        description: it.description.trim(),
        unit: it.unit || 'UN',
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice || 0).toFixed(2),
        total: calculateItemTotal(it.quantity, it.unitPrice),
      }))

      const productsSubtotal = calculateSubtotal(
        computedItems.filter((i) => i.itemType === 'product').map((i) => i.total),
      )
      const servicesSubtotal = calculateSubtotal(
        computedItems.filter((i) => i.itemType === 'service').map((i) => i.total),
      )
      const subtotal = calculateSubtotal(computedItems.map((i) => i.total))
      const discount = Number(params.discount || 0).toFixed(2)
      const total = calculateTotal(subtotal, discount)
      const nowIso = new Date().toISOString()

      const { data: updatedOrder, error: updateError } = await supabase
        .from('service_orders')
        .update({
          status: toDbStatus(params.status),
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
          internal_notes: (params.pendingReason ?? params.internalNotes)?.trim() || null,
          products_subtotal: productsSubtotal,
          services_subtotal: servicesSubtotal,
          subtotal,
          discount,
          total,
          closed_at: params.status === 'closed' ? nowIso : null,
          updated_at: nowIso,
        })
        .eq('organization_id', organizationId)
        .eq('id', id)
        .select('*')
        .single()

      if (!updateError && updatedOrder) {
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
      }

      if (updateError || !updatedOrder) {
        logger.error('Erro ao atualizar Ordem de Serviço no Supabase', updateError)
        return {
          success: false,
          error: updateError?.message || 'Não foi possível atualizar a Ordem de Serviço no Supabase.',
        }
      }

      const { data: updatedItems, error: itemsError } = await supabase
        .from('service_order_items')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('service_order_id', id)
        .order('created_at', { ascending: true })

      if (itemsError) {
        logger.error('Erro ao consultar itens da Ordem de Serviço', itemsError)
        return { success: false, error: 'Erro ao carregar os itens da Ordem de Serviço.' }
      }

      return {
        success: true,
        data: mapRowToDetail(
          updatedOrder as ServiceOrderRow,
          (updatedItems as ServiceOrderItemRow[]) ?? [],
        ),
      }
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
      if (status === 'ready') {
        const orderResult = await this.getById(organizationId, id)
        if (!orderResult.success) {
          return { success: false, error: orderResult.error }
        }
        const effectiveSolution =
          (solutionApplied !== undefined && solutionApplied !== null
            ? solutionApplied
            : orderResult.data.solutionApplied)?.trim() || ''

        if (!effectiveSolution) {
          return {
            success: false,
            error: 'Para fechar a O.S. é necessário adicionar a solução do problema.',
          }
        }
      }
      const nowIso = new Date().toISOString()
      const updatePayload: Record<string, unknown> = {
        status: toDbStatus(status),
        closed_at: status === 'closed' ? nowIso : null,
        updated_at: nowIso,
      }
      if (pendingReason !== undefined) {
        updatePayload.internal_notes = pendingReason?.trim() || null
      }
      if (solutionApplied !== undefined && solutionApplied !== null) {
        updatePayload.solution_applied = solutionApplied.trim() || null
      }

      const { error } = await supabase
        .from('service_orders')
        .update(updatePayload)
        .eq('organization_id', organizationId)
        .eq('id', id)

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
      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from('service_orders')
        .update({
          status: 'closed',
          sale_id: saleId,
          sale_number: saleNumber || null,
          closed_at: nowIso,
          updated_at: nowIso,
        })
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
          return { success: false, error: 'Não foi possível cadastrar o equipamento.' }
        }
      }

      return this.listEquipmentCatalog(organizationId)
    } catch (error) {
      logger.error('Exceção ao cadastrar equipamento no Supabase', error)
      return { success: false, error: 'Não foi possível cadastrar o equipamento.' }
    }
  },

  async removeEquipmentFromCatalog(
    organizationId: UUID,
    equipmentName: string,
  ): Promise<ServiceResult<string[]>> {
    try {
      const { error } = await supabase
        .from('service_order_equipment_catalog' as any)
        .delete()
        .eq('organization_id', organizationId)
        .eq('normalized_name', equipmentName.trim().toLocaleLowerCase('pt-BR'))

      if (error) {
        logger.error('Erro ao remover equipamento do catálogo', error)
        return { success: false, error: 'Não foi possível remover o equipamento do catálogo.' }
      }

      return this.listEquipmentCatalog(organizationId)
    } catch (error) {
      logger.error('Exceção ao remover equipamento do catálogo', error)
      return { success: false, error: 'Não foi possível remover o equipamento do catálogo.' }
    }
  },
}
