import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { ConfirmActionDialog } from '@shared/components/ConfirmActionDialog'
import { organizationService } from '@modules/organizations/services/organization.service'
import { formatPhoneNumber } from '@shared/utils/phone'
import type { ServiceResult } from '@shared/types/common'
import {
  companyManagementService,
  type CompanyUserItem,
  type ManagedCompany,
} from '../services/company-management.service'

interface CompanyUsersModalProps {
  company: ManagedCompany | null
  isOpen: boolean
  onClose: () => void
}

export function CompanyUsersModal({ company, isOpen, onClose }: CompanyUsersModalProps) {
  const [users, setUsers] = useState<CompanyUserItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Exclusão de usuário
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<CompanyUserItem | null>(null)

  // Redefinição de senha
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<CompanyUserItem | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Cadastro de novo usuário nesta organização
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPhone, setNewUserPhone] = useState('')
  const [newUserJobTitle, setNewUserJobTitle] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [newUserRole, setNewUserRole] = useState<'admin' | 'member'>('member')
  const [isAddingUser, setIsAddingUser] = useState(false)
  const [addUserError, setAddUserError] = useState<string | null>(null)

  // Edição de informações do usuário
  const [editingUser, setEditingUser] = useState<CompanyUserItem | null>(null)
  const [editUserName, setEditUserName] = useState('')
  const [editUserEmail, setEditUserEmail] = useState('')
  const [editUserPhone, setEditUserPhone] = useState('')
  const [editUserJobTitle, setEditUserJobTitle] = useState('')
  const [editUserRole, setEditUserRole] = useState<'admin' | 'member'>('member')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editUserError, setEditUserError] = useState<string | null>(null)

  const loadUsers = async () => {
    if (!company) return
    setIsLoading(true)
    setError(null)
    const res = await companyManagementService.getCompanyUsers(company.id)
    if (res.success) {
      setUsers(res.data)
    } else {
      setError(res.error)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (isOpen && company) {
      setSearchTerm('')
      setSelectedUserForPassword(null)
      setConfirmDeleteUser(null)
      setSuccessMsg(null)
      setIsAddUserOpen(false)
      setNewUserName('')
      setNewUserEmail('')
      setNewUserPhone('')
      setNewUserJobTitle('')
      setNewUserPassword('')
      setAddUserError(null)
      setEditingUser(null)
      setEditUserError(null)
      void loadUsers()
    }
  }, [isOpen, company?.id])

  const handleConfirmDeleteUser = async (): Promise<ServiceResult<void>> => {
    if (!confirmDeleteUser || !company) {
      return { success: false, error: 'Dados insuficientes para exclusão do usuário.' }
    }

    const res = await companyManagementService.removeCompanyUser(
      company.id,
      confirmDeleteUser.userId,
      confirmDeleteUser.email,
    )

    if (res.success) {
      if (selectedUserForPassword?.userId === confirmDeleteUser.userId) {
        setSelectedUserForPassword(null)
      }
      setSuccessMsg(`Usuário "${confirmDeleteUser.displayName}" excluído com sucesso da organização.`)
      setTimeout(() => setSuccessMsg(null), 5000)
      setConfirmDeleteUser(null)
      await loadUsers()
    }

    return res
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company) return
    const cleanName = newUserName.trim()
    const cleanEmail = newUserEmail.trim().toLowerCase()
    const cleanPhone = newUserPhone.replace(/\D/g, '')
    const cleanPw = newUserPassword.trim()

    if (!cleanName || cleanName.length < 2) {
      setAddUserError('Informe o nome completo do usuário.')
      return
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAddUserError('Informe um e-mail válido para o usuário.')
      return
    }

    if (cleanPw.length < 6) {
      setAddUserError('A senha inicial deve ter no mínimo 6 caracteres.')
      return
    }

    setIsAddingUser(true)
    setAddUserError(null)

    // A RPC add_organization_member requer no mínimo 8 caracteres
    const effectivePw = cleanPw.length >= 8 ? cleanPw : `${cleanPw}123`

    const res = await organizationService.addMember({
      organizationId: company.id,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone || null,
      password: effectivePw,
      role: newUserRole,
      jobTitle: newUserJobTitle.trim() || null,
      dashboardModules: ['MOD-01', 'MOD-02', 'MOD-03', 'MOD-04'],
    })

    setIsAddingUser(false)

    if (res.success) {
      setSuccessMsg(`Usuário "${cleanName}" (${cleanEmail}) cadastrado com sucesso nesta organização!`)
      setTimeout(() => setSuccessMsg(null), 5000)
      setIsAddUserOpen(false)
      setNewUserName('')
      setNewUserEmail('')
      setNewUserPhone('')
      setNewUserJobTitle('')
      setNewUserPassword('')
      await loadUsers()
    } else {
      setAddUserError(res.error || 'Não foi possível cadastrar o usuário nesta organização.')
    }
  }

  const handleStartEditUser = (user: CompanyUserItem) => {
    setEditingUser(user)
    setEditUserName(user.displayName)
    setEditUserEmail(user.email)
    setEditUserPhone(user.phone ? formatPhoneNumber(user.phone) : '')
    setEditUserJobTitle(user.jobTitle || '')
    setEditUserRole(user.role === 'admin' ? 'admin' : 'member')
    setEditUserError(null)
  }

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company || !editingUser) return

    const cleanName = editUserName.trim()
    const cleanEmail = editUserEmail.trim().toLowerCase()
    const cleanPhone = editUserPhone.replace(/\D/g, '')

    if (!cleanName || cleanName.length < 2) {
      setEditUserError('Informe o nome completo do usuário.')
      return
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setEditUserError('Informe um e-mail válido.')
      return
    }

    if (cleanPhone && cleanPhone.length < 10) {
      setEditUserError('O telefone / WhatsApp deve conter DDD e no mínimo 10 dígitos.')
      return
    }

    setIsSavingEdit(true)
    setEditUserError(null)

    const res = await companyManagementService.updateCompanyUser(
      company.id,
      editingUser.userId,
      {
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone || null,
        jobTitle: editUserJobTitle.trim() || null,
        role: editUserRole,
      },
    )

    setIsSavingEdit(false)

    if (res.success) {
      setSuccessMsg(`Informações do usuário "${cleanName}" atualizadas com sucesso!`)
      setTimeout(() => setSuccessMsg(null), 5000)
      setEditingUser(null)
      await loadUsers()
    } else {
      setEditUserError(res.error || 'Não foi possível atualizar as informações do usuário.')
    }
  }

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return users.filter((u) => {
      const matchName = u.displayName.toLowerCase().includes(term)
      const matchEmail = u.email.toLowerCase().includes(term)
      const matchRole = u.role.toLowerCase().includes(term)
      const matchJob = u.jobTitle ? u.jobTitle.toLowerCase().includes(term) : false
      return matchName || matchEmail || matchRole || matchJob
    })
  }, [users, searchTerm])

  if (!isOpen || !company) return null

  const handleStartPasswordReset = (user: CompanyUserItem) => {
    setSelectedUserForPassword(user)
  }

  const handleCancelPasswordReset = () => {
    setSelectedUserForPassword(null)
  }

  const handleConfirmPasswordReset = async (): Promise<ServiceResult<void>> => {
    if (!selectedUserForPassword || !company) {
      return { success: false, error: 'Selecione um usuário para redefinir a senha.' }
    }

    const res = await companyManagementService.resetCompanyUserPassword(
      company.id,
      selectedUserForPassword.userId,
      '12345678',
      selectedUserForPassword.email,
    )

    if (res.success) {
      setSuccessMsg(
        `Senha redefinida para 12345678. Informe a senha temporária ao usuário; ele deverá criar uma nova no próximo acesso.`,
      )
      setSelectedUserForPassword(null)
      setTimeout(() => setSuccessMsg(null), 4000)
    }

    return res
  }

  const getRoleBadge = (role: string) => {
    const r = role.toLowerCase()
    if (r === 'owner') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
          <Shield className="h-3 w-3" /> Proprietário
        </span>
      )
    }
    if (r === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
          <UserCheck className="h-3 w-3" /> Administrador
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        <User className="h-3 w-3 text-slate-400" /> Colaborador
      </span>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-users-modal-title"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h2 id="company-users-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">
                Usuários Cadastrados
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Empresa: <strong className="text-gray-700 dark:text-slate-200">{company.name}</strong> ({company.slug})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar consulta de usuários"
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {successMsg && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                className="text-xs underline hover:text-emerald-900"
              >
                Dispensar
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800 dark:border-rose-800/80 dark:bg-rose-950/40 dark:text-rose-300">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Barra de Busca de Usuários e Ações */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar usuário por nome, e-mail ou cargo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/60 pl-9 pr-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void loadUsers()}
                disabled={isLoading}
                className="gap-1.5 text-xs shrink-0"
                title="Atualizar lista de usuários"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  setIsAddUserOpen(!isAddUserOpen)
                  setAddUserError(null)
                }}
                className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold shrink-0"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {isAddUserOpen ? 'Fechar Cadastro' : 'Cadastrar Usuário'}
              </Button>
            </div>
          </div>

          {/* Painel de Cadastro de Novo Usuário na Organização */}
          {isAddUserOpen && (
            <form
              onSubmit={(e) => void handleCreateUser(e)}
              className="rounded-2xl border-2 border-blue-400 bg-blue-50/40 p-4 dark:border-blue-700 dark:bg-blue-950/30 space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                    Cadastrar Novo Usuário em {company.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400"
                >
                  Cancelar
                </button>
              </div>

              {addUserError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
                  {addUserError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex.: João da Silva"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    E-mail de Login *
                  </label>
                  <input
                    type="email"
                    placeholder="Ex.: joao@empresa.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Telefone / Celular
                  </label>
                  <input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(formatPhoneNumber(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-0.5 text-[10px] text-gray-500 dark:text-slate-400">
                    Número de telefone ou celular (opcional).
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Cargo / Função
                  </label>
                  <input
                    type="text"
                    placeholder="Ex.: Vendedor, Balconista..."
                    value={newUserJobTitle}
                    onChange={(e) => setNewUserJobTitle(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Perfil de Acesso
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'member')}
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="member">Colaborador (Funcionário)</option>
                    <option value="admin">Administrador da Empresa</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Senha Inicial de Acesso * (mínimo 6 caracteres)
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Digite a senha inicial de acesso"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 pr-10 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                      title={showNewPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAddUserOpen(false)}
                  disabled={isAddingUser}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isAddingUser}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {isAddingUser ? 'Cadastrando...' : 'Cadastrar Usuário'}
                </Button>
              </div>
            </form>
          )}

          {/* Lista de Usuários */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            {isLoading ? (
              <div className="py-14 text-center">
                <RefreshCw className="mx-auto h-7 w-7 animate-spin text-blue-600 dark:text-blue-400" />
                <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Carregando usuários da empresa...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto h-10 w-10 text-gray-300 dark:text-slate-600" />
                <h4 className="mt-2 text-sm font-bold text-gray-900 dark:text-white">Nenhum usuário encontrado</h4>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                  {searchTerm
                    ? 'Nenhum usuário corresponde aos termos de busca.'
                    : 'Nenhum colaborador cadastrado além do administrador.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs text-gray-600 dark:text-slate-300">
                  <thead className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/60 font-semibold uppercase text-gray-400 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Colaborador / Nome</th>
                      <th className="px-4 py-3">E-mail de Login</th>
                      <th className="px-4 py-3">Telefone / Contato</th>
                      <th className="px-4 py-3">Perfil / Cargo</th>
                      <th className="px-4 py-3">Cadastro</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {filteredUsers.map((u) => {
                      return (
                        <tr
                          key={u.userId}
                          className="transition-colors hover:bg-gray-50/60 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-xs uppercase">
                                {u.displayName.slice(0, 2) || 'US'}
                              </div>
                              <div>
                                <div className="font-bold text-gray-900 dark:text-white">
                                  {u.displayName}
                                </div>
                                {u.jobTitle && (
                                  <div className="text-[11px] text-gray-400 dark:text-slate-500">
                                    {u.jobTitle}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 font-mono text-[11px] text-gray-700 dark:text-slate-300">
                            {u.email || <span className="text-gray-400 italic">Sem e-mail informado</span>}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            {u.phone ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                                <Phone className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                {formatPhoneNumber(u.phone)}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic text-[11px]">Não cadastrado</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {getRoleBadge(u.role)}
                          </td>

                          <td className="px-4 py-3 text-gray-400 dark:text-slate-500">
                            {u.createdAt
                              ? new Date(u.createdAt).toLocaleDateString('pt-BR')
                              : '-'}
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartEditUser(u)}
                                className="gap-1.5 text-xs font-semibold text-blue-700 border-blue-200 hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-400 dark:hover:bg-blue-950/50"
                                title={`Editar informações de ${u.displayName}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartPasswordReset(u)}
                                className="gap-1.5 text-xs font-semibold text-amber-700 border-amber-200 hover:bg-amber-50 dark:border-amber-900/60 dark:text-amber-400 dark:hover:bg-amber-950/50"
                                title={`Redefinir senha de ${u.displayName}`}
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                                Redefinir senha
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setConfirmDeleteUser(u)}
                                className="gap-1.5 text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/50"
                                title={`Excluir usuário ${u.displayName} da organização`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Excluir
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 p-4 dark:border-slate-800">
          <span className="text-xs text-gray-500 dark:text-slate-400">
            Total de usuários: <strong>{users.length}</strong>
          </span>
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>

      {/* Modal Editar Informações do Usuário */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-modal-title"
            className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 id="edit-user-modal-title" className="text-base font-bold text-gray-900 dark:text-white">
                  Editar Informações do Usuário
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                aria-label="Fechar edição"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editUserError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
                {editUserError}
              </div>
            )}

            <form onSubmit={(e) => void handleSaveEditUser(e)} className="mt-4 space-y-3.5 flex-1 overflow-y-auto">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  required
                  maxLength={100}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  E-mail de Acesso *
                </label>
                <input
                  type="email"
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Telefone / Celular
                </label>
                <input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={editUserPhone}
                  onChange={(e) => setEditUserPhone(formatPhoneNumber(e.target.value))}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                  Número de telefone ou celular do usuário.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Cargo na Empresa
                </label>
                <input
                  type="text"
                  placeholder="Ex.: Vendedor, Balconista..."
                  value={editUserJobTitle}
                  onChange={(e) => setEditUserJobTitle(e.target.value)}
                  maxLength={100}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Perfil de Acesso
                </label>
                <select
                  value={editUserRole}
                  onChange={(e) => setEditUserRole(e.target.value as 'admin' | 'member')}
                  disabled={editingUser.role === 'owner'}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="member">Colaborador (Funcionário)</option>
                  <option value="admin">Administrador da Empresa</option>
                  {editingUser.role === 'owner' && <option value="owner">Proprietário (Imutável)</option>}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUser(null)}
                  disabled={isSavingEdit}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingEdit}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5"
                >
                  {isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmActionDialog
        open={Boolean(confirmDeleteUser)}
        title="Excluir Usuário da Organização"
        description={`Deseja realmente remover o usuário "${confirmDeleteUser?.displayName || ''}" (${confirmDeleteUser?.email || ''}) desta organização? O acesso deste usuário à empresa será revogado.`}
        confirmLabel="Sim, Excluir Usuário"
        onCancel={() => setConfirmDeleteUser(null)}
        onConfirm={handleConfirmDeleteUser}
      />
      <ConfirmActionDialog
        open={Boolean(selectedUserForPassword)}
        title="Redefinir senha do usuário"
        description={`Deseja realmente redefinir a senha de "${selectedUserForPassword?.displayName || ''}" (${selectedUserForPassword?.email || ''}) para 12345678? No próximo acesso, o usuário deverá criar uma nova senha.`}
        confirmLabel="Sim, redefinir senha"
        onCancel={handleCancelPasswordReset}
        onConfirm={handleConfirmPasswordReset}
      />
    </div>
  )
}
