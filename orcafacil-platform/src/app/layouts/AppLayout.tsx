import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { ListBox } from '@shared/components/ui/ListBox'
import { ProfileMenu } from '@shared/components/ProfileMenu'
import { BrandLogo } from '@shared/components/BrandLogo'
import { ThemeToggle } from '@shared/components/ThemeToggle'
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  Settings,
  LogOut,
  Building2,
  FileBarChart,
  Truck,
  Package,
  ShoppingCart,
  Wrench,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react'

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, profile, signOut } = useAuth()
  const { currentOrganization, organizations, setCurrentOrganization, createOrganization } =
    useOrganization()
  const { canAccess, canAccessDashboardModule } = useModuleAccess()
  const location = useLocation()
  const navigate = useNavigate()
  const isDashboard = location.pathname === '/'

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null)
  const isMobileMenuOpen = mobileMenuPath === location.pathname
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgSlug, setNewOrgSlug] = useState('')
  const [orgError, setOrgError] = useState('')
  const [isSubmittingOrg, setIsSubmittingOrg] = useState(false)

  useEffect(() => {
    if (!isMobileMenuOpen) return

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuPath(null)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobileMenuOpen])

  const handleCreateOrg = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!newOrgName || !newOrgSlug) {
      setOrgError('Preencha todos os campos.')
      return
    }

    setIsSubmittingOrg(true)
    setOrgError('')

    const res = await createOrganization(newOrgName, newOrgSlug)
    if (res.success) {
      setNewOrgName('')
      setNewOrgSlug('')
    } else {
      setOrgError(res.error)
    }
    setIsSubmittingOrg(false)
  }

  const handleSignOut = async () => {
    const result = await signOut()
    if (result.success) {
      void navigate('/login')
    }
    return result
  }

  // Se o usuário ainda não tiver nenhuma organização cadastrada
  if (organizations.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f19] flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#111827] p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800">
          <BrandLogo size="lg" className="mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Crie sua primeira organização</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            Para começar a usar a plataforma, informe o nome do seu negócio ou trabalho autônomo.
          </p>

          <form onSubmit={(e) => void handleCreateOrg(e)} className="space-y-4">
            {orgError && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                {orgError}
              </div>
            )}
            <Input
              label="Nome da Empresa / Profissional"
              placeholder="Ex: Alfa Reformas & Pinturas"
              value={newOrgName}
              onChange={(e) => {
                setNewOrgName(e.target.value)
                setNewOrgSlug(
                  e.target.value
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, ''),
                )
              }}
              required
            />
            <Input
              label="Identificador Único (Slug)"
              placeholder="ex: alfa-reformas"
              value={newOrgSlug}
              onChange={(e) => {
                setNewOrgSlug(e.target.value)
              }}
              helperText="Usado para identificar sua organização no sistema."
              required
            />
            <Button type="submit" className="w-full" isLoading={isSubmittingOrg}>
              Criar Organização e Começar
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 flex justify-center">
            <button
              onClick={() => void handleSignOut()}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" /> Sair da conta
            </button>
          </div>
        </div>
      </div>
    )
  }

  const hasOrcafacil = canAccess('orcafacil')
  const canAccessSales = canAccessDashboardModule('MOD-01')
  const canAccessCustomers = canAccessDashboardModule('MOD-03')
  const canAccessInventory = canAccessDashboardModule('MOD-02')
  const canAccessQuotes = canAccessDashboardModule('MOD-04')
  const canAccessSuppliers = canAccessDashboardModule('MOD-06')
  const canAccessOrganization = canAccessDashboardModule('MOD-07')
  const canAccessReports = canAccessDashboardModule('MOD-08')
  const canAccessServices = canAccessDashboardModule('MOD-09')
  const canAccessServiceOrders = canAccessDashboardModule('MOD-10')

  const navItem = (to: string, label: string, icon: ReactNode) => {
    const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
    return (
      <Link
        to={to}
        title={sidebarCollapsed ? label : undefined}
        onClick={() => {
          setMobileMenuPath(null)
        }}
        className={`flex min-h-11 items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-white text-blue-700 font-semibold shadow-xs dark:bg-blue-950/60 dark:text-blue-300'
            : 'text-slate-700 hover:bg-white/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
        } ${sidebarCollapsed ? 'justify-center' : ''}`}
      >
        <span className={`shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>{icon}</span>
        {!sidebarCollapsed && label}
      </Link>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-[#0b0f19] ${isDashboard ? '' : 'flex'}`}>
      {!isDashboard && (
        <>
          {isMobileMenuOpen && (
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => {
                setMobileMenuPath(null)
              }}
              className="fixed inset-0 z-40 bg-gray-950/40 md:hidden"
            />
          )}
        <aside
          id="mobile-navigation"
          className={`relative shrink-0 flex-col border-r border-sky-200/70 dark:border-slate-800 bg-[#e6f1fa] dark:bg-[#111827] transition-all duration-300 ${
            isMobileMenuOpen
              ? 'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] shadow-xl md:static md:z-auto md:max-w-none md:shadow-none'
              : 'hidden md:flex'
          } ${sidebarCollapsed ? 'md:w-[68px]' : 'md:w-64'}`}
        >
          {/* BOTÃO DE COLAPSAR/EXPANDIR */}
          <button
            onClick={() => {
              setSidebarCollapsed(!sidebarCollapsed)
            }}
            className="absolute -right-3 top-7 z-10 hidden h-11 w-11 items-center justify-center rounded-full border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs transition-colors hover:bg-sky-50 dark:hover:bg-slate-700 hover:shadow-sm md:flex md:h-6 md:w-6"
            title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            )}
          </button>

          {/* LOGO & ORG SELECTOR */}
          <div className="p-4 border-b border-sky-200/60 dark:border-slate-800">
            <div className={`mb-3 flex items-center justify-between ${sidebarCollapsed ? 'md:justify-center' : ''}`}>
              <BrandLogo size="sm" showName={!sidebarCollapsed} />
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => {
                  setMobileMenuPath(null)
                }}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800 md:hidden"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            {/* Seletor de Organização */}
            {!sidebarCollapsed && (
              <div className="relative">
                <ListBox
                  searchable={organizations.length > 4}
                  searchPlaceholder="Buscar empresa..."
                  value={currentOrganization?.id ?? ''}
                  onChange={(val) => {
                    const org = organizations.find((o) => o.id === val)
                    if (org) setCurrentOrganization(org)
                  }}
                  options={organizations.map((org) => ({
                    value: org.id,
                    label: org.name,
                  }))}
                />
              </div>
            )}
          </div>

          {/* NAVEGAÇÃO MODULAR */}
          <nav
            aria-label="Navegação principal"
            className={`flex-1 p-3 space-y-6 overflow-y-auto ${sidebarCollapsed ? 'px-2' : ''}`}
          >
            <div>
              {!sidebarCollapsed && (
                <span className="px-3 text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  Geral
                </span>
              )}
              <div className="mt-1 space-y-0.5">
                {navItem('/', 'Página Inicial', <LayoutDashboard className="w-4 h-4" />)}
              </div>
            </div>

            {/* Módulos de gestão */}
            {hasOrcafacil &&
              (canAccessSales ||
                canAccessCustomers ||
                canAccessInventory ||
                canAccessQuotes ||
                canAccessSuppliers ||
                canAccessServices ||
                canAccessServiceOrders) && (
                <div>
                  {!sidebarCollapsed && (
                    <span className="px-3 text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                      JB Software
                    </span>
                  )}
                  <div className="mt-1 space-y-0.5">
                    {canAccessSales &&
                      navItem(
                        '/orcafacil/sales',
                        'Vendas',
                        <ShoppingCart className="w-4 h-4" />,
                      )}
                    {canAccessServiceOrders &&
                      navItem(
                        '/service-orders',
                        'Ordens de Serviço',
                        <ClipboardList className="w-4 h-4" />,
                      )}
                    {canAccessQuotes &&
                      navItem(
                        '/orcafacil/quotes',
                        'Orçamentos',
                        <FileSpreadsheet className="w-4 h-4" />,
                      )}
                    {canAccessCustomers &&
                      navItem('/orcafacil/customers', 'Clientes', <Users className="w-4 h-4" />)}
                    {canAccessSuppliers &&
                      navItem(
                        '/orcafacil/suppliers',
                        'Fornecedores',
                        <Truck className="w-4 h-4" />,
                      )}
                    {canAccessInventory &&
                      navItem('/orcafacil/inventory', 'Estoque', <Package className="w-4 h-4" />)}
                    {canAccessReports &&
                      navItem(
                        '/orcafacil/reports',
                        'Relatórios',
                        <FileBarChart className="w-4 h-4" />,
                      )}
                    {canAccessServices &&
                      navItem(
                        '/services',
                        'Serviços',
                        <Wrench className="w-4 h-4" />,
                      )}
                  </div>
                </div>
              )}

            {canAccessOrganization && (
              <div>
                {!sidebarCollapsed && (
                  <span className="px-3 text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                    Administração
                  </span>
                )}
                <div className="mt-1 space-y-0.5">
                  {navItem(
                    '/settings/organization',
                    'Organização',
                    <Settings className="w-4 h-4" />,
                  )}
                </div>
              </div>
            )}
          </nav>

          {/* FOOTER DO USUÁRIO */}
          <div className={`p-3 border-t border-sky-200/60 dark:border-slate-800/80 bg-sky-100/30 dark:bg-slate-900/40 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            {sidebarCollapsed ? (
              <ProfileMenu
                variant="header"
                displayName={profile?.displayName || 'Usuário'}
                email={user?.email}
                avatarUrl={profile?.avatarUrl}
                onSignOut={handleSignOut}
              />
            ) : (
              <ProfileMenu
                variant="sidebar"
                displayName={profile?.displayName || 'Usuário'}
                email={user?.email}
                avatarUrl={profile?.avatarUrl}
                onSignOut={handleSignOut}
              />
            )}
          </div>
        </aside>
        </>
      )}

      {/* CONTEÚDO PRINCIPAL */}
      <main
        className={isDashboard ? 'min-h-screen bg-slate-50 dark:bg-[#0b0f19]' : 'flex-1 flex flex-col min-w-0 overflow-y-auto'}
      >
        {!isDashboard && (
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-sky-200/70 dark:border-slate-800 bg-[#e6f1fa] dark:bg-[#111827] px-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
              <button
                type="button"
                aria-label="Abrir menu"
                aria-controls="mobile-navigation"
                aria-expanded={isMobileMenuOpen}
                onClick={() => {
                  setSidebarCollapsed(false)
                  setMobileMenuPath(location.pathname)
                }}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-100 dark:hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600 md:hidden"
              >
                {isMobileMenuOpen ? (
                  <X aria-hidden="true" className="h-5 w-5" />
                ) : (
                  <Menu aria-hidden="true" className="h-5 w-5" />
                )}
              </button>
              <Building2 className="hidden h-4 w-4 shrink-0 text-gray-400 dark:text-slate-500 md:block" />
              <span className="truncate font-semibold text-gray-900 dark:text-white">
                {currentOrganization?.name}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <ThemeToggle />
              <ProfileMenu
                variant="header"
                displayName={profile?.displayName || 'Usuário'}
                email={user?.email}
                avatarUrl={profile?.avatarUrl}
                onSignOut={handleSignOut}
              />
            </div>
          </header>
        )}

        <div
          className={
            isDashboard ? 'w-full' : 'mx-auto flex-1 min-w-0 w-full max-w-[1920px] px-3 sm:px-6 lg:px-8 py-3 sm:py-4'
          }
        >
          {children}
        </div>
      </main>
    </div>
  )
}
