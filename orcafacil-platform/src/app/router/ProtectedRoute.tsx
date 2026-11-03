import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useTheme } from '@shared/context/ThemeContext'
import { AppLayout } from '@app/layouts/AppLayout'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
  hideLayout?: boolean
}

export function ProtectedRoute({ children, hideLayout = false }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
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

  if (hideLayout) {
    return <>{children}</>
  }

  return <AppLayout>{children}</AppLayout>
}
