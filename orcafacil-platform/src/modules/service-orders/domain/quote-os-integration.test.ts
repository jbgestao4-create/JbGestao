import { describe, expect, it } from 'vitest'
import {
  buildApprovedQuoteSnapshot,
  canFinalizeServiceOrder,
  canGenerateOsFromQuote,
  canSendQuoteDirectlyToSale,
  canSendServiceOrderToSale,
  compareCommercialScope,
  encodeOsInternalNotes,
  mapQuoteItemsToServiceOrderItems,
  mapServiceOrderItemsToQuoteItems,
  parseOsInternalNotes,
} from './quote-os-integration'

describe('quote-os-integration domain', () => {
  const sampleQuoteItems = [
    {
      id: 'qi-1',
      description: 'Cabo HDMI 2.1 Blindado',
      quantity: '2',
      unitPrice: '45.00',
      total: '90.00',
      inventoryItemId: 'inv-1',
      serviceId: null,
      itemType: 'product' as const,
      unit: 'UN',
    },
    {
      id: 'qi-2',
      description: 'Instalação e Configuração Técnica',
      quantity: '1',
      unitPrice: '150.00',
      total: '150.00',
      inventoryItemId: null,
      serviceId: 'srv-1',
      itemType: 'service' as const,
      unit: 'HR',
    },
  ]

  it('deve importar materiais e serviços do orçamento para a O.S. mantendo quantidades, valores e vínculos', () => {
    const osItems = mapQuoteItemsToServiceOrderItems(sampleQuoteItems)
    expect(osItems).toHaveLength(2)
    expect(osItems[0]).toMatchObject({
      itemType: 'product',
      inventoryItemId: 'inv-1',
      serviceId: null,
      description: 'Cabo HDMI 2.1 Blindado',
      unit: 'UN',
      quantity: '2',
      unitPrice: '45.00',
      total: '90.00',
    })
    expect(osItems[1]).toMatchObject({
      itemType: 'service',
      inventoryItemId: null,
      serviceId: 'srv-1',
      description: 'Instalação e Configuração Técnica',
      unit: 'HR',
      quantity: '1',
      unitPrice: '150.00',
      total: '150.00',
    })
  })

  it('deve converter itens da O.S. de volta para o formato de orçamento sem perda de informações', () => {
    const osItems = mapQuoteItemsToServiceOrderItems(sampleQuoteItems)
    const quoteInputs = mapServiceOrderItemsToQuoteItems(osItems)
    expect(quoteInputs).toHaveLength(2)
    expect(quoteInputs[0].itemType).toBe('product')
    expect(quoteInputs[0].inventoryItemId).toBe('inv-1')
    expect(quoteInputs[1].itemType).toBe('service')
    expect(quoteInputs[1].serviceId).toBe('srv-1')
  })

  it('não deve apontar alteração comercial quando os itens, quantidades, valores e descontos são idênticos', () => {
    const snapshot = buildApprovedQuoteSnapshot({
      version: 1,
      subtotal: '240.00',
      discount: '10.00',
      total: '230.00',
      approvedBy: 'client',
      items: sampleQuoteItems,
    })

    const comparison = compareCommercialScope(snapshot, {
      items: mapQuoteItemsToServiceOrderItems(sampleQuoteItems),
      discount: '10.00',
      total: '230.00',
    })

    expect(comparison.hasCommercialChange).toBe(false)
    expect(comparison.changes).toHaveLength(0)
  })

  it('deve identificar adição de um novo material na O.S. como alteração comercial', () => {
    const osItems = [
      ...mapQuoteItemsToServiceOrderItems(sampleQuoteItems),
      {
        id: 'new-mat',
        itemType: 'product' as const,
        inventoryItemId: 'inv-2',
        serviceId: null,
        description: 'Fonte 12V 5A',
        unit: 'UN',
        quantity: '1',
        unitPrice: '80.00',
        total: '80.00',
      },
    ]

    const comparison = compareCommercialScope(
      { items: sampleQuoteItems, discount: '0.00', total: '240.00' },
      { items: osItems, discount: '0.00', total: '320.00' },
    )

    expect(comparison.hasCommercialChange).toBe(true)
    expect(comparison.changes.some((c) => c.type === 'added_material')).toBe(true)
    expect(comparison.newTotal).toBe('320.00')
  })

  it('deve identificar adição de um novo serviço na O.S. como alteração comercial', () => {
    const osItems = [
      ...mapQuoteItemsToServiceOrderItems(sampleQuoteItems),
      {
        id: 'new-srv',
        itemType: 'service' as const,
        inventoryItemId: null,
        serviceId: 'srv-2',
        description: 'Limpeza Química de Placa',
        unit: 'UN',
        quantity: '1',
        unitPrice: '120.00',
        total: '120.00',
      },
    ]

    const comparison = compareCommercialScope(
      { items: sampleQuoteItems, discount: '0.00', total: '240.00' },
      { items: osItems, discount: '0.00', total: '360.00' },
    )

    expect(comparison.hasCommercialChange).toBe(true)
    expect(comparison.changes.some((c) => c.type === 'added_service')).toBe(true)
    expect(comparison.newTotal).toBe('360.00')
  })

  it('deve identificar alteração na quantidade de um material existente', () => {
    const osItems = mapQuoteItemsToServiceOrderItems(sampleQuoteItems)
    osItems[0] = { ...osItems[0], quantity: '4', total: '180.00' }

    const comparison = compareCommercialScope(
      { items: sampleQuoteItems, discount: '0.00', total: '240.00' },
      { items: osItems, discount: '0.00', total: '330.00' },
    )

    expect(comparison.hasCommercialChange).toBe(true)
    expect(comparison.changes).toHaveLength(1)
    expect(comparison.changes[0].type).toBe('quantity_changed')
    expect(comparison.changes[0].previousQuantity).toBe('2')
    expect(comparison.changes[0].newQuantity).toBe('4')
  })

  it('deve identificar alteração no valor unitário de um serviço existente', () => {
    const osItems = mapQuoteItemsToServiceOrderItems(sampleQuoteItems)
    osItems[1] = { ...osItems[1], unitPrice: '200.00', total: '200.00' }

    const comparison = compareCommercialScope(
      { items: sampleQuoteItems, discount: '0.00', total: '240.00' },
      { items: osItems, discount: '0.00', total: '290.00' },
    )

    expect(comparison.hasCommercialChange).toBe(true)
    expect(comparison.changes).toHaveLength(1)
    expect(comparison.changes[0].type).toBe('unit_price_changed')
    expect(comparison.changes[0].previousUnitPrice).toBe('150.00')
    expect(comparison.changes[0].newUnitPrice).toBe('200.00')
  })

  it('deve validar corretamente regras de geração de O.S., bloqueio de finalização e envio para venda', () => {
    // 1. Só gera O.S. de orçamento aprovado e sem O.S./venda prévia
    expect(canGenerateOsFromQuote({ status: 'approved' }).allowed).toBe(true)
    expect(canGenerateOsFromQuote({ status: 'sent' }).allowed).toBe(false)
    expect(canGenerateOsFromQuote({ status: 'approved', serviceOrderId: 'os-1' }).allowed).toBe(false)
    expect(canGenerateOsFromQuote({ status: 'approved', saleId: 'sale-1' }).allowed).toBe(false)

    // 2. Bloqueia finalização de O.S. quando pendente de aprovação ou com alterações não aprovadas
    expect(
      canFinalizeServiceOrder({
        osStatus: 'pending_approval',
        quoteId: 'q-1',
        quoteStatus: 'sent',
      }).allowed,
    ).toBe(false)
    expect(
      canFinalizeServiceOrder({
        osStatus: 'approved',
        quoteId: 'q-1',
        quoteStatus: 'approved',
        hasUnapprovedCommercialChanges: true,
      }).allowed,
    ).toBe(false)
    expect(
      canFinalizeServiceOrder({
        osStatus: 'approved',
        quoteId: 'q-1',
        quoteStatus: 'approved',
        hasUnapprovedCommercialChanges: false,
      }).allowed,
    ).toBe(true)

    // 3. Bloqueia envio para venda de O.S. não finalizada, pendente de aprovação ou já faturada
    expect(
      canSendServiceOrderToSale({
        osStatus: 'pending_approval',
        quoteId: 'q-1',
        quoteStatus: 'sent',
      }).allowed,
    ).toBe(false)
    expect(
      canSendServiceOrderToSale({
        osStatus: 'approved',
        quoteId: 'q-1',
        quoteStatus: 'approved',
      }).allowed,
    ).toBe(false)
    expect(
      canSendServiceOrderToSale({
        osStatus: 'ready',
        quoteId: 'q-1',
        quoteStatus: 'approved',
        saleId: null,
      }).allowed,
    ).toBe(true)
    expect(
      canSendServiceOrderToSale({
        osStatus: 'ready',
        quoteId: 'q-1',
        quoteStatus: 'approved',
        saleId: 'sale-1',
      }).allowed,
    ).toBe(false)

    // 4. Permite venda direta de orçamento aprovado sem O.S., mas bloqueia se já houver O.S. não finalizada
    expect(
      canSendQuoteDirectlyToSale({
        quoteStatus: 'approved',
        saleId: null,
        serviceOrderId: null,
      }).allowed,
    ).toBe(true)
    expect(
      canSendQuoteDirectlyToSale({
        quoteStatus: 'approved',
        saleId: null,
        serviceOrderId: 'os-1',
        serviceOrderStatus: 'pending_approval',
      }).allowed,
    ).toBe(false)
  })

  it('deve codificar e decodificar metadados de O.S. preservando observações operacionais', () => {
    const encoded = encodeOsInternalNotes(
      {
        quoteId: 'quote-123',
        quoteNumber: 'ORC-2026-0001',
        quoteVersion: 2,
        logicalStatus: 'pending_approval',
      },
      'Observação interna de bancada',
    )

    const parsed = parseOsInternalNotes(encoded)
    expect(parsed.metadata.quoteId).toBe('quote-123')
    expect(parsed.metadata.quoteNumber).toBe('ORC-2026-0001')
    expect(parsed.metadata.quoteVersion).toBe(2)
    expect(parsed.metadata.logicalStatus).toBe('pending_approval')
    expect(parsed.cleanNotes).toBe('Observação interna de bancada')
  })
})
