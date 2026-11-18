import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { termsAcceptanceService } from '@shared/services/terms-acceptance.service'
import { planTermsService, type PlanTermConfig } from '@shared/services/plan-terms.service'
import { Button } from '@shared/components/ui/Button'

export function TermsOfUseModal() {
  const { user } = useAuth()
  const { currentOrganization } = useOrganization()

  const [isOpen, setIsOpen] = useState(false)
  const [currentTerm, setCurrentTerm] = useState<PlanTermConfig | null>(null)
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const [isAgreed, setIsAgreed] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user?.email) {
      setIsOpen(false)
      return
    }

    let isMounted = true

    const checkAcceptance = async () => {
      try {
        const planId = currentOrganization?.accessPlanId || null
        const term = await planTermsService.getTermForPlan(planId)

        if (!isMounted) return
        setCurrentTerm(term)

        // Verifica se o usuário já aceitou os termos deste plano e versão
        const accepted = termsAcceptanceService.hasAcceptedForPlan(
          user.email,
          user.user_metadata,
          planId,
          term.version,
        )

        if (accepted) {
          setIsOpen(false)
        } else {
          setIsOpen(true)
          setHasScrolledToBottom(false)
          setIsAgreed(false)
        }
      } catch {
        // Fallback: se houver erro ao carregar termos, verifica aceite padrão
        const accepted = termsAcceptanceService.hasAccepted(user.email, user.user_metadata)
        if (isMounted) {
          setIsOpen(!accepted)
        }
      }
    }

    void checkAcceptance()

    return () => {
      isMounted = false
    }
  }, [user, currentOrganization?.accessPlanId])

  // Verifica se o texto já cabe inteiro sem barra de rolagem (ex: telas grandes)
  useEffect(() => {
    if (!isOpen) return
    const checkScrollable = () => {
      const el = scrollContainerRef.current
      if (el && el.scrollHeight <= el.clientHeight + 15) {
        setHasScrolledToBottom(true)
      }
    }
    const timer = setTimeout(checkScrollable, 200)
    return () => clearTimeout(timer)
  }, [isOpen, currentTerm])

  if (!isOpen) return null

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (hasScrolledToBottom) return
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollTop + clientHeight >= scrollHeight - 30) {
      setHasScrolledToBottom(true)
    }
  }

  const handleAccept = async () => {
    if (!isAgreed || !user?.email) return

    setIsSaving(true)
    try {
      await termsAcceptanceService.recordAcceptance(user.email, true, {
        companyId: currentOrganization?.id,
        companyName: currentOrganization?.name,
        selectedPlanId: currentOrganization?.accessPlanId || undefined,
        selectedPlanName: currentOrganization?.accessPlanName || currentTerm?.planName,
        version: currentTerm?.version || '2.0',
        termTitle: currentTerm?.title,
        termSnapshot: currentTerm?.content,
        agreedToTrialAndAutoSuspension: true,
      })
      setIsOpen(false)
    } catch {
      // Fallback em caso de erro de rede: salva localmente
      await termsAcceptanceService.recordAcceptance(user.email, false, {
        companyId: currentOrganization?.id,
        companyName: currentOrganization?.name,
        selectedPlanId: currentOrganization?.accessPlanId || undefined,
        selectedPlanName: currentOrganization?.accessPlanName || currentTerm?.planName,
        version: currentTerm?.version || '2.0',
        termTitle: currentTerm?.title,
        termSnapshot: currentTerm?.content,
        agreedToTrialAndAutoSuspension: true,
      })
      setIsOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const planName = currentOrganization?.accessPlanName || currentTerm?.planName || 'Plano Atual'
  const termVersion = currentTerm?.version || '2.0'
  const termTitle = currentTerm?.title || `Termos de Uso e Licença de Software — ${planName}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      aria-describedby="terms-modal-description"
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-xs"
    >
      <section className="max-h-[92vh] w-full max-w-2xl flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300">
              Plano: {planName}
            </span>
            <span className="text-[11px] font-mono text-slate-400">Versão: v{termVersion}</span>
          </div>
          <h2
            id="terms-modal-title"
            className="text-base sm:text-lg font-bold text-gray-900 dark:text-white"
          >
            {termTitle}
          </h2>
          <p
            id="terms-modal-description"
            className="mt-1 text-xs text-gray-500 dark:text-slate-400"
          >
            Role o documento abaixo até o final para habilitar o campo de aceite e avançar para o sistema.
          </p>
        </div>

        {/* Caixa de Texto Rolável com os Termos Atribuídos ao Plano */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="my-4 max-h-[50vh] flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-700 leading-relaxed whitespace-pre-line dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300 select-text space-y-4"
        >
          {/* Alerta de Contrato Legalmente Vinculante */}
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 space-y-1.5 dark:border-amber-800 dark:bg-amber-950/40">
            <div className="flex items-center gap-2 text-amber-950 dark:text-amber-300 font-bold text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Aviso Importante — Contrato Legalmente Vinculante</span>
            </div>
            <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
              Estes Termos de Uso e Condições de Licença constituem um contrato vinculante entre você e a plataforma{' '}
              <strong>ControleSoft / JB Gestão</strong> para o <strong>{planName}</strong>.
            </p>
          </div>

          {/* Conteúdo Dinâmico do Termo */}
          <div className="leading-relaxed">
            {currentTerm?.content}
          </div>

          <div className="pt-3 text-center text-[10px] text-slate-400 font-mono">
            — Fim dos Termos de Uso e Licença de Software ({planName}) —
          </div>
        </div>

        {/* Alerta de Rolagem / Confirmação */}
        {!hasScrolledToBottom ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
            <ArrowDown className="h-4 w-4 shrink-0 animate-bounce text-amber-600" />
            <span>Por favor, role a barra do texto acima até o final para habilitar o aceite.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Rolagem concluída. Marque a caixa abaixo para liberar o botão Avançar.</span>
          </div>
        )}

        {/* Checkbox de Aceite */}
        <label
          className={`mt-3 flex items-start gap-2.5 rounded-lg border p-3 transition-colors select-none ${
            hasScrolledToBottom
              ? 'border-blue-200 bg-blue-50/40 hover:bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/30 cursor-pointer'
              : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-slate-800 dark:bg-slate-800/40 cursor-not-allowed opacity-60'
          }`}
        >
          <input
            type="checkbox"
            disabled={!hasScrolledToBottom}
            checked={isAgreed}
            onChange={(e) => setIsAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
          />
          <span className="text-xs font-medium text-gray-800 dark:text-slate-200 leading-relaxed">
            Li e aceito integralmente os <strong>Termos de Uso e Licenciamento do {planName}</strong> e a{' '}
            <strong>Política de Privacidade</strong> da plataforma ControleSoft / JB Gestão.
          </span>
        </label>

        {/* Rodapé com botão Avançar */}
        <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-slate-800">
          <Button
            type="button"
            disabled={!isAgreed || isSaving}
            onClick={handleAccept}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
          >
            {isSaving ? 'Salvando...' : 'Avançar'}
          </Button>
        </div>
      </section>
    </div>
  )
}
