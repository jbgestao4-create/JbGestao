import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@modules/sales/services/sales.service'
import type { CashSession } from '@modules/cash/domain/cash-session'
import {
  reportsService,
  exportRowsToCsv,
  getPresetDateRange,
  isDateInRange,
  type DateRangeFilter,
  type ReportPeriodPreset,
  type ReportsDataset,
} from '../services/reports.service'
import { formatCurrency } from '@shared/utils/monetary'
import { formatPhoneNumber } from '@shared/utils/phone'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Award,
  BarChart3,
  Boxes,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  DollarSign,
  Download,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Layers,
  Package,
  PieChart,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react'

type ReportView =
  | 'home'
  | 'user-sessions'
  | 'sales'
  | 'inventory'
  | 'financial'
  | 'quotes-os'
  | 'customers'
  | 'registrations'

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
  const { canAccessSubFeature } = useModuleAccess()
  const [searchParams, setSearchParams] = useSearchParams()

  const rawParam = searchParams.get('view') || 'home'
  const normalizedParam = rawParam === 'cadastros' ? 'registrations' : rawParam
  const currentView: ReportView = [
    'home',
    'user-sessions',
    'sales',
    'inventory',
    'financial',
    'quotes-os',
    'customers',
    'registrations',
  ].includes(normalizedParam as ReportView)
    ? (normalizedParam as ReportView)
    : 'home'

  const canViewSalesReport = canAccessSubFeature('MOD-08_SALES')
  const canViewInventoryReport = canAccessSubFeature('MOD-08_INVENTORY')

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

  // Estados de busca/filtro específicos de cada sub-view
  const [searchQuery, setSearchQuery] = useState('')
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'all' | 'closed' | 'open'>('closed')
  const [selectedSession, setSelectedSession] = useState<CashSession | null>(null)
  const [showSessionModal, setShowSessionModal] = useState(false)

  // Filtros da view de vendas
  const [salesChannelFilter, setSalesChannelFilter] = useState<'all' | 'pdv' | 'counter'>('all')
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<'all' | PaymentMethod>('all')

  // Filtros da view de estoque
  const [inventoryAbcFilter, setInventoryAbcFilter] = useState<'all' | 'A' | 'B' | 'C'>('all')
  const [inventoryStockFilter, setInventoryStockFilter] = useState<'all' | 'critical' | 'out' | 'normal'>('all')

  // Filtros da view financeira
  const [billStatusFilter, setBillStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all')

  // Filtros da view de orçamentos & OS
  const [quotesOsTab, setQuotesOsTab] = useState<'quotes' | 'os'>('quotes')

  // Filtros da view de clientes & fornecedores
  const [crmTab, setCrmTab] = useState<'customers' | 'suppliers'>('customers')

  // Filtros da view de cadastros gerais (Usuários, Funcionários, Fornecedores, Clientes)
  const [registrationsTab, setRegistrationsTab] = useState<'users' | 'employees' | 'suppliers' | 'customers'>('users')

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

  const handlePresetChange = (preset: ReportPeriodPreset) => {
    if (preset === 'custom') {
      setDateFilter((prev) => ({ ...prev, preset: 'custom' }))
      return
    }
    const range = getPresetDateRange(preset)
    setDateFilter({
      preset,
      startDate: range.startDate,
      endDate: range.endDate,
    })
  }

  const navigateToView = (view: ReportView) => {
    setSearchQuery('')
    if (view === 'home') {
      setSearchParams({})
    } else {
      setSearchParams({ view })
    }
  }

  // ============================================================================
  // DADOS FILTRADOS PELO PERÍODO SELECIONADO
  // ============================================================================
  const periodFilteredSales = useMemo(
    () => dataset.sales.filter((s) => isDateInRange(s.createdAt, dateFilter)),
    [dataset.sales, dateFilter],
  )

  const periodFilteredSessions = useMemo(
    () => dataset.cashSessions.filter((s) => isDateInRange(s.openedAt, dateFilter)),
    [dataset.cashSessions, dateFilter],
  )

  const periodFilteredBills = useMemo(
    () => dataset.bills.filter((b) => isDateInRange(b.dueDate, dateFilter) || isDateInRange(b.paidAt, dateFilter)),
    [dataset.bills, dateFilter],
  )

  const periodFilteredEntries = useMemo(
    () => dataset.cashEntries.filter((e) => isDateInRange(e.createdAt, dateFilter)),
    [dataset.cashEntries, dateFilter],
  )

  const periodFilteredQuotes = useMemo(
    () => dataset.quotes.filter((q) => isDateInRange(q.createdAt, dateFilter)),
    [dataset.quotes, dateFilter],
  )

  const periodFilteredServiceOrders = useMemo(
    () => dataset.serviceOrders.filter((os) => isDateInRange(os.createdAt, dateFilter)),
    [dataset.serviceOrders, dateFilter],
  )

  // ============================================================================
  // ANALYTICS CONSOLIDADOS
  // ============================================================================
  const salesAnalytics = useMemo(
    () => reportsService.computeSalesAnalytics(periodFilteredSales),
    [periodFilteredSales],
  )

  const inventoryAnalytics = useMemo(
    () => reportsService.computeInventoryAbcAnalytics(dataset.inventory),
    [dataset.inventory],
  )

  const financialAnalytics = useMemo(
    () =>
      reportsService.computeFinancialAnalytics(
        periodFilteredSales,
        periodFilteredBills,
        periodFilteredEntries,
      ),
    [periodFilteredSales, periodFilteredBills, periodFilteredEntries],
  )

  const quotesOsAnalytics = useMemo(
    () =>
      reportsService.computeQuotesAndServiceOrdersAnalytics(
        periodFilteredQuotes,
        periodFilteredServiceOrders,
      ),
    [periodFilteredQuotes, periodFilteredServiceOrders],
  )

  const customersAnalytics = useMemo(
    () =>
      reportsService.computeCustomersAnalytics(
        dataset.customers,
        periodFilteredSales,
        periodFilteredQuotes,
        periodFilteredServiceOrders,
      ),
    [dataset.customers, periodFilteredSales, periodFilteredQuotes, periodFilteredServiceOrders],
  )

  const registrationsAnalytics = useMemo(
    () => reportsService.computeRegistrationsAnalytics(dataset),
    [dataset],
  )

  const REPORT_NAV_ITEMS = useMemo<
    Array<{ id: ReportView; label: string; icon: any; badge?: string }>
  >(
    () => [
      { id: 'home', label: 'Visão Geral', icon: BarChart3 },
      ...(canViewSalesReport ? [{ id: 'sales' as ReportView, label: 'Vendas & PDV', icon: ShoppingCart }] : []),
      ...(canViewInventoryReport ? [{ id: 'inventory' as ReportView, label: 'Estoque & ABC', icon: Boxes }] : []),
      { id: 'financial', label: 'Financeiro & DRE', icon: Wallet },
      { id: 'user-sessions', label: 'Resumo de Caixa', icon: Receipt },
      { id: 'quotes-os', label: 'Orçamentos & OS', icon: ClipboardList },
      { id: 'customers', label: 'Ranking Clientes', icon: Award },
      { id: 'registrations', label: 'Relatório de Cadastros', icon: Users, badge: 'Novo' },
    ],
    [canViewSalesReport, canViewInventoryReport],
  )

  // ============================================================================
  // COMPONENTE DE BARRA DE PERÍODO REUTILIZÁVEL
  // ============================================================================
  const renderPeriodToolbar = () => (
    <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs print:hidden">
      <CardContent className="p-3.5 sm:p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-slate-300 mr-1">
            <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>Período:</span>
          </div>
          {(['today', '7d', 'month', '30d', 'year', 'all'] as ReportPeriodPreset[]).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetChange(preset)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                dateFilter.preset === preset
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {PERIOD_LABELS[preset]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={dateFilter.startDate}
            onChange={(e) =>
              setDateFilter({
                preset: 'custom',
                startDate: e.target.value,
                endDate: dateFilter.endDate,
              })
            }
            className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-hidden"
            title="Data Inicial"
          />
          <span className="text-xs text-gray-400">até</span>
          <input
            type="date"
            value={dateFilter.endDate}
            onChange={(e) =>
              setDateFilter({
                preset: 'custom',
                startDate: dateFilter.startDate,
                endDate: e.target.value,
              })
            }
            className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-hidden"
            title="Data Final"
          />
        </div>
      </CardContent>
    </Card>
  )

  // ============================================================================
  // VIEW 1: RELATÓRIO DO USUÁRIO — RESUMOS DE CAIXA (user-sessions)
  // ============================================================================
  if (currentView === 'user-sessions') {
    const filteredSessions = periodFilteredSessions.filter((s) => {
      if (sessionStatusFilter !== 'all' && s.status !== sessionStatusFilter) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const op = (s.operatorName || '').toLowerCase()
      const reg = (s.registerId || '').toLowerCase()
      const dateOpened = new Date(s.openedAt).toLocaleDateString('pt-BR').toLowerCase()
      const dateClosed = s.closedAt ? new Date(s.closedAt).toLocaleDateString('pt-BR').toLowerCase() : ''
      return op.includes(q) || reg.includes(q) || dateOpened.includes(q) || dateClosed.includes(q)
    })

    const closedSessions = filteredSessions.filter((s) => s.status === 'closed')
    const totalSessionSales = closedSessions.reduce((acc, s) => acc + parseFloat(s.totalSales || '0'), 0)
    const totalCountedMoney = closedSessions.reduce((acc, s) => acc + parseFloat(s.countedMoney || '0'), 0)
    const totalSalesCount = closedSessions.reduce((acc, s) => acc + (s.salesCount || 0), 0)
    const balancedCount = closedSessions.filter((s) => (s.difference || '0.00') === '0.00').length

    const handleExportSessionsCsv = () => {
      exportRowsToCsv(
        `relatorio-turnos-caixa-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          'Terminal',
          'Operador',
          'Status',
          'Abertura',
          'Fechamento',
          'Saldo Inicial',
          'Qtd Vendas',
          'Total Vendas',
          'Dinheiro Esperado',
          'Dinheiro Contado',
          'Divergencia',
          'Justificativa',
        ],
        filteredSessions.map((s) => [
          s.registerId,
          s.operatorName,
          s.status === 'closed' ? 'Fechado' : 'Aberto',
          new Date(s.openedAt).toLocaleString('pt-BR'),
          s.closedAt ? new Date(s.closedAt).toLocaleString('pt-BR') : 'Em aberto',
          s.openingBalance,
          s.salesCount || 0,
          s.totalSales,
          s.expectedMoney,
          s.countedMoney || '0.00',
          s.difference || '0.00',
          s.discrepancyJustification || '',
        ]),
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigateToView('home')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-900 dark:hover:text-white shadow-xs transition-colors"
              title="Voltar à Central de Relatórios"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                  Relatório do Usuário — Resumos de Caixa
                </h1>
                <span className="rounded-md bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 text-xs font-bold text-teal-700 dark:text-teal-300 ring-1 ring-teal-600/20">
                  PDV &amp; Turnos
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                Histórico consolidado de fechamentos de caixa, conciliações físicas da gaveta e turnos de operadores.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSessionsCsv}
              disabled={filteredSessions.length === 0}
              className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
            >
              <Download className="h-4 w-4" />
              <span>Exportar CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={isLoading}
              className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </Button>
          </div>
        </div>

        {renderPeriodToolbar()}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400">
                <Receipt className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Turnos Fechados</p>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                  {closedSessions.length} {closedSessions.length === 1 ? 'turno' : 'turnos'}
                </h3>
                <p className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
                  {balancedCount} sem divergência de caixa
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Faturamento em Turnos</p>
                <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatCurrency(totalSessionSales.toFixed(2))}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  {totalSalesCount} vendas registradas
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Dinheiro Físico Apurado</p>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                  {formatCurrency(totalCountedMoney.toFixed(2))}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">Total conferido em gaveta</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Turnos em Aberto</p>
                <h3 className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                  {periodFilteredSessions.filter((s) => s.status === 'open').length}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">Caixas ativos no período</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs print:hidden">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por operador, terminal ou data..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:border-teal-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-xl border border-gray-200 dark:border-slate-700 p-0.5 bg-gray-50 dark:bg-slate-800/80 text-xs font-semibold">
                {(['closed', 'open', 'all'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setSessionStatusFilter(status)}
                    className={`rounded-lg px-3 py-1.5 transition-colors ${
                      sessionStatusFilter === status
                        ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs'
                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                    }`}
                  >
                    {status === 'closed'
                      ? `Fechados (${periodFilteredSessions.filter((s) => s.status === 'closed').length})`
                      : status === 'open'
                      ? `Em Aberto (${periodFilteredSessions.filter((s) => s.status === 'open').length})`
                      : `Todos (${periodFilteredSessions.length})`}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden print:hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  <th className="px-5 py-3.5">Terminal / Operador</th>
                  <th className="px-5 py-3.5">Abertura / Fechamento</th>
                  <th className="px-5 py-3.5 text-center">Vendas</th>
                  <th className="px-5 py-3.5 text-right">Faturamento Total</th>
                  <th className="px-5 py-3.5 text-right">Dinheiro Contado</th>
                  <th className="px-5 py-3.5 text-center">Situação</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-teal-600" />
                      <span>Carregando resumos de caixa...</span>
                    </td>
                  </tr>
                ) : filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                      <Receipt className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                      <p className="font-semibold text-gray-700 dark:text-slate-300">
                        Nenhum resumo encontrado no período selecionado.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((s) => {
                    const isClosed = s.status === 'closed'
                    const diffVal = parseFloat(s.difference || '0')
                    const isCorrect = (s.difference || '0.00') === '0.00'

                    return (
                      <tr key={s.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-teal-50 dark:bg-teal-950/60 px-2 py-1 font-mono text-[11px] font-bold text-teal-700 dark:text-teal-300">
                              {s.registerId}
                            </span>
                            <span className="font-semibold">{s.operatorName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 dark:text-slate-300">
                          <div className="space-y-0.5 text-[11px]">
                            <div>
                              <span className="text-gray-400">Abr:</span>{' '}
                              {new Date(s.openedAt).toLocaleString('pt-BR')}
                            </div>
                            {s.closedAt ? (
                              <div>
                                <span className="text-gray-400">Fec:</span>{' '}
                                <b className="text-gray-900 dark:text-white">
                                  {new Date(s.closedAt).toLocaleString('pt-BR')}
                                </b>
                              </div>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-bold">Em andamento</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center font-mono font-bold text-gray-900 dark:text-white">
                          {s.salesCount || 0}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatCurrency(s.totalSales)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-gray-900 dark:text-white font-medium">
                          {s.countedMoney ? formatCurrency(s.countedMoney) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {!isClosed ? (
                            <span className="rounded-full bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                              ABERTO
                            </span>
                          ) : isCorrect ? (
                            <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              CORRETO
                            </span>
                          ) : diffVal > 0 ? (
                            <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                              SOBRA ({s.difference})
                            </span>
                          ) : (
                            <span className="rounded-full bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                              FALTA ({s.difference})
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSession(s)
                                setShowSessionModal(true)
                              }}
                              className="rounded-lg h-8 px-2.5 text-xs font-semibold"
                            >
                              <FileText className="h-3.5 w-3.5 mr-1" />
                              <span>Resumo</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSession(s)
                                setShowSessionModal(true)
                                setTimeout(() => window.print(), 300)
                              }}
                              className="rounded-lg h-8 px-2 text-xs"
                              title="Imprimir Comprovante"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {showSessionModal && selectedSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto print:hidden">
            <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-teal-50 dark:bg-teal-950/60 p-2 text-teal-600 dark:text-teal-400">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      Resumo do Fechamento de Caixa
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {selectedSession.registerId} • Operador: {selectedSession.operatorName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-slate-950 p-4 border border-gray-200 dark:border-slate-800 font-mono text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">DINHEIRO:</span>
                  <span className="font-bold">{formatCurrency(selectedSession.totalMoney)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">PIX:</span>
                  <span className="font-bold">{formatCurrency(selectedSession.totalPix)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CARTÃO DE CRÉDITO:</span>
                  <span className="font-bold">{formatCurrency(selectedSession.totalCreditCard)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CARTÃO DE DÉBITO:</span>
                  <span className="font-bold">{formatCurrency(selectedSession.totalDebitCard)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-slate-800 font-bold text-emerald-600">
                  <span>TOTAL VENDAS ({selectedSession.salesCount || 0}):</span>
                  <span>{formatCurrency(selectedSession.totalSales)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-slate-800">
                  <span className="text-gray-500">ESPERADO EM GAVETA:</span>
                  <span className="font-bold">{formatCurrency(selectedSession.expectedMoney)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">FÍSICO CONTADO:</span>
                  <span className="font-bold">{formatCurrency(selectedSession.countedMoney || '0')}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-gray-500">DIVERGÊNCIA:</span>
                  <span>{selectedSession.difference || '0.00'}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSessionModal(false)}
                  className="flex-1 rounded-xl text-xs font-semibold"
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Printer className="h-4 w-4" />
                  <span>Imprimir Resumo</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ============================================================================
  // VIEW 2: RELATÓRIO DE VENDAS & FATURAMENTO (sales)
  // ============================================================================
  if (currentView === 'sales') {
    const filteredSalesList = salesAnalytics.activeSales.filter((s) => {
      if (salesChannelFilter === 'pdv' && !s.isPdv) return false
      if (salesChannelFilter === 'counter' && s.isPdv) return false
      if (salesPaymentFilter !== 'all' && s.paymentMethod !== salesPaymentFilter) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        s.saleNumber.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        (s.sellerName || '').toLowerCase().includes(q)
      )
    })

    const maxDailyTotal = Math.max(...salesAnalytics.dailyEvolution.map((d) => d.total), 1)

    const handleExportSalesCsv = () => {
      exportRowsToCsv(
        `relatorio-vendas-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          'Numero Venda',
          'Data/Hora',
          'Cliente',
          'CPF/CNPJ',
          'Canal',
          'Vendedor/Operador',
          'Forma de Pagamento',
          'Qtd Itens',
          'Subtotal',
          'Desconto',
          'Total Liquido',
          'Nota Fiscal',
        ],
        filteredSalesList.map((s) => [
          s.saleNumber,
          new Date(s.createdAt).toLocaleString('pt-BR'),
          s.customerName,
          s.customerDocument || '',
          s.isPdv ? 'PDV' : 'Balcao',
          s.sellerName || s.creatorName || 'Padrao',
          PAYMENT_METHOD_LABELS[s.paymentMethod] || s.paymentMethod,
          s.itemsCount,
          s.subtotal,
          s.discount,
          s.total,
          s.hasFiscalInvoice ? `${s.fiscalInvoice?.type?.toUpperCase()} ${s.fiscalInvoice?.number}` : 'Nao emitida',
        ]),
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigateToView('home')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-900 dark:hover:text-white shadow-xs"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                  Relatório de Vendas &amp; Faturamento
                </h1>
                <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                  Comercial &amp; PDV
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                Análise detalhada de receita bruta, descontos, meios de pagamento, desempenho de vendedores e evolução diária.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSalesCsv}
              disabled={filteredSalesList.length === 0}
              className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Exportar Excel (CSV)</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir / PDF</span>
            </Button>
          </div>
        </div>

        {renderPeriodToolbar()}

        {/* KPIs DE VENDAS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Faturamento Líquido</span>
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/60 p-2 text-blue-600 dark:text-blue-400">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {formatCurrency(salesAnalytics.totalRevenue.toFixed(2))}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                Bruto: {formatCurrency(salesAnalytics.totalSubtotal.toFixed(2))} • Desc:{' '}
                {formatCurrency(salesAnalytics.totalDiscount.toFixed(2))}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Volume de Vendas</span>
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/60 p-2 text-emerald-600 dark:text-emerald-400">
                  <ShoppingCart className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {salesAnalytics.salesCount} vendas
              </h3>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                {salesAnalytics.totalItems} itens comercializados
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Ticket Médio</span>
                <div className="rounded-lg bg-purple-50 dark:bg-purple-950/60 p-2 text-purple-600 dark:text-purple-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {formatCurrency(salesAnalytics.averageTicket.toFixed(2))}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                Média por venda faturada
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Canais (PDV vs Balcão)</span>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/60 p-2 text-amber-600 dark:text-amber-400">
                  <Store className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-2">
                PDV: {salesAnalytics.pdvCount} • Balcão: {salesAnalytics.counterCount}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                {salesAnalytics.fiscalCount} com NF-e / NFC-e emitida
              </p>
            </CardContent>
          </Card>
        </div>

        {/* GRÁFICO DE MEIOS DE PAGAMENTO + RANKING DE VENDEDORES */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-blue-600" />
                  <span>Faturamento por Meio de Pagamento</span>
                </h3>
                <span className="text-xs text-gray-400">Participação (%)</span>
              </div>

              {salesAnalytics.byPaymentMethod.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">Nenhuma venda registrada no período.</p>
              ) : (
                <div className="space-y-3">
                  {salesAnalytics.byPaymentMethod.map((pm) => (
                    <div key={pm.method} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-800 dark:text-slate-200">
                          {pm.label}{' '}
                          <span className="text-gray-400 font-normal">({pm.count} vendas)</span>
                        </span>
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          {formatCurrency(pm.total.toFixed(2))}{' '}
                          <span className="text-blue-600 dark:text-blue-400">({pm.percentage.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all"
                          style={{ width: `${Math.max(3, Math.min(100, pm.percentage))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  <span>Desempenho por Vendedor / Operador</span>
                </h3>
                <span className="text-xs text-gray-400">Top Faturamento</span>
              </div>

              {salesAnalytics.sellerRanking.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">Sem dados de vendedores no período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-slate-800 text-[11px] text-gray-400 uppercase">
                        <th className="py-2">Vendedor / Operador</th>
                        <th className="py-2 text-center">Vendas</th>
                        <th className="py-2 text-right">Ticket Médio</th>
                        <th className="py-2 text-right">Total Faturado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {salesAnalytics.sellerRanking.slice(0, 6).map((seller, idx) => (
                        <tr key={seller.sellerName}>
                          <td className="py-2.5 font-semibold text-gray-900 dark:text-white">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 text-[10px] font-bold text-blue-700 dark:text-blue-300 mr-2">
                              {idx + 1}º
                            </span>
                            {seller.sellerName}
                          </td>
                          <td className="py-2.5 text-center font-mono">{seller.salesCount}</td>
                          <td className="py-2.5 text-right font-mono text-gray-600 dark:text-slate-300">
                            {formatCurrency(seller.averageTicket.toFixed(2))}
                          </td>
                          <td className="py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(seller.totalAmount.toFixed(2))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* EVOLUÇÃO DIÁRIA */}
        {salesAnalytics.dailyEvolution.length > 0 && (
          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-600" />
                <span>Evolução Diária de Faturamento (Últimos dias com movimento)</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-7 lg:grid-cols-14 gap-2 items-end pt-2">
                {salesAnalytics.dailyEvolution.map((day) => {
                  const heightPercent = Math.max(12, Math.round((day.total / maxDailyTotal) * 100))
                  return (
                    <div
                      key={day.dateKey}
                      className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-gray-50 dark:bg-slate-800/50"
                    >
                      <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(day.total.toFixed(2))}
                      </span>
                      <div className="h-20 w-full flex items-end justify-center">
                        <div
                          className="w-6 rounded-t-lg bg-blue-600 dark:bg-blue-500 transition-all"
                          style={{ height: `${heightPercent}%` }}
                          title={`${day.label}: ${day.count} vendas`}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300">{day.label}</span>
                      <span className="text-[10px] text-gray-400">{day.count} vnd</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* FILTROS E TABELA DETALHADA DE VENDAS */}
        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs print:hidden">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por número da venda, cliente ou vendedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={salesChannelFilter}
                onChange={(e) => setSalesChannelFilter(e.target.value as 'all' | 'pdv' | 'counter')}
                className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200"
              >
                <option value="all">Todos os Canais</option>
                <option value="pdv">Apenas PDV</option>
                <option value="counter">Apenas Venda Balcão</option>
              </select>

              <select
                value={salesPaymentFilter}
                onChange={(e) => setSalesPaymentFilter(e.target.value as 'all' | PaymentMethod)}
                className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200"
              >
                <option value="all">Todas Formas de Pagamento</option>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  <th className="px-4 py-3.5">Nº Venda</th>
                  <th className="px-4 py-3.5">Data / Hora</th>
                  <th className="px-4 py-3.5">Cliente</th>
                  <th className="px-4 py-3.5">Vendedor / Canal</th>
                  <th className="px-4 py-3.5">Pagamento</th>
                  <th className="px-4 py-3.5 text-right">Desconto</th>
                  <th className="px-4 py-3.5 text-right">Total Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                {filteredSalesList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                      Nenhuma venda encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredSalesList.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {sale.saleNumber}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                        {new Date(sale.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                        {sale.customerName}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                        <span className="font-medium">{sale.sellerName || sale.creatorName || 'Padrão'}</span>
                        <span className="ml-2 rounded-md bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold">
                          {sale.isPdv ? 'PDV' : 'Balcão'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-700 dark:text-slate-300">
                        {PAYMENT_METHOD_LABELS[sale.paymentMethod] || sale.paymentMethod}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-rose-500">
                        {parseFloat(sale.discount) > 0 ? `- ${formatCurrency(sale.discount)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(sale.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    )
  }

  // ============================================================================
  // VIEW 3: RELATÓRIO DE ESTOQUE, VALORIZAÇÃO & CURVA ABC (inventory)
  // ============================================================================
  if (currentView === 'inventory') {
    const filteredAbcItems = inventoryAnalytics.abcItems.filter((item) => {
      if (inventoryAbcFilter !== 'all' && item.abcClass !== inventoryAbcFilter) return false
      if (inventoryStockFilter === 'out' && item.stockStatus !== 'out') return false
      if (inventoryStockFilter === 'critical' && item.stockStatus === 'normal') return false
      if (inventoryStockFilter === 'normal' && item.stockStatus !== 'normal') return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        item.name.toLowerCase().includes(q) ||
        (item.sku || '').toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      )
    })

    const handleExportInventoryCsv = () => {
      exportRowsToCsv(
        `relatorio-estoque-curva-abc-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          'Classe ABC',
          'SKU',
          'Produto',
          'Categoria',
          'Unidade',
          'Saldo Atual',
          'Estoque Minimo',
          'Status Estoque',
          'Custo Unitario',
          'Preco Venda',
          'Custo Total Estoque',
          'Valor Venda Estoque',
          'Lucro Potencial',
          'Margem (%)',
          'Participacao (%)',
        ],
        filteredAbcItems.map((i) => [
          i.abcClass,
          i.sku || '',
          i.name,
          i.category,
          i.unit,
          i.quantityOnHand,
          i.minimumQuantity,
          i.stockStatus === 'out' ? 'Zerado' : i.stockStatus === 'low' ? 'Abaixo do Minimo' : 'Normal',
          i.purchasePrice.toFixed(2),
          i.unitPrice.toFixed(2),
          i.totalCostValue.toFixed(2),
          i.totalSaleValue.toFixed(2),
          i.potentialProfit.toFixed(2),
          i.marginPercent.toFixed(1),
          i.sharePercent.toFixed(2),
        ]),
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigateToView('home')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-900 dark:hover:text-white shadow-xs"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                  Relatório de Estoque, Valorização &amp; Curva ABC
                </h1>
                <span className="rounded-md bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                  Inventário &amp; Giro
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                Capital imobilizado a preço de custo, potencial de venda, margem bruta e classificação ABC de relevância financeira.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportInventoryCsv}
              disabled={filteredAbcItems.length === 0}
              className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Exportar Planilha ABC</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir</span>
            </Button>
          </div>
        </div>

        {/* KPIs DE ESTOQUE */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Custo Imobilizado</span>
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-300">
                  <Boxes className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {formatCurrency(inventoryAnalytics.grandTotalCostValue.toFixed(2))}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                {inventoryAnalytics.totalSkus} SKUs • {inventoryAnalytics.totalUnits.toFixed(0)} un. físicas
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Potencial de Venda</span>
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/60 p-2 text-blue-600 dark:text-blue-400">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                {formatCurrency(inventoryAnalytics.grandTotalSaleValue.toFixed(2))}
              </h3>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                Lucro Potencial: {formatCurrency(inventoryAnalytics.grandTotalPotentialProfit.toFixed(2))}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Distribuição Curva ABC</span>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/60 p-2 text-amber-600 dark:text-amber-400">
                  <Layers className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-2">
                A: {inventoryAnalytics.classACount} • B: {inventoryAnalytics.classBCount} • C:{' '}
                {inventoryAnalytics.classCCount}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                Classe A representa 80% do valor em estoque
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Alertas de Reposição</span>
                <div className="rounded-lg bg-rose-50 dark:bg-rose-950/60 p-2 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">
                {inventoryAnalytics.outOfStockCount + inventoryAnalytics.lowStockCount} itens
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                {inventoryAnalytics.outOfStockCount} zerados • {inventoryAnalytics.lowStockCount} abaixo do mínimo
              </p>
            </CardContent>
          </Card>
        </div>

        {/* FILTROS DE CURVA ABC E ESTOQUE */}
        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs print:hidden">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar produto por nome, SKU ou categoria..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex rounded-xl border border-gray-200 dark:border-slate-700 p-0.5 bg-gray-50 dark:bg-slate-800 text-xs font-semibold">
                {(['all', 'A', 'B', 'C'] as const).map((cls) => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setInventoryAbcFilter(cls)}
                    className={`rounded-lg px-2.5 py-1.5 ${
                      inventoryAbcFilter === cls
                        ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs'
                        : 'text-gray-600 dark:text-slate-400'
                    }`}
                  >
                    {cls === 'all' ? 'Todas Classes' : `Curva ${cls}`}
                  </button>
                ))}
              </div>

              <select
                value={inventoryStockFilter}
                onChange={(e) =>
                  setInventoryStockFilter(e.target.value as 'all' | 'critical' | 'out' | 'normal')
                }
                className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200"
              >
                <option value="all">Qualquer Saldo</option>
                <option value="critical">Críticos (Zerado + Baixo)</option>
                <option value="out">Apenas Zerados</option>
                <option value="normal">Estoque Regular</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* TABELA DE CURVA ABC */}
        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  <th className="px-4 py-3.5 text-center">Curva</th>
                  <th className="px-4 py-3.5">Produto / SKU</th>
                  <th className="px-4 py-3.5">Categoria</th>
                  <th className="px-4 py-3.5 text-right">Saldo Atual</th>
                  <th className="px-4 py-3.5 text-right">Custo Unit.</th>
                  <th className="px-4 py-3.5 text-right">Preço Venda</th>
                  <th className="px-4 py-3.5 text-right">Custo Total</th>
                  <th className="px-4 py-3.5 text-right">Valor em Venda</th>
                  <th className="px-4 py-3.5 text-center">Margem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                {filteredAbcItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                      Nenhum item de estoque encontrado para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredAbcItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                            item.abcClass === 'A'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : item.abcClass === 'B'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {item.abcClass}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900 dark:text-white">{item.name}</div>
                        {item.sku && <div className="text-[10px] font-mono text-gray-400">SKU: {item.sku}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{item.category}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span
                          className={`font-bold ${
                            item.stockStatus === 'out'
                              ? 'text-rose-600'
                              : item.stockStatus === 'low'
                              ? 'text-amber-600'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {item.quantityOnHand} {item.unit}
                        </span>
                        {item.stockStatus !== 'normal' && (
                          <div className="text-[10px] text-rose-500">Mín: {item.minimumQuantity}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-slate-300">
                        {formatCurrency(item.purchasePrice.toFixed(2))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white font-semibold">
                        {formatCurrency(item.unitPrice.toFixed(2))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-slate-300">
                        {formatCurrency(item.totalCostValue.toFixed(2))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(item.totalSaleValue.toFixed(2))}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-[11px] font-bold text-emerald-600">
                        {item.marginPercent.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    )
  }

  // ============================================================================
  // VIEW 4: RELATÓRIO FINANCEIRO, DRE & CONTAS A PAGAR (financial)
  // ============================================================================
  if (currentView === 'financial') {
    const todayIso = new Date().toISOString().slice(0, 10)
    const filteredBills = periodFilteredBills.filter((b) => {
      if (billStatusFilter === 'paid' && b.status !== 'paid') return false
      if (billStatusFilter === 'pending' && b.status !== 'pending') return false
      if (billStatusFilter === 'overdue' && !(b.status === 'pending' && b.dueDate < todayIso)) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        b.description.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        (b.beneficiaryName || '').toLowerCase().includes(q) ||
        (b.supplierName || '').toLowerCase().includes(q)
      )
    })

    const handleExportFinancialCsv = () => {
      exportRowsToCsv(
        `relatorio-financeiro-contas-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          'Descricao',
          'Categoria',
          'Fornecedor / Beneficiario',
          'Vencimento',
          'Status',
          'Valor Original',
          'Valor Pago',
          'Data Pagamento',
          'Meio de Pagamento',
        ],
        filteredBills.map((b) => [
          b.description,
          b.category,
          b.supplierName || b.beneficiaryName || '',
          b.dueDate,
          b.status === 'paid' ? 'Pago' : b.status === 'pending' ? 'Pendente' : 'Cancelado',
          b.amount,
          b.paidAmount || '',
          b.paidAt ? new Date(b.paidAt).toLocaleString('pt-BR') : '',
          b.paymentMethod || '',
        ]),
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigateToView('home')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-900 dark:hover:text-white shadow-xs"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                  Relatório Financeiro, DRE &amp; Contas a Pagar
                </h1>
                <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Fluxo de Caixa
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                Balanço entre receitas operacionais e despesas pagas, análise por categoria e controle de boletos a vencer.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportFinancialCsv}
              disabled={filteredBills.length === 0}
              className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Exportar Contas (CSV)</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir DRE</span>
            </Button>
          </div>
        </div>

        {renderPeriodToolbar()}

        {/* KPIs FINANCEIROS (DRE RESUMIDO) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Total de Entradas</span>
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/60 p-2 text-emerald-600">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                {formatCurrency(financialAnalytics.totalInflows.toFixed(2))}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                Vendas: {formatCurrency(financialAnalytics.salesRevenue.toFixed(2))}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Saídas / Despesas Pagas</span>
                <div className="rounded-lg bg-rose-50 dark:bg-rose-950/60 p-2 text-rose-600">
                  <ArrowDownRight className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">
                {formatCurrency(financialAnalytics.totalOutflows.toFixed(2))}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                {financialAnalytics.paidBillsCount} boletos quitados no período
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Resultado Líquido</span>
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/60 p-2 text-blue-600">
                  <Wallet className="h-4 w-4" />
                </div>
              </div>
              <h3
                className={`text-2xl font-bold mt-2 ${
                  financialAnalytics.netResult >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatCurrency(financialAnalytics.netResult.toFixed(2))}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">Saldo operacional (Entradas - Saídas)</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Contas em Aberto</span>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/60 p-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                {formatCurrency(financialAnalytics.totalBillsPending.toFixed(2))}
              </h3>
              <p className="text-[11px] text-rose-500 font-semibold mt-1">
                Vencidas: {formatCurrency(financialAnalytics.totalBillsOverdue.toFixed(2))} (
                {financialAnalytics.overdueBillsCount})
              </p>
            </CardContent>
          </Card>
        </div>

        {/* DESPESAS POR CATEGORIA */}
        {financialAnalytics.byCategory.length > 0 && (
          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <PieChart className="h-4 w-4 text-emerald-600" />
                <span>Distribuição de Contas e Despesas por Categoria</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {financialAnalytics.byCategory.map((cat) => (
                  <div
                    key={cat.category}
                    className="rounded-xl border border-gray-200 dark:border-slate-800 p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-900 dark:text-white">{cat.category}</span>
                      <span className="text-[11px] font-semibold text-blue-600">
                        {cat.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-sm font-mono font-bold text-gray-900 dark:text-white">
                      {formatCurrency(cat.totalAmount.toFixed(2))}
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-500">
                      <span className="text-emerald-600">Pago: {formatCurrency(cat.totalPaid.toFixed(2))}</span>
                      <span className="text-amber-600">Pend: {formatCurrency(cat.totalPending.toFixed(2))}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* LISTAGEM DE BOLETOS / CONTAS */}
        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs print:hidden">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por descrição, fornecedor ou categoria..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-gray-900 dark:text-white"
              />
            </div>

            <div className="inline-flex rounded-xl border border-gray-200 dark:border-slate-700 p-0.5 bg-gray-50 dark:bg-slate-800 text-xs font-semibold">
              {(['all', 'pending', 'overdue', 'paid'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setBillStatusFilter(st)}
                  className={`rounded-lg px-3 py-1.5 ${
                    billStatusFilter === st
                      ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'text-gray-600 dark:text-slate-400'
                  }`}
                >
                  {st === 'all'
                    ? 'Todas'
                    : st === 'pending'
                    ? 'Pendentes'
                    : st === 'overdue'
                    ? 'Vencidas'
                    : 'Pagas'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  <th className="px-4 py-3.5">Descrição / Beneficiário</th>
                  <th className="px-4 py-3.5">Categoria</th>
                  <th className="px-4 py-3.5">Vencimento</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                {filteredBills.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                      Nenhuma conta ou despesa localizada para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredBills.map((bill) => {
                    const isOverdue = bill.status === 'pending' && bill.dueDate < todayIso
                    return (
                      <tr key={bill.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900 dark:text-white">{bill.description}</div>
                          {(bill.supplierName || bill.beneficiaryName) && (
                            <div className="text-[11px] text-gray-400">
                              {bill.supplierName || bill.beneficiaryName}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-700 dark:text-slate-300">{bill.category}</td>
                        <td className="px-4 py-3 font-mono text-gray-700 dark:text-slate-300">
                          {bill.dueDate.split('-').reverse().join('/')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {bill.status === 'paid' ? (
                            <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              PAGO
                            </span>
                          ) : isOverdue ? (
                            <span className="rounded-full bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                              VENCIDO
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                              A VENCER
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                          {formatCurrency(bill.paidAmount || bill.amount)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    )
  }

  // ============================================================================
  // VIEW 5: RELATÓRIO DE ORÇAMENTOS & ORDENS DE SERVIÇO (quotes-os)
  // ============================================================================
  if (currentView === 'quotes-os') {
    const handleExportQuotesOsCsv = () => {
      if (quotesOsTab === 'quotes') {
        exportRowsToCsv(
          `relatorio-orcamentos-${new Date().toISOString().slice(0, 10)}.csv`,
          ['Numero Orcamento', 'Data', 'Cliente', 'Vendedor', 'Status', 'Total', 'Venda Gerada'],
          periodFilteredQuotes.map((q) => [
            q.quoteNumber,
            new Date(q.createdAt).toLocaleString('pt-BR'),
            q.customerName,
            q.sellerName || q.creatorName || '',
            q.status,
            q.total,
            q.saleNumber || 'Nao',
          ]),
        )
      } else {
        exportRowsToCsv(
          `relatorio-ordens-servico-${new Date().toISOString().slice(0, 10)}.csv`,
          ['Numero OS', 'Data', 'Cliente', 'Equipamento', 'Tecnico', 'Status', 'Total'],
          periodFilteredServiceOrders.map((os) => [
            os.orderNumber,
            new Date(os.createdAt).toLocaleString('pt-BR'),
            os.customerName,
            os.equipmentName,
            os.technicianName || '',
            os.status,
            os.total,
          ]),
        )
      }
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigateToView('home')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-900 dark:hover:text-white shadow-xs"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                  Relatório de Orçamentos &amp; Ordens de Serviço
                </h1>
                <span className="rounded-md bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  Conversão &amp; Oficina
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                Taxa de aprovação de orçamentos comerciais e produtividade de Ordens de Serviço técnicas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportQuotesOsCsv}
              className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Exportar CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir</span>
            </Button>
          </div>
        </div>

        {renderPeriodToolbar()}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <span className="text-xs font-semibold text-gray-500">Orçamentos Emitidos</span>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {quotesOsAnalytics.totalQuotes}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                Total: {formatCurrency(quotesOsAnalytics.totalQuotedValue.toFixed(2))}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <span className="text-xs font-semibold text-gray-500">Taxa de Conversão</span>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                {quotesOsAnalytics.conversionRate.toFixed(1)}%
              </h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">
                {quotesOsAnalytics.approvedQuotesCount} aprovados (
                {formatCurrency(quotesOsAnalytics.approvedQuotedValue.toFixed(2))})
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <span className="text-xs font-semibold text-gray-500">Ordens de Serviço (O.S.)</span>
              <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
                {quotesOsAnalytics.totalOs} O.S.
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                {quotesOsAnalytics.closedOsCount} concluídas • {quotesOsAnalytics.inProgressOsCount} em andamento
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <span className="text-xs font-semibold text-gray-500">Receita em O.S. Concluídas</span>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {formatCurrency(quotesOsAnalytics.closedOsValue.toFixed(2))}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                Volume total em O.S.: {formatCurrency(quotesOsAnalytics.totalOsValue.toFixed(2))}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="inline-flex rounded-xl border border-gray-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-800 text-xs font-bold print:hidden">
          <button
            type="button"
            onClick={() => setQuotesOsTab('quotes')}
            className={`rounded-lg px-4 py-2 transition-colors ${
              quotesOsTab === 'quotes'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 dark:text-slate-300'
            }`}
          >
            Orçamentos ({periodFilteredQuotes.length})
          </button>
          <button
            type="button"
            onClick={() => setQuotesOsTab('os')}
            className={`rounded-lg px-4 py-2 transition-colors ${
              quotesOsTab === 'os'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 dark:text-slate-300'
            }`}
          >
            Ordens de Serviço ({periodFilteredServiceOrders.length})
          </button>
        </div>

        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            {quotesOsTab === 'quotes' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-gray-500">
                    <th className="px-4 py-3.5">Nº Orçamento</th>
                    <th className="px-4 py-3.5">Data</th>
                    <th className="px-4 py-3.5">Cliente</th>
                    <th className="px-4 py-3.5">Vendedor</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                  {periodFilteredQuotes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                        Nenhum orçamento emitido no período selecionado.
                      </td>
                    </tr>
                  ) : (
                    periodFilteredQuotes.map((q) => (
                      <tr key={q.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {q.quoteNumber}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                          {new Date(q.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{q.customerName}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                          {q.sellerName || q.creatorName || '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              q.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : q.status === 'rejected' || q.status === 'expired'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            {q.status === 'approved'
                              ? 'Aprovado'
                              : q.status === 'sent'
                              ? 'Enviado'
                              : q.status === 'draft'
                              ? 'Rascunho'
                              : q.status === 'rejected'
                              ? 'Recusado'
                              : 'Expirado'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                          {formatCurrency(q.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-gray-500">
                    <th className="px-4 py-3.5">Nº O.S.</th>
                    <th className="px-4 py-3.5">Abertura</th>
                    <th className="px-4 py-3.5">Cliente</th>
                    <th className="px-4 py-3.5">Equipamento</th>
                    <th className="px-4 py-3.5">Técnico</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                  {periodFilteredServiceOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                        Nenhuma Ordem de Serviço registrada no período selecionado.
                      </td>
                    </tr>
                  ) : (
                    periodFilteredServiceOrders.map((os) => (
                      <tr key={os.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {os.orderNumber}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                          {new Date(os.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{os.customerName}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{os.equipmentName}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{os.technicianName || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">
                            {os.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                          {formatCurrency(os.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    )
  }

  // ============================================================================
  // VIEW 6: RELATÓRIO DE CLIENTES & FORNECEDORES (customers)
  // ============================================================================
  if (currentView === 'customers') {
    const filteredCustomers = customersAnalytics.ranking.filter((c) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        c.customerName.toLowerCase().includes(q) ||
        (c.document || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      )
    })

    const filteredSuppliers = dataset.suppliers.filter((s) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        s.name.toLowerCase().includes(q) ||
        (s.document || '').toLowerCase().includes(q) ||
        (s.contactName || '').toLowerCase().includes(q)
      )
    })

    const handleExportCrmCsv = () => {
      if (crmTab === 'customers') {
        exportRowsToCsv(
          `relatorio-ranking-clientes-${new Date().toISOString().slice(0, 10)}.csv`,
          [
            'Cliente',
            'Tipo',
            'CPF/CNPJ',
            'Telefone',
            'E-mail',
            'Qtd Compras',
            'Qtd Orcamentos',
            'Qtd OS',
            'Ticket Medio',
            'Total Comprado',
          ],
          filteredCustomers.map((c) => [
            c.customerName,
            c.personType === 'company' ? 'PJ' : 'PF',
            c.document || '',
            c.phone || '',
            c.email || '',
            c.salesCount,
            c.quotesCount,
            c.serviceOrdersCount,
            c.averageTicket.toFixed(2),
            c.totalSpent.toFixed(2),
          ]),
        )
      } else {
        exportRowsToCsv(
          `relatorio-fornecedores-${new Date().toISOString().slice(0, 10)}.csv`,
          ['Fornecedor', 'CNPJ/CPF', 'Contato', 'Telefone', 'E-mail', 'Endereco'],
          filteredSuppliers.map((s) => [
            s.name,
            s.document || '',
            s.contactName || '',
            s.phone || '',
            s.email || '',
            s.address || '',
          ]),
        )
      }
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigateToView('home')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-900 dark:hover:text-white shadow-xs"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                  Relatório de Clientes &amp; Fornecedores
                </h1>
                <span className="rounded-md bg-purple-50 dark:bg-purple-950/60 px-2.5 py-0.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                  CRM &amp; Parceiros
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                Ranking VIP de clientes por faturamento, frequência de compras, ticket médio e base de fornecedores.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCrmCsv}
              className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Exportar CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir</span>
            </Button>
          </div>
        </div>

        {renderPeriodToolbar()}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <span className="text-xs font-semibold text-gray-500">Total de Clientes</span>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {customersAnalytics.totalCustomers}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                PF: {customersAnalytics.individualCount} • PJ: {customersAnalytics.companyCount}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <span className="text-xs font-semibold text-gray-500">Clientes Compradores (Período)</span>
              <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                {customersAnalytics.activeBuyersCount}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">Com compras faturadas no período</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <span className="text-xs font-semibold text-gray-500">Maior Cliente (Top 1)</span>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mt-2 truncate">
                {customersAnalytics.ranking[0]?.customerName || '—'}
              </h3>
              <p className="text-[11px] text-emerald-600 font-bold mt-1">
                {formatCurrency((customersAnalytics.ranking[0]?.totalSpent || 0).toFixed(2))}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5">
              <span className="text-xs font-semibold text-gray-500">Fornecedores Cadastrados</span>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {dataset.suppliers.length}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">Parceiros comerciais ativos</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="inline-flex rounded-xl border border-gray-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setCrmTab('customers')}
              className={`rounded-lg px-4 py-2 transition-colors ${
                crmTab === 'customers' ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-slate-300'
              }`}
            >
              Ranking de Clientes ({filteredCustomers.length})
            </button>
            <button
              type="button"
              onClick={() => setCrmTab('suppliers')}
              className={`rounded-lg px-4 py-2 transition-colors ${
                crmTab === 'suppliers' ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-slate-300'
              }`}
            >
              Fornecedores ({filteredSuppliers.length})
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, CPF/CNPJ ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            {crmTab === 'customers' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-gray-500">
                    <th className="px-4 py-3.5">Posição / Cliente</th>
                    <th className="px-4 py-3.5">Documento</th>
                    <th className="px-4 py-3.5">Contato</th>
                    <th className="px-4 py-3.5 text-center">Compras</th>
                    <th className="px-4 py-3.5 text-right">Ticket Médio</th>
                    <th className="px-4 py-3.5 text-right">Total Comprado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                        Nenhum cliente encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c, idx) => (
                      <tr key={c.customerId} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-950 text-[10px] font-bold text-purple-700 dark:text-purple-300 mr-2">
                            {idx + 1}º
                          </span>
                          {c.customerName}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-600 dark:text-slate-300">
                          {c.document || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{c.phone || c.email || '—'}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold">{c.salesCount}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-slate-300">
                          {formatCurrency(c.averageTicket.toFixed(2))}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(c.totalSpent.toFixed(2))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-gray-500">
                    <th className="px-4 py-3.5">Fornecedor</th>
                    <th className="px-4 py-3.5">CNPJ / Documento</th>
                    <th className="px-4 py-3.5">Responsável</th>
                    <th className="px-4 py-3.5">Telefone / E-mail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                        Nenhum fornecedor encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{s.name}</td>
                        <td className="px-4 py-3 font-mono text-gray-600 dark:text-slate-300">
                          {s.document || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{s.contactName || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                          {s.phone || s.email || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    )
  }

  // ============================================================================
  // VIEW: RELATÓRIO GERAL DE CADASTROS (USUÁRIOS, FUNCIONÁRIOS, FORNECEDORES, CLIENTES)
  // ============================================================================
  if (currentView === 'registrations') {
    const customerMetricsMap = new Map<string, { salesCount: number; totalSpent: number }>()
    for (const item of customersAnalytics.ranking) {
      customerMetricsMap.set(item.customerId, { salesCount: item.salesCount, totalSpent: item.totalSpent })
    }

    const supplierBillsMap = new Map<string, { count: number; total: number }>()
    for (const bill of dataset.bills) {
      if (bill.supplierName) {
        const key = bill.supplierName.trim().toLowerCase()
        const current = supplierBillsMap.get(key) || { count: 0, total: 0 }
        current.count += 1
        current.total += parseFloat(bill.amount) || 0
        supplierBillsMap.set(key, current)
      }
    }

    const filteredUsers = dataset.members.filter((m) => {
      if (dateFilter.preset !== 'all' && !isDateInRange(m.createdAt, dateFilter)) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const roleLabel = m.role === 'admin' ? 'administrador admin' : m.role === 'owner' ? 'proprietário dono' : 'membro'
      return (
        m.displayName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.phone || '').toLowerCase().includes(q) ||
        (m.jobTitle || '').toLowerCase().includes(q) ||
        roleLabel.includes(q)
      )
    })

    const filteredEmployees = dataset.members.filter((m) => {
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

    const filteredSuppliers = dataset.suppliers.filter((s) => {
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

    const filteredCustomers = dataset.customers.filter((c) => {
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

    const handleExportRegistrationsCsv = () => {
      const todayIso = new Date().toISOString().slice(0, 10)
      if (registrationsTab === 'users') {
        exportRowsToCsv(
          `relatorio-cadastros-usuarios-${todayIso}.csv`,
          ['Nome / Usuário', 'E-mail de Login', 'Perfil / Função', 'Cargo', 'Telefone', 'Último Acesso', 'Data de Cadastro', 'Status'],
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
        exportRowsToCsv(
          `relatorio-cadastros-funcionarios-${todayIso}.csv`,
          ['Funcionário', 'Cargo / Função', 'Perfil', 'E-mail', 'Telefone', 'Módulos Autorizados', 'Data de Cadastro'],
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
        exportRowsToCsv(
          `relatorio-cadastros-fornecedores-${todayIso}.csv`,
          ['Fornecedor / Razão Social', 'CNPJ / CPF', 'Contato / Responsável', 'Telefone', 'E-mail', 'Endereço', 'Despesas Registradas', 'Total em Despesas', 'Data de Cadastro'],
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
        exportRowsToCsv(
          `relatorio-cadastros-clientes-${todayIso}.csv`,
          ['Cliente / Razão Social', 'Tipo', 'CPF / CNPJ', 'Telefone / WhatsApp', 'E-mail', 'Endereço', 'Compras Faturadas', 'Total Comprado (R$)', 'Data de Cadastro'],
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

    return (
      <div className="space-y-6">
        {/* CABEÇALHO */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigateToView('home')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-900 dark:hover:text-white shadow-xs"
              title="Voltar para a Central"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                  Relatório Geral de Cadastros
                </h1>
                <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                  Cadastros &amp; Equipe
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                Auditoria cadastral completa de usuários do sistema, equipe de funcionários, fornecedores homologados e carteira de clientes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportRegistrationsCsv}
              className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Exportar CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir</span>
            </Button>
          </div>
        </div>

        {renderPeriodToolbar()}

        {/* 4 CARDS DE KPIS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-500">Fornecedores</span>
                <h3 className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-0.5">
                  {registrationsAnalytics.totalSuppliers}
                </h3>
                <p className="text-[11px] text-gray-500 mt-1">
                  {registrationsAnalytics.suppliersWithCnpjCount} com CNPJ informado
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-500">Carteira de Clientes</span>
                <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                  {registrationsAnalytics.totalCustomers}
                </h3>
                <p className="text-[11px] text-gray-500 mt-1">
                  PF: {registrationsAnalytics.individualCustomersCount} • PJ: {registrationsAnalytics.companyCustomersCount}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* BARRA DE NAVEGAÇÃO DE SUB-ABAS E BUSCA */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="inline-flex rounded-xl border border-gray-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-800 text-xs font-bold overflow-x-auto">
            <button
              type="button"
              onClick={() => setRegistrationsTab('users')}
              className={`rounded-lg px-3.5 py-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                registrationsTab === 'users' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Usuários ({filteredUsers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setRegistrationsTab('employees')}
              className={`rounded-lg px-3.5 py-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                registrationsTab === 'employees' ? 'bg-amber-600 text-white shadow-xs' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
              }`}
            >
              <Briefcase className="h-4 w-4" />
              <span>Funcionários ({filteredEmployees.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setRegistrationsTab('suppliers')}
              className={`rounded-lg px-3.5 py-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                registrationsTab === 'suppliers' ? 'bg-teal-600 text-white shadow-xs' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>Fornecedores ({filteredSuppliers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setRegistrationsTab('customers')}
              className={`rounded-lg px-3.5 py-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                registrationsTab === 'customers' ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Clientes ({filteredCustomers.length})</span>
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, cargo, e-mail, telefone ou documento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* TABELAS ESPECÍFICAS DE CADA ABA */}
        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            {/* ABA 1: USUÁRIOS */}
            {registrationsTab === 'users' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-gray-500">
                    <th className="px-4 py-3.5">Nome / Usuário</th>
                    <th className="px-4 py-3.5">E-mail de Login</th>
                    <th className="px-4 py-3.5 text-center">Perfil de Acesso</th>
                    <th className="px-4 py-3.5">Cargo / Atribuição</th>
                    <th className="px-4 py-3.5">Telefone</th>
                    <th className="px-4 py-3.5">Último Acesso</th>
                    <th className="px-4 py-3.5">Data Cadastro</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                        Nenhum usuário encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.userId} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-xs">
                              {(u.displayName || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span>{u.displayName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-600 dark:text-slate-300">{u.email}</td>
                        <td className="px-4 py-3 text-center">
                          {u.role === 'owner' ? (
                            <span className="rounded-md bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              Proprietário
                            </span>
                          ) : u.role === 'admin' ? (
                            <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              Administrador
                            </span>
                          ) : (
                            <span className="rounded-md bg-gray-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:text-slate-300">
                              Membro
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300 font-medium">
                          {u.jobTitle || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-600 dark:text-slate-300">
                          {u.phone ? formatPhoneNumber(u.phone) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                          {u.lastAccessAt ? new Date(u.lastAccessAt).toLocaleString('pt-BR') : 'Sem registro'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Ativo
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* ABA 2: FUNCIONÁRIOS */}
            {registrationsTab === 'employees' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-gray-500">
                    <th className="px-4 py-3.5">Funcionário / Nome</th>
                    <th className="px-4 py-3.5">Cargo / Função</th>
                    <th className="px-4 py-3.5 text-center">Perfil</th>
                    <th className="px-4 py-3.5">E-mail Corporativo</th>
                    <th className="px-4 py-3.5">Telefone / WhatsApp</th>
                    <th className="px-4 py-3.5 text-center">Módulos Liberados</th>
                    <th className="px-4 py-3.5">Data de Admissão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                        Nenhum funcionário encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((e) => (
                      <tr key={e.userId} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold text-xs">
                              {(e.displayName || 'F').charAt(0).toUpperCase()}
                            </div>
                            <span>{e.displayName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-lg bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            {e.jobTitle || 'Colaborador'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="rounded-md bg-gray-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:text-slate-300">
                            {e.role === 'admin' ? 'Administrador' : e.role === 'owner' ? 'Proprietário' : 'Membro'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-600 dark:text-slate-300">{e.email}</td>
                        <td className="px-4 py-3 font-mono text-gray-600 dark:text-slate-300">
                          {e.phone ? formatPhoneNumber(e.phone) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-slate-300">
                          {e.dashboardModules && e.dashboardModules.length > 0 ? (
                            <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                              {e.dashboardModules.length} módulos
                            </span>
                          ) : (
                            <span className="text-gray-400">Padrão</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                          {e.createdAt ? new Date(e.createdAt).toLocaleDateString('pt-BR') : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* ABA 3: FORNECEDORES */}
            {registrationsTab === 'suppliers' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-gray-500">
                    <th className="px-4 py-3.5">Fornecedor / Razão Social</th>
                    <th className="px-4 py-3.5">CNPJ / CPF</th>
                    <th className="px-4 py-3.5">Responsável / Contato</th>
                    <th className="px-4 py-3.5">Telefone / E-mail</th>
                    <th className="px-4 py-3.5">Endereço / Localização</th>
                    <th className="px-4 py-3.5 text-center">Despesas Cadastradas</th>
                    <th className="px-4 py-3.5">Data Cadastro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                        Nenhum fornecedor encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((s) => {
                      const billInfo = supplierBillsMap.get(s.name.trim().toLowerCase())
                      return (
                        <tr key={s.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                              <span>{s.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-600 dark:text-slate-300">
                            {s.document || '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{s.contactName || '—'}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                            <div>{s.phone ? formatPhoneNumber(s.phone) : '—'}</div>
                            {s.email && <div className="text-[11px] text-gray-400">{s.email}</div>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{s.address || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            {billInfo && billInfo.count > 0 ? (
                              <span className="font-bold text-teal-600 dark:text-teal-400">
                                {billInfo.count} ({formatCurrency(billInfo.total.toFixed(2))})
                              </span>
                            ) : (
                              <span className="text-gray-400">Nenhuma despesa</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                            {s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-BR') : '—'}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* ABA 4: CLIENTES */}
            {registrationsTab === 'customers' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-gray-500">
                    <th className="px-4 py-3.5">Cliente</th>
                    <th className="px-4 py-3.5 text-center">Tipo</th>
                    <th className="px-4 py-3.5">CPF / CNPJ</th>
                    <th className="px-4 py-3.5">Telefone / WhatsApp</th>
                    <th className="px-4 py-3.5">E-mail</th>
                    <th className="px-4 py-3.5">Endereço / Cidade</th>
                    <th className="px-4 py-3.5 text-center">Compras</th>
                    <th className="px-4 py-3.5 text-right">Total Faturado</th>
                    <th className="px-4 py-3.5">Data Cadastro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                        Nenhum cliente encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => {
                      const metrics = customerMetricsMap.get(c.id)
                      return (
                        <tr key={c.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                            {c.name}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {c.personType === 'company' ? (
                              <span className="rounded-md bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:text-purple-300">
                                PJ
                              </span>
                            ) : (
                              <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                                PF
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-600 dark:text-slate-300">
                            {c.document || '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                            {c.phone ? formatPhoneNumber(c.phone) : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{c.email || '—'}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                            {c.address ? `${c.address}${c.addressNumber ? `, ${c.addressNumber}` : ''}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold">
                            {metrics?.salesCount || 0}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency((metrics?.totalSpent || 0).toFixed(2))}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '—'}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    )
  }

  // ============================================================================
  // VIEW PRINCIPAL (HOME): CENTRAL EXECUTIVA DE RELATÓRIOS & BI
  // ============================================================================
  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Central de Relatórios &amp; Inteligência Operacional
            </h1>
            <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300 ring-1 ring-blue-600/20">
              MOD-08
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Demonstrativos gerenciais em tempo real com exportação para Excel (CSV), impressão térmica/A4 e análise de Curva ABC.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadData()}
          disabled={isLoading}
          className="rounded-xl flex items-center gap-2 text-xs font-semibold self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Atualizar Indicadores</span>
        </Button>
      </div>

      {/* NAVEGAÇÃO RÁPIDA POR ABAS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-gray-200 dark:border-slate-800 print:hidden">
        {REPORT_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = currentView === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateToView(item.id)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:text-white'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
              <span>{item.label}</span>
              {item.badge && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* BARRA DE PERÍODO */}
      {renderPeriodToolbar()}

      {/* RESUMO EXECUTIVO NO TOPO */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Faturamento no Período</p>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                {formatCurrency(salesAnalytics.totalRevenue.toFixed(2))}
              </h3>
              <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                {salesAnalytics.salesCount} vendas • Ticket {formatCurrency(salesAnalytics.averageTicket.toFixed(2))}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Resultado Líquido (Caixa)</p>
              <h3
                className={`text-xl font-bold mt-0.5 ${
                  financialAnalytics.netResult >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatCurrency(financialAnalytics.netResult.toFixed(2))}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-slate-400">
                Saídas pagas: {formatCurrency(financialAnalytics.totalOutflows.toFixed(2))}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Patrimônio em Estoque</p>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                {formatCurrency(inventoryAnalytics.grandTotalSaleValue.toFixed(2))}
              </h3>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                Custo: {formatCurrency(inventoryAnalytics.grandTotalCostValue.toFixed(2))}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Conversão de Orçamentos</p>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                {quotesOsAnalytics.conversionRate.toFixed(1)}%
              </h3>
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                {quotesOsAnalytics.approvedQuotesCount} de {quotesOsAnalytics.totalQuotes} aprovados
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GRADE COMPLETA DOS 6 MÓDULOS DE RELATÓRIOS */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {/* CARD 1: RELATÓRIO DE VENDAS E FATURAMENTO */}
        {canViewSalesReport && (
          <Card className="rounded-2xl shadow-xs hover:shadow-md transition-shadow border-gray-200 dark:border-slate-800">
            <CardContent className="flex h-full flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-3 text-blue-700 dark:text-blue-400">
                  <ShoppingCart className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-blue-800 dark:text-blue-300">
                  FATURAMENTO &amp; PDV
                </span>
              </div>
              <h2 className="mt-4 text-base font-bold tracking-wide text-gray-900 dark:text-white">
                RELATÓRIO DE VENDAS &amp; RECEITA
              </h2>
              <p className="mt-2 flex-1 text-xs leading-5 text-gray-600 dark:text-slate-400">
                Demonstrativo completo de vendas faturadas, divisão por forma de pagamento (PIX, Dinheiro, Cartão), ranking de vendedores, ticket médio e evolução diária.
              </p>
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500">
                <span>No período: <b>{salesAnalytics.salesCount} vendas</b></span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(salesAnalytics.totalRevenue.toFixed(2))}
                </span>
              </div>
              <div className="mt-4">
                <Button
                  size="sm"
                  onClick={() => navigateToView('sales')}
                  className="w-full justify-between rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
                >
                  <span className="inline-flex items-center gap-2">
                    <FileBarChart className="h-4 w-4" />
                    Abrir Relatório de Vendas
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CARD 2: RELATÓRIO DE ESTOQUE & CURVA ABC */}
        {canViewInventoryReport && (
          <Card className="rounded-2xl shadow-xs hover:shadow-md transition-shadow border-gray-200 dark:border-slate-800">
            <CardContent className="flex h-full flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/60 p-3 text-amber-700 dark:text-amber-400">
                  <Boxes className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-amber-50 dark:bg-amber-950/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-800 dark:text-amber-300">
                  ESTOQUE &amp; CURVA ABC
                </span>
              </div>
              <h2 className="mt-4 text-base font-bold tracking-wide text-gray-900 dark:text-white">
                ESTOQUE, VALORIZAÇÃO &amp; ABC
              </h2>
              <p className="mt-2 flex-1 text-xs leading-5 text-gray-600 dark:text-slate-400">
                Análise de capital investido em mercadorias, lucro bruto projetado, classificação na Curva ABC (80/15/5) e itens críticos para reposição imediata.
              </p>
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500">
                <span>Itens ativos: <b>{inventoryAnalytics.totalSkus} SKUs</b></span>
                <span className="font-semibold text-rose-600">
                  {inventoryAnalytics.outOfStockCount + inventoryAnalytics.lowStockCount} alertas
                </span>
              </div>
              <div className="mt-4">
                <Button
                  size="sm"
                  onClick={() => navigateToView('inventory')}
                  className="w-full justify-between rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-xs"
                >
                  <span className="inline-flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Abrir Curva ABC &amp; Estoque
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CARD 3: RELATÓRIO FINANCEIRO, DRE & CONTAS */}
        <Card className="rounded-2xl shadow-xs hover:shadow-md transition-shadow border-gray-200 dark:border-slate-800">
          <CardContent className="flex h-full flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-3 text-emerald-700 dark:text-emerald-400">
                <Wallet className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-800 dark:text-emerald-300">
                DRE &amp; FLUXO DE CAIXA
              </span>
            </div>
            <h2 className="mt-4 text-base font-bold tracking-wide text-gray-900 dark:text-white">
              FINANCEIRO &amp; CONTAS A PAGAR
            </h2>
            <p className="mt-2 flex-1 text-xs leading-5 text-gray-600 dark:text-slate-400">
              Demonstrativo de entradas vs saídas, resultado operacional líquido, despesas agrupadas por categoria (Água, Luz, Fornecedores, Impostos) e boletos vencidos.
            </p>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500">
              <span>Contas pendentes: <b>{financialAnalytics.pendingBillsCount}</b></span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(financialAnalytics.totalBillsPending.toFixed(2))}
              </span>
            </div>
            <div className="mt-4">
              <Button
                size="sm"
                onClick={() => navigateToView('financial')}
                className="w-full justify-between rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
              >
                <span className="inline-flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Abrir Demonstrativo Financeiro
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* CARD 4: RELATÓRIO DO USUÁRIO (RESUMOS DE CAIXA / TURNOS) */}
        <Card className="rounded-2xl shadow-xs hover:shadow-md transition-shadow border-gray-200 dark:border-slate-800">
          <CardContent className="flex h-full flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-xl bg-teal-50 dark:bg-teal-950/60 p-3 text-teal-700 dark:text-teal-400">
                <Receipt className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-teal-50 dark:bg-teal-950/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-teal-800 dark:text-teal-300">
                OPERADOR &amp; CAIXA
              </span>
            </div>
            <h2 className="mt-4 text-base font-bold tracking-wide text-gray-900 dark:text-white">
              RESUMOS DE CAIXA &amp; TURNOS
            </h2>
            <p className="mt-2 flex-1 text-xs leading-5 text-gray-600 dark:text-slate-400">
              Auditoria de fechamentos de turno do PDV, conferência física de gaveta (esperado vs contado), sangrias, suprimentos e justificativas de quebra.
            </p>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500">
              <span>Turnos no período: <b>{periodFilteredSessions.length}</b></span>
              <span className="font-semibold text-teal-600 dark:text-teal-400">Reimpressão 80mm</span>
            </div>
            <div className="mt-4">
              <Button
                size="sm"
                onClick={() => navigateToView('user-sessions')}
                className="w-full justify-between rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-xs"
              >
                <span className="inline-flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Visualizar Resumos de Caixa
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* CARD 5: RELATÓRIO DE ORÇAMENTOS & ORDENS DE SERVIÇO */}
        <Card className="rounded-2xl shadow-xs hover:shadow-md transition-shadow border-gray-200 dark:border-slate-800">
          <CardContent className="flex h-full flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/60 p-3 text-indigo-700 dark:text-indigo-400">
                <ClipboardList className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-indigo-800 dark:text-indigo-300">
                ORÇAMENTOS &amp; O.S.
              </span>
            </div>
            <h2 className="mt-4 text-base font-bold tracking-wide text-gray-900 dark:text-white">
              ORÇAMENTOS &amp; ORDENS DE SERVIÇO
            </h2>
            <p className="mt-2 flex-1 text-xs leading-5 text-gray-600 dark:text-slate-400">
              Funil comercial de propostas (aprovadas, pendentes e recusadas), taxa de fechamento e produtividade técnica das Ordens de Serviço.
            </p>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500">
              <span>Orçamentos: <b>{quotesOsAnalytics.totalQuotes}</b></span>
              <span>O.S.: <b>{quotesOsAnalytics.totalOs}</b></span>
            </div>
            <div className="mt-4">
              <Button
                size="sm"
                onClick={() => navigateToView('quotes-os')}
                className="w-full justify-between rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-xs"
              >
                <span className="inline-flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Abrir Funil &amp; Ordens de Serviço
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* CARD 6: RELATÓRIO DE CLIENTES & FORNECEDORES */}
        <Card className="rounded-2xl shadow-xs hover:shadow-md transition-shadow border-gray-200 dark:border-slate-800">
          <CardContent className="flex h-full flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-xl bg-purple-50 dark:bg-purple-950/60 p-3 text-purple-700 dark:text-purple-400">
                <Users className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-purple-50 dark:bg-purple-950/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-purple-800 dark:text-purple-300">
                CLIENTES &amp; CRM
              </span>
            </div>
            <h2 className="mt-4 text-base font-bold tracking-wide text-gray-900 dark:text-white">
              RANKING DE CLIENTES &amp; PARCEIROS
            </h2>
            <p className="mt-2 flex-1 text-xs leading-5 text-gray-600 dark:text-slate-400">
              Curva de clientes mais rentáveis (VIP), volume acumulado de compras, ticket médio por cliente, frequência e relação cadastral de fornecedores.
            </p>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500">
              <span>Carteira: <b>{customersAnalytics.totalCustomers} clientes</b></span>
              <span>Fornecedores: <b>{dataset.suppliers.length}</b></span>
            </div>
            <div className="mt-4">
              <Button
                size="sm"
                onClick={() => navigateToView('customers')}
                className="w-full justify-between rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-xs"
              >
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Abrir Ranking de Clientes
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* CARD 7: RELATÓRIO DE CADASTROS (USUÁRIOS, FUNCIONÁRIOS, FORNECEDORES, CLIENTES) */}
        <Card className="rounded-2xl shadow-xs hover:shadow-md transition-shadow border-gray-200 dark:border-slate-800 border-l-4 border-l-blue-600">
          <CardContent className="flex h-full flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-3 text-blue-700 dark:text-blue-400">
                <Users className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-blue-800 dark:text-blue-300">
                CADASTROS &amp; EQUIPE
              </span>
            </div>
            <h2 className="mt-4 text-base font-bold tracking-wide text-gray-900 dark:text-white">
              RELATÓRIO GERAL DE CADASTROS
            </h2>
            <p className="mt-2 flex-1 text-xs leading-5 text-gray-600 dark:text-slate-400">
              Painel analítico e auditoria de cadastros: usuários de acesso, funcionários com atribuição de cargos, fornecedores parceiros e carteira completa de clientes.
            </p>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs text-gray-500">
              <span>Usuários: <b>{registrationsAnalytics.totalUsers}</b></span>
              <span>Funcionários: <b>{registrationsAnalytics.employeesCount}</b></span>
              <span>Fornecedores: <b>{registrationsAnalytics.totalSuppliers}</b></span>
              <span>Clientes: <b>{registrationsAnalytics.totalCustomers}</b></span>
            </div>
            <div className="mt-4">
              <Button
                size="sm"
                onClick={() => navigateToView('registrations')}
                className="w-full justify-between rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
              >
                <span className="inline-flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Abrir Relatório de Cadastros
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
