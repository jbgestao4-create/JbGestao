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
import { Button } from '@shared/components/ui/Button'
import {
  BarChart3,
  Boxes,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileBarChart,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import { ReportPrintHeader } from '../components/ReportPrintHeader'
import { ReportPrintFooter } from '../components/ReportPrintFooter'
import { ReportActionBar } from '../components/ReportActionBar'
import { CashManagementReportView } from '../components/CashManagementReportView'
import { SalesMainChartView } from '../components/SalesMainChartView'

// Tipos principais de relatórios conforme solicitado pelo usuário
export type ReportView =
  | 'home'
  | 'registrations'
  | 'financial'
  | 'inventory_services'
  | 'cash_management'
  | 'sales_chart'

// Abas de cada tipo de relatório
export type RegistrationsTab = 'users' | 'employees' | 'suppliers' | 'customers'
export type FinancialTab = 'orders' | 'quotes' | 'sales'
export type InventoryServicesTab = 'movements' | 'inventory' | 'services'

// Filtros específicos para Estoque e Serviço
export type ItemTypeFilter = 'all' | 'material' | 'service'
export type DateTypeFilter = 'movement' | 'registration'

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

  // Sincronização da View atual
  const rawView = searchParams.get('view')
  const currentView: ReportView =
    rawView === 'registrations' || rawView === 'cadastros' || rawView === 'cadastrais'
      ? 'registrations'
      : rawView === 'financial' ||
          rawView === 'financeiros' ||
          rawView === 'quotes_orders' ||
          rawView === 'os_orcamentos' ||
          rawView === 'os' ||
          rawView === 'vendas' ||
          rawView === 'orcamentos'
        ? 'financial'
        : rawView === 'inventory_services' ||
            rawView === 'estoque_servicos' ||
            rawView === 'inventory' ||
            rawView === 'estoque' ||
            rawView === 'servicos'
          ? 'inventory_services'
          : rawView === 'cash_management' || rawView === 'caixa'
            ? 'cash_management'
            : rawView === 'sales_chart' || rawView === 'grafico_vendas'
              ? 'sales_chart'
              : 'home'

  // ============================================================================
  // 1. RELATÓRIOS CADASTRAIS (Usuários, Funcionários, Fornecedores, Clientes)
  // ============================================================================
  const rawRegTab = searchParams.get('tab')
  const initialRegTab: RegistrationsTab =
    rawRegTab === 'employees' || rawRegTab === 'suppliers' || rawRegTab === 'customers'
      ? rawRegTab
      : 'users'

  const [registrationsTab, setRegistrationsTab] = useState<RegistrationsTab>(initialRegTab)
  const [regSearchQuery, setRegSearchQuery] = useState('')
  const [regDateFilter, setRegDateFilter] = useState<DateRangeFilter>(() => {
    const initial = getPresetDateRange('month')
    return {
      preset: 'month',
      startDate: initial.startDate,
      endDate: initial.endDate,
    }
  })

  // ============================================================================
  // 2. RELATÓRIOS FINANCEIROS (O.S, Orçamentos, Vendas)
  // ============================================================================
  const rawFinTab = searchParams.get('tab')
  const initialFinTab: FinancialTab =
    rawFinTab === 'quotes' || rawFinTab === 'orcamentos'
      ? 'quotes'
      : rawFinTab === 'sales' || rawFinTab === 'vendas'
        ? 'sales'
        : 'orders'

  const [financialTab, setFinancialTab] = useState<FinancialTab>(initialFinTab)
  const [finSearchQuery, setFinSearchQuery] = useState('')
  const [finStatusFilter, setFinStatusFilter] = useState('all')
  const [finPeriodMode, setFinPeriodMode] = useState<'presets' | 'day' | 'month' | 'custom'>('presets')
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], [])
  const currentMonthIso = useMemo(() => new Date().toISOString().slice(0, 7), [])
  const [finSelectedDay, setFinSelectedDay] = useState(todayIso)
  const [finSelectedMonth, setFinSelectedMonth] = useState(currentMonthIso)
  const [finDateFilter, setFinDateFilter] = useState<DateRangeFilter>(() => {
    const initial = getPresetDateRange('month')
    return {
      preset: 'month',
      startDate: initial.startDate,
      endDate: initial.endDate,
    }
  })

  // ============================================================================
  // 3. RELATÓRIO DE ESTOQUE E SERVIÇO (Movimentações, Estoque Atual, Serviços)
  // ============================================================================
  const rawInvTab = searchParams.get('tab')
  const initialInvTab: InventoryServicesTab =
    rawInvTab === 'inventory' || rawInvTab === 'estoque'
      ? 'inventory'
      : rawInvTab === 'services' || rawInvTab === 'servicos'
        ? 'services'
        : 'movements'

  const [invServicesTab, setInvServicesTab] = useState<InventoryServicesTab>(initialInvTab)
  const [invItemType, setInvItemType] = useState<ItemTypeFilter>('all') // Material ou Serviço
  const [invDateField, setInvDateField] = useState<DateTypeFilter>('movement') // Data Saída ou Cadastro
  const [invSearchQuery, setInvSearchQuery] = useState('')
  const [invStockStatus, setInvStockStatus] = useState<'all' | 'normal' | 'low' | 'out'>('all')
  const [invDateFilter, setInvDateFilter] = useState<DateRangeFilter>(() => {
    const initial = getPresetDateRange('month')
    return {
      preset: 'month',
      startDate: initial.startDate,
      endDate: initial.endDate,
    }
  })

  // Dataset e Controle de Carregamento
  const [dataset, setDataset] = useState<ReportsDataset>({
    sales: [],
    inventory: [],
    bills: [],
    cashEntries: [],
    cashSessions: [],
    cashMovements: [],
    quotes: [],
    serviceOrders: [],
    customers: [],
    suppliers: [],
    members: [],
    services: [],
    quoteItems: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [printOrientationMode, setPrintOrientationMode] = useState<'auto' | 'portrait' | 'landscape'>('auto')

  // Auto-ajuste de orientação do papel
  const isWideReport = useMemo(() => {
    if (currentView === 'financial') return true
    if (currentView === 'inventory_services') return true
    if (currentView === 'cash_management') return true
    if (currentView === 'sales_chart') return true
    if (currentView === 'registrations') {
      return registrationsTab === 'customers' || registrationsTab === 'suppliers'
    }
    return false
  }, [currentView, registrationsTab])

  const effectiveOrientation: 'portrait' | 'landscape' = useMemo(() => {
    if (printOrientationMode === 'auto') {
      return isWideReport ? 'landscape' : 'portrait'
    }
    return printOrientationMode
  }, [printOrientationMode, isWideReport])

  // Aplica classe de orientação CSS para impressão A4
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('print-landscape', 'print-portrait')
    if (effectiveOrientation === 'landscape') {
      root.classList.add('print-landscape')
    } else {
      root.classList.add('print-portrait')
    }
    return () => {
      root.classList.remove('print-landscape', 'print-portrait')
    }
  }, [effectiveOrientation])

  // Carregamento de dados completos
  const loadData = useCallback(async () => {
    if (!currentOrganization) return
    setIsLoading(true)
    try {
      const data = await reportsService.loadAllReportData(currentOrganization.id)
      setDataset(data)
    } finally {
      setIsLoading(false)
    }
  }, [currentOrganization])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Navegação entre Views e Abas
  const navigateToView = (view: ReportView, tab?: string) => {
    const next: Record<string, string> = { view }
    if (tab) next.tab = tab
    setSearchParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePrintReport = () => {
    window.print()
  }

  // ============================================================================
  // CÁLCULOS E FILTRAGEM: RELATÓRIOS CADASTRAIS
  // ============================================================================
  const customerMetricsMap = useMemo(() => {
    const map = new Map<string, { totalSpent: number; salesCount: number; quotesCount: number }>()
    for (const s of dataset.sales) {
      if (s.status !== 'rejected') {
        const val = parseFloat(s.total) || 0
        const prev = map.get(s.customerId) || { totalSpent: 0, salesCount: 0, quotesCount: 0 }
        map.set(s.customerId, { ...prev, totalSpent: prev.totalSpent + val, salesCount: prev.salesCount + 1 })
      }
    }
    for (const q of dataset.quotes) {
      const prev = map.get(q.customerId) || { totalSpent: 0, salesCount: 0, quotesCount: 0 }
      map.set(q.customerId, { ...prev, quotesCount: prev.quotesCount + 1 })
    }
    return map
  }, [dataset.sales, dataset.quotes])

  const filteredUsers = useMemo(() => {
    return dataset.members.filter((u) => {
      if (!isDateInRange(u.createdAt, regDateFilter)) return false
      if (!regSearchQuery) return true
      const q = regSearchQuery.toLowerCase()
      return (
        u.email.toLowerCase().includes(q) ||
        (u.displayName && u.displayName.toLowerCase().includes(q)) ||
        u.role.toLowerCase().includes(q)
      )
    })
  }, [dataset.members, regDateFilter, regSearchQuery])

  const filteredEmployees = useMemo(() => {
    return dataset.members
      .filter((m) => m.role !== 'owner')
      .filter((e) => {
        if (!isDateInRange(e.createdAt, regDateFilter)) return false
        if (!regSearchQuery) return true
        const q = regSearchQuery.toLowerCase()
        return (
          e.email.toLowerCase().includes(q) ||
          (e.displayName && e.displayName.toLowerCase().includes(q)) ||
          e.role.toLowerCase().includes(q)
        )
      })
  }, [dataset.members, regDateFilter, regSearchQuery])

  const filteredSuppliers = useMemo(() => {
    return dataset.suppliers.filter((s) => {
      if (!isDateInRange(s.createdAt, regDateFilter)) return false
      if (!regSearchQuery) return true
      const q = regSearchQuery.toLowerCase()
      return (
        s.name.toLowerCase().includes(q) ||
        (s.document && s.document.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q))
      )
    })
  }, [dataset.suppliers, regDateFilter, regSearchQuery])

  const filteredCustomers = useMemo(() => {
    return dataset.customers.filter((c) => {
      if (!isDateInRange(c.createdAt, regDateFilter)) return false
      if (!regSearchQuery) return true
      const q = regSearchQuery.toLowerCase()
      return (
        c.name.toLowerCase().includes(q) ||
        (c.document && c.document.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q))
      )
    })
  }, [dataset.customers, regDateFilter, regSearchQuery])

  const regAnalytics = useMemo(() => {
    const totalSpentCustomers = filteredCustomers.reduce(
      (sum, c) => sum + (customerMetricsMap.get(c.id)?.totalSpent || 0),
      0,
    )
    return {
      usersCount: filteredUsers.length,
      employeesCount: filteredEmployees.length,
      suppliersCount: filteredSuppliers.length,
      customersCount: filteredCustomers.length,
      totalSpentCustomers,
    }
  }, [filteredUsers, filteredEmployees, filteredSuppliers, filteredCustomers, customerMetricsMap])

  // Exportações Cadastrais
  const handleExportCadastrosExcel = () => {
    const timestamp = todayIso
    if (registrationsTab === 'users') {
      exportRowsToExcel(
        `relatorio_usuarios_${timestamp}`,
        ['Nome / Exibição', 'E-mail', 'Papel', 'Status', 'Data Cadastro'],
        filteredUsers.map((u) => [
          u.displayName || u.email.split('@')[0],
          u.email,
          u.role,
          'Ativo',
          u.createdAt.split('T')[0],
        ]),
      )
    } else if (registrationsTab === 'employees') {
      exportRowsToExcel(
        `relatorio_funcionarios_${timestamp}`,
        ['Nome', 'E-mail', 'Cargo', 'Data Cadastro'],
        filteredEmployees.map((e) => [
          e.displayName || e.email.split('@')[0],
          e.email,
          e.role,
          e.createdAt.split('T')[0],
        ]),
      )
    } else if (registrationsTab === 'suppliers') {
      exportRowsToExcel(
        `relatorio_fornecedores_${timestamp}`,
        ['Razão Social', 'CPF/CNPJ', 'Telefone', 'E-mail', 'Endereço', 'Data Cadastro'],
        filteredSuppliers.map((s) => [
          s.name,
          s.document || '-',
          s.phone || '-',
          s.email || '-',
          s.address || '-',
          s.createdAt.split('T')[0],
        ]),
      )
    } else {
      exportRowsToExcel(
        `relatorio_clientes_${timestamp}`,
        ['Cliente', 'CPF/CNPJ', 'Telefone', 'E-mail', 'Total Compras', 'Data Cadastro'],
        filteredCustomers.map((c) => [
          c.name,
          c.document || '-',
          c.phone || '-',
          c.email || '-',
          formatCurrency(customerMetricsMap.get(c.id)?.totalSpent || 0),
          c.createdAt.split('T')[0],
        ]),
      )
    }
  }

  const handleExportCadastrosXml = () => {
    const timestamp = todayIso
    if (registrationsTab === 'users') {
      exportRowsToXml(
        `relatorio_usuarios_${timestamp}`,
        'Usuarios',
        'Usuario',
        ['Nome / Exibição', 'E-mail', 'Papel', 'Data Cadastro'],
        filteredUsers.map((u) => [
          u.displayName || u.email.split('@')[0],
          u.email,
          u.role,
          u.createdAt.split('T')[0],
        ]),
      )
    } else if (registrationsTab === 'employees') {
      exportRowsToXml(
        `relatorio_funcionarios_${timestamp}`,
        'Funcionarios',
        'Funcionario',
        ['Nome', 'E-mail', 'Cargo', 'Data Cadastro'],
        filteredEmployees.map((e) => [
          e.displayName || e.email.split('@')[0],
          e.email,
          e.role,
          e.createdAt.split('T')[0],
        ]),
      )
    } else if (registrationsTab === 'suppliers') {
      exportRowsToXml(
        `relatorio_fornecedores_${timestamp}`,
        'Fornecedores',
        'Fornecedor',
        ['Razao', 'Documento', 'Telefone', 'Email', 'DataCadastro'],
        filteredSuppliers.map((s) => [
          s.name,
          s.document || '',
          s.phone || '',
          s.email || '',
          s.createdAt.split('T')[0],
        ]),
      )
    } else {
      exportRowsToXml(
        `relatorio_clientes_${timestamp}`,
        'Clientes',
        'Cliente',
        ['Nome', 'Documento', 'Telefone', 'Email', 'TotalCompras', 'DataCadastro'],
        filteredCustomers.map((c) => [
          c.name,
          c.document || '',
          c.phone || '',
          c.email || '',
          (customerMetricsMap.get(c.id)?.totalSpent || 0).toFixed(2),
          c.createdAt.split('T')[0],
        ]),
      )
    }
  }

  // ============================================================================
  // CÁLCULOS E FILTRAGEM: RELATÓRIOS FINANCEIROS (O.S, Orçamentos, Vendas)
  // ============================================================================
  const finEffectiveRange = useMemo<DateRangeFilter & { label: string }>(() => {
    if (finPeriodMode === 'day') {
      return { preset: 'custom', startDate: finSelectedDay, endDate: finSelectedDay, label: `Dia ${finSelectedDay.split('-').reverse().join('/')}` }
    }
    if (finPeriodMode === 'month') {
      const [year, month] = finSelectedMonth.split('-')
      const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate()
      const startDate = `${finSelectedMonth}-01`
      const endDate = `${finSelectedMonth}-${String(lastDay).padStart(2, '0')}`
      return { preset: 'custom', startDate, endDate, label: `Mês ${month}/${year}` }
    }
    return {
      preset: finDateFilter.preset,
      startDate: finDateFilter.startDate,
      endDate: finDateFilter.endDate,
      label: `${finDateFilter.startDate.split('-').reverse().join('/')} a ${finDateFilter.endDate.split('-').reverse().join('/')}`,
    }
  }, [finPeriodMode, finSelectedDay, finSelectedMonth, finDateFilter])

  interface UnifiedFinancialRecord {
    id: string
    kind: 'order' | 'quote' | 'sale'
    number: string
    date: string
    customerName: string
    customerDocument: string | null
    status: string
    statusLabel: string
    statusBadgeClass: string
    responsiblePerson: string | null
    description: string
    subtotal: number
    discount: number
    total: number
    paymentMethod?: string
    itemsCount?: number
    isPdv?: boolean
  }

  const allFinancialRecords = useMemo<UnifiedFinancialRecord[]>(() => {
    const list: UnifiedFinancialRecord[] = []

    // 1. Ordens de Serviço (O.S)
    for (const os of dataset.serviceOrders) {
      let statusLabel = 'Pendente'
      let statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200'
      if (os.status === 'queue') {
        statusLabel = 'Fila de Atendimento'
        statusBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200'
      } else if (os.status === 'in_maintenance') {
        statusLabel = 'Em Manutenção'
        statusBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200'
      } else if (os.status === 'ready') {
        statusLabel = 'Pronto / Finalizado'
        statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'
      } else if (os.status === 'closed') {
        statusLabel = 'Encerrada'
        statusBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200'
      }

      const desc = [os.equipmentName, os.equipmentModel, os.reportedProblem].filter(Boolean).join(' - ') || 'Serviços & Manutenção'
      list.push({
        id: os.id,
        kind: 'order',
        number: os.orderNumber ? `#OS-${os.orderNumber}` : `#OS-${os.id.slice(0, 6)}`,
        date: os.createdAt,
        customerName: os.customerName || 'Cliente sem identificação',
        customerDocument: os.customerDocument || null,
        status: os.status,
        statusLabel,
        statusBadgeClass,
        responsiblePerson: os.technicianName || os.creatorName || null,
        description: desc,
        subtotal: parseFloat(String(os.subtotal || os.total || '0')) || 0,
        discount: parseFloat(String(os.discount || '0')) || 0,
        total: parseFloat(String(os.total || '0')) || 0,
      })
    }

    // 2. Orçamentos
    for (const q of dataset.quotes) {
      let statusLabel = 'Em Aberto'
      let statusBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200'
      if (q.status === 'approved') {
        statusLabel = 'Aprovado'
        statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'
      } else if (q.status === 'rejected') {
        statusLabel = 'Rejeitado'
        statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200'
      } else if (q.status === 'expired') {
        statusLabel = 'Expirado'
        statusBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200'
      }

      list.push({
        id: q.id,
        kind: 'quote',
        number: q.quoteNumber ? `#${q.quoteNumber}` : `#ORC-${q.id.slice(0, 6)}`,
        date: q.createdAt,
        customerName: q.customerName || 'Cliente sem identificação',
        customerDocument: null,
        status: q.status,
        statusLabel,
        statusBadgeClass,
        responsiblePerson: q.creatorName || null,
        description: 'Orçamento Comercial / Proposta',
        subtotal: parseFloat(String(q.subtotal || q.total || '0')) || 0,
        discount: parseFloat(String(q.discount || '0')) || 0,
        total: parseFloat(String(q.total || '0')) || 0,
      })
    }

    // 3. Vendas Realizadas
    for (const s of dataset.sales) {
      let statusLabel = 'Concluída'
      let statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'
      if (s.status === 'rejected') {
        statusLabel = 'Cancelada'
        statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200'
      } else if (s.status === 'expired') {
        statusLabel = 'Expirada'
        statusBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200'
      }

      list.push({
        id: s.id,
        kind: 'sale',
        number: s.saleNumber || `#VEN-${s.id.slice(0, 6)}`,
        date: s.createdAt,
        customerName: s.customerName || 'Consumidor Final',
        customerDocument: s.customerDocument || null,
        status: s.status,
        statusLabel,
        statusBadgeClass,
        responsiblePerson: s.sellerName || s.creatorName || null,
        description: s.isPdv ? 'Venda Terminal PDV' : 'Venda Balcão / Faturamento',
        subtotal: parseFloat(String(s.subtotal || s.total || '0')) || 0,
        discount: parseFloat(String(s.discount || '0')) || 0,
        total: parseFloat(String(s.total || '0')) || 0,
        paymentMethod: s.paymentMethod,
        itemsCount: s.itemsCount,
        isPdv: s.isPdv,
      })
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [dataset.serviceOrders, dataset.quotes, dataset.sales])

  const filteredFinancialRecords = useMemo(() => {
    return allFinancialRecords.filter((rec) => {
      // 1. Filtro da Aba Selecionada (O.S / Orçamentos / Vendas)
      if (financialTab === 'orders' && rec.kind !== 'order') return false
      if (financialTab === 'quotes' && rec.kind !== 'quote') return false
      if (financialTab === 'sales' && rec.kind !== 'sale') return false

      // 2. Filtro de Período
      if (!isDateInRange(rec.date, finEffectiveRange)) {
        return false
      }

      // 3. Filtro de Status
      if (finStatusFilter !== 'all' && rec.status !== finStatusFilter) {
        return false
      }

      // 4. Busca Textual
      if (finSearchQuery.trim()) {
        const q = finSearchQuery.toLowerCase().trim()
        const matchNum = rec.number.toLowerCase().includes(q)
        const matchCust = rec.customerName.toLowerCase().includes(q)
        const matchDesc = rec.description.toLowerCase().includes(q)
        const matchResp = rec.responsiblePerson?.toLowerCase().includes(q) || false
        if (!matchNum && !matchCust && !matchDesc && !matchResp) return false
      }

      return true
    })
  }, [allFinancialRecords, financialTab, finEffectiveRange, finStatusFilter, finSearchQuery])

  const financialMetrics = useMemo(() => {
    const totalVolume = filteredFinancialRecords.reduce((sum, r) => sum + r.total, 0)
    const count = filteredFinancialRecords.length
    const averageTicket = count > 0 ? totalVolume / count : 0
    const approvedOrClosedCount = filteredFinancialRecords.filter(
      (r) => r.status === 'approved' || r.status === 'closed' || r.status === 'ready' || r.kind === 'sale',
    ).length

    return {
      totalVolume,
      count,
      averageTicket,
      approvedOrClosedCount,
    }
  }, [filteredFinancialRecords])

  const handleExportFinExcel = () => {
    const timestamp = todayIso
    const tabName = financialTab === 'orders' ? 'Ordens_de_Servico' : financialTab === 'quotes' ? 'Orcamentos' : 'Vendas'
    exportRowsToExcel(
      `relatorio_${tabName.toLowerCase()}_${timestamp}`,
      ['Número', 'Tipo', 'Data', 'Cliente', 'Responsável', 'Descrição', 'Subtotal (R$)', 'Desconto (R$)', 'Total (R$)', 'Status'],
      filteredFinancialRecords.map((r) => [
        r.number,
        r.kind === 'order' ? 'O.S' : r.kind === 'quote' ? 'Orçamento' : 'Venda',
        r.date.split('T')[0],
        r.customerName,
        r.responsiblePerson || '-',
        r.description,
        r.subtotal.toFixed(2),
        r.discount.toFixed(2),
        r.total.toFixed(2),
        r.statusLabel,
      ]),
    )
  }

  const handleExportFinXml = () => {
    const timestamp = todayIso
    const tabName = financialTab === 'orders' ? 'Ordens_de_Servico' : financialTab === 'quotes' ? 'Orcamentos' : 'Vendas'
    exportRowsToXml(
      `relatorio_${tabName.toLowerCase()}_${timestamp}`,
      tabName,
      'RegistroFinanceiro',
      ['Numero', 'Tipo', 'Data', 'Cliente', 'Responsavel', 'Total', 'Status'],
      filteredFinancialRecords.map((r) => [
        r.number,
        r.kind,
        r.date.split('T')[0],
        r.customerName,
        r.responsiblePerson || '',
        r.total.toFixed(2),
        r.statusLabel,
      ]),
    )
  }

  // ============================================================================
  // CÁLCULOS E FILTRAGEM: RELATÓRIO DE ESTOQUE E SERVIÇOS
  // ============================================================================
  const salesLookupMap = useMemo(() => {
    const map = new Map<string, { saleNumber: string; customerName: string; createdAt: string }>()
    for (const s of dataset.sales) {
      map.set(s.id, {
        saleNumber: s.saleNumber || `#VEN-${s.id.slice(0, 6)}`,
        customerName: s.customerName || 'Consumidor Final',
        createdAt: s.createdAt,
      })
    }
    for (const q of dataset.quotes) {
      if (!map.has(q.id)) {
        map.set(q.id, {
          saleNumber: q.quoteNumber || `#ORC-${q.id.slice(0, 6)}`,
          customerName: q.customerName || 'Cliente',
          createdAt: q.createdAt,
        })
      }
    }
    return map
  }, [dataset.sales, dataset.quotes])

  const inventoryLookupMap = useMemo(() => {
    const map = new Map<string, { name: string; sku: string; category: string; unit: string; createdAt: string; qty: number }>()
    for (const item of dataset.inventory) {
      map.set(item.id, {
        name: item.name,
        sku: item.sku || 'S/N',
        category: item.category || 'Geral',
        unit: item.unit || 'UN',
        createdAt: item.createdAt || new Date().toISOString(),
        qty: parseFloat(item.quantityOnHand) || 0,
      })
    }
    return map
  }, [dataset.inventory])

  const servicesLookupMap = useMemo(() => {
    const map = new Map<string, { name: string; code: string; category: string; unit: string; createdAt: string }>()
    for (const s of dataset.services) {
      map.set(s.id, {
        name: s.name,
        code: s.serviceCode || 'SRV',
        category: s.categoryName || 'Serviços',
        unit: s.billingUnit || 'UN',
        createdAt: s.createdAt || new Date().toISOString(),
      })
    }
    return map
  }, [dataset.services])

  // Todas as saídas/movimentações a partir dos itens de venda/orçamento
  interface ItemMovementRow {
    id: string
    itemId: string
    itemName: string
    itemCode: string
    itemType: 'material' | 'service'
    category: string
    unit: string
    movementDate: string
    registrationDate: string
    effectiveDate: string
    quantity: number
    unitPrice: number
    totalAmount: number
    customerName: string
    saleNumber: string
    stockOnHand?: number
  }

  const allMovementRows = useMemo<ItemMovementRow[]>(() => {
    const list: ItemMovementRow[] = []

    for (const qi of dataset.quoteItems) {
      const sale = salesLookupMap.get(qi.quote_id)
      const isService = !!qi.service_id || qi.item_type === 'service'
      const itemType: 'material' | 'service' = isService ? 'service' : 'material'

      let itemName = qi.description || (isService ? 'Serviço' : 'Produto')
      let itemCode = isService ? 'SRV' : 'MAT'
      let category = isService ? 'Serviços' : 'Estoque'
      let unit = qi.unit || 'UN'
      let registrationDate = sale?.createdAt || new Date().toISOString()
      let stockOnHand: number | undefined

      if (isService && qi.service_id) {
        const srv = servicesLookupMap.get(qi.service_id)
        if (srv) {
          itemName = srv.name
          itemCode = srv.code
          category = srv.category
          unit = srv.unit
          registrationDate = srv.createdAt
        }
      } else if (!isService && qi.inventory_item_id) {
        const inv = inventoryLookupMap.get(qi.inventory_item_id)
        if (inv) {
          itemName = inv.name
          itemCode = inv.sku
          category = inv.category
          unit = inv.unit
          registrationDate = inv.createdAt
          stockOnHand = inv.qty
        }
      }

      const movementDate = sale?.createdAt || new Date().toISOString()
      const effectiveDate = invDateField === 'movement' ? movementDate : registrationDate
      const quantity = Math.max(1, parseFloat(String(qi.quantity)) || 1)
      const unitPrice = Math.max(0, parseFloat(String(qi.unit_price)) || 0)
      const totalAmount = Math.max(0, parseFloat(String(qi.total)) || quantity * unitPrice)

      list.push({
        id: qi.id,
        itemId: qi.inventory_item_id || qi.service_id || qi.id,
        itemName,
        itemCode,
        itemType,
        category,
        unit,
        movementDate,
        registrationDate,
        effectiveDate,
        quantity,
        unitPrice,
        totalAmount,
        customerName: sale?.customerName || 'Consumidor Final',
        saleNumber: sale?.saleNumber || '#VEN-0000',
        stockOnHand,
      })
    }

    return list
  }, [dataset.quoteItems, salesLookupMap, inventoryLookupMap, servicesLookupMap, invDateField])

  // Filtragem das Movimentações / Saídas
  const filteredMovementRows = useMemo(() => {
    return allMovementRows.filter((row) => {
      // 1. Filtro Material ou Serviço
      if (invItemType === 'material' && row.itemType !== 'material') return false
      if (invItemType === 'service' && row.itemType !== 'service') return false

      // 2. Filtro de Período pela data escolhida (saída ou cadastro)
      if (!isDateInRange(row.effectiveDate, invDateFilter)) {
        return false
      }

      // 3. Busca textual
      if (invSearchQuery.trim()) {
        const q = invSearchQuery.toLowerCase().trim()
        const matchName = row.itemName.toLowerCase().includes(q)
        const matchCode = row.itemCode.toLowerCase().includes(q)
        const matchCust = row.customerName.toLowerCase().includes(q)
        const matchSale = row.saleNumber.toLowerCase().includes(q)
        if (!matchName && !matchCode && !matchCust && !matchSale) return false
      }

      return true
    })
  }, [allMovementRows, invItemType, invDateFilter, invSearchQuery])

  // Ranking de Itens com Maior Movimentação
  const mostMovedRanking = useMemo(() => {
    const map = new Map<string, {
      key: string
      name: string
      code: string
      type: 'material' | 'service'
      totalQty: number
      totalRevenue: number
      timesSold: number
      unit: string
    }>()

    for (const r of filteredMovementRows) {
      const k = `${r.itemType}:${r.itemCode}:${r.itemName}`
      const existing = map.get(k)
      if (existing) {
        existing.totalQty += r.quantity
        existing.totalRevenue += r.totalAmount
        existing.timesSold += 1
      } else {
        map.set(k, {
          key: k,
          name: r.itemName,
          code: r.itemCode,
          type: r.itemType,
          totalQty: r.quantity,
          totalRevenue: r.totalAmount,
          timesSold: 1,
          unit: r.unit,
        })
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty)
  }, [filteredMovementRows])

  // Filtragem de Estoque Atual (Aba Estoque Físico)
  const filteredCurrentInventory = useMemo(() => {
    return dataset.inventory.filter((item) => {
      // Filtro de status
      const q = Math.max(0, parseFloat(item.quantityOnHand) || 0)
      const min = Math.max(0, parseFloat(item.minimumQuantity) || 0)
      if (invStockStatus === 'out' && q > 0) return false
      if (invStockStatus === 'low' && (q <= 0 || q > min)) return false
      if (invStockStatus === 'normal' && (q <= 0 || (min > 0 && q <= min))) return false

      // Busca textual
      if (invSearchQuery.trim()) {
        const query = invSearchQuery.toLowerCase().trim()
        const matchName = item.name.toLowerCase().includes(query)
        const matchSku = item.sku ? item.sku.toLowerCase().includes(query) : false
        const matchCat = item.category ? item.category.toLowerCase().includes(query) : false
        if (!matchName && !matchSku && !matchCat) return false
      }

      return true
    })
  }, [dataset.inventory, invStockStatus, invSearchQuery])

  // Filtragem de Serviços Cadastrados (Aba Serviços)
  const filteredServices = useMemo(() => {
    return dataset.services.filter((s) => {
      if (invSearchQuery.trim()) {
        const query = invSearchQuery.toLowerCase().trim()
        const matchName = s.name.toLowerCase().includes(query)
        const matchCode = s.serviceCode.toLowerCase().includes(query)
        const matchCat = s.categoryName ? s.categoryName.toLowerCase().includes(query) : false
        if (!matchName && !matchCode && !matchCat) return false
      }
      return true
    })
  }, [dataset.services, invSearchQuery])

  // Métricas do módulo Estoque e Serviços
  const invServicesMetrics = useMemo(() => {
    const totalQtyMoved = filteredMovementRows.reduce((sum, r) => sum + r.quantity, 0)
    const materialsRevenue = filteredMovementRows
      .filter((r) => r.itemType === 'material')
      .reduce((sum, r) => sum + r.totalAmount, 0)
    const servicesRevenue = filteredMovementRows
      .filter((r) => r.itemType === 'service')
      .reduce((sum, r) => sum + r.totalAmount, 0)
    const topMovedItem = mostMovedRanking[0] || null

    return {
      totalQtyMoved,
      materialsRevenue,
      servicesRevenue,
      totalRevenue: materialsRevenue + servicesRevenue,
      topMovedItem,
    }
  }, [filteredMovementRows, mostMovedRanking])

  const handleExportInvServicesExcel = () => {
    const timestamp = todayIso
    if (invServicesTab === 'movements') {
      exportRowsToExcel(
        `relatorio_saidas_movimentacoes_${timestamp}`,
        ['Item', 'Código', 'Tipo', 'Data Movimentação', 'Data Cadastro', 'Quantidade', 'Cliente', 'Venda Utilizada', 'Preço Unitário (R$)', 'Total (R$)'],
        filteredMovementRows.map((r) => [
          r.itemName,
          r.itemCode,
          r.itemType === 'material' ? 'Material / Produto' : 'Serviço',
          r.movementDate.split('T')[0],
          r.registrationDate.split('T')[0],
          r.quantity,
          r.customerName,
          r.saleNumber,
          r.unitPrice.toFixed(2),
          r.totalAmount.toFixed(2),
        ]),
      )
    } else if (invServicesTab === 'inventory') {
      exportRowsToExcel(
        `relatorio_estoque_atual_${timestamp}`,
        ['SKU', 'Produto', 'Categoria', 'Unidade', 'Qtd Estoque', 'Qtd Mínima', 'Preço Custo (R$)', 'Preço Venda (R$)'],
        filteredCurrentInventory.map((i) => [
          i.sku || 'S/N',
          i.name,
          i.category || 'Geral',
          i.unit,
          i.quantityOnHand,
          i.minimumQuantity,
          parseFloat(i.purchasePrice || '0').toFixed(2),
          parseFloat(i.unitPrice).toFixed(2),
        ]),
      )
    } else {
      exportRowsToExcel(
        `relatorio_servicos_cadastrados_${timestamp}`,
        ['Código', 'Serviço', 'Categoria', 'Unidade', 'Preço Venda (R$)', 'Custo Total (R$)', 'Margem Lucro (%)'],
        filteredServices.map((s) => [
          s.serviceCode,
          s.name,
          s.categoryName || 'Serviços',
          s.billingUnit,
          parseFloat(s.salePrice).toFixed(2),
          parseFloat(s.totalCost).toFixed(2),
          `${s.profitMargin}%`,
        ]),
      )
    }
  }

  const handleExportInvServicesXml = () => {
    const timestamp = todayIso
    if (invServicesTab === 'movements') {
      exportRowsToXml(
        `relatorio_saidas_movimentacoes_${timestamp}`,
        'Movimentacoes',
        'Movimentacao',
        ['Item', 'Codigo', 'Tipo', 'DataMovimentacao', 'Quantidade', 'Cliente', 'Venda', 'Total'],
        filteredMovementRows.map((r) => [
          r.itemName,
          r.itemCode,
          r.itemType,
          r.movementDate.split('T')[0],
          r.quantity,
          r.customerName,
          r.saleNumber,
          r.totalAmount.toFixed(2),
        ]),
      )
    } else if (invServicesTab === 'inventory') {
      exportRowsToXml(
        `relatorio_estoque_atual_${timestamp}`,
        'EstoqueAtual',
        'Produto',
        ['SKU', 'Produto', 'Categoria', 'Estoque', 'PrecoVenda'],
        filteredCurrentInventory.map((i) => [
          i.sku || '',
          i.name,
          i.category || '',
          i.quantityOnHand,
          i.unitPrice,
        ]),
      )
    } else {
      exportRowsToXml(
        `relatorio_servicos_cadastrados_${timestamp}`,
        'ServicosCadastrados',
        'Servico',
        ['Codigo', 'Servico', 'Categoria', 'PrecoVenda'],
        filteredServices.map((s) => [
          s.serviceCode,
          s.name,
          s.categoryName || '',
          s.salePrice,
        ]),
      )
    }
  }

  // ============================================================================
  // RENDERIZAÇÃO: CABEÇALHOS DE IMPRESSÃO
  // ============================================================================
  const emissionWeekday = useMemo(() => {
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
    return days[new Date().getDay()]
  }, [])
  const emissionDate = useMemo(() => new Date().toLocaleDateString('pt-BR'), [])
  const emissionTime = useMemo(() => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), [])

  // ============================================================================
  // VIEW: CENTRAL DE RELATÓRIO (HUB PRINCIPAL - 3 MÓDULOS)
  // ============================================================================
  if (currentView === 'home') {
    return (
      <div className="space-y-6">
        {/* CABEÇALHO DO HUB CENTRAL */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-slate-800 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
              <FileBarChart className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              Central de Relatórios
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Selecione uma das categorias de relatório abaixo para auditar, visualizar, filtrar, exportar e imprimir dados.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={isLoading}
              className="gap-2 rounded-xl border-gray-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar Dados
            </Button>
          </div>
        </div>

        {/* MÓDULO EM DESTAQUE: GRÁFICO PRINCIPAL DE VENDAS – ALTA VISIBILIDADE */}
        <Card className="group relative overflow-hidden rounded-2xl border-2 border-blue-200 dark:border-blue-900/70 hover:border-blue-500 shadow-xs hover:shadow-md transition-all bg-gradient-to-r from-blue-50/60 via-white to-emerald-50/40 dark:from-blue-950/30 dark:via-slate-900 dark:to-emerald-950/20">
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-blue-600 p-3 text-white shadow-xs shrink-0">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold tracking-wide text-gray-900 dark:text-white">
                    GRÁFICO PRINCIPAL DE VENDAS — ALTA VISIBILIDADE
                  </h3>
                  <span className="rounded-full bg-blue-100 dark:bg-blue-950/70 px-3 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    DESTAQUE
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-gray-600 dark:text-slate-400 max-w-3xl">
                  Gráfico amplo em barras verticais ou linhas com faturamento por dia, quantidade de vendas, ticket médio, destaque de maior/menor dia e comparativo com o período anterior (Hoje, 7 dias, Semana, 30 dias, Mês e Ano).
                </p>
              </div>
            </div>

            <Button
              onClick={() => navigateToView('sales_chart')}
              className="shrink-0 justify-between gap-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm px-5 py-2.5"
            >
              <span className="inline-flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Abrir Gráfico Principal
              </span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* OS MÓDULOS PRINCIPAIS DE RELATÓRIO */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Categorias de Relatórios
            </h2>
            <span className="text-xs text-gray-400">
              Design padronizado e paleta neutra com dados em tempo real
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {/* 1. MÓDULO: RELATÓRIOS CADASTRAIS */}
            <Card className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 shadow-xs hover:shadow-md transition-all flex flex-col justify-between bg-white dark:bg-slate-900">
              <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-3 text-blue-600 dark:text-blue-400">
                      <UserCheck className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                      MÓDULO 1
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold tracking-wide text-gray-900 dark:text-white">
                    RELATÓRIOS CADASTRAIS
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-gray-600 dark:text-slate-400">
                    Auditoria completa de todos os cadastros do sistema: usuários de acesso, equipe de funcionários, fornecedores homologados e carteira de clientes.
                  </p>
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-slate-400">
                    <span>Usuários: <b className="text-slate-900 dark:text-white">{dataset.members.length}</b></span>
                    <span>Funcionários: <b className="text-slate-900 dark:text-white">{dataset.members.filter((m) => m.role !== 'owner').length}</b></span>
                    <span>Fornecedores: <b className="text-slate-900 dark:text-white">{dataset.suppliers.length}</b></span>
                    <span>Clientes: <b className="text-slate-900 dark:text-white">{dataset.customers.length}</b></span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    size="sm"
                    onClick={() => navigateToView('registrations')}
                    className="w-full justify-between rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
                  >
                    <span className="inline-flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      Abrir Relatórios Cadastrais
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 2. MÓDULO: RELATÓRIOS FINANCEIROS */}
            <Card className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 shadow-xs hover:shadow-md transition-all flex flex-col justify-between bg-white dark:bg-slate-900">
              <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-3 text-blue-600 dark:text-blue-400">
                      <CreditCard className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                      MÓDULO 2
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold tracking-wide text-gray-900 dark:text-white">
                    RELATÓRIOS FINANCEIROS
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-gray-600 dark:text-slate-400">
                    Controle financeiro consolidado com alternância entre Ordens de Serviço (O.S), Orçamentos e Vendas efetuadas (PDV e Balcão).
                  </p>
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-slate-400">
                    <span>O.S Emitidas: <b className="text-slate-900 dark:text-white">{dataset.serviceOrders.length}</b></span>
                    <span>Orçamentos: <b className="text-slate-900 dark:text-white">{dataset.quotes.length}</b></span>
                    <span>Vendas Realizadas: <b className="text-slate-900 dark:text-white">{dataset.sales.length}</b></span>
                    <span>Total Registros: <b className="text-slate-900 dark:text-white">{dataset.serviceOrders.length + dataset.quotes.length + dataset.sales.length}</b></span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    size="sm"
                    onClick={() => navigateToView('financial')}
                    className="w-full justify-between rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
                  >
                    <span className="inline-flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Abrir Relatórios Financeiros
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 3. MÓDULO: RELATÓRIO DE ESTOQUE E SERVIÇO */}
            <Card className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 shadow-xs hover:shadow-md transition-all flex flex-col justify-between bg-white dark:bg-slate-900">
              <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-3 text-blue-600 dark:text-blue-400">
                      <Boxes className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                      MÓDULO 3
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold tracking-wide text-gray-900 dark:text-white">
                    ESTOQUE E SERVIÇO
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-gray-600 dark:text-slate-400">
                    Controle de materiais e serviços cadastrados, ranking de itens mais movimentados e histórico de saídas vinculado ao cliente e à venda utilizada.
                  </p>
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-slate-400">
                    <span>Materiais / SKUs: <b className="text-slate-900 dark:text-white">{dataset.inventory.length}</b></span>
                    <span>Serviços: <b className="text-slate-900 dark:text-white">{dataset.services.length}</b></span>
                    <span>Saídas Registradas: <b className="text-slate-900 dark:text-white">{dataset.quoteItems.length}</b></span>
                    <span>Total Cadastrado: <b className="text-slate-900 dark:text-white">{dataset.inventory.length + dataset.services.length}</b></span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    size="sm"
                    onClick={() => navigateToView('inventory_services')}
                    className="w-full justify-between rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Boxes className="h-4 w-4" />
                      Abrir Estoque e Serviços
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 4. MÓDULO: GERENCIAMENTO DE CAIXA */}
            <Card className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 shadow-xs hover:shadow-md transition-all flex flex-col justify-between bg-white dark:bg-slate-900">
              <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-3 text-emerald-600 dark:text-emerald-400">
                      <Wallet className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                      MÓDULO 4
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold tracking-wide text-gray-900 dark:text-white">
                    GERENCIAMENTO DE CAIXA
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-gray-600 dark:text-slate-400">
                    Relatórios por dia, semana, mês e por funcionário, além do Livro do Caixa detalhado e completo com entradas, saídas e saldo acumulado.
                  </p>
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-slate-400">
                    <span>Sessões: <b className="text-slate-900 dark:text-white">{dataset.cashSessions.length}</b></span>
                    <span>Mov. Caixa: <b className="text-slate-900 dark:text-white">{dataset.cashMovements.length}</b></span>
                    <span>Lançamentos: <b className="text-slate-900 dark:text-white">{dataset.cashEntries.length}</b></span>
                    <span>Vendas PDV: <b className="text-slate-900 dark:text-white">{dataset.sales.length}</b></span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    size="sm"
                    onClick={() => navigateToView('cash_management')}
                    className="w-full justify-between rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Abrir Relatório de Caixa
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================================
  // VIEW: 1. RELATÓRIOS CADASTRAIS
  // ============================================================================
  if (currentView === 'registrations') {
    return (
      <div className="space-y-6">
        <ReportPrintHeader
          organizationName={currentOrganization?.name}
          organizationLogoUrl={currentOrganization?.logoUrl}
          reportTitle="Relatório Geral de Cadastros"
          reportType={
            registrationsTab === 'users'
              ? 'Usuários de Acesso'
              : registrationsTab === 'employees'
                ? 'Funcionários'
                : registrationsTab === 'suppliers'
                  ? 'Fornecedores'
                  : 'Clientes'
          }
          totalRecords={
            registrationsTab === 'users'
              ? filteredUsers.length
              : registrationsTab === 'employees'
                ? filteredEmployees.length
                : registrationsTab === 'suppliers'
                  ? filteredSuppliers.length
                  : filteredCustomers.length
          }
          emissionWeekday={emissionWeekday}
          emissionDate={emissionDate}
          emissionTime={emissionTime}
          periodLabel={PERIOD_LABELS[regDateFilter.preset]}
          periodRange={`${regDateFilter.startDate.split('-').reverse().join('/')} a ${regDateFilter.endDate.split('-').reverse().join('/')}`}
        />

        <ReportActionBar
          title="Relatórios Cadastrais"
          badgeText="Usuários, Funcionários, Fornecedores & Clientes"
          badgeColorClass="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
          description="Auditoria cadastral completa. Selecione a aba desejada para visualizar, exportar ou imprimir os registros."
          onBack={() => navigateToView('home')}
          onExportExcel={handleExportCadastrosExcel}
          onExportXml={handleExportCadastrosXml}
          onPrint={handlePrintReport}
          onRefresh={() => void loadData()}
          isRefreshing={isLoading}
          printOrientationMode={printOrientationMode}
          effectiveOrientation={effectiveOrientation}
          onPrintOrientationChange={setPrintOrientationMode}
        />

        {/* CARD DE FILTROS DE PERÍODO PADRONIZADO */}
        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs print:hidden bg-white dark:bg-slate-900">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['today', '7d', 'month', '30d', 'year', 'all'] as ReportPeriodPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    const range = getPresetDateRange(preset)
                    setRegDateFilter({ preset, startDate: range.startDate, endDate: range.endDate })
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    regDateFilter.preset === preset
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {PERIOD_LABELS[preset]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">De:</span>
              <input
                type="date"
                value={regDateFilter.startDate}
                onChange={(e) =>
                  setRegDateFilter((prev) => ({
                    ...prev,
                    preset: 'custom',
                    startDate: e.target.value,
                  }))
                }
                className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-gray-900 dark:text-white"
              />
              <span className="text-gray-500">Até:</span>
              <input
                type="date"
                value={regDateFilter.endDate}
                onChange={(e) =>
                  setRegDateFilter((prev) => ({
                    ...prev,
                    preset: 'custom',
                    endDate: e.target.value,
                  }))
                }
                className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-gray-900 dark:text-white"
              />
            </div>
          </CardContent>
        </Card>

        {/* ABAS DO RELATÓRIO CADASTRAIS */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-slate-800 print:hidden gap-3">
          <div className="flex space-x-1 sm:space-x-4 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setRegistrationsTab('users')}
              className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-xs font-bold transition whitespace-nowrap ${
                registrationsTab === 'users'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Usuários ({filteredUsers.length})
            </button>

            <button
              type="button"
              onClick={() => setRegistrationsTab('employees')}
              className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-xs font-bold transition whitespace-nowrap ${
                registrationsTab === 'employees'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              <Briefcase className="h-4 w-4" />
              Funcionários ({filteredEmployees.length})
            </button>

            <button
              type="button"
              onClick={() => setRegistrationsTab('suppliers')}
              className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-xs font-bold transition whitespace-nowrap ${
                registrationsTab === 'suppliers'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              <Truck className="h-4 w-4" />
              Fornecedores ({filteredSuppliers.length})
            </button>

            <button
              type="button"
              onClick={() => setRegistrationsTab('customers')}
              className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-xs font-bold transition whitespace-nowrap ${
                registrationsTab === 'customers'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              <Users className="h-4 w-4" />
              Clientes ({filteredCustomers.length})
            </button>
          </div>

          <div className="relative pb-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar nos cadastros..."
              value={regSearchQuery}
              onChange={(e) => setRegSearchQuery(e.target.value)}
              className="w-full sm:w-64 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* CARDS DE MÉTRICAS PADRONIZADOS (PALETA DO SITE) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 print:hidden">
          <Card className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  Usuários do Sistema
                </p>
                <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
                  {regAnalytics.usersCount} usuário(s)
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2.5 text-blue-600 dark:text-blue-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  Funcionários / Equipe
                </p>
                <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
                  {regAnalytics.employeesCount} colaborador(es)
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2.5 text-blue-600 dark:text-blue-400">
                <Briefcase className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  Fornecedores Homologados
                </p>
                <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
                  {regAnalytics.suppliersCount} fornecedor(es)
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2.5 text-blue-600 dark:text-blue-400">
                <Truck className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  Carteira de Clientes
                </p>
                <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
                  {regAnalytics.customersCount} cliente(s)
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2.5 text-blue-600 dark:text-blue-400">
                <Users className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TABELAS DAS ABAS DE CADASTRO */}
        <div className="space-y-4">
          {registrationsTab === 'users' && (
            <div className="overflow-hidden print:overflow-visible rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <table className="report-fit-table w-full text-left text-xs print:text-[9.5px]">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Usuário / Exibição</th>
                    <th className="py-2.5 px-3">E-mail de Acesso</th>
                    <th className="py-2.5 px-3">Papel no Sistema</th>
                    <th className="py-2.5 px-3">Data de Cadastro</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Nenhum usuário encontrado no período selecionado.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.userId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                          {u.displayName || u.email.split('@')[0]}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">{u.email}</td>
                        <td className="py-2 px-3 text-slate-700 dark:text-slate-300 capitalize">{u.role}</td>
                        <td className="py-2 px-3 text-slate-500">{u.createdAt.split('T')[0].split('-').reverse().join('/')}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200">
                            Ativo
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {registrationsTab === 'employees' && (
            <div className="overflow-hidden print:overflow-visible rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <table className="report-fit-table w-full text-left text-xs print:text-[9.5px]">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Funcionário</th>
                    <th className="py-2.5 px-3">E-mail Corporativo</th>
                    <th className="py-2.5 px-3">Atribuição / Cargo</th>
                    <th className="py-2.5 px-3">Data de Cadastro</th>
                    <th className="py-2.5 px-3 text-center">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Nenhum funcionário encontrado no período selecionado.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((e) => (
                      <tr key={e.userId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                          {e.displayName || e.email.split('@')[0]}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">{e.email}</td>
                        <td className="py-2 px-3 text-slate-700 dark:text-slate-300 capitalize">{e.role}</td>
                        <td className="py-2 px-3 text-slate-500">{e.createdAt.split('T')[0].split('-').reverse().join('/')}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200">
                            Ativo
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {registrationsTab === 'suppliers' && (
            <div className="overflow-hidden print:overflow-visible rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <table className="report-fit-table w-full text-left text-xs print:text-[9.5px]">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Razão Social / Nome</th>
                    <th className="py-2.5 px-3">CNPJ / CPF</th>
                    <th className="py-2.5 px-3">Telefone</th>
                    <th className="py-2.5 px-3">E-mail</th>
                    <th className="py-2.5 px-3">Endereço</th>
                    <th className="py-2.5 px-3">Cadastro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Nenhum fornecedor encontrado no período selecionado.
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">{s.name}</td>
                        <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">{s.document || '-'}</td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                          {s.phone ? formatPhoneNumber(s.phone) : '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{s.email || '-'}</td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{s.address || '-'}</td>
                        <td className="py-2 px-3 text-slate-500">{s.createdAt.split('T')[0].split('-').reverse().join('/')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {registrationsTab === 'customers' && (
            <div className="overflow-hidden print:overflow-visible rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <table className="report-fit-table w-full text-left text-xs print:text-[9.5px]">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">CPF / CNPJ</th>
                    <th className="py-2.5 px-3">Telefone</th>
                    <th className="py-2.5 px-3">E-mail</th>
                    <th className="py-2.5 px-3 text-right">Volume Compras (R$)</th>
                    <th className="py-2.5 px-3 text-center">Cadastro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Nenhum cliente encontrado no período selecionado.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => {
                      const totalSpent = customerMetricsMap.get(c.id)?.totalSpent || 0
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">{c.name}</td>
                          <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">{c.document || '-'}</td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                            {c.phone ? formatPhoneNumber(c.phone) : '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{c.email || '-'}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {formatCurrency(totalSpent.toFixed(2))}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-500">
                            {c.createdAt.split('T')[0].split('-').reverse().join('/')}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <ReportPrintFooter
          emissionWeekday={emissionWeekday}
          emissionDate={emissionDate}
          emissionTime={emissionTime}
        />
      </div>
    )
  }

  // ============================================================================
  // VIEW: 2. RELATÓRIOS FINANCEIROS (O.S, Orçamentos, Vendas)
  // ============================================================================
  if (currentView === 'financial') {
    return (
      <div className="space-y-6">
        <ReportPrintHeader
          organizationName={currentOrganization?.name}
          organizationLogoUrl={currentOrganization?.logoUrl}
          reportTitle="Relatórios Financeiros & Comerciais"
          reportType={
            financialTab === 'orders'
              ? 'Ordens de Serviço (O.S)'
              : financialTab === 'quotes'
                ? 'Orçamentos & Propostas'
                : 'Vendas Realizadas'
          }
          totalRecords={filteredFinancialRecords.length}
          totalAmountLabel="Valor Consolidado"
          totalAmountValue={formatCurrency(financialMetrics.totalVolume.toFixed(2))}
          emissionWeekday={emissionWeekday}
          emissionDate={emissionDate}
          emissionTime={emissionTime}
          periodLabel={finEffectiveRange.label}
          periodRange={`${finEffectiveRange.startDate.split('-').reverse().join('/')} a ${finEffectiveRange.endDate.split('-').reverse().join('/')}`}
        />

        <ReportActionBar
          title="Relatórios Financeiros"
          badgeText="Ordens de Serviço, Orçamentos & Vendas"
          badgeColorClass="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
          description="Controle analítico financeiro com alternância rápida entre Ordens de Serviço, Orçamentos e Vendas."
          onBack={() => navigateToView('home')}
          onExportExcel={handleExportFinExcel}
          onExportXml={handleExportFinXml}
          onPrint={handlePrintReport}
          onRefresh={() => void loadData()}
          isRefreshing={isLoading}
          printOrientationMode={printOrientationMode}
          effectiveOrientation={effectiveOrientation}
          onPrintOrientationChange={setPrintOrientationMode}
        />

        {/* CARD DE FILTROS: DIA / MÊS / PRESETS / PERSONALIZADO (PADRÃO CADASTRAL) */}
        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs print:hidden bg-white dark:bg-slate-900">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFinPeriodMode('presets')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    finPeriodMode === 'presets' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Período Rápido
                </button>
                <button
                  type="button"
                  onClick={() => setFinPeriodMode('day')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    finPeriodMode === 'day' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Por Dia
                </button>
                <button
                  type="button"
                  onClick={() => setFinPeriodMode('month')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    finPeriodMode === 'month' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Por Mês
                </button>
                <button
                  type="button"
                  onClick={() => setFinPeriodMode('custom')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    finPeriodMode === 'custom' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  De / Até
                </button>
              </div>

              {/* Seletor Dinâmico */}
              {finPeriodMode === 'presets' && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['today', '7d', 'month', '30d', 'year', 'all'] as ReportPeriodPreset[]).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        const range = getPresetDateRange(preset)
                        setFinDateFilter({ preset, startDate: range.startDate, endDate: range.endDate })
                      }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        finDateFilter.preset === preset
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                      }`}
                    >
                      {PERIOD_LABELS[preset]}
                    </button>
                  ))}
                </div>
              )}

              {finPeriodMode === 'day' && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 font-medium">Dia:</span>
                  <input
                    type="date"
                    value={finSelectedDay}
                    onChange={(e) => setFinSelectedDay(e.target.value)}
                    className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-gray-900 dark:text-white"
                  />
                </div>
              )}

              {finPeriodMode === 'month' && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 font-medium">Mês:</span>
                  <input
                    type="month"
                    value={finSelectedMonth}
                    onChange={(e) => setFinSelectedMonth(e.target.value)}
                    className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-gray-900 dark:text-white"
                  />
                </div>
              )}

              {finPeriodMode === 'custom' && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">De:</span>
                  <input
                    type="date"
                    value={finDateFilter.startDate}
                    onChange={(e) =>
                      setFinDateFilter((prev) => ({ ...prev, preset: 'custom', startDate: e.target.value }))
                    }
                    className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-gray-900 dark:text-white"
                  />
                  <span className="text-gray-500">Até:</span>
                  <input
                    type="date"
                    value={finDateFilter.endDate}
                    onChange={(e) =>
                      setFinDateFilter((prev) => ({ ...prev, preset: 'custom', endDate: e.target.value }))
                    }
                    className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-gray-900 dark:text-white"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ABAS DO MÓDULO FINANCEIRO (O.S, ORÇAMENTO, VENDAS) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-slate-800 print:hidden gap-3">
          <div className="flex space-x-1 sm:space-x-4 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setFinancialTab('orders')}
              className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-xs font-bold transition whitespace-nowrap ${
                financialTab === 'orders'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              <Wrench className="h-4 w-4" />
              Ordens de Serviço ({allFinancialRecords.filter((r) => r.kind === 'order').length})
            </button>

            <button
              type="button"
              onClick={() => setFinancialTab('quotes')}
              className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-xs font-bold transition whitespace-nowrap ${
                financialTab === 'quotes'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              Orçamentos ({allFinancialRecords.filter((r) => r.kind === 'quote').length})
            </button>

            <button
              type="button"
              onClick={() => setFinancialTab('sales')}
              className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-xs font-bold transition whitespace-nowrap ${
                financialTab === 'sales'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              Vendas Realizadas ({allFinancialRecords.filter((r) => r.kind === 'sale').length})
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2">
            <select
              value={finStatusFilter}
              onChange={(e) => setFinStatusFilter(e.target.value)}
              className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-gray-700 dark:text-slate-300"
            >
              <option value="all">Todos os Status</option>
              {financialTab === 'orders' && (
                <>
                  <option value="queue">Fila de Atendimento</option>
                  <option value="in_maintenance">Em Manutenção</option>
                  <option value="ready">Pronto / Concluído</option>
                  <option value="closed">Encerrado</option>
                </>
              )}
              {financialTab === 'quotes' && (
                <>
                  <option value="draft">Em Aberto</option>
                  <option value="approved">Aprovado</option>
                  <option value="rejected">Rejeitado</option>
                </>
              )}
              {financialTab === 'sales' && (
                <>
                  <option value="approved">Concluídas</option>
                  <option value="rejected">Canceladas</option>
                </>
              )}
            </select>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar registros..."
                value={finSearchQuery}
                onChange={(e) => setFinSearchQuery(e.target.value)}
                className="w-full sm:w-56 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* CARDS DE MÉTRICAS PADRONIZADOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 print:hidden">
          <Card className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  Volume Total ({financialTab === 'orders' ? 'O.S' : financialTab === 'quotes' ? 'Orçamentos' : 'Vendas'})
                </p>
                <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1 font-mono">
                  {formatCurrency(financialMetrics.totalVolume.toFixed(2))}
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2.5 text-blue-600 dark:text-blue-400">
                <CreditCard className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  Total de Lançamentos
                </p>
                <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
                  {financialMetrics.count} registro(s)
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2.5 text-blue-600 dark:text-blue-400">
                <ClipboardList className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  Ticket Médio
                </p>
                <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1 font-mono">
                  {formatCurrency(financialMetrics.averageTicket.toFixed(2))}
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2.5 text-blue-600 dark:text-blue-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  Aprovados / Concluídos
                </p>
                <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
                  {financialMetrics.approvedOrClosedCount} registro(s)
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2.5 text-blue-600 dark:text-blue-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TABELA FINANCEIRA CONSOLIDADA */}
        <div className="overflow-hidden print:overflow-visible rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <table className="report-fit-table w-full text-left text-xs print:text-[9.5px]">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Identificação</th>
                <th className="py-2.5 px-3">Data</th>
                <th className="py-2.5 px-3">Cliente</th>
                <th className="py-2.5 px-3">Responsável</th>
                <th className="py-2.5 px-3">Descrição / Canal</th>
                <th className="py-2.5 px-3 text-right">Valor Total (R$)</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredFinancialRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Nenhum registro financeiro encontrado no período selecionado.
                  </td>
                </tr>
              ) : (
                filteredFinancialRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white">{r.number}</td>
                    <td className="py-2 px-3 text-slate-500">{r.date.split('T')[0].split('-').reverse().join('/')}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">{r.customerName}</td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{r.responsiblePerson || '-'}</td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400 truncate max-w-xs">{r.description}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(r.total.toFixed(2))}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${r.statusBadgeClass}`}>
                        {r.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredFinancialRecords.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-xs">
                <tr>
                  <td colSpan={5} className="py-2.5 px-3 uppercase text-slate-700 dark:text-slate-300">
                    Total Geral do Período ({filteredFinancialRecords.length} lançamentos)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {formatCurrency(financialMetrics.totalVolume.toFixed(2))}
                  </td>
                  <td className="py-2.5 px-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <ReportPrintFooter
          emissionWeekday={emissionWeekday}
          emissionDate={emissionDate}
          emissionTime={emissionTime}
        />
      </div>
    )
  }

  // ============================================================================
  // VIEW: 3. RELATÓRIO DE ESTOQUE E SERVIÇO
  // ============================================================================
  if (currentView === 'inventory_services') {
    return (
      <div className="space-y-6">
        <ReportPrintHeader
          organizationName={currentOrganization?.name}
          organizationLogoUrl={currentOrganization?.logoUrl}
          reportTitle="Relatório de Estoque e Serviços"
          reportType={
            invServicesTab === 'movements'
              ? 'Saídas & Movimentações de Materiais e Serviços'
              : invServicesTab === 'inventory'
                ? 'Estoque Atual (Produtos & Materiais)'
                : 'Catálogo de Serviços Cadastrados'
          }
          totalRecords={
            invServicesTab === 'movements'
              ? filteredMovementRows.length
              : invServicesTab === 'inventory'
                ? filteredCurrentInventory.length
                : filteredServices.length
          }
          totalAmountLabel="Faturamento Movimentado"
          totalAmountValue={formatCurrency(invServicesMetrics.totalRevenue.toFixed(2))}
          emissionWeekday={emissionWeekday}
          emissionDate={emissionDate}
          emissionTime={emissionTime}
          periodLabel={PERIOD_LABELS[invDateFilter.preset]}
          periodRange={`${invDateFilter.startDate.split('-').reverse().join('/')} a ${invDateFilter.endDate.split('-').reverse().join('/')}`}
        />

        <ReportActionBar
          title="Relatório de Estoque e Serviço"
          badgeText="Materiais, Serviços & Movimentações de Saída"
          badgeColorClass="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
          description="Auditoria analítica de estoque físico e serviços cadastrados, ranking dos itens mais movimentados e histórico de vendas com cliente associado."
          onBack={() => navigateToView('home')}
          onExportExcel={handleExportInvServicesExcel}
          onExportXml={handleExportInvServicesXml}
          onPrint={handlePrintReport}
          onRefresh={() => void loadData()}
          isRefreshing={isLoading}
          printOrientationMode={printOrientationMode}
          effectiveOrientation={effectiveOrientation}
          onPrintOrientationChange={setPrintOrientationMode}
        />

        {/* PAINEL DE FILTROS: MATERIAL OU SERVIÇO, DATA DE CADASTRO OU SAÍDA, E PERÍODO */}
        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs print:hidden bg-white dark:bg-slate-900">
          <CardContent className="p-4 space-y-4">
            {/* Linha 1: Seletores de Tipo (Material/Serviço) e Tipo de Data (Saída/Cadastro) */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-3">
              {/* Filtro: Escolher Material ou Serviço */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                  Filtrar Tipo:
                </span>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setInvItemType('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      invItemType === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvItemType('material')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      invItemType === 'material' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Material / Produto
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvItemType('service')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      invItemType === 'service' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Serviço
                  </button>
                </div>
              </div>

              {/* Filtro: Por Data de Cadastro ou Data de Saída */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                  Filtrar Data Por:
                </span>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setInvDateField('movement')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      invDateField === 'movement' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Data de Saída / Venda
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvDateField('registration')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      invDateField === 'registration' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Data de Cadastro
                  </button>
                </div>
              </div>
            </div>

            {/* Linha 2: Intervalo de Datas com Presets */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(['today', '7d', 'month', '30d', 'year', 'all'] as ReportPeriodPreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const range = getPresetDateRange(preset)
                      setInvDateFilter({ preset, startDate: range.startDate, endDate: range.endDate })
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      invDateFilter.preset === preset
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                    }`}
                  >
                    {PERIOD_LABELS[preset]}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">De:</span>
                <input
                  type="date"
                  value={invDateFilter.startDate}
                  onChange={(e) =>
                    setInvDateFilter((prev) => ({ ...prev, preset: 'custom', startDate: e.target.value }))
                  }
                  className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-gray-900 dark:text-white"
                />
                <span className="text-gray-500">Até:</span>
                <input
                  type="date"
                  value={invDateFilter.endDate}
                  onChange={(e) =>
                    setInvDateFilter((prev) => ({ ...prev, preset: 'custom', endDate: e.target.value }))
                  }
                  className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ABAS DO MÓDULO ESTOQUE E SERVIÇO */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-slate-800 print:hidden gap-3">
          <div className="flex space-x-1 sm:space-x-4 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setInvServicesTab('movements')}
              className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-xs font-bold transition whitespace-nowrap ${
                invServicesTab === 'movements'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              Saídas &amp; Mais Movimentados ({filteredMovementRows.length})
            </button>

            <button
              type="button"
              onClick={() => setInvServicesTab('inventory')}
              className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-xs font-bold transition whitespace-nowrap ${
                invServicesTab === 'inventory'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              <Package className="h-4 w-4" />
              Estoque Atual ({dataset.inventory.length})
            </button>

            <button
              type="button"
              onClick={() => setInvServicesTab('services')}
              className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-xs font-bold transition whitespace-nowrap ${
                invServicesTab === 'services'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              <Wrench className="h-4 w-4" />
              Serviços Cadastrados ({dataset.services.length})
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2">
            {invServicesTab === 'inventory' && (
              <select
                value={invStockStatus}
                onChange={(e) => setInvStockStatus(e.target.value as any)}
                className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-gray-700 dark:text-slate-300"
              >
                <option value="all">Todos os Saldos</option>
                <option value="normal">Estoque Normal</option>
                <option value="low">Estoque Baixo</option>
                <option value="out">Zerado / Esgotado</option>
              </select>
            )}

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar item, cliente, venda..."
                value={invSearchQuery}
                onChange={(e) => setInvSearchQuery(e.target.value)}
                className="w-full sm:w-60 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* CARDS DE MÉTRICAS PADRONIZADOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 print:hidden">
          <Card className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  Qtd Total Movimentada
                </p>
                <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
                  {invServicesMetrics.totalQtyMoved} un.
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2.5 text-blue-600 dark:text-blue-400">
                <Boxes className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  Faturamento Materiais
                </p>
                <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1 font-mono">
                  {formatCurrency(invServicesMetrics.materialsRevenue.toFixed(2))}
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2.5 text-blue-600 dark:text-blue-400">
                <Package className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  Faturamento Serviços
                </p>
                <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1 font-mono">
                  {formatCurrency(invServicesMetrics.servicesRevenue.toFixed(2))}
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2.5 text-blue-600 dark:text-blue-400">
                <Wrench className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  Item Mais Movimentado
                </p>
                <p className="text-sm font-extrabold text-gray-900 dark:text-white mt-1 truncate max-w-[180px]" title={invServicesMetrics.topMovedItem?.name}>
                  {invServicesMetrics.topMovedItem ? invServicesMetrics.topMovedItem.name : 'Nenhum'}
                </p>
                {invServicesMetrics.topMovedItem && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {invServicesMetrics.topMovedItem.totalQty} un. movimentadas
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2.5 text-blue-600 dark:text-blue-400">
                <Sparkles className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ABA 1: MOVIMENTAÇÕES, MAIS VENDIDOS E VENDAS UTILIZADAS */}
        {invServicesTab === 'movements' && (
          <div className="space-y-6">
            {/* SEÇÃO DE DESTAQUE: RANKING DOS MAIS MOVIMENTADOS */}
            {mostMovedRanking.length > 0 && (
              <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs print:hidden bg-white dark:bg-slate-900">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      Itens com Maior Movimentação no Período (Top 5)
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      Ordenado pela quantidade total de saídas
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                    {mostMovedRanking.slice(0, 5).map((item, index) => (
                      <div
                        key={item.key}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 text-[10px] font-bold">
                            #{index + 1}
                          </span>
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold border ${
                            item.type === 'service'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {item.type === 'service' ? 'Serviço' : 'Material'}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate" title={item.name}>
                          {item.name}
                        </p>
                        <div className="flex items-baseline justify-between text-[11px] text-slate-500 pt-1">
                          <span>Qtd: <b className="text-slate-900 dark:text-white font-mono">{item.totalQty}</b></span>
                          <span className="font-mono font-bold text-blue-600">{formatCurrency(item.totalRevenue.toFixed(2))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* TABELA DETALHADA COM CLIENTE E VENDA UTILIZADA */}
            <div className="overflow-hidden print:overflow-visible rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <table className="report-fit-table w-full text-left text-xs print:text-[9.5px]">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Item / Descrição</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">
                      {invDateField === 'movement' ? 'Data da Saída' : 'Data Cadastro'}
                    </th>
                    <th className="py-2.5 px-3 text-center">Qtd Saída</th>
                    <th className="py-2.5 px-3">Cliente Atendido</th>
                    <th className="py-2.5 px-3">Venda Utilizada</th>
                    <th className="py-2.5 px-3 text-right">Preço Unit.</th>
                    <th className="py-2.5 px-3 text-right">Total (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredMovementRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Nenhuma movimentação ou saída encontrada com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredMovementRows.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3">
                          <span className="font-semibold text-slate-900 dark:text-white block">{m.itemName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{m.itemCode}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                              m.itemType === 'service'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {m.itemType === 'service' ? 'Serviço' : 'Material'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-500">
                          {m.effectiveDate.split('T')[0].split('-').reverse().join('/')}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                          {m.quantity} {m.unit}
                        </td>
                        <td className="py-2 px-3 text-slate-900 dark:text-white font-medium">
                          {m.customerName}
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold text-blue-600">
                          {m.saleNumber}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                          {formatCurrency(m.unitPrice.toFixed(2))}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatCurrency(m.totalAmount.toFixed(2))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredMovementRows.length > 0 && (
                  <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-xs">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-3 uppercase text-slate-700 dark:text-slate-300">
                        Total Consolidado ({filteredMovementRows.length} saídas)
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-900 dark:text-white">
                        {invServicesMetrics.totalQtyMoved}
                      </td>
                      <td colSpan={3}></td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(invServicesMetrics.totalRevenue.toFixed(2))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ABA 2: ESTOQUE ATUAL DE MATERIAIS */}
        {invServicesTab === 'inventory' && (
          <div className="overflow-hidden print:overflow-visible rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <table className="report-fit-table w-full text-left text-xs print:text-[9.5px]">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Código / SKU</th>
                  <th className="py-2.5 px-3">Produto / Material</th>
                  <th className="py-2.5 px-3">Categoria</th>
                  <th className="py-2.5 px-3 text-center">Saldo em Estoque</th>
                  <th className="py-2.5 px-3 text-center">Estoque Mínimo</th>
                  <th className="py-2.5 px-3 text-right">Preço Venda (R$)</th>
                  <th className="py-2.5 px-3 text-right">Valor em Estoque (R$)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredCurrentInventory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Nenhum produto em estoque encontrado com os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredCurrentInventory.map((i) => {
                    const q = Math.max(0, parseFloat(i.quantityOnHand) || 0)
                    const min = Math.max(0, parseFloat(i.minimumQuantity) || 0)
                    const p = Math.max(0, parseFloat(i.unitPrice) || 0)
                    const totalVal = q * p
                    const isOut = q <= 0
                    const isLow = !isOut && min > 0 && q <= min

                    return (
                      <tr key={i.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-mono font-semibold text-slate-600">{i.sku || 'S/N'}</td>
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">{i.name}</td>
                        <td className="py-2 px-3 text-slate-500">{i.category || 'Geral'}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                          {i.quantityOnHand} {i.unit}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-slate-500">
                          {i.minimumQuantity} {i.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatCurrency(p.toFixed(2))}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatCurrency(totalVal.toFixed(2))}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                              isOut
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : isLow
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {isOut ? 'Zerado' : isLow ? 'Baixo' : 'Normal'}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ABA 3: SERVIÇOS CADASTRADOS */}
        {invServicesTab === 'services' && (
          <div className="overflow-hidden print:overflow-visible rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <table className="report-fit-table w-full text-left text-xs print:text-[9.5px]">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Nome do Serviço</th>
                  <th className="py-2.5 px-3">Categoria</th>
                  <th className="py-2.5 px-3 text-center">Unidade</th>
                  <th className="py-2.5 px-3 text-right">Custo Total</th>
                  <th className="py-2.5 px-3 text-right">Preço de Venda</th>
                  <th className="py-2.5 px-3 text-center">Margem</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredServices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Nenhum serviço cadastrado encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredServices.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-mono font-bold text-blue-600">{s.serviceCode}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">{s.name}</td>
                      <td className="py-2 px-3 text-slate-500">{s.categoryName || 'Serviços'}</td>
                      <td className="py-2 px-3 text-center text-slate-600 uppercase font-mono">{s.billingUnit}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">
                        {formatCurrency(parseFloat(s.totalCost).toFixed(2))}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(parseFloat(s.salePrice).toFixed(2))}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-semibold text-emerald-600">
                        {s.profitMargin}%
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                            s.isActive
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {s.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <ReportPrintFooter
          emissionWeekday={emissionWeekday}
          emissionDate={emissionDate}
          emissionTime={emissionTime}
        />
      </div>
    )
  }

  // ============================================================================
  // VIEW: 4. RELATÓRIOS DE GERENCIAMENTO DE CAIXA
  // ============================================================================
  if (currentView === 'cash_management') {
    return (
      <CashManagementReportView
        dataset={dataset}
        organizationName={currentOrganization?.name}
        organizationLogoUrl={currentOrganization?.logoUrl}
        isRefreshing={isLoading}
        onRefresh={() => void loadData()}
        onBack={() => navigateToView('home')}
        printOrientationMode={printOrientationMode}
        effectiveOrientation={effectiveOrientation}
        onPrintOrientationChange={setPrintOrientationMode}
      />
    )
  }

  // ============================================================================
  // VIEW: 5. GRÁFICO PRINCIPAL DE VENDAS – ALTA VISIBILIDADE
  // ============================================================================
  if (currentView === 'sales_chart') {
    return (
      <SalesMainChartView
        dataset={dataset}
        isRefreshing={isLoading}
        onRefresh={() => void loadData()}
        onBack={() => navigateToView('home')}
      />
    )
  }

  return null
}
