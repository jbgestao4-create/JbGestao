import { dbLocal, type VendaOffline, type ItemVendaLocal } from './db'
import type { SaleDetail, PaymentMethod } from '@modules/sales/services/sales.service'
import type { InventoryItem } from '@shared/types/common'

export const offlineSalesService = {
  /**
   * Converte a lista de produtos locais do IndexedDB para o formato InventoryItem
   */
  async loadOfflineInventory(): Promise<InventoryItem[]> {
    try {
      const produtos = await dbLocal.produtos.toArray()
      const items = produtos.map((p) => ({
        id: p.id,
        organizationId: '',
        sku: p.codigo_barras || '',
        barcode: p.codigo_barras || '',
        description: p.nome,
        name: p.nome,
        category: p.categoria || 'Geral',
        unit: 'UN',
        costPrice: '0.00',
        salePrice: p.preco_venda.toFixed(2),
        minimumStock: '0',
        maximumStock: '999999',
        quantityOnHand: p.estoque_atual.toString(),
        attributes: {},
        isActive: true,
        canSell: true,
        registrationStatus: 'completed' as const,
        createdAt: p.data_atualizacao,
        updatedAt: p.data_atualizacao,
      }))
      return items as unknown as InventoryItem[]
    } catch (err) {
      console.warn('[OfflineSalesService] Falha ao ler estoque local:', err)
      return []
    }
  },

  /**
   * Registra uma venda no IndexedDB local com abatimento atômico de estoque
   * e retorna a estrutura SaleDetail compatível com o modal de cupom não fiscal.
   */
  async recordOfflineSale(params: {
    organizationId: string
    userId: string
    operatorName: string
    customerName: string
    customerDocument?: string
    paymentMethod: PaymentMethod
    items: Array<{
      inventoryItemId?: string | null
      description: string
      unit: string
      quantity: string
      unitPrice: string
    }>
    discount: string | number
    total: string | number
    amountReceived: string
    changeAmount: string
  }): Promise<{ success: boolean; data: SaleDetail }> {
    const uuidVenda = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    const dataHora = new Date().toISOString()
    const numericTotal = Number(params.total) || 0
    const numericDiscount = Number(params.discount) || 0

    const itensOffline: ItemVendaLocal[] = params.items.map((it) => ({
      produto_id: it.inventoryItemId || '',
      codigo_barras: '',
      nome: it.description,
      quantidade: Number(it.quantity) || 1,
      preco_unitario: Number(it.unitPrice) || 0,
      subtotal: (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
    }))

    const novaVendaOffline: VendaOffline = {
      uuid_venda: uuidVenda,
      data_hora: dataHora,
      usuario_id: params.userId,
      organizacao_id: params.organizationId,
      itens: itensOffline,
      valor_total: numericTotal,
      forma_pagamento: params.paymentMethod,
      status_sincronizacao: 'pendente',
    }

    // Transação atômica no Dexie
    await dbLocal.transaction('rw', [dbLocal.produtos, dbLocal.vendas_offline], async () => {
      // Abate estoque local
      for (const it of itensOffline) {
        if (it.produto_id) {
          const prod = await dbLocal.produtos.get(it.produto_id)
          if (prod) {
            const novoEstoque = Math.max(0, prod.estoque_atual - it.quantidade)
            await dbLocal.produtos.update(it.produto_id, {
              estoque_atual: novoEstoque,
              data_atualizacao: new Date().toISOString(),
            })
          }
        }
      }

      await dbLocal.vendas_offline.add(novaVendaOffline)
    })

    const saleDetailMock: SaleDetail = {
      id: uuidVenda,
      saleNumber: `OFF-${uuidVenda.slice(0, 8).toUpperCase()}`,
      organizationId: params.organizationId,
      customerId: 'offline_customer',
      customerName: params.customerName || 'Consumidor Final',
      customerEmail: null,
      customerPhone: null,
      customerDocument: params.customerDocument || null,
      customerAddress: null,
      creatorName: params.operatorName,
      sellerName: params.operatorName,
      operatorName: params.operatorName,
      status: 'approved',
      subtotal: (numericTotal + numericDiscount).toFixed(2),
      discount: numericDiscount.toFixed(2),
      total: numericTotal.toFixed(2),
      paymentMethod: params.paymentMethod,
      notes: 'Venda processada em contingência offline (armazenada localmente no IndexedDB).',
      createdAt: dataHora,
      updatedAt: dataHora,
      isPdv: true,
      items: params.items.map((it, idx) => ({
        id: `item-${idx}`,
        inventoryItemId: it.inventoryItemId || null,
        description: it.description,
        unit: it.unit || 'UN',
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: ((Number(it.quantity) || 1) * (Number(it.unitPrice) || 0)).toFixed(2),
      })),
    }

    return {
      success: true,
      data: saleDetailMock,
    }
  },
}
