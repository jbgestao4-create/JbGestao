import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings,
  Clock,
  ShieldCheck,
  Check,
  CheckCircle2,
  Cpu,
  Headset,
  Key,
  ArrowLeft,
  Save,
  Lock,
  Monitor,
  AlertCircle,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { isSystemOwner } from '@shared/utils/system-owner'
import { systemSettingsService } from '@shared/services/system-settings.service'
import {
  getGeminiApiKey,
  setGeminiApiKey,
  supportAiService,
} from '@modules/suggestions/services/support-ai.service'

const PRESET_TIMEOUTS = [
  { minutes: 1, label: '1 minuto', desc: 'Máxima restrição' },
  { minutes: 2, label: '2 minutos', desc: 'Padrão recomendado' },
  { minutes: 5, label: '5 minutos', desc: 'Uso moderado' },
  { minutes: 10, label: '10 minutos', desc: 'Uso corporativo' },
  { minutes: 15, label: '15 minutos', desc: 'Escritório' },
  { minutes: 30, label: '30 minutos', desc: 'Sessão estendida' },
  { minutes: 60, label: '1 hora', desc: 'Longa permanência' },
]

export function SystemSettingsAdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Estado de Inatividade
  const [inactivityMinutes, setInactivityMinutes] = useState<number>(() =>
    systemSettingsService.getLocalInactivityTimeoutMinutes(),
  )
  const [customMinutesInput, setCustomMinutesInput] = useState<string>(() =>
    String(systemSettingsService.getLocalInactivityTimeoutMinutes()),
  )
  const [isSavingInactivity, setIsSavingInactivity] = useState(false)
  const [inactivitySavedSuccess, setInactivitySavedSuccess] = useState(false)

  // Estado de IA e Diagnóstico Técnico
  const [apiKeyInput, setApiKeyInput] = useState(() => getGeminiApiKey())
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const [testingAi, setTestingAi] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    void systemSettingsService.getInactivitySettings().then((res) => {
      if (isMounted && res.success && res.data) {
        setInactivityMinutes(res.data.timeoutMinutes)
        setCustomMinutesInput(String(res.data.timeoutMinutes))
      }
    })
    return () => {
      isMounted = false
    }
  }, [])

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
          onClick={() => void navigate('/admin/developer-settings')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition cursor-pointer"
        >
          Voltar às Configurações
        </button>
      </div>
    )
  }

  const handleSelectPreset = (mins: number) => {
    setInactivityMinutes(mins)
    setCustomMinutesInput(String(mins))
  }

  const handleSaveInactivity = async () => {
    const val = Number(customMinutesInput)
    if (isNaN(val) || val < 1 || val > 480) {
      alert('Informe um tempo de inatividade válido entre 1 e 480 minutos.')
      return
    }

    setIsSavingInactivity(true)
    const res = await systemSettingsService.setInactivityTimeoutMinutes(val, user?.id)
    setIsSavingInactivity(false)

    if (res.success && res.data) {
      setInactivityMinutes(res.data.timeoutMinutes)
      setInactivitySavedSuccess(true)
      setTimeout(() => setInactivitySavedSuccess(false), 3500)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER DA PÁGINA */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Configuração do Sistema
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                  <ShieldCheck className="w-3 h-3" /> Módulo Global
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 max-w-2xl">
                Parâmetros operacionais centrais, regras de segurança por inatividade de sessão e integração com inteligência artificial para diagnósticos técnicos.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void navigate('/admin/developer-settings')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer self-start sm:self-center"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Desenvolvedor
          </button>
        </div>
      </div>

      {/* CARD 1: TEMPO DE BLOQUEIO POR INATIVIDADE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Tempo de Bloqueio por Inatividade de Sessão
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Determina após quanto tempo sem movimentação do mouse ou digitação o sistema desconectará a conta por segurança.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800">
              <Lock className="w-3.5 h-3.5" />
              Tempo Atual: {inactivityMinutes} {inactivityMinutes === 1 ? 'minuto' : 'minutos'}
            </span>
          </div>
        </div>

        {/* Seleção Rápida de Minutos */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Escolha uma Opção Pré-Definida:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {PRESET_TIMEOUTS.map((item) => {
              const isSelected = Number(customMinutesInput) === item.minutes
              return (
                <button
                  key={item.minutes}
                  type="button"
                  onClick={() => handleSelectPreset(item.minutes)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 ring-2 ring-amber-400/50 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="text-sm font-bold">{item.label}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Entrada Personalizada e Ação de Salvar */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
              Ou digite o tempo em minutos:
            </label>
            <div className="relative w-32">
              <input
                type="number"
                min="1"
                max="480"
                value={customMinutesInput}
                onChange={(e) => setCustomMinutesInput(e.target.value)}
                className="w-full h-10 px-3 pr-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                min
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {inactivitySavedSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" /> Configuração salva com sucesso!
              </span>
            )}

            <button
              type="button"
              disabled={isSavingInactivity}
              onClick={() => void handleSaveInactivity()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSavingInactivity ? 'Salvando...' : 'Salvar Tempo de Bloqueio'}
            </button>
          </div>
        </div>

        {/* Nota de Segurança e Exceção do PDV */}
        <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 flex items-start gap-3">
          <Monitor className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
            <span className="font-bold block mb-0.5">Exceção de Operação Contínua no Terminal PDV:</span>
            Quando a estação de trabalho estiver no modo <strong>Tela Cheia do PDV</strong>, o sistema <strong>não</strong> desloga por inatividade, permitindo manter o caixa pronto para vendas sem interrupções operacionais.
          </div>
        </div>
      </div>

      {/* CARD 2: DIAGNÓSTICO TÉCNICO & TRIAGEM AUTOMÁTICA DE SUPORTE */}
      <div className="bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-900/60 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-violet-100 dark:border-violet-950 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
              <Headset className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Diagnóstico Técnico & Triagem Automática de Suporte
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-300">
                  <Cpu className="w-3 h-3" /> Triagem Ativa
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Atendimento estruturado aos clientes com diagnósticos técnicos detalhados e salvamento via <code className="font-mono text-violet-600 dark:text-violet-400">registrar_analise_suporte</code>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                apiKeyInput.trim()
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
              }`}
            >
              {apiKeyInput.trim() ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Motor de Diagnóstico Conectado
                </>
              ) : (
                'Modo Resiliente (Fallback Ativo)'
              )}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Chave da API de Diagnóstico e Atendimento (Google Cloud / Studio)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value)
                    setApiKeySaved(false)
                  }}
                  placeholder="AIzaSy... (ou configure VITE_GEMINI_API_KEY no .env.local)"
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setGeminiApiKey(apiKeyInput)
                  setApiKeySaved(true)
                  setTimeout(() => setApiKeySaved(false), 3000)
                }}
                className="h-10 px-4 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                {apiKeySaved ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Salvo!
                  </>
                ) : (
                  'Salvar Chave'
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              A chave é mantida no ambiente local do seu navegador e não é exposta publicamente. Se preferir, defina <code className="font-mono">VITE_GEMINI_API_KEY</code> no <code className="font-mono">.env.local</code>.
            </p>
          </div>

          <div className="space-y-2 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Simulador de Chamada de Ferramenta
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Testa a ferramenta <code className="font-mono">registrar_analise_suporte</code> em tempo real.
              </p>
            </div>
            <button
              type="button"
              disabled={testingAi}
              onClick={async () => {
                setTestingAi(true)
                setTestResult(null)
                try {
                  const res = await supportAiService.testConnection(apiKeyInput)
                  setTestResult(
                    JSON.stringify(
                      {
                        origem: res.isFallback
                          ? 'Fallback Local (A chave não respondeu ou deu erro)'
                          : `Motor de Diagnóstico Integrado (${res.model})`,
                        ferramenta_executada: 'registrar_analise_suporte',
                        sucesso_conexao: res.success,
                        erro_api: res.error || null,
                        retorno: res.payload,
                      },
                      null,
                      2,
                    ),
                  )
                } catch (err) {
                  setTestResult(`Erro no teste: ${String(err)}`)
                } finally {
                  setTestingAi(false)
                }
              }}
              className="h-10 w-full rounded-lg border border-violet-300 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Cpu className="w-4 h-4" />
              {testingAi ? 'Processando Validação da Ferramenta...' : 'Executar Teste da Ferramenta'}
            </button>
          </div>
        </div>

        {testResult && (
          <div className="mt-3 p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto max-h-56">
            <pre>{testResult}</pre>
          </div>
        )}

        <div className="p-4 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/80 dark:border-violet-900/40 text-xs text-violet-900 dark:text-violet-200 space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            Estrutura da Ferramenta de Suporte (Function Calling)
          </p>
          <p className="text-[11px] text-violet-800 dark:text-violet-300 leading-relaxed">
            Quando os clientes solicitam atendimento, a IA processa o relato e invoca a função <code className="font-mono bg-violet-200/50 dark:bg-violet-900/50 px-1 py-0.5 rounded">registrar_analise_suporte</code> estruturando a <strong>categoria</strong>, <strong>gravidade (baixa, média, alta, crítica)</strong>, <strong>módulo afetado</strong>, <strong>passos para reproduzir</strong> e o <strong>diagnóstico técnico</strong> visível aos administradores.
          </p>
        </div>
      </div>
    </div>
  )
}
