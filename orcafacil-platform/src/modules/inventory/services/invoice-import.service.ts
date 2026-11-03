import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UUID } from '@shared/types/common'
import { supplierService } from '@modules/suppliers/services/supplier.service'
import { supplierInvoiceService } from '@modules/suppliers/services/supplier-invoice.service'
import { inventoryService } from './inventory.service'
import type { ParsedInvoiceData } from './nfe-parser.service'

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

      // 3. Cadastrar os Materiais no Estoque
      const createdItemIds: string[] = []
      let completedCount = 0
      let awaitingCount = 0

      for (const item of parsedData.items) {
        const hasSalePrice = Number(item.salePrice) > 0
        const isCompleted = hasSalePrice && item.name.trim().length >= 2 && Boolean(item.unit)
        const status = isCompleted ? 'completed' : 'awaiting_information'
        const pendingFields = isCompleted ? [] : ['Preço de venda']

        if (isCompleted) {
          completedCount++
        } else {
          awaitingCount++
        }

        const createItemRes = await inventoryService.create(organizationId, {
          supplierId,
          supplierIds: [supplierId],
          name: item.name,
          unit: item.unit || 'UN',
          quantityOnHand: String(item.quantity || '0'),
          minimumQuantity: '0',
          unitPrice: hasSalePrice ? String(item.salePrice) : '0.00',
          sku: item.code || '',
          barcode: '',
          description: `Importado de NF-e nº ${parsedData.invoiceNumber} (Série ${parsedData.series})`,
          category: item.category || '',
          subcategory: '',
          brand: '',
          manufacturer: '',
          model: '',
          manufacturerReference: '',
          purchasePrice: String(item.unitCost || '0.00'),
          extraPurchaseCost: '0.00',
          supplierProductCode: item.code || '',
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
          fiscalProductCode: item.code || '',
          gtin: '',
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
          },
          imagePath: '',
        })

        if (createItemRes.success) {
          createdItemIds.push(createItemRes.data.id)

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
