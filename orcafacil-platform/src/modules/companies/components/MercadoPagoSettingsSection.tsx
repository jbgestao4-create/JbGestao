import { useState, useEffect } from 'react'
import {
  CreditCard,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Save,
  Clock,
  XCircle,
  QrCode,
  Search,
  Zap,
  Pencil,
  AlertTriangle,
  Lock,
  Unlock,
  X,
} from 'lucide-react'
import { formatCurrency } from '@shared/utils/monetary'
import {
  mercadopagoService,
  type MercadoPagoSettings,
  type MercadoPagoPixTransaction,
  type MercadoPagoMetrics,
  type MercadoPagoTestResult,
} from '../services/mercadopago.service'

export function MercadoPagoSettingsSection() {
  const [settings, setSettings] = useState<MercadoPagoSettings>({
    accessToken: '',
    publicKey: '',
    webhookSecret: '',
    isSandbox: true,
    notificationUrl: '',
    pixKey: '',
    autoActivateLicense: true,
    licenseDurationDays: 30,
    isActive: true,
  })

  const [showToken, setShowToken] = useState(false)
  const [copiedWebhook, setCopiedWebhook] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Teste de conexão
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<MercadoPagoTestResult | null>(null)

  // Painel de Transações
  const [transactions, setTransactions] = useState<MercadoPagoPixTransaction[]>([])
  const [metrics, setMetrics] = useState<MercadoPagoMetrics>({
    totalApprovedAmount: 0,
    countApproved: 0,
    countPending: 0,
    countRejected: 0,
    countCancelled: 0,
    totalCount: 0,
  })
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<MercadoPagoPixTransaction | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const defaultWebhookUrl = 'https://controlesoft.vercel.app/api/mercadopago/webhook'

  // Carrega configurações e transações
  useEffect(() => {
    let isMounted = true

    void mercadopagoService.getSettings().then((res) => {
      if (isMounted && res.success && res.data) {
        setSettings({
          ...res.data,
          notificationUrl: res.data.notificationUrl || defaultWebhookUrl,
        })
      }
    })

    void loadTransactions()

    return () => {
      isMounted = false
    }
  }, [])

  const loadTransactions = async (status = statusFilter, search = searchTerm) => {
    setIsLoadingTransactions(true)
    const res = await mercadopagoService.listTransactions({
      status: status === 'all' ? undefined : status,
      search: search.trim() || undefined,
    })
    setIsLoadingTransactions(false)

    if (res.success && res.data) {
      setTransactions(res.data.transactions)
      setMetrics(res.data.metrics)
    }
  }

  const handleSaveSettings = async () => {
    const rawToken = (settings.accessToken || '').trim()

    // 1. Validação se colou TESTUSER... no lugar do token
    if (rawToken.toUpperCase().startsWith('TESTUSER')) {
      alert(
        'Atenção: O valor digitado no campo Access Token é o nome de um usuário de teste (TESTUSER...), não o Access Token!\n\n' +
        'O Access Token do Mercado Pago é uma chave longa que começa com "APP_USR-" (para Produção) ou "TEST-" (para Testes).'
      )
      return
    }

    // 2. Validação de incompatibilidade entre modo e prefixo do token
    if (!settings.isSandbox && rawToken.startsWith('TEST-')) {
      const confirmChange = window.confirm(
        'Você selecionou o Modo Produção Oficial, mas o seu Access Token começa com "TEST-" (credencial de teste).\n\n' +
        'Deseja alterar automaticamente o ambiente para "Modo Sandbox (Testes)" para permitir a validação?'
      )
      if (confirmChange) {
        settings.isSandbox = true
      }
    }

    setIsSaving(true)
    setSaveSuccess(false)

    const res = await mercadopagoService.saveSettings(settings)
    setIsSaving(false)

    if (res.success) {
      setSaveSuccess(true)
      setIsEditing(false)
      setTimeout(() => setSaveSuccess(false), 3500)
    } else {
      alert(`Erro ao salvar configurações: ${res.error}`)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)

    const res = await mercadopagoService.testConnection(settings.accessToken)
    setIsTesting(false)
    setTestResult(res)
  }

  const handleCopyWebhookUrl = () => {
    const url = settings.notificationUrl || defaultWebhookUrl
    void navigator.clipboard.writeText(url)
    setCopiedWebhook(true)
    setTimeout(() => setCopiedWebhook(false), 2500)
  }

  const handleCheckStatus = async (mpPaymentId?: number | null) => {
    if (!mpPaymentId) return
    setActionMessage('Consultando status na API do Mercado Pago...')
    const res = await mercadopagoService.checkPaymentStatus(mpPaymentId)
    if (res.success) {
      setActionMessage(
        res.data?.isApproved
          ? 'Pagamento Aprovado e Acesso Liberado no Sistema com Sucesso!'
          : `Status Atualizado: ${res.data?.status}`,
      )
      void loadTransactions()
    } else {
      setActionMessage(`Falha na consulta: ${res.error}`)
    }
    setTimeout(() => setActionMessage(null), 4500)
  }

  const handleSimulateApproval = async (transactionId: string) => {
    if (!confirm('Deseja simular a aprovação deste pagamento para testar a liberação automática?')) {
      return
    }

    setActionMessage('Simulando confirmação de pagamento...')
    const res = await mercadopagoService.simulateApproval(transactionId)
    if (res.success) {
      setActionMessage('Pagamento Aprovado com Sucesso! Licença da empresa renovada.')
      void loadTransactions()
    } else {
      setActionMessage(`Falha na simulação: ${res.error}`)
    }
    setTimeout(() => setActionMessage(null), 4500)
  }

  return (
    <div className="space-y-8 animate-in fade-in-50">
      {/* 1. CARD PRINCIPAL: CREDENCIAIS & CONFIGURAÇÃO DA API */}
      <div className="bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-950 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* Cabeçalho da Seção */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-emerald-100 dark:border-emerald-950 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Integração Mercado Pago • PIX Automático
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    settings.isSandbox
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  {settings.isSandbox ? 'Modo Sandbox (Testes)' : 'Modo Produção'}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                    isEditing
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 animate-pulse'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {isEditing ? <Unlock className="w-3 h-3 text-blue-600" /> : <Lock className="w-3 h-3 text-slate-500" />}
                  {isEditing ? 'Modo de Edição Ativo' : 'Campos Bloqueados'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Geração de cobranças PIX dinâmicas, validação via Webhook e liberação automática de licenças de clientes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-xl transition cursor-pointer shadow-xs"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar Configurações
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false)
                  void mercadopagoService.getSettings().then((res) => {
                    if (res.success && res.data) {
                      setSettings({ ...res.data, notificationUrl: res.data.notificationUrl || defaultWebhookUrl })
                    }
                  })
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-300 rounded-xl transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Cancelar Edição
              </button>
            )}

            <button
              type="button"
              disabled={isTesting}
              onClick={() => void handleTestConnection()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              {isTesting ? 'Testando Conexão...' : 'Testar Conexão com Mercado Pago'}
            </button>
          </div>
        </div>

        {/* Feedback do Teste de Conexão */}
        {testResult && (
          <div
            className={`p-4 rounded-2xl border text-xs leading-relaxed flex items-start gap-3 ${
              testResult.connected
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}
          >
            {testResult.connected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              {testResult.connected ? (
                <div>
                  <span className="font-bold block text-sm mb-1">
                    Conexão com Mercado Pago Estabelecida com Sucesso!
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800/80">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">
                        Conta Vinculada:
                      </span>
                      <span className="font-semibold">{testResult.accountName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">
                        E-mail Cadastrado:
                      </span>
                      <span className="font-semibold">{testResult.email}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">
                        Ambiente do Token:
                      </span>
                      <span className="font-semibold">
                        {testResult.isSandbox ? 'Testes / Sandbox' : 'Produção Oficial'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="font-bold block text-sm mb-0.5">Falha de Autenticação na API:</span>
                  <span>{testResult.error}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Guia Rápido de Configuração */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 text-sm">
              <Key className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Guia: Onde obter as Credenciais Corretas no Mercado Pago
            </span>
            <a
              href="https://www.mercadopago.com.br/developers/panel/app"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition shadow-xs"
            >
              Abrir Painel Mercado Pago Developers ↗
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-600 dark:text-slate-300">
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-950 space-y-1.5">
              <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                1. Para Receber Pagamentos Reais (Produção)
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                <li>No painel do Mercado Pago, abra sua aplicação e clique em <strong>Credenciais de produção</strong> (menu esquerdo).</li>
                <li>Se houver o botão <strong>"Ativar credenciais de produção"</strong>, clique nele e preencha o segmento de negócio para liberar a conta.</li>
                <li>Copie o <strong>Access Token</strong> (começa com <code>APP_USR-</code>) e a <strong>Public Key</strong>.</li>
                <li>Cadastre qualquer <strong>Chave PIX</strong> na sua conta do Mercado Pago para receber as transferências.</li>
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-950 space-y-1.5">
              <div className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                2. Para Simulação / Testes (Sandbox)
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                <li>No painel da sua aplicação, clique na aba <strong>Credenciais de teste</strong>.</li>
                <li>Copie o <strong>Access Token</strong> que começa com <code>TEST-</code>.</li>
                <li>Selecione a opção <strong>Modo Sandbox (Testes)</strong> abaixo.</li>
                <li><em>Importante: Não use apelidos como <code>TESTUSER...</code> nem tokens de usuários fictícios no campo de token de produção.</em></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Banner Informativo Obrigatório sobre Riscos de Alterações Incorretas */}
        <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 p-4 sm:p-5 text-xs text-amber-950 dark:text-amber-200 space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-900 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Atenção: Impacto de Alterações Incorretas na Integração Mercado Pago</span>
          </div>
          <p className="leading-relaxed text-amber-900/90 dark:text-amber-200/90">
            Esta integração controla as cobranças PIX, a renovação de licença e o desbloqueio automático de todas as empresas clientes do sistema. Por segurança, os campos ficam bloqueados contra edições involuntárias. <strong>Veja o que acontecerá caso sejam feitas alterações incorretas:</strong>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px]">
            <div className="bg-white/90 dark:bg-slate-900/80 p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 shadow-2xs space-y-1">
              <span className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                ❌ Token Incorreto ou Inválido
              </span>
              <p className="text-slate-600 dark:text-slate-400">
                Nenhum cliente conseguirá gerar PIX (na tela de login, painel de faturas ou bloqueio de licença), impedindo o recebimento de mensalidades.
              </p>
            </div>
            <div className="bg-white/90 dark:bg-slate-900/80 p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 shadow-2xs space-y-1">
              <span className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                ❌ Ambiente Incompatível
              </span>
              <p className="text-slate-600 dark:text-slate-400">
                Usar credenciais de Sandbox (TEST-) no modo Produção gerará erro de <em>"Unauthorized use of live credentials"</em> ao tentar pagar.
              </p>
            </div>
            <div className="bg-white/90 dark:bg-slate-900/80 p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 shadow-2xs space-y-1">
              <span className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                ❌ URL de Webhook Alterada
              </span>
              <p className="text-slate-600 dark:text-slate-400">
                O sistema deixará de receber a confirmação bancária do Mercado Pago, e as empresas pagarão o PIX mas o sistema não liberará os 30 dias automaticamente.
              </p>
            </div>
          </div>
          {!isEditing && (
            <div className="pt-1 flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-300 font-semibold border-t border-amber-200 dark:border-amber-900/50">
              <span>Para alterar qualquer credencial com segurança, clique no botão <strong>"Editar Configurações"</strong> acima.</span>
            </div>
          )}
        </div>

        {/* Campos de Credenciais */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Seletor de Modo: Sandbox vs Produção */}
          <div className="space-y-2 lg:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ambiente de Operação:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
              <button
                type="button"
                disabled={!isEditing}
                onClick={() => setSettings((s) => ({ ...s, isSandbox: true }))}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  !isEditing ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                } ${
                  settings.isSandbox
                    ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 ring-2 ring-amber-400/50'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="font-bold text-sm">Modo Sandbox (Testes)</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Permite gerar cobranças com credenciais de teste sem transacionar dinheiro real.
                </div>
              </button>

              <button
                type="button"
                disabled={!isEditing}
                onClick={() => setSettings((s) => ({ ...s, isSandbox: false }))}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  !isEditing ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                } ${
                  !settings.isSandbox
                    ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-400/50'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="font-bold text-sm">Modo Produção Oficial</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Cobranças reais via PIX com liquidação em conta corrente bancária.
                </div>
              </button>
            </div>
          </div>

          {/* Access Token */}
          <div className="space-y-1.5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Access Token Oficial (Backend / Produção ou Teste)
              </label>
              <span className="text-[11px] text-slate-400">
                Obtido no painel de Desenvolvedores do Mercado Pago
              </span>
            </div>
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showToken ? 'text' : 'password'}
                disabled={!isEditing}
                value={settings.accessToken}
                onChange={(e) => setSettings((s) => ({ ...s, accessToken: e.target.value }))}
                placeholder="APP_USR-... ou TEST-..."
                className="w-full h-11 pl-10 pr-24 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showToken ? 'Ocultar' : 'Exibir'}
              </button>
            </div>

            {settings.accessToken && settings.accessToken.toUpperCase().startsWith('TESTUSER') && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Atenção:</strong> Você colou o nome/ID de um usuário de teste (<code>TESTUSER...</code>). O <strong>Access Token</strong> oficial do Mercado Pago fica na aba <strong>Credenciais de teste</strong> (ou Credenciais de produção) dentro da sua aplicação e sempre começa com <strong><code>TEST-</code></strong> ou <strong><code>APP_USR-</code></strong> seguido de um código longo.
                </div>
              </div>
            )}

            {settings.accessToken && !settings.accessToken.toUpperCase().startsWith('TESTUSER') && (
              settings.isSandbox && settings.accessToken.startsWith('APP_USR-') ? (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Aviso:</strong> Você colou um token de Produção (<code>APP_USR-...</code>), mas o ambiente acima está marcado como <strong>Modo Sandbox (Testes)</strong>. Para usar cobranças reais, selecione <strong>Modo Produção Oficial</strong> acima. Para testar sem dinheiro real, use o token que começa com <code>TEST-...</code> na aba "Credenciais de teste" do Mercado Pago.
                  </div>
                </div>
              ) : !settings.isSandbox && settings.accessToken.startsWith('TEST-') ? (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Aviso:</strong> Você colou um token de Testes (<code>TEST-...</code>), mas o ambiente acima está marcado como <strong>Modo Produção Oficial</strong>. Selecione <strong>Modo Sandbox (Testes)</strong> acima para validar pagamentos de teste.
                  </div>
                </div>
              ) : null
            )}
          </div>

          {/* Public Key */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Public Key (Chave Pública)
            </label>
            <input
              type="text"
              disabled={!isEditing}
              value={settings.publicKey}
              onChange={(e) => setSettings((s) => ({ ...s, publicKey: e.target.value }))}
              placeholder="APP_USR-... ou TEST-..."
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
          </div>

          {/* Webhook Secret */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Webhook Secret (Assinatura do Webhook - Opcional)
            </label>
            <input
              type="password"
              disabled={!isEditing}
              value={settings.webhookSecret}
              onChange={(e) => setSettings((s) => ({ ...s, webhookSecret: e.target.value }))}
              placeholder="Chave secreta de assinatura do webhook"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
          </div>

          {/* URL de Notificação Webhook para colar no painel do MP */}
          <div className="space-y-1.5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                URL de Notificação Webhook (Cadastre no Mercado Pago)
              </label>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                Eventos recomendados: Pagamentos (payment)
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={settings.notificationUrl || defaultWebhookUrl}
                className="flex-1 h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-mono text-slate-700 dark:text-slate-300"
              />
              <button
                type="button"
                onClick={handleCopyWebhookUrl}
                className="h-11 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                {copiedWebhook ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copiar URL
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Duração da Licença por Pagamento */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Dias de Licença Concedidos por Pagamento:
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="365"
                disabled={!isEditing}
                value={settings.licenseDurationDays}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, licenseDurationDays: Number(e.target.value) || 30 }))
                }
                className="w-28 h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-slate-500">
                dias de acesso adicionados automaticamente após confirmação do PIX.
              </span>
            </div>
          </div>
        </div>

        {/* Botão de Salvar Credenciais */}
        <div className="pt-4 border-t border-emerald-100 dark:border-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Credenciais protegidas por Row Level Security exclusivo para o proprietário do sistema.
          </div>

          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" /> Configurações salvas com sucesso!
              </span>
            )}

            <button
              type="button"
              disabled={isSaving || !isEditing}
              onClick={() => void handleSaveSettings()}
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition shadow-xs ${
                !isEditing
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
              }`}
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Salvar Credenciais do Mercado Pago'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. CARD DE CONTROLE ADMINISTRATIVO: MONITORAMENTO DE PAGAMENTOS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Controle Administrativo de Pagamentos PIX
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Acompanhamento em tempo real de cobranças, validações e histórico de liberações automáticas de clientes.
            </p>
          </div>

          <button
            type="button"
            disabled={isLoadingTransactions}
            onClick={() => void loadTransactions()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer self-start sm:self-center"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTransactions ? 'animate-spin' : ''}`} />
            Atualizar Lista
          </button>
        </div>

        {/* Notificação temporária de ação */}
        {actionMessage && (
          <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2 animate-in fade-in">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            {actionMessage}
          </div>
        )}

        {/* Cards de Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40">
            <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-400 block">
              Total Aprovado (R$)
            </span>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
              {formatCurrency(metrics.totalApprovedAmount.toFixed(2))}
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              {metrics.countApproved} pagamentos liberados
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40">
            <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-400 block">
              Cobranças Pendentes
            </span>
            <div className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1">
              {metrics.countPending}
            </div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 block">
              Aguardando transferência
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40">
            <span className="text-[10px] uppercase font-bold text-rose-800 dark:text-rose-400 block">
              Rejeitados / Expirados
            </span>
            <div className="text-xl font-black text-rose-700 dark:text-rose-300 mt-1">
              {metrics.countRejected}
            </div>
            <span className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 block">
              Tempo limite esgotado
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
              Total de Transações
            </span>
            <div className="text-xl font-black text-slate-800 dark:text-slate-200 mt-1">
              {metrics.totalCount}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Registros históricos
            </span>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          {/* Abas Rápidas de Status */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-2xl text-xs overflow-x-auto">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'approved', label: 'Aprovados' },
              { id: 'pending', label: 'Pendentes' },
              { id: 'rejected', label: 'Rejeitados' },
              { id: 'cancelled', label: 'Cancelados' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setStatusFilter(f.id)
                  void loadTransactions(f.id, searchTerm)
                }}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer shrink-0 ${
                  statusFilter === f.id
                    ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Campo de Busca */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                void loadTransactions(statusFilter, e.target.value)
              }}
              placeholder="Buscar cliente, licença ou ID..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Tabela de Transações */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Cliente / Organização</th>
                  <th className="py-3 px-4">Licença / Plano</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">ID Mercado Pago</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                      Nenhuma transação PIX encontrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const isApproved = tx.status === 'approved'
                    const isPending = tx.status === 'pending'
                    const isRejected = tx.status === 'rejected'
                    const createdDate = new Date(tx.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })

                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                      >
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {createdDate}
                        </td>

                        <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                          <div>{tx.organizationName || tx.payerName || 'Cliente'}</div>
                          <div className="text-[10px] font-normal text-slate-400">
                            {tx.payerEmail || tx.payerDocument || 'Sem e-mail'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                          {tx.accessPlanName || 'Plano Padrão'}
                        </td>

                        <td className="py-3.5 px-4 font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {formatCurrency(tx.amount.toFixed(2))}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                          {tx.mpPaymentId ? `#${tx.mpPaymentId}` : '—'}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isApproved
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                : isPending
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                  : isRejected
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {isApproved && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {isPending && <Clock className="w-3.5 h-3.5" />}
                            {isRejected && <XCircle className="w-3.5 h-3.5" />}
                            {isApproved
                              ? 'Aprovado'
                              : isPending
                                ? 'Pendente'
                                : isRejected
                                  ? 'Rejeitado'
                                  : tx.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                          {/* Botão Ver QR Code / Detalhes */}
                          <button
                            type="button"
                            onClick={() => setSelectedTxForDetail(tx)}
                            title="Ver QR Code e Detalhes da Cobrança"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>

                          {/* Botão Consultar Status no MP */}
                          {tx.mpPaymentId && (
                            <button
                              type="button"
                              onClick={() => void handleCheckStatus(tx.mpPaymentId)}
                              title="Consultar status atualizado no Mercado Pago"
                              className="p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}

                          {/* Botão Simular Aprovação (Sandbox / Testes) */}
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => void handleSimulateApproval(tx.id)}
                              title="Simular Aprovação (Testar liberação da licença)"
                              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] transition cursor-pointer"
                            >
                              Simular Aprovação
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL DE DETALHES / QR CODE DA TRANSAÇÃO */}
      {selectedTxForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-base text-gray-900 dark:text-white">
                Detalhes da Cobrança PIX
              </h4>
              <button
                type="button"
                onClick={() => setSelectedTxForDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="text-center space-y-3">
              <div className="text-2xl font-black text-emerald-600">
                {formatCurrency(selectedTxForDetail.amount.toFixed(2))}
              </div>

              {selectedTxForDetail.qrCodeBase64 ? (
                <img
                  src={`data:image/png;base64,${selectedTxForDetail.qrCodeBase64}`}
                  alt="QR Code"
                  className="w-48 h-48 mx-auto object-contain rounded-xl p-2 bg-white border border-slate-200"
                />
              ) : selectedTxForDetail.qrCode ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    selectedTxForDetail.qrCode,
                  )}`}
                  alt="QR Code"
                  className="w-48 h-48 mx-auto object-contain rounded-xl p-2 bg-white border border-slate-200"
                />
              ) : (
                <p className="text-xs text-slate-400">QR Code não disponível.</p>
              )}

              {selectedTxForDetail.qrCode && (
                <div className="space-y-1 text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Código Copia e Cola:
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={selectedTxForDetail.qrCode}
                      className="flex-1 h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(selectedTxForDetail.qrCode!)}
                      className="px-3 h-9 rounded-lg bg-emerald-600 text-white font-bold text-xs"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 space-y-1">
              <div>Cliente: <strong>{selectedTxForDetail.organizationName}</strong></div>
              <div>ID Mercado Pago: <strong>{selectedTxForDetail.mpPaymentId || '—'}</strong></div>
              <div>Status: <strong>{selectedTxForDetail.status}</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
