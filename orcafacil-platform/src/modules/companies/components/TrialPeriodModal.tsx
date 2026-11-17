import { useEffect, useState } from 'react'
import {
  CalendarClock,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Infinity,
  X,
  ShieldAlert,
  Calendar,
  Plus,
  Zap,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import {
  companyManagementService,
  type ManagedCompany,
} from '../services/company-management.service'
import { calculateCompanyLicenseStatus } from '../utils/license.utils'

interface TrialPeriodModalProps {
  isOpen: boolean
  company: ManagedCompany | null
  onClose: () => void
  onSuccess: () => void
}

export function TrialPeriodModal({
  isOpen,
  company,
  onClose,
  onSuccess,
}: TrialPeriodModalProps) {
  const [targetDateStr, setTargetDateStr] = useState<string>('')
  const [isUnlimited, setIsUnlimited] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Inicializa o estado com base na empresa selecionada
  useEffect(() => {
    if (isOpen && company) {
      setError(null)
      setIsLoading(false)
      if (company.trialEndsAt) {
        setIsUnlimited(false)
        const d = new Date(company.trialEndsAt)
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        setTargetDateStr(`${yyyy}-${mm}-${dd}`)
      } else {
        setIsUnlimited(true)
        const d = new Date()
        d.setDate(d.getDate() + 30)
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        setTargetDateStr(`${yyyy}-${mm}-${dd}`)
      }
    }
  }, [isOpen, company])

  if (!isOpen || !company) return null

  const licStatus = calculateCompanyLicenseStatus(company.trialEndsAt, company.isActive)

  // Adiciona dias somando ao prazo restante (se ativo) ou a partir de hoje (se expirado)
  const handleQuickAddDays = async (days: number) => {
    setIsLoading(true)
    setError(null)

    const res = await companyManagementService.addLicenseDays(company.id, days)
    setIsLoading(false)

    if (res.success) {
      onSuccess()
      onClose()
    } else {
      setError(res.error || 'Erro ao adicionar dias de licença.')
    }
  }

  // Define data a partir de hoje no seletor manual
  const handleSelectDaysFromToday = (days: number) => {
    setIsUnlimited(false)
    const base = new Date()
    base.setDate(base.getDate() + days)
    const yyyy = base.getFullYear()
    const mm = String(base.getMonth() + 1).padStart(2, '0')
    const dd = String(base.getDate()).padStart(2, '0')
    setTargetDateStr(`${yyyy}-${mm}-${dd}`)
  }

  // Expira imediatamente (para testes de bloqueio)
  const handleExpireNow = () => {
    setIsUnlimited(false)
    const past = new Date()
    past.setDate(past.getDate() - 6) // -6 dias passa dos 5 dias de carência -> bloqueio imediato por inadimplência
    const yyyy = past.getFullYear()
    const mm = String(past.getMonth() + 1).padStart(2, '0')
    const dd = String(past.getDate()).padStart(2, '0')
    setTargetDateStr(`${yyyy}-${mm}-${dd}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    let finalIsoString: string | null = null

    if (!isUnlimited) {
      if (!targetDateStr) {
        setError('Por favor, informe a data de término da licença.')
        setIsLoading(false)
        return
      }
      const [year, month, day] = targetDateStr.split('-').map(Number)
      const selected = new Date(year, month - 1, day, 23, 59, 59, 999)
      finalIsoString = selected.toISOString()
    }

    const res = await companyManagementService.setTrialPeriod(company.id, finalIsoString)
    setIsLoading(false)

    if (res.success) {
      onSuccess()
      onClose()
    } else {
      setError(res.error || 'Não foi possível salvar a validade da licença.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-slate-800 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur-xs">
              <CalendarClock className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">
                Gestão de Licença e Acesso
              </h2>
              <p className="text-xs text-emerald-100">
                Empresa: <strong className="text-white">{company.name}</strong> ({company.slug})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-emerald-100 hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 dark:border-rose-800/80 dark:bg-rose-950/50 dark:text-rose-300">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Situação Atual da Licença */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/50 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Situação Atual da Licença
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-slate-400">Dias Restantes:</span>
              <span className="text-sm font-black text-gray-900 dark:text-white">
                {licStatus.badgeText}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-slate-400">Status no Sistema:</span>
              {licStatus.status === 'active' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Ativo ({licStatus.daysRemaining} dias + 5d carência)
                </span>
              )}
              {licStatus.status === 'grace_period' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300 animate-pulse">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Em Carência (restam {licStatus.graceDaysRemaining} dias para bloqueio)
                </span>
              )}
              {licStatus.status === 'blocked_overdue' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/80 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Bloqueado por Inadimplência
                </span>
              )}
              {licStatus.status === 'unlimited' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <Infinity className="h-3.5 w-3.5" />
                  Acesso Ilimitado
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-slate-400 pt-1 border-t border-gray-200 dark:border-slate-700">
              {licStatus.description}
            </div>
          </div>

          {/* Regra de Negócio: 30 dias + 5 dias de carência */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Regra de Pagamento & Carência:</strong> Cada ciclo ou pagamento PIX confere <strong>30 dias de acesso normal</strong> somados ao prazo restante, mais <strong>5 dias de tolerância</strong> pós-vencimento para renovação. Caso não seja renovado até o 5º dia, o acesso é bloqueado por inadimplência.
            </div>
          </div>

          {/* Ação Rápida: Somar Dias ao Prazo Atual */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Ação Imediata • Somar Dias aos Restantes:
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => void handleQuickAddDays(30)}
                className="flex flex-col items-center justify-center p-3 rounded-2xl border border-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-1 text-sm font-black">
                  <Plus className="w-3.5 h-3.5" /> 30 Dias
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                  +1 Mês de Licença
                </span>
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => void handleQuickAddDays(60)}
                className="flex flex-col items-center justify-center p-3 rounded-2xl border border-sky-300 bg-sky-50/80 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 hover:bg-sky-100 font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-1 text-sm font-black">
                  <Plus className="w-3.5 h-3.5" /> 60 Dias
                </div>
                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-normal">
                  +2 Meses de Licença
                </span>
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => void handleQuickAddDays(90)}
                className="flex flex-col items-center justify-center p-3 rounded-2xl border border-purple-300 bg-purple-50/80 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 hover:bg-purple-100 font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-1 text-sm font-black">
                  <Plus className="w-3.5 h-3.5" /> 90 Dias
                </div>
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-normal">
                  +3 Meses de Licença
                </span>
              </button>
            </div>
          </div>

          {/* Ajuste Manual de Data */}
          <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Ou Definir Data de Vencimento Específica:
              </label>
              <div className="flex gap-1">
                {[15, 30, 45].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleSelectDaysFromToday(d)}
                    className="px-2 py-0.5 text-[11px] rounded-md font-bold bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 cursor-pointer"
                  >
                    +{d}d
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="trial_limited"
                  name="trial_mode"
                  checked={!isUnlimited}
                  onChange={() => setIsUnlimited(false)}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <label
                  htmlFor="trial_limited"
                  className="text-xs font-bold text-gray-800 dark:text-slate-200 cursor-pointer"
                >
                  Definir data de término da licença
                </label>
              </div>

              {!isUnlimited && (
                <div className="pl-6 space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={targetDateStr}
                      onChange={(e) => setTargetDateStr(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Opção Ilimitada */}
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="trial_unlimited"
                  name="trial_mode"
                  checked={isUnlimited}
                  onChange={() => setIsUnlimited(true)}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <label
                  htmlFor="trial_unlimited"
                  className="text-xs font-bold text-gray-800 dark:text-slate-200 cursor-pointer flex items-center gap-1.5"
                >
                  <Infinity className="h-3.5 w-3.5 text-emerald-600" />
                  Acesso Ilimitado / Vitalício (Sem expiração)
                </label>
              </div>
            </div>

            {/* Teste de Bloqueio Imediato */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleExpireNow}
                className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-semibold underline decoration-dotted cursor-pointer"
                title="Simula 6 dias de atraso para testar o bloqueio por inadimplência imediatamente"
              >
                <Clock className="h-3.5 w-3.5" />
                Simular Bloqueio por Inadimplência (Para Teste)
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-5 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {isLoading ? 'Salvando...' : 'Salvar Alterações de Licença'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
