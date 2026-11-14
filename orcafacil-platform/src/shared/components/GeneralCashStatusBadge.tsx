import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@app/config/supabase'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { cashSessionService } from '@modules/cash/services/cash-session.service'

export function GeneralCashStatusBadge() {
  const { currentOrganization } = useOrganization()
  const [status, setStatus] = useState<'loading' | 'open' | 'closed'>('loading')

  const checkGeneralCash = useCallback(async () => {
    if (!currentOrganization?.id) {
      setStatus('closed')
      return
    }
    const res = await cashSessionService.getOpenCashManagementSession(currentOrganization.id)
    if (res.success && res.data && res.data.status === 'open') {
      setStatus('open')
    } else {
      setStatus('closed')
    }
  }, [currentOrganization?.id])

  useEffect(() => {
    void checkGeneralCash()

    if (!currentOrganization?.id) return

    const orgId = currentOrganization.id

    const handleRefresh = () => {
      void checkGeneralCash()
    }

    window.addEventListener('general-cash-session-opened', handleRefresh)
    window.addEventListener('general-cash-session-closed', handleRefresh)
    window.addEventListener('focus', handleRefresh)

    const channelName = `header-general-cash-${orgId}-${Math.random().toString(36).substring(2, 9)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cash_sessions',
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          void checkGeneralCash()
        },
      )
      .subscribe()

    const interval = window.setInterval(() => {
      void checkGeneralCash()
    }, 60000)

    return () => {
      window.removeEventListener('general-cash-session-opened', handleRefresh)
      window.removeEventListener('general-cash-session-closed', handleRefresh)
      window.removeEventListener('focus', handleRefresh)
      window.clearInterval(interval)
      void supabase.removeChannel(channel)
    }
  }, [currentOrganization?.id, checkGeneralCash])

  const isOpen = status === 'open'
  const isLoading = status === 'loading'

  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg border border-sky-200/80 dark:border-slate-800 bg-white/80 dark:bg-[#111827] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs shrink-0"
      aria-live="polite"
      title={
        isLoading
          ? 'Verificando status do Caixa Geral...'
          : isOpen
            ? 'O Caixa Geral da empresa encontra-se aberto'
            : 'O Caixa Geral da empresa encontra-se fechado'
      }
    >
      <span
        className={`h-2 w-2 rounded-full shrink-0 ${
          isLoading
            ? 'animate-pulse bg-amber-400'
            : isOpen
              ? 'bg-emerald-500 animate-pulse'
              : 'bg-rose-500'
        }`}
      />
      <span className="whitespace-nowrap">
        {isLoading
          ? 'Verificando Caixa...'
          : isOpen
            ? 'Caixa Geral Aberto'
            : 'Caixa Geral Fechado'}
      </span>
    </div>
  )
}
