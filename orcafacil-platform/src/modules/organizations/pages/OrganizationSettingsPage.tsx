import { useEffect, useState } from 'react'
import { useOrganization } from '../context/OrganizationContext'
import { organizationService } from '../services/organization.service'
import { Card, CardContent, CardHeader } from '@shared/components/ui/Card'
import { Badge } from '@shared/components/ui/Badge'
import { ShieldCheck, User } from 'lucide-react'
import type { OrganizationMembership } from '@shared/types/common'

export function OrganizationSettingsPage() {
  const { currentOrganization, userRole } = useOrganization()
  const [members, setMembers] = useState<OrganizationMembership[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentOrganization) return

    const loadMembers = async () => {
      setIsLoading(true)
      const res = await organizationService.getMembers(currentOrganization.id)
      if (res.success) {
        setMembers(res.data)
      }
      setIsLoading(false)
    }

    void loadMembers()
  }, [currentOrganization])

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Configurações da Organização
        </h1>
        <p className="text-sm text-gray-500">
          Gerenciamento da empresa, identificadores e controle de membros
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-900">Dados Cadastrais</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="block text-xs text-gray-500 mb-1">Nome da Organização</span>
              <span className="text-sm font-semibold text-gray-900">
                {currentOrganization?.name}
              </span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 mb-1">Slug / Identificador</span>
              <code className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md">
                {currentOrganization?.slug}
              </code>
            </div>
          </div>

          <div className="pt-2">
            <span className="block text-xs text-gray-500 mb-1">Seu Papel nesta Organização</span>
            <Badge variant="info" className="gap-1">
              <ShieldCheck className="w-3 h-3" />
              {userRole === 'owner'
                ? 'Proprietário (Owner)'
                : userRole === 'admin'
                  ? 'Administrador'
                  : 'Membro Operacional'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-900">Membros da Organização</h2>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-gray-500">Carregando membros...</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {members.map((member) => (
                <div key={member.userId} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-900 block font-mono">
                        {member.userId.slice(0, 8)}...
                      </span>
                    </div>
                  </div>
                  <Badge variant={member.role === 'owner' ? 'success' : 'default'}>
                    {member.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
