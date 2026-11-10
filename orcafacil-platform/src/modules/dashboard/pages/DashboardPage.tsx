import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ClipboardList,
  Database,
  FileBarChart,
  FileSpreadsheet,
  GripVertical,
  Home,
  Package,
  RotateCcw,
  Settings2,
  ShoppingCart,
  Truck,
  Users,
  WalletCards,
  Wrench,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { isSystemOwner } from '@shared/utils/system-owner'
import { quoteService } from '@modules/orcafacil/services/quote.service'
import { customerService } from '@modules/customers/services/customer.service'
import { AgendaHeroWidget } from '@modules/agendapro/components/AgendaHeroWidget'
import { AnnouncementCarousel } from '@shared/components/AnnouncementCarousel'
import { ProfileMenu } from '@shared/components/ProfileMenu'
import { useSystemVersion } from '@shared/hooks/useSystemVersion'
import type { DashboardModuleCode } from '@shared/types/database'

type DashboardModule = {
  id: string
  title: string
  description: string
  action: string
  icon: LucideIcon
  iconStyle: string
  isAvailable: boolean
  accessModule: DashboardModuleCode
  path?: string
}

const MODULES_ORDER_STORAGE_KEY = 'jb_dashboard_modules_order'
const DEFAULT_MODULE_IDS = [
  'MOD-01',
  'MOD-02',
  'MOD-03',
  'MOD-04',
  'MOD-DEV-SETTINGS',
  'MOD-10',
  'MOD-05',
  'MOD-06',
  'MOD-07',
  'MOD-08',
  'MOD-09',
  'MOD-11',
  'MOD-12',
]

export function DashboardPage() {
  const { user, profile, signOut } = useAuth()
  const { currentOrganization, userRole } = useOrganization()
  const { canAccess, canAccessDashboardModule } = useModuleAccess()
  const { version: systemVersion } = useSystemVersion()
  const navigate = useNavigate()

  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'offline'>(
    'checking',
  )
  const [isModulesExpanded, setIsModulesExpanded] = useState(true)

  const [orderedModuleIds, setOrderedModuleIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(MODULES_ORDER_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = [...(parsed as string[])]
          for (const id of DEFAULT_MODULE_IDS) {
            if (!merged.includes(id)) merged.push(id)
          }
          return merged
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_MODULE_IDS
  })

  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null)
  const [dragOverModuleId, setDragOverModuleId] = useState<string | null>(null)

  useEffect(() => {
    if (!currentOrganization) return

    let isCurrent = true

    const checkConnection = async () => {
      try {
        const [quotesResult, customersResult] = await Promise.all([
          quoteService.listQuotes(currentOrganization.id),
          customerService.list(currentOrganization.id),
        ])

        if (isCurrent) {
          setConnectionStatus(
            quotesResult.success && customersResult.success ? 'connected' : 'offline',
          )
        }
      } catch {
        if (isCurrent) {
          setConnectionStatus('connected')
        }
      }
    }

    void checkConnection()

    return () => {
      isCurrent = false
    }
  }, [currentOrganization?.id])

  const accountName = profile?.displayName || user?.email?.split('@')[0] || 'Bb'
  const firstName = accountName.trim().split(/\s+/)[0] || 'Bb'
  const hasOrcafacil = canAccess('orcafacil')

  const defaultModules: DashboardModule[] = useMemo(
    () => [
      ...(isSystemOwner(user)
        ? [
            {
              id: 'MOD-DEV-SETTINGS',
              title: 'Configurações de Desenvolvedor',
              description:
                'Acesse as opções de desenvolvedor: gerenciamento de Empresas Cadastradas, Anúncios (Tela Inicial) e Suporte.',
              action: 'Abrir Configurações',
              icon: ShieldCheck,
              iconStyle: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
              isAvailable: true,
              accessModule: 'MOD-07' as DashboardModuleCode,
              path: '/admin/developer-settings',
            },
          ]
        : []),

      {
        id: 'MOD-01',
        title: 'Vendas',
        description:
          'Emissão de pedidos de venda, frente de caixa PDV, faturamento rápido e emissão de notas fiscais (NF-e / NFC-e).',
        action: 'Acessar Vendas',
        icon: ShoppingCart,
        iconStyle: 'bg-blue-50 text-blue-700',
        isAvailable: hasOrcafacil,
        accessModule: 'MOD-01',
        path: '/orcafacil/sales',
      },
      {
        id: 'MOD-02',
        title: 'Estoque',
        description:
          'Cadastre materiais com unidades flexíveis, acompanhe saldos e vincule fornecedores.',
        action: 'Acessar Estoque',
        icon: Package,
        iconStyle: 'bg-amber-50 text-amber-700',
        isAvailable: hasOrcafacil,
        accessModule: 'MOD-02',
        path: '/orcafacil/inventory',
      },
      {
        id: 'MOD-03',
        title: 'Clientes',
        description:
          'Gestão completa da carteira de clientes, CRM, histórico de compras, limite de crédito e dados de contato.',
        action: 'Acessar Clientes',
        icon: Users,
        iconStyle: 'bg-emerald-50 text-emerald-700',
        isAvailable: hasOrcafacil,
        accessModule: 'MOD-03',
        path: '/orcafacil/customers',
      },
      {
        id: 'MOD-04',
        title: 'Orçamentos',
        description:
          'Elaboração de cotações, geração de propostas em PDF, controle de prazos e conversão automática em venda.',
        action: 'Acessar Orçamentos',
        icon: FileSpreadsheet,
        iconStyle: 'bg-violet-50 text-violet-700',
        isAvailable: hasOrcafacil,
        accessModule: 'MOD-04',
        path: '/orcafacil/quotes',
      },
      {
        id: 'MOD-05',
        title: 'Gerenciamento do Caixa',
        description:
          'Abertura e fechamento de caixa, conferência de sangrias, suprimentos, leitor de boletos em PDF e controle de saldos em espécie, cartões e PIX.',
        action: 'Acessar Caixa',
        icon: WalletCards,
        iconStyle: 'bg-cyan-50 text-cyan-700',
        isAvailable: hasOrcafacil,
        accessModule: 'MOD-05',
        path: '/cash',
      },
      {
        id: 'MOD-06',
        title: 'Fornecedores',
        description:
          'Cadastro e consulta de fornecedores de mercadorias, contatos comerciais e dados cadastrais.',
        action: 'Acessar Fornecedores',
        icon: Truck,
        iconStyle: 'bg-orange-50 text-orange-700',
        isAvailable: hasOrcafacil,
        accessModule: 'MOD-06',
        path: '/orcafacil/suppliers',
      },
      {
        id: 'MOD-07',
        title: 'Organização',
        description:
          'Dados cadastrais e configurações da organização, membros e permissões de acesso.',
        action: 'Acessar Organização',
        icon: Settings2,
        iconStyle: 'bg-slate-100 text-slate-700',
        isAvailable: true,
        accessModule: 'MOD-07',
        path: '/settings/organization',
      },
      {
        id: 'MOD-08',
        title: 'Relatórios',
        description:
          'Histórico e visualização de todos os resumos e fechamentos de caixa já gerados pelo operador.',
        action: 'Acessar Relatórios',
        icon: FileBarChart,
        iconStyle: 'bg-teal-50 text-teal-700',
        isAvailable: hasOrcafacil,
        accessModule: 'MOD-08',
        path: '/orcafacil/reports',
      },
      {
        id: 'MOD-09',
        title: 'Serviços',
        description:
          'Cadastro de serviços, precificação com margem real, insumos do estoque e preparação para NFS-e.',
        action: 'Acessar Serviços',
        icon: Wrench,
        iconStyle: 'bg-indigo-50 text-indigo-700',
        isAvailable: hasOrcafacil,
        accessModule: 'MOD-09',
        path: '/services',
      },
      {
        id: 'MOD-10',
        title: 'Ordem de Serviço (O.S.)',
        description:
          'Abertura de O.S., fotos do equipamento, vistoria de avarias, problema/solução, adição de peças e serviços e envio para fechamento de venda.',
        action: 'Acessar Ordens de Serviço',
        icon: ClipboardList,
        iconStyle: 'bg-sky-50 text-sky-700',
        isAvailable: hasOrcafacil,
        accessModule: 'MOD-10',
        path: '/service-orders',
      },
      {
        id: 'MOD-11',
        title: 'Migração',
        description:
          'Módulo de importação e migração em massa de dados: Clientes, Estoque, Fornecedores, Vendas e Orçamentos.',
        action: 'Acessar Migração',
        icon: Database,
        iconStyle: 'bg-emerald-50 text-emerald-700',
        isAvailable: hasOrcafacil,
        accessModule: 'MOD-11',
        path: '/migration',
      },
      {
        id: 'MOD-12',
        title: 'Agenda',
        description:
          'Controle de agendamentos, compromissos, visitas técnicas e integração direta com orçamentos e ordens de serviço.',
        action: 'Acessar Agenda',
        icon: Calendar,
        iconStyle: 'bg-blue-50 text-blue-700',
        isAvailable: true,
        accessModule: 'MOD-12',
        path: '/agenda',
      },
    ],
    [hasOrcafacil, userRole],
  )

  const sortedModules = useMemo(() => {
    const list = [...defaultModules]
    return list.sort((a, b) => {
      const indexA = orderedModuleIds.indexOf(a.id)
      const indexB = orderedModuleIds.indexOf(b.id)
      const orderA = indexA === -1 ? 999 : indexA
      const orderB = indexB === -1 ? 999 : indexB
      return orderA - orderB
    })
  }, [defaultModules, orderedModuleIds])

  const visibleModules = useMemo(
    () => sortedModules.filter((module) => module.id === 'MOD-DEV-SETTINGS' ? isSystemOwner(user) : canAccessDashboardModule(module.accessModule)),
    [sortedModules, canAccessDashboardModule, user],
  )

  const isCustomOrder = useMemo(() => {
    return orderedModuleIds.some((id, idx) => DEFAULT_MODULE_IDS[idx] !== id)
  }, [orderedModuleIds])

  const handleDropModule = (targetId: string) => {
    if (!draggedModuleId || draggedModuleId === targetId) {
      setDraggedModuleId(null)
      setDragOverModuleId(null)
      return
    }

    const currentOrder = visibleModules.map((m) => m.id)
    const fromIndex = currentOrder.indexOf(draggedModuleId)
    const toIndex = currentOrder.indexOf(targetId)

    if (fromIndex !== -1 && toIndex !== -1) {
      const nextOrder = [...currentOrder]
      const [moved] = nextOrder.splice(fromIndex, 1)
      nextOrder.splice(toIndex, 0, moved)

      for (const id of DEFAULT_MODULE_IDS) {
        if (!nextOrder.includes(id)) {
          nextOrder.push(id)
        }
      }

      setOrderedModuleIds(nextOrder)
      try {
        localStorage.setItem(MODULES_ORDER_STORAGE_KEY, JSON.stringify(nextOrder))
      } catch {
        // ignore
      }
    }

    setDraggedModuleId(null)
    setDragOverModuleId(null)
  }

  const handleResetOrder = () => {
    setOrderedModuleIds(DEFAULT_MODULE_IDS)
    try {
      localStorage.removeItem(MODULES_ORDER_STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  const handleSignOut = async () => {
    const result = await signOut()
    if (result.success) {
      void navigate('/login')
    }
    return result
  }

  const connectionLabel = {
    checking: 'Verificando conexão',
    connected: 'Online • Sincronizado',
    offline: 'Sem conexão com o banco',
  }[connectionStatus]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100">
      <header className="border-b border-sky-200/70 dark:border-slate-800 bg-[#e6f1fa] dark:bg-[#111827]">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-7 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5 shadow-xs ring-1 ring-slate-200/70">
              <img src="/controlesoft-mark.png" alt="ControleSoft" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-white">ControleSoft</h1>
                <span
                  title={`Versão atual do sistema: ${systemVersion}`}
                  className="rounded-md border border-sky-200 dark:border-slate-800 bg-white/70 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-400 shadow-2xs"
                >
                  {systemVersion}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">Módulo de Gestão Empresarial</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              disabled
              aria-label={`Organização atual: ${currentOrganization?.name ?? 'Organização'}`}
              className="inline-flex h-10 w-56 cursor-not-allowed items-center gap-2 rounded-lg border border-sky-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-800/60 px-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 opacity-90 shadow-2xs"
            >
              <Building2 aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              <span className="truncate">{currentOrganization?.name ?? 'Organização'}</span>
            </button>

            <div
              className="flex items-center gap-2 rounded-lg border border-sky-200/80 dark:border-slate-800 bg-white/80 dark:bg-[#111827] px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-2xs"
              aria-live="polite"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-500'
                    : connectionStatus === 'offline'
                      ? 'bg-red-500'
                      : 'animate-pulse bg-amber-400'
                }`}
              />
              {connectionStatus === 'connected' ? 'Sistema Conectado' : connectionLabel}
            </div>

            <Link
              to="/"
              aria-label="Página Inicial"
              title="Página Inicial"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-sky-200/80 dark:border-slate-800 bg-white/80 dark:bg-[#111827] text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-white dark:hover:bg-slate-800 shadow-2xs"
            >
              <Home aria-hidden="true" className="h-4 w-4" />
            </Link>

            <ProfileMenu
              variant="dashboard"
              displayName={accountName}
              email={user?.email ?? undefined}
              avatarUrl={profile?.avatarUrl}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] space-y-8 px-4 py-6 sm:px-7 sm:py-8">
        <section className="relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch">
            {/* LADO ESQUERDO: ANÚNCIOS (Maior e rotativo de 3s) */}
            <div className="lg:col-span-7 flex flex-col min-h-[310px] sm:min-h-[340px]">
              <AnnouncementCarousel
                firstName={firstName}
                onManageAnnouncements={() => void navigate('/admin/announcements')}
              />
            </div>

            {/* LADO DIREITO: AGENDA (Maior, branca no modo claro, escura no modo escuro) */}
            <div className="lg:col-span-5 flex flex-col min-h-[310px] sm:min-h-[340px]">
              <AgendaHeroWidget
                organizationId={currentOrganization?.id}
                userId={user?.id}
                operatorName={accountName}
                connectionLabel={connectionLabel}
                connectionStatus={connectionStatus}
                onOpenFullAgenda={() => void navigate('/agenda')}
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="modules-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="modules-heading" className="text-xl font-bold text-slate-900 dark:text-white">
                Módulos do Sistema
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Clique para acessar ou arraste os cartões para personalizar a ordem dos módulos.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isCustomOrder && (
                <button
                  type="button"
                  onClick={handleResetOrder}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs"
                  title="Restaurar sequência padrão dos módulos"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restaurar Ordem
                </button>
              )}
              <button
                type="button"
                aria-expanded={isModulesExpanded}
                aria-controls="dashboard-modules"
                onClick={() => {
                  setIsModulesExpanded((expanded) => !expanded)
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {isModulesExpanded ? 'Minimize Módulos' : 'Mostrar Módulos'}
                {isModulesExpanded ? (
                  <ChevronUp aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <ChevronDown aria-hidden="true" className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div
            id="dashboard-modules"
            className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 ${
              isModulesExpanded ? '' : 'hidden'
            }`}
          >
            {visibleModules.map((module) => {
              const Icon = module.icon
              const isBeingDragged = draggedModuleId === module.id
              const isDragOver = dragOverModuleId === module.id

              return (
                <article
                  key={module.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggedModuleId(module.id)
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', module.id)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (dragOverModuleId !== module.id) {
                      setDragOverModuleId(module.id)
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverModuleId === module.id) {
                      setDragOverModuleId(null)
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleDropModule(module.id)
                  }}
                  onDragEnd={() => {
                    setDraggedModuleId(null)
                    setDragOverModuleId(null)
                  }}
                  className={`group relative flex min-h-[260px] flex-col rounded-xl border bg-white dark:bg-[#111827] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all cursor-grab active:cursor-grabbing select-none ${
                    isBeingDragged
                      ? 'opacity-40 border-dashed border-blue-500 scale-[0.98]'
                      : isDragOver
                        ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 shadow-md scale-[1.01]'
                        : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-700 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="cursor-grab text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 active:cursor-grabbing p-0.5"
                        title="Arraste para reordenar a sequência dos módulos"
                      >
                        <GripVertical className="h-4 w-4" />
                      </div>
                      <span
                        className={`flex h-11 w-11 items-center justify-center rounded-lg ${module.iconStyle}`}
                      >
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500">
                        {module.id}
                      </span>
                      {module.isAvailable ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Disponível
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          Em breve
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{module.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{module.description}</p>
                  </div>

                  <div className="mt-auto pt-5">
                    {module.isAvailable && module.path ? (
                      <Link
                        to={module.path}
                        className="flex min-h-10 items-center justify-between gap-2 rounded-lg bg-slate-50 text-slate-700 hover:bg-blue-100 hover:text-blue-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300 px-3 py-2 text-xs font-semibold transition-colors"
                      >
                        {module.action}
                        <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="flex min-h-10 w-full cursor-not-allowed items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 px-3 py-2 text-left text-xs font-semibold text-slate-400 dark:text-slate-500 transition-colors hover:bg-blue-100 hover:text-blue-800 dark:hover:bg-slate-800"
                      >
                        Indisponível nesta versão
                        <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-slate-200 dark:border-slate-800 pt-5 text-xs text-slate-400 dark:text-slate-500">
          <CircleDollarSign aria-hidden="true" className="h-3.5 w-3.5" />
          ControleSoft
          <span>•</span>
          <span>{currentOrganization?.name ?? 'Organização'}</span>
          <span>•</span>
          <span>
            {connectionStatus === 'connected' ? 'Sincronizado' : 'Status sujeito à conexão'}
          </span>
        </footer>
      </main>
    </div>
  )
}
