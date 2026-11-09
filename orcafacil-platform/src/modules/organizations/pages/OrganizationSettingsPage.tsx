import { useEffect, useMemo, useState, type SyntheticEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useOrganization } from '../context/OrganizationContext'
import { organizationService } from '../services/organization.service'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { DASHBOARD_MODULES } from '@modules/access-control/services/module-access.service'
import { companyManagementService } from '@modules/companies/services/company-management.service'
import { useAuth } from '@modules/auth/context/AuthContext'
import { isSystemOwner } from '@shared/utils/system-owner'
import { Card, CardContent, CardHeader } from '@shared/components/ui/Card'
import { Badge } from '@shared/components/ui/Badge'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { ListBox } from '@shared/components/ui/ListBox'
import { ConfirmActionDialog } from '@shared/components/ConfirmActionDialog'
import { SystemCustomizationSection } from '../components/SystemCustomizationSection'
import {
  formatScreenTime,
  formatLastAccess,
  screenTimeService,
} from '@shared/services/screen-time.service'
import {
  ShieldCheck,
  User,
  UserPlus,
  KeyRound,
  Trash2,
  Sliders,
  Pencil,
  CheckSquare,
  Square,
  Building2,
  Palette,
  Clock,
  Calendar,
} from 'lucide-react'
import type {
  DashboardModuleCode,
  InventoryAccessLevel,
  OrganizationMemberDetail,
  Organization,
  OrganizationRole,
  ServiceResult,
  UUID,
} from '@shared/types/common'

function InventoryLevelSelector({
  value,
  onChange,
  namePrefix,
}: {
  value: InventoryAccessLevel
  onChange: (level: InventoryAccessLevel) => void
  namePrefix: string
}) {
  return (
    <div className="px-3 pb-3 pt-1 border-t border-blue-200/60 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-900">
          Qual nível de acesso ao Estoque?
        </span>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
          Nível {value}
        </span>
      </div>

      <div className="space-y-1.5">
        <label
          className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition ${
            value === 1
              ? 'border-blue-600 bg-white ring-1 ring-blue-600 shadow-xs'
              : 'border-gray-200 bg-white/70 hover:bg-white'
          }`}
        >
          <input
            type="radio"
            name={`${namePrefix}-inventory-level`}
            value={1}
            checked={value === 1}
            onChange={() => onChange(1)}
            className="mt-0.5 accent-blue-600"
          />
          <div>
            <span className="text-xs font-bold text-gray-900 block">
              Nível 1 — Apenas Consulta
            </span>
            <span className="text-[11px] text-gray-500 block leading-tight">
              Consultar Estoque apenas, não podendo editar nem cadastrar produtos.
            </span>
          </div>
        </label>

        <label
          className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition ${
            value === 2
              ? 'border-blue-600 bg-white ring-1 ring-blue-600 shadow-xs'
              : 'border-gray-200 bg-white/70 hover:bg-white'
          }`}
        >
          <input
            type="radio"
            name={`${namePrefix}-inventory-level`}
            value={2}
            checked={value === 2}
            onChange={() => onChange(2)}
            className="mt-0.5 accent-blue-600"
          />
          <div>
            <span className="text-xs font-bold text-gray-900 block">
              Nível 2 — Consulta e Cadastro
            </span>
            <span className="text-[11px] text-gray-500 block leading-tight">
              Consulta e cadastro de estoque, não podendo editar produtos existentes, apenas cadastrar novos produtos.
            </span>
          </div>
        </label>

        <label
          className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition ${
            value === 3
              ? 'border-blue-600 bg-white ring-1 ring-blue-600 shadow-xs'
              : 'border-gray-200 bg-white/70 hover:bg-white'
          }`}
        >
          <input
            type="radio"
            name={`${namePrefix}-inventory-level`}
            value={3}
            checked={value === 3}
            onChange={() => onChange(3)}
            className="mt-0.5 accent-blue-600"
          />
          <div>
            <span className="text-xs font-bold text-gray-900 block">
              Nível 3 — Acesso Geral ao Estoque
            </span>
            <span className="text-[11px] text-gray-500 block leading-tight">
              Acesso total ao estoque (consulta, cadastro, edição completa, desativação e movimentações).
            </span>
          </div>
        </label>
      </div>
    </div>
  )
}

export function OrganizationSettingsPage() {
  const { currentOrganization, userRole, organizations, setCurrentOrganization } = useOrganization()
  const { user, profile } = useAuth()
  const { refreshAccess, orgAllowedDashboardModules, canAccessDashboardModule } = useModuleAccess()
  const isDeveloper = isSystemOwner(user)
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab =
    searchParams.get('tab') === 'customization' || searchParams.get('tab') === 'personalizacao'
      ? 'customization'
      : 'general'
  const [activeTab, setActiveTab] = useState<'general' | 'customization'>(initialTab)

  const handleTabChange = (tab: 'general' | 'customization') => {
    setActiveTab(tab)
    setSearchParams(tab === 'customization' ? { tab: 'customization' } : {})
  }

  const [members, setMembers] = useState<OrganizationMemberDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [manageableOrganizations, setManageableOrganizations] = useState<Organization[]>([])
  const [isLoadingManageableOrganizations, setIsLoadingManageableOrganizations] = useState(true)
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('')
  const [livePendingSeconds, setLivePendingSeconds] = useState<Record<string, number>>({})

  useEffect(() => {
    const handleTick = (event: Event) => {
      const customEvent = event as CustomEvent<{ userId: string; pendingSeconds: number }>
      if (customEvent.detail?.userId) {
        setLivePendingSeconds((prev) => ({
          ...prev,
          [customEvent.detail.userId]: customEvent.detail.pendingSeconds,
        }))
      }
    }

    window.addEventListener('screen-time-tick', handleTick)
    return () => {
      window.removeEventListener('screen-time-tick', handleTick)
    }
  }, [])

  // Módulos liberados para a empresa ativa ou selecionada
  const [selectedOrgModules, setSelectedOrgModules] = useState<DashboardModuleCode[]>([])

  useEffect(() => {
    const orgId = selectedOrganizationId || currentOrganization?.id
    if (!orgId) return
    let isCurrent = true
    void companyManagementService.getCompanyModules(orgId).then((modules) => {
      if (isCurrent) {
        setSelectedOrgModules(modules)
      }
    })
    return () => {
      isCurrent = false
    }
  }, [selectedOrganizationId, currentOrganization?.id])

  // Lista dos módulos liberados estritamente para a empresa pelo Proprietário
  const companyModules = useMemo(() => {
    const allowed =
      selectedOrgModules.length > 0
        ? selectedOrgModules
        : orgAllowedDashboardModules.length > 0
          ? orgAllowedDashboardModules
          : []

    if (allowed.length > 0) {
      return DASHBOARD_MODULES.filter((mod) => allowed.includes(mod.code))
    }

    if (!isSystemOwner(user)) {
      return DASHBOARD_MODULES.filter((mod) => canAccessDashboardModule(mod.code))
    }

    return DASHBOARD_MODULES
  }, [selectedOrgModules, orgAllowedDashboardModules, user, canAccessDashboardModule])

  // Modal de cadastro de novo funcionário
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<OrganizationRole>('member')
  const [selectedDashboardModules, setSelectedDashboardModules] = useState<DashboardModuleCode[]>([])
  const [addInventoryLevel, setAddInventoryLevel] = useState<InventoryAccessLevel>(3)
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal de edição de permissões de membro existente
  const [editingMember, setEditingMember] = useState<OrganizationMemberDetail | null>(null)
  const [editDashboardModules, setEditDashboardModules] = useState<DashboardModuleCode[]>([])
  const [editInventoryLevel, setEditInventoryLevel] = useState<InventoryAccessLevel>(3)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [memberToEdit, setMemberToEdit] = useState<OrganizationMemberDetail | null>(null)
  const [editMemberName, setEditMemberName] = useState('')
  const [editMemberJobTitle, setEditMemberJobTitle] = useState('')
  const [editMemberEmail, setEditMemberEmail] = useState('')
  const [editMemberRole, setEditMemberRole] = useState<OrganizationRole>('member')
  const [editMemberError, setEditMemberError] = useState('')
  const [isSavingMember, setIsSavingMember] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMemberDetail | null>(null)
  const [memberToResetPassword, setMemberToResetPassword] =
    useState<OrganizationMemberDetail | null>(null)
  const [memberPasswordResetMessage, setMemberPasswordResetMessage] = useState('')

  const canManageMembers = userRole === 'owner' || userRole === 'admin' || isSystemOwner(user)
  const canResetMemberPassword = userRole === 'admin'

  const effectiveManageableOrgs = useMemo(() => {
    if (manageableOrganizations.length > 0) return manageableOrganizations
    if (currentOrganization && canManageMembers) return [currentOrganization]
    if (organizations.length > 0 && canManageMembers) return organizations
    return []
  }, [manageableOrganizations, currentOrganization, organizations, canManageMembers])

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

  const canEditModulePermissions = userRole === 'owner' || userRole === 'admin' || isSystemOwner(user)
  const canEditOperationalMemberModules = userRole === 'owner' || userRole === 'admin' || isSystemOwner(user)

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

  // Atualiza periodicamente as métricas de tempo de tela e último acesso quando visualizado pelo desenvolvedor
  useEffect(() => {
    if (!isDeveloper || !currentOrganization) return

    const intervalId = window.setInterval(() => {
      void organizationService.getMembersWithDetails(currentOrganization.id).then((res) => {
        if (res.success) {
          setMembers(res.data)
        }
      })
    }, 15000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isDeveloper, currentOrganization?.id])

  // Lista dos membros e funcionários visíveis para gestão e métricas de tempo de tela
  const visibleMembers = useMemo(() => {
    const list = members.filter((member) => {
      // Oculta contas de outros superadmins que não sejam a do próprio usuário logado
      if (isSystemOwner(member.email) && member.userId !== user?.id) {
        return false
      }
      return true
    })

    // Se o desenvolvedor logado não estiver na lista de membros (isolamento da migration 00066),
    // inclui o próprio desenvolvedor para visualização e monitoramento de tempo de tela
    if (isDeveloper && user && !list.some((m) => m.userId === user.id)) {
      const local = screenTimeService.getLocalActivity(user.id)
      list.unshift({
        userId: user.id,
        organizationId: currentOrganization?.id || '',
        role: 'owner',
        displayName: profile?.displayName || user.email?.split('@')[0] || 'Desenvolvedor',
        email: user.email || '',
        jobTitle: 'Desenvolvedor do Sistema',
        modules: [],
        dashboardModules: [],
        createdAt: new Date().toISOString(),
        screenTimeSeconds: local?.screenTimeSeconds ?? 0,
        lastAccessAt: local?.lastAccessAt ?? new Date().toISOString(),
      })
    }

    return list
  }, [members, user, profile, isDeveloper, currentOrganization?.id])

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

  const isAllAddModulesSelected =
    companyModules.length > 0 &&
    companyModules.every((mod) => selectedDashboardModules.includes(mod.code))

  const handleToggleSelectAllAddModules = () => {
    if (isAllAddModulesSelected) {
      setSelectedDashboardModules([])
    } else {
      setSelectedDashboardModules(companyModules.map((m) => m.code))
    }
  }

  const isAllEditModulesSelected =
    companyModules.length > 0 &&
    companyModules.every((mod) => editDashboardModules.includes(mod.code))

  const handleToggleSelectAllEditModules = () => {
    if (isAllEditModulesSelected) {
      setEditDashboardModules([])
    } else {
      setEditDashboardModules(companyModules.map((m) => m.code))
    }
  }

  const handleOpenAddModal = () => {
    const orgs = effectiveManageableOrgs
    if (orgs.length === 0) return

    const initialOrganizationId =
      orgs.find((organization) => organization.id === currentOrganization?.id)?.id ?? orgs[0].id

    void companyManagementService.getCompanyModules(initialOrganizationId).then(setSelectedOrgModules)

    setName('')
    setJobTitle('')
    setEmail('')
    setPassword('')
    setRole('member')
    setSelectedOrganizationId(initialOrganizationId)
    setSelectedDashboardModules([])
    setAddInventoryLevel(3)
    setFormError('')
    setIsAddModalOpen(true)
  }

  const handleAddMember = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const targetOrganization =
      effectiveManageableOrgs.find((organization) => organization.id === selectedOrganizationId) ||
      (currentOrganization?.id === selectedOrganizationId ? currentOrganization : null)
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
      inventoryAccessLevel: selectedDashboardModules.includes('MOD-02') ? addInventoryLevel : 3,
    })

    if (res.success) {
      setIsAddModalOpen(false)

      // Atualização otimista imediata na interface
      const newMember: OrganizationMemberDetail = {
        userId: ((res.data as any)?.userId || `member-${Date.now()}`) as UUID,
        organizationId: targetOrganization.id,
        role: 'member',
        displayName: name.trim(),
        email: email.trim().toLowerCase(),
        jobTitle: jobTitle.trim() || null,
        modules: [],
        dashboardModules: selectedDashboardModules,
        inventoryAccessLevel: selectedDashboardModules.includes('MOD-02') ? addInventoryLevel : 3,
        createdAt: new Date().toISOString(),
      }
      setMembers((prev) => {
        const filtered = prev.filter(
          (m) => m.email.toLowerCase() !== newMember.email.toLowerCase(),
        )
        return [...filtered, newMember]
      })

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
    if (currentOrganization?.id) {
      void companyManagementService.getCompanyModules(currentOrganization.id).then(setSelectedOrgModules)
    }
    setEditingMember(member)
    setEditDashboardModules(member.dashboardModules ?? [])
    setEditInventoryLevel(member.inventoryAccessLevel ?? 3)
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
      editDashboardModules.includes('MOD-02') ? editInventoryLevel : 3,
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

  const handleResetMemberPassword = async (): Promise<ServiceResult<void>> => {
    if (!currentOrganization || !memberToResetPassword) {
      return { success: false, error: 'Não foi possível identificar o membro.' }
    }

    const res = await organizationService.resetMemberPassword(
      currentOrganization.id,
      memberToResetPassword.userId,
    )

    if (res.success) {
      setMemberPasswordResetMessage(
        `Senha de ${memberToResetPassword.displayName || memberToResetPassword.email} redefinida para 12345678. No próximo acesso, será obrigatório criar uma nova senha.`,
      )
      setMemberToResetPassword(null)
    }

    return res
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Configurações da Organização
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Gerenciamento da empresa, controle de funcionários, permissões e personalização visual
        </p>
      </div>

      {/* OPÇÕES DO MÓDULO ORGANIZADOR */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => handleTabChange('general')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'general'
              ? 'bg-white dark:bg-slate-800 text-[var(--theme-primary,#2563eb)] shadow-xs border border-gray-200 dark:border-slate-700'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Dados e Funcionários
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('customization')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'customization'
              ? 'bg-white dark:bg-slate-800 text-[var(--theme-primary,#2563eb)] shadow-xs border border-gray-200 dark:border-slate-700'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Palette className="w-4 h-4" />
          Personalização do Sistema
        </button>
      </div>

      {activeTab === 'customization' ? (
        <SystemCustomizationSection />
      ) : (
        <>
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
              disabled={effectiveManageableOrgs.length === 0}
              className="shrink-0 gap-1.5"
            >
              <UserPlus className="w-4 h-4" /> Cadastrar Funcionário
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {memberPasswordResetMessage && (
            <div
              role="status"
              className="m-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
            >
              {memberPasswordResetMessage}
              <button
                type="button"
                onClick={() => setMemberPasswordResetMessage('')}
                className="ml-2 font-semibold underline"
              >
                Dispensar
              </button>
            </div>
          )}
          {isLoading ? (
            <div className="p-8 text-center text-sm text-gray-500">Carregando membros...</div>
          ) : visibleMembers.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              <User className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              Nenhum membro ou funcionário cadastrado.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {visibleMembers.map((member) => {
                const isOwner = member.role === 'owner'
                const isAdmin = member.role === 'admin'
                const isCurrentUser =
                  member.userId === user?.id ||
                  (!!user?.email && member.email?.toLowerCase() === user?.email?.toLowerCase())

                return (
                  <div
                    key={member.userId}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors"
                  >
                    {/* INFORMAÇÕES DO FUNCIONÁRIO */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {member.displayName?.slice(0, 2).toUpperCase() || 'FU'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
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
                          {isCurrentUser && (
                            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              Você
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 block truncate">{member.email}</span>
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
                                {mCode === 'MOD-02' && (
                                  <span className="rounded bg-blue-200/90 px-1 py-0.2 text-[9px] font-bold text-blue-900">
                                    Nível {member.inventoryAccessLevel ?? 3}
                                  </span>
                                )}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-gray-400 italic">
                              Nenhum módulo liberado
                            </span>
                          )}
                        </div>

                        {/* PAINEL DE ATIVIDADE DO USUÁRIO (EXCLUSIVO PERFIL DESENVOLVEDOR) */}
                        {isDeveloper && (() => {
                          const localAct = screenTimeService.getLocalActivity(member.userId)
                          const baseSec = Math.max(member.screenTimeSeconds ?? 0, localAct?.screenTimeSeconds ?? 0)
                          const totalScreenSeconds = baseSec + (livePendingSeconds[member.userId] ?? 0)
                          const lastAccessDisplay = localAct?.lastAccessAt || member.lastAccessAt

                          return (
                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-indigo-200/90 bg-indigo-50/60 dark:border-indigo-900/60 dark:bg-indigo-950/40 px-3.5 py-2 text-xs">
                              <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200">
                                <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <span className="font-medium text-slate-700 dark:text-slate-300">Tempo de tela total:</span>
                                <span className="font-mono font-bold text-sm text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 shadow-2xs">
                                  {formatScreenTime(totalScreenSeconds)}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                <Calendar className="w-4 h-4 text-indigo-500/80 dark:text-indigo-400 shrink-0" />
                                <span className="font-medium">Último acesso:</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {formatLastAccess(lastAccessDisplay)}
                                </span>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>

                    {/* AÇÕES DE GESTÃO */}
                    {canManageMembers && !isOwner && !isCurrentUser && (
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        {canResetMemberPassword && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMemberToResetPassword(member)}
                            className="h-8 text-xs gap-1.5 whitespace-nowrap text-amber-700 hover:text-amber-800 hover:border-amber-300"
                            title={`Redefinir senha de ${member.displayName || member.email}`}
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            Redefinir senha
                          </Button>
                        )}
                        {canEditOperationalMemberModules && member.role === 'member' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditModal(member)}
                            className="h-8 text-xs gap-1.5 whitespace-nowrap text-gray-700 hover:text-blue-600 hover:border-blue-300"
                          >
                            <Sliders className="w-3.5 h-3.5 text-gray-500" />
                            Permissões de Módulos
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditMember(member)}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:border-blue-300"
                          title="Editar funcionário"
                          aria-label={`Editar ${member.displayName || member.email}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMemberToRemove(member)}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50"
                          title="Remover funcionário"
                          aria-label={`Remover ${member.displayName || member.email}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </>
      )}

      {/* MODAL CADASTRAR FUNCIONÁRIO */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-xs">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
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
                    isLoadingManageableOrganizations && effectiveManageableOrgs.length === 0
                      ? 'Carregando...'
                      : effectiveManageableOrgs.length === 0
                        ? 'Nenhuma organização disponível'
                        : 'Selecione uma organização...'
                  }
                  searchPlaceholder="Buscar organização..."
                  value={selectedOrganizationId}
                  onChange={(val) => {
                    const nextOrgId = val as string
                    setSelectedOrganizationId(nextOrgId)
                    void companyManagementService.getCompanyModules(nextOrgId).then(setSelectedOrgModules)
                    setSelectedDashboardModules([])
                    setAddInventoryLevel(3)
                    setFormError('')
                  }}
                  disabled={effectiveManageableOrgs.length <= 1}
                  options={effectiveManageableOrgs.map((o) => ({
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

              {canEditModulePermissions ? (
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Permissões de Módulos do Funcionário
                  </label>
                  <p className="text-[11px] text-gray-500 mb-3">
                    Marque os módulos que este funcionário poderá visualizar e operar:
                  </p>

                  <div className="space-y-2.5">
                    {companyModules.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-xs text-gray-500">
                        Nenhum módulo ativo foi liberado para esta empresa pelo Proprietário.
                      </div>
                    ) : (
                      companyModules.map((mod) => {
                        const isSelected = selectedDashboardModules.includes(mod.code)

                        return (
                          <div
                            key={mod.code}
                            className={`rounded-xl border transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50/40 shadow-xs'
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <label className="flex items-center justify-between p-3 cursor-pointer">
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

                            {mod.code === 'MOD-02' && isSelected && (
                              <InventoryLevelSelector
                                value={addInventoryLevel}
                                onChange={setAddInventoryLevel}
                                namePrefix="add-employee"
                              />
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>

                  {companyModules.length > 0 && (
                    <div className="flex items-center justify-between pt-2.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleToggleSelectAllAddModules}
                        className="text-xs gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
                      >
                        {isAllAddModulesSelected ? (
                          <>
                            <Square className="w-3.5 h-3.5 text-gray-500" />
                            Desmarcar Todos os Módulos
                          </>
                        ) : (
                          <>
                            <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                            Marcar Todos os Módulos
                          </>
                        )}
                      </Button>
                      <span className="text-[11px] text-gray-500">
                        {selectedDashboardModules.length} de {companyModules.length} selecionados
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  Não é possível definir permissões de módulos para este funcionário.
                </p>
              )}

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
                    !selectedOrganizationId ||
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
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-xs">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-xs">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Editar Acesso aos Módulos</h3>
            <p className="text-xs text-gray-500 mb-4">
              Funcionário: <strong>{editingMember.displayName}</strong> ({editingMember.email})
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Módulos desmarcados ficam ocultos na página inicial e não podem ser acessados pelo
              funcionário.
            </p>

            <div className="space-y-2.5 mb-6">
              {companyModules.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-xs text-gray-500">
                  Nenhum módulo ativo foi liberado para esta empresa pelo Proprietário.
                </div>
              ) : (
                companyModules.map((mod) => {
                  const isSelected = editDashboardModules.includes(mod.code)

                  return (
                    <div
                      key={mod.code}
                      className={`rounded-xl border transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/40 shadow-xs'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <label className="flex items-center justify-between p-3 cursor-pointer">
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

                      {mod.code === 'MOD-02' && isSelected && (
                        <InventoryLevelSelector
                          value={editInventoryLevel}
                          onChange={setEditInventoryLevel}
                          namePrefix="edit-employee"
                        />
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {companyModules.length > 0 && (
              <div className="flex items-center justify-between pt-1 mb-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleToggleSelectAllEditModules}
                  className="text-xs gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
                >
                  {isAllEditModulesSelected ? (
                    <>
                      <Square className="w-3.5 h-3.5 text-gray-500" />
                      Desmarcar Todos os Módulos
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                      Marcar Todos os Módulos
                    </>
                  )}
                </Button>
                <span className="text-[11px] text-gray-500">
                  {editDashboardModules.length} de {companyModules.length} selecionados
                </span>
              </div>
            )}

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
      <ConfirmActionDialog
        open={memberToResetPassword !== null}
        title="Redefinir senha do membro"
        description={`Deseja redefinir a senha de ${memberToResetPassword?.displayName || memberToResetPassword?.email || 'este membro'} para 12345678? No próximo login, será obrigatório criar uma nova senha antes de acessar o sistema.`}
        confirmLabel="Sim, redefinir senha"
        onCancel={() => setMemberToResetPassword(null)}
        onConfirm={handleResetMemberPassword}
      />
    </div>
  )
}
