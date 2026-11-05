import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useNavigate } from 'react-router-dom'
import { Lock, MessageCircle } from 'lucide-react'
import { useTheme } from '@shared/context/ThemeContext'
import { AppLayout } from '@app/layouts/AppLayout'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
  hideLayout?: boolean
}

export function ProtectedRoute({ children, hideLayout = false }: ProtectedRouteProps) {
  const { user, isLoading, signOut } = useAuth()
  const { currentOrganization, userRole } = useOrganization()
  const navigate = useNavigate()
  const { setInsideSystem } = useTheme()
  const location = useLocation()

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
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
        <p className="text-sm text-gray-500">Carregando autenticação...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Se a organização do usuário foi desativada e o usuário não é proprietário (Requisito 5)
  if (currentOrganization && currentOrganization.isActive === false && userRole !== 'owner') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-rose-200 dark:border-rose-900/60 text-center">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-800">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Acesso da Empresa Desativado</h2>
          <p className="text-sm text-gray-600 dark:text-slate-300 mb-6 leading-relaxed">
            O acesso para a empresa <strong>{currentOrganization.name}</strong> (Identificador: <span className="font-mono text-xs text-blue-600 dark:text-blue-400">{currentOrganization.slug}</span>) foi desativado. Entre em contato com a equipe de Suporte do JB Software para reativar seu acesso.
          </p>
          <div className="space-y-3">
            <a
              href="https://wa.me/5531986848490?text=Ol%C3%A1%21%20O%20acesso%20da%20minha%20empresa%20est%C3%A1%20desativado.%20Gostaria%20de%20solicitar%20suporte."
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 shadow-sm transition-colors"
            >
              <MessageCircle className="h-5 w-5" />
              Falar com Suporte (WhatsApp 31 986848490)
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

  if (hideLayout) {
    return <>{children}</>
  }

  return <AppLayout>{children}</AppLayout>
}
