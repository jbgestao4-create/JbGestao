import { useEffect, useState } from 'react'
import { useOrganization } from '../context/OrganizationContext'
import { organizationService } from '../services/organization.service'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { Card, CardContent, CardHeader } from '@shared/components/ui/Card'
import { Badge } from '@shared/components/ui/Badge'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import {
  ShieldCheck,
  User,
  UserPlus,
  Trash2,
  Sliders,
  CheckCircle2,
  FileSpreadsheet,
  Calendar,
  Package,
} from 'lucide-react'
import type {
  ModuleCode,
  OrganizationMemberDetail,
  OrganizationRole,
} from '@shared/types/common'

export function OrganizationSettingsPage() {
  const { currentOrganization, userRole } = useOrganization()
  const { allModules, refreshAccess } = useModuleAccess()
  const [members, setMembers] = useState<OrganizationMemberDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Modal de cadastro de novo funcionário
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<OrganizationRole>('member')
  const [selectedModules, setSelectedModules] = useState<ModuleCode[]>(['orcafacil'])
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal de edição de permissões de membro existente
  const [editingMember, setEditingMember] = useState<OrganizationMemberDetail | null>(null)
  const [editModules, setEditModules] = useState<ModuleCode[]>([])
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const canManageMembers = userRole === 'owner' || userRole === 'admin'

  const loadMembers = async () => {
    if (!currentOrganization) return
    setIsLoading(true)
    const res = await organizationService.getMembersWithDetails(currentOrganization.id)
    if (res.success) {
      setMembers(res.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    void loadMembers()
  }, [currentOrganization])

  const handleToggleModule = (modCode: ModuleCode) => {
    setSelectedModules((prev) =>
      prev.includes(modCode) ? prev.filter((c) => c !== modCode) : [...prev, modCode],
    )
  }

  const handleToggleEditModule = (modCode: ModuleCode) => {
    setEditModules((prev) =>
      prev.includes(modCode) ? prev.filter((c) => c !== modCode) : [...prev, modCode],
    )
  }

  const handleOpenAddModal = () => {
    setName('')
    setEmail('')
    setPassword('')
    setRole('member')
    setSelectedModules(['orcafacil'])
    setFormError('')
    setIsAddModalOpen(true)
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrganization) return

    if (!name.trim() || !email.trim()) {
      setFormError('Preencha nome e e-mail do funcionário.')
      return
    }

    if (password.trim().length < 6) {
      setFormError('A senha inicial deve ter pelo menos 6 caracteres.')
      return
    }

    setIsSubmitting(true)
    setFormError('')

    const res = await organizationService.addMember({
      organizationId: currentOrganization.id,
      name,
      email,
      password,
      role,
      modules: selectedModules,
    })

    if (res.success) {
      setIsAddModalOpen(false)
      await loadMembers()
      await refreshAccess()
    } else {
      setFormError(res.error)
    }

    setIsSubmitting(false)
  }

  const handleOpenEditModal = (member: OrganizationMemberDetail) => {
    setEditingMember(member)
    setEditModules(member.modules ?? [])
  }

  const handleSaveEditModules = async () => {
    if (!currentOrganization || !editingMember) return
    setIsSavingEdit(true)

    const res = await organizationService.updateMemberModules(
      currentOrganization.id,
      editingMember.userId,
      editModules,
    )

    if (res.success) {
      setEditingMember(null)
      await loadMembers()
      await refreshAccess()
    } else {
      alert(res.error)
    }

    setIsSavingEdit(false)
  }

  const handleRemoveMember = async (member: OrganizationMemberDetail) => {
    if (!currentOrganization) return
    if (member.role === 'owner') {
      alert('O proprietário da organização não pode ser removido.')
      return
    }

    const confirmMsg = `Deseja realmente remover o funcionário ${member.displayName || member.email} da organização?`
    if (!window.confirm(confirmMsg)) return

    const res = await organizationService.removeMember(currentOrganization.id, member.userId)
    if (res.success) {
      await loadMembers()
      await refreshAccess()
    } else {
      alert(res.error)
    }
  }

  const getModuleIcon = (code: ModuleCode) => {
    switch (code) {
      case 'orcafacil':
        return <FileSpreadsheet className="w-3.5 h-3.5" />
      case 'agendapro':
        return <Calendar className="w-3.5 h-3.5" />
      case 'estoqueleve':
        return <Package className="w-3.5 h-3.5" />
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Configurações da Organização
        </h1>
        <p className="text-sm text-gray-500">
          Gerenciamento da empresa, controle de funcionários e permissões de acesso
        </p>
      </div>

      {/* DADOS DA ORGANIZAÇÃO */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-900">Dados da Empresa</h2>
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
            <span className="block text-xs text-gray-500 mb-1">Seu Papel</span>
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

      {/* GESTÃO DE MEMBROS E FUNCIONÁRIOS */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Membros e Funcionários</h2>
            <p className="text-xs text-gray-500">
              Controle quem tem acesso à organização e quais módulos cada funcionário pode utilizar
            </p>
          </div>

          {canManageMembers && (
            <Button size="sm" onClick={handleOpenAddModal} className="shrink-0 gap-1.5">
              <UserPlus className="w-4 h-4" /> Cadastrar Funcionário
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-gray-500">Carregando membros...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              <User className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              Nenhum membro cadastrado.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {members.map((member) => {
                const isOwner = member.role === 'owner'
                const isAdmin = member.role === 'admin'

                return (
                  <div
                    key={member.userId}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors"
                  >
                    {/* INFORMAÇÕES DO FUNCIONÁRIO */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {member.displayName?.slice(0, 2).toUpperCase() || 'FU'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">
                            {member.displayName}
                          </span>
                          <Badge
                            variant={
                              isOwner ? 'success' : isAdmin ? 'info' : 'default'
                            }
                          >
                            {isOwner
                              ? 'Proprietário'
                              : isAdmin
                                ? 'Administrador'
                                : 'Membro Operacional'}
                          </Badge>
                        </div>
                        <span className="text-xs text-gray-500 block">{member.email}</span>

                        {/* MÓDULOS PERMITIDOS */}
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-medium text-gray-400 mr-1">
                            Acesso a módulos:
                          </span>
                          {isOwner || isAdmin ? (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              Acesso Total aos Módulos
                            </span>
                          ) : member.modules && member.modules.length > 0 ? (
                            member.modules.map((mCode) => (
                              <span
                                key={mCode}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200"
                              >
                                {getModuleIcon(mCode)}
                                {mCode === 'orcafacil'
                                  ? 'OrçaFácil'
                                  : mCode === 'agendapro'
                                    ? 'AgendaPro'
                                    : 'EstoqueLeve'}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-gray-400 italic">
                              Nenhum módulo liberado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* AÇÕES DE GESTÃO */}
                    {canManageMembers && !isOwner && (
                      <div className="flex items-center gap-2 self-end md:self-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditModal(member)}
                          className="text-xs gap-1"
                        >
                          <Sliders className="w-3.5 h-3.5 text-gray-500" />
                          Permissões de Módulos
                        </Button>

                        <button
                          onClick={() => void handleRemoveMember(member)}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          title="Remover Funcionário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL CADASTRAR FUNCIONÁRIO */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Cadastrar Novo Funcionário</h3>
            </div>
            <p className="text-xs text-gray-500 mb-5">
              Crie o acesso do funcionário e escolha exatamente a quais módulos da plataforma ele
              terá permissão.
            </p>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={(e) => void handleAddMember(e)} className="space-y-4">
              <Input
                label="Nome Completo *"
                placeholder="Ex: Carlos Eduardo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <Input
                label="E-mail de Acesso *"
                type="email"
                placeholder="carlos@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                label="Senha Inicial de Acesso *"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                helperText="O funcionário utilizará este e-mail e senha para logar na plataforma."
                required
              />

              {/* SELEÇÃO DO PAPEL */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Papel na Organização
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      role === 'member'
                        ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="member"
                      checked={role === 'member'}
                      onChange={() => setRole('member')}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="block text-xs font-bold text-gray-900">
                        Membro Operacional
                      </span>
                      <span className="text-[11px] text-gray-500 leading-tight block">
                        Acesso estrito apenas aos módulos liberados abaixo.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      role === 'admin'
                        ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      checked={role === 'admin'}
                      onChange={() => setRole('admin')}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="block text-xs font-bold text-gray-900">Administrador</span>
                      <span className="text-[11px] text-gray-500 leading-tight block">
                        Acesso total aos módulos e gestão da equipe.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* SELEÇÃO DE MÓDULOS */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Permissões de Módulos (Entitlements)
                </label>
                <p className="text-[11px] text-gray-500 mb-3">
                  Marque os módulos que este usuário poderá visualizar e operar:
                </p>

                <div className="space-y-2.5">
                  {allModules.map((mod) => {
                    const isSelected = selectedModules.includes(mod.code)

                    return (
                      <div
                        key={mod.code}
                        onClick={() => handleToggleModule(mod.code)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/40'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-blue-600 shadow-xs">
                            {getModuleIcon(mod.code)}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-gray-900 block">
                              {mod.name}
                            </span>
                            <span className="text-[11px] text-gray-500 block leading-tight">
                              {mod.description}
                            </span>
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-4 h-4" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  Cadastrar Funcionário
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR PERMISSÕES DE MÓDULOS */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Editar Acesso aos Módulos
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Funcionário: <strong>{editingMember.displayName}</strong> ({editingMember.email})
            </p>

            <div className="space-y-2.5 mb-6">
              {allModules.map((mod) => {
                const isSelected = editModules.includes(mod.code)

                return (
                  <div
                    key={mod.code}
                    onClick={() => handleToggleEditModule(mod.code)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/40'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-blue-600 shadow-xs">
                        {getModuleIcon(mod.code)}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-gray-900 block">{mod.name}</span>
                        <span className="text-[11px] text-gray-500 block leading-tight">
                          {mod.description}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-4 h-4" />}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingMember(null)}
                disabled={isSavingEdit}
              >
                Cancelar
              </Button>
              <Button onClick={() => void handleSaveEditModules()} isLoading={isSavingEdit}>
                Salvar Permissões
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
