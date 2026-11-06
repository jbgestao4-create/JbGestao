import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { organizationService } from '../services/organization.service'
import { useAuth } from '@modules/auth/context/AuthContext'
import { isSystemOwner } from '@shared/utils/system-owner'
import type { Organization, OrganizationRole, ServiceResult, UUID } from '@shared/types/common'

interface OrganizationContextType {
  currentOrganization: Organization | null
  userRole: OrganizationRole | null
  organizations: Organization[]
  isLoading: boolean
  setCurrentOrganization: (org: Organization) => void
  reloadOrganizations: () => Promise<void>
  createOrganization: (name: string, slug: string) => Promise<ServiceResult<UUID>>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

const ACTIVE_ORG_STORAGE_KEY = 'orcafacil_active_org_id'

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null)
  const [userRole, setUserRole] = useState<OrganizationRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadRole = async (orgId: UUID, userId: UUID) => {
    const role = await organizationService.getUserRole(orgId, userId)
    if (role) {
      setUserRole(role)
    } else {
      setUserRole(isSystemOwner(user) ? 'owner' : 'admin')
    }
  }

  const setCurrentOrganization = (org: Organization) => {
    setCurrentOrganizationState(org)
    localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, org.id)
    if (user) {
      void loadRole(org.id, user.id)
    }
  }

  const loadOrganizations = async () => {
    if (!user) {
      setOrganizations([])
      setCurrentOrganizationState(null)
      setUserRole(null)
      setIsLoading(false)
      return
    }

    if (organizations.length === 0) {
      setIsLoading(true)
    }
    const result = await organizationService.getUserOrganizations()

    if (result.success) {
      const orgs = result.data
      setOrganizations(orgs)

      if (orgs.length > 0) {
        const savedId = localStorage.getItem(ACTIVE_ORG_STORAGE_KEY)
        let active = orgs.find((o) => o.id === savedId)

        // Se o ID salvo não existir na lista ou não houver nada salvo:
        if (!active) {
          // Se for o Proprietário do Sistema, prioriza a organização principal 'Bryan adm'
          const bryanOrg = orgs.find((o) => o.name.toLowerCase().includes('bryan'))
          active = bryanOrg ?? orgs[0]
        }

        setCurrentOrganizationState((prev) =>
          prev && prev.id === active.id && prev.name === active.name ? prev : active,
        )
        if (active) {
          localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, active.id)
        }
        await loadRole(active.id, user.id)
      } else {
        setCurrentOrganizationState(null)
        // Apenas o Proprietário do Sistema pode ter papel owner quando não há organização vinculada
        setUserRole(isSystemOwner(user) ? 'owner' : null)
      }
    }

    setIsLoading(false)
  }

  useEffect(() => {
    void loadOrganizations()
  }, [user?.id])

  const handleCreateOrganization = async (
    name: string,
    slug: string,
  ): Promise<ServiceResult<UUID>> => {
    if (!user) {
      return { success: false, error: 'Usuário não autenticado.' }
    }

    const result = await organizationService.createOrganization(name, slug, user.id)

    if (result.success) {
      await loadOrganizations()
      const newOrgId = result.data
      localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, newOrgId)
    }

    return result
  }

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        userRole,
        organizations,
        isLoading,
        setCurrentOrganization,
        reloadOrganizations: loadOrganizations,
        createOrganization: handleCreateOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization(): OrganizationContextType {
  const context = useContext(OrganizationContext)
  if (!context) {
    throw new Error('useOrganization deve ser utilizado dentro de um OrganizationProvider')
  }
  return context
}
