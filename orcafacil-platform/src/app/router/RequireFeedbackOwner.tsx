import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, ShieldAlert } from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { suggestionService } from '@modules/suggestions/services/suggestion.service'

export function RequireFeedbackOwner({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { currentOrganization, isLoading } = useOrganization()
  const [ownerCheck, setOwnerCheck] = useState<{ key: string; isOwner: boolean } | null>(null)
  const userId = user?.id
  const organizationId = currentOrganization?.id
  const accessKey = userId && organizationId ? `${userId}:${organizationId}` : null

  useEffect(() => {
    let active = true
    if (!userId || !organizationId) return

    void suggestionService
      .isOrganizationOwner(organizationId, userId)
      .then((isOwner) => {
        if (active) setOwnerCheck({ key: `${userId}:${organizationId}`, isOwner })
      })
    return () => {
      active = false
    }
  }, [userId, organizationId])

  const isChecking = accessKey !== null && ownerCheck?.key !== accessKey
  const isOwner = accessKey !== null && ownerCheck?.key === accessKey && ownerCheck.isOwner

  if (isLoading || isChecking) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500">Verificando permissão de proprietário...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!isOwner) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-20 text-center">
        <ShieldAlert className="h-10 w-10 text-rose-600" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Acesso exclusivo ao proprietário</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Somente o proprietário desta empresa pode consultar e administrar sugestões.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
