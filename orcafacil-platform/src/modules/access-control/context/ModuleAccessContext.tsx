import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  moduleAccessService,
  PLATFORM_MODULES_CATALOG,
  type GrantedModule,
  type PlatformModule,
} from '../services/module-access.service'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useAuth } from '@modules/auth/context/AuthContext'
import { supabase } from '@app/config/supabase'
import type { ModuleCode } from '@shared/types/database'

interface ModuleAccessContextType {
  allModules: PlatformModule[]
  grantedModules: GrantedModule[]
  memberAllowedModules: ModuleCode[]
  isLoading: boolean
  canAccess: (moduleCode: ModuleCode) => boolean
  refreshAccess: () => Promise<void>
}

const ModuleAccessContext = createContext<ModuleAccessContextType | undefined>(undefined)

export function ModuleAccessProvider({ children }: { children: ReactNode }) {
  const { currentOrganization, userRole } = useOrganization()
  const { user } = useAuth()
  const [allModules, setAllModules] = useState<PlatformModule[]>(PLATFORM_MODULES_CATALOG)
  const [grantedModules, setGrantedModules] = useState<GrantedModule[]>([])
  const [memberAllowedModules, setMemberAllowedModules] = useState<ModuleCode[]>([])
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

      // 3. Se for usuário com papel 'member', carrega permissões específicas de módulos atribuídas pelo administrador
      if (user && userRole === 'member') {
        const { data: memberPerms, error } = await supabase
          .from('organization_member_modules')
          .select('module_code')
          .eq('organization_id', currentOrganization.id)
          .eq('user_id', user.id)

        if (!error && memberPerms) {
          setMemberAllowedModules(memberPerms.map((p) => p.module_code as ModuleCode))
        } else {
          setMemberAllowedModules([])
        }
      } else {
        // Owners e Admins têm acesso a todos os módulos concedidos à organização
        setMemberAllowedModules([])
      }
    } else {
      setGrantedModules([])
      setMemberAllowedModules([])
    }

    setIsLoading(false)
  }

  useEffect(() => {
    void loadAccess()
  }, [currentOrganization, userRole, user])

  /**
   * Avalia se a organização atual e o usuário específico têm acesso ativo a determinado módulo.
   */
  const canAccess = (moduleCode: ModuleCode): boolean => {
    if (!currentOrganization) return false

    // 1. Verifica se a organização possui o módulo ativo
    const orgHasModule = grantedModules.some(
      (m) =>
        m.code === moduleCode &&
        m.status === 'active' &&
        (!m.expiresAt || new Date(m.expiresAt) > new Date()),
    )

    if (!orgHasModule) return false

    // 2. Se for owner ou admin, tem acesso direto
    if (userRole === 'owner' || userRole === 'admin') {
      return true
    }

    // 3. Se for membro operacional, verifica se o administrador concedeu o módulo especificamente
    return memberAllowedModules.includes(moduleCode)
  }

  return (
    <ModuleAccessContext.Provider
      value={{
        allModules,
        grantedModules,
        memberAllowedModules,
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
