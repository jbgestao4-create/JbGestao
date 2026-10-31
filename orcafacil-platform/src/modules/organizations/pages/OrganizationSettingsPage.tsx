import { useEffect, useState, type SyntheticEvent } from 'react'
import { useOrganization } from '../context/OrganizationContext'
import { organizationService } from '../services/organization.service'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { DASHBOARD_MODULES } from '@modules/access-control/services/module-access.service'
import { useAuth } from '@modules/auth/context/AuthContext'
import { Card, CardContent, CardHeader } from '@shared/components/ui/Card'
import { Badge } from '@shared/components/ui/Badge'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { ListBox } from '@shared/components/ui/ListBox'
import { ConfirmActionDialog } from '@shared/components/ConfirmActionDialog'
import {
  ShieldCheck,
  User,
  UserPlus,
  Trash2,
  Sliders,
  Pencil,
} from 'lucide-react'
import type {
  DashboardModuleCode,
  OrganizationMemberDetail,
  Organization,
  OrganizationRole,
  ServiceResult,
} from '@shared/types/common'

export function OrganizationSettingsPage() {
  const { currentOrganization, userRole, organizations, setCurrentOrganization } = useOrganization()
  const { user } = useAuth()
  const { refreshAccess } = useModuleAccess()
  const [members, setMembers] = useState<OrganizationMemberDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [manageableOrganizations, setManageableOrganizations] = useState<Organization[]>([])
  const [isLoadingManageableOrganizations, setIsLoadingManageableOrganizations] = useState(true)

  // Modal de cadastro de novo funcionário
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('')
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<OrganizationRole>('member')
  const [selectedDashboardModules, setSelectedDashboardModules] = useState<DashboardModuleCode[]>([])
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal de edição de permissões de membro existente
  const [editingMember, setEditingMember] = useState<OrganizationMemberDetail | null>(null)
  const [editDashboardModules, setEditDashboardModules] = useState<DashboardModuleCode[]>([])
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [memberToEdit, setMemberToEdit] = useState<OrganizationMemberDetail | null>(null)
  const [editMemberName, setEditMemberName] = useState('')
  const [editMemberJobTitle, setEditMemberJobTitle] = useState('')
  const [editMemberEmail, setEditMemberEmail] = useState('')
  const [editMemberRole, setEditMemberRole] = useState<OrganizationRole>('member')
  const [editMemberError, setEditMemberError] = useState('')
  const [isSavingMember, setIsSavingMember] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMemberDetail | null>(null)

  const canManageMembers = userRole === 'owner' || userRole === 'admin'
  useEffect(() => {
    let cancelled = false
    const userId = user?.id

    const loadManageableOrganizations = async () => {
      if (!userId || organizations.length === 0) {
        setManageableOrganizations([])
        setIsLoadingManageableOrganizations(false)
        return
      }

      setIsLoadingManageableOrganizations(true)
      const results = await Promise.all(
        organizations.map(async (organization) => ({
          organization,
          role: await organizationService.getUserRole(organization.id, userId),
        })),
      )

      if (!cancelled) {
        setManageableOrganizations(
          results
            .filter(({ role }) => role === 'owner' || role === 'admin')
            .map(({ organization }) => organization),
        )
        setIsLoadingManageableOrganizations(false)
      }
    }

    void loadManageableOrganizations()
    return () => {
      cancelled = true
    }
  }, [organizations, user?.id])

  const canEditModulePermissions = userRole === 'owner' || userRole === 'admin'
  const canEditOperationalMemberModules = userRole === 'owner' || userRole === 'admin'

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

  const handleToggleDashboardModule = (modCode: DashboardModuleCode) => {
    setSelectedDashboardModules((prev) =>
      prev.includes(modCode) ? prev.filter((code) => code !== modCode) : [...prev, modCode],
    )
  }

  const handleToggleEditModule = (modCode: DashboardModuleCode) => {
    setEditDashboardModules((prev) =>
      prev.includes(modCode) ? prev.filter((c) => c !== modCode) : [...prev, modCode],
    )
  }

  const handleOpenAddModal = () => {
    if (manageableOrganizations.length === 0) return

    const initialOrganizationId =
      manageableOrganizations.find((organization) => organization.id === currentOrganization?.id)
        ?.id ?? manageableOrganizations[0].id

    setName('')
    setJobTitle('')
    setEmail('')
    setPassword('')
    setRole('member')
    setSelectedOrganizationId(initialOrganizationId)
    setSelectedDashboardModules([])
    setFormError('')
    setIsAddModalOpen(true)
  }

  const handleAddMember = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const targetOrganization = manageableOrganizations.find(
      (organization) => organization.id === selectedOrganizationId,
    )
    if (!targetOrganization) {
      setFormError('Selecione uma organização que você administra.')
      return
    }

    if (!name.trim() || !email.trim()) {
      setFormError('Preencha nome e e-mail do funcionário.')
      return
    }

    if (password.trim().length < 8) {
      setFormError('A senha inicial deve ter pelo menos 8 caracteres.')
      return
    }

    if (
      role === 'member' &&
      canEditModulePermissions &&
      selectedDashboardModules.length === 0
    ) {
      setFormError('Selecione ao menos um módulo ativo da organização.')
      return
    }

    setIsSubmitting(true)
    setFormError('')

    const res = await organizationService.addMember({
      organizationId: targetOrganization.id,
      name,
      jobTitle: jobTitle.trim() || null,
      email,
      password,
      role,
      dashboardModules:
        canEditModulePermissions && role === 'member' ? selectedDashboardModules : [],
    })

    if (res.success) {
      setIsAddModalOpen(false)
      if (targetOrganization.id !== currentOrganization?.id) {
        setCurrentOrganization(targetOrganization)
      } else {
        await Promise.all([loadMembers(), refreshAccess()])
      }
    } else {
      setFormError(res.error)
    }

    setIsSubmitting(false)
  }

  const handleOpenEditModal = (member: OrganizationMemberDetail) => {
    if (!canEditOperationalMemberModules || member.role !== 'member') return
    setEditingMember(member)
    setEditDashboardModules(member.dashboardModules ?? [])
  }

  const handleSaveEditModules = async () => {
    if (
      !canEditOperationalMemberModules ||
      !currentOrganization ||
      !editingMember ||
      editingMember.role !== 'member'
    ) {
      return
    }
    setIsSavingEdit(true)

    const res = await organizationService.updateMemberDashboardModules(
      currentOrganization.id,
      editingMember.userId,
      editDashboardModules,
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

  const handleOpenEditMember = (member: OrganizationMemberDetail) => {
    if (!canManageMembers || member.role === 'owner') return
    setMemberToEdit(member)
    setEditMemberName(member.displayName)
    setEditMemberJobTitle(member.jobTitle ?? '')
    setEditMemberEmail(member.email)
    setEditMemberRole(member.role)
    setEditMemberError('')
  }

  const handleSaveMember = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!currentOrganization || !memberToEdit) return

    if (!editMemberName.trim() || !editMemberEmail.trim()) {
      setEditMemberError('Preencha o nome e o e-mail do funcionário.')
      return
    }

    setIsSavingMember(true)
    setEditMemberError('')

    const result = await organizationService.updateMemberDetails(currentOrganization.id, {
      userId: memberToEdit.userId,
      name: editMemberName,
      jobTitle: editMemberJobTitle,
      email: editMemberEmail,
      role: editMemberRole,
    })

    if (result.success) {
      setMemberToEdit(null)
      await Promise.all([loadMembers(), refreshAccess()])
    } else {
      setEditMemberError(result.error)
    }

    setIsSavingMember(false)
  }

  const handleRemoveMember = async (): Promise<ServiceResult<void>> => {
    if (!currentOrganization || !memberToRemove) {
      return { success: false, error: 'Não foi possível identificar o funcionário.' }
    }

    const res = await organizationService.removeMember(
      currentOrganization.id,
      memberToRemove.userId,
    )
    if (res.success) {
      setMemberToRemove(null)
      await loadMembers()
      await refreshAccess()
    }
    return res
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
            <Button
              size="sm"
              onClick={handleOpenAddModal}
              disabled={isLoadingManageableOrganizations || manageableOrganizations.length === 0}
              className="shrink-0 gap-1.5"
            >
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
                          <Badge variant={isOwner ? 'success' : isAdmin ? 'info' : 'default'}>
                            {isOwner
                              ? 'Proprietário'
                              : isAdmin
                                ? 'Administrador'
                                : 'Membro Operacional'}
                          </Badge>
                        </div>
                        <span className="text-xs text-gray-500 block">{member.email}</span>
                        {member.jobTitle && (
                          <span className="text-xs text-gray-600 block">
                            Cargo: {member.jobTitle}
                          </span>
                        )}

                        {/* MÓDULOS PERMITIDOS */}
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-medium text-gray-400 mr-1">
                            Acesso a módulos:
                          </span>
                          {isOwner || isAdmin ? (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              Acesso Total aos Módulos
                            </span>
                          ) : member.dashboardModules && member.dashboardModules.length > 0 ? (
                            member.dashboardModules.map((mCode) => (
                              <span
                                key={mCode}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200"
                              >
                                <span>{mCode}</span>
                                <span>
                                  {DASHBOARD_MODULES.find((module) => module.code === mCode)?.name}
                                </span>
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
                        {canEditOperationalMemberModules && member.role === 'member' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditModal(member)}
                            className="text-xs gap-1"
                          >
                            <Sliders className="w-3.5 h-3.5 text-gray-500" />
                            Permissões de Módulos
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditMember(member)}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"
                          title="Editar funcionário"
                          aria-label={`Editar ${member.displayName || member.email}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>

                        <button
                          type="button"
                          onClick={() => setMemberToRemove(member)}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          title="Remover Funcionário"
                          aria-label={`Remover ${member.displayName || member.email}`}
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
              Selecione a organização e os módulos ativos aos quais o funcionário terá acesso.
            </p>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {formError}
              </div>
            )}

            <form
              onSubmit={(e) => void handleAddMember(e)}
              className="space-y-4"
              autoComplete="off"
            >
              <div>
                <ListBox
                  id="employee-organization"
                  label="Organização"
                  placeholder={
                    isLoadingManageableOrganizations
                      ? 'Carregando...'
                      : manageableOrganizations.length === 0
                        ? 'Nenhuma organização disponível'
                        : 'Selecione uma organização...'
                  }
                  searchPlaceholder="Buscar organização..."
                  value={selectedOrganizationId}
                  onChange={(val) => {
                    setSelectedOrganizationId(val as string)
                    setSelectedDashboardModules([])
                    setFormError('')
                  }}
                  disabled={
                    isLoadingManageableOrganizations || manageableOrganizations.length === 0
                  }
                  options={manageableOrganizations.map((o) => ({
                    value: o.id,
                    label: o.name,
                  }))}
                  helperText="O funcionário será vinculado à organização selecionada."
                />
              </div>
              <Input
                label="Nome Completo *"
                name="new-employee-name"
                placeholder="Ex: Carlos Eduardo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                required
              />

              <Input
                label="Cargo na Empresa"
                name="new-employee-job-title"
                placeholder="Ex: Vendedor"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                autoComplete="off"
                maxLength={100}
              />

              <Input
                label="E-mail de Acesso *"
                name="new-employee-email"
                type="email"
                placeholder="carlos@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                required
              />

              <Input
                label="Senha Inicial de Acesso *"
                name="new-employee-password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                helperText="A senha deve ter pelo menos 8 caracteres. O funcionário utilizará este e-mail e senha para entrar na plataforma."
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

              {role === 'member' && canEditModulePermissions ? (
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Permissões de Módulos
                  </label>
                  <p className="text-[11px] text-gray-500 mb-3">
                    Marque os módulos que este funcionário poderá visualizar e operar:
                  </p>

                  <div className="space-y-2.5">
                    {DASHBOARD_MODULES.map((mod) => {
                      const isSelected = selectedDashboardModules.includes(mod.code)

                      return (
                        <label
                          key={mod.code}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50/40'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-blue-600 text-[10px] font-bold shadow-xs">
                              {mod.code}
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
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleDashboardModule(mod.code)}
                            aria-label={`Acesso ao módulo ${mod.name}`}
                            className="h-5 w-5 shrink-0 accent-blue-600"
                          />
                        </label>
                      )
                    })}
                  </div>
                </div>
              ) : role === 'member' ? (
                <p className="text-xs text-gray-500">
                  Não é possível definir permissões de módulos para este funcionário.
                </p>
              ) : null}

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  disabled={
                    isSubmitting ||
                    isLoadingManageableOrganizations ||
                    (role === 'member' &&
                      canEditModulePermissions &&
                      selectedDashboardModules.length === 0)
                  }
                >
                  Cadastrar Funcionário
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR FUNCIONÁRIO */}
      {memberToEdit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Editar Funcionário</h3>
            <p className="text-xs text-gray-500 mb-5">
              Atualize os dados e o papel de {memberToEdit.displayName}.
            </p>

            {editMemberError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {editMemberError}
              </div>
            )}

            <form onSubmit={(e) => void handleSaveMember(e)} className="space-y-4">
              <Input
                label="Nome Completo *"
                name="edit-employee-name"
                value={editMemberName}
                onChange={(e) => setEditMemberName(e.target.value)}
                maxLength={100}
                required
              />
              <Input
                label="Cargo na Empresa"
                name="edit-employee-job-title"
                value={editMemberJobTitle}
                onChange={(e) => setEditMemberJobTitle(e.target.value)}
                maxLength={100}
              />
              <Input
                label="E-mail de Acesso *"
                name="edit-employee-email"
                type="email"
                value={editMemberEmail}
                onChange={(e) => setEditMemberEmail(e.target.value)}
                required
                helperText="O novo e-mail será usado imediatamente para entrar na plataforma."
              />
              <div>
                <ListBox
                  id="edit-employee-role"
                  label="Papel na Organização"
                  searchable={false}
                  value={editMemberRole}
                  onChange={(val) => setEditMemberRole(val as OrganizationRole)}
                  options={[
                    { value: 'member', label: 'Membro Operacional' },
                    { value: 'admin', label: 'Administrador' },
                  ]}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMemberToEdit(null)}
                  disabled={isSavingMember}
                >
                  Cancelar
                </Button>
                <Button type="submit" isLoading={isSavingMember} disabled={isSavingMember}>
                  Salvar Alterações
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
            <h3 className="text-lg font-bold text-gray-900 mb-1">Editar Acesso aos Módulos</h3>
            <p className="text-xs text-gray-500 mb-4">
              Funcionário: <strong>{editingMember.displayName}</strong> ({editingMember.email})
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Módulos desmarcados ficam ocultos na página inicial e não podem ser acessados pelo
              funcionário.
            </p>

            <div className="space-y-2.5 mb-6">
              {DASHBOARD_MODULES.map((mod) => {
                const isSelected = editDashboardModules.includes(mod.code)

                return (
                  <label
                    key={mod.code}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/40'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-blue-600 text-[10px] font-bold shadow-xs">
                        {mod.code}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-gray-900 block">{mod.name}</span>
                        <span className="text-[11px] text-gray-500 block leading-tight">
                          {mod.description}
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleEditModule(mod.code)}
                      aria-label={`Acesso ao módulo ${mod.name}`}
                      className="h-5 w-5 shrink-0 accent-blue-600"
                    />
                  </label>
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
      <ConfirmActionDialog
        open={memberToRemove !== null}
        title="Remover funcionário?"
        description={`Tem certeza de que deseja remover ${memberToRemove?.displayName || memberToRemove?.email || 'este funcionário'} da organização?`}
        confirmLabel="Sim, remover"
        onCancel={() => setMemberToRemove(null)}
        onConfirm={handleRemoveMember}
      />
    </div>
  )
}
