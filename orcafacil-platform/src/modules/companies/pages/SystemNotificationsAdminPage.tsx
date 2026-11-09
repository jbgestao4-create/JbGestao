import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BellRing,
  Building2,
  AlertTriangle,
  Send,
  Trash2,
  User,
  Users,
  Power,
  RefreshCw,
  Sparkles,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { isSystemOwner } from '@shared/utils/system-owner'
import {
  companyManagementService,
  type ManagedCompany,
  type CompanyUserItem,
} from '../services/company-management.service'
import {
  systemMaintenanceService,
  type MaintenanceStatus,
} from '@shared/services/system-maintenance.service'
import {
  systemNotificationService,
  type SystemNotification,
  type SystemNotificationType,
  type SystemNotificationTargetType,
} from '@shared/services/system-notification.service'

export function SystemNotificationsAdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // State: Modo de Manutenção
  const [maintenance, setMaintenance] = useState<MaintenanceStatus>({
    enabled: false,
    message: '',
    updatedAt: '',
  })
  const [maintenanceMessageInput, setMaintenanceMessageInput] = useState('')
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false)
  const [maintenanceFeedback, setMaintenanceFeedback] = useState<string | null>(null)

  // State: Dados de Empresas e Funcionários
  const [companies, setCompanies] = useState<ManagedCompany[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [companyUsers, setCompanyUsers] = useState<CompanyUserItem[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)

  // State: Formulário de Nova Notificação
  const [targetType, setTargetType] = useState<SystemNotificationTargetType>('organization')
  const [targetUserId, setTargetUserId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [notifType, setNotifType] = useState<SystemNotificationType>('warning')
  const [contactWhatsapp, setContactWhatsapp] = useState('5531986848490')
  const [contactEmail, setContactEmail] = useState('suporte@jbsoftware.com.br')
  const [isSending, setIsSending] = useState(false)
  const [sendFeedback, setSendFeedback] = useState<string | null>(null)

  // State: Lista de Notificações
  const [notifications, setNotifications] = useState<SystemNotification[]>([])
  const [isLoadingList, setIsLoadingList] = useState(true)

  const isDev = isSystemOwner(user)

  // Carrega status de manutenção, empresas e notificações
  const loadData = async () => {
    setIsLoadingList(true)
    try {
      const [maintRes, compRes, notifRes] = await Promise.all([
        systemMaintenanceService.getStatus(),
        companyManagementService.listAll(),
        systemNotificationService.listAll(),
      ])

      if (maintRes.success && maintRes.data) {
        setMaintenance(maintRes.data)
        setMaintenanceMessageInput(maintRes.data.message)
      }

      if (compRes.success && compRes.data) {
        setCompanies(compRes.data)
        if (compRes.data.length > 0 && !selectedOrgId) {
          setSelectedOrgId(compRes.data[0].id)
        }
      }

      if (notifRes.success && notifRes.data) {
        setNotifications(notifRes.data)
      }
    } finally {
      setIsLoadingList(false)
    }
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Carrega usuários da empresa selecionada quando necessário
  useEffect(() => {
    if (!selectedOrgId || targetType !== 'user') return

    let isMounted = true
    setIsLoadingUsers(true)

    const fetchUsers = async () => {
      const res = await companyManagementService.getCompanyUsers(selectedOrgId)
      if (isMounted) {
        setIsLoadingUsers(false)
        if (res.success && res.data) {
          setCompanyUsers(res.data)
          if (res.data.length > 0) {
            setTargetUserId(res.data[0].userId)
          } else {
            setTargetUserId('')
          }
        }
      }
    }

    void fetchUsers()

    return () => {
      isMounted = false
    }
  }, [selectedOrgId, targetType])

  if (!isDev) {
    return (
      <div className="py-20 max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Acesso Restrito ao Desenvolvedor</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Este painel é restrito exclusivamente ao desenvolvedor do sistema.
        </p>
        <button
          type="button"
          onClick={() => void navigate('/')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition cursor-pointer"
        >
          Voltar ao Início
        </button>
      </div>
    )
  }

  // Toggle do modo de manutenção
  const handleToggleMaintenance = async (newState: boolean) => {
    setIsSavingMaintenance(true)
    setMaintenanceFeedback(null)
    try {
      const res = await systemMaintenanceService.setMaintenanceMode(
        newState,
        maintenanceMessageInput,
      )
      if (!res.success) {
        setMaintenanceFeedback(`Erro: ${res.error || 'Falha ao alterar manutenção'}`)
      } else {
        setMaintenance(res.data)
        setMaintenanceFeedback(
          newState
            ? '⚠️ Modo de manutenção ATIVADO com sucesso! Usuários comuns estão bloqueados.'
            : '✅ Modo de manutenção DESATIVADO! O sistema voltou ao ar para todos.',
        )
      }
    } finally {
      setIsSavingMaintenance(false)
    }
  }

  // Salvar mensagem personalizada de manutenção
  const handleSaveMaintenanceMessage = async () => {
    setIsSavingMaintenance(true)
    setMaintenanceFeedback(null)
    try {
      const res = await systemMaintenanceService.setMaintenanceMode(
        maintenance.enabled,
        maintenanceMessageInput,
      )
      if (!res.success) {
        setMaintenanceFeedback(`Erro: ${res.error || 'Falha ao atualizar mensagem'}`)
      } else {
        setMaintenance(res.data)
        setMaintenanceFeedback('✅ Mensagem de manutenção atualizada com sucesso!')
      }
    } finally {
      setIsSavingMaintenance(false)
    }
  }

  // Enviar Notificação Direcionada
  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) {
      setSendFeedback('Preencha o título e o conteúdo da mensagem.')
      return
    }

    setIsSending(true)
    setSendFeedback(null)

    const selectedOrg = companies.find((c) => c.id === selectedOrgId)
    const selectedUser = companyUsers.find((u) => u.userId === targetUserId)

    const res = await systemNotificationService.create({
      title: title.trim(),
      message: message.trim(),
      type: notifType,
      targetType,
      organizationId: targetType === 'all' ? null : selectedOrgId || null,
      targetOrganizationName: targetType === 'all' ? 'Todas as Empresas' : selectedOrg?.name,
      targetUserId: targetType === 'user' ? targetUserId || null : null,
      targetUserName: targetType === 'user' ? selectedUser?.displayName : null,
      targetUserEmail: targetType === 'user' ? selectedUser?.email : null,
      contactWhatsapp: contactWhatsapp.trim() || null,
      contactEmail: contactEmail.trim() || null,
    })

    setIsSending(false)

    if (!res.success) {
      setSendFeedback(`Erro: ${res.error || 'Falha ao enviar notificação'}`)
    } else {
      setSendFeedback('✅ Notificação enviada com sucesso!')
      setTitle('')
      setMessage('')
      setNotifications((prev) => [res.data, ...prev])
    }
  }

  // Alternar ativação de notificação
  const handleToggleNotification = async (id: string, currentState: boolean) => {
    const res = await systemNotificationService.toggleActive(id, !currentState)
    if (res.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isActive: !currentState } : n)),
      )
    }
  }

  // Excluir notificação
  const handleDeleteNotification = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta notificação?')) return

    const res = await systemNotificationService.delete(id)
    if (res.success) {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }
  }

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto">
      {/* HEADER PRINCIPAL */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => void navigate('/admin/developer-settings')}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition shrink-0 cursor-pointer"
              title="Voltar para Configurações de Desenvolvedor"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <BellRing className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Notificação do Sistema e Manutenção
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  <Sparkles className="w-3 h-3" /> Painel de Controle
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 max-w-2xl">
                Ative o modo de manutenção de emergência temporária em tela cheia e envie mensagens ou comunicados direcionados a organizações e funcionários específicos.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar Status
          </button>
        </div>
      </div>

      {/* SEÇÃO 1: MODO DE MANUTENÇÃO DO SISTEMA */}
      <div className={`border rounded-2xl p-6 sm:p-8 transition-colors ${
        maintenance.enabled
          ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60'
          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200/60 dark:border-slate-800">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              maintenance.enabled
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
            }`}>
              <Power className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Modo de Manutenção do Sistema
                </h2>
                {maintenance.enabled ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500 text-white animate-pulse">
                    ⚠️ Manutenção Ativa
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    🟢 Sistema Operacional
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 max-w-2xl">
                Quando ativado, qualquer colaborador ou cliente que tentar acessar ou logar no sistema verá uma tela cheia bloqueando o acesso e informando sobre a manutenção de emergência temporária.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {maintenance.enabled ? (
              <button
                type="button"
                onClick={() => void handleToggleMaintenance(false)}
                disabled={isSavingMaintenance}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                <Power className="w-4 h-4" />
                Desativar Manutenção (Voltar ao Ar)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleToggleMaintenance(true)}
                disabled={isSavingMaintenance}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                Ativar Manutenção de Emergência
              </button>
            )}
          </div>
        </div>

        {/* Mensagem e Configuração do Alerta de Manutenção */}
        <div className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">
            Mensagem exibida em tela cheia para os usuários:
          </label>
          <textarea
            rows={3}
            value={maintenanceMessageInput}
            onChange={(e) => setMaintenanceMessageInput(e.target.value)}
            placeholder="Ex: O sistema encontra-se em manutenção de emergência temporária. Solicitamos que aguardem o retorno das operações em instantes."
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dica: Como desenvolvedor, você continuará tendo acesso completo ao software mesmo com a manutenção ligada para efetuar correções e testes.
            </p>
            <button
              type="button"
              onClick={() => void handleSaveMaintenanceMessage()}
              disabled={isSavingMaintenance}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 transition cursor-pointer self-end sm:self-auto shrink-0"
            >
              Salvar Apenas Mensagem
            </button>
          </div>

          {maintenanceFeedback && (
            <div className={`p-3 rounded-xl text-sm font-medium ${
              maintenanceFeedback.startsWith('✅')
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            }`}>
              {maintenanceFeedback}
            </div>
          )}
        </div>
      </div>

      {/* SEÇÃO 2: ENVIAR NOTIFICAÇÃO DIRECIONADA */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Enviar Notificação Direcionada
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Envie uma notificação direta que aparecerá como um pop-up de aviso quando o destinatário abrir o software.
          </p>
        </div>

        <form onSubmit={handleSendNotification} className="space-y-5">
          {/* SELEÇÃO DO TIPO DE DESTINATÁRIO */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Selecione o Destinatário:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label
                className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  targetType === 'organization'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="targetType"
                  value="organization"
                  checked={targetType === 'organization'}
                  onChange={() => setTargetType('organization')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold">Organização Específica</span>
              </label>

              <label
                className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  targetType === 'user'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="targetType"
                  value="user"
                  checked={targetType === 'user'}
                  onChange={() => setTargetType('user')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-semibold">Funcionário Específico</span>
              </label>

              <label
                className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  targetType === 'all'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="targetType"
                  value="all"
                  checked={targetType === 'all'}
                  onChange={() => setTargetType('all')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-semibold">Todas as Empresas</span>
              </label>
            </div>
          </div>

          {/* CAMPOS DEPENDENTES DO DESTINATÁRIO */}
          {targetType !== 'all' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Selecione a Empresa / Organização:
                </label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-gray-900 dark:text-white"
                >
                  {companies.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name} ({comp.slug})
                    </option>
                  ))}
                </select>
              </div>

              {targetType === 'user' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Selecione o Funcionário / Usuário:
                  </label>
                  {isLoadingUsers ? (
                    <div className="text-xs text-slate-500 py-2.5">Carregando colaboradores...</div>
                  ) : companyUsers.length === 0 ? (
                    <div className="text-xs text-amber-600 dark:text-amber-400 py-2.5">
                      Nenhum colaborador encontrado para esta empresa.
                    </div>
                  ) : (
                    <select
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-gray-900 dark:text-white"
                    >
                      {companyUsers.map((u) => (
                        <option key={u.userId} value={u.userId}>
                          {u.displayName} ({u.email}) - {u.role}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TÍTULO, TIPO E MENSAGEM */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Título / Assunto da Notificação:
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Contato Importante com a Administração"
                className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tipo do Aviso:
              </label>
              <select
                value={notifType}
                onChange={(e) => setNotifType(e.target.value as SystemNotificationType)}
                className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-gray-900 dark:text-white"
              >
                <option value="warning">⚠️ Aviso Importante</option>
                <option value="urgent">🚨 Urgente</option>
                <option value="contact">📞 Solicitação de Contato</option>
                <option value="info">ℹ️ Informativo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Conteúdo da Notificação / Mensagem:
            </label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite aqui as instruções, o motivo do contato ou as orientações detalhadas que o destinatário deve ler..."
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* DADOS DE CONTATO PARA RETORNO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                WhatsApp para Retorno Direto (Opcional):
              </label>
              <input
                type="text"
                value={contactWhatsapp}
                onChange={(e) => setContactWhatsapp(e.target.value)}
                placeholder="5531986848490"
                className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                E-mail para Retorno (Opcional):
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="suporte@jbsoftware.com.br"
                className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {sendFeedback && (
              <span className={`text-sm font-semibold ${
                sendFeedback.startsWith('✅') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {sendFeedback}
              </span>
            )}
            <button
              type="submit"
              disabled={isSending}
              className="ml-auto inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {isSending ? 'Enviando...' : 'Enviar Notificação Agora'}
            </button>
          </div>
        </form>
      </div>

      {/* SEÇÃO 3: HISTÓRICO DE NOTIFICAÇÕES ENVIADAS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Histórico de Notificações Enviadas ({notifications.length})
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Visualize, desative temporariamente ou remova mensagens enviadas anteriormente.
            </p>
          </div>
        </div>

        {isLoadingList ? (
          <div className="py-12 text-center text-slate-500">Carregando histórico de notificações...</div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
            Nenhuma notificação enviada até o momento.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      n.type === 'urgent'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                        : n.type === 'warning'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                          : n.type === 'contact'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                    }`}>
                      {n.type === 'urgent' && '🚨 Urgente'}
                      {n.type === 'warning' && '⚠️ Aviso'}
                      {n.type === 'contact' && '📞 Contato'}
                      {n.type === 'info' && 'ℹ️ Informativo'}
                    </span>

                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Destino:{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {n.targetType === 'all' && '📢 Todas as Empresas'}
                        {n.targetType === 'organization' && `🏢 ${n.targetOrganizationName || 'Organização'}`}
                        {n.targetType === 'user' && `👤 ${n.targetUserName || n.targetUserEmail || 'Funcionário'}`}
                      </strong>
                    </span>

                    <span className="text-xs text-slate-400">
                      &bull; {new Date(n.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {n.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-slate-300 line-clamp-2">
                    {n.message}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleToggleNotification(n.id, n.isActive)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      n.isActive
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {n.isActive ? 'Ativa' : 'Inativa'}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDeleteNotification(n.id)}
                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                    title="Excluir Notificação"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
