import { useEffect, useState, useCallback, Suspense, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useNavigate } from 'react-router-dom'
import { QrCode, ShieldAlert, Building2, LogOut } from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { PixPaymentCheckoutModal } from '@modules/companies/components/PixPaymentCheckoutModal'
import { calculateCompanyLicenseStatus } from '@modules/companies/utils/license.utils'
import { useTheme } from '@shared/context/ThemeContext'
import { AppLayout } from '@app/layouts/AppLayout'
import { BrandLoadingScreen } from '@shared/components/BrandLoadingScreen'
import { isSystemOwner } from '@shared/utils/system-owner'
import { FeedbackWidget } from '@modules/suggestions/components/FeedbackWidget'
import { useScreenTimeTracker } from '@shared/hooks/useScreenTimeTracker'
import { systemMaintenanceService, type MaintenanceStatus } from '@shared/services/system-maintenance.service'
import { SystemMaintenanceScreen } from '@shared/components/SystemMaintenanceScreen'
import { supabase } from '@app/config/supabase'

interface ProtectedRouteProps {
  children: ReactNode
  hideLayout?: boolean
}

export function ProtectedRoute({ children, hideLayout = false }: ProtectedRouteProps) {
  const { user, isLoading, signOut, mustChangePassword } = useAuth()
  const { currentOrganization, userRole, reloadOrganizations } = useOrganization()
  const navigate = useNavigate()
  const { setInsideSystem } = useTheme()
  const location = useLocation()
  const [isPixModalOpen, setIsPixModalOpen] = useState(false)

  const handleInactivityLogout = useCallback(() => {
    void signOut().then(() => {
      navigate('/login', { state: { inactivity: true }, replace: true })
    })
  }, [signOut, navigate])

  useScreenTimeTracker(user?.id, currentOrganization?.id, handleInactivityLogout)

  useEffect(() => {
    const handleRequired = () => {
      handleInactivityLogout()
    }
    window.addEventListener('inactivity-logout-required', handleRequired)
    return () => {
      window.removeEventListener('inactivity-logout-required', handleRequired)
    }
  }, [handleInactivityLogout])

  const [maintenance, setMaintenance] = useState<MaintenanceStatus>(() => {
    try {
      const raw = localStorage.getItem('jb_system_maintenance_status')
      if (raw) {
        const parsed = JSON.parse(raw)
        return {
          enabled: Boolean(parsed.enabled),
          message: parsed.message || '',
          updatedAt: parsed.updatedAt || '',
        }
      }
    } catch {
      // ignore
    }
    return { enabled: false, message: '', updatedAt: '' }
  })

  useEffect(() => {
    let isMounted = true

    const checkMaintenance = async () => {
      const res = await systemMaintenanceService.getStatus()
      if (isMounted && res.success && res.data) {
        setMaintenance(res.data)
        window.dispatchEvent(new CustomEvent('maintenance-status-changed', { detail: res.data }))
      }
    }

    void checkMaintenance()

    const channelName = `maint-mode-${Math.random().toString(36).substring(2, 9)}`
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

  useEffect(() => {
    if (user) {
      setInsideSystem(true)
      return () => {
        setInsideSystem(false)
      }
    } else {
      setInsideSystem(false)
    }
  }, [user, setInsideSystem])

  const isOwner = isSystemOwner(user)
  const isCompanyAdmin = userRole === 'owner' || userRole === 'admin'

  const lic = calculateCompanyLicenseStatus(
    currentOrganization?.trialEndsAt,
    currentOrganization?.isActive ?? true,
  )
  const isTrialExpired = Boolean(
    !isLoading &&
      user &&
      currentOrganization &&
      currentOrganization.isActive !== false &&
      lic.isBlockedByOverdue &&
      !isOwner &&
      isCompanyAdmin,
  )

  useEffect(() => {
    if (!isTrialExpired || !currentOrganization) return
    void signOut().then(() => {
      navigate('/login', {
        state: { trialExpired: true, orgName: currentOrganization.name },
        replace: true,
      })
    })
  }, [isTrialExpired, currentOrganization, signOut, navigate])

  if (isLoading) {
    return <BrandLoadingScreen message="Carregando autenticação..." />
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (mustChangePassword && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />
  }

  // 0. Modo de Manutenção do Sistema (Emergência Temporária)
  // Se o sistema estiver em manutenção e o usuário não for desenvolvedor/proprietário
  if (maintenance.enabled && !isOwner) {
    return (
      <SystemMaintenanceScreen
        message={maintenance.message}
        onRecheck={async () => {
          const res = await systemMaintenanceService.getStatus()
          if (res.success && res.data) {
            setMaintenance(res.data)
          }
        }}
      />
    )
  }

  // 1. Se a organização do usuário foi desativada (exibida apenas para administradores, nunca para operadores)
  if (currentOrganization && currentOrganization.isActive === false && !isOwner && isCompanyAdmin) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md overflow-y-auto">
        <div className="max-w-lg w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-rose-500/40 overflow-hidden animate-in zoom-in-95">
          {/* Cabeçalho Vermelho de Alerta */}
          <div className="bg-rose-600 px-6 py-5 text-white flex items-center gap-3.5">
            <div className="p-2.5 rounded-2xl bg-white/20 shrink-0">
              <ShieldAlert className="h-7 w-7 text-white" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-rose-200 block">
                Bloqueio de Segurança Financeira
              </span>
              <h2 className="text-lg sm:text-xl font-black leading-tight">
                Acesso da Empresa Suspenso / Desativado
              </h2>
            </div>
          </div>

          {/* Corpo do Bloqueio */}
          <div className="p-6 sm:p-8 space-y-6 text-gray-800 dark:text-slate-200">
            <div className="space-y-2">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-rose-600" />
                <span>{currentOrganization.name}</span>
              </h3>
              <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
                O acesso aos módulos do sistema foi temporariamente bloqueado devido a pendência financeira de assinatura ou inativação administrativa.
              </p>
            </div>

            {/* Botão para Gerar QR Code de Pagamento PIX */}
            <div className="p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 space-y-3">
              <button
                type="button"
                onClick={() => setIsPixModalOpen(true)}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 transition cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                Gerar QR Code para Pagamento
              </button>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 text-center">
                O sistema identifica o PIX automaticamente em segundos e libera o acesso na hora.
              </p>
            </div>

            {/* Rodapé com botão de Sair */}
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Suporte: controlesoft@outlook.com
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void signOut().then(() =>
                    navigate('/login', {
                      state: { deactivated: true, orgName: currentOrganization.name },
                    }),
                  )
                }
                className="gap-2 text-xs text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair do Sistema
              </Button>
            </div>
          </div>
        </div>

        <PixPaymentCheckoutModal
          isOpen={isPixModalOpen}
          onClose={async () => {
            setIsPixModalOpen(false)
            await reloadOrganizations()
          }}
          organizationId={currentOrganization.id}
          prefillClientName={currentOrganization.name}
          customTitle="Regularização de Licença • Liberação Imediata +30 Dias"
          onPaymentSuccess={async () => {
            await reloadOrganizations()
          }}
        />
      </div>
    )
  }

  // 2. Se o período de carência (5 dias) também expirou, encerra a sessão e redireciona para o Login
  if (isTrialExpired) {
    return <BrandLoadingScreen message="Redirecionando para a tela de login..." />
  }

  if (hideLayout) {
    return (
      <Suspense fallback={<BrandLoadingScreen message="Carregando página..." />}>
        {children}
        <FeedbackWidget />
      </Suspense>
    )
  }

  return (
    <AppLayout>
      <Suspense fallback={<BrandLoadingScreen message="Carregando página..." fullScreen={false} />}>
        {children}
      </Suspense>
    </AppLayout>
  )
}
