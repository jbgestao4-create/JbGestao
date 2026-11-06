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
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import {
  companyManagementService,
  type ManagedCompany,
} from '../services/company-management.service'

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
        // YYYY-MM-DD para o input type="date"
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        setTargetDateStr(`${yyyy}-${mm}-${dd}`)
      } else {
        setIsUnlimited(true)
        // Sugestão padrão: 15 dias a partir de hoje
        const d = new Date()
        d.setDate(d.getDate() + 15)
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        setTargetDateStr(`${yyyy}-${mm}-${dd}`)
      }
    }
  }, [isOpen, company])

  if (!isOpen || !company) return null

  // Cálculo da situação atual
  const currentExpiry = company.trialEndsAt ? new Date(company.trialEndsAt) : null
  const now = new Date()
  const isCurrentExpired = Boolean(currentExpiry && currentExpiry.getTime() < now.getTime())
  const currentDiffDays = currentExpiry
    ? Math.ceil((currentExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null

  // Função para adicionar dias a partir de hoje
  const handleAddDays = (days: number) => {
    setIsUnlimited(false)
    const base = new Date()
    base.setDate(base.getDate() + days)
    // Define para as 23:59:59 daquele dia
    const yyyy = base.getFullYear()
    const mm = String(base.getMonth() + 1).padStart(2, '0')
    const dd = String(base.getDate()).padStart(2, '0')
    setTargetDateStr(`${yyyy}-${mm}-${dd}`)
  }

  // Função para expirar imediatamente (para testes)
  const handleExpireNow = () => {
    setIsUnlimited(false)
    const past = new Date()
    past.setDate(past.getDate() - 1)
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
        setError('Por favor, informe a data de término do período de teste.')
        setIsLoading(false)
        return
      }
      // Configura a expiração para as 23:59:59 do dia selecionado no fuso horário local
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
      setError(res.error || 'Não foi possível salvar o período de teste.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <CalendarClock className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Período de Teste
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Empresa: <strong className="text-gray-800 dark:text-slate-200">{company.name}</strong> ({company.slug})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 dark:border-rose-800/80 dark:bg-rose-950/50 dark:text-rose-300">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Situação Atual */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-2">
              Status Atual da Empresa
            </div>
            {currentExpiry ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 dark:text-slate-400">Data de expiração:</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    {currentExpiry.toLocaleDateString('pt-BR')} às {currentExpiry.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 dark:text-slate-400">Situação:</span>
                  {isCurrentExpired ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/80 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Expirado há {Math.abs(currentDiffDays || 0)} dia(s) — Acesso Suspenso
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Ativo ({currentDiffDays} dia(s) restante(s))
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <Infinity className="h-4 w-4" />
                Acesso Ilimitado / Sem data de término configurada
              </div>
            )}
          </div>

          {/* Opções de Configuração */}
          <div className="space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Adicionar ou Modificar Período de Teste
            </label>

            {/* Botões Rápidos de Adição de Dias */}
            <div>
              <span className="text-xs text-gray-600 dark:text-slate-400 mb-2 block font-medium">
                Atalhos rápidos (dias a partir de hoje):
              </span>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {[7, 15, 30, 45, 60, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => handleAddDays(days)}
                    className="flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50/50 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 hover:border-amber-300 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/60 transition-colors"
                  >
                    <span>+{days}</span>
                    <span className="text-[10px] font-normal opacity-75">dias</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Seletor de Data Específica */}
            <div className="rounded-xl border border-gray-200 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="trial_limited"
                  name="trial_mode"
                  checked={!isUnlimited}
                  onChange={() => setIsUnlimited(false)}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <label
                  htmlFor="trial_limited"
                  className="text-xs font-bold text-gray-800 dark:text-slate-200 cursor-pointer"
                >
                  Definir data de expiração do teste
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
                      className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-normal">
                    Após as 23:59 desta data, se a empresa tentar acessar, verá a mensagem de bloqueio: <em>"Tempo de teste expirado, entre em contato com a JB Software"</em>.
                  </p>
                </div>
              )}
            </div>

            {/* Opção Ilimitada */}
            <div className="rounded-xl border border-gray-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="trial_unlimited"
                  name="trial_mode"
                  checked={isUnlimited}
                  onChange={() => setIsUnlimited(true)}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <label
                  htmlFor="trial_unlimited"
                  className="text-xs font-bold text-gray-800 dark:text-slate-200 cursor-pointer flex items-center gap-1.5"
                >
                  <Infinity className="h-3.5 w-3.5 text-emerald-600" />
                  Acesso Ilimitado / Vitalício (Sem data de expiração)
                </label>
              </div>
            </div>

            {/* Botão de Expirar Imediatamente (Para Testes) */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleExpireNow}
                className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-semibold underline decoration-dotted"
                title="Configura a data de teste para ontem, suspendendo o acesso da empresa imediatamente"
              >
                <Clock className="h-3.5 w-3.5" />
                Suspender / Expirar agora para teste imediato
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
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              {isLoading ? 'Salvando...' : 'Salvar Período de Teste'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
