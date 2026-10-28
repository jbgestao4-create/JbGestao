import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Database,
  FileSpreadsheet,
  Home,
  LockKeyhole,
  LogOut,
  Package,
  Settings2,
  ShoppingCart,
  Sparkles,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { quoteService } from '@modules/orcafacil/services/quote.service'
import { customerService } from '@modules/customers/services/customer.service'
import { ProfileMenu } from '@shared/components/ProfileMenu'

type DashboardModule = {
  id: string
  title: string
  description: string
  action: string
  icon: LucideIcon
  iconStyle: string
  isAvailable: boolean
  path?: string
}

export function DashboardPage() {
  const { user, profile, signOut } = useAuth()
  const { currentOrganization, organizations, setCurrentOrganization } = useOrganization()
  const { canAccess } = useModuleAccess()
  const navigate = useNavigate()

  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'offline'>(
    'checking',
  )
  const [isModulesExpanded, setIsModulesExpanded] = useState(true)

  useEffect(() => {
    if (!currentOrganization) return

    let isCurrent = true

    const checkConnection = async () => {
      const [quotesResult, customersResult] = await Promise.all([
        quoteService.listQuotes(currentOrganization.id),
        customerService.list(currentOrganization.id),
      ])

      if (isCurrent) {
        setConnectionStatus(
          quotesResult.success && customersResult.success ? 'connected' : 'offline',
        )
      }
    }

    void checkConnection()

    return () => {
      isCurrent = false
    }
  }, [currentOrganization])

  const accountName = profile?.displayName || user?.email?.split('@')[0] || 'Bb'
  const firstName = accountName.trim().split(/\s+/)[0] || 'Bb'
  const hasOrcafacil = canAccess('orcafacil')
  const modules: DashboardModule[] = [
    {
      id: 'MOD-01',
      title: 'Vendas',
      description:
        'Emissão de pedidos de venda, frente de caixa PDV, faturamento rápido e emissão de notas fiscais (NF-e / NFC-e).',
      action: 'Acessar Vendas',
      icon: ShoppingCart,
      iconStyle: 'bg-blue-50 text-blue-700',
      isAvailable: hasOrcafacil,
      path: '/orcafacil/quotes',
    },
    {
      id: 'MOD-02',
      title: 'Estoque',
      description:
        'Controle físico e financeiro do almoxarifado, cadastro de produtos, conferência de saldo e inventário geral.',
      action: 'Acessar Estoque',
      icon: Package,
      iconStyle: 'bg-amber-50 text-amber-700',
      isAvailable: canAccess('estoqueleve'),
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
      path: '/orcafacil/quotes',
    },
    {
      id: 'MOD-05',
      title: 'Gerenciamento do Caixa',
      description:
        'Abertura e fechamento de caixa, conferência de sangrias, suprimentos e controle de saldos em espécie, cartões e PIX.',
      action: 'Acessar Caixa',
      icon: WalletCards,
      iconStyle: 'bg-cyan-50 text-cyan-700',
      isAvailable: false,
    },
    {
      id: 'MOD-06',
      title: 'Configurações',
      description:
        'Parâmetros tributários, dados cadastrais da empresa, gestão de usuários, senhas e permissões de acesso.',
      action: 'Acessar Configurações',
      icon: Settings2,
      iconStyle: 'bg-slate-100 text-slate-700',
      isAvailable: true,
      path: '/settings/organization',
    },
  ]

  const handleSignOut = async () => {
    const result = await signOut()
    if (result.success) navigate('/login')
  }

  const connectionLabel = {
    checking: 'Verificando conexão',
    connected: 'Online • Sincronizado',
    offline: 'Sem conexão com o banco',
  }[connectionStatus]

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-7 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <ChartNoAxesCombined aria-hidden="true" className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-bold text-slate-900">JB Gestão Comercial</h1>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-slate-500">Módulo de Gestão Empresarial</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <label className="relative flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
              <Building2 aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="sr-only">Filial selecionada</span>
              <select
                aria-label="Selecionar filial"
                value={currentOrganization?.id ?? ''}
                onChange={(event) => {
                  const organization = organizations.find((item) => item.id === event.target.value)
                  if (organization) setCurrentOrganization(organization)
                }}
                className="max-w-[220px] appearance-none truncate bg-transparent pr-4 outline-none"
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-400"
              />
            </label>

            <div
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600"
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
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Home aria-hidden="true" className="h-4 w-4" />
              Página Inicial
            </Link>

            <ProfileMenu
              variant="dashboard"
              displayName={accountName}
              email={user?.email ?? undefined}
            />

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] space-y-8 px-4 py-6 sm:px-7 sm:py-8">
        <section className="relative overflow-hidden rounded-xl bg-[#0F172A] px-6 py-7 text-white sm:px-9 sm:py-9 lg:px-11">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] border-l border-white/10 bg-white/[0.02] lg:block" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-md border border-blue-300/20 bg-blue-300/10 px-3 py-1.5 text-xs font-medium text-blue-100">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-blue-300" />
                Painel Principal do Sistema
              </span>
              <h2 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
                Bem-vindo ao Sistema JB, <span className="text-blue-300">{firstName}</span>!
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Selecione uma das opções abaixo para gerenciar as rotinas comerciais, operacionais e
                cadastrais da sua empresa.
              </p>
            </div>

            <div className="grid gap-3 rounded-lg border border-white/10 bg-slate-950/40 p-5 sm:grid-cols-2 lg:grid-cols-1">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-200">
                  <LockKeyhole aria-hidden="true" className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Segurança</p>
                  <p className="mt-1 text-sm font-medium text-white">Conexão HTTPS protegida</p>
                </div>
              </div>
              <div className="flex items-start gap-3 border-white/10 sm:border-l sm:pl-3 lg:border-l-0 lg:border-t lg:pt-3 lg:pl-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-300">
                  <Database aria-hidden="true" className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-400">
                    Banco de Dados
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">{connectionLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="modules-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="modules-heading" className="text-xl font-bold text-slate-900">
                Módulos do Sistema
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Clique em uma das opções para abrir a área operacional correspondente.
              </p>
            </div>
            <button
              type="button"
              aria-expanded={isModulesExpanded}
              aria-controls="dashboard-modules"
              onClick={() => setIsModulesExpanded((expanded) => !expanded)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              {isModulesExpanded ? 'Minimize Módulos' : 'Mostrar Módulos'}
              {isModulesExpanded ? (
                <ChevronUp aria-hidden="true" className="h-4 w-4" />
              ) : (
                <ChevronDown aria-hidden="true" className="h-4 w-4" />
              )}
            </button>
          </div>

          <div
            id="dashboard-modules"
            className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 ${
              isModulesExpanded ? '' : 'hidden'
            }`}
          >
            {modules.map((module, index) => {
              const Icon = module.icon
              const isFeatured = index === 0 && module.isAvailable

              return (
                <article
                  key={module.id}
                  className={`flex min-h-[260px] flex-col rounded-xl border bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-sm ${
                    isFeatured ? 'border-blue-700 ring-1 ring-blue-700/10' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-lg ${module.iconStyle}`}
                    >
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[10px] font-semibold tracking-wider text-slate-400">
                        {module.id}
                      </span>
                      {module.isAvailable ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Disponível
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
                          Em breve
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5">
                    <h3 className="text-base font-bold text-slate-900">{module.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{module.description}</p>
                  </div>

                  <div className="mt-auto pt-5">
                    {module.isAvailable && module.path ? (
                      <Link
                        to={module.path}
                        className={`flex min-h-10 items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                          isFeatured
                            ? 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {module.action}
                        <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="flex min-h-10 w-full cursor-not-allowed items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-400"
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

        <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-slate-200 pt-5 text-xs text-slate-400">
          <CircleDollarSign aria-hidden="true" className="h-3.5 w-3.5" />
          JB Gestão Comercial
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
