import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  FileSignature,
  Infinity,
  Layers,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  Users,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { isSystemOwner } from '@shared/utils/system-owner'
import { Button } from '@shared/components/ui/Button'
import {
  ALL_PLATFORM_DASHBOARD_MODULES,
  companyManagementService,
  type ManagedCompany,
} from '../services/company-management.service'
import { RegisterCompanyModal } from '../components/RegisterCompanyModal'
import { ManageCompanyModulesModal } from '../components/ManageCompanyModulesModal'
import { EditCompanyModal } from '../components/EditCompanyModal'
import { CompanyUsersModal } from '../components/CompanyUsersModal'
import { ManageAccessPlansModal } from '../components/ManageAccessPlansModal'
import { ContractsManagementSection } from '../components/ContractsManagementSection'
import { formatLastAccess } from '@shared/services/screen-time.service'
import {
  contractService,
  type ContractInvoice,
  getInvoiceEffectiveStatus,
} from '../services/contract.service'
import { calculateCompanyLicenseStatus } from '../utils/license.utils'

export function CompanyManagementPage() {
  const { user } = useAuth()
  const { isLoading: isLoadingRole } = useOrganization()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = (searchParams.get('tab') as 'companies' | 'contracts' | 'invoices') || 'companies'
  const prefillCompanyId = searchParams.get('companyId') || undefined

  const [companies, setCompanies] = useState<ManagedCompany[]>([])
  const [invoices, setInvoices] = useState<ContractInvoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'grace' | 'blocked' | 'inactive'>('all')

  // Modais
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [selectedCompanyForModules, setSelectedCompanyForModules] = useState<ManagedCompany | null>(
    null,
  )
  const [selectedCompanyForEdit, setSelectedCompanyForEdit] = useState<ManagedCompany | null>(null)
  const [selectedCompanyForUsers, setSelectedCompanyForUsers] = useState<ManagedCompany | null>(null)
  const [isManagePlansModalOpen, setIsManagePlansModalOpen] = useState(false)

  // Diálogo de confirmação para desativar/ativar
  const [confirmStatusCompany, setConfirmStatusCompany] = useState<ManagedCompany | null>(null)
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)

  // Diálogo e notificação de confirmação para exclusão de empresa
  const [companyToDelete, setCompanyToDelete] = useState<ManagedCompany | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeletingCompany, setIsDeletingCompany] = useState(false)

  // Toast / Mensagem de sucesso
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  const loadCompanies = async () => {
    setIsLoading(true)
    const [cRes, iRes] = await Promise.all([
      companyManagementService.listAll(),
      contractService.listInvoices(),
    ])
    if (cRes.success) {
      setCompanies(cRes.data)
    }
    if (iRes.success && iRes.data) {
      setInvoices(iRes.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    void loadCompanies()

    // Atualiza periodicamente a contagem de usuários logados em tempo real
    const interval = setInterval(() => {
      void (async () => {
        const cRes = await companyManagementService.listAll()
        if (cRes.success) {
          setCompanies(cRes.data)
        }
      })()
    }, 25000)

    return () => clearInterval(interval)
  }, [])

  const overdueCompanyIds = useMemo(() => {
    const ids = new Set<string>()
    for (const inv of invoices) {
      if (inv.companyId && getInvoiceEffectiveStatus(inv) === 'overdue') {
        ids.add(inv.companyId)
      }
    }
    return ids
  }, [invoices])

  const prefillCompanyForContract = useMemo(() => {
    if (!prefillCompanyId || companies.length === 0) return null
    return companies.find((c) => c.id === prefillCompanyId) || null
  }, [prefillCompanyId, companies])

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.adminEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.cnpj && c.cnpj.includes(searchTerm)) ||
        (c.responsible && c.responsible.toLowerCase().includes(searchTerm.toLowerCase()))

      const lic = calculateCompanyLicenseStatus(c.trialEndsAt, c.isActive)

      if (statusFilter === 'active') return matchesSearch && c.isActive && !lic.isBlockedByOverdue && lic.status !== 'grace_period'
      if (statusFilter === 'grace') return matchesSearch && lic.status === 'grace_period'
      if (statusFilter === 'blocked') return matchesSearch && (lic.isBlockedByOverdue || !c.isActive)
      if (statusFilter === 'inactive') return matchesSearch && !c.isActive
      return matchesSearch
    })
  }, [companies, searchTerm, statusFilter])

  const totalCount = companies.length
  const activeCount = companies.filter((c) => {
    const lic = calculateCompanyLicenseStatus(c.trialEndsAt, c.isActive)
    return c.isActive && !lic.isBlockedByOverdue && lic.status !== 'grace_period'
  }).length
  const graceCount = companies.filter((c) => {
    const lic = calculateCompanyLicenseStatus(c.trialEndsAt, c.isActive)
    return lic.status === 'grace_period'
  }).length
  const blockedCount = companies.filter((c) => {
    const lic = calculateCompanyLicenseStatus(c.trialEndsAt, c.isActive)
    return lic.isBlockedByOverdue || !c.isActive
  }).length

  const handleConfirmToggleStatus = async () => {
    if (!confirmStatusCompany) return
    setIsTogglingStatus(true)
    const newStatus = !confirmStatusCompany.isActive

    const res = await companyManagementService.setCompanyActive(confirmStatusCompany.id, newStatus)
    setIsTogglingStatus(false)

    if (res.success) {
      setFeedbackMsg(
        newStatus
          ? `Acesso da empresa "${confirmStatusCompany.name}" ativado com sucesso!`
          : `Acesso da empresa "${confirmStatusCompany.name}" desativado. Nenhum membro conseguirá acessar o sistema.`,
      )
      setTimeout(() => setFeedbackMsg(null), 4000)
      setConfirmStatusCompany(null)
      await loadCompanies()
    }
  }

  const handleConfirmDeleteCompany = async () => {
    if (!companyToDelete) return
    const targetId = companyToDelete.id
    const targetName = companyToDelete.name
    setIsDeletingCompany(true)
    setDeleteError(null)

    const res = await companyManagementService.deleteCompany(targetId, deleteReason)
    setIsDeletingCompany(false)

    if (res.success) {
      // Remove imediatamente da lista para refletir de forma instantânea
      setCompanies((prev) => prev.filter((c) => c.id !== targetId))
      setFeedbackMsg(
        `A empresa "${targetName}" e todos os seus vínculos foram excluídos com sucesso.`,
      )
      setTimeout(() => setFeedbackMsg(null), 5000)
      setCompanyToDelete(null)
      setDeleteReason('')

      if (localStorage.getItem('orcafacil_active_org_id') === targetId) {
        localStorage.removeItem('orcafacil_active_org_id')
      }

      await loadCompanies()
    } else {
      setDeleteError(res.error)
    }
  }

  // Seção de restrição: apenas o Proprietário do Sistema sem exceção
  if (!isLoadingRole && !isSystemOwner(user)) {
    return (
      <div className="py-20 max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900/60 dark:bg-rose-950/40">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Acesso Restrito ao Proprietário do Sistema</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          O módulo de Gerenciamento de Empresas Cadastradas é de uso <strong>exclusivo do Proprietário do Sistema</strong>. Administradores e funcionários de empresas não possuem autorização.
        </p>
        <div className="pt-2">
          <Link to="/">
            <Button variant="outline">Voltar à Página Inicial</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Botão Voltar (Item 5) */}
      <div className="flex items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>

      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <ShieldCheck className="h-4 w-4" />
            <span>Módulo Exclusivo do Proprietário</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Gerenciamento de Empresas Cadastradas & Licenças
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Gerencie as empresas cadastradas, gere contratos, acompanhe as mensalidades e controle os pagamentos financeiros.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => void loadCompanies()}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsManagePlansModalOpen(true)}
            className="gap-2 text-purple-600 border-purple-200 hover:bg-purple-50 dark:border-purple-900/60 dark:text-purple-400"
          >
            <FileSignature className="h-4 w-4" />
            Gerenciamento de Planos cadastrados
          </Button>

          {/* Botão de cadastro transferido da tela de login (Item 2 do requisito) */}
          <Button
            onClick={() => setIsRegisterModalOpen(true)}
            className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Cadastrar Nova Empresa
          </Button>
        </div>
      </div>

      {/* Abas Unificadas: Empresas Cadastradas & Gerar Contratos / Faturas (Item 1) */}
      <div className="border-b border-gray-200 dark:border-slate-800">
        <nav className="-mb-px flex space-x-6">
          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'companies' })}
            className={`py-3 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'companies'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <Building2 className="h-4 w-4" />
            Empresas Cadastradas
            <span className="ml-1 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 px-2 py-0.5 text-xs font-bold">
              {companies.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'contracts' })}
            className={`py-3 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'contracts'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <FileSignature className="h-4 w-4" />
            Contratos de Licença
          </button>

          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'invoices' })}
            className={`py-3 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'invoices'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Pagamentos Realizados & Financeiro
            {overdueCompanyIds.size > 0 && (
              <span className="ml-1.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 px-2 py-0.5 text-xs font-extrabold animate-pulse">
                {overdueCompanyIds.size} vencida(s)
              </span>
            )}
          </button>
        </nav>
      </div>

      {feedbackMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-xs text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Conteúdo Aba Contratos */}
      {activeTab === 'contracts' && (
        <ContractsManagementSection
          existingCompanies={companies}
          initialTab="contracts"
          initialCompanyId={prefillCompanyId}
          prefillCompanyForNewContract={prefillCompanyForContract}
        />
      )}

      {/* Conteúdo Aba Pagamentos Realizados & Financeiro */}
      {activeTab === 'invoices' && (
        <ContractsManagementSection
          existingCompanies={companies}
          initialTab="payments"
          initialCompanyId={prefillCompanyId}
        />
      )}

      {/* Conteúdo Aba Empresas Cadastradas */}
      {activeTab === 'companies' && (
        <>
      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Total de Empresas</span>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/60 p-2 text-blue-600 dark:text-blue-400">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{totalCount}</p>
          <span className="text-xs text-gray-400 dark:text-slate-500">Cadastradas na base</span>
        </div>

        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Licenças Ativas</span>
            <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/60 p-2 text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-800 dark:text-emerald-200">{activeCount}</p>
          <span className="text-xs text-emerald-700/80 dark:text-emerald-400">Acesso regular (30 dias)</span>
        </div>

        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Em Carência (5 dias)</span>
            <div className="rounded-lg bg-amber-100 dark:bg-amber-950/60 p-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-800 dark:text-amber-200">{graceCount}</p>
          <span className="text-xs text-amber-700/80 dark:text-amber-400">Prazo para renovar</span>
        </div>

        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">Bloqueadas (Inadimplência)</span>
            <div className="rounded-lg bg-rose-100 dark:bg-rose-900/60 p-2 text-rose-700 dark:text-rose-300">
              <Lock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-800 dark:text-rose-200">{blockedCount}</p>
          <span className="text-xs text-rose-700/80 dark:text-rose-400">Acesso suspenso</span>
        </div>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome da empresa, e-mail ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/60 pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            Todas ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white'
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            Ativas ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('grace')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'grace'
                ? 'bg-amber-600 text-white'
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            Em Carência ({graceCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('blocked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'blocked'
                ? 'bg-rose-600 text-white'
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            Bloqueadas ({blockedCount})
          </button>
        </div>
      </div>

      {/* Lista / Tabela de Empresas */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        {isLoading ? (
          <div className="py-20 text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
            <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">Carregando empresas cadastradas...</p>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="mx-auto h-12 w-12 text-gray-300 dark:text-slate-600" />
            <h3 className="mt-3 text-base font-bold text-gray-900 dark:text-white">Nenhuma empresa encontrada</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              {searchTerm ? 'Tente outros termos de busca.' : 'Cadastre sua primeira empresa clicando no botão acima.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm text-gray-600 dark:text-slate-300">
              <thead className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/60 text-xs font-semibold uppercase text-gray-400 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">Empresa / Negócio</th>
                  <th className="px-4 py-3.5">Último Acesso</th>
                  <th className="px-4 py-3.5">Dias Restantes de Licença</th>
                  <th className="px-4 py-3.5">Status de Acesso</th>
                  <th className="px-4 py-3.5">Páginas Liberadas</th>
                  <th className="px-4 py-3.5">Administrador</th>
                  <th className="px-4 py-3.5 text-right">Ações de Gestão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredCompanies.map((comp) => {
                  const moduleCount = comp.modules?.length ?? 10
                  const isAllModules = moduleCount >= ALL_PLATFORM_DASHBOARD_MODULES.length

                  return (
                    <tr
                      key={comp.id}
                      className={`transition-colors hover:bg-gray-50/60 dark:hover:bg-slate-800/50 ${
                        !comp.isActive ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                      }`}
                    >
                      {/* Empresa */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold ${
                              comp.isActive
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                            }`}
                          >
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-gray-900 dark:text-white">
                                {comp.name}
                              </span>
                              {overdueCompanyIds.has(comp.id) && (
                                <button
                                  type="button"
                                  onClick={() => setSearchParams({ tab: 'invoices', companyId: comp.id })}
                                  className="inline-flex items-center gap-1 rounded-md bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 text-[10px] font-extrabold text-rose-800 dark:text-rose-300 border border-rose-300 animate-pulse hover:bg-rose-200 dark:hover:bg-rose-900 transition cursor-pointer"
                                  title="Empresa com mensalidade vencida! Clique para ver faturas em Pagamentos Realizados & Financeiro"
                                >
                                  <AlertTriangle className="h-3 w-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                  FATURA VENCIDA
                                </button>
                              )}
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                  comp.accessPlanName
                                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-300'
                                    : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                              >
                                <Layers className="h-3 w-3" />
                                {comp.accessPlanName ?? 'Sem plano'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-gray-400 dark:text-slate-500">
                              <span>Cadastrada em {new Date(comp.createdAt).toLocaleDateString('pt-BR')}</span>
                              {comp.cnpj && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-gray-600 dark:text-slate-300">CNPJ: {comp.cnpj}</span>
                                </>
                              )}
                              {comp.responsible && (
                                <>
                                  <span>•</span>
                                  <span>Resp: {comp.responsible}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Último Acesso da Organização */}
                      <td className="px-4 py-4">
                        {comp.lastAccessAt ? (
                          <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70">
                            <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>{formatLastAccess(comp.lastAccessAt)}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700">
                            <Clock className="h-3.5 w-3.5 text-gray-400 dark:text-slate-500 shrink-0" />
                            <span>Nunca acessou</span>
                          </div>
                        )}
                      </td>

                      {/* Dias Restantes de Licença (Apenas visualização - Item 3) */}
                      <td className="px-4 py-4">
                        {(() => {
                          const lic = calculateCompanyLicenseStatus(comp.trialEndsAt, comp.isActive)
                          return (
                            <div className="space-y-1">
                              {lic.badgeVariant === 'active' && (
                                <div
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70"
                                >
                                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span>{lic.badgeText}</span>
                                </div>
                              )}

                              {lic.badgeVariant === 'grace' && (
                                <div
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse"
                                >
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span>{lic.badgeText}</span>
                                </div>
                              )}

                              {lic.badgeVariant === 'blocked' && (
                                <div
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 text-xs font-bold text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                                >
                                  <Lock className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                  <span>{lic.badgeText}</span>
                                </div>
                              )}

                              {lic.badgeVariant === 'unlimited' && (
                                <div
                                  className="inline-flex items-center gap-1 rounded-lg bg-slate-50 dark:bg-slate-800/70 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                >
                                  <Infinity className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span>{lic.badgeText}</span>
                                </div>
                              )}

                              <div className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">
                                {lic.description}
                              </div>
                            </div>
                          )
                        })()}
                      </td>

                      {/* Status de Acesso */}
                      <td className="px-4 py-4">
                        {(() => {
                          const lic = calculateCompanyLicenseStatus(comp.trialEndsAt, comp.isActive)
                          if (!comp.isActive) {
                            return (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                                <Lock className="h-3 w-3 text-gray-500" />
                                Desativado
                              </span>
                            )
                          }
                          if (lic.isBlockedByOverdue) {
                            return (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 text-xs font-bold text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/70">
                                <ShieldAlert className="h-3 w-3 text-rose-600" />
                                Bloqueado (Inadimplência)
                              </span>
                            )
                          }
                          if (lic.status === 'grace_period') {
                            return (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/70 animate-pulse">
                                <AlertTriangle className="h-3 w-3 text-amber-600" />
                                Carência ({lic.graceDaysRemaining}d)
                              </span>
                            )
                          }
                          return (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                              Ativo
                            </span>
                          )
                        })()}
                      </td>

                      {/* Módulos Liberados */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                              isAllModules
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            <Layers className="h-3.5 w-3.5" />
                            {moduleCount} de {ALL_PLATFORM_DASHBOARD_MODULES.length} páginas
                          </span>
                        </div>
                      </td>

                      {/* Administrador */}
                      <td className="px-4 py-4">
                        <div className="text-xs">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {comp.adminName}
                          </div>
                          <div className="text-gray-400 dark:text-slate-400 truncate max-w-[180px]">
                            {comp.adminEmail || 'Admin da empresa'}
                          </div>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const isOverdue = overdueCompanyIds.has(comp.id)
                              if (isOverdue) {
                                setSearchParams({ tab: 'invoices', companyId: comp.id })
                              } else {
                                setSearchParams({ tab: 'contracts', companyId: comp.id })
                              }
                            }}
                            className={`gap-1.5 text-xs font-semibold ${
                              overdueCompanyIds.has(comp.id)
                                ? 'text-rose-700 border-rose-300 bg-rose-50 hover:bg-rose-100 dark:text-rose-300 dark:border-rose-800 dark:bg-rose-950/40'
                                : 'text-purple-600 border-purple-200 hover:bg-purple-50 dark:border-purple-900/60 dark:text-purple-400 dark:hover:bg-purple-950/50'
                            }`}
                            title={
                              overdueCompanyIds.has(comp.id)
                                ? 'Empresa com mensalidade vencida! Clique para ir a Pagamentos Realizados & Financeiro'
                                : 'Gerar ou consultar contrato desta empresa'
                            }
                          >
                            <FileSignature className="h-3.5 w-3.5" />
                            {overdueCompanyIds.has(comp.id) ? 'Fatura Vencida' : 'Contrato'}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCompanyForUsers(comp)
                            }}
                            className="gap-1.5 text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-400 dark:hover:bg-blue-950/50"
                            title="Consultar usuários cadastrados nesta empresa"
                          >
                            <Users className="h-3.5 w-3.5" />
                            Usuários
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCompanyForEdit(comp)
                            }}
                            className="gap-1.5 text-xs font-bold"
                            title="Editar empresa"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
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
      </>
      )}

      {/* Modal de Cadastro de Nova Empresa (Requisito 2) */}
      <RegisterCompanyModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccess={() => {
          setFeedbackMsg('Empresa e usuário administrador cadastrados com sucesso!')
          setTimeout(() => setFeedbackMsg(null), 4000)
          void loadCompanies()
        }}
      />

      <EditCompanyModal
        company={selectedCompanyForEdit}
        isOpen={Boolean(selectedCompanyForEdit)}
        onClose={() => {
          setSelectedCompanyForEdit(null)
        }}
        onOpenUsersModal={(comp) => {
          setSelectedCompanyForEdit(null)
          setSelectedCompanyForUsers(comp)
        }}
        onDelete={(comp) => {
          setCompanyToDelete(comp)
          setDeleteReason('')
          setDeleteError(null)
        }}
        onSuccess={() => {
          setFeedbackMsg('Dados da empresa atualizados com sucesso!')
          setTimeout(() => {
            setFeedbackMsg(null)
          }, 4000)
          void loadCompanies()
        }}
      />

      {/* Modal de Consulta de Usuários Cadastrados e Redefinição de Senhas */}
      <CompanyUsersModal
        company={selectedCompanyForUsers}
        isOpen={Boolean(selectedCompanyForUsers)}
        onClose={() => setSelectedCompanyForUsers(null)}
      />

      {/* Modal de Gestão de Páginas por Empresa (Requisito 4) */}
      <ManageCompanyModulesModal
        company={selectedCompanyForModules}
        isOpen={Boolean(selectedCompanyForModules)}
        onClose={() => setSelectedCompanyForModules(null)}
        onSuccess={() => {
          setFeedbackMsg('Permissões de páginas salvas com sucesso!')
          setTimeout(() => setFeedbackMsg(null), 4000)
          void loadCompanies()
        }}
      />


      {/* Modal de Gerenciamento de Planos de Acesso Cadastrados */}
      <ManageAccessPlansModal
        open={isManagePlansModalOpen}
        onClose={() => setIsManagePlansModalOpen(false)}
        onChanged={async () => {
          await loadCompanies()
        }}
      />

      {/* Diálogo de Confirmação para Desativação / Ativação (Requisito 5) */}
      {confirmStatusCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                  confirmStatusCompany.isActive
                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                }`}
              >
                {confirmStatusCompany.isActive ? (
                  <Lock className="h-6 w-6" />
                ) : (
                  <Unlock className="h-6 w-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {confirmStatusCompany.isActive ? 'Desativar Empresa' : 'Ativar Acesso da Empresa'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {confirmStatusCompany.name} ({confirmStatusCompany.slug})
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-gray-50 dark:bg-slate-800/60 p-4 text-xs leading-relaxed text-gray-700 dark:text-slate-300 border border-gray-100 dark:border-slate-700">
              {confirmStatusCompany.isActive ? (
                <>
                  <p className="font-semibold text-rose-700 dark:text-rose-400 mb-1">
                    Atenção: o acesso será bloqueado para todos os usuários!
                  </p>
                  <p>
                    Caso selecione desativado, <strong>ninguém da organização</strong> terá acesso ao sistema. Ao tentarem fazer login, será exibida uma mensagem orientando entrar em contato com o suporte do ControleSoft via WhatsApp no número <strong>31 986848490</strong>.
                  </p>
                </>
              ) : (
                <p>
                  Ao ativar a empresa, todos os administradores e colaboradores cadastrados na organização recuperarão imediatamente o acesso ao sistema.
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                disabled={isTogglingStatus}
                onClick={() => setConfirmStatusCompany(null)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmToggleStatus}
                isLoading={isTogglingStatus}
                className={
                  confirmStatusCompany.isActive
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }
              >
                {confirmStatusCompany.isActive ? 'Confirmar Desativação' : 'Confirmar Ativação'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo / Notificação de Confirmação para Exclusão Definitiva */}
      {companyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Excluir Empresa Definitivamente
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {companyToDelete.name} ({companyToDelete.slug})
                </p>
              </div>
            </div>

            {/* Notificação informativa detalhando o que vai acontecer */}
            <div className="mt-4 space-y-3 rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs leading-relaxed text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200">
              <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>O que acontecerá ao confirmar a exclusão:</span>
              </div>
              <ul className="list-disc pl-5 space-y-1.5 text-[11px]">
                <li>
                  <strong>Ação Permanente:</strong> A exclusão é definitiva e os dados desta empresa <strong>não poderão ser recuperados</strong> após a confirmação.
                </li>
                <li>
                  <strong>Bloqueio Imediato:</strong> O administrador (<strong>{companyToDelete.adminEmail || 'Admin'}</strong>) e todos os funcionários vinculados serão desconectados e <strong>perderão o acesso</strong> ao sistema imediatamente.
                </li>
                <li>
                  <strong>Invalidação do SLUG:</strong> O identificador único <span className="font-mono font-bold bg-rose-100 dark:bg-rose-900/60 px-1 py-0.5 rounded text-[11px]">{companyToDelete.slug}</span> deixará de funcionar.
                </li>
                <li>
                  <strong>Eliminação de Dados:</strong> Todos os orçamentos, vendas, clientes, materiais de estoque, ordens de serviço, notas fiscais, contas e relatórios gerados nesta empresa serão excluídos permanentemente.
                </li>
              </ul>
            </div>

            {deleteError && (
              <div className="mt-3 rounded-xl bg-red-100 p-3 text-xs font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900">
                {deleteError}
              </div>
            )}

            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                Motivo da Exclusão <span className="text-gray-400 font-normal">(opcional para histórico)</span>:
              </label>
              <textarea
                rows={2}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Ex.: Encerramento de contrato, cliente solicitou cancelamento..."
                className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/60 p-3 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                disabled={isDeletingCompany}
                onClick={() => {
                  setCompanyToDelete(null)
                  setDeleteReason('')
                  setDeleteError(null)
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmDeleteCompany}
                isLoading={isDeletingCompany}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Sim, Excluir Empresa
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
