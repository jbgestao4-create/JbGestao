import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { InventoryItem, ServiceResult, UUID } from '@shared/types/common'
import { supplierService } from '@modules/suppliers/services/supplier.service'
import { supplierInvoiceService } from '@modules/suppliers/services/supplier-invoice.service'
import { inventoryService } from './inventory.service'
import type { ParsedInvoiceData, ParsedInvoiceItem } from './nfe-parser.service'

export interface InvoiceImportResult {
  supplierId: string
  supplierName: string
  isNewSupplier: boolean
  invoiceAttached: boolean
  totalItems: number
  completedCount: number
  awaitingCount: number
  createdItemIds: string[]
}

export function findMatchingInventoryItem(
  item: Pick<
    ParsedInvoiceItem,
    'existingItemId' | 'invoiceProductCode' | 'barcode' | 'code' | 'name'
  >,
  existingItems: InventoryItem[],
): InventoryItem | undefined {
  if (item.existingItemId) {
    const byId = existingItems.find((e) => e.id === item.existingItemId)
    if (byId) return byId
  }

  const normInvoiceCode = item.invoiceProductCode?.trim().toLowerCase() || ''
  if (normInvoiceCode) {
    const byInvoiceCode = existingItems.find((e) => {
      const suppCode = e.supplierProductCode?.trim().toLowerCase() || ''
      const fiscCode = e.fiscalProductCode?.trim().toLowerCase() || ''
      const attrCode = e.attributes?.nfe_product_code?.trim().toLowerCase() || ''
      const skuCode = e.sku?.trim().toLowerCase() || ''
      const hasSupplierMatch = e.suppliers?.some(
        (s) => s.supplierProductCode?.trim().toLowerCase() === normInvoiceCode,
      )
      return (
        suppCode === normInvoiceCode ||
        fiscCode === normInvoiceCode ||
        attrCode === normInvoiceCode ||
        skuCode === normInvoiceCode ||
        Boolean(hasSupplierMatch)
      )
    })
    if (byInvoiceCode) return byInvoiceCode
  }

  const normBarcode = item.barcode?.trim() || ''
  if (normBarcode && normBarcode.toUpperCase() !== 'SEM GTIN') {
    const byBarcode = existingItems.find(
      (e) => e.barcode?.trim() === normBarcode || e.gtin?.trim() === normBarcode,
    )
    if (byBarcode) return byBarcode
  }

  const normCode = item.code?.trim().toLowerCase() || ''
  const normName = item.name?.trim().toLowerCase() || ''

  if (normCode) {
    const byCodeAndName = existingItems.find(
      (e) =>
        e.sku?.trim().toLowerCase() === normCode &&
        normName.length >= 2 &&
        e.name?.trim().toLowerCase() === normName,
    )
    if (byCodeAndName) return byCodeAndName
  }

  if (normName.length >= 2) {
    const byName = existingItems.find((e) => e.name?.trim().toLowerCase() === normName)
    if (byName) return byName
  }

  return undefined
}

export const invoiceImportService = {
  async importInvoice(
    organizationId: UUID,
    parsedData: ParsedInvoiceData,
    file?: File,
  ): Promise<ServiceResult<InvoiceImportResult>> {
    try {
      // 1. Identificar ou Cadastrar Fornecedor
      const cleanDoc = parsedData.supplier.document.replace(/\D/g, '')
      let supplierId = ''
      let isNewSupplier = false

      if (cleanDoc) {
        const { data: existingByDoc, error: docError } = await supabase
          .from('suppliers')
          .select('id, name')
          .eq('organization_id', organizationId)
          .eq('document', cleanDoc)
          .maybeSingle()

        if (!docError && existingByDoc) {
          supplierId = existingByDoc.id
        }
      }

      if (!supplierId && parsedData.supplier.name) {
        const { data: existingByName, error: nameError } = await supabase
          .from('suppliers')
          .select('id, name')
          .eq('organization_id', organizationId)
          .ilike('name', parsedData.supplier.name)
          .maybeSingle()

        if (!nameError && existingByName) {
          supplierId = existingByName.id
        }
      }

      if (!supplierId) {
        // Cadastrar novo fornecedor
        const createSupplierResult = await supplierService.create(organizationId, {
          name: parsedData.supplier.name || 'Fornecedor da Nota',
          document: cleanDoc,
          contactName: parsedData.supplier.tradeName || '',
          phone: parsedData.supplier.phone || '',
          email: parsedData.supplier.email || '',
          address: parsedData.supplier.address || '',
          notes: `Cadastrado automaticamente via importação de NF-e nº ${parsedData.invoiceNumber} em ${new Date().toLocaleDateString('pt-BR')}`,
        })

        if (!createSupplierResult.success) {
          logger.error('Falha ao cadastrar fornecedor da nota', createSupplierResult.error)
          return {
            success: false,
            error: `Não foi possível cadastrar o fornecedor: ${createSupplierResult.error}`,
          }
        }

        supplierId = createSupplierResult.data.id
        isNewSupplier = true
      }

      // 2. Anexar Nota Fiscal ao Fornecedor
      let invoiceAttached = false
      if (file && supplierId) {
        try {
          const uploadRes = await supplierInvoiceService.upload(organizationId, supplierId, {
            file,
            invoiceNumber: parsedData.invoiceNumber,
            receivedAt: parsedData.issuedAt || new Date().toISOString().slice(0, 10),
          })
          if (uploadRes.success) {
            invoiceAttached = true
          } else {
            logger.warn('Nota fiscal não pôde ser salva no storage, continuando cadastro:', {
              error: uploadRes.error,
            })
          }
        } catch (uploadErr) {
          logger.warn('Exceção ao anexar nota fiscal:', { error: String(uploadErr) })
        }
      }

      // 3. Cadastrar ou Somar os Materiais no Estoque
      const createdItemIds: string[] = []
      let completedCount = 0
      let awaitingCount = 0

      const existingListRes = await inventoryService.list(organizationId)
      const existingItems: InventoryItem[] = existingListRes.success ? [...existingListRes.data] : []

      for (const item of parsedData.items) {
        const existingItem = findMatchingInventoryItem(item, existingItems)

        if (existingItem) {
          const previousQty = Number(existingItem.quantityOnHand) || 0
          const addedQty = Number(item.quantity) || 0
          const newQty = previousQty + addedQty

          const effectiveSalePrice =
            Number(item.salePrice) > 0
              ? Number(item.salePrice)
              : Number(existingItem.unitPrice) || 0
          const isCompleted =
            effectiveSalePrice > 0 &&
            (existingItem.name || item.name).trim().length >= 2 &&
            Boolean(existingItem.unit || item.unit)
          const status = isCompleted ? 'completed' : 'awaiting_information'
          const pendingFields = isCompleted ? [] : ['Preço de venda']

          if (isCompleted) {
            completedCount++
          } else {
            awaitingCount++
          }

          const mergedAttributes: Record<string, string> = {
            ...(existingItem.attributes || {}),
            registration_status: status,
            pending_fields: JSON.stringify(pendingFields),
            imported_from_nfe: 'true',
            nfe_number: parsedData.invoiceNumber,
            nfe_series: parsedData.series,
            nfe_access_key: parsedData.accessKey,
            supplier_name: parsedData.supplier.name,
            ...(item.invoiceProductCode ? { nfe_product_code: item.invoiceProductCode } : {}),
          }

          const { error: updateErr } = await supabase
            .from('inventory_items')
            .update({
              quantity_on_hand: String(newQty),
              purchase_price: String(item.unitCost || existingItem.purchasePrice || '0.00'),
              last_purchase_price: String(item.unitCost || existingItem.purchasePrice || '0.00'),
              last_purchase_at: new Date().toISOString(),
              unit_price: String(effectiveSalePrice || '0.00'),
              can_sell: isCompleted ? true : existingItem.canSell,
              supplier_id: supplierId || existingItem.supplierId || null,
              supplier_product_code:
                item.invoiceProductCode || existingItem.supplierProductCode || null,
              fiscal_product_code:
                item.invoiceProductCode || existingItem.fiscalProductCode || null,
              barcode: existingItem.barcode || item.barcode || null,
              gtin: existingItem.gtin || item.barcode || null,
              fiscal_ncm: existingItem.fiscalNcm || item.ncm || null,
              attributes: mergedAttributes,
              updated_at: new Date().toISOString(),
            })
            .eq('organization_id', organizationId)
            .eq('id', existingItem.id)

          if (!updateErr) {
            createdItemIds.push(existingItem.id)
            existingItem.quantityOnHand = String(newQty)
            existingItem.unitPrice = String(effectiveSalePrice || '0.00')
            if (item.invoiceProductCode) {
              existingItem.supplierProductCode = item.invoiceProductCode
              existingItem.fiscalProductCode = item.invoiceProductCode
            }

            if (addedQty > 0) {
              await supabase.from('inventory_movements').insert({
                organization_id: organizationId,
                inventory_item_id: existingItem.id,
                movement_type: 'entry',
                quantity: String(addedQty),
                unit_price: String(item.unitCost || '0.00'),
                document_reference: `NF-e nº ${parsedData.invoiceNumber}`,
                reason: `Entrada complementar por importação de NF-e (Fornecedor: ${parsedData.supplier.name})`,
                balance_before: String(previousQty),
                balance_after: String(newQty),
              })
            }
          } else {
            logger.error(`Erro ao somar estoque do material existente ${item.name}`, updateErr)
          }

          continue
        }

        const hasSalePrice = Number(item.salePrice) > 0
        const isCompleted = hasSalePrice && item.name.trim().length >= 2 && Boolean(item.unit)
        const status = isCompleted ? 'completed' : 'awaiting_information'
        const pendingFields = isCompleted ? [] : ['Preço de venda']

        if (isCompleted) {
          completedCount++
        } else {
          awaitingCount++
        }

        const itemParams = {
          supplierId,
          supplierIds: [supplierId],
          name: item.name,
          unit: item.unit || 'UN',
          quantityOnHand: String(item.quantity || '0'),
          minimumQuantity: '0',
          unitPrice: hasSalePrice ? String(item.salePrice) : '0.00',
          sku: '',
          barcode: item.barcode || '',
          description: `Importado de NF-e nº ${parsedData.invoiceNumber} (Série ${parsedData.series})`,
          category: item.category || '',
          subcategory: '',
          brand: '',
          manufacturer: '',
          model: '',
          manufacturerReference: '',
          purchasePrice: String(item.unitCost || '0.00'),
          extraPurchaseCost: '0.00',
          supplierProductCode: item.invoiceProductCode || '',
          leadTimeDays: '',
          promotionalPrice: '',
          targetMarginPercent: '',
          minimumSalePrice: '',
          maximumQuantity: '0',
          idealRestockQuantity: '0',
          location: '',
          warehouse: '',
          allowNegativeStock: false,
          trackExpiry: false,
          trackLot: false,
          trackSerialNumber: false,
          fiscalNcm: item.ncm || '',
          fiscalCest: '',
          fiscalOrigin: '',
          commercialUnit: item.unit || 'UN',
          fiscalProductCode: item.invoiceProductCode || '',
          gtin: item.barcode || '',
          isActive: true,
          canSell: isCompleted,
          canPurchase: true,
          notes: parsedData.accessKey ? `Chave NF-e: ${parsedData.accessKey}` : '',
          purchaseUnit: item.unit || 'UN',
          purchaseUnitFactor: '1',
          attributes: {
            registration_status: status,
            pending_fields: JSON.stringify(pendingFields),
            imported_from_nfe: 'true',
            nfe_number: parsedData.invoiceNumber,
            nfe_series: parsedData.series,
            nfe_access_key: parsedData.accessKey,
            supplier_name: parsedData.supplier.name,
            ...(item.invoiceProductCode ? { nfe_product_code: item.invoiceProductCode } : {}),
          },
          imagePath: '',
        }

        let createItemRes = await inventoryService.create(organizationId, itemParams)
        if (!createItemRes.success && itemParams.barcode) {
          createItemRes = await inventoryService.create(organizationId, {
            ...itemParams,
            barcode: '',
          })
        }

        if (createItemRes.success) {
          createdItemIds.push(createItemRes.data.id)
          existingItems.push(createItemRes.data)

          // Registrar movimentação de entrada no estoque
          if (Number(item.quantity) > 0) {
            await supabase.from('inventory_movements').insert({
              organization_id: organizationId,
              inventory_item_id: createItemRes.data.id,
              movement_type: 'entry',
              quantity: String(item.quantity),
              unit_price: String(item.unitCost || '0.00'),
              document_reference: `NF-e nº ${parsedData.invoiceNumber}`,
              reason: `Entrada por importação de NF-e (Fornecedor: ${parsedData.supplier.name})`,
              balance_before: '0',
              balance_after: String(item.quantity),
            })
          }
        } else {
          logger.error(`Erro ao cadastrar material ${item.name} da nota`, createItemRes.error)
        }
      }

      return {
        success: true,
        data: {
          supplierId,
          supplierName: parsedData.supplier.name,
          isNewSupplier,
          invoiceAttached,
          totalItems: parsedData.items.length,
          completedCount,
          awaitingCount,
          createdItemIds,
        },
      }
    } catch (error) {
      logger.error('Exceção ao importar nota fiscal', error)
      return { success: false, error: 'Erro inesperado ao importar os dados da nota fiscal.' }
    }
  },
}
