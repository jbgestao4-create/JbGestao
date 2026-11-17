import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarClock,
  Plus,
  Minus,
  AlertCircle,
  X,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Ban,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import {
  companyManagementService,
  type ManagedCompany,
} from '../services/company-management.service'
import {
  calculateCompanyLicenseStatus,
  calculateNewLicenseExpiry,
  type LicenseAdjustmentAction,
} from '../utils/license.utils'

interface AdjustCompanyLicenseModalProps {
  company: ManagedCompany | null
  isOpen: boolean
  onClose: () => void
  onSuccess: (message: string) => void
}

export function AdjustCompanyLicenseModal({
  company,
  isOpen,
  onClose,
  onSuccess,
}: AdjustCompanyLicenseModalProps) {
  if (!isOpen || !company) return null

  return (
    <AdjustCompanyLicenseContent
      company={company}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  )
}

function AdjustCompanyLicenseContent({
  company,
  onClose,
  onSuccess,
}: {
  company: ManagedCompany
  onClose: () => void
  onSuccess: (message: string) => void
}) {
  const [actionType, setActionType] = useState<LicenseAdjustmentAction>('increase')
  const [daysAmount, setDaysAmount] = useState<number | ''>(30)
  const [reason, setReason] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const effectiveDays = typeof daysAmount === 'number' ? daysAmount : parseInt(daysAmount, 10) || 0

  // Status atual de licença
  const currentLicense = useMemo(() => {
    return calculateCompanyLicenseStatus(company.trialEndsAt, company.isActive)
  }, [company.trialEndsAt, company.isActive])

  // Cálculo da projeção futura com o ajuste determinístico e infalível
  const projection = useMemo(() => {
    const calc = calculateNewLicenseExpiry(company.trialEndsAt, actionType, effectiveDays)
    return {
      newDate: new Date(calc.newExpiryIso),
      newRemainingDays: calc.newRemainingDays,
      newGraceDaysRemaining: calc.newGraceDaysRemaining,
      previousRemainingDays: calc.previousRemainingDays,
      newExpiryIso: calc.newExpiryIso,
      daysDelta: calc.daysDelta,
      isBlocked: calc.isBlocked,
      statusBadge: calc.statusBadge,
    }
  }, [company.trialEndsAt, actionType, effectiveDays])

  const handleQuickDays = (d: number) => {
    setDaysAmount(d)
    setErrorMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (actionType !== 'reset_block') {
      if (!effectiveDays || effectiveDays <= 0) {
        setErrorMessage('Informe a quantidade de dias para realizar o ajuste.')
        return
      }
    }

    if (!reason || reason.trim().length < 5) {
      setErrorMessage(
        actionType === 'reset_block'
          ? 'Informe obrigatoriamente o motivo do bloqueio imediato (mínimo 5 caracteres).'
          : 'Informe obrigatoriamente o motivo do ajuste de licença (mínimo 5 caracteres).'
      )
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    const res = await companyManagementService.adjustLicenseDays(
      company.id,
      projection.daysDelta,
      reason.trim(),
      projection.newExpiryIso,
    )

    setIsSubmitting(false)

    if (res.success) {
      let msg = ''
      if (actionType === 'reset_block') {
        msg = `Licença da empresa ${company.name} foi zerada e o acesso bloqueado com sucesso!`
      } else if (actionType === 'increase') {
        msg = `+${effectiveDays} dias adicionados com sucesso à empresa ${company.name}! Novo saldo: ${projection.newRemainingDays} dias.`
      } else {
        msg = `-${effectiveDays} dias reduzidos da empresa ${company.name}. Novo status: ${projection.statusBadge}.`
      }
      onSuccess(msg)
      onClose()
    } else {
      setErrorMessage(res.error || 'Erro ao ajustar dias de licença da empresa.')
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-gray-100 dark:border-slate-800 animate-in fade-in-50 zoom-in-95 my-8">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                actionType === 'reset_block'
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400'
                  : actionType === 'increase'
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400'
                    : 'bg-amber-50 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400'
              }`}
            >
              {actionType === 'reset_block' ? (
                <Ban className="h-6 w-6" />
              ) : (
                <CalendarClock className="h-6 w-6" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Ajustar Dias de Licença
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Empresa: <strong className="text-gray-800 dark:text-slate-200">{company.name}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Card com status atual de licença */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/50">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-slate-400 font-medium">Situação Atual:</span>
              <span
                className={`font-bold inline-flex items-center gap-1.5 ${
                  currentLicense.badgeVariant === 'active'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : currentLicense.badgeVariant === 'grace'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {currentLicense.badgeVariant === 'active' ? (
                  <ShieldCheck className="h-3.5 w-3.5" />
                ) : (
                  <ShieldAlert className="h-3.5 w-3.5" />
                )}
                {currentLicense.badgeText}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
              {currentLicense.description}
            </div>
          </div>

          {/* Seletor: Aumentar (+) | Diminuir (-) | Zerar & Bloquear */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-2">
              Tipo de Ajuste:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (actionType !== 'increase') {
                    setActionType('increase')
                    setDaysAmount('')
                    setErrorMessage(null)
                  }
                }}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-2xl border p-2.5 text-xs font-bold transition cursor-pointer text-center ${
                  actionType === 'increase'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs dark:bg-emerald-950/50 dark:border-emerald-500 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                <Plus className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Aumentar (+)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (actionType !== 'decrease') {
                    setActionType('decrease')
                    setDaysAmount('')
                    setErrorMessage(null)
                  }
                }}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-2xl border p-2.5 text-xs font-bold transition cursor-pointer text-center ${
                  actionType === 'decrease'
                    ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-xs dark:bg-amber-950/50 dark:border-amber-500 dark:text-amber-300 ring-2 ring-amber-500/20'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                <Minus className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Diminuir (-)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (actionType !== 'reset_block') {
                    setActionType('reset_block')
                    setDaysAmount('')
                    setErrorMessage(null)
                  }
                }}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-2xl border p-2.5 text-xs font-bold transition cursor-pointer text-center ${
                  actionType === 'reset_block'
                    ? 'border-rose-500 bg-rose-50 text-rose-800 shadow-xs dark:bg-rose-950/50 dark:border-rose-500 dark:text-rose-300 ring-2 ring-rose-500/20'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                <Ban className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>Zerar & Bloquear</span>
              </button>
            </div>
          </div>

          {/* Quantidade de Dias (Exibido para Aumentar ou Diminuir) */}
          {actionType !== 'reset_block' ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300">
                  Quantidade de Dias:
                </label>
                <div className="flex flex-wrap gap-1">
                  {(actionType === 'increase' ? [5, 10, 15, 30, 60] : [1, 3, 5, 10, 15, 30]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleQuickDays(d)}
                      className={`rounded-lg px-2 py-0.5 text-[11px] font-bold transition cursor-pointer ${
                        daysAmount === d
                          ? actionType === 'increase'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {actionType === 'increase' ? `+${d}` : `-${d}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={daysAmount}
                  onChange={(e) => {
                    const valStr = e.target.value
                    if (valStr === '') {
                      setDaysAmount('')
                    } else {
                      const val = parseInt(valStr, 10)
                      setDaysAmount(isNaN(val) ? '' : Math.max(1, val))
                    }
                    setErrorMessage(null)
                  }}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Informe a quantidade de dias..."
                  required
                />
                <span className="absolute right-4 top-2.5 text-xs text-gray-400 font-semibold pointer-events-none">
                  dias corridos
                </span>
              </div>
            </div>
          ) : (
            /* Aviso especial para Zerar & Bloquear */
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-400 mb-1">
                <Ban className="h-4 w-4 shrink-0" />
                <span>Atenção: Ação de Bloqueio Imediato</span>
              </div>
              <p className="leading-relaxed">
                Esta ação irá <strong>zerar todos os dias de uso</strong> e <strong>cancelar o período de tolerância/carência</strong> da empresa{' '}
                <strong>{company.name}</strong>, suspendendo seu acesso no sistema imediatamente.
              </p>
            </div>
          )}

          {/* Projeção do Resultado */}
          <div
            className={`rounded-2xl border p-3.5 text-xs transition ${
              actionType === 'reset_block' || projection.isBlocked
                ? 'border-rose-200/80 bg-rose-50/60 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200'
                : projection.newRemainingDays === 0
                  ? 'border-amber-200/80 bg-amber-50/60 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
                  : 'border-blue-200/80 bg-blue-50/60 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200'
            }`}
          >
            <div
              className={`flex items-center gap-1.5 font-bold mb-1 ${
                actionType === 'reset_block' || projection.isBlocked
                  ? 'text-rose-700 dark:text-rose-400'
                  : projection.newRemainingDays === 0
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-blue-700 dark:text-blue-400'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>
                {actionType === 'reset_block'
                  ? 'Efeito Imediato do Bloqueio:'
                  : 'Simulação da Nova Validade:'}
              </span>
            </div>

            {actionType === 'reset_block' ? (
              <>
                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-gray-600 dark:text-slate-400">Novo Status de Acesso:</span>
                  <span className="font-extrabold text-rose-700 dark:text-rose-400 inline-flex items-center gap-1">
                    <Ban className="h-3.5 w-3.5" />
                    Bloqueado por Inadimplência
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1 border-t border-rose-200/60 dark:border-rose-900/50 pt-1.5">
                  <span className="text-gray-600 dark:text-slate-400">Dias Restantes & Carência:</span>
                  <span className="font-extrabold text-rose-700 dark:text-rose-400">
                    0 dias (Acesso Suspenso)
                  </span>
                </div>
              </>
            ) : effectiveDays > 0 ? (
              <>
                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-gray-600 dark:text-slate-400">Nova Situação Resultante:</span>
                  <span
                    className={`font-extrabold ${
                      projection.isBlocked
                        ? 'text-rose-700 dark:text-rose-400'
                        : projection.newRemainingDays === 0
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-blue-800 dark:text-blue-300'
                    }`}
                  >
                    {projection.statusBadge}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1 border-t border-gray-200/60 dark:border-slate-800/60 pt-1.5">
                  <span className="text-gray-600 dark:text-slate-400">Dias Restantes:</span>
                  <span
                    className={`font-extrabold ${
                      projection.isBlocked
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {projection.newRemainingDays} {projection.newRemainingDays === 1 ? 'dia' : 'dias'}
                  </span>
                </div>
                {projection.isBlocked && (
                  <div className="mt-2 text-[11px] text-rose-700 dark:text-rose-400 font-semibold bg-rose-100/60 dark:bg-rose-900/30 p-2 rounded-xl flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>Atenção: A redução ultrapassou a carência de 5 dias. A empresa será bloqueada ao salvar.</span>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80 font-medium">
                Informe ou selecione a quantidade de dias acima para calcular a nova validade.
              </div>
            )}
          </div>

          {/* Motivo Obrigatório */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5">
              Motivo do Ajuste de Licença <span className="text-rose-600 font-black">* (Obrigatório)</span>:
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (errorMessage) setErrorMessage(null)
              }}
              placeholder={
                actionType === 'reset_block'
                  ? 'Descreva obrigatoriamente o motivo do cancelamento/bloqueio (ex: rescisão de contrato, solicitação do cliente, inadimplência confirmada...)'
                  : 'Descreva detalhadamente o motivo deste ajuste (ex: prorrogação concedida via WhatsApp, cortesia de suporte, bonificação comercial, cancelamento antecipado...)'
              }
              className="w-full rounded-2xl border border-gray-300 bg-white p-3 text-xs text-gray-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white leading-relaxed resize-none"
              required
            />
            <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">
              Esta justificativa é obrigatória e ficará salva no histórico da empresa para auditoria.
            </p>
          </div>

          {/* Erro */}
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Botões do Rodapé */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !reason.trim() ||
                (actionType !== 'reset_block' && (!effectiveDays || effectiveDays <= 0))
              }
              className={`gap-1.5 text-white shadow-sm font-bold ${
                actionType === 'reset_block'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : actionType === 'increase'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {actionType === 'reset_block' ? (
                <Ban className="h-4 w-4" />
              ) : actionType === 'increase' ? (
                <Plus className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              {isSubmitting
                ? actionType === 'reset_block'
                  ? 'Bloqueando acesso...'
                  : 'Salvando ajuste...'
                : actionType === 'reset_block'
                  ? 'Zerar Licença & Bloquear Acesso'
                  : actionType === 'increase'
                    ? `Adicionar +${effectiveDays || 0} Dias`
                    : `Reduzir -${effectiveDays || 0} Dias`}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

