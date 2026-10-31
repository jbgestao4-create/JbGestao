import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import type { ModuleCode } from '@shared/types/database'
import { Lock, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@shared/components/ui/Button'

interface RequireModuleProps {
  moduleCode: ModuleCode
  children: ReactNode
}

export function RequireModule({ moduleCode, children }: RequireModuleProps) {
  const { canAccess, isLoading } = useModuleAccess()

  if (isLoading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
        <p className="text-sm text-gray-500">Verificando permissões de acesso...</p>
      </div>
    )
  }

  if (!canAccess(moduleCode)) {
    return (
      <div className="py-16 max-w-md mx-auto text-center space-y-4">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Módulo Não Disponível</h2>
        <p className="text-sm text-gray-500">
          Sua organização não possui concessão ativa para acessar o módulo{' '}
          <strong className="text-gray-900">{moduleCode}</strong>.
        </p>
        <div className="pt-2">
          <Link to="/modules">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4" /> Ver Catálogo de Módulos
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

