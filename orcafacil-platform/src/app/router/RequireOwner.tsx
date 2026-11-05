import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { ShieldAlert, Loader2 } from 'lucide-react'
import { Button } from '@shared/components/ui/Button'

interface RequireOwnerProps {
  children: ReactNode
}

export function RequireOwner({ children }: RequireOwnerProps) {
  const { userRole, isLoading } = useOrganization()

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
        <p className="text-sm text-gray-500 dark:text-slate-400">Verificando permissões de proprietário...</p>
      </div>
    )
  }

  if (userRole !== 'owner') {
    return (
      <div className="py-20 max-w-md mx-auto text-center space-y-4 px-4">
        <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Acesso Exclusivo ao Proprietário</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Apenas o <strong>Proprietário (Owner)</strong> possui acesso a este módulo. Administradores e membros não têm permissão para acessar o Gerenciamento de Empresas Cadastradas.
        </p>
        <div className="pt-2">
          <Link to="/">
            <Button variant="outline" size="sm">
              Voltar à Página Inicial
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

