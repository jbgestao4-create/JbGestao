import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  CheckCircle2,
  Copy,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Unlock,
} from 'lucide-react'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { Button } from '@shared/components/ui/Button'
import {
  ALL_PLATFORM_DASHBOARD_MODULES,
  companyManagementService,
  type ManagedCompany,
} from '../services/company-management.service'
import { RegisterCompanyModal } from '../components/RegisterCompanyModal'
import { ManageCompanyModulesModal } from '../components/ManageCompanyModulesModal'

export function CompanyManagementPage() {
  const { userRole, isLoading: isLoadingRole } = useOrganization()

  const [companies, setCompanies] = useState<ManagedCompany[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Modais
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [selectedCompanyForModules, setSelectedCompanyForModules] = useState<ManagedCompany | null>(
    null,
  )

  // Diálogo de confirmação para desativar/ativar
  const [confirmStatusCompany, setConfirmStatusCompany] = useState<ManagedCompany | null>(null)
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)

  // Toast / Mensagem de sucesso
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  const loadCompanies = async () => {
    setIsLoading(true)
    const res = await companyManagementService.listAll()
    if (res.success) {
      setCompanies(res.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    void loadCompanies()
  }, [])

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.adminEmail.toLowerCase().includes(searchTerm.toLowerCase())

      if (statusFilter === 'active') return matchesSearch && c.isActive
      if (statusFilter === 'inactive') return matchesSearch && !c.isActive
      return matchesSearch
    })
  }, [companies, searchTerm, statusFilter])

  const totalCount = companies.length
  const activeCount = companies.filter((c) => c.isActive).length
  const inactiveCount = totalCount - activeCount

  const handleCopySlug = (slug: string) => {
    void navigator.clipboard.writeText(slug)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 2000)
  }

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

  // Seção de restrição: apenas Proprietário (Item 3 do requisito)
  if (!isLoadingRole && userRole !== 'owner') {
    return (
      <div className="py-20 max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900/60 dark:bg-rose-950/40">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Acesso Restrito ao Proprietário</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Apenas o <strong>Proprietário (Owner)</strong> tem permissão para acessar o Gerenciamento de Empresas Cadastradas. Administradores e membros não possuem autorização.
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
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <ShieldCheck className="h-4 w-4" />
            <span>Módulo Exclusivo do Proprietário</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Gerenciamento de Empresas Cadastradas
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Gerencie o acesso de cada Identificador Único (SLUG), ative/desative empresas e controle as páginas e módulos disponíveis.
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

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Empresas Ativas</span>
            <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/60 p-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-800 dark:text-emerald-200">{activeCount}</p>
          <span className="text-xs text-emerald-700/80 dark:text-emerald-400">Acesso liberado</span>
        </div>

        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">Empresas Desativadas</span>
            <div className="rounded-lg bg-rose-100 dark:bg-rose-900/60 p-2 text-rose-700 dark:text-rose-300">
              <Lock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-800 dark:text-rose-200">{inactiveCount}</p>
          <span className="text-xs text-rose-700/80 dark:text-rose-400">Acesso bloqueado</span>
        </div>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome da empresa, identificador único (SLUG) ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/60 pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white'
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            Ativas ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === 'inactive'
                ? 'bg-rose-600 text-white'
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            Desativadas ({inactiveCount})
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
            <table className="w-full min-w-[800px] text-left text-sm text-gray-600 dark:text-slate-300">
              <thead className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/60 text-xs font-semibold uppercase text-gray-400 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">Empresa / Negócio</th>
                  <th className="px-4 py-3.5">Identificador Único (SLUG)</th>
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
                            <div className="font-bold text-gray-900 dark:text-white">
                              {comp.name}
                            </div>
                            <div className="text-[11px] text-gray-400 dark:text-slate-500">
                              Cadastrada em {new Date(comp.createdAt).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SLUG */}
                      <td className="px-4 py-4">
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-mono font-medium text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700">
                          <span>{comp.slug}</span>
                          <button
                            type="button"
                            title="Copiar SLUG"
                            onClick={() => handleCopySlug(comp.slug)}
                            className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {copiedSlug === comp.slug && (
                          <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                            Copiado!
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        {comp.isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 text-xs font-bold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70">
                            <Lock className="h-3 w-3" />
                            Desativado
                          </span>
                        )}
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
                          {/* Botão de gerenciar páginas (Requisito 4) */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedCompanyForModules(comp)}
                            className="gap-1.5 text-xs font-bold"
                            title="Gerenciar páginas liberadas para esta empresa"
                          >
                            <Layers className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            Gerenciar Páginas
                          </Button>

                          {/* Botão de ativar/desativar acesso (Requisito 5) */}
                          {comp.isActive ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmStatusCompany(comp)}
                              className="gap-1.5 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/50"
                              title="Desativar acesso desta empresa"
                            >
                              <Lock className="h-3.5 w-3.5" />
                              Desativar
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => setConfirmStatusCompany(comp)}
                              className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                              title="Reativar acesso desta empresa"
                            >
                              <Unlock className="h-3.5 w-3.5" />
                              Ativar Acesso
                            </Button>
                          )}
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
                    Caso selecione desativado, <strong>ninguém da organização</strong> terá acesso ao sistema. Ao tentarem fazer login, será exibida uma mensagem orientando entrar em contato com o suporte do JB Software via WhatsApp no número <strong>31 986848490</strong>.
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
    </div>
  )
}

