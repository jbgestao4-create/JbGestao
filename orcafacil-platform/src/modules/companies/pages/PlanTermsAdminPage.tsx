import { Navigate, useSearchParams } from 'react-router-dom'

export type TermsModuleTab = 'terms' | 'acceptance-audit'

export interface PlanTermsAdminPageProps {
  initialTab?: TermsModuleTab
}

/**
 * Redirecionamento transparente do módulo legado /admin/terms
 * para o módulo unificado /admin/companies?tab=terms ou tab=acceptance-audit.
 */
export function PlanTermsAdminPage({ initialTab = 'terms' }: PlanTermsAdminPageProps = {}) {
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const targetTab = tabParam === 'acceptance-audit' || tabParam === 'terms' ? tabParam : initialTab

  const nextParams = new URLSearchParams()
  nextParams.set('tab', targetTab)

  const search = searchParams.get('search') || searchParams.get('q')
  if (search) {
    nextParams.set('search', search)
  }

  return <Navigate to={`/admin/companies?${nextParams.toString()}`} replace />
}
