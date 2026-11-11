import { useEffect, useState, Suspense, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useNavigate } from 'react-router-dom'
import { Clock, Lock } from 'lucide-react'
import { WhatsAppIcon } from '@shared/components/WhatsAppIcon'
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
  const { currentOrganization } = useOrganization()
  const navigate = useNavigate()
  const { setInsideSystem } = useTheme()
  const location = useLocation()

  useScreenTimeTracker(user?.id, currentOrganization?.id)

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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Acesso da Empresa Desativado</h2>
          <p className="text-sm text-gray-600 dark:text-slate-300 mb-6 leading-relaxed">
            O acesso para a empresa <strong>{currentOrganization.name}</strong> (Identificador: <span className="font-mono text-xs text-blue-600 dark:text-blue-400">{currentOrganization.slug}</span>) foi desativado. Entre em contato com a equipe de Suporte do ControleSoft para reativar seu acesso.
          </p>
          <div className="space-y-3">
            <a
              href="https://wa.me/5531986848490?text=Ol%C3%A1%21%20O%20acesso%20da%20minha%20empresa%20est%C3%A1%20desativado.%20Gostaria%20de%20solicitar%20suporte."
              target="_blank"
              rel="noreferrer"
              title="Falar com Suporte no WhatsApp"
              aria-label="Falar com Suporte no WhatsApp"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 shadow-sm transition-colors"
            >
              <WhatsAppIcon className="h-5 w-5" />
            </a>
            <button
              onClick={() => void signOut().then(() => navigate('/login', { state: { deactivated: true, orgName: currentOrganization.name } }))}
              className="w-full text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 py-2"
            >
              Sair da Conta e Voltar ao Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 2. Se o período de teste expirou e o usuário não é o Proprietário do Sistema
  const isTrialExpired = Boolean(
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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Tempo de teste expirado</h2>
          <p className="text-sm text-gray-700 dark:text-slate-200 mb-2 leading-relaxed font-semibold">
            Tempo de teste expirado, entre em contato com a ControleSoft
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-6">
            O período de avaliação da empresa <strong>{currentOrganization.name}</strong> encerrou-se em {expiredDateFormatted}. O acesso às funcionalidades do sistema está suspenso até a regularização.
          </p>
          <div className="space-y-3">
            <a
              href="https://wa.me/5531986848490?text=Ol%C3%A1%21%20O%20tempo%20de%20teste%20da%20minha%20empresa%20expirou.%20Gostaria%20de%20renovar%20o%20acesso%20com%20a%20JB%20Software."
              target="_blank"
              rel="noreferrer"
              title="Falar com a ControleSoft no WhatsApp"
              aria-label="Falar com a ControleSoft no WhatsApp"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 shadow-sm transition-colors"
            >
              <WhatsAppIcon className="h-5 w-5" />
            </a>
            <button
              onClick={() => void signOut().then(() => navigate('/login', { state: { trialExpired: true, orgName: currentOrganization.name } }))}
              className="w-full text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 py-2"
            >
              Sair da Conta e Voltar ao Login
            </button>
          </div>
        </div>
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
