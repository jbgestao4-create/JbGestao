import Dexie, { type Table } from 'dexie'

export interface ProdutoLocal {
  id: string
  codigo_barras: string
  nome: string
  preco_venda: number
  estoque_atual: number
  categoria?: string
  data_atualizacao: string
}

export interface ItemVendaLocal {
  produto_id: string
  codigo_barras: string
  nome: string
  quantidade: number
  preco_unitario: number
  subtotal: number
}

export interface VendaOffline {
  id?: number
  uuid_venda: string
  data_hora: string
  usuario_id: string
  organizacao_id: string
  itens: ItemVendaLocal[]
  valor_total: number
  forma_pagamento: string
  status_sincronizacao: 'pendente' | 'sincronizado'
  tentativas_sync?: number
  erro_sincronizacao?: string
}

export interface ConfigLocal {
  chave: string
  valor: any
}

export class JbOfflineDatabase extends Dexie {
  produtos!: Table<ProdutoLocal, string>
  vendas_offline!: Table<VendaOffline, number>
  config_local!: Table<ConfigLocal, string>

  constructor() {
    super('JbGestao_PDV_Offline')

    this.version(1).stores({
      produtos: 'id, codigo_barras, nome, categoria',
      vendas_offline: '++id, &uuid_venda, status_sincronizacao, data_hora',
      config_local: '&chave',
    })

    this.version(2).stores({
      produtos: 'id, codigo_barras, nome, categoria',
      vendas_offline: '++id, &uuid_venda, status_sincronizacao, data_hora',
      config_local: '&chave',
    })
  }
}

export const dbLocal = new JbOfflineDatabase()
