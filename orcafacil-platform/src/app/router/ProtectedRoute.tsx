import { useEffect, useState, useCallback, Suspense, type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useNavigate } from 'react-router-dom'
import { Clock, Lock, QrCode, Zap } from 'lucide-react'
import { WhatsAppIcon } from '@shared/components/WhatsAppIcon'
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
  const { currentOrganization, reloadOrganizations } = useOrganization()
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

  if (isLoading) {
    return <BrandLoadingScreen message="Carregando autenticação..." />
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (mustChangePassword && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />
  }

  const isOwner = isSystemOwner(user)

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

  // 1. Se a organização do usuário foi desativada e o usuário não é o Proprietário do Sistema
  if (currentOrganization && currentOrganization.isActive === false && !isOwner) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-rose-200 dark:border-rose-900/60 text-center">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-800">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Acesso da Empresa Suspenso / Desativado
          </h2>
          <p className="text-sm text-gray-600 dark:text-slate-300 mb-3 leading-relaxed">
            O acesso para a empresa <strong>{currentOrganization.name}</strong> (Identificador:{' '}
            <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
              {currentOrganization.slug}
            </span>
            ) encontra-se temporariamente suspenso devido a pendência financeira de assinatura ou inativação administrativa.
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-6 leading-relaxed">
            Seus dados permanecem preservados pelo período de carência contratual (30 a 90 dias). Realize o pagamento via PIX para somar +30 dias de acesso ou solicite suporte:
          </p>
          <div className="space-y-3">
            {/* Botão para realizar pagamento via PIX (+30 dias) */}
            <Button
              type="button"
              onClick={() => setIsPixModalOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3.5 text-sm font-bold text-white shadow-md transition-all cursor-pointer"
            >
              <QrCode className="h-5 w-5" />
              <Zap className="h-4 w-4" />
              <span>Realizar Pagamento via PIX (+30 Dias)</span>
            </Button>

            {/* Botão de Mais Informações via WhatsApp */}
            <a
              href={`https://wa.me/5531986848490?text=${encodeURIComponent(
                `Olá! O acesso da minha empresa "${currentOrganization.name}" está suspenso. Gostaria de mais informações sobre pagamento e regularização.`,
              )}`}
              target="_blank"
              rel="noreferrer"
              title="Mais informações via WhatsApp"
              aria-label="Mais informações via WhatsApp"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 shadow-xs transition-colors"
            >
              <WhatsAppIcon className="h-5 w-5 text-emerald-600" />
              <span>Mais Informações via WhatsApp</span>
            </a>

            <div className="text-xs text-gray-500 dark:text-slate-400">
              E-mail DPO / Suporte:{' '}
              <a
                href="mailto:controlesoft@outlook.com"
                className="font-semibold text-blue-600 dark:text-blue-400 underline"
              >
                controlesoft@outlook.com
              </a>
            </div>
            <Link
              to="/politica-de-privacidade"
              className="block text-xs font-medium text-gray-500 hover:text-blue-600 dark:text-slate-400 underline"
            >
              Consultar Política de Privacidade e Retenção de Dados (LGPD)
            </Link>
            <button
              onClick={() => void signOut().then(() => navigate('/login', { state: { deactivated: true, orgName: currentOrganization.name } }))}
              className="w-full text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 py-2 cursor-pointer"
            >
              Sair da Conta e Voltar ao Login
            </button>
          </div>
        </div>

        <PixPaymentCheckoutModal
          isOpen={isPixModalOpen}
          onClose={() => setIsPixModalOpen(false)}
          organizationId={currentOrganization.id}
          prefillClientName={currentOrganization.name}
          customTitle="Regularização de Licença • Liberação Imediata +30 Dias"
          onPaymentSuccess={async () => {
            setIsPixModalOpen(false)
            await reloadOrganizations()
          }}
        />
      </div>
    )
  }

  // 2. Se o período de teste expirou e o usuário não é o Proprietário do Sistema
  const lic = calculateCompanyLicenseStatus(
    currentOrganization?.trialEndsAt,
    currentOrganization?.isActive ?? true,
  )
  const isTrialExpired = lic.isBlockedByOverdue || Boolean(
    currentOrganization?.trialEndsAt &&
      new Date(currentOrganization.trialEndsAt).getTime() < Date.now(),
  )

  if (currentOrganization && isTrialExpired && !isOwner) {
    const expiredDateFormatted = currentOrganization.trialEndsAt
      ? new Date(currentOrganization.trialEndsAt).toLocaleDateString('pt-BR')
      : ''

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-amber-200 dark:border-amber-900/60 text-center">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-800">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Período de Teste Gratuito (Trial) Encerrado
          </h2>
          <p className="text-sm text-gray-700 dark:text-slate-200 mb-2 leading-relaxed font-semibold">
            Tempo de teste expirado, entre em contato com a ControleSoft
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-6 leading-relaxed">
            O período de avaliação da empresa <strong>{currentOrganization.name}</strong> encerrou-se em {expiredDateFormatted}. O acesso às funcionalidades está suspenso até a contratação ou renovação do plano, permanecendo seus dados preservados pelo período de carência (30 a 90 dias).
          </p>
          <div className="space-y-3">
            {/* Botão para realizar pagamento via PIX (+30 dias na empresa) */}
            <Button
              type="button"
              onClick={() => setIsPixModalOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3.5 text-sm font-bold text-white shadow-md transition-all cursor-pointer"
            >
              <QrCode className="h-5 w-5" />
              <Zap className="h-4 w-4" />
              <span>Realizar Pagamento via PIX (+30 Dias)</span>
            </Button>

            {/* Botão de Mais Informações via WhatsApp */}
            <a
              href={`https://wa.me/5531986848490?text=${encodeURIComponent(
                `Olá! O tempo de teste da minha empresa "${currentOrganization.name}" encerrou. Gostaria de mais informações sobre a contratação / renovação.`,
              )}`}
              target="_blank"
              rel="noreferrer"
              title="Mais informações via WhatsApp"
              aria-label="Mais informações via WhatsApp"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 shadow-xs transition-colors"
            >
              <WhatsAppIcon className="h-5 w-5 text-emerald-600" />
              <span>Mais Informações via WhatsApp</span>
            </a>

            <div className="text-xs text-gray-500 dark:text-slate-400">
              E-mail DPO / Suporte:{' '}
              <a
                href="mailto:controlesoft@outlook.com"
                className="font-semibold text-blue-600 dark:text-blue-400 underline"
              >
                controlesoft@outlook.com
              </a>
            </div>
            <Link
              to="/politica-de-privacidade"
              className="block text-xs font-medium text-gray-500 hover:text-blue-600 dark:text-slate-400 underline"
            >
              Consultar Política de Privacidade e Retenção de Dados (LGPD)
            </Link>
            <button
              onClick={() => void signOut().then(() => navigate('/login', { state: { trialExpired: true, orgName: currentOrganization.name } }))}
              className="w-full text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 py-2 cursor-pointer"
            >
              Sair da Conta e Voltar ao Login
            </button>
          </div>
        </div>

        <PixPaymentCheckoutModal
          isOpen={isPixModalOpen}
          onClose={() => setIsPixModalOpen(false)}
          organizationId={currentOrganization.id}
          prefillClientName={currentOrganization.name}
          customTitle="Renovação de Licença • Liberação Imediata +30 Dias"
          onPaymentSuccess={async () => {
            setIsPixModalOpen(false)
            await reloadOrganizations()
          }}
        />
      </div>
    )
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
