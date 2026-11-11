import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import {
  reportsService,
  exportRowsToExcel,
  exportRowsToXml,
  getPresetDateRange,
  isDateInRange,
  type DateRangeFilter,
  type ReportPeriodPreset,
  type ReportsDataset,
} from '../services/reports.service'
import { formatCurrency } from '@shared/utils/monetary'
import { formatPhoneNumber } from '@shared/utils/phone'
import { Card, CardContent } from '@shared/components/ui/Card'
import {
  Briefcase,
  Building2,
  Calendar,
  Search,
  ShieldCheck,
  Truck,
  UserCheck,
  Users,
} from 'lucide-react'
import { ReportPrintHeader } from '../components/ReportPrintHeader'
import { ReportPrintFooter } from '../components/ReportPrintFooter'
import { ReportActionBar } from '../components/ReportActionBar'

type RegistrationsTab = 'users' | 'employees' | 'suppliers' | 'customers'

const PERIOD_LABELS: Record<ReportPeriodPreset, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  month: 'Este Mês',
  '30d': 'Últimos 30 dias',
  year: 'Este Ano',
  all: 'Todo o Período',
  custom: 'Personalizado',
}

export function ReportsPage() {
  const { currentOrganization } = useOrganization()
  const [searchParams, setSearchParams] = useSearchParams()

  const rawTab = searchParams.get('tab')
  const initialTab: RegistrationsTab =
    rawTab === 'employees' || rawTab === 'suppliers' || rawTab === 'customers'
      ? rawTab
      : 'users'

  const [registrationsTab, setRegistrationsTab] = useState<RegistrationsTab>(initialTab)
  const [searchQuery, setSearchQuery] = useState('')

  // Filtro global de período
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>(() => {
    const initial = getPresetDateRange('month')
    return {
      preset: 'month',
      startDate: initial.startDate,
      endDate: initial.endDate,
    }
  })

  const [dataset, setDataset] = useState<ReportsDataset>({
    sales: [],
    inventory: [],
    bills: [],
    cashEntries: [],
    cashSessions: [],
    quotes: [],
    serviceOrders: [],
    customers: [],
    suppliers: [],
    members: [],
  })
  const [isLoading, setIsLoading] = useState(true)

  // Metadados padronizados para cabeçalhos e rodapés oficiais de impressão
  const now = new Date()
  const rawWeekday = now.toLocaleDateString('pt-BR', { weekday: 'long' })
  const emissionWeekday = rawWeekday.charAt(0).toUpperCase() + rawWeekday.slice(1)
  const emissionDate = now.toLocaleDateString('pt-BR')
  const emissionTime = now.toLocaleTimeString('pt-BR')
  const periodRangeText =
    dateFilter.startDate && dateFilter.endDate
      ? `${dateFilter.startDate.split('-').reverse().join('/')} a ${dateFilter.endDate.split('-').reverse().join('/')}`
      : ''

  const loadData = useCallback(async () => {
    if (!currentOrganization) return
    setIsLoading(true)
    const data = await reportsService.loadAllReportData(currentOrganization.id)
    setDataset(data)
    setIsLoading(false)
  }, [currentOrganization])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleTabChange = (tab: RegistrationsTab) => {
    setRegistrationsTab(tab)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      return next
    })
  }

  // Estatísticas gerais
  const registrationsAnalytics = useMemo(() => {
    return reportsService.computeRegistrationsAnalytics(dataset)
  }, [dataset])

  // Mapeamentos analíticos de clientes e fornecedores
  const customerMetricsMap = useMemo(() => {
    const map = new Map<string, { salesCount: number; totalSpent: number }>()
    for (const sale of dataset.sales) {
      if (sale.customerId) {
        const current = map.get(sale.customerId) || { salesCount: 0, totalSpent: 0 }
        current.salesCount += 1
        current.totalSpent += parseFloat(sale.total) || 0
        map.set(sale.customerId, current)
      }
    }
    return map
  }, [dataset.sales])

  const supplierBillsMap = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>()
    for (const bill of dataset.bills) {
      if (bill.supplierName) {
        const key = bill.supplierName.trim().toLowerCase()
        const current = map.get(key) || { count: 0, total: 0 }
        current.count += 1
        current.total += parseFloat(bill.amount) || 0
        map.set(key, current)
      }
    }
    return map
  }, [dataset.bills])

  // Filtros de listas
  const filteredUsers = useMemo(() => {
    return dataset.members.filter((m) => {
      if (dateFilter.preset !== 'all' && !isDateInRange(m.createdAt, dateFilter)) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const roleLabel =
        m.role === 'admin'
          ? 'administrador admin'
          : m.role === 'owner'
            ? 'proprietário dono'
            : 'membro'
      return (
        m.displayName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.phone || '').toLowerCase().includes(q) ||
        (m.jobTitle || '').toLowerCase().includes(q) ||
        roleLabel.includes(q)
      )
    })
  }, [dataset.members, dateFilter, searchQuery])

  const filteredEmployees = useMemo(() => {
    return dataset.members.filter((m) => {
      if (dateFilter.preset !== 'all' && !isDateInRange(m.createdAt, dateFilter)) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        m.displayName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.phone || '').toLowerCase().includes(q) ||
        (m.jobTitle || '').toLowerCase().includes(q)
      )
    })
  }, [dataset.members, dateFilter, searchQuery])

  const filteredSuppliers = useMemo(() => {
    return dataset.suppliers.filter((s) => {
      if (dateFilter.preset !== 'all' && !isDateInRange(s.createdAt, dateFilter)) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        s.name.toLowerCase().includes(q) ||
        (s.document || '').toLowerCase().includes(q) ||
        (s.contactName || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
      )
    })
  }, [dataset.suppliers, dateFilter, searchQuery])

  const filteredCustomers = useMemo(() => {
    return dataset.customers.filter((c) => {
      if (dateFilter.preset !== 'all' && !isDateInRange(c.createdAt, dateFilter)) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        c.name.toLowerCase().includes(q) ||
        (c.document || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q)
      )
    })
  }, [dataset.customers, dateFilter, searchQuery])

  // Ações de exportação Excel e XML
  const handleExportExcel = () => {
    const todayIso = new Date().toISOString().slice(0, 10)
    if (registrationsTab === 'users') {
      exportRowsToExcel(
        `relatorio-cadastros-usuarios-${todayIso}.csv`,
        [
          'Nome / Usuário',
          'E-mail de Login',
          'Perfil / Função',
          'Cargo',
          'Telefone',
          'Último Acesso',
          'Data de Cadastro',
          'Status',
        ],
        filteredUsers.map((u) => [
          u.displayName,
          u.email,
          u.role === 'admin' ? 'Administrador' : u.role === 'owner' ? 'Proprietário' : 'Membro',
          u.jobTitle || 'Não informado',
          u.phone ? formatPhoneNumber(u.phone) : '',
          u.lastAccessAt ? new Date(u.lastAccessAt).toLocaleString('pt-BR') : 'Sem registros',
          u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '',
          'Ativo',
        ]),
      )
    } else if (registrationsTab === 'employees') {
      exportRowsToExcel(
        `relatorio-cadastros-funcionarios-${todayIso}.csv`,
        [
          'Funcionário',
          'Cargo / Função',
          'Perfil',
          'E-mail',
          'Telefone',
          'Módulos Autorizados',
          'Data de Cadastro',
        ],
        filteredEmployees.map((e) => [
          e.displayName,
          e.jobTitle || 'Colaborador',
          e.role === 'admin' ? 'Administrador' : 'Membro',
          e.email,
          e.phone ? formatPhoneNumber(e.phone) : '',
          e.dashboardModules ? `${e.dashboardModules.length} módulos` : 'Padrão',
          e.createdAt ? new Date(e.createdAt).toLocaleDateString('pt-BR') : '',
        ]),
      )
    } else if (registrationsTab === 'suppliers') {
      exportRowsToExcel(
        `relatorio-cadastros-fornecedores-${todayIso}.csv`,
        [
          'Fornecedor / Razão Social',
          'CNPJ / CPF',
          'Contato / Responsável',
          'Telefone',
          'E-mail',
          'Endereço',
          'Despesas Registradas',
          'Total em Despesas',
          'Data de Cadastro',
        ],
        filteredSuppliers.map((s) => {
          const billInfo = supplierBillsMap.get(s.name.trim().toLowerCase())
          return [
            s.name,
            s.document || '',
            s.contactName || '',
            s.phone ? formatPhoneNumber(s.phone) : '',
            s.email || '',
            s.address || '',
            billInfo?.count || 0,
            (billInfo?.total || 0).toFixed(2),
            s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-BR') : '',
          ]
        }),
      )
    } else {
      exportRowsToExcel(
        `relatorio-cadastros-clientes-${todayIso}.csv`,
        [
          'Cliente / Razão Social',
          'Tipo',
          'CPF / CNPJ',
          'Telefone / WhatsApp',
          'E-mail',
          'Endereço',
          'Compras Faturadas',
          'Total Comprado (R$)',
          'Data de Cadastro',
        ],
        filteredCustomers.map((c) => {
          const metrics = customerMetricsMap.get(c.id)
          return [
            c.name,
            c.personType === 'company' ? 'Pessoa Jurídica' : 'Pessoa Física',
            c.document || '',
            c.phone ? formatPhoneNumber(c.phone) : '',
            c.email || '',
            c.address || '',
            metrics?.salesCount || 0,
            (metrics?.totalSpent || 0).toFixed(2),
            c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '',
          ]
        }),
      )
    }
  }

  const handleExportXml = () => {
    const todayIso = new Date().toISOString().slice(0, 10)
    if (registrationsTab === 'users') {
      exportRowsToXml(
        `relatorio-cadastros-usuarios-${todayIso}.xml`,
        'relatorio_cadastros_usuarios',
        'usuario',
        ['Nome Usuario', 'Email', 'Perfil', 'Cargo', 'Telefone', 'Ultimo Acesso', 'Data Cadastro', 'Status'],
        filteredUsers.map((u) => [
          u.displayName,
          u.email,
          u.role === 'admin' ? 'Administrador' : u.role === 'owner' ? 'Proprietário' : 'Membro',
          u.jobTitle || 'Não informado',
          u.phone ? formatPhoneNumber(u.phone) : '',
          u.lastAccessAt ? new Date(u.lastAccessAt).toLocaleString('pt-BR') : 'Sem registros',
          u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '',
          'Ativo',
        ]),
        {
          empresa: currentOrganization?.name || 'ControleSoft',
          total_usuarios: filteredUsers.length,
        },
      )
    } else if (registrationsTab === 'employees') {
      exportRowsToXml(
        `relatorio-cadastros-funcionarios-${todayIso}.xml`,
        'relatorio_cadastros_funcionarios',
        'funcionario',
        ['Funcionario', 'Cargo Funcao', 'Perfil', 'Email', 'Telefone', 'Modulos Autorizados', 'Data Cadastro'],
        filteredEmployees.map((e) => [
          e.displayName,
          e.jobTitle || 'Colaborador',
          e.role === 'admin' ? 'Administrador' : 'Membro',
          e.email,
          e.phone ? formatPhoneNumber(e.phone) : '',
          e.dashboardModules ? `${e.dashboardModules.length} módulos` : 'Padrão',
          e.createdAt ? new Date(e.createdAt).toLocaleDateString('pt-BR') : '',
        ]),
        {
          empresa: currentOrganization?.name || 'ControleSoft',
          total_funcionarios: filteredEmployees.length,
        },
      )
    } else if (registrationsTab === 'suppliers') {
      exportRowsToXml(
        `relatorio-cadastros-fornecedores-${todayIso}.xml`,
        'relatorio_cadastros_fornecedores',
        'fornecedor',
        ['Fornecedor Razao Social', 'CNPJ CPF', 'Contato Responsavel', 'Telefone', 'Email', 'Endereco', 'Despesas Registradas', 'Total em Despesas', 'Data Cadastro'],
        filteredSuppliers.map((s) => {
          const billInfo = supplierBillsMap.get(s.name.trim().toLowerCase())
          return [
            s.name,
            s.document || '',
            s.contactName || '',
            s.phone ? formatPhoneNumber(s.phone) : '',
            s.email || '',
            s.address || '',
            billInfo?.count || 0,
            (billInfo?.total || 0).toFixed(2),
            s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-BR') : '',
          ]
        }),
        {
          empresa: currentOrganization?.name || 'ControleSoft',
          total_fornecedores: filteredSuppliers.length,
        },
      )
    } else {
      exportRowsToXml(
        `relatorio-cadastros-clientes-${todayIso}.xml`,
        'relatorio_cadastros_clientes',
        'cliente',
        ['Cliente Razao Social', 'Tipo', 'CPF CNPJ', 'Telefone WhatsApp', 'Email', 'Endereco', 'Compras Faturadas', 'Total Comprado', 'Data Cadastro'],
        filteredCustomers.map((c) => {
          const metrics = customerMetricsMap.get(c.id)
          return [
            c.name,
            c.personType === 'company' ? 'Pessoa Jurídica' : 'Pessoa Física',
            c.document || '',
            c.phone ? formatPhoneNumber(c.phone) : '',
            c.email || '',
            c.address || '',
            metrics?.salesCount || 0,
            (metrics?.totalSpent || 0).toFixed(2),
            c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '',
          ]
        }),
        {
          empresa: currentOrganization?.name || 'ControleSoft',
          total_clientes: filteredCustomers.length,
        },
      )
    }
  }

  const activeTabTitle =
    registrationsTab === 'users'
      ? 'Usuários do Sistema'
      : registrationsTab === 'employees'
        ? 'Quadro de Funcionários & Equipe'
        : registrationsTab === 'suppliers'
          ? 'Fornecedores Parceiros'
          : 'Carteira de Clientes'

  const activeTabRecordsCount =
    registrationsTab === 'users'
      ? filteredUsers.length
      : registrationsTab === 'employees'
        ? filteredEmployees.length
        : registrationsTab === 'suppliers'
          ? filteredSuppliers.length
          : filteredCustomers.length

  const renderPeriodToolbar = () => (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between print:hidden">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 shrink-0">
          Período:
        </span>
        {(['today', '7d', 'month', '30d', 'year', 'all'] as ReportPeriodPreset[]).map((preset) => {
          const isActive = dateFilter.preset === preset
          return (
            <button
              key={preset}
              type="button"
              onClick={() => {
                const range = getPresetDateRange(preset)
                setDateFilter({ preset, ...range })
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {PERIOD_LABELS[preset]}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
        <input
          type="date"
          value={dateFilter.startDate}
          onChange={(e) =>
            setDateFilter((prev) => ({
              ...prev,
              preset: 'custom',
              startDate: e.target.value,
            }))
          }
          className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-gray-700 dark:text-slate-200"
        />
        <span className="text-gray-400">até</span>
        <input
          type="date"
          value={dateFilter.endDate}
          onChange={(e) =>
            setDateFilter((prev) => ({
              ...prev,
              preset: 'custom',
              endDate: e.target.value,
            }))
          }
          className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-gray-700 dark:text-slate-200"
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* CABEÇALHO EXCLUSIVO DE IMPRESSÃO (PRINT MEDIA) */}
      <ReportPrintHeader
        organizationName={currentOrganization?.name}
        organizationLogoUrl={currentOrganization?.logoUrl}
        reportTitle="Relatório Geral de Cadastros"
        moduleTitle={activeTabTitle}
        totalRecords={activeTabRecordsCount}
        emissionWeekday={emissionWeekday}
        emissionDate={emissionDate}
        emissionTime={emissionTime}
        periodLabel={PERIOD_LABELS[dateFilter.preset]}
        periodRange={periodRangeText}
      />

      {/* CABEÇALHO PADRÃO EM TELA COM BOTÕES EXCEL / XML / IMPRIMIR / ATUALIZAR */}
      <ReportActionBar
        title="Relatório Geral de Cadastros"
        badgeText="Cadastros & Equipe"
        badgeColorClass="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
        description="Auditoria cadastral completa de usuários do sistema, equipe de funcionários, fornecedores homologados e carteira de clientes."
        onExportExcel={handleExportExcel}
        onExportXml={handleExportXml}
        onPrint={() => window.print()}
        onRefresh={() => void loadData()}
        isRefreshing={isLoading}
        disableExport={activeTabRecordsCount === 0}
      />

      {renderPeriodToolbar()}

      {/* 4 CARDS DE KPIS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-500">Usuários do Sistema</span>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">
                {registrationsAnalytics.totalUsers}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                {registrationsAnalytics.adminUsersCount} Admins • {registrationsAnalytics.standardUsersCount} Membros
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-500">Funcionários &amp; Equipe</span>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {registrationsAnalytics.employeesCount}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                {registrationsAnalytics.employeesWithJobTitleCount} com cargo atribuído
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-500">Fornecedores Homologados</span>
              <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                {registrationsAnalytics.totalSuppliers}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                {registrationsAnalytics.suppliersWithCnpjCount} com CNPJ cadastrado
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-500">Carteira de Clientes</span>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {registrationsAnalytics.totalCustomers}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                {registrationsAnalytics.individualCustomersCount} PF • {registrationsAnalytics.companyCustomersCount} PJ
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SELETOR DE SUB-ABAS (USUÁRIOS / FUNCIONÁRIOS / FORNECEDORES / CLIENTES) E CAMPO DE BUSCA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-slate-800 pb-3 print:hidden">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => handleTabChange('users')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              registrationsTab === 'users'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Usuários do Sistema</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${registrationsTab === 'users' ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'}`}>
              {filteredUsers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('employees')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              registrationsTab === 'employees'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            <span>Funcionários &amp; Equipe</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${registrationsTab === 'employees' ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'}`}>
              {filteredEmployees.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('suppliers')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              registrationsTab === 'suppliers'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            <Truck className="h-4 w-4" />
            <span>Fornecedores</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${registrationsTab === 'suppliers' ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'}`}>
              {filteredSuppliers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('customers')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              registrationsTab === 'customers'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Clientes</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${registrationsTab === 'customers' ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'}`}>
              {filteredCustomers.length}
            </span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar no cadastro..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* ÁREA DE RELATÓRIO / FICHAS CADASTRAIS (EXIBIÇÃO NA TELA E NA IMPRESSÃO) */}
      <div className="space-y-4">
        {/* ABA: USUÁRIOS */}
        {registrationsTab === 'users' && (
          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                Nenhum usuário encontrado com os filtros selecionados.
              </div>
            ) : (
              filteredUsers.map((u) => (
                <div
                  key={u.userId}
                  className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs break-inside-avoid print:border-slate-400 print:shadow-none print:p-4 print:mb-4"
                >
                  <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 font-bold text-sm">
                        {u.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">
                          {u.displayName}
                        </h4>
                        <span className="text-xs text-slate-500 font-mono">{u.email}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                          u.role === 'admin' || u.role === 'owner'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {u.role === 'admin' ? 'Administrador' : u.role === 'owner' ? 'Proprietário' : 'Membro'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Cargo / Função</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {u.jobTitle || 'Não especificado'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Telefone</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {u.phone ? formatPhoneNumber(u.phone) : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Data de Cadastro</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Último Acesso</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {u.lastAccessAt ? new Date(u.lastAccessAt).toLocaleString('pt-BR') : 'Sem registros'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ABA: FUNCIONÁRIOS */}
        {registrationsTab === 'employees' && (
          <div className="space-y-4">
            {filteredEmployees.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                Nenhum funcionário encontrado.
              </div>
            ) : (
              filteredEmployees.map((e) => (
                <div
                  key={e.userId}
                  className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs break-inside-avoid print:border-slate-400 print:shadow-none print:p-4 print:mb-4"
                >
                  <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 font-bold text-sm">
                        <Briefcase className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">
                          {e.displayName}
                        </h4>
                        <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                          Cargo: {e.jobTitle || 'Colaborador da Empresa'}
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Equipe Ativa
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">E-mail Corporativo</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        {e.email}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Contato Telefônico</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {e.phone ? formatPhoneNumber(e.phone) : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Nível de Permissão</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {e.role === 'admin' ? 'Administrador' : 'Membro Operacional'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Admissão / Cadastro</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {e.createdAt ? new Date(e.createdAt).toLocaleDateString('pt-BR') : '—'}
                      </span>
                    </div>
                  </div>

                  {e.dashboardModules && e.dashboardModules.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Módulos Liberados no Acesso ({e.dashboardModules.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {e.dashboardModules.map((m) => (
                          <span
                            key={m}
                            className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-semibold"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ABA: FORNECEDORES */}
        {registrationsTab === 'suppliers' && (
          <div className="space-y-4">
            {filteredSuppliers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                Nenhum fornecedor cadastrado.
              </div>
            ) : (
              filteredSuppliers.map((s) => {
                const billInfo = supplierBillsMap.get(s.name.trim().toLowerCase())
                return (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs break-inside-avoid print:border-slate-400 print:shadow-none print:p-4 print:mb-4"
                  >
                    <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700 font-bold text-sm">
                          <Truck className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-slate-900 dark:text-white">
                            {s.name}
                          </h4>
                          <span className="text-xs text-slate-500 font-mono">
                            CNPJ/CPF: {s.document || 'Não informado'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Despesas Vinculadas</span>
                        <span className="text-xs font-bold text-purple-700 dark:text-purple-400">
                          {billInfo ? `${billInfo.count} contas (${formatCurrency(billInfo.total.toFixed(2))})` : 'Nenhuma conta'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Contato / Responsável</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {s.contactName || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Telefone</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {s.phone ? formatPhoneNumber(s.phone) : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase">E-mail</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                          {s.email || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Data de Cadastro</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-BR') : '—'}
                        </span>
                      </div>
                      {s.address && (
                        <div className="col-span-2 sm:col-span-4 pt-1">
                          <span className="block text-[10px] font-bold text-slate-500 uppercase">Endereço Completo</span>
                          <span className="text-slate-700 dark:text-slate-300">{s.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ABA: CLIENTES */}
        {registrationsTab === 'customers' && (
          <div className="space-y-4">
            {filteredCustomers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                Nenhum cliente cadastrado.
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const metrics = customerMetricsMap.get(c.id)
                return (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs break-inside-avoid print:border-slate-400 print:shadow-none print:p-4 print:mb-4"
                  >
                    <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 font-bold text-sm">
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-slate-900 dark:text-white">
                            {c.name}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-semibold uppercase text-emerald-700 dark:text-emerald-400">
                              {c.personType === 'company' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                            </span>
                            <span>•</span>
                            <span className="font-mono">{c.document || 'Sem documento'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Total em Compras</span>
                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 font-mono">
                          {formatCurrency((metrics?.totalSpent || 0).toFixed(2))}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {metrics?.salesCount || 0} faturamentos
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Telefone / WhatsApp</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {c.phone ? formatPhoneNumber(c.phone) : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase">E-mail</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono truncate block">
                          {c.email || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Data de Cadastro</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Situação Cadastral</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                          <UserCheck className="h-3.5 w-3.5" />
                          Ativo
                        </span>
                      </div>

                      {c.address && (
                        <div className="col-span-2 sm:col-span-4 pt-1">
                          <span className="block text-[10px] font-bold text-slate-500 uppercase">Endereço</span>
                          <span className="text-slate-700 dark:text-slate-300">{c.address}</span>
                        </div>
                      )}

                      {c.notes && (
                        <div className="col-span-2 sm:col-span-4 pt-1">
                          <span className="block text-[10px] font-bold text-slate-500 uppercase">Observações</span>
                          <span className="text-slate-600 dark:text-slate-400">{c.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* RODAPÉ OFICIAL DE IMPRESSÃO */}
      <ReportPrintFooter
        emissionWeekday={emissionWeekday}
        emissionDate={emissionDate}
        emissionTime={emissionTime}
        documentType="Documento Oficial de Auditoria Cadastral"
      />
    </div>
  )
}
