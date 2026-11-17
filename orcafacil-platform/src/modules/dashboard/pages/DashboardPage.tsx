import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpDown,
  Calendar,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ClipboardList,
  Database,
  FileBarChart,
  FileSpreadsheet,
  GripVertical,
  Package,
  RotateCcw,
  Settings2,
  ShoppingCart,
  Truck,
  Users,
  WalletCards,
  Wrench,
  ShieldCheck,
  X,
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
import {
  announcementService,
  type SystemAnnouncement,
} from '@shared/services/announcement.service'
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
  const { user, profile } = useAuth()
  const { currentOrganization, userRole } = useOrganization()
  const { canAccess, canAccessDashboardModule } = useModuleAccess()
  const navigate = useNavigate()

  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'offline'>(
    'checking',
  )
  const [isModulesExpanded, setIsModulesExpanded] = useState(true)
  const [initialAnnouncements, setInitialAnnouncements] = useState<SystemAnnouncement[] | undefined>(
    () => announcementService.getCachedActive('dashboard'),
  )

  useEffect(() => {
    let isMounted = true
    const loadAnnouncements = async () => {
      try {
        const res = await announcementService.listActive()
        if (isMounted) {
          setInitialAnnouncements(res.success && res.data ? res.data : [])
        }
      } catch {
        if (isMounted) {
          setInitialAnnouncements([])
        }
      }
    }
    void loadAnnouncements()
    return () => {
      isMounted = false
    }
  }, [])

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

  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false)
  const [selectedSourceIndex, setSelectedSourceIndex] = useState<number>(0)
  const [selectedTargetIndex, setSelectedTargetIndex] = useState<number>(0)

  const handleSwapPositions = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return
    const currentOrder = visibleModules.map((m) => m.id)
    if (fromIndex >= currentOrder.length || toIndex >= currentOrder.length) return

    const nextOrder = [...currentOrder]
    const temp = nextOrder[fromIndex]
    nextOrder[fromIndex] = nextOrder[toIndex]
    nextOrder[toIndex] = temp

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

  const handleApplyModalSwap = () => {
    handleSwapPositions(selectedSourceIndex, selectedTargetIndex)
    setSelectedSourceIndex(selectedTargetIndex)
    setSelectedTargetIndex(selectedSourceIndex)
  }

  const handleResetOrder = () => {
    setOrderedModuleIds(DEFAULT_MODULE_IDS)
    try {
      localStorage.removeItem(MODULES_ORDER_STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  const connectionLabel = {
    checking: 'Verificando conexão',
    connected: 'Online • Sincronizado',
    offline: 'Sem conexão com o banco',
  }[connectionStatus]

  return (
    <div className="bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100">
      <div className="container-fluid mx-auto w-full max-w-[1600px] space-y-8 px-3 py-5 sm:px-7 sm:py-8">
        <section className="relative">
          <div className="row g-4 items-stretch">
            {/* LADO ESQUERDO: ANÚNCIOS (Maior e rotativo de 3s) */}
            <div className="col-12 col-lg-7 flex flex-col min-h-[260px] sm:min-h-[340px]">
              <AnnouncementCarousel
                firstName={firstName}
                initialAnnouncements={initialAnnouncements}
                onManageAnnouncements={() => void navigate('/admin/announcements')}
              />
            </div>

            {/* LADO DIREITO: AGENDA (Maior, branca no modo claro, escura no modo escuro) */}
            <div className="col-12 col-lg-5 flex flex-col min-h-[300px] sm:min-h-[340px]">
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
              <button
                type="button"
                onClick={() => {
                  setSelectedSourceIndex(0)
                  setSelectedTargetIndex(visibleModules.length > 1 ? 1 : 0)
                  setIsReorderModalOpen(true)
                }}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors shadow-2xs cursor-pointer"
                title="Abrir painel para escolher e trocar as posições dos módulos"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                Escolher Posições
              </button>
              {isCustomOrder && (
                <button
                  type="button"
                  onClick={handleResetOrder}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs cursor-pointer"
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
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
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
            className={`row g-3 g-md-4 ${
              isModulesExpanded ? '' : 'hidden'
            }`}
          >
            {visibleModules.map((module, index) => {
              const Icon = module.icon
              const isBeingDragged = draggedModuleId === module.id
              const isDragOver = dragOverModuleId === module.id

              return (
                <div key={module.id} className="col-12 col-sm-6 col-lg-4 col-xl-3 d-flex">
                <article
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
                  className={`group relative flex w-full min-h-[240px] sm:min-h-[260px] flex-col rounded-xl border bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all cursor-grab active:cursor-grabbing select-none ${
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
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <label
                          htmlFor={`module-pos-${module.id}`}
                          className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-blue-400 rounded-md px-1.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer"
                          title="Clique para trocar a posição deste módulo com outro"
                        >
                          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Pos:</span>
                          <select
                            id={`module-pos-${module.id}`}
                            value={index + 1}
                            onChange={(e) => {
                              e.stopPropagation()
                              handleSwapPositions(index, parseInt(e.target.value, 10) - 1)
                            }}
                            className="bg-transparent font-bold text-blue-600 dark:text-blue-400 text-xs cursor-pointer focus:outline-none"
                          >
                            {visibleModules.map((targetMod, targetIdx) => (
                              <option
                                key={targetMod.id}
                                value={targetIdx + 1}
                                className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-normal"
                              >
                                {targetIdx + 1}º {targetIdx === index ? '(Atual)' : `(Trocar c/ ${targetMod.title})`}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      {module.isAvailable ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Disponível
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
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
                </div>
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
      </div>

      {/* MODAL DE ESCOLHA E TROCA DE POSIÇÕES DE MÓDULOS */}
      {isReorderModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsReorderModalOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {/* CABEÇALHO */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <ArrowUpDown className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Organizar Posição dos Módulos
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Selecione qual módulo deseja mover e a posição desejada para trocar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReorderModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* PAINEL DE TROCA DIRETA (SOLICITADO PELO USUÁRIO) */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    1. Módulo que deseja mover:
                  </label>
                  <select
                    value={selectedSourceIndex}
                    onChange={(e) => setSelectedSourceIndex(parseInt(e.target.value, 10))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-blue-600 cursor-pointer"
                  >
                    {visibleModules.map((mod, idx) => (
                      <option key={mod.id} value={idx}>
                        {idx + 1}º - {mod.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    2. Para qual posição deseja enviá-lo:
                  </label>
                  <select
                    value={selectedTargetIndex}
                    onChange={(e) => setSelectedTargetIndex(parseInt(e.target.value, 10))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-blue-600 cursor-pointer"
                  >
                    {visibleModules.map((mod, idx) => (
                      <option key={mod.id} value={idx}>
                        {idx + 1}ª Posição ({mod.title})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {selectedSourceIndex !== selectedTargetIndex
                    ? `O módulo "${visibleModules[selectedSourceIndex]?.title}" e "${visibleModules[selectedTargetIndex]?.title}" trocarão de lugar.`
                    : 'Selecione posições distintas para realizar a troca.'}
                </span>

                <button
                  type="button"
                  onClick={handleApplyModalSwap}
                  disabled={selectedSourceIndex === selectedTargetIndex}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 text-xs font-semibold text-white shadow-xs transition-colors shrink-0 cursor-pointer"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  Trocar Posições
                </button>
              </div>
            </div>

            {/* LISTA COMPLETA DA SEQUÊNCIA ATUAL COM SELECTS EM CADA ITEM */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2 max-h-[380px]">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Sequência Atual dos Módulos:
              </div>

              {visibleModules.map((mod, idx) => {
                const Icon = mod.icon
                return (
                  <div
                    key={mod.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-blue-200 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-xs">
                        {idx + 1}
                      </span>
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${mod.iconStyle}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {mod.title}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label className="text-[11px] font-medium text-slate-500">Mudar para:</label>
                      <select
                        value={idx + 1}
                        onChange={(e) => handleSwapPositions(idx, parseInt(e.target.value, 10) - 1)}
                        className="h-8 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-blue-600 dark:text-blue-400 cursor-pointer focus:outline-none"
                      >
                        {visibleModules.map((targetMod, targetIdx) => (
                          <option key={targetMod.id} value={targetIdx + 1}>
                            {targetIdx + 1}º {targetIdx === idx ? '(Atual)' : `(Trocar c/ ${targetMod.title})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* RODAPÉ DO MODAL */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-5 py-3 bg-slate-50 dark:bg-slate-900/60">
              {isCustomOrder ? (
                <button
                  type="button"
                  onClick={handleResetOrder}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  Restaurar ordem padrão
                </button>
              ) : (
                <span className="text-xs text-slate-400">Ordem padrão do sistema</span>
              )}

              <button
                type="button"
                onClick={() => setIsReorderModalOpen(false)}
                className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
