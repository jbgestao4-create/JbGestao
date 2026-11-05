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
import type { DashboardModuleCode, ModuleCode } from '@shared/types/database'
import type { InventoryAccessLevel } from '@shared/types/common'
import { getStoredInventoryLevels } from '@modules/organizations/services/organization.service'
import { logger } from '@shared/lib/logger'
import { DASHBOARD_MODULES } from '../services/module-access.service'

interface ModuleAccessContextType {
  allModules: PlatformModule[]
  grantedModules: GrantedModule[]
  memberAllowedModules: ModuleCode[]
  memberAllowedDashboardModules: DashboardModuleCode[]
  inventoryAccessLevel: InventoryAccessLevel
  canCreateInventoryProduct: boolean
  canEditInventoryProduct: boolean
  canDeleteInventoryProduct: boolean
  canMoveInventory: boolean
  isLoading: boolean
  canAccess: (moduleCode: ModuleCode) => boolean
  canAccessDashboardModule: (moduleCode: DashboardModuleCode) => boolean
  refreshAccess: () => Promise<void>
}

const ModuleAccessContext = createContext<ModuleAccessContextType | undefined>(undefined)

export function ModuleAccessProvider({ children }: { children: ReactNode }) {
  const { currentOrganization, userRole } = useOrganization()
  const { user } = useAuth()
  const [allModules, setAllModules] = useState<PlatformModule[]>(PLATFORM_MODULES_CATALOG)
  const [grantedModules, setGrantedModules] = useState<GrantedModule[]>([])
  const [memberAllowedModules, setMemberAllowedModules] = useState<ModuleCode[]>([])
  const [memberAllowedDashboardModules, setMemberAllowedDashboardModules] = useState<
    DashboardModuleCode[]
  >([])
  const [inventoryAccessLevel, setInventoryAccessLevel] = useState<InventoryAccessLevel>(3)
  const [isLoading, setIsLoading] = useState(true)
  const [loadedOrgKey, setLoadedOrgKey] = useState<string | null>(null)

  const loadAccess = async () => {
    const targetKey = `${currentOrganization?.id ?? 'none'}:${user?.id ?? 'none'}:${userRole ?? 'none'}`
    if (loadedOrgKey !== targetKey) {
      setIsLoading(true)
    }

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
        const { data: memberPerms, error: memberModulesError } = await supabase
          .from('organization_member_modules')
          .select('module_code')
          .eq('organization_id', currentOrganization.id)
          .eq('user_id', user.id)

        if (memberModulesError) {
          logger.error('Erro ao carregar permissões de módulos do membro', memberModulesError)
          setMemberAllowedModules([])
        } else {
          setMemberAllowedModules(memberPerms.map((p) => p.module_code as ModuleCode))
        }

        const { data: dashboardPerms, error: dashboardModulesError } = await supabase
          .from('organization_member_dashboard_modules')
          .select('module_code')
          .eq('organization_id', currentOrganization.id)
          .eq('user_id', user.id)

        if (dashboardModulesError) {
          logger.warn(
            'Permissões dos cartões não estão disponíveis; usando acesso padrão até aplicar a migração.',
            {
              code: dashboardModulesError.code,
              message: dashboardModulesError.message,
            },
          )
          setMemberAllowedDashboardModules(DASHBOARD_MODULES.map((module) => module.code))
        } else {
          setMemberAllowedDashboardModules(
            dashboardPerms.map((p) => p.module_code as DashboardModuleCode),
          )
        }

        // 4. Carrega nível de acesso específico ao estoque
        let userInvLevel: InventoryAccessLevel = 3
        try {
          const response = await supabase
            .from('organization_members')
            .select('inventory_access_level' as never)
            .eq('organization_id', currentOrganization.id)
            .eq('user_id', user.id)
            .maybeSingle()

          const memberRecord = response.data as { inventory_access_level?: number | null } | null

          if (
            memberRecord?.inventory_access_level === 1 ||
            memberRecord?.inventory_access_level === 2 ||
            memberRecord?.inventory_access_level === 3
          ) {
            userInvLevel = memberRecord.inventory_access_level
          } else {
            const stored: Record<string, InventoryAccessLevel | undefined> = getStoredInventoryLevels(currentOrganization.id)
            const fallback = stored[user.id]
            if (fallback) {
              userInvLevel = fallback
            }
          }
        } catch {
          const stored: Record<string, InventoryAccessLevel | undefined> = getStoredInventoryLevels(currentOrganization.id)
          const fallback = stored[user.id]
          if (fallback) {
            userInvLevel = fallback
          }
        }
        setInventoryAccessLevel(userInvLevel)
      } else {
        // Proprietários e administradores mantêm acesso total aos cartões e nível 3.
        setMemberAllowedModules([])
        setMemberAllowedDashboardModules([])
        setInventoryAccessLevel(3)
      }
    } else {
      setGrantedModules([])
      setMemberAllowedModules([])
      setMemberAllowedDashboardModules([])
      setInventoryAccessLevel(3)
    }

    setLoadedOrgKey(targetKey)
    setIsLoading(false)
  }

  useEffect(() => {
    void loadAccess()
  }, [currentOrganization?.id, userRole, user?.id])

  /**
   * Avalia se a organização atual e o usuário específico têm acesso ativo a determinado módulo.
   */
  const canAccess = (moduleCode: ModuleCode): boolean => {
    if (!currentOrganization) return false

    // O proprietário mantém acesso total, independentemente das concessões da organização.
    if (userRole === 'owner') return true

    // 1. Verifica se a organização possui o módulo ativo
    const orgHasModule = grantedModules.some(
      (m) =>
        m.code === moduleCode &&
        m.status === 'active' &&
        (!m.expiresAt || new Date(m.expiresAt) > new Date()),
    )

    if (!orgHasModule) return false

    // 2. Administradores têm acesso direto às concessões ativas da organização.
    if (userRole === 'admin') {
      return true
    }

    // 3. Se for membro operacional, verifica se o administrador concedeu o módulo especificamente
    return memberAllowedModules.includes(moduleCode)
  }

  const canAccessDashboardModule = (moduleCode: DashboardModuleCode): boolean => {
    if (!currentOrganization) return false

    if (userRole === 'owner' || userRole === 'admin') {
      return true
    }

    return userRole === 'member' && memberAllowedDashboardModules.includes(moduleCode)
  }

  const effectiveInventoryLevel: InventoryAccessLevel =
    userRole === 'owner' || userRole === 'admin' ? 3 : inventoryAccessLevel

  const canCreateInventoryProduct =
    canAccessDashboardModule('MOD-02') && effectiveInventoryLevel >= 2

  const canEditInventoryProduct =
    canAccessDashboardModule('MOD-02') && effectiveInventoryLevel === 3

  const canDeleteInventoryProduct =
    canAccessDashboardModule('MOD-02') && effectiveInventoryLevel === 3

  const canMoveInventory =
    canAccessDashboardModule('MOD-02') && effectiveInventoryLevel === 3

  return (
    <ModuleAccessContext.Provider
      value={{
        allModules,
        grantedModules,
        memberAllowedModules,
        memberAllowedDashboardModules,
        inventoryAccessLevel: effectiveInventoryLevel,
        canCreateInventoryProduct,
        canEditInventoryProduct,
        canDeleteInventoryProduct,
        canMoveInventory,
        isLoading,
        canAccess,
        canAccessDashboardModule,
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
