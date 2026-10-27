import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  moduleAccessService,
  PLATFORM_MODULES_CATALOG,
  type GrantedModule,
  type PlatformModule,
} from '../services/module-access.service'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import type { ModuleCode } from '@shared/types/database'

interface ModuleAccessContextType {
  allModules: PlatformModule[]
  grantedModules: GrantedModule[]
  isLoading: boolean
  canAccess: (moduleCode: ModuleCode) => boolean
  refreshAccess: () => Promise<void>
}

const ModuleAccessContext = createContext<ModuleAccessContextType | undefined>(undefined)

export function ModuleAccessProvider({ children }: { children: ReactNode }) {
  const { currentOrganization } = useOrganization()
  const [allModules, setAllModules] = useState<PlatformModule[]>(PLATFORM_MODULES_CATALOG)
  const [grantedModules, setGrantedModules] = useState<GrantedModule[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadAccess = async () => {
    setIsLoading(true)

    // 1. Carrega catálogo geral de módulos
    const catResult = await moduleAccessService.getAllModules()
    if (catResult.success) {
      setAllModules(catResult.data)
    }

    // 2. Carrega concessões da organização atual
    if (currentOrganization) {
      const grantResult = await moduleAccessService.getOrganizationModules(currentOrganization.id)
      if (grantResult.success) {
        setGrantedModules(grantResult.data)
      } else {
        setGrantedModules([])
      }
    } else {
      setGrantedModules([])
    }

    setIsLoading(false)
  }

  useEffect(() => {
    void loadAccess()
  }, [currentOrganization])

  /**
   * Avalia se a organização atual tem acesso ativo a determinado módulo.
   */
  const canAccess = (moduleCode: ModuleCode): boolean => {
    if (!currentOrganization) return false

    // OrçaFácil é concedido automaticamente a qualquer organização criada
    return grantedModules.some(
      (m) =>
        m.code === moduleCode &&
        m.status === 'active' &&
        (!m.expiresAt || new Date(m.expiresAt) > new Date()),
    )
  }

  return (
    <ModuleAccessContext.Provider
      value={{
        allModules,
        grantedModules,
        isLoading,
        canAccess,
        refreshAccess: loadAccess,
      }}
    >
      {children}
    </ModuleAccessContext.Provider>
  )
}

export function useModuleAccess(): ModuleAccessContextType {
  const context = useContext(ModuleAccessContext)
  if (!context) {
    throw new Error('useModuleAccess deve ser utilizado dentro de um ModuleAccessProvider')
  }
  return context
}
