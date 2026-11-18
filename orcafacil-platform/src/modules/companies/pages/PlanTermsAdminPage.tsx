import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  FileCheck,
  FileSignature,
  Layers,
  RotateCcw,
  Save,
  Scale,
  ShieldCheck,
  Eye,
  AlertCircle,
  X,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { isSystemOwner } from '@shared/utils/system-owner'
import { Button } from '@shared/components/ui/Button'
import {
  planTermsService,
  type PlanTermConfig,
  DEFAULT_PLAN_TERMS,
} from '@shared/services/plan-terms.service'
import {
  accessPlanService,
  type AccessPlan,
  SYSTEM_DEFAULT_ACCESS_PLANS,
} from '@modules/companies/services/access-plan.service'
import { formatCurrency } from '@shared/utils/monetary'

export function PlanTermsAdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [availablePlans, setAvailablePlans] = useState<AccessPlan[]>(SYSTEM_DEFAULT_ACCESS_PLANS)
  const [termsByPlan, setTermsByPlan] = useState<Record<string, PlanTermConfig>>({})
  const [selectedPlanId, setSelectedPlanId] = useState<string>(SYSTEM_DEFAULT_ACCESS_PLANS[0].id)

  // Campos do formulário para o plano selecionado
  const [title, setTitle] = useState('')
  const [version, setVersion] = useState('2.0')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // Carrega planos e termos salvos
  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      setIsLoading(true)
      try {
        const [plansRes, termsRes] = await Promise.all([
          accessPlanService.listPublic().catch(() => SYSTEM_DEFAULT_ACCESS_PLANS),
          planTermsService.getAllTerms(),
        ])

        if (isMounted) {
          if (plansRes && plansRes.length > 0) {
            setAvailablePlans(plansRes)
          }
          setTermsByPlan(termsRes)
        }
      } catch {
        if (isMounted) {
          setTermsByPlan(DEFAULT_PLAN_TERMS)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      isMounted = false
    }
  }, [])

  // Sincroniza formulário quando o plano selecionado muda
  useEffect(() => {
    const term = termsByPlan[selectedPlanId] || DEFAULT_PLAN_TERMS[selectedPlanId] || DEFAULT_PLAN_TERMS.default
    setTitle(term?.title || '')
    setVersion(term?.version || '2.0')
    setSummary(term?.summary || '')
    setContent(term?.content || '')
    setFeedbackMsg(null)
  }, [selectedPlanId, termsByPlan])

  // Objeto do plano atualmente selecionado
  const currentPlan = useMemo(() => {
    if (selectedPlanId === 'default') {
      return {
        id: 'default',
        name: 'Termo Padrão Geral',
        description: 'Termos e Condições Gerais aplicados a planos não personalizados ou como base geral da plataforma.',
        monthlyPrice: 0,
        modules: [],
        isActive: true,
        isSystem: true,
        isLocked: false,
      } as AccessPlan
    }
    return (
      availablePlans.find((p) => p.id === selectedPlanId) ||
      SYSTEM_DEFAULT_ACCESS_PLANS.find((p) => p.id === selectedPlanId) || {
        id: selectedPlanId,
        name: 'Plano Personalizado',
        description: 'Plano cadastrado no sistema',
        monthlyPrice: 0,
        modules: [],
        isActive: true,
        isSystem: false,
        isLocked: false,
      }
    )
  }, [selectedPlanId, availablePlans])

  if (!isSystemOwner(user)) {
    return (
      <div className="py-20 max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400 flex items-center justify-center">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Acesso Restrito ao Desenvolvedor</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Este módulo é restrito exclusivamente ao desenvolvedor e proprietário da plataforma.
        </p>
        <button
          type="button"
          onClick={() => void navigate('/dashboard')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition cursor-pointer"
        >
          Voltar ao Início
        </button>
      </div>
    )
  }

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Preencha o título e o texto integral do termo.' })
      return
    }

    setIsSaving(true)
    setFeedbackMsg(null)

    try {
      const res = await planTermsService.saveTermForPlan(
        selectedPlanId,
        {
          planId: selectedPlanId,
          planName: currentPlan.name,
          title: title.trim(),
          version: version.trim() || '2.0',
          summary: summary.trim(),
          content: content.trim(),
        },
        user?.email,
      )

      if (res.success && res.data) {
        setTermsByPlan((prev) => ({ ...prev, [selectedPlanId]: res.data! }))
        setFeedbackMsg({
          type: 'success',
          text: `Termo do plano "${currentPlan.name}" atualizado e publicado com sucesso! Clientes que assinarem ou trocarem para este plano receberão este texto.`,
        })
      } else {
        setFeedbackMsg({ type: 'error', text: !res.success ? res.error : 'Erro ao salvar o termo.' })
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Ocorreu um erro ao salvar o termo.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetToDefault = async () => {
    const confirmed = window.confirm(
      `Deseja realmente restaurar o termo do plano "${currentPlan.name}" para o modelo oficial padrão de fábrica? As customizações atuais deste plano serão sobrescritas.`,
    )
    if (!confirmed) return

    setIsSaving(true)
    try {
      const res = await planTermsService.resetTermToDefault(selectedPlanId, user?.email)
      if (res.success && res.data) {
        setTermsByPlan((prev) => ({ ...prev, [selectedPlanId]: res.data! }))
        setTitle(res.data.title)
        setVersion(res.data.version)
        setSummary(res.data.summary)
        setContent(res.data.content)
        setFeedbackMsg({
          type: 'success',
          text: `Termo restaurado para o padrão oficial do plano "${currentPlan.name}".`,
        })
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Falha ao restaurar termo padrão.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header com Navegação */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => void navigate('/admin/developer-settings')}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition shrink-0"
              title="Voltar para Desenvolvedor"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Scale className="w-4 h-4" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Termos de Adesão por Plano
                </h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Superadmin
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-slate-400 max-w-3xl">
                Ajuste e personalize as cláusulas e condições de licenciamento atribuídas a cada plano. Quando uma empresa
                realizar a assinatura ou solicitar a alteração de plano, o sistema exibirá este termo para aceite obrigatório,
                e vinculará o documento ao botão de Contrato em <strong>Empresas Cadastradas</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPreviewOpen(true)}
              className="gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700"
            >
              <Eye className="w-4 h-4 text-blue-600" />
              Pré-visualizar Aceite
            </Button>
            <Button
              type="button"
              disabled={isSaving || isLoading}
              onClick={handleSave}
              className="gap-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </div>

      {/* Alerta de Feedback */}
      {feedbackMsg && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border text-sm transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{feedbackMsg.text}</div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SELETOR DE PLANOS COM BOTÕES */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Escolha o Plano para Ajustar o Termo Correspondente:</span>
          </div>
          <span className="text-xs text-slate-400">
            {availablePlans.length} planos disponíveis + Termo Geral
          </span>
        </div>

        {/* Grade de Botões de Planos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {availablePlans.map((plan) => {
            const isSelected = selectedPlanId === plan.id
            const term = termsByPlan[plan.id]
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlanId(plan.id)}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-100'
                    : 'border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs line-clamp-1">{plan.name}</span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                    {plan.description}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {plan.monthlyPrice ? `${formatCurrency(plan.monthlyPrice)}/mês` : 'Personalizado'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    v{term?.version || '2.0'}
                  </span>
                </div>
              </button>
            )
          })}

          {/* Botão de Termo Geral Fallback */}
          <button
            type="button"
            onClick={() => setSelectedPlanId('default')}
            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
              selectedPlanId === 'default'
                ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-100'
                : 'border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-xs">Termo Padrão Geral</span>
                {selectedPlanId === 'default' && (
                  <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                )}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Modelo fallback geral
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Aplicável a todos</span>
              <span className="text-[10px] font-mono text-slate-400">
                v{termsByPlan.default?.version || '2.0'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* PAINEL DE EDIÇÃO DO TERMO DO PLANO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Informações do Plano & Atribuição */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>Resumo do Plano Selecionado</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Plano Alvo:</span>
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                  {currentPlan.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Mensalidade:</span>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {currentPlan.monthlyPrice ? `${formatCurrency(currentPlan.monthlyPrice)} / mês` : 'Sob Consulta'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Período de Testes:</span>
                <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                  30 dias grátis (Trial)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Módulos Incluídos:</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {currentPlan.modules.length > 0 ? `${currentPlan.modules.length} recursos` : 'Configuração geral'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              <strong>Como funciona a vinculação:</strong> Sempre que um novo cliente se cadastrar e escolher este plano,
              ou quando a empresa tiver seu plano alterado pela equipe, este termo será exigido para aceite digital. O registro
              do aceite (IP, data, hora, e-mail e versão) ficará permanentemente anexado ao Contrato da empresa.
            </p>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={handleResetToDefault}
                disabled={isSaving}
                className="w-full gap-2 text-xs font-semibold text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar Padrão Oficial do Plano
              </Button>
            </div>
          </div>

          {/* Dicas de Variáveis */}
          <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl p-4 text-xs text-blue-900 dark:text-blue-200 space-y-2">
            <div className="font-bold flex items-center gap-1.5">
              <FileSignature className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Dica de Versionamento</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Se você alterar o campo <strong>Versão do Documento</strong> (ex: de <code>2.0</code> para <code>2.1</code>),
              todos os clientes que já assinaram este plano serão convidados a aceitar os novos termos no próximo login.
            </p>
          </div>
        </div>

        {/* Coluna Direita: Formulário do Termo */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Editor de Cláusulas: {currentPlan.name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Edite o título, versão e as cláusulas contratuais exibidas ao cliente
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                Versão: {version}
              </span>
            </div>

            {/* Linha: Título e Versão */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Título Oficial do Termo / Contrato
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Termos de Adesão e Licença de Software — Plano Básico"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Versão
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="Ex: 2.0"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Resumo do Objeto */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Resumo dos Recursos & Objeto do Plano (Exibido no Cabeçalho)
              </label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Ex: Licenciamento mensal dos recursos essenciais para vendas, estoque e caixa."
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Texto Integral das Cláusulas */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Texto Integral das Cláusulas Contratuais (Rolável pelo Cliente)
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {content.length} caracteres • {content.split('\n').length} linhas
                </span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={18}
                placeholder="Insira aqui as cláusulas contratuais na íntegra..."
                className="w-full p-3.5 text-xs sm:text-sm font-sans leading-relaxed rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-y select-text"
              />
            </div>

            {/* Botões do Rodapé */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPreviewOpen(true)}
                className="w-full sm:w-auto gap-2 text-xs font-semibold text-blue-700 border-blue-300 hover:bg-blue-50 dark:text-blue-300 dark:border-blue-800"
              >
                <Eye className="w-4 h-4" />
                Pré-visualizar Caixa de Aceite do Cliente
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSave}
                  className="w-full sm:w-auto gap-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Salvando...' : 'Salvar e Publicar Termo'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE PRÉ-VISUALIZAÇÃO DO ACEITE (SIMULAÇÃO CLIENTE) */}
      {isPreviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto"
        >
          <div className="max-h-[92vh] w-full max-w-2xl flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300">
                    Simulação de Visualização do Cliente
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500">v{version}</span>
                </div>
                <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  {title || 'Termos de Uso e Licença de Software'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Plano: <strong>{currentPlan.name}</strong> • Role o termo até o final para liberar a caixa de aceite
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Caixa rolável com o conteúdo */}
            <div className="my-4 max-h-[50vh] flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 leading-relaxed whitespace-pre-line dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 select-text">
              {content}
            </div>

            {/* Checkbox simulado */}
            <label className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50/40 p-3 text-xs text-slate-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-slate-200 select-none">
              <input type="checkbox" defaultChecked className="mt-0.5 h-4 w-4 rounded text-blue-600" />
              <span>
                Li e aceito integralmente os termos de uso e licença do <strong>{currentPlan.name}</strong>, incluindo
                o período de teste e as condições financeiras.
              </span>
            </label>

            <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <Button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg"
              >
                Concluir Pré-visualização
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
