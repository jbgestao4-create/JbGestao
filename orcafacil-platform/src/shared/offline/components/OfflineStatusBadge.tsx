import React, { useEffect, useState } from 'react'
import { Cloud, CloudOff, RefreshCw, HardDriveDownload } from 'lucide-react'
import { syncEngine, type SyncStats } from '../sync.engine'

interface OfflineStatusBadgeProps {
  onOpenActivationModal?: () => void
  compact?: boolean
}

export const OfflineStatusBadge: React.FC<OfflineStatusBadgeProps> = ({
  onOpenActivationModal,
  compact = false,
}) => {
  const [stats, setStats] = useState<SyncStats>({
    pendentes: 0,
    sincronizadas: 0,
    isSyncing: false,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  })

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((newStats) => {
      setStats(newStats)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const handleForcarSync = () => {
    void syncEngine.syncPendingSales()
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {stats.isOnline ? (
          <span
            title="Conectado à Internet"
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-xs font-semibold text-emerald-400"
          >
            <Cloud className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Online</span>
          </span>
        ) : (
          <span
            title="Operando no Modo Offline (IndexedDB)"
            className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-xs font-semibold text-amber-400 animate-pulse"
          >
            <CloudOff className="h-3.5 w-3.5" />
            <span>Offline</span>
          </span>
        )}

        {stats.pendentes > 0 && (
          <button
            type="button"
            onClick={handleForcarSync}
            disabled={stats.isSyncing || !stats.isOnline}
            title={`${stats.pendentes} venda(s) pendente(s) de envio. Clique para sincronizar.`}
            className="flex items-center gap-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 text-xs font-bold text-rose-300 hover:bg-rose-500/30 transition disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${stats.isSyncing ? 'animate-spin' : ''}`} />
            <span>{stats.pendentes} pendente{stats.pendentes > 1 ? 's' : ''}</span>
          </button>
        )}

        {onOpenActivationModal && (
          <button
            type="button"
            onClick={onOpenActivationModal}
            title="Baixar Dados para Uso Offline"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 px-2.5 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-600/30 transition cursor-pointer"
          >
            <HardDriveDownload className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Baixar Offline</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold border ${
          stats.isOnline
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        }`}
      >
        {stats.isOnline ? <Cloud className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
        <span>{stats.isOnline ? 'Conexão Ativa' : 'Modo Offline Ativo'}</span>
      </div>

      {stats.pendentes > 0 ? (
        <button
          type="button"
          onClick={handleForcarSync}
          disabled={stats.isSyncing || !stats.isOnline}
          className="flex items-center gap-2 rounded-xl bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/30 transition cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${stats.isSyncing ? 'animate-spin' : ''}`} />
          <span>
            {stats.pendentes} venda(s) pendente(s) {stats.isSyncing ? '(Sincronizando...)' : '- Enviar Agora'}
          </span>
        </button>
      ) : (
        <span className="text-xs text-slate-400">Todas as vendas locais sincronizadas</span>
      )}

      {onOpenActivationModal && (
        <button
          type="button"
          onClick={onOpenActivationModal}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500 transition shadow-sm cursor-pointer"
        >
          <HardDriveDownload className="h-4 w-4" />
          <span>Baixar Dados para Uso Offline</span>
        </button>
      )}
    </div>
  )
}
