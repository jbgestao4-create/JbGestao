import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Image as ImageIcon,
  Headset,
  ShieldCheck,
  ArrowRight,
  Layers,
  BellRing,
  GitBranch,
  FileSignature,
  Settings,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { isSystemOwner } from '@shared/utils/system-owner'
import { suggestionService } from '@modules/suggestions/services/suggestion.service'
import { companyManagementService } from '../services/company-management.service'
import { contractService } from '../services/contract.service'
import { announcementService, type SystemAnnouncement } from '@shared/services/announcement.service'
import { systemMaintenanceService } from '@shared/services/system-maintenance.service'
import { systemNotificationService } from '@shared/services/system-notification.service'
import { systemUpdateService } from '@shared/services/system-update.service'
import { useSystemVersion } from '@shared/hooks/useSystemVersion'
import { systemSettingsService } from '@shared/services/system-settings.service'
import { formatUnreadSuggestionCount } from '@modules/suggestions/utils/suggestion.utils'

export function DeveloperSettingsPage() {
  const { user } = useAuth()
  const { currentOrganization } = useOrganization()
  const { version: systemVersion } = useSystemVersion()
  const navigate = useNavigate()

  const [companiesCount, setCompaniesCount] = useState<number | null>(null)
  const [activeAnnouncementsCount, setActiveAnnouncementsCount] = useState<number | null>(null)
  const [unreadSuggestionsCount, setUnreadSuggestionsCount] = useState(0)
  const [totalSuggestionsCount, setTotalSuggestionsCount] = useState<number | null>(null)
  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false)
  const [activeNotificationsCount, setActiveNotificationsCount] = useState<number | null>(null)
  const [updatesCount, setUpdatesCount] = useState<number | null>(null)
  const [contractsCount, setContractsCount] = useState<number | null>(null)
  const [inactivityMinutes, setInactivityMinutes] = useState<number>(() =>
    systemSettingsService.getLocalInactivityTimeoutMinutes(),
  )

  useEffect(() => {
    let isMounted = true

    const loadStats = async () => {
      try {
        const [compRes, annRes, maintRes, notifRes, updRes, contractRes, inactRes] = await Promise.all([
          companyManagementService.listAll(),
          announcementService.listAll(),
          systemMaintenanceService.getStatus(),
          systemNotificationService.listAll(),
          systemUpdateService.listAll(),
          contractService.listContracts(),
          systemSettingsService.getInactivitySettings(),
        ])

        if (isMounted) {
          if (inactRes.success && inactRes.data) {
            setInactivityMinutes(inactRes.data.timeoutMinutes)
          }
          if (compRes.success && compRes.data) {
            setCompaniesCount(compRes.data.length)
          }
          if (annRes.success && annRes.data) {
            setActiveAnnouncementsCount(annRes.data.filter((a: SystemAnnouncement) => a.isActive).length)
          }
          if (maintRes.success && maintRes.data) {
            setIsMaintenanceActive(maintRes.data.enabled)
          }
          if (notifRes.success && notifRes.data) {
            setActiveNotificationsCount(notifRes.data.filter((n) => n.isActive).length)
          }
          if (updRes.success && updRes.data) {
            setUpdatesCount(updRes.data.length)
          }
          if (contractRes.success && contractRes.data) {
            setContractsCount(contractRes.data.length)
          }
        }

        if (currentOrganization?.id) {
          const [unreadRes, allSugRes] = await Promise.all([
            suggestionService.getUnreadCount(currentOrganization.id),
            suggestionService.list(currentOrganization.id),
          ])
          if (isMounted) {
            if (unreadRes.success) {
              setUnreadSuggestionsCount(unreadRes.data)
            }
            if (allSugRes.success && allSugRes.data) {
              setTotalSuggestionsCount(allSugRes.data.length)
            }
          }
        }
      } catch {
        // Silently handle stats loading
      }
    }

    void loadStats()

    return () => {
      isMounted = false
    }
  }, [currentOrganization?.id])

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
          onClick={() => void navigate('/')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition cursor-pointer"
        >
          Voltar ao Início
        </button>
      </div>
    )
  }

  const developerOptions = [
    {
      id: 'companies',
      title: 'Empresas Cadastradas',
      badge: companiesCount !== null ? `${companiesCount} cadastradas` : undefined,
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
      description:
        'Gerencie o acesso de cada Identificador Único (SLUG)/Empresa cadastrado, ative ou desative acessos, configure planos e controle os módulos liberados.',
      actionText: 'Acessar Empresas',
      path: '/admin/companies',
      icon: Building2,
      iconBg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400',
      cardHoverBorder: 'hover:border-indigo-400 dark:hover:border-indigo-600',
      accentColor: 'indigo',
    },
    {
      id: 'contracts',
      title: 'Gerar Contratos / Faturas',
      badge: contractsCount !== null ? `${contractsCount} contratos` : undefined,
      badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-semibold',
      description:
        'Gere e administre contratos de locação/aluguel e faturas mensais do sistema para futuros clientes, definindo mensalidade, data, responsável e controle financeiro de pagamentos.',
      actionText: 'Gerar Contratos / Faturas',
      path: '/admin/contracts',
      icon: FileSignature,
      iconBg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/70 dark:text-purple-400',
      cardHoverBorder: 'hover:border-purple-400 dark:hover:border-purple-600',
      accentColor: 'purple',
    },
    {
      id: 'announcements',
      title: 'Anúncios',
      badge: activeAnnouncementsCount !== null ? `${activeAnnouncementsCount} ativos` : undefined,
      badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300',
      description:
        'Crie, edite e organize os comunicados, novidades e anúncios promocionais exibidos no carrossel da tela inicial (3s) e da tela de login (8s).',
      actionText: 'Gerenciar Anúncios',
      path: '/admin/announcements',
      icon: ImageIcon,
      iconBg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/70 dark:text-purple-400',
      cardHoverBorder: 'hover:border-purple-400 dark:hover:border-purple-600',
      accentColor: 'purple',
    },
    {
      id: 'support',
      title: 'Suporte',
      badge:
        unreadSuggestionsCount > 0
          ? `${formatUnreadSuggestionCount(unreadSuggestionsCount)} novas`
          : totalSuggestionsCount !== null
            ? `${totalSuggestionsCount} chamados`
            : undefined,
      badgeColor:
        unreadSuggestionsCount > 0
          ? 'bg-amber-500 text-white animate-pulse'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
      description:
        'Acompanhe, responda e gerencie chamados, dúvidas e solicitações de suporte enviadas pelos usuários e empresas da plataforma.',
      actionText: 'Acessar Suporte',
      path: '/suggestions',
      icon: Headset,
      iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400',
      cardHoverBorder: 'hover:border-amber-400 dark:hover:border-amber-600',
      accentColor: 'amber',
    },
    {
      id: 'system-notifications',
      title: 'Notificação do Sistema',
      badge: isMaintenanceActive
        ? '⚠️ Manutenção Ativa'
        : activeNotificationsCount !== null && activeNotificationsCount > 0
          ? `${activeNotificationsCount} notificações ativas`
          : '🟢 Sistema Operacional',
      badgeColor: isMaintenanceActive
        ? 'bg-rose-500 text-white animate-pulse'
        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
      description:
        'Ative ou desative o Modo de Manutenção de emergência temporária em tela cheia e envie mensagens ou comunicados direcionados a organizações ou funcionários específicos.',
      actionText: 'Gerenciar Notificações',
      path: '/admin/system-notifications',
      icon: BellRing,
      iconBg: isMaintenanceActive
        ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400'
        : 'bg-rose-50 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400',
      cardHoverBorder: 'hover:border-rose-400 dark:hover:border-rose-600',
      accentColor: 'rose',
    },
    {
      id: 'system-updates',
      title: 'Atualização do Sistema',
      badge: updatesCount !== null ? `${systemVersion} • ${updatesCount} entregas` : systemVersion,
      badgeColor: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 font-mono font-bold',
      description:
        'Acompanhe e registre o histórico completo de releases, novidades e correções do software, definindo a versão atual exibida em tempo real no topo do sistema.',
      actionText: 'Ver Atualizações',
      path: '/admin/system-updates',
      icon: GitBranch,
      iconBg: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/70 dark:text-cyan-400',
      cardHoverBorder: 'hover:border-cyan-400 dark:hover:border-cyan-600',
      accentColor: 'cyan',
    },
    {
      id: 'system-settings',
      title: 'Configuração do Sistema',
      badge: `${inactivityMinutes} min de inatividade`,
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold',
      description:
        'Ajuste o tempo limite de bloqueio por inatividade de sessão e gerencie as configurações de diagnóstico técnico e inteligência artificial da plataforma.',
      actionText: 'Acessar Configurações',
      path: '/admin/system-settings',
      icon: Settings,
      iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400',
      cardHoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-600',
      accentColor: 'emerald',
    },
  ]

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER PRINCIPAL */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Configurações de Desenvolvedor
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  <ShieldCheck className="w-3 h-3" /> Superadmin
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 max-w-2xl">
                Central administrativa e de controle da plataforma. Escolha uma das opções abaixo para gerenciar empresas, anúncios, sugestões, notificações ou atualizações do sistema.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void navigate('/')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Ir para Tela Inicial
            </button>
          </div>
        </div>
      </div>

      {/* CARDS DE ACESSO AOS MÓDULOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {developerOptions.map((opt) => {
          const Icon = opt.icon
          return (
            <div
              key={opt.id}
              onClick={() => void navigate(opt.path)}
              className={`group relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs transition-all duration-200 hover:shadow-md ${opt.cardHoverBorder} cursor-pointer flex flex-col justify-between`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-xl ${opt.iconBg} flex items-center justify-center transition-transform group-hover:scale-105 duration-200`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  {opt.badge && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${opt.badgeColor}`}>
                      {opt.badge}
                    </span>
                  )}
                </div>

                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {opt.title}
                  </h2>
                  <p className="mt-2 text-sm text-gray-500 dark:text-slate-400 line-clamp-3 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
                  {opt.actionText}
                </span>
                <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-600 group-hover:text-white text-slate-500 dark:text-slate-400 flex items-center justify-center transition-all duration-200">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* PAINEL DE INFORMAÇÕES DE DESENVOLVEDOR */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Acesso e Permissões do Desenvolvedor
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Sua conta atua como Proprietário do Sistema com privilégios de Superadmin irrestrito. Você pode navegar em qualquer empresa cadastrada para realizar testes operacionais ou alterar planos e módulos em tempo real. Os registros cadastrados em uma empresa não vazam para outras organizações.
        </p>
      </div>
    </div>
  )
}
