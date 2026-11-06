import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import type { DashboardModuleCode } from '@shared/types/database'
import { Loader2 } from 'lucide-react'

interface RequireDashboardModuleProps {
  moduleCode: DashboardModuleCode
  subFeatureCode?: string
  children: ReactNode
}

export function RequireDashboardModule({
  moduleCode,
  subFeatureCode,
  children,
}: RequireDashboardModuleProps) {
  const { canAccessDashboardModule, canAccessSubFeature, isLoading } = useModuleAccess()

  if (isLoading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
        <p className="text-sm text-gray-500">Verificando permissões de acesso...</p>
      </div>
    )
  }
  if (!canAccessDashboardModule(moduleCode)) return <Navigate to="/" replace />

  if (subFeatureCode && !canAccessSubFeature(subFeatureCode)) {
    const fallbackPath =
      moduleCode === 'MOD-01'
        ? '/orcafacil/sales'
        : moduleCode === 'MOD-02'
          ? '/orcafacil/inventory'
          : moduleCode === 'MOD-03'
            ? '/orcafacil/customers'
            : moduleCode === 'MOD-04'
              ? '/orcafacil/quotes'
              : moduleCode === 'MOD-06'
                ? '/orcafacil/suppliers'
                : moduleCode === 'MOD-09'
                  ? '/services'
                  : moduleCode === 'MOD-10'
                    ? '/service-orders'
                    : '/'
    return <Navigate to={fallbackPath} replace />
  }

  return <>{children}</>
}
