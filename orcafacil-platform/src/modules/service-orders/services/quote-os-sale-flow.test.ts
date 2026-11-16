import { beforeEach, describe, expect, it, vi } from 'vitest'
import { quoteService } from '@modules/orcafacil/services/quote.service'
import { serviceOrderService } from './service-order.service'
import { salesService } from '@modules/sales/services/sales.service'

interface MockTableStore {
  quotes: Array<Record<string, any>>
  quote_items: Array<Record<string, any>>
  service_orders: Array<Record<string, any>>
  service_order_items: Array<Record<string, any>>
  inventory_items: Array<Record<string, any>>
  services: Array<Record<string, any>>
  customers: Array<Record<string, any>>
  quote_service_order_history: Array<Record<string, any>>
  service_materials: Array<Record<string, any>>
  inventory_movements: Array<Record<string, any>>
}

const db: MockTableStore = {
  quotes: [],
  quote_items: [],
  service_orders: [],
  service_order_items: [],
  inventory_items: [],
  services: [],
  customers: [],
  quote_service_order_history: [],
  service_materials: [],
  inventory_movements: [],
}

function createQueryBuilder(tableName: keyof MockTableStore) {
  let operation: 'select' | 'insert' | 'update' | 'delete' = 'select'
  let insertPayload: any = null
  let updatePayload: any = null
  const filters: Array<(row: Record<string, any>) => boolean> = []
  let singleMode: 'single' | 'maybeSingle' | null = null

  const applyFilters = (rows: Array<Record<string, any>>) =>
    rows.filter((r) => filters.every((fn) => fn(r)))

  const enrichQuoteRow = (row: Record<string, any>) => {
    const cust = db.customers.find((c) => c.id === row.customer_id) || null
    const linkedSale = row.sale_id
      ? db.quotes.find((q) => q.id === row.sale_id) || null
      : null
    const originQuote = row.origin_quote_id
      ? db.quotes.find((q) => q.id === row.origin_quote_id) || null
      : null
    const qItems = db.quote_items.filter((qi) => qi.quote_id === row.id)
    return {
      ...row,
      customers: cust,
      sale: linkedSale,
      origin_quote: originQuote,
      quote_items: qItems,
    }
  }

  const execute = async () => {
    const table = db[tableName] || []

    if (operation === 'insert') {
      const items = Array.isArray(insertPayload) ? insertPayload : [insertPayload]
      const inserted = items.map((item, idx) => {
        const newRow = {
          id: item.id || `${String(tableName)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${idx}`,
          created_at: item.created_at || new Date().toISOString(),
          updated_at: item.updated_at || new Date().toISOString(),
          ...item,
        }
        table.push(newRow)
        return tableName === 'quotes' ? enrichQuoteRow(newRow) : newRow
      })

      if (singleMode === 'single' || singleMode === 'maybeSingle') {
        return { data: inserted[0] ?? null, error: null }
      }
      return { data: inserted, error: null }
    }

    if (operation === 'update') {
      const matched = applyFilters(table)
      for (const row of matched) {
        Object.assign(row, updatePayload, {
          updated_at: updatePayload?.updated_at || new Date().toISOString(),
        })
      }
      const enriched = matched.map((r) => (tableName === 'quotes' ? enrichQuoteRow(r) : r))
      if (singleMode === 'single' || singleMode === 'maybeSingle') {
        return { data: enriched[0] ?? null, error: null }
      }
      return { data: enriched, error: null }
    }

    if (operation === 'delete') {
      const matched = new Set(applyFilters(table))
      const remaining = table.filter((r) => !matched.has(r))
      db[tableName] = remaining as any
      return { data: null, error: null }
    }

    const matched = applyFilters(table).map((r) =>
      tableName === 'quotes' ? enrichQuoteRow(r) : { ...r },
    )
    if (singleMode === 'single') {
      if (matched.length === 0) {
        return { data: null, error: { code: 'PGRST116', message: 'Not found' } }
      }
      return { data: matched[0], error: null }
    }
    if (singleMode === 'maybeSingle') {
      return { data: matched[0] ?? null, error: null }
    }
    return { data: matched, error: null }
  }

  const builder: any = {
    select: () => builder,
    insert: (payload: any) => {
      operation = 'insert'
      insertPayload = payload
      return builder
    },
    update: (payload: any) => {
      operation = 'update'
      updatePayload = payload
      return builder
    },
    delete: () => {
      operation = 'delete'
      return builder
    },
    eq: (col: string, val: any) => {
      filters.push((row) => row[col] === val)
      return builder
    },
    in: (col: string, vals: any[]) => {
      filters.push((row) => vals.includes(row[col]))
      return builder
    },
    gte: () => builder,
    order: () => builder,
    limit: () => builder,
    returns: () => builder,
    single: () => {
      singleMode = 'single'
      return builder
    },
    maybeSingle: () => {
      singleMode = 'maybeSingle'
      return builder
    },
    then: (onFulfilled?: any, onRejected?: any) => execute().then(onFulfilled, onRejected),
  }

  return builder
}

vi.mock('@app/config/supabase', () => ({
  supabase: {
    from: vi.fn((tableName: keyof MockTableStore) => createQueryBuilder(tableName)),
    rpc: vi.fn(async () => ({ data: null, error: null })),
  },
}))

vi.mock('@modules/cash/services/cash-session.service', () => ({
  cashSessionService: {
    findBestOpenSession: vi.fn(async () => ({ id: 'session-open-1', status: 'open' })),
    getOpenCashManagementSession: vi.fn(async () => ({
      success: true,
      data: { id: 'session-mgmt-1', status: 'open' },
    })),
    recordSaleInSession: vi.fn(async () => ({ success: true })),
    syncSaleWithCashManagement: vi.fn(async () => ({ success: true })),
    getSelectedRegisterName: vi.fn(() => 'Caixa 01'),
  },
}))

vi.mock('@modules/cash/services/cash.service', () => ({
  cashService: {
    createQuoteReceivable: vi.fn(async () => ({ success: true })),
  },
}))

describe('Fluxo Integrado: Orçamento <-> Ordem de Serviço (OS) <-> Venda', () => {
  const orgId = 'org-test-001'
  const customerId = 'cust-test-001'

  beforeEach(() => {
    db.quotes = []
    db.quote_items = []
    db.service_orders = []
    db.service_order_items = []
    db.quote_service_order_history = []
    db.service_materials = []
    db.inventory_movements = []

    db.customers = [
      {
        id: customerId,
        organization_id: orgId,
        name: 'Cliente Integração Ltda',
        phone: '11999998888',
        document: '12345678901',
        email: 'cliente@teste.com',
        address: 'Rua A',
        address_number: '100',
      },
    ]

    db.inventory_items = [
      {
        id: 'mat-ssd',
        organization_id: orgId,
        name: 'SSD NVMe 500GB',
        unit: 'UN',
        unit_price: '250.00',
        minimum_sale_price: '200.00',
        quantity_on_hand: '10',
        can_sell: true,
        is_active: true,
      },
      {
        id: 'mat-ram',
        organization_id: orgId,
        name: 'Memória RAM 16GB DDR4',
        unit: 'UN',
        unit_price: '180.00',
        minimum_sale_price: '150.00',
        quantity_on_hand: '10',
        can_sell: true,
        is_active: true,
      },
    ]

    db.services = [
      {
        id: 'srv-format',
        organization_id: orgId,
        name: 'Formatação e Backup Completo',
        minimum_sale_price: '80.00',
        sale_price: '120.00',
      },
      {
        id: 'srv-clean',
        organization_id: orgId,
        name: 'Limpeza Interna e Pasta Térmica',
        minimum_sale_price: '60.00',
        sale_price: '90.00',
      },
    ]
  })

  it('Cenário 1: Criar orçamento, aprovar e enviar diretamente para venda, sem gerar OS', async () => {
    // 1. Cria orçamento
    const createRes = await quoteService.createQuote(orgId, {
      customerId,
      discount: '0.00',
      items: [
        {
          description: 'SSD NVMe 500GB',
          quantity: '1',
          unitPrice: '250.00',
          inventoryItemId: 'mat-ssd',
          itemType: 'product',
          unit: 'UN',
        },
        {
          description: 'Formatação e Backup Completo',
          quantity: '1',
          unitPrice: '120.00',
          serviceId: 'srv-format',
          itemType: 'service',
          unit: 'UN',
        },
      ],
    })
    expect(createRes.success).toBe(true)
    if (!createRes.success) return
    const quoteId = createRes.data

    // 2. Envia e aprova o orçamento
    expect((await quoteService.updateStatus(orgId, quoteId, 'sent')).success).toBe(true)
    expect((await quoteService.updateStatus(orgId, quoteId, 'approved')).success).toBe(true)

    // 3. Envia diretamente para venda sem gerar OS
    const saleRes = await salesService.createSale(orgId, {
      customerId,
      customerName: 'Cliente Integração Ltda',
      originQuoteId: quoteId,
      paymentMethod: 'pix',
      items: [
        {
          description: 'SSD NVMe 500GB',
          quantity: '1',
          unitPrice: '250.00',
          inventoryItemId: 'mat-ssd',
          itemType: 'product',
          unit: 'UN',
        },
        {
          description: 'Formatação e Backup Completo',
          quantity: '1',
          unitPrice: '120.00',
          serviceId: 'srv-format',
          itemType: 'service',
          unit: 'UN',
        },
      ],
    })
    expect(saleRes.success).toBe(true)
    if (!saleRes.success) return

    const updatedQuote = await quoteService.getQuote(orgId, quoteId)
    expect(updatedQuote.success).toBe(true)
    if (updatedQuote.success) {
      expect(updatedQuote.data.status).toBe('completed')
      expect(updatedQuote.data.saleId).toBe(saleRes.data.saleId)
      expect(updatedQuote.data.total).toBe('370.00')
    }

    // 4. Verifica que não permite gerar venda duplicada para o mesmo orçamento
    const dupSaleRes = await salesService.createSale(orgId, {
      customerId,
      originQuoteId: quoteId,
      paymentMethod: 'pix',
      items: [
        {
          description: 'SSD NVMe 500GB',
          quantity: '1',
          unitPrice: '250.00',
          inventoryItemId: 'mat-ssd',
          itemType: 'product',
          unit: 'UN',
        },
      ],
    })
    expect(dupSaleRes.success).toBe(false)
  })

  it('Cenários 2 e 3: Criar orçamento, aprovar, gerar OS (inicia APROVADA) e finalizar sem adicionar nenhum item', async () => {
    const createRes = await quoteService.createQuote(orgId, {
      customerId,
      discount: '10.00',
      items: [
        {
          description: 'SSD NVMe 500GB',
          quantity: '1',
          unitPrice: '250.00',
          inventoryItemId: 'mat-ssd',
          itemType: 'product',
          unit: 'UN',
        },
        {
          description: 'Formatação e Backup Completo',
          quantity: '1',
          unitPrice: '120.00',
          serviceId: 'srv-format',
          itemType: 'service',
          unit: 'UN',
        },
      ],
    })
    expect(createRes.success).toBe(true)
    if (!createRes.success) return
    const quoteId = createRes.data

    await quoteService.updateStatus(orgId, quoteId, 'sent')
    await quoteService.updateStatus(orgId, quoteId, 'approved')

    const quoteDetail = await quoteService.getQuote(orgId, quoteId)
    expect(quoteDetail.success).toBe(true)
    if (!quoteDetail.success) return

    // Gera O.S. com os mesmos dados do orçamento aprovado
    const osCreateRes = await serviceOrderService.create(orgId, {
      status: 'approved',
      priority: 'normal',
      customerId: quoteDetail.data.customerId,
      customerName: quoteDetail.data.customerName,
      customerPhone: quoteDetail.data.customerPhone,
      equipmentName: 'Notebook Dell Inspiron 15',
      reportedProblem: 'Lentidão e substituição de SSD conforme orçamento',
      damageChecklist: [],
      photos: [],
      discount: quoteDetail.data.discount,
      quoteId: quoteDetail.data.id,
      quoteNumber: quoteDetail.data.quoteNumber,
      items: quoteDetail.data.items.map((it) => ({
        itemType: it.itemType || 'product',
        inventoryItemId: it.inventoryItemId,
        serviceId: it.serviceId,
        description: it.description,
        unit: it.unit || 'UN',
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    })

    expect(osCreateRes.success).toBe(true)
    if (!osCreateRes.success) return
    const os = osCreateRes.data

    // A O.S. deve iniciar com status APROVADA ('approved') e vínculo com o orçamento
    expect(os.status).toBe('approved')
    expect(os.quoteId).toBe(quoteId)
    expect(os.total).toBe('360.00')
    expect(os.items).toHaveLength(2)

    // Impede geração de O.S. duplicada para o mesmo orçamento
    const duplicateOsRes = await serviceOrderService.create(orgId, {
      status: 'approved',
      priority: 'normal',
      customerId,
      customerName: quoteDetail.data.customerName,
      equipmentName: 'Notebook Dell Inspiron 15',
      reportedProblem: 'Duplicada',
      damageChecklist: [],
      photos: [],
      quoteId,
      items: [],
    })
    expect(duplicateOsRes.success).toBe(false)

    // Finaliza a O.S. sem adicionar nenhum item comercial
    const finalizeRes = await serviceOrderService.updateStatus(orgId, os.id, 'ready')
    expect(finalizeRes.success).toBe(true)

    const finalizedOs = await serviceOrderService.getById(orgId, os.id)
    expect(finalizedOs.success).toBe(true)
    if (finalizedOs.success) {
      expect(finalizedOs.data.status).toBe('ready')
    }
  })

  it('Cenários 4 a 14: Alterações comerciais (novo material, novo serviço, qtd, valor), retorno do orçamento para ENVIADO, bloqueio da OS, reaprovação, finalização e envio para venda sem duplicidade', async () => {
    // 1. Cria e aprova orçamento inicial (Total: R$ 370,00)
    const createRes = await quoteService.createQuote(orgId, {
      customerId,
      discount: '0.00',
      items: [
        {
          description: 'SSD NVMe 500GB',
          quantity: '1',
          unitPrice: '250.00',
          inventoryItemId: 'mat-ssd',
          itemType: 'product',
          unit: 'UN',
        },
        {
          description: 'Formatação e Backup Completo',
          quantity: '1',
          unitPrice: '120.00',
          serviceId: 'srv-format',
          itemType: 'service',
          unit: 'UN',
        },
      ],
    })
    expect(createRes.success).toBe(true)
    if (!createRes.success) return
    const quoteId = createRes.data

    await quoteService.updateStatus(orgId, quoteId, 'sent')
    await quoteService.updateStatus(orgId, quoteId, 'approved')

    const initialQuote = await quoteService.getQuote(orgId, quoteId)
    expect(initialQuote.success).toBe(true)
    if (!initialQuote.success) return

    // 2. Gera O.S. a partir do orçamento aprovado
    const osCreateRes = await serviceOrderService.create(orgId, {
      status: 'approved',
      priority: 'normal',
      customerId,
      customerName: initialQuote.data.customerName,
      equipmentName: 'Desktop Gamer',
      reportedProblem: 'Upgrade e manutenção preventiva',
      damageChecklist: [],
      photos: [],
      discount: '0.00',
      quoteId,
      quoteNumber: initialQuote.data.quoteNumber,
      items: initialQuote.data.items.map((it) => ({
        itemType: it.itemType || 'product',
        inventoryItemId: it.inventoryItemId,
        serviceId: it.serviceId,
        description: it.description,
        unit: it.unit || 'UN',
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    })
    expect(osCreateRes.success).toBe(true)
    if (!osCreateRes.success) return
    const osId = osCreateRes.data.id
    expect(osCreateRes.data.status).toBe('approved')

    // 3. Durante a execução da O.S., realiza alterações comerciais:
    // - Altera a quantidade do material existente (SSD de 1 para 2 -> 500.00)
    // - Altera o valor do serviço existente (Formatação de 120.00 para 150.00)
    // - Adiciona um novo material (Memória RAM 16GB -> 180.00)
    // - Adiciona um novo serviço (Limpeza Interna -> 90.00)
    // Novo Total esperado: 500 + 150 + 180 + 90 = R$ 920.00
    const osUpdateRes = await serviceOrderService.update(orgId, osId, {
      status: 'in_maintenance',
      priority: 'high',
      customerId,
      customerName: initialQuote.data.customerName,
      equipmentName: 'Desktop Gamer',
      reportedProblem: 'Upgrade e manutenção preventiva',
      technicalDiagnosis: 'Necessário dobrar armazenamento, adicionar RAM e limpeza térmica',
      damageChecklist: [],
      photos: [],
      discount: '0.00',
      quoteId,
      items: [
        {
          itemType: 'product',
          inventoryItemId: 'mat-ssd',
          serviceId: null,
          description: 'SSD NVMe 500GB',
          unit: 'UN',
          quantity: '2',
          unitPrice: '250.00',
        },
        {
          itemType: 'service',
          inventoryItemId: null,
          serviceId: 'srv-format',
          description: 'Formatação e Backup Completo',
          unit: 'UN',
          quantity: '1',
          unitPrice: '150.00',
        },
        {
          itemType: 'product',
          inventoryItemId: 'mat-ram',
          serviceId: null,
          description: 'Memória RAM 16GB DDR4',
          unit: 'UN',
          quantity: '1',
          unitPrice: '180.00',
        },
        {
          itemType: 'service',
          inventoryItemId: null,
          serviceId: 'srv-clean',
          description: 'Limpeza Interna e Pasta Térmica',
          unit: 'UN',
          quantity: '1',
          unitPrice: '90.00',
        },
      ],
    })

    expect(osUpdateRes.success).toBe(true)
    if (!osUpdateRes.success) return

    // 4. Verifica se a O.S. mudou automaticamente para PENDENTE DE APROVAÇÃO ('pending_approval')
    expect(osUpdateRes.data.status).toBe('pending_approval')
    expect(osUpdateRes.data.total).toBe('920.00')

    // 5. Verifica se o orçamento retornou para ENVIADO ('sent') com os novos itens e valor R$ 920.00
    const quoteAfterChange = await quoteService.getQuote(orgId, quoteId)
    expect(quoteAfterChange.success).toBe(true)
    if (!quoteAfterChange.success) return
    expect(quoteAfterChange.data.status).toBe('sent')
    expect(quoteAfterChange.data.total).toBe('920.00')
    expect(quoteAfterChange.data.items).toHaveLength(4)
    expect(quoteAfterChange.data.version).toBe(2)

    // 6. Tenta finalizar a O.S. com orçamento pendente de aprovação e confirma bloqueio
    const blockedFinalizeRes = await serviceOrderService.updateStatus(orgId, osId, 'ready')
    expect(blockedFinalizeRes.success).toBe(false)
    if (!blockedFinalizeRes.success) {
      expect(blockedFinalizeRes.error).toContain('PENDENTE DE APROVAÇÃO')
    }

    // 7. Tenta enviar a O.S. para venda enquanto pendente de aprovação e confirma bloqueio
    const blockedSaleRes = await salesService.createSale(orgId, {
      customerId,
      originServiceOrderId: osId,
      paymentMethod: 'pix',
      items: [
        {
          description: 'SSD NVMe 500GB',
          quantity: '2',
          unitPrice: '250.00',
          unit: 'UN',
        },
      ],
    })
    expect(blockedSaleRes.success).toBe(false)

    // 8. Segunda aprovação do orçamento pelo cliente -> O.S. retorna automaticamente para APROVADA
    const reapproveRes = await quoteService.updateStatus(orgId, quoteId, 'approved')
    expect(reapproveRes.success).toBe(true)

    const osAfterReapproval = await serviceOrderService.getById(orgId, osId)
    expect(osAfterReapproval.success).toBe(true)
    if (!osAfterReapproval.success) return
    expect(osAfterReapproval.data.status).toBe('approved')

    // 9. Finaliza a O.S. após a segunda aprovação do orçamento
    const finalizeAfterApprovalRes = await serviceOrderService.updateStatus(orgId, osId, 'ready')
    expect(finalizeAfterApprovalRes.success).toBe(true)

    const osFinalized = await serviceOrderService.getById(orgId, osId)
    expect(osFinalized.success).toBe(true)
    if (!osFinalized.success) return
    expect(osFinalized.data.status).toBe('ready')

    // 10. Envia a O.S. finalizada para Venda e confirma que os valores correspondem à última versão aprovada (R$ 920.00)
    const finalSaleRes = await salesService.createSale(orgId, {
      customerId,
      customerName: initialQuote.data.customerName,
      originServiceOrderId: osId,
      paymentMethod: 'credit_card',
      items: osFinalized.data.items.map((it) => ({
        inventoryItemId: it.inventoryItemId,
        serviceId: it.serviceId,
        itemType: it.itemType,
        description: it.description,
        unit: it.unit,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    })
    expect(finalSaleRes.success).toBe(true)
    if (!finalSaleRes.success) return

    const saleDetailRes = await salesService.getSaleById(orgId, finalSaleRes.data.saleId)
    expect(saleDetailRes.success).toBe(true)
    if (saleDetailRes.success) {
      expect(saleDetailRes.data.total).toBe('920.00')
      expect(saleDetailRes.data.items).toHaveLength(4)
      expect(saleDetailRes.data.originQuoteId).toBe(quoteId)
      expect(saleDetailRes.data.originServiceOrderId).toBe(osId)
    }

    // 11. Verifica vínculos finais no orçamento e na O.S. e bloqueio contra venda duplicada
    const finalQuote = await quoteService.getQuote(orgId, quoteId)
    const finalOs = await serviceOrderService.getById(orgId, osId)
    expect(finalQuote.success && finalQuote.data.status).toBe('completed')
    expect(finalQuote.success && finalQuote.data.saleId).toBe(finalSaleRes.data.saleId)
    expect(finalOs.success && finalOs.data.status).toBe('closed')
    expect(finalOs.success && finalOs.data.saleId).toBe(finalSaleRes.data.saleId)

    const duplicateSaleFromOs = await salesService.createSale(orgId, {
      customerId,
      originServiceOrderId: osId,
      paymentMethod: 'pix',
      items: [
        {
          description: 'SSD NVMe 500GB',
          quantity: '2',
          unitPrice: '250.00',
          unit: 'UN',
        },
      ],
    })
    expect(duplicateSaleFromOs.success).toBe(false)
  })
})
