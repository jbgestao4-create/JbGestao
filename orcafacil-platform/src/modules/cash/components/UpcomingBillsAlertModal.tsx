import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import {
  cashBillsService,
  BILL_PAYMENT_METHOD_LABELS,
  type BillPaymentMethod,
  type CashBillAlert,
} from '../services/cash-bills.service'
import { cashSessionService } from '../services/cash-session.service'
import {
  AlertTriangle,
  Archive,
  BellRing,
  Calendar,
  CheckCircle2,
  Droplets,
  ExternalLink,
  FileText,
  Flame,
  Receipt,
  Truck,
  Unlock,
  Wifi,
  X,
  Zap,
} from 'lucide-react'

interface UpcomingBillsAlertModalProps {
  /** Se informado, força a abertura manual do modal (ex: botão no cabeçalho do Caixa) */
  forceOpen?: boolean
  onCloseForceOpen?: () => void
  onBillsUpdated?: () => void
}

function formatDatePtBr(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-')
  if (!y || !m || !d) return isoDate
  return `${d}/${m}/${y}`
}

export function UpcomingBillsAlertModal({
  forceOpen = false,
  onCloseForceOpen,
  onBillsUpdated,
}: UpcomingBillsAlertModalProps) {
  const { user, profile } = useAuth()
  const { currentOrganization } = useOrganization()
  const { canAccessDashboardModule, isLoading: isLoadingAccess } = useModuleAccess()
  const navigate = useNavigate()

  const canAccessCash = canAccessDashboardModule('MOD-05')

  const [alerts, setAlerts] = useState<CashBillAlert[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [hasOpenGeneralCash, setHasOpenGeneralCash] = useState<boolean>(true)
  const [selectedBillForPay, setSelectedBillForPay] = useState<string | null>(null)
  const [paymentMethodByBill, setPaymentMethodByBill] = useState<Record<string, BillPaymentMethod>>({})
  const [deductFromCashByBill, setDeductFromCashByBill] = useState<Record<string, boolean>>({})
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const checkGeneralCashStatus = useCallback(async () => {
    if (!currentOrganization) return false
    const sessionRes = await cashSessionService.getOpenCashManagementSession(currentOrganization.id)
    const isOpenNow = Boolean(sessionRes.success && sessionRes.data)
    setHasOpenGeneralCash(isOpenNow)
    return isOpenNow
  }, [currentOrganization])

  const loadAlerts = useCallback(async () => {
    if (!user || !currentOrganization) {
      setAlerts([])
      setIsOpen(false)
      return
    }

    if (isLoadingAccess) {
      return
    }

    if (!canAccessCash) {
      setAlerts([])
      setIsOpen(false)
      return
    }

    const [res] = await Promise.all([
      cashBillsService.getUpcomingDueAlerts(currentOrganization.id),
      checkGeneralCashStatus(),
    ])
    if (res.success) {
      setAlerts(res.data)
      if (res.data.length > 0) {
        const wasDismissed = cashBillsService.wasAlertDismissedInCurrentSession(currentOrganization.id)
        if (forceOpen || !wasDismissed) {
          setIsOpen(true)
        }
      } else {
        setIsOpen(false)
      }
    }
  }, [user, currentOrganization, isLoadingAccess, canAccessCash, forceOpen, checkGeneralCashStatus])

  useEffect(() => {
    void loadAlerts()
  }, [loadAlerts])

  useEffect(() => {
    if (forceOpen && canAccessCash) {
      void loadAlerts()
      setIsOpen(true)
    }
  }, [forceOpen, canAccessCash, loadAlerts])

  useEffect(() => {
    const onCashSessionOpened = async () => {
      if (!currentOrganization) return
      const pending = cashBillsService.consumePendingAlertPaymentForCashOpen(
        currentOrganization.id,
      )
      await checkGeneralCashStatus()
      if (pending) {
        setFeedbackMsg(null)
        const res = await cashBillsService.getUpcomingDueAlerts(currentOrganization.id)
        if (res.success && res.data.length > 0) {
          setAlerts(res.data)
          const targetBillId =
            pending.billId && res.data.some((b) => b.id === pending.billId)
              ? pending.billId
              : res.data[0].id
          setSelectedBillForPay(targetBillId)
          setHasOpenGeneralCash(true)
          setIsOpen(true)
        }
      }
    }

    const onUserLoggedIn = () => {
      cashBillsService.clearAllAlertDismissals()
      void loadAlerts()
    }

    window.addEventListener('general-cash-session-opened', onCashSessionOpened)
    window.addEventListener('orcafacil-user-logged-in', onUserLoggedIn)
    return () => {
      window.removeEventListener('general-cash-session-opened', onCashSessionOpened)
      window.removeEventListener('orcafacil-user-logged-in', onUserLoggedIn)
    }
  }, [currentOrganization, checkGeneralCashStatus, loadAlerts])

  // Permissão estrita: só exibe para usuários com permissão de acesso ao módulo de gerenciamento de caixa (MOD-05)
  if (!canAccessCash || (!isOpen && !forceOpen) || alerts.length === 0) {
    return null
  }

  const handleDismiss = () => {
    if (currentOrganization) {
      cashBillsService.dismissAlertForCurrentSession(currentOrganization.id)
    }
    setIsOpen(false)
    if (onCloseForceOpen) onCloseForceOpen()
  }

  const handleOpenGeneralCash = () => {
    if (currentOrganization) {
      cashBillsService.savePendingAlertPaymentForCashOpen(
        currentOrganization.id,
        selectedBillForPay,
      )
    }
    setIsOpen(false)
    if (onCloseForceOpen) onCloseForceOpen()
    window.dispatchEvent(new CustomEvent('open-general-cash-modal'))
    void navigate('/cash?openCash=true')
  }

  const handleTogglePayPanel = async (billId: string) => {
    if (selectedBillForPay === billId) {
      setSelectedBillForPay(null)
      return
    }
    setFeedbackMsg(null)
    await checkGeneralCashStatus()
    setSelectedBillForPay(billId)
  }

  const handlePayBill = async (bill: CashBillAlert) => {
    if (!currentOrganization) return
    setProcessingId(bill.id)
    setFeedbackMsg(null)

    const isOpenNow = await checkGeneralCashStatus()
    if (!isOpenNow) {
      setProcessingId(null)
      setFeedbackMsg({
        type: 'error',
        text: 'Para realizar o pagamento do boleto o caixa deve estar aberto.',
      })
      return
    }

    const method: BillPaymentMethod = paymentMethodByBill[bill.id] || 'money'
    const shouldDeduct = deductFromCashByBill[bill.id] !== false
    const operatorName = profile?.displayName || user?.email?.split('@')[0] || 'Operador'

    const res = await cashBillsService.payBill(currentOrganization.id, bill.id, {
      paymentMethod: method,
      paidAmount: bill.amount,
      deductFromOpenSession: shouldDeduct,
      operatorName,
      userId: user?.id || null,
      notes: 'Baixa realizada pelo Alerta Crítico de Vencimento',
    })

    setProcessingId(null)

    if (res.success) {
      const targetBalanceLabel =
        method === 'money' ? 'Saldo Físico' : 'Saldo em Conta'
      setFeedbackMsg({
        type: 'success',
        text: shouldDeduct
          ? `Baixa realizada com sucesso: "${bill.description}" (${formatCurrency(bill.amount)} via ${BILL_PAYMENT_METHOD_LABELS[method]}). Sangria descontada do ${targetBalanceLabel}!`
          : `Baixa realizada com sucesso: "${bill.description}" (${formatCurrency(bill.amount)} via ${BILL_PAYMENT_METHOD_LABELS[method]}).`,
      })
      setSelectedBillForPay(null)
      await loadAlerts()
      if (onBillsUpdated) onBillsUpdated()
    } else {
      setFeedbackMsg({
        type: 'error',
        text: res.error,
      })
    }
  }

  const handleArchiveBill = async (bill: CashBillAlert) => {
    if (!currentOrganization) return
    setProcessingId(bill.id)
    setFeedbackMsg(null)

    const res = await cashBillsService.updateBillStatus(currentOrganization.id, bill.id, 'archived')
    setProcessingId(null)

    if (res.success) {
      setFeedbackMsg({
        type: 'success',
        text: `Boleto "${bill.description}" removido/arquivado dos alertas pendentes.`,
      })
      await loadAlerts()
      if (onBillsUpdated) onBillsUpdated()
    } else {
      setFeedbackMsg({
        type: 'error',
        text: res.error,
      })
    }
  }

  const handleOpenAttachment = async (bill: CashBillAlert) => {
    let dataUrl = bill.attachmentDataUrl
    if (!dataUrl && currentOrganization) {
      const res = await cashBillsService.getBillAttachment(currentOrganization.id, bill.id)
      if (res.success && res.data) {
        dataUrl = res.data
        bill.attachmentDataUrl = dataUrl
      }
    }
    if (!dataUrl) return
    const win = window.open()
    if (win) {
      win.document.write(
        `<iframe src="${dataUrl}" style="width:100%;height:100vh;border:none;" title="${bill.attachmentName || bill.description}"></iframe>`,
      )
    }
  }

  const totalPendingAlertAmount = alerts.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0)

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Água':
        return <Droplets className="h-4 w-4 text-sky-600 dark:text-sky-400" />
      case 'Luz':
        return <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      case 'Internet':
        return <Wifi className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
      case 'Fornecedor':
        return <Truck className="h-4 w-4 text-orange-600 dark:text-orange-400" />
      default:
        return <Flame className="h-4 w-4 text-rose-600 dark:text-rose-400" />
    }
  }

  const getUrgencyBadge = (bill: CashBillAlert) => {
    if (bill.daysUntilDue < 0) {
      const daysLate = Math.abs(bill.daysUntilDue)
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/80 px-2.5 py-0.5 text-[11px] font-extrabold text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800">
          VENCIDO HÁ {daysLate} {daysLate === 1 ? 'DIA' : 'DIAS'}
        </span>
      )
    }
    if (bill.daysUntilDue === 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/80 px-2.5 py-0.5 text-[11px] font-extrabold text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
          VENCE HOJE!
        </span>
      )
    }
    if (bill.daysUntilDue <= 3) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          VENCE EM {bill.daysUntilDue} {bill.daysUntilDue === 1 ? 'DIA' : 'DIAS'}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 dark:bg-yellow-950/60 px-2.5 py-0.5 text-[11px] font-semibold text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
        VENCE EM {bill.daysUntilDue} DIAS
      </span>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="critical-bills-alert-title"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-amber-200 dark:border-amber-900/60 overflow-hidden">
        {/* Cabeçalho de Alerta Crítico */}
        <div className="flex items-center justify-between border-b border-amber-200/80 dark:border-amber-900/50 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950/60 dark:via-slate-900 dark:to-rose-950/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <BellRing className="h-6 w-6 animate-bounce" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="critical-bills-alert-title"
                  className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white"
                >
                  Alerta Crítico: Boletos e Contas a Vencer
                </h2>
                <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  {alerts.length} {alerts.length === 1 ? 'Pendente' : 'Pendentes'}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">
                Existem boletos pendentes com vencimento nos próximos 10 dias (Total:{' '}
                <strong className="text-rose-700 dark:text-rose-400">
                  {formatCurrency(totalPendingAlertAmount)}
                </strong>
                ).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-white/80 dark:hover:bg-slate-800 hover:text-gray-800 dark:text-slate-400 dark:hover:text-white transition"
            aria-label="Fechar alerta"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lista de Boletos Críticos */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {feedbackMsg && (
            <div
              className={`rounded-xl p-3 text-xs font-semibold border flex items-center justify-between gap-2 ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              }`}
            >
              <div className="flex items-start gap-2">
                {feedbackMsg.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                )}
                <span>{feedbackMsg.text}</span>
              </div>
              {feedbackMsg.type === 'error' && !hasOpenGeneralCash && (
                <button
                  type="button"
                  onClick={handleOpenGeneralCash}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
                >
                  <Unlock className="h-3.5 w-3.5" />
                  Abrir Caixa Geral
                </button>
              )}
            </div>
          )}

          {alerts.map((bill) => {
            const isPayingThis = selectedBillForPay === bill.id
            const isProcessing = processingId === bill.id
            const currentMethod = paymentMethodByBill[bill.id] || 'money'
            const shouldDeduct = deductFromCashByBill[bill.id] !== false

            return (
              <div
                key={bill.id}
                className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40 p-4 transition-all hover:border-amber-300 dark:hover:border-amber-800"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-2 py-0.5 text-[11px] font-bold text-gray-700 dark:text-slate-200">
                        {getCategoryIcon(bill.category)}
                        {bill.category}
                      </span>
                      {getUrgencyBadge(bill)}
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
                        <Calendar className="h-3.5 w-3.5" />
                        Venc.: <strong className="text-gray-800 dark:text-slate-200">{formatDatePtBr(bill.dueDate)}</strong>
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {bill.description}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
                      {bill.beneficiaryName && (
                        <span>
                          Beneficiário: <strong className="text-gray-700 dark:text-slate-300">{bill.beneficiaryName}</strong>
                        </span>
                      )}
                      {bill.supplierName && (
                        <span>
                          Fornecedor: <strong className="text-gray-700 dark:text-slate-300">{bill.supplierName}</strong>
                        </span>
                      )}
                      {bill.barcode && (
                        <span className="font-mono text-[11px] text-gray-500 dark:text-slate-400 truncate max-w-xs">
                          Cód.: {bill.barcode}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] font-semibold uppercase text-gray-400 dark:text-slate-500 block">
                        Valor do Boleto
                      </span>
                      <span className="text-lg font-extrabold text-rose-600 dark:text-rose-400">
                        {formatCurrency(bill.amount)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {(bill.attachmentName || bill.attachmentDataUrl) && (
                        <button
                          type="button"
                          onClick={() => handleOpenAttachment(bill)}
                          title="Visualizar Boleto em PDF"
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5 text-blue-600" />
                          PDF
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => void handleTogglePayPanel(bill.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Dar Baixa (Pagar)
                      </button>

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => void handleArchiveBill(bill)}
                        title="Remover / Arquivar deste alerta"
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 transition cursor-pointer disabled:opacity-50"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Remover
                      </button>
                    </div>
                  </div>
                </div>

                {/* Painel expansível de confirmação rápida de pagamento (Dar Baixa) */}
                {isPayingThis && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700 space-y-3 bg-emerald-50/60 dark:bg-emerald-950/30 p-3.5 rounded-xl">
                    {!hasOpenGeneralCash ? (
                      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold">Caixa Geral Fechado</p>
                            <p className="mt-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                              Para realizar o pagamento do boleto o caixa deve estar aberto.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenGeneralCash}
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
                        >
                          <Unlock className="h-3.5 w-3.5" />
                          Abrir Caixa Geral
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1">
                            <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-300 mb-1">
                              Forma de Pagamento para Saída no Caixa:
                            </label>
                            <select
                              value={currentMethod}
                              onChange={(e) =>
                                setPaymentMethodByBill((prev) => ({
                                  ...prev,
                                  [bill.id]: e.target.value as BillPaymentMethod,
                                }))
                              }
                              className="w-full sm:w-80 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-gray-800 dark:text-slate-100 focus:outline-hidden"
                            >
                              {(Object.keys(BILL_PAYMENT_METHOD_LABELS) as BillPaymentMethod[]).map((m) => (
                                <option key={m} value={m}>
                                  {BILL_PAYMENT_METHOD_LABELS[m]}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedBillForPay(null)}
                              className="rounded-lg text-xs"
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              isLoading={isProcessing}
                              onClick={() => void handlePayBill(bill)}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              Confirmar Pagamento ({formatCurrency(bill.amount)})
                            </Button>
                          </div>
                        </div>

                        {/* Caixa perguntando se deseja realizar a sangria */}
                        <label className="flex items-start gap-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-white/80 dark:bg-slate-900/60 p-2.5 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={shouldDeduct}
                            onChange={(e) =>
                              setDeductFromCashByBill((prev) => ({
                                ...prev,
                                [bill.id]: e.target.checked,
                              }))
                            }
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="space-y-0.5">
                            <span className="font-bold text-gray-900 dark:text-white block">
                              Deseja realizar a sangria no caixa?
                            </span>
                            <span className="text-[11px] text-gray-600 dark:text-slate-300 block">
                              {currentMethod === 'money' ? (
                                <>
                                  Ao confirmar em <strong>Dinheiro</strong>, o valor será descontado do{' '}
                                  <strong className="text-emerald-700 dark:text-emerald-400">Saldo Físico</strong>.
                                </>
                              ) : (
                                <>
                                  Ao confirmar em <strong>PIX, Cartões ou Sangrias p/ Conta</strong>, o valor será descontado do{' '}
                                  <strong className="text-indigo-700 dark:text-indigo-400">Saldo em Conta</strong>.
                                </>
                              )}
                            </span>
                          </div>
                        </label>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Rodapé do Modal */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/90 px-6 py-3.5">
          <p className="text-[11px] text-gray-500 dark:text-slate-400">
            Este aviso é exclusivo para operadores autorizados do Caixa e permanecerá ativo diariamente até a baixa ou arquivamento.
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                handleDismiss()
                void navigate('/cash?tab=bills')
              }}
              className="rounded-xl text-xs font-semibold gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Gerenciar no Caixa
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDismiss}
              className="rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold"
            >
              Ciente, lembrar depois
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

