import { UpcomingBillsAlertModal } from '@modules/cash/components/UpcomingBillsAlertModal'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { TermsOfUseModal } from '@modules/dashboard/components/TermsOfUseModal'
import { suggestionService } from '@modules/suggestions/services/suggestion.service'
import { formatUnreadSuggestionCount } from '@modules/suggestions/utils/suggestion.utils'
import { siteAccessTrackerService } from '@shared/services/site-access-tracker.service'
import { userSessionService } from '@shared/services/user-session.service'
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
  const { currentOrganization } = useOrganization()
  const { canAccess, canAccessDashboardModule } = useModuleAccess()
  const location = useLocation()
  const navigate = useNavigate()
  const isDashboard = location.pathname === '/'

  useEffect(() => {
    // Registra a navegação e acessos do usuário
    void siteAccessTrackerService.trackCurrentVisit(location.pathname)
  }, [location.pathname])

  // Heartbeat de sessão ativa para manter presença online e controle de login simultâneo
  useEffect(() => {
    if (!user?.email) return

    const sendHeartbeat = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void userSessionService.heartbeat(user.email!, currentOrganization?.id)
    }

    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, userSessionService.getHeartbeatInterval())
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [user?.email, currentOrganization?.id])

  // Monitoramento estrito e expulsão em tempo real de sessão concorrente (exceto adm@adm.com)
  useEffect(() => {
    if (!user?.email || user.email.toLowerCase() === 'adm@adm.com') return

    const currentToken = userSessionService.getToken()

    // 1. Verificação de contingência (a expulsão instantânea ocorre via Supabase Realtime)
    const checkActiveSession = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      try {
        const { data, error } = await supabase
          .from('user_active_sessions')
          .select('session_token')
          .eq('email', user.email!.toLowerCase())
          .maybeSingle()

        if (!error && data && data.session_token && data.session_token !== currentToken) {
          await signOut()
          alert('Sua conta foi conectada em outro computador ou navegador. Esta sessão foi encerrada.')
          navigate('/login', { replace: true })
        }
      } catch {
        // Ignora erro de rede momentâneo
      }
    }

    const initialTimer = setTimeout(() => void checkActiveSession(), 1500)
    // Contingência leve a cada 60s (Realtime cuida da expulsão imediata)
    const interval = setInterval(() => void checkActiveSession(), 60000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkActiveSession()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // 2. Canal Supabase Realtime para expulsão instantânea no momento em que outro login ocorre
    const channel = supabase
      .channel(`realtime_session_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_active_sessions',
          filter: `email=eq.${user.email.toLowerCase()}`,
        },
        (payload: any) => {
          const newToken = payload.new?.session_token
          if (newToken && newToken !== currentToken) {
            void (async () => {
              await signOut()
              alert('Sua conta foi conectada em outro computador ou navegador. Esta sessão foi encerrada.')
              navigate('/login', { replace: true })
            })()
          }
        },
      )
      .subscribe()

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      void supabase.removeChannel(channel)
    }
  }, [user?.email, user?.id, navigate, signOut])

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
  const contentContainerRef = useRef<HTMLDivElement | null>(null)
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

  useLayoutEffect(() => {
    if (contentContainerRef.current) {
      contentContainerRef.current.scrollTop = 0
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [location.pathname, location.search])

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
    try {
      const raw = localStorage.getItem('jb_system_maintenance_status')
      if (raw) {
        const parsed = JSON.parse(raw) as { enabled?: boolean }
        setIsMaintenanceActive(Boolean(parsed.enabled))
      }
    } catch {
      // ignore
    }

    const handleMaintenanceChange = (e: Event) => {
      const detail = (e as CustomEvent<{ enabled?: boolean }>).detail
      if (detail && typeof detail.enabled === 'boolean') {
        setIsMaintenanceActive(detail.enabled)
      }
    }

    window.addEventListener('maintenance-status-changed', handleMaintenanceChange)
    return () => {
      window.removeEventListener('maintenance-status-changed', handleMaintenanceChange)
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

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('feedback-unread-count-changed', handleReadCountChange)
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

  interface ModularNavItemDef {
    id: string
    to: string
    label: string
    icon: ReactNode
    badge?: ReactNode
    visible: boolean
  }

  const homeNavItem: ModularNavItemDef = {
    id: 'dashboard',
    to: '/dashboard',
    label: 'Página Inicial',
    icon: <LayoutDashboard className="w-4 h-4" />,
    visible: true,
  }

  const rawModuleNavItems: ModularNavItemDef[] = [
    {
      id: 'cash',
      to: '/cash',
      label: 'Gerenciamento de Caixa',
      icon: <DollarSign className="w-4 h-4" />,
      visible: hasOrcafacil && canAccessCash,
    },
    {
      id: 'sales',
      to: '/orcafacil/sales',
      label: 'Vendas',
      icon: <ShoppingCart className="w-4 h-4" />,
      visible: hasOrcafacil && canAccessSales,
    },
    {
      id: 'agenda',
      to: '/agenda',
      label: 'Agenda',
      icon: <Calendar className="w-4 h-4" />,
      visible: hasOrcafacil && canAccessAgenda,
    },
    {
      id: 'service-orders',
      to: '/service-orders',
      label: 'Ordens de Serviço',
      icon: <ClipboardList className="w-4 h-4" />,
      visible: hasOrcafacil && canAccessServiceOrders,
    },
    {
      id: 'quotes',
      to: '/orcafacil/quotes',
      label: 'Orçamentos',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      visible: hasOrcafacil && canAccessQuotes,
    },
    {
      id: 'customers',
      to: '/orcafacil/customers',
      label: 'Clientes',
      icon: <Users className="w-4 h-4" />,
      visible: hasOrcafacil && canAccessCustomers,
    },
    {
      id: 'suppliers',
      to: '/orcafacil/suppliers',
      label: 'Fornecedores',
      icon: <Truck className="w-4 h-4" />,
      visible: hasOrcafacil && canAccessSuppliers,
    },
    {
      id: 'inventory',
      to: '/orcafacil/inventory',
      label: 'Estoque',
      icon: <Package className="w-4 h-4" />,
      visible: hasOrcafacil && canAccessInventory,
    },
    {
      id: 'reports',
      to: '/orcafacil/reports',
      label: 'Relatórios',
      icon: <FileBarChart className="w-4 h-4" />,
      visible: hasOrcafacil && canAccessReports,
    },
    {
      id: 'services',
      to: '/services',
      label: 'Serviços',
      icon: <Wrench className="w-4 h-4" />,
      visible: hasOrcafacil && canAccessServices,
    },
    {
      id: 'migration',
      to: '/migration',
      label: 'Migração',
      icon: <Database className="w-4 h-4" />,
      visible: hasOrcafacil && canAccessMigration,
    },
    {
      id: 'organization',
      to: '/settings/organization',
      label: 'Organização',
      icon: <Settings className="w-4 h-4" />,
      visible: canAccessOrganization,
    },
    {
      id: 'developer',
      to: '/admin/developer-settings',
      label: 'Configurações do Desenvolvedor',
      icon: <ShieldCheck className="w-4 h-4" />,
      badge:
        unreadSuggestionsCount > 0
          ? formatUnreadSuggestionCount(unreadSuggestionsCount)
          : undefined,
      visible: isSystemOwner(user),
    },
  ]

  // Módulos regulares ordenados alfabeticamente, com Organização e Configurações do Desenvolvedor fixos no final da lista
  const sortedVisibleModuleItems = useMemo(() => {
    const regularItems = rawModuleNavItems
      .filter((item) => item.visible && item.id !== 'organization' && item.id !== 'developer')
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }))

    const pinnedItems = rawModuleNavItems.filter(
      (item) => item.visible && (item.id === 'organization' || item.id === 'developer'),
    )

    // Fixa Organização e depois Configurações do Desenvolvedor no final
    pinnedItems.sort((a, b) => {
      if (a.id === 'organization') return -1
      if (b.id === 'organization') return 1
      return 0
    })

    return [...regularItems, ...pinnedItems]
  }, [
    rawModuleNavItems,
  ])

  const renderNavItem = (item: ModularNavItemDef) => {
    const isActive =
      location.pathname === item.to ||
      (item.to !== '/' && item.to !== '/dashboard' && location.pathname.startsWith(item.to)) ||
      (item.to === '/dashboard' && (location.pathname === '/' || location.pathname === '/dashboard'))

    return (
      <Link
        key={item.id}
        to={item.to}
        onClick={() => {
          setMobileMenuPath(null)
        }}
        title={sidebarCollapsed ? item.label : undefined}
        className={`group relative flex h-10 w-full items-center rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-white text-[var(--theme-primary,#1d4ed8)] font-semibold shadow-xs dark:bg-[var(--theme-primary-dark-bg,rgba(30,58,138,0.4))] dark:text-[var(--theme-primary-dark-text,#93c5fd)]'
            : 'text-slate-700 hover:bg-white/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
        }`}
      >
        {/* Container do ícone estático e ancorado - sem salto nem descolamento */}
        <div
          className={`w-9 h-9 flex items-center justify-center shrink-0 ml-1.5 relative transition-colors ${
            isActive
              ? 'text-[var(--theme-primary,#2563eb)] dark:text-[var(--theme-primary-dark-text,#60a5fa)]'
              : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
          }`}
        >
          {item.icon}
          {sidebarCollapsed && item.badge && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-xs">
              {item.badge}
            </span>
          )}
        </div>

        {/* Rótulo de texto com transição suave e síncrona sem desalinhar o ícone */}
        <div
          className={`flex flex-1 items-center justify-between min-w-0 pr-3 transition-all duration-200 ease-in-out overflow-hidden ${
            sidebarCollapsed
              ? 'opacity-0 max-w-0 pointer-events-none -translate-x-2'
              : 'opacity-100 max-w-[190px] translate-x-0'
          }`}
        >
          <span className="truncate whitespace-nowrap ml-2.5 text-sm">{item.label}</span>
          {item.badge && (
            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white shadow-xs">
              {item.badge}
            </span>
          )}
        </div>
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
    <div
      className={`min-h-screen bg-gray-50 dark:bg-[#0b0f19] print:h-auto print:overflow-visible ${
        isDashboard ? '' : 'flex md:h-screen md:overflow-hidden'
      }`}
    >
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
          className={`relative shrink-0 flex-col md:sticky md:top-0 md:h-screen ${
            isBrandDraggingToSidebar ? 'overflow-visible z-30' : 'overflow-hidden'
          } border-r border-sky-200/70 dark:border-slate-800 bg-[var(--theme-primary-subtle,#e6f1fa)] dark:bg-[#111827] transition-[width] duration-200 ease-in-out print:hidden ${
            isMobileMenuOpen
              ? 'fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] shadow-xl md:static md:z-auto md:max-w-none md:shadow-none'
              : 'hidden md:flex'
          } ${sidebarCollapsed ? 'md:w-[68px]' : 'md:w-64'}`}
        >
          {/* LOGO */}
          <div className="py-3.5 px-3 border-b border-sky-200/60 dark:border-slate-800">
            <div className="flex min-w-0 items-center justify-between">
              <div ref={sidebarBrandRef} className="flex min-w-0 items-center pl-1">
                <BrandLogo size="sm" showName={!sidebarCollapsed || isBrandDraggingToSidebar} />
              </div>
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => {
                  setMobileMenuPath(null)
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800 md:hidden"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* NAVEGAÇÃO */}
          <nav
            aria-label="Navegação principal"
            className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden"
          >
            {/* PÁGINA INICIAL FIXA NO TOPO */}
            <div className="pb-1.5 mb-1.5 border-b border-sky-200/50 dark:border-slate-800">
              {renderNavItem(homeNavItem)}
            </div>

            {/* TÍTULO DA SEÇÃO DE MÓDULOS */}
            <div
              className={`px-3 pt-1 pb-1 transition-all duration-200 overflow-hidden whitespace-nowrap ${
                sidebarCollapsed
                  ? 'opacity-0 max-h-0 pointer-events-none'
                  : 'opacity-100 max-h-6'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Módulos
              </span>
            </div>

            {/* MÓDULOS EM ORDEM ALFABÉTICA FIXA */}
            <div className="space-y-0.5">
              {sortedVisibleModuleItems.map(renderNavItem)}
            </div>
          </nav>
        </aside>
        </>
      )}

      {/* CONTEÚDO PRINCIPAL */}
      <main
        className={
          isDashboard
            ? 'min-h-screen bg-slate-50 dark:bg-[#0b0f19] print:bg-white print:p-0 print:m-0 print:min-h-0'
            : 'flex-1 flex flex-col min-w-0 md:h-screen md:overflow-hidden print:bg-white print:p-0 print:m-0 print:h-auto print:overflow-visible'
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

        <header className="sticky top-0 z-30 shrink-0 border-b border-sky-200/70 dark:border-slate-800 bg-[var(--theme-primary-subtle,#e6f1fa)] dark:bg-[#111827] print:hidden">
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
                to="/dashboard"
                aria-label="Dashboard"
                title="Dashboard"
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
          ref={contentContainerRef}
          className={
            isDashboard
              ? 'w-full print:p-0 print:m-0 print:w-full print:max-w-none'
              : 'flex-1 min-w-0 w-full overflow-y-auto print:p-0 print:m-0 print:w-full print:max-w-none print:overflow-visible'
          }
        >
          <div
            className={
              isDashboard
                ? 'w-full'
                : 'container-fluid mx-auto w-full max-w-[1920px] px-3 sm:px-6 lg:px-8 py-3 sm:py-4 print:p-0 print:m-0 print:w-full print:max-w-none'
            }
          >
            {children}
            <div className="print:hidden">
              <UpcomingBillsAlertModal />
              <FeedbackWidget />
              <SystemNotificationModal />
              <OrganizationSuspensionGuard />
              <TermsOfUseModal />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
