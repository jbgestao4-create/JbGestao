import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type {
  InventoryItem,
  InventoryMovement,
  InventoryItemSupplier,
  ServiceResult,
  UUID,
} from '@shared/types/common'
import { getInventoryUniqueConstraintError } from '../domain/product-identification'

interface InventorySupplierRow {
  id: string
  supplier_id: string
  supplier_product_code: string | null
  purchase_price: string
  lead_time_days: number | null
  notes: string | null
  suppliers: { name: string } | { name: string }[] | null
}

interface InventoryItemRow {
  id: string
  organization_id: string
  supplier_id: string | null
  name: string
  unit: string
  quantity_on_hand: string
  minimum_quantity: string
  unit_price: string
  sku: string | null
  barcode: string | null
  description: string | null
  category: string | null
  subcategory: string | null
  brand: string | null
  manufacturer: string | null
  model: string | null
  manufacturer_reference: string | null
  attributes: Record<string, string> | null
  purchase_price: string
  last_purchase_price: string
  average_cost: string
  extra_purchase_cost: string
  supplier_product_code: string | null
  lead_time_days: number | null
  last_purchase_at: string | null
  promotional_price: string | null
  target_margin_percent: string | null
  minimum_sale_price: string | null
  maximum_quantity: string
  ideal_restock_quantity: string
  location: string | null
  warehouse: string | null
  allow_negative_stock: boolean
  track_expiry: boolean
  track_lot: boolean
  track_serial_number: boolean
  fiscal_ncm: string | null
  fiscal_cest: string | null
  fiscal_origin: string | null
  commercial_unit: string | null
  fiscal_product_code: string | null
  gtin: string | null
  is_active: boolean
  can_sell: boolean
  can_purchase: boolean
  notes: string | null
  parent_item_id: string | null
  purchase_unit: string | null
  purchase_unit_factor: string
  image_path: string | null
  created_at: string
  updated_at: string
  suppliers?: { name: string } | { name: string }[] | null
  inventory_item_suppliers?: InventorySupplierRow[] | null
}

export interface InventoryItemParams {
  supplierId: string
  supplierIds: string[]
  name: string
  unit: string
  quantityOnHand: string
  minimumQuantity: string
  unitPrice: string
  sku: string
  barcode: string
  description: string
  category: string
  subcategory: string
  brand: string
  manufacturer: string
  model: string
  manufacturerReference: string
  purchasePrice: string
  extraPurchaseCost: string
  supplierProductCode: string
  leadTimeDays: string
  promotionalPrice: string
  targetMarginPercent: string
  minimumSalePrice: string
  maximumQuantity: string
  idealRestockQuantity: string
  location: string
  warehouse: string
  allowNegativeStock: boolean
  trackExpiry: boolean
  trackLot: boolean
  trackSerialNumber: boolean
  fiscalNcm: string
  fiscalCest: string
  fiscalOrigin: string
  commercialUnit: string
  fiscalProductCode: string
  gtin: string
  isActive: boolean
  canSell: boolean
  canPurchase: boolean
  notes: string
  purchaseUnit: string
  purchaseUnitFactor: string
  attributes: Record<string, string>
}

function mapInventoryItem(row: InventoryItemRow): InventoryItem {
  const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers
  const itemSuppliers: InventoryItemSupplier[] = (row.inventory_item_suppliers ?? []).map(
    (itemSupplier) => {
      const itemSupplierDetail = Array.isArray(itemSupplier.suppliers)
        ? itemSupplier.suppliers[0]
        : itemSupplier.suppliers
      return {
        id: itemSupplier.id,
        supplierId: itemSupplier.supplier_id,
        supplierName: itemSupplierDetail?.name ?? '',
        supplierProductCode: itemSupplier.supplier_product_code,
        purchasePrice: itemSupplier.purchase_price,
        leadTimeDays: itemSupplier.lead_time_days,
        notes: itemSupplier.notes,
      }
    },
  )
  return {
    id: row.id,
    organizationId: row.organization_id,
    supplierId: row.supplier_id,
    supplierName: supplier?.name ?? null,
    name: row.name,
    unit: row.unit,
    quantityOnHand: row.quantity_on_hand,
    minimumQuantity: row.minimum_quantity,
    unitPrice: row.unit_price,
    sku: row.sku ?? '',
    barcode: row.barcode,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory,
    brand: row.brand,
    manufacturer: row.manufacturer,
    model: row.model,
    manufacturerReference: row.manufacturer_reference,
    attributes: row.attributes ?? {},
    purchasePrice: row.purchase_price,
    lastPurchasePrice: row.last_purchase_price,
    averageCost: row.average_cost,
    extraPurchaseCost: row.extra_purchase_cost,
    supplierProductCode: row.supplier_product_code,
    leadTimeDays: row.lead_time_days,
    lastPurchaseAt: row.last_purchase_at,
    promotionalPrice: row.promotional_price,
    targetMarginPercent: row.target_margin_percent,
    minimumSalePrice: row.minimum_sale_price,
    maximumQuantity: row.maximum_quantity,
    idealRestockQuantity: row.ideal_restock_quantity,
    location: row.location,
    warehouse: row.warehouse,
    allowNegativeStock: row.allow_negative_stock,
    trackExpiry: row.track_expiry,
    trackLot: row.track_lot,
    trackSerialNumber: row.track_serial_number,
    fiscalNcm: row.fiscal_ncm,
    fiscalCest: row.fiscal_cest,
    fiscalOrigin: row.fiscal_origin,
    commercialUnit: row.commercial_unit,
    fiscalProductCode: row.fiscal_product_code,
    gtin: row.gtin,
    isActive: row.is_active,
    canSell: row.can_sell,
    canPurchase: row.can_purchase,
    notes: row.notes,
    parentItemId: row.parent_item_id,
    purchaseUnit: row.purchase_unit,
    purchaseUnitFactor: row.purchase_unit_factor,
    imagePath: row.image_path,
    suppliers: itemSuppliers,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function getInventoryError(
  error: { code?: string; message?: string } | null,
  operation: string,
): string {
  const uniqueConstraintError = getInventoryUniqueConstraintError(error?.code, error?.message)
  if (uniqueConstraintError) return uniqueConstraintError
  if (error?.code === '23503') {
    return 'Não foi possível salvar este vínculo do material. Confira se o fornecedor selecionado pertence à organização atual.'
  }
  if (error?.code === '23514') {
    return 'Algum valor informado não atende às regras do estoque. Revise quantidades, preços e unidade.'
  }
  if (error?.code === '22003') {
    return 'Um dos valores informados excede o limite aceito. Revise os números e tente novamente.'
  }
  if (error?.code === '22P02') {
    return 'Um dos valores numéricos está em formato inválido. Revise os campos de quantidade e preço.'
  }
  if (error?.code === '42501') {
    return 'Seu usuário não tem acesso ao estoque desta organização.'
  }
  if (error?.code === 'PGRST204' || error?.code === 'PGRST205' || error?.code === '42P01') {
    return 'O estoque ainda não está disponível no banco. Aplique as migrações do Supabase.'
  }
  return `Não foi possível ${operation} o material. Verifique sua conexão e tente novamente.`
}

export const inventoryService = {
  async list(organizationId: UUID): Promise<ServiceResult<InventoryItem[]>> {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*, suppliers(name), inventory_item_suppliers(*, suppliers(name))')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true })
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<InventoryItemRow[]>()

      if (error) {
        logger.error('Erro ao listar materiais do estoque', error)
        return { success: false, error: getInventoryError(error, 'consultar') }
      }

      return { success: true, data: data.map(mapInventoryItem) }
    } catch (error) {
      logger.error('Exceção ao listar materiais do estoque', error)
      return { success: false, error: 'Erro inesperado ao consultar o estoque.' }
    }
  },

  async getById(
    organizationId: UUID,
    inventoryItemId: UUID,
  ): Promise<ServiceResult<InventoryItem>> {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*, suppliers(name), inventory_item_suppliers(*, suppliers(name))')
        .eq('organization_id', organizationId)
        .eq('id', inventoryItemId)
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<InventoryItemRow[]>()
        .maybeSingle()

      if (error) {
        logger.error('Erro ao consultar material do estoque', error)
        return { success: false, error: 'Não foi possível carregar o material.' }
      }
      if (!data) return { success: false, error: 'Material não encontrado.' }
      return { success: true, data: mapInventoryItem(data) }
    } catch (error) {
      logger.error('Exceção ao consultar material do estoque', error)
      return { success: false, error: 'Erro inesperado ao consultar material.' }
    }
  },

  async create(
    organizationId: UUID,
    params: InventoryItemParams,
  ): Promise<ServiceResult<InventoryItem>> {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert({
          organization_id: organizationId,
          supplier_id: params.supplierId || null,
          name: params.name.trim(),
          unit: params.unit.trim(),
          quantity_on_hand: params.quantityOnHand,
          minimum_quantity: params.minimumQuantity,
          unit_price: params.unitPrice,
          sku: params.sku.trim(),
          barcode: params.barcode.trim() || null,
          description: params.description.trim() || null,
          category: params.category.trim() || null,
          subcategory: params.subcategory.trim() || null,
          brand: params.brand.trim() || null,
          manufacturer: params.manufacturer.trim() || null,
          model: params.model.trim() || null,
          manufacturer_reference: params.manufacturerReference.trim() || null,
          purchase_price: params.purchasePrice,
          extra_purchase_cost: params.extraPurchaseCost || '0',
          supplier_product_code: params.supplierProductCode.trim() || null,
          lead_time_days: params.leadTimeDays ? Number(params.leadTimeDays) : null,
          promotional_price: params.promotionalPrice || null,
          target_margin_percent: params.targetMarginPercent || null,
          minimum_sale_price: params.minimumSalePrice || null,
          maximum_quantity: params.maximumQuantity || '0',
          ideal_restock_quantity: params.idealRestockQuantity || '0',
          location: params.location.trim() || null,
          warehouse: params.warehouse.trim() || null,
          allow_negative_stock: params.allowNegativeStock,
          track_expiry: params.trackExpiry,
          track_lot: params.trackLot,
          track_serial_number: params.trackSerialNumber,
          fiscal_ncm: params.fiscalNcm.trim() || null,
          fiscal_cest: params.fiscalCest.trim() || null,
          fiscal_origin: params.fiscalOrigin || null,
          commercial_unit: params.commercialUnit.trim() || null,
          fiscal_product_code: params.fiscalProductCode.trim() || null,
          gtin: params.gtin.trim() || null,
          is_active: params.isActive,
          can_sell: params.canSell,
          can_purchase: params.canPurchase,
          notes: params.notes.trim() || null,
          purchase_unit: params.purchaseUnit.trim() || null,
          purchase_unit_factor: params.purchaseUnitFactor || '1',
          attributes: params.attributes,
        })
        .select('*, suppliers(name), inventory_item_suppliers(*, suppliers(name))')
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<InventoryItemRow[]>()
        .single()

      if (error) {
        logger.error('Erro ao cadastrar material no estoque', error)
        return { success: false, error: getInventoryError(error, 'cadastrar') }
      }
      const supplierResult = await this.saveSuppliers(
        organizationId,
        data.id,
        params.supplierIds,
        params,
      )
      if (!supplierResult.success) return supplierResult
      return { success: true, data: mapInventoryItem(data) }
    } catch (error) {
      logger.error('Exceção ao cadastrar material no estoque', error)
      return { success: false, error: 'Erro inesperado ao cadastrar material.' }
    }
  },

  async update(
    organizationId: UUID,
    inventoryItemId: UUID,
    params: InventoryItemParams,
  ): Promise<ServiceResult<void>> {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .update({
          supplier_id: params.supplierId || null,
          name: params.name.trim(),
          unit: params.unit.trim(),
          minimum_quantity: params.minimumQuantity,
          unit_price: params.unitPrice,
          sku: params.sku.trim(),
          barcode: params.barcode.trim() || null,
          description: params.description.trim() || null,
          category: params.category.trim() || null,
          subcategory: params.subcategory.trim() || null,
          brand: params.brand.trim() || null,
          manufacturer: params.manufacturer.trim() || null,
          model: params.model.trim() || null,
          manufacturer_reference: params.manufacturerReference.trim() || null,
          purchase_price: params.purchasePrice,
          extra_purchase_cost: params.extraPurchaseCost || '0',
          supplier_product_code: params.supplierProductCode.trim() || null,
          lead_time_days: params.leadTimeDays ? Number(params.leadTimeDays) : null,
          promotional_price: params.promotionalPrice || null,
          target_margin_percent: params.targetMarginPercent || null,
          minimum_sale_price: params.minimumSalePrice || null,
          maximum_quantity: params.maximumQuantity || '0',
          ideal_restock_quantity: params.idealRestockQuantity || '0',
          location: params.location.trim() || null,
          warehouse: params.warehouse.trim() || null,
          allow_negative_stock: params.allowNegativeStock,
          track_expiry: params.trackExpiry,
          track_lot: params.trackLot,
          track_serial_number: params.trackSerialNumber,
          fiscal_ncm: params.fiscalNcm.trim() || null,
          fiscal_cest: params.fiscalCest.trim() || null,
          fiscal_origin: params.fiscalOrigin || null,
          commercial_unit: params.commercialUnit.trim() || null,
          fiscal_product_code: params.fiscalProductCode.trim() || null,
          gtin: params.gtin.trim() || null,
          is_active: params.isActive,
          can_sell: params.canSell,
          can_purchase: params.canPurchase,
          notes: params.notes.trim() || null,
          purchase_unit: params.purchaseUnit.trim() || null,
          purchase_unit_factor: params.purchaseUnitFactor || '1',
          attributes: params.attributes,
        })
        .eq('organization_id', organizationId)
        .eq('id', inventoryItemId)
        .select('id')
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<{ id: string }[]>()
        .maybeSingle()

      if (error) {
        logger.error('Erro ao atualizar material do estoque', error)
        if (error.code === 'P0001') {
          return {
            success: false,
            error: 'A unidade não pode ser alterada enquanto o material estiver em orçamentos.',
          }
        }
        return { success: false, error: getInventoryError(error, 'atualizar') }
      }
      if (!data) {
        return {
          success: false,
          error: 'Material não encontrado ou usuário sem acesso ao estoque.',
        }
      }
      const supplierResult = await this.saveSuppliers(
        organizationId,
        inventoryItemId,
        params.supplierIds,
        params,
      )
      if (!supplierResult.success) return supplierResult
      return { success: true, data: undefined }
    } catch (error) {
      logger.error('Exceção ao atualizar material do estoque', error)
      return { success: false, error: 'Erro inesperado ao atualizar material.' }
    }
  },

  async deactivate(organizationId: UUID, inventoryItemId: UUID): Promise<ServiceResult<void>> {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .update({ is_active: false })
        .eq('organization_id', organizationId)
        .eq('id', inventoryItemId)
        .select('id')
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<{ id: string }[]>()
        .maybeSingle()

      if (error) {
        logger.error('Erro ao desativar material do estoque', error)
        return { success: false, error: getInventoryError(error, 'desativar') }
      }
      if (!data) {
        return {
          success: false,
          error: 'Material não encontrado ou usuário sem acesso ao estoque.',
        }
      }
      return { success: true, data: undefined }
    } catch (error) {
      logger.error('Exceção ao desativar material do estoque', error)
      return { success: false, error: 'Erro inesperado ao desativar material.' }
    }
  },

  async listMovements(
    organizationId: UUID,
    inventoryItemId: UUID,
  ): Promise<ServiceResult<InventoryMovement[]>> {
    try {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('inventory_item_id', inventoryItemId)
        .order('moved_at', { ascending: false })
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<
          {
            id: string
            organization_id: string
            inventory_item_id: string
            movement_type: string
            quantity: string
            balance_before: string
            balance_after: string
            unit_price: string | null
            reason: string
            document_reference: string | null
            supplier_id: string | null
            quote_id: string | null
            user_id: string | null
            moved_at: string
          }[]
        >()

      if (error) {
        logger.error('Erro ao consultar movimentações do estoque', error)
        return { success: false, error: 'Não foi possível carregar o histórico do produto.' }
      }
      return {
        success: true,
        data: data.map((movement) => ({
          id: movement.id,
          organizationId: movement.organization_id,
          inventoryItemId: movement.inventory_item_id,
          movementType: movement.movement_type,
          quantity: movement.quantity,
          balanceBefore: movement.balance_before,
          balanceAfter: movement.balance_after,
          unitPrice: movement.unit_price,
          reason: movement.reason,
          documentReference: movement.document_reference,
          supplierId: movement.supplier_id,
          quoteId: movement.quote_id,
          userId: movement.user_id,
          movedAt: movement.moved_at,
        })),
      }
    } catch (error) {
      logger.error('Exceção ao consultar movimentações do estoque', error)
      return { success: false, error: 'Erro inesperado ao consultar o histórico do produto.' }
    }
  },

  async recordMovement(
    organizationId: UUID,
    inventoryItemId: UUID,
    movement: {
      type: string
      direction: 'in' | 'out'
      quantity: string
      reason: string
      unitPrice: string
      documentReference: string
      supplierId: string
      movedAt: string
    },
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.rpc('record_inventory_movement', {
        p_organization_id: organizationId,
        p_inventory_item_id: inventoryItemId,
        p_movement_type: movement.type,
        p_direction: movement.direction,
        p_quantity: movement.quantity,
        p_reason: movement.reason.trim(),
        p_unit_price: movement.unitPrice || null,
        p_document_reference: movement.documentReference.trim() || null,
        p_supplier_id: movement.supplierId || null,
        p_moved_at: movement.movedAt || new Date().toISOString(),
        p_idempotency_key: crypto.randomUUID(),
      })
      if (error) {
        logger.error('Erro ao registrar movimentação do estoque', error)
        if (error.code === 'P0001' && error.message.includes('INSUFFICIENT_STOCK')) {
          return { success: false, error: 'A quantidade informada é maior que o saldo disponível.' }
        }
        if (error.code === '42501') {
          return {
            success: false,
            error: 'Seu usuário não tem permissão para movimentar o estoque.',
          }
        }
        return { success: false, error: 'Não foi possível registrar a movimentação.' }
      }
      return { success: true, data: undefined }
    } catch (error) {
      logger.error('Exceção ao registrar movimentação do estoque', error)
      return { success: false, error: 'Erro inesperado ao registrar movimentação.' }
    }
  },

  async saveSuppliers(
    organizationId: UUID,
    inventoryItemId: UUID,
    supplierIds: string[],
    params: InventoryItemParams,
  ): Promise<ServiceResult<void>> {
    try {
      const { error: deleteError } = await supabase
        .from('inventory_item_suppliers')
        .delete()
        .eq('organization_id', organizationId)
        .eq('inventory_item_id', inventoryItemId)
      if (deleteError) {
        logger.error('Erro ao atualizar fornecedores do material', deleteError)
        return {
          success: false,
          error: 'O material foi salvo, mas não foi possível atualizar os fornecedores.',
        }
      }

      const uniqueSupplierIds = [...new Set([params.supplierId, ...supplierIds].filter(Boolean))]
      if (uniqueSupplierIds.length === 0) return { success: true, data: undefined }

      const { error } = await supabase.from('inventory_item_suppliers').insert(
        uniqueSupplierIds.map((supplierId) => ({
          organization_id: organizationId,
          inventory_item_id: inventoryItemId,
          supplier_id: supplierId,
          supplier_product_code: params.supplierProductCode.trim() || null,
          purchase_price: params.purchasePrice || '0',
          lead_time_days: params.leadTimeDays ? Number(params.leadTimeDays) : null,
        })),
      )
      if (error) {
        logger.error('Erro ao salvar fornecedores do material', error)
        return {
          success: false,
          error: 'O material foi salvo, mas não foi possível vincular os fornecedores.',
        }
      }
      return { success: true, data: undefined }
    } catch (error) {
      logger.error('Exceção ao salvar fornecedores do material', error)
      return { success: false, error: 'Erro inesperado ao salvar fornecedores do material.' }
    }
  },
}
