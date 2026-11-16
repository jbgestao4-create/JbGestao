import { UpcomingBillsAlertModal } from '@modules/cash/components/UpcomingBillsAlertModal'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@app/config/supabase'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { isSystemOwner } from '@shared/utils/system-owner'
import { useSystemVersion } from '@shared/hooks/useSystemVersion'
import { ProfileMenu } from '@shared/components/ProfileMenu'
import { GeneralCashStatusBadge } from '@shared/components/GeneralCashStatusBadge'
import { BrandLogo } from '@shared/components/BrandLogo'
import { FeedbackWidget } from '@modules/suggestions/components/FeedbackWidget'
import { SystemNotificationModal } from '@shared/components/SystemNotificationModal'
import { OrganizationBillingBanner } from '@modules/organizations/components/OrganizationBillingBanner'
import { OrganizationSuspensionGuard } from '@modules/organizations/components/OrganizationSuspensionGuard'
import { systemMaintenanceService } from '@shared/services/system-maintenance.service'
import { suggestionService } from '@modules/suggestions/services/suggestion.service'
import { formatUnreadSuggestionCount } from '@modules/suggestions/utils/suggestion.utils'
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  Settings,
  Building2,
  Calendar,
  FileBarChart,
  Truck,
  Package,
  ShoppingCart,
  DollarSign,
  Wrench,
  ClipboardList,
  Database,
  Menu,
  X,
  ShieldCheck,
  Home,
  AlertTriangle,
} from 'lucide-react'

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, profile, signOut } = useAuth()
  const { currentOrganization, organizations } = useOrganization()
  const { canAccess, canAccessDashboardModule } = useModuleAccess()
  const location = useLocation()
  const navigate = useNavigate()
  const isDashboard = location.pathname === '/'

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null)
  const isMobileMenuOpen = mobileMenuPath === location.pathname
  const [isBrandDraggingToSidebar, setIsBrandDraggingToSidebar] = useState(false)

  const headerBrandRef = useRef<HTMLDivElement | null>(null)
  const sidebarBrandRef = useRef<HTMLDivElement | null>(null)
  const orgBadgeRef = useRef<HTMLButtonElement | null>(null)
  const cashBadgeRef = useRef<HTMLDivElement | null>(null)
  const homeButtonRef = useRef<HTMLAnchorElement | null>(null)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const prevIsDashboardRef = useRef<boolean>(isDashboard)
  const prevRectsRef = useRef<{
    brand?: DOMRect
    org?: DOMRect
    cash?: DOMRect
    home?: DOMRect
    user?: DOMRect
  }>({})

  useEffect(() => {
    setSidebarCollapsed(true)
  }, [location.pathname])

  useEffect(() => {
    const captureRects = () => {
      const brandEl = headerBrandRef.current ?? sidebarBrandRef.current
      prevRectsRef.current = {
        brand: brandEl?.getBoundingClientRect(),
        org: orgBadgeRef.current?.getBoundingClientRect(),
        cash: cashBadgeRef.current?.getBoundingClientRect(),
        home: homeButtonRef.current?.getBoundingClientRect(),
        user: profileMenuRef.current?.getBoundingClientRect(),
      }
    }

    window.addEventListener('pointerdown', captureRects, true)
    window.addEventListener('keydown', captureRects, true)
    return () => {
      window.removeEventListener('pointerdown', captureRects, true)
      window.removeEventListener('keydown', captureRects, true)
    }
  }, [])

  useLayoutEffect(() => {
    const wasDashboard = prevIsDashboardRef.current
    prevIsDashboardRef.current = isDashboard

    const prev = prevRectsRef.current
    let brandTimer: number | undefined

    if (wasDashboard !== isDashboard) {
      const duration = 560
      const easing = 'cubic-bezier(0.22, 1, 0.36, 1)'

      const nextBrandEl = isDashboard ? headerBrandRef.current : sidebarBrandRef.current
      if (nextBrandEl && prev.brand) {
        const nextRect = nextBrandEl.getBoundingClientRect()
        let dx = prev.brand.left - nextRect.left
        const dy = prev.brand.top - nextRect.top

        if (!isDashboard) {
          dx = Math.max(dx, 92)
          setIsBrandDraggingToSidebar(true)
          brandTimer = window.setTimeout(() => {
            setIsBrandDraggingToSidebar(false)
          }, 340)
        } else {
          dx = Math.min(dx, -92)
          setIsBrandDraggingToSidebar(false)
        }

        if (typeof nextBrandEl.animate === 'function') {
          nextBrandEl.animate(
            [
              {
                transform: `translate3d(${dx}px, ${dy}px, 0) scale(${!isDashboard ? 1.08 : 0.92})`,
              },
              { transform: 'translate3d(0, 0, 0) scale(1)' },
            ],
            { duration, easing },
          )
        }
      }

      if (orgBadgeRef.current && prev.org) {
        const nextRect = orgBadgeRef.current.getBoundingClientRect()
        let dx = prev.org.left - nextRect.left
        const dy = prev.org.top - nextRect.top
        if (!isDashboard && Math.abs(dx) < 80) {
          dx = 260
        } else if (isDashboard && Math.abs(dx) < 80) {
          dx = -260
        }
        if (typeof orgBadgeRef.current.animate === 'function') {
          orgBadgeRef.current.animate(
            [
              { transform: `translate3d(${dx}px, ${dy}px, 0)` },
              { transform: 'translate3d(0, 0, 0)' },
            ],
            { duration, easing },
          )
        }
      }

      const rightItems: Array<{ el: HTMLElement | null; rect?: DOMRect }> = [
        { el: cashBadgeRef.current, rect: prev.cash },
        { el: homeButtonRef.current, rect: prev.home },
        { el: profileMenuRef.current, rect: prev.user },
      ]

      rightItems.forEach(({ el, rect }, idx) => {
        if (!el || !rect || typeof el.animate !== 'function') return
        const nextRect = el.getBoundingClientRect()
        let dx = rect.left - nextRect.left
        const dy = rect.top - nextRect.top

        if (!isDashboard && Math.abs(dx) < 72) {
          dx = -88 - idx * 18
        } else if (isDashboard && Math.abs(dx) < 72) {
          dx = 88 + idx * 18
        }

        el.animate(
          [
            { transform: `translate3d(${dx}px, ${dy}px, 0)` },
            { transform: 'translate3d(0, 0, 0)' },
          ],
          { duration, easing },
        )
      })
    }

    const updateTimer = window.setTimeout(() => {
      const brandEl = headerBrandRef.current ?? sidebarBrandRef.current
      prevRectsRef.current = {
        brand: brandEl?.getBoundingClientRect(),
        org: orgBadgeRef.current?.getBoundingClientRect(),
        cash: cashBadgeRef.current?.getBoundingClientRect(),
        home: homeButtonRef.current?.getBoundingClientRect(),
        user: profileMenuRef.current?.getBoundingClientRect(),
      }
    }, 600)

    return () => {
      if (brandTimer) window.clearTimeout(brandTimer)
      window.clearTimeout(updateTimer)
    }
  }, [isDashboard])

  const isDeveloper = isSystemOwner(user)
  const { version: systemVersion } = useSystemVersion()
  const [unreadSuggestionsCount, setUnreadSuggestionsCount] = useState(0)
  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false)

  // Monitora status de manutenção para exibir banner ao desenvolvedor
  useEffect(() => {
    let isMounted = true
    const checkMaintenance = async () => {
      const res = await systemMaintenanceService.getStatus()
      if (isMounted && res.success && res.data) {
        setIsMaintenanceActive(res.data.enabled)
      }
    }
    void checkMaintenance()

    const channelName = `applayout-maint-${Math.random().toString(36).substring(2, 9)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: 'key=eq.maintenance_mode',
        },
        () => {
          void checkMaintenance()
        },
      )
      .subscribe()

    return () => {
      isMounted = false
      void supabase.removeChannel(channel)
    }
  }, [])

  // Apenas o desenvolvedor recebe a notificação de sugestões pendentes no menu lateral
  useEffect(() => {
    if (!isDeveloper || !currentOrganization?.id) {
      setUnreadSuggestionsCount(0)
      return
    }

    const orgId = currentOrganization.id

    const refreshUnread = async () => {
      const res = await suggestionService.getUnreadCount(orgId)
      if (res.success) {
        setUnreadSuggestionsCount(res.data)
      }
    }

    void refreshUnread()

    const handleFocus = () => {
      void refreshUnread()
    }
    const handleReadCountChange = (event: Event) => {
      const detail = (event as CustomEvent<{ organizationId: string; count: number }>).detail
      if (detail.organizationId === orgId) {
        setUnreadSuggestionsCount(detail.count)
      }
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('feedback-unread-count-changed', handleReadCountChange)

    const feedbackChannelName = `sidebar-feedback-${orgId}-${Math.random().toString(36).substring(2, 9)}`
    const channel = supabase
      .channel(feedbackChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feedback_suggestions',
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          void refreshUnread()
        },
      )
      .subscribe()

    const interval = window.setInterval(() => {
      void refreshUnread()
    }, 30000)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('feedback-unread-count-changed', handleReadCountChange)
      window.clearInterval(interval)
      void supabase.removeChannel(channel)
    }
  }, [isDeveloper, currentOrganization?.id])


  const handleSignOut = async () => {
    const result = await signOut()
    if (result.success) {
      void navigate('/login')
    }
    return result
  }

  const hasOrcafacil = canAccess('orcafacil')
  const canAccessSales = canAccessDashboardModule('MOD-01')
  const canAccessCustomers = canAccessDashboardModule('MOD-03')
  const canAccessInventory = canAccessDashboardModule('MOD-02')
  const canAccessQuotes = canAccessDashboardModule('MOD-04')
  const canAccessCash = canAccessDashboardModule('MOD-05')
  const canAccessSuppliers = canAccessDashboardModule('MOD-06')
  const canAccessOrganization = canAccessDashboardModule('MOD-07')
  const canAccessReports = canAccessDashboardModule('MOD-08')
  const canAccessServices = canAccessDashboardModule('MOD-09')
  const canAccessServiceOrders = canAccessDashboardModule('MOD-10')
  const canAccessMigration = canAccessDashboardModule('MOD-11')
  const canAccessAgenda = canAccessDashboardModule('MOD-12')

  const navItem = (to: string, label: string, icon: ReactNode, badge?: ReactNode) => {
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
            ? 'bg-white text-[var(--theme-primary,#1d4ed8)] font-semibold shadow-xs dark:bg-[var(--theme-primary-dark-bg,rgba(30,58,138,0.4))] dark:text-[var(--theme-primary-dark-text,#93c5fd)]'
            : 'text-slate-700 hover:bg-white/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
        } ${sidebarCollapsed ? 'justify-center' : ''}`}
      >
        <span
          className={`relative shrink-0 ${
            isActive
              ? 'text-[var(--theme-primary,#2563eb)] dark:text-[var(--theme-primary-dark-text,#60a5fa)]'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {icon}
          {sidebarCollapsed && badge && (
            <span className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-xs">
              {badge}
            </span>
          )}
        </span>
        {!sidebarCollapsed && (
          <span className="flex flex-1 items-center justify-between gap-2 min-w-0">
            <span className="truncate">{label}</span>
            {badge && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white shadow-xs">
                {badge}
              </span>
            )}
          </span>
        )}
      </Link>
    )
  }

  const accountName = profile?.displayName || user?.email?.split('@')[0] || 'Usuário'

  const orgBadgeElement = (
    <button
      ref={orgBadgeRef}
      type="button"
      disabled
      aria-label={`Organização atual: ${currentOrganization?.name ?? 'Organização'}`}
      className={`inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-lg border border-sky-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-800/60 px-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 opacity-90 shadow-2xs ${
        isDashboard ? 'w-full sm:w-56' : 'w-44 sm:w-56'
      }`}
    >
      <Building2 aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
      <span className="truncate">{currentOrganization?.name ?? 'Organização'}</span>
    </button>
  )

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
          onMouseEnter={() => {
            setSidebarCollapsed(false)
          }}
          onMouseLeave={() => {
            if (!isMobileMenuOpen) {
              setSidebarCollapsed(true)
            }
          }}
          className={`relative shrink-0 flex-col ${
            isBrandDraggingToSidebar ? 'overflow-visible z-30' : 'overflow-hidden'
          } border-r border-sky-200/70 dark:border-slate-800 bg-[var(--theme-primary-subtle,#e6f1fa)] dark:bg-[#111827] transition-all duration-300 print:hidden ${
            isMobileMenuOpen
              ? 'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] shadow-xl md:static md:z-auto md:max-w-none md:shadow-none'
              : 'hidden md:flex'
          } ${sidebarCollapsed ? 'md:w-[68px]' : 'md:w-64'}`}
        >
          {/* LOGO */}
          <div className={`py-4 border-b border-sky-200/60 dark:border-slate-800 ${sidebarCollapsed ? 'px-2' : 'px-4'}`}>
            <div className={`flex min-w-0 items-center ${sidebarCollapsed ? 'md:justify-center' : 'justify-between'}`}>
              <div ref={sidebarBrandRef} className="inline-flex min-w-0 max-w-full items-center">
                <BrandLogo size="sm" showName={!sidebarCollapsed || isBrandDraggingToSidebar} />
              </div>
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
          </div>

          {/* NAVEGAÇÃO MODULAR */}
          <nav
            aria-label="Navegação principal"
            className={`flex-1 p-3 space-y-6 overflow-y-auto overflow-x-hidden ${sidebarCollapsed ? 'px-2' : ''}`}
          >
            <div>
              {!sidebarCollapsed && organizations.length > 0 && (
                <span className="block truncate px-3 text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
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
                canAccessCash ||
                canAccessSuppliers ||
                canAccessServices ||
                canAccessServiceOrders) && (
                <div>
                  {!sidebarCollapsed && organizations.length > 0 && (
                    <span className="block truncate px-3 text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                      ControleSoft
                    </span>
                  )}
                  <div className="mt-1 space-y-0.5">
                    {canAccessCash &&
                      navItem(
                        '/cash',
                        'Gerenciamento de Caixa',
                        <DollarSign className="w-4 h-4" />,
                      )}
                    {canAccessSales &&
                      navItem(
                        '/orcafacil/sales',
                        'Vendas',
                        <ShoppingCart className="w-4 h-4" />,
                      )}
                    {canAccessAgenda &&
                      navItem(
                        '/agenda',
                        'Agenda',
                        <Calendar className="w-4 h-4" />,
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
                    {canAccessMigration &&
                      navItem(
                        '/migration',
                        'Migração',
                        <Database className="w-4 h-4" />,
                      )}
                  </div>
                </div>
              )}

            {canAccessOrganization && (
              <div>
                {!sidebarCollapsed && organizations.length > 0 && (
                  <span className="block truncate px-3 text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
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

            {isSystemOwner(user) && (
              <div>
                {!sidebarCollapsed && organizations.length > 0 && (
                  <span className="block truncate px-3 text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                    Desenvolvedor
                  </span>
                )}
                <div className="mt-1 space-y-0.5">
                  {navItem(
                    '/admin/developer-settings',
                    'Configurações de Desenvolvedor',
                    <ShieldCheck className="w-4 h-4" />,
                    unreadSuggestionsCount > 0
                      ? formatUnreadSuggestionCount(unreadSuggestionsCount)
                      : undefined,
                  )}
                </div>
              </div>
            )}
          </nav>
        </aside>
        </>
      )}

      {/* CONTEÚDO PRINCIPAL */}
      <main
        className={
          isDashboard
            ? 'min-h-screen bg-slate-50 dark:bg-[#0b0f19] print:bg-white print:p-0 print:m-0 print:min-h-0'
            : 'flex-1 flex flex-col min-w-0 overflow-y-auto print:bg-white print:p-0 print:m-0 print:overflow-visible'
        }
      >
        {/* BANNER DE MANUTENÇÃO ATIVA PARA O DESENVOLVEDOR */}
        {isDeveloper && isMaintenanceActive && (
          <div className="bg-rose-600 text-white px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-md z-40 shrink-0 print:hidden">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
              <span>MODO DE MANUTENÇÃO ATIVO: O acesso está bloqueado para clientes e colaboradores comuns.</span>
            </div>
            <button
              type="button"
              onClick={() => void navigate('/admin/system-notifications')}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition text-xs shrink-0 cursor-pointer"
            >
              Gerenciar / Desativar
            </button>
          </div>
        )}

        {/* BANNER DE COBRANÇA E VENCIMENTO DE ASSINATURA (APENAS ADMINISTRADOR) */}
        <OrganizationBillingBanner />

        <header className="shrink-0 border-b border-sky-200/70 dark:border-slate-800 bg-[var(--theme-primary-subtle,#e6f1fa)] dark:bg-[#111827] print:hidden">
          <div
            className={
              isDashboard
                ? 'container-fluid mx-auto flex max-w-[1600px] flex-col gap-3 px-3 py-3 sm:px-7 sm:py-4 xl:flex-row xl:items-center xl:justify-between'
                : 'flex min-h-16 flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-6 lg:px-8'
            }
          >
            {isDashboard ? (
              <div ref={headerBrandRef} className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5 shadow-xs ring-1 ring-slate-200/70">
                  <img
                    src="/controlesoft-mark.png"
                    alt="ControleSoft"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-base font-bold text-slate-900 dark:text-white">
                      ControleSoft
                    </h1>
                    <span
                      title={`Versão atual do sistema: ${systemVersion}`}
                      className="rounded-md border border-sky-200 dark:border-slate-800 bg-white/70 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-400 shadow-2xs"
                    >
                      {systemVersion}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Módulo de Gestão Empresarial
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  aria-label="Abrir menu"
                  aria-controls="mobile-navigation"
                  aria-expanded={isMobileMenuOpen}
                  onClick={() => {
                    setSidebarCollapsed(false)
                    setMobileMenuPath(location.pathname)
                  }}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-100 dark:hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600 md:hidden"
                >
                  {isMobileMenuOpen ? (
                    <X aria-hidden="true" className="h-5 w-5" />
                  ) : (
                    <Menu aria-hidden="true" className="h-5 w-5" />
                  )}
                </button>
                {orgBadgeElement}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
              {isDashboard && orgBadgeElement}

              <div ref={cashBadgeRef} className="inline-flex">
                <GeneralCashStatusBadge />
              </div>

              <Link
                ref={homeButtonRef}
                to="/"
                aria-label="Página Inicial"
                title="Página Inicial"
                className="inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-lg border border-sky-200/80 dark:border-slate-800 bg-white/80 dark:bg-[#111827] text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-white dark:hover:bg-slate-800 shadow-2xs"
              >
                <Home aria-hidden="true" className="h-4 w-4" />
              </Link>

              <div ref={profileMenuRef} className="inline-flex">
                <ProfileMenu
                  variant="dashboard"
                  displayName={accountName}
                  email={user?.email ?? undefined}
                  avatarUrl={profile?.avatarUrl}
                  onSignOut={handleSignOut}
                />
              </div>
            </div>
          </div>
        </header>

        <div
          className={
            isDashboard
              ? 'w-full print:p-0 print:m-0 print:w-full print:max-w-none'
              : 'container-fluid mx-auto flex-1 min-w-0 w-full max-w-[1920px] px-3 sm:px-6 lg:px-8 py-3 sm:py-4 print:p-0 print:m-0 print:w-full print:max-w-none'
          }
        >
          {children}
          <div className="print:hidden">
            <UpcomingBillsAlertModal />
            <FeedbackWidget />
            <SystemNotificationModal />
            <OrganizationSuspensionGuard />
          </div>
        </div>
      </main>
    </div>
  )
}
