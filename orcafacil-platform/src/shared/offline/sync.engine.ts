import { dbLocal } from './db'
import { supabase } from '@app/config/supabase'

export interface SyncStats {
  pendentes: number
  sincronizadas: number
  isSyncing: boolean
  isOnline: boolean
}

type SyncListener = (stats: SyncStats) => void

class SyncEngine {
  private isSyncing = false
  private listeners: Set<SyncListener> = new Set()
  private timer: any = null

  public init() {
    if (typeof window === 'undefined') return

    // Escuta eventos do navegador
    window.addEventListener('online', () => {
      this.notify()
      void this.syncPendingSales()
    })

    window.addEventListener('offline', () => {
      this.notify()
    })

    // Heartbeat periódico (a cada 30 segundos tenta sincronizar se houver vendas pendentes e internet)
    if (!this.timer) {
      this.timer = setInterval(() => {
        if (navigator.onLine && !this.isSyncing) {
          void this.syncPendingSales()
        }
      }, 30000)
    }

    // Tenta uma sincronização inicial
    void this.syncPendingSales()
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener)
    void this.getStats().then(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public async getStats(): Promise<SyncStats> {
    try {
      const pendentes = await dbLocal.vendas_offline
        .where('status_sincronizacao')
        .equals('pendente')
        .count()

      const sincronizadas = await dbLocal.vendas_offline
        .where('status_sincronizacao')
        .equals('sincronizado')
        .count()

      return {
        pendentes,
        sincronizadas,
        isSyncing: this.isSyncing,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      }
    } catch {
      return {
        pendentes: 0,
        sincronizadas: 0,
        isSyncing: this.isSyncing,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      }
    }
  }

  private async notify() {
    const stats = await this.getStats()
    this.listeners.forEach((fn) => fn(stats))
  }

  public async syncPendingSales(): Promise<{ sincronizadas: number; erros: number }> {
    if (this.isSyncing || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return { sincronizadas: 0, erros: 0 }
    }

    this.isSyncing = true
    await this.notify()

    let sincronizadasCount = 0
    let errosCount = 0

    try {
      const pendentes = await dbLocal.vendas_offline
        .where('status_sincronizacao')
        .equals('pendente')
        .toArray()

      for (const venda of pendentes) {
        try {
          const { error } = await supabase.rpc('processar_venda_offline_idempotente', {
            p_uuid_venda: venda.uuid_venda,
            p_data_hora: venda.data_hora,
            p_usuario_id: venda.usuario_id,
            p_organizacao_id: venda.organizacao_id,
            p_itens: venda.itens,
            p_valor_total: venda.valor_total,
            p_forma_pagamento: venda.forma_pagamento,
          })

          if (error) {
            throw error
          }

          if (venda.id) {
            await dbLocal.vendas_offline.update(venda.id, {
              status_sincronizacao: 'sincronizado',
              erro_sincronizacao: undefined,
            })
            sincronizadasCount++
          }
        } catch (err: any) {
          errosCount++
          console.warn(`[SyncEngine] Falha ao sincronizar venda ${venda.uuid_venda}:`, err)
          if (venda.id) {
            await dbLocal.vendas_offline.update(venda.id, {
              tentativas_sync: (venda.tentativas_sync || 0) + 1,
              erro_sincronizacao: err.message || 'Erro de comunicação',
            })
          }
        }
      }
    } catch (err) {
      console.error('[SyncEngine] Erro geral ao consultar banco local:', err)
    } finally {
      this.isSyncing = false
      await this.notify()
    }

    return { sincronizadas: sincronizadasCount, erros: errosCount }
  }
}

export const syncEngine = new SyncEngine()
