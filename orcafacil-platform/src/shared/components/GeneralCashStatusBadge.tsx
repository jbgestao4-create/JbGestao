import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@app/config/supabase'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { cashSessionService } from '@modules/cash/services/cash-session.service'
import type { CashSession } from '@modules/cash/domain/cash-session'
import { Button } from '@shared/components/ui/Button'
import { Unlock, Lock, Store, X, AlertCircle } from 'lucide-react'

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

export function GeneralCashStatusBadge() {
  const { currentOrganization } = useOrganization()
  const { user, profile } = useAuth()
  const { canAccessDashboardModule } = useModuleAccess()

  const [status, setStatus] = useState<'loading' | 'open' | 'closed'>('loading')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoadingSession, setIsLoadingSession] = useState(false)
  const [isSubmittingSession, setIsSubmittingSession] = useState(false)
  const [lastClosedSession, setLastClosedSession] = useState<CashSession | null>(null)
  const [initialBalanceStr, setInitialBalanceStr] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const checkGeneralCash = useCallback(async () => {
    if (!currentOrganization?.id) {
      setStatus('closed')
      return
    }
    const isOpen = await cashSessionService.isCashManagementOpen(currentOrganization.id)
    setStatus(isOpen ? 'open' : 'closed')
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

    return () => {
      window.removeEventListener('general-cash-session-opened', handleRefresh)
      window.removeEventListener('general-cash-session-closed', handleRefresh)
      window.removeEventListener('focus', handleRefresh)
      void supabase.removeChannel(channel)
    }
  }, [currentOrganization?.id, checkGeneralCash])

  const handleOpenModal = async () => {
    if (!currentOrganization?.id) return
    setSubmitError(null)
    setIsLoadingSession(true)
    setIsModalOpen(true)

    try {
      const res = await cashSessionService.getLastClosedSession(currentOrganization.id, 'cash_management')
      if (res.success && res.data) {
        setLastClosedSession(res.data)
        const lastVal =
          res.data.countedMoney !== null &&
          res.data.countedMoney !== undefined &&
          res.data.countedMoney !== ''
            ? parseFloat(res.data.countedMoney)
            : parseFloat(res.data.expectedMoney) || 0
        setInitialBalanceStr(
          lastVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        )
      } else {
        setLastClosedSession(null)
        setInitialBalanceStr('')
      }
    } catch {
      setLastClosedSession(null)
      setInitialBalanceStr('')
    } finally {
      setIsLoadingSession(false)
    }
  }

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrganization || !user) return
    setIsSubmittingSession(true)
    setSubmitError(null)

    try {
      const cleanBalance =
        parseFloat(initialBalanceStr.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0

      const lastClosedAmount = lastClosedSession
        ? (lastClosedSession.countedMoney !== null &&
           lastClosedSession.countedMoney !== undefined &&
           lastClosedSession.countedMoney !== ''
            ? parseFloat(lastClosedSession.countedMoney)
            : parseFloat(lastClosedSession.expectedMoney) || 0)
        : null

      const finalBalance = lastClosedAmount !== null ? lastClosedAmount : cleanBalance
      const opName = profile?.displayName || user.email?.split('@')[0] || 'Administrador'

      const res = await cashSessionService.openSession(currentOrganization.id, {
        registerId: 'Caixa Geral',
        registerName: 'Caixa Geral da Empresa',
        sessionType: 'cash_management',
        operatorId: user.id,
        openingBalance: finalBalance,
        operatorName: opName,
      })

      if (res.success && res.data) {
        setIsModalOpen(false)
        setStatus('open')
        window.dispatchEvent(new CustomEvent('general-cash-session-opened'))
      } else {
        setSubmitError((!res.success && res.error) || 'Erro ao abrir sessão de caixa.')
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao abrir sessão de caixa.')
    } finally {
      setIsSubmittingSession(false)
    }
  }

  const isOpen = status === 'open'
  const isLoading = status === 'loading'
  const canAccessCashModule = canAccessDashboardModule('MOD-05')
  const canOpenCash = !isLoading && !isOpen && canAccessCashModule

  return (
    <>
      {canOpenCash ? (
        <button
          type="button"
          onClick={() => void handleOpenModal()}
          className="inline-flex items-center gap-2 rounded-lg border border-sky-200/80 dark:border-slate-800 bg-white/80 dark:bg-[#111827] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs shrink-0 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-all text-left"
          aria-live="polite"
          title="O Caixa Geral da empresa encontra-se fechado. Clique para abrir."
        >
          <span className="h-2 w-2 rounded-full shrink-0 bg-rose-500" />
          <span className="whitespace-nowrap">Caixa Geral Fechado</span>
          <span className="hidden sm:inline-block text-[10px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded ml-0.5">
            Abrir
          </span>
        </button>
      ) : (
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
      )}

      {/* MODAL: ABERTURA DE CAIXA GERAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b pb-4 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <Unlock className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Abertura de Caixa
                  </h3>
                  <p className="text-xs text-zinc-500">Inicie o turno informando o fundo de troco</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {submitError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleOpenSession} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Escopo do Caixa
                </label>
                <div className="mt-1 flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
                  <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                    <Store className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Caixa Geral da Empresa (Controle Diário)
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Consolida vendas dos PDVs, contas pagas, sangrias e suprimentos do dia.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Saldo Inicial / Fundo de Troco (R$)
                </label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2 text-xs text-zinc-400">R$</span>
                  <input
                    type="text"
                    required
                    readOnly={lastClosedSession !== null}
                    placeholder="100,00"
                    value={initialBalanceStr}
                    onChange={(e) => {
                      if (!lastClosedSession) {
                        setInitialBalanceStr(e.target.value)
                      }
                    }}
                    className={`w-full rounded-xl border py-2 pl-9 pr-10 text-sm font-semibold dark:bg-zinc-800 ${
                      lastClosedSession
                        ? 'border-emerald-300 bg-emerald-50/60 text-emerald-950 cursor-not-allowed dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
                        : 'border-zinc-300 text-zinc-900 dark:border-zinc-700 dark:text-zinc-100'
                    }`}
                  />
                  {lastClosedSession && (
                    <span
                      className="absolute right-3 top-2.5 text-emerald-600 dark:text-emerald-400"
                      title="Saldo obrigatório herdado do último fechamento de caixa"
                    >
                      <Lock className="h-4 w-4" />
                    </span>
                  )}
                </div>

                {lastClosedSession ? (
                  <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-800 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>Saldo herdado obrigatoriamente do último caixa fechado</span>
                    </div>
                    <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                      O último caixa fechou com{' '}
                      <strong>
                        {formatCurrency(
                          lastClosedSession.countedMoney !== null &&
                          lastClosedSession.countedMoney !== undefined &&
                          lastClosedSession.countedMoney !== ''
                            ? parseFloat(lastClosedSession.countedMoney)
                            : parseFloat(lastClosedSession.expectedMoney) || 0
                        )}
                      </strong>
                      {lastClosedSession.closedAt && (
                        <> em {new Date(lastClosedSession.closedAt).toLocaleDateString('pt-BR')} às {new Date(lastClosedSession.closedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</>
                      )}
                      {lastClosedSession.operatorName && <> por {lastClosedSession.operatorName}</>}.
                    </p>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[11px] text-zinc-500">
                    Nenhum caixa anterior fechado encontrado. Defina o saldo inicial para a primeira abertura do Caixa Geral.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t pt-4 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmittingSession}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingSession || isLoadingSession}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSubmittingSession ? 'Abrindo...' : 'Confirmar Abertura'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
