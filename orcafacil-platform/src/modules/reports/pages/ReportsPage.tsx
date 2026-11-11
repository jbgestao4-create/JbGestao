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
  AlertTriangle,
  Ban,
  Boxes,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileBarChart,
  FileEdit,
  FileText,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react'
import { ReportPrintHeader } from '../components/ReportPrintHeader'
import { ReportPrintFooter } from '../components/ReportPrintFooter'
import { ReportActionBar } from '../components/ReportActionBar'

type ReportView = 'home' | 'registrations' | 'quotes_orders' | 'inventory'
type RegistrationsTab = 'users' | 'employees' | 'suppliers' | 'customers'

type QuotesOrdersPeriodMode = 'day' | 'month' | 'custom'
type QuotesOrdersTab = 'all' | 'orders' | 'quotes'

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

  const rawView = searchParams.get('view')
  const currentView: ReportView =
    rawView === 'registrations' || rawView === 'cadastros'
      ? 'registrations'
      : rawView === 'quotes_orders' || rawView === 'os_orcamentos' || rawView === 'os'
        ? 'quotes_orders'
        : rawView === 'inventory' || rawView === 'estoque'
          ? 'inventory'
          : 'home'

  // Abas do Módulo de Cadastros
  const rawTab = searchParams.get('tab')
  const initialTab: RegistrationsTab =
    rawTab === 'employees' || rawTab === 'suppliers' || rawTab === 'customers'
      ? rawTab
      : 'users'

  const [registrationsTab, setRegistrationsTab] = useState<RegistrationsTab>(initialTab)
  const [searchQuery, setSearchQuery] = useState('')

  // Filtro de período para o módulo de Cadastros
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>(() => {
    const initial = getPresetDateRange('month')
    return {
      preset: 'month',
      startDate: initial.startDate,
      endDate: initial.endDate,
    }
  })

  // ============================================================================
  // ESTADO DO MÓDULO: O.S & ORÇAMENTOS
  // ============================================================================
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], [])
  const currentMonthIso = useMemo(() => new Date().toISOString().slice(0, 7), [])

  const [qoPeriodMode, setQoPeriodMode] = useState<QuotesOrdersPeriodMode>('day')
  const [qoSelectedDay, setQoSelectedDay] = useState<string>(todayIso)
  const [qoSelectedMonth, setQoSelectedMonth] = useState<string>(currentMonthIso)
  const [qoCustomStartDate, setQoCustomStartDate] = useState<string>(() => {
    return getPresetDateRange('month').startDate
  })
  const [qoCustomEndDate, setQoCustomEndDate] = useState<string>(() => {
    return getPresetDateRange('month').endDate
  })
  const [qoTab, setQoTab] = useState<QuotesOrdersTab>('all')
  const [qoStatus, setQoStatus] = useState<string>('all')
  const [qoSearch, setQoSearch] = useState<string>('')

  // ============================================================================
  // ESTADO DO MÓDULO: RELATÓRIO DE ESTOQUE
  // ============================================================================
  const [invSearch, setInvSearch] = useState('')
  const [invStatus, setInvStatus] = useState<'all' | 'normal' | 'low' | 'out' | 'excess'>('all')
  const [invCategory, setInvCategory] = useState<string>('all')
  const [invSupplier, setInvSupplier] = useState<string>('all')
  const [invAbcClass, setInvAbcClass] = useState<'all' | 'A' | 'B' | 'C'>('all')
  const [invActiveFilter, setInvActiveFilter] = useState<'all' | 'active' | 'inactive' | 'can_sell'>('all')
  const [invSortBy, setInvSortBy] = useState<
    'value_desc' | 'cost_desc' | 'qty_asc' | 'qty_desc' | 'name_asc' | 'margin_desc'
  >('value_desc')

  // Dataset Geral
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

  const navigateToView = (view: ReportView, tab?: RegistrationsTab) => {
    const next: Record<string, string> = { view }
    if (tab) next.tab = tab
    setSearchParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleTabChange = (tab: RegistrationsTab) => {
    setRegistrationsTab(tab)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      return next
    })
  }

  // ============================================================================
  // CÁLCULOS: MÓDULO DE CADASTROS
  // ============================================================================
  const registrationsAnalytics = useMemo(() => {
    return reportsService.computeRegistrationsAnalytics(dataset)
  }, [dataset])

  const customerMetricsMap = useMemo(() => {
    const map = new Map<string, { totalSpent: number; salesCount: number }>()
    for (const s of dataset.sales) {
      if (s.customerId && s.status !== 'rejected' && s.status !== 'expired') {
        const cur = map.get(s.customerId) || { totalSpent: 0, salesCount: 0 }
        cur.totalSpent += parseFloat(s.total) || 0
        cur.salesCount += 1
        map.set(s.customerId, cur)
      }
    }
    return map
  }, [dataset.sales])

  const filteredMembers = useMemo(() => {
    return dataset.members.filter((m) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = m.displayName?.toLowerCase().includes(q)
        const matchEmail = m.email.toLowerCase().includes(q)
        const matchJob = m.jobTitle?.toLowerCase().includes(q)
        if (!matchName && !matchEmail && !matchJob) return false
      }
      return true
    })
  }, [dataset.members, searchQuery])

  const filteredUsers = useMemo(() => {
    return filteredMembers.map((m) => ({
      userId: m.userId,
      email: m.email,
      displayName: m.displayName,
      role: m.role,
      isOwner: m.role === 'owner',
      isAdmin: m.role === 'admin' || m.role === 'owner',
    }))
  }, [filteredMembers])

  const filteredEmployees = useMemo(() => {
    return filteredMembers
      .filter((m) => Boolean(m.jobTitle?.trim()) || m.role !== 'owner')
      .map((m) => ({
        userId: m.userId,
        name: m.displayName || m.email.split('@')[0],
        email: m.email,
        jobTitle: m.jobTitle || 'Colaborador',
        role: m.role,
      }))
  }, [filteredMembers])

  const filteredSuppliers = useMemo(() => {
    return dataset.suppliers.filter((s) => {
      if (!isDateInRange(s.createdAt, dateFilter)) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = s.name.toLowerCase().includes(q)
        const matchDoc = s.document?.toLowerCase().includes(q)
        const matchPhone = s.phone?.includes(q)
        const matchEmail = s.email?.toLowerCase().includes(q)
        if (!matchName && !matchDoc && !matchPhone && !matchEmail) return false
      }
      return true
    })
  }, [dataset.suppliers, dateFilter, searchQuery])

  const filteredCustomers = useMemo(() => {
    return dataset.customers.filter((c) => {
      if (!isDateInRange(c.createdAt, dateFilter)) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = c.name.toLowerCase().includes(q)
        const matchDoc = c.document?.toLowerCase().includes(q)
        const matchPhone = c.phone?.includes(q)
        const matchEmail = c.email?.toLowerCase().includes(q)
        if (!matchName && !matchDoc && !matchPhone && !matchEmail) return false
      }
      return true
    })
  }, [dataset.customers, dateFilter, searchQuery])

  const activeTabRecordsCount = useMemo(() => {
    switch (registrationsTab) {
      case 'users':
        return filteredUsers.length
      case 'employees':
        return filteredEmployees.length
      case 'suppliers':
        return filteredSuppliers.length
      case 'customers':
        return filteredCustomers.length
    }
  }, [registrationsTab, filteredUsers, filteredEmployees, filteredSuppliers, filteredCustomers])

  const activeTabTitle = useMemo(() => {
    switch (registrationsTab) {
      case 'users':
        return 'Usuários do Sistema'
      case 'employees':
        return 'Quadro de Funcionários'
      case 'suppliers':
        return 'Fornecedores Homologados'
      case 'customers':
        return 'Carteira de Clientes'
    }
  }, [registrationsTab])

  // Exportações do Módulo de Cadastros
  const handleExportCadastrosExcel = () => {
    const timestamp = new Date().toISOString().split('T')[0]
    if (registrationsTab === 'users') {
      const headers = ['E-mail', 'Nome de Exibição', 'Nível de Permissão', 'Proprietário']
      const rows = filteredUsers.map((u) => [
        u.email,
        u.displayName || '—',
        u.role === 'owner' ? 'Proprietário' : u.role === 'admin' ? 'Administrador' : 'Usuário Padrão',
        u.isOwner ? 'Sim' : 'Não',
      ])
      exportRowsToExcel(`relatorio-cadastros-usuarios-${timestamp}.xlsx`, headers, rows)
    } else if (registrationsTab === 'employees') {
      const headers = ['Nome do Funcionário', 'Cargo / Função', 'E-mail Corporativo', 'Nível de Acesso']
      const rows = filteredEmployees.map((e) => [
        e.name,
        e.jobTitle,
        e.email,
        e.role === 'owner' ? 'Proprietário' : e.role === 'admin' ? 'Administrador' : 'Operador',
      ])
      exportRowsToExcel(`relatorio-cadastros-funcionarios-${timestamp}.xlsx`, headers, rows)
    } else if (registrationsTab === 'suppliers') {
      const headers = ['Razão Social / Nome', 'CNPJ / CPF', 'Telefone / WhatsApp', 'E-mail', 'Endereço', 'Data de Cadastro']
      const rows = filteredSuppliers.map((s) => [
        s.name,
        s.document || '—',
        s.phone ? formatPhoneNumber(s.phone) : '—',
        s.email || '—',
        s.address || '—',
        s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-BR') : '—',
      ])
      exportRowsToExcel(`relatorio-cadastros-fornecedores-${timestamp}.xlsx`, headers, rows)
    } else {
      const headers = ['Nome / Razão Social', 'Tipo de Pessoa', 'CPF / CNPJ', 'Telefone', 'E-mail', 'Total em Compras (R$)', 'Faturamentos', 'Data de Cadastro']
      const rows = filteredCustomers.map((c) => {
        const metrics = customerMetricsMap.get(c.id)
        return [
          c.name,
          c.personType === 'company' ? 'Pessoa Jurídica' : 'Pessoa Física',
          c.document || '—',
          c.phone ? formatPhoneNumber(c.phone) : '—',
          c.email || '—',
          formatCurrency((metrics?.totalSpent || 0).toFixed(2)),
          metrics?.salesCount || 0,
          c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '—',
        ]
      })
      exportRowsToExcel(`relatorio-cadastros-clientes-${timestamp}.xlsx`, headers, rows)
    }
  }

  const handleExportCadastrosXml = () => {
    const timestamp = new Date().toISOString().split('T')[0]
    const metadata = {
      empresa: currentOrganization?.name || 'ControleSoft',
      data_emissao: emissionDate,
      hora_emissao: emissionTime,
      modulo: activeTabTitle,
      total_registros: activeTabRecordsCount,
    }
    if (registrationsTab === 'users') {
      const headers = ['email', 'nome', 'permissao', 'proprietario']
      const rows = filteredUsers.map((u) => [
        u.email,
        u.displayName || '',
        u.role,
        u.isOwner ? 'sim' : 'nao',
      ])
      exportRowsToXml(`relatorio-cadastros-usuarios-${timestamp}.xml`, 'relatorio_cadastros_usuarios', 'usuario', headers, rows, metadata)
    } else if (registrationsTab === 'employees') {
      const headers = ['nome', 'cargo', 'email', 'permissao']
      const rows = filteredEmployees.map((e) => [
        e.name,
        e.jobTitle,
        e.email,
        e.role,
      ])
      exportRowsToXml(`relatorio-cadastros-funcionarios-${timestamp}.xml`, 'relatorio_cadastros_funcionarios', 'funcionario', headers, rows, metadata)
    } else if (registrationsTab === 'suppliers') {
      const headers = ['nome', 'documento', 'telefone', 'email', 'endereco', 'data_cadastro']
      const rows = filteredSuppliers.map((s) => [
        s.name,
        s.document || '',
        s.phone || '',
        s.email || '',
        s.address || '',
        s.createdAt || '',
      ])
      exportRowsToXml(`relatorio-cadastros-fornecedores-${timestamp}.xml`, 'relatorio_cadastros_fornecedores', 'fornecedor', headers, rows, metadata)
    } else {
      const headers = ['nome', 'tipo_pessoa', 'documento', 'telefone', 'email', 'total_gasto', 'compras_count', 'data_cadastro']
      const rows = filteredCustomers.map((c) => {
        const metrics = customerMetricsMap.get(c.id)
        return [
          c.name,
          c.personType || 'individual',
          c.document || '',
          c.phone || '',
          c.email || '',
          (metrics?.totalSpent || 0).toFixed(2),
          metrics?.salesCount || 0,
          c.createdAt || '',
        ]
      })
      exportRowsToXml(`relatorio-cadastros-clientes-${timestamp}.xml`, 'relatorio_cadastros_clientes', 'cliente', headers, rows, metadata)
    }
  }

  // ============================================================================
  // CÁLCULOS: MÓDULO DE O.S & ORÇAMENTOS
  // ============================================================================
  const qoPeriodInfo = useMemo(() => {
    if (qoPeriodMode === 'day') {
      const d = new Date(qoSelectedDay + 'T12:00:00')
      const wDay = d.toLocaleDateString('pt-BR', { weekday: 'long' })
      const capWDay = wDay.charAt(0).toUpperCase() + wDay.slice(1)
      const dateFmt = d.toLocaleDateString('pt-BR')
      return {
        label: `Diário (${capWDay})`,
        rangeText: dateFmt,
      }
    }
    if (qoPeriodMode === 'month') {
      const [y, m] = qoSelectedMonth.split('-').map(Number)
      const d = new Date(y, m - 1, 1)
      const mStr = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      const capMStr = mStr.charAt(0).toUpperCase() + mStr.slice(1)
      return {
        label: 'Mensal',
        rangeText: capMStr,
      }
    }
    const startFmt = qoCustomStartDate.split('-').reverse().join('/')
    const endFmt = qoCustomEndDate.split('-').reverse().join('/')
    return {
      label: 'Período Específico',
      rangeText: `${startFmt} a ${endFmt}`,
    }
  }, [qoPeriodMode, qoSelectedDay, qoSelectedMonth, qoCustomStartDate, qoCustomEndDate])

  // Unificação dos Registros de O.S e Orçamentos
  interface UnifiedRecord {
    id: string
    kind: 'order' | 'quote'
    number: string
    date: string
    customerName: string
    customerPhone: string | null
    customerDocument: string | null
    status: string
    statusLabel: string
    statusBadgeColor: string
    responsiblePerson: string | null
    description: string
    subtotal: string
    discount: string
    total: string
    closedAt?: string | null
    validUntil?: string | null
    estimatedDelivery?: string | null
  }

  const allUnifiedRecords = useMemo<UnifiedRecord[]>(() => {
    const list: UnifiedRecord[] = []

    // 1. Mapeamento de Ordens de Serviço (O.S.)
    for (const os of dataset.serviceOrders) {
      let statusLabel = 'Manutenção Pendente'
      let statusBadgeColor = 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300'
      if (os.status === 'queue') {
        statusLabel = 'Fila de Atendimento'
        statusBadgeColor = 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300'
      } else if (os.status === 'in_maintenance') {
        statusLabel = 'Em Manutenção'
        statusBadgeColor = 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300'
      } else if (os.status === 'pending') {
        statusLabel = 'Manutenção Pendente'
        statusBadgeColor = 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300'
      } else if (os.status === 'ready') {
        statusLabel = 'Pronto'
        statusBadgeColor = 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
      } else if (os.status === 'closed') {
        statusLabel = 'O.S. Encerrada'
        statusBadgeColor = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300'
      }

      const equipDesc = [os.equipmentName, os.equipmentBrand, os.equipmentModel].filter(Boolean).join(' ')
      const desc = equipDesc
        ? `${equipDesc}${os.reportedProblem ? ` — ${os.reportedProblem}` : ''}`
        : os.reportedProblem || 'Serviços e Manutenção'

      list.push({
        id: os.id,
        kind: 'order',
        number: os.orderNumber ? `#OS-${os.orderNumber}` : `#OS-${os.id.slice(0, 6)}`,
        date: os.createdAt,
        customerName: os.customerName || 'Cliente sem identificação',
        customerPhone: os.customerPhone || null,
        customerDocument: os.customerDocument || null,
        status: os.status,
        statusLabel,
        statusBadgeColor,
        responsiblePerson: os.technicianName || os.creatorName || null,
        description: desc,
        subtotal: String(os.subtotal || os.total || '0'),
        discount: String(os.discount || '0'),
        total: String(os.total || '0'),
        closedAt: os.closedAt,
        estimatedDelivery: os.estimatedDeliveryDate,
      })
    }

    // 2. Mapeamento de Orçamentos
    for (const q of dataset.quotes) {
      let statusLabel = 'Em Aberto'
      let statusBadgeColor = 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300'
      if (q.status === 'approved') {
        statusLabel = 'Aprovado'
        statusBadgeColor = 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
      } else if (q.status === 'rejected') {
        statusLabel = 'Rejeitado'
        statusBadgeColor = 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300'
      } else if (q.status === 'expired') {
        statusLabel = 'Expirado'
        statusBadgeColor = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300'
      } else if (q.status === 'draft') {
        statusLabel = 'Rascunho'
        statusBadgeColor = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300'
      }

      list.push({
        id: q.id,
        kind: 'quote',
        number: q.quoteNumber ? `#ORC-${q.quoteNumber}` : `#ORC-${q.id.slice(0, 6)}`,
        date: q.createdAt,
        customerName: q.customerName || 'Cliente sem identificação',
        customerPhone: q.customerPhone || null,
        customerDocument: null,
        status: q.status,
        statusLabel,
        statusBadgeColor,
        responsiblePerson: q.sellerName || q.creatorName || null,
        description: 'Proposta Comercial / Orçamento',
        subtotal: String(q.subtotal || q.total || '0'),
        discount: String(q.discount || '0'),
        total: String(q.total || '0'),
        validUntil: q.validUntil,
      })
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [dataset.serviceOrders, dataset.quotes])

  // Filtragem dos Registros conforme o modo de período (Dia, Mês, Específico) e busca
  const filteredQoRecords = useMemo(() => {
    return allUnifiedRecords.filter((rec) => {
      // 1. Filtro de Sub-aba (Todos / Ordens / Orçamentos)
      if (qoTab === 'orders' && rec.kind !== 'order') return false
      if (qoTab === 'quotes' && rec.kind !== 'quote') return false

      // 2. Filtro de Período
      const recDate = rec.date.slice(0, 10)
      if (qoPeriodMode === 'day') {
        if (recDate !== qoSelectedDay) return false
      } else if (qoPeriodMode === 'month') {
        if (recDate.slice(0, 7) !== qoSelectedMonth) return false
      } else if (qoPeriodMode === 'custom') {
        if (qoCustomStartDate && recDate < qoCustomStartDate) return false
        if (qoCustomEndDate && recDate > qoCustomEndDate) return false
      }

      // 3. Filtro de Status / Filas
      if (qoStatus !== 'all') {
        if (qoStatus === 'maintenance_pending') {
          if (rec.status !== 'pending' && rec.status !== 'in_maintenance') return false
        } else if (rec.status !== qoStatus) {
          return false
        }
      }

      // 4. Busca Textual
      if (qoSearch.trim()) {
        const q = qoSearch.toLowerCase()
        const matchNum = rec.number.toLowerCase().includes(q)
        const matchCust = rec.customerName.toLowerCase().includes(q)
        const matchPhone = rec.customerPhone?.includes(q)
        const matchDoc = rec.customerDocument?.toLowerCase().includes(q)
        const matchResp = rec.responsiblePerson?.toLowerCase().includes(q)
        const matchDesc = rec.description.toLowerCase().includes(q)
        if (!matchNum && !matchCust && !matchPhone && !matchDoc && !matchResp && !matchDesc) {
          return false
        }
      }

      return true
    })
  }, [allUnifiedRecords, qoTab, qoPeriodMode, qoSelectedDay, qoSelectedMonth, qoCustomStartDate, qoCustomEndDate, qoStatus, qoSearch])

  // Estatísticas do Relatório de O.S & Orçamentos
  const qoMetrics = useMemo(() => {
    let ordersTotal = 0
    let ordersCount = 0
    let quotesTotal = 0
    let quotesCount = 0

    for (const rec of filteredQoRecords) {
      const val = parseFloat(rec.total) || 0
      if (rec.kind === 'order') {
        ordersCount += 1
        ordersTotal += val
      } else {
        quotesCount += 1
        quotesTotal += val
      }
    }

    return {
      ordersCount,
      ordersTotal,
      quotesCount,
      quotesTotal,
      grandTotal: ordersTotal + quotesTotal,
      totalCount: filteredQoRecords.length,
    }
  }, [filteredQoRecords])

  // Contadores das Filas de O.S (considerando o período ativo para auditoria precisa)
  const queueCounts = useMemo(() => {
    const osInPeriod = allUnifiedRecords.filter((rec) => {
      if (rec.kind !== 'order') return false
      const recDate = rec.date.slice(0, 10)
      if (qoPeriodMode === 'day') {
        if (recDate !== qoSelectedDay) return false
      } else if (qoPeriodMode === 'month') {
        if (recDate.slice(0, 7) !== qoSelectedMonth) return false
      } else if (qoPeriodMode === 'custom') {
        if (qoCustomStartDate && recDate < qoCustomStartDate) return false
        if (qoCustomEndDate && recDate > qoCustomEndDate) return false
      }
      return true
    })

    return {
      all: osInPeriod.length,
      queue: osInPeriod.filter((r) => r.status === 'queue').length,
      maintenance_pending: osInPeriod.filter((r) => r.status === 'pending' || r.status === 'in_maintenance').length,
      ready: osInPeriod.filter((r) => r.status === 'ready').length,
      closed: osInPeriod.filter((r) => r.status === 'closed').length,
    }
  }, [allUnifiedRecords, qoPeriodMode, qoSelectedDay, qoSelectedMonth, qoCustomStartDate, qoCustomEndDate])

  // Contadores de Status para Orçamentos (conforme filtro de período)
  const quoteStatusCounts = useMemo(() => {
    const quotesInPeriod = allUnifiedRecords.filter((rec) => {
      if (rec.kind !== 'quote') return false
      const recDate = rec.date.slice(0, 10)
      if (qoPeriodMode === 'day') {
        if (recDate !== qoSelectedDay) return false
      } else if (qoPeriodMode === 'month') {
        if (recDate.slice(0, 7) !== qoSelectedMonth) return false
      } else if (qoPeriodMode === 'custom') {
        if (qoCustomStartDate && recDate < qoCustomStartDate) return false
        if (qoCustomEndDate && recDate > qoCustomEndDate) return false
      }
      return true
    })

    return {
      total: quotesInPeriod.length,
      draft: quotesInPeriod.filter((r) => r.status === 'draft').length,
      approved: quotesInPeriod.filter((r) => r.status === 'approved' || r.status === 'completed').length,
      sent: quotesInPeriod.filter((r) => r.status === 'sent').length,
      rejected: quotesInPeriod.filter((r) => r.status === 'rejected').length,
    }
  }, [allUnifiedRecords, qoPeriodMode, qoSelectedDay, qoSelectedMonth, qoCustomStartDate, qoCustomEndDate])

  // Exportações de O.S & Orçamentos
  const handleExportQoExcel = () => {
    const timestamp = new Date().toISOString().split('T')[0]
    const headers = [
      'Tipo de Registro',
      'Número',
      'Data de Emissão',
      'Cliente',
      'Telefone',
      'Documento',
      'Status',
      'Responsável / Técnico',
      'Equipamento / Descrição',
      'Subtotal (R$)',
      'Desconto (R$)',
      'Valor Total (R$)',
    ]
    const rows = filteredQoRecords.map((r) => [
      r.kind === 'order' ? 'Ordem de Serviço (O.S)' : 'Orçamento',
      r.number,
      r.date ? new Date(r.date).toLocaleDateString('pt-BR') : '—',
      r.customerName,
      r.customerPhone ? formatPhoneNumber(r.customerPhone) : '—',
      r.customerDocument || '—',
      r.statusLabel,
      r.responsiblePerson || '—',
      r.description,
      formatCurrency(r.subtotal),
      formatCurrency(r.discount),
      formatCurrency(r.total),
    ])
    exportRowsToExcel(`relatorio-os-orcamentos-${timestamp}.xlsx`, headers, rows)
  }

  const handleExportQoXml = () => {
    const timestamp = new Date().toISOString().split('T')[0]
    const metadata = {
      empresa: currentOrganization?.name || 'ControleSoft',
      data_emissao: emissionDate,
      hora_emissao: emissionTime,
      periodo_modo: qoPeriodInfo.label,
      periodo_intervalo: qoPeriodInfo.rangeText,
      total_registros: filteredQoRecords.length,
      total_financeiro: qoMetrics.grandTotal.toFixed(2),
    }
    const headers = [
      'tipo',
      'numero',
      'data_emissao',
      'cliente',
      'telefone',
      'documento',
      'status',
      'responsavel',
      'descricao',
      'subtotal',
      'desconto',
      'valor_total',
    ]
    const rows = filteredQoRecords.map((r) => [
      r.kind === 'order' ? 'ordem_de_servico' : 'orcamento',
      r.number,
      r.date,
      r.customerName,
      r.customerPhone || '',
      r.customerDocument || '',
      r.status,
      r.responsiblePerson || '',
      r.description,
      r.subtotal,
      r.discount,
      r.total,
    ])
    exportRowsToXml(
      `relatorio-os-orcamentos-${timestamp}.xml`,
      'relatorio_ordens_servico_orcamentos',
      'registro',
      headers,
      rows,
      metadata,
    )
  }

  // ============================================================================
  // CÁLCULOS: MÓDULO DE RELATÓRIO DE ESTOQUE
  // ============================================================================
  const invCategories = useMemo(() => {
    const set = new Set<string>()
    dataset.inventory.forEach((i) => {
      if (i.category?.trim()) set.add(i.category.trim())
    })
    return Array.from(set).sort()
  }, [dataset.inventory])

  const invSuppliers = useMemo(() => {
    const map = new Map<string, string>()
    dataset.suppliers.forEach((s) => {
      map.set(s.id, s.name)
    })
    dataset.inventory.forEach((i) => {
      if (i.supplierId && i.supplierName) {
        map.set(i.supplierId, i.supplierName)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [dataset.suppliers, dataset.inventory])

  const enrichedInventory = useMemo(() => {
    const list = dataset.inventory.map((item) => {
      const qty = Math.max(0, parseFloat(item.quantityOnHand) || 0)
      const minQty = Math.max(0, parseFloat(item.minimumQuantity) || 0)
      const maxQty = parseFloat(item.maximumQuantity) || 0
      const cost = Math.max(0, parseFloat(item.purchasePrice) || parseFloat(item.averageCost) || 0)
      const price = Math.max(0, parseFloat(item.unitPrice) || 0)
      const totalCostValue = qty * cost
      const totalSaleValue = qty * price
      const potentialProfit = totalSaleValue - totalCostValue
      const marginPercent = price > 0 ? ((price - cost) / price) * 100 : 0

      let stockStatus: 'out' | 'low' | 'normal' | 'excess' = 'normal'
      let statusLabel = 'Normal'
      let statusBadgeColor = 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'

      if (qty <= 0) {
        stockStatus = 'out'
        statusLabel = 'Esgotado'
        statusBadgeColor = 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300'
      } else if (minQty > 0 && qty <= minQty) {
        stockStatus = 'low'
        statusLabel = 'Estoque Baixo'
        statusBadgeColor = 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300'
      } else if (maxQty > 0 && qty > maxQty) {
        stockStatus = 'excess'
        statusLabel = 'Excedente'
        statusBadgeColor = 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300'
      }

      return {
        ...item,
        qty,
        minQty,
        maxQty,
        cost,
        price,
        totalCostValue,
        totalSaleValue,
        potentialProfit,
        marginPercent,
        stockStatus,
        statusLabel,
        statusBadgeColor,
      }
    })

    // Curva ABC decrescente por valor total de venda
    const sorted = [...list].sort((a, b) => b.totalSaleValue - a.totalSaleValue)
    const grandSale = sorted.reduce((sum, i) => sum + i.totalSaleValue, 0)
    let cumulative = 0
    const abcMap = new Map<string, 'A' | 'B' | 'C'>()
    sorted.forEach((i) => {
      const share = grandSale > 0 ? (i.totalSaleValue / grandSale) * 100 : 0
      cumulative += share
      let cls: 'A' | 'B' | 'C' = 'C'
      if (cumulative <= 80 || (cumulative - share < 80 && share > 0)) {
        cls = 'A'
      } else if (cumulative <= 95 || (cumulative - share < 95 && share > 0)) {
        cls = 'B'
      }
      abcMap.set(i.id, cls)
    })

    return list.map((item) => ({
      ...item,
      abcClass: abcMap.get(item.id) || 'C',
    }))
  }, [dataset.inventory])

  const filteredInventory = useMemo(() => {
    return enrichedInventory
      .filter((item) => {
        // 1. Status do estoque
        if (invStatus !== 'all' && item.stockStatus !== invStatus) return false

        // 2. Categoria
        if (invCategory !== 'all' && (item.category || '').trim() !== invCategory) return false

        // 3. Fornecedor
        if (invSupplier !== 'all') {
          const matchSup =
            item.supplierId === invSupplier ||
            item.supplierName === invSupplier ||
            item.suppliers?.some((s) => s.supplierId === invSupplier)
          if (!matchSup) return false
        }

        // 4. Curva ABC
        if (invAbcClass !== 'all' && item.abcClass !== invAbcClass) return false

        // 5. Situação cadastral
        if (invActiveFilter === 'active' && !item.isActive) return false
        if (invActiveFilter === 'inactive' && item.isActive) return false
        if (invActiveFilter === 'can_sell' && !item.canSell) return false

        // 6. Busca textual
        if (invSearch.trim()) {
          const q = invSearch.toLowerCase()
          const matchName = item.name.toLowerCase().includes(q)
          const matchSku = item.sku?.toLowerCase().includes(q)
          const matchBarcode = item.barcode?.toLowerCase().includes(q)
          const matchBrand = item.brand?.toLowerCase().includes(q)
          const matchModel = item.model?.toLowerCase().includes(q)
          const matchCategory = item.category?.toLowerCase().includes(q)
          const matchLocation = item.location?.toLowerCase().includes(q)
          if (!matchName && !matchSku && !matchBarcode && !matchBrand && !matchModel && !matchCategory && !matchLocation) {
            return false
          }
        }

        return true
      })
      .sort((a, b) => {
        if (invSortBy === 'value_desc') return b.totalSaleValue - a.totalSaleValue
        if (invSortBy === 'cost_desc') return b.totalCostValue - a.totalCostValue
        if (invSortBy === 'qty_asc') return a.qty - b.qty
        if (invSortBy === 'qty_desc') return b.qty - a.qty
        if (invSortBy === 'name_asc') return a.name.localeCompare(b.name, 'pt-BR')
        if (invSortBy === 'margin_desc') return b.marginPercent - a.marginPercent
        return 0
      })
  }, [
    enrichedInventory,
    invStatus,
    invCategory,
    invSupplier,
    invAbcClass,
    invActiveFilter,
    invSearch,
    invSortBy,
  ])

  const inventoryMetrics = useMemo(() => {
    let totalUnits = 0
    let totalCostValue = 0
    let totalSaleValue = 0
    let outCount = 0
    let lowCount = 0
    let normalCount = 0
    let excessCount = 0

    for (const item of filteredInventory) {
      totalUnits += item.qty
      totalCostValue += item.totalCostValue
      totalSaleValue += item.totalSaleValue
      if (item.stockStatus === 'out') outCount += 1
      else if (item.stockStatus === 'low') lowCount += 1
      else if (item.stockStatus === 'excess') excessCount += 1
      else normalCount += 1
    }

    const potentialProfit = totalSaleValue - totalCostValue
    const avgMargin = totalSaleValue > 0 ? (potentialProfit / totalSaleValue) * 100 : 0

    return {
      totalItems: filteredInventory.length,
      totalUnits,
      totalCostValue,
      totalSaleValue,
      potentialProfit,
      avgMargin,
      outCount,
      lowCount,
      normalCount,
      excessCount,
    }
  }, [filteredInventory])

  const inventoryGlobalCounts = useMemo(() => {
    return {
      all: enrichedInventory.length,
      normal: enrichedInventory.filter((i) => i.stockStatus === 'normal').length,
      low: enrichedInventory.filter((i) => i.stockStatus === 'low').length,
      out: enrichedInventory.filter((i) => i.stockStatus === 'out').length,
      excess: enrichedInventory.filter((i) => i.stockStatus === 'excess').length,
    }
  }, [enrichedInventory])

  const inventoryStatusLabel = useMemo(() => {
    switch (invStatus) {
      case 'normal':
        return 'Estoque Normal'
      case 'low':
        return 'Estoque Baixo'
      case 'out':
        return 'Estoque Zerado / Esgotado'
      case 'excess':
        return 'Estoque Excedente'
      default:
        return 'Todos os Itens'
    }
  }, [invStatus])

  const handleExportInventoryExcel = () => {
    const timestamp = new Date().toISOString().split('T')[0]
    const headers = [
      'Código / SKU',
      'Código de Barras',
      'Descrição do Produto',
      'Categoria',
      'Marca',
      'Localização',
      'Unidade',
      'Qtd. em Estoque',
      'Qtd. Mínima',
      'Qtd. Máxima',
      'Preço de Custo (R$)',
      'Preço de Venda (R$)',
      'Valor Total Custo (R$)',
      'Valor Total Venda (R$)',
      'Lucro Potencial (R$)',
      'Margem de Lucro (%)',
      'Situação do Estoque',
      'Curva ABC',
      'Fornecedor Principal',
      'Ativo',
    ]
    const rows = filteredInventory.map((item) => [
      item.sku || '—',
      item.barcode || '—',
      item.name,
      item.category || 'Sem Categoria',
      item.brand || '—',
      item.location || '—',
      item.unit || 'UN',
      item.qty,
      item.minQty,
      item.maxQty > 0 ? item.maxQty : '—',
      formatCurrency(item.cost.toFixed(2)),
      formatCurrency(item.price.toFixed(2)),
      formatCurrency(item.totalCostValue.toFixed(2)),
      formatCurrency(item.totalSaleValue.toFixed(2)),
      formatCurrency(item.potentialProfit.toFixed(2)),
      `${item.marginPercent.toFixed(1)}%`,
      item.statusLabel,
      `Classe ${item.abcClass}`,
      item.supplierName || '—',
      item.isActive ? 'Sim' : 'Não',
    ])
    exportRowsToExcel(`relatorio-estoque-inventario-${timestamp}.xlsx`, headers, rows)
  }

  const handleExportInventoryXml = () => {
    const timestamp = new Date().toISOString().split('T')[0]
    const metadata = {
      empresa: currentOrganization?.name || 'ControleSoft',
      data_emissao: emissionDate,
      hora_emissao: emissionTime,
      filtro_status: invStatus,
      filtro_categoria: invCategory,
      total_produtos: filteredInventory.length,
      unidades_em_estoque: inventoryMetrics.totalUnits,
      valor_total_custo: inventoryMetrics.totalCostValue.toFixed(2),
      valor_total_venda: inventoryMetrics.totalSaleValue.toFixed(2),
      lucro_potencial: inventoryMetrics.potentialProfit.toFixed(2),
    }
    const headers = [
      'sku',
      'codigo_barras',
      'nome_produto',
      'categoria',
      'marca',
      'localizacao',
      'unidade',
      'quantidade_estoque',
      'quantidade_minima',
      'preco_custo',
      'preco_venda',
      'total_custo',
      'total_venda',
      'lucro_potencial',
      'margem_percentual',
      'status_estoque',
      'curva_abc',
      'fornecedor',
    ]
    const rows = filteredInventory.map((item) => [
      item.sku || '',
      item.barcode || '',
      item.name,
      item.category || '',
      item.brand || '',
      item.location || '',
      item.unit || 'UN',
      item.qty,
      item.minQty,
      item.cost.toFixed(2),
      item.price.toFixed(2),
      item.totalCostValue.toFixed(2),
      item.totalSaleValue.toFixed(2),
      item.potentialProfit.toFixed(2),
      item.marginPercent.toFixed(1),
      item.stockStatus,
      item.abcClass,
      item.supplierName || '',
    ])
    exportRowsToXml(
      `relatorio-estoque-inventario-${timestamp}.xml`,
      'relatorio_estoque',
      'produto',
      headers,
      rows,
      metadata
    )
  }

  // ============================================================================
  // VIEW: CENTRAL DE RELATÓRIO (HUB PRINCIPAL LIMPO)
  // ============================================================================
  if (currentView === 'home') {
    const totalQuotesOrdersAll = dataset.serviceOrders.length + dataset.quotes.length
    const grandFinanceAll =
      dataset.serviceOrders.reduce((sum, os) => sum + (parseFloat(os.total) || 0), 0) +
      dataset.quotes.reduce((sum, q) => sum + (parseFloat(q.total) || 0), 0)

    const totalInventorySkus = dataset.inventory.length
    const totalInventoryUnits = dataset.inventory.reduce((sum, i) => sum + (parseFloat(i.quantityOnHand) || 0), 0)
    const totalInventorySaleValue = dataset.inventory.reduce((sum, i) => {
      const q = Math.max(0, parseFloat(i.quantityOnHand) || 0)
      const p = Math.max(0, parseFloat(i.unitPrice) || 0)
      return sum + q * p
    }, 0)
    const inventoryAttentionCount = dataset.inventory.filter((i) => {
      const q = Math.max(0, parseFloat(i.quantityOnHand) || 0)
      const min = Math.max(0, parseFloat(i.minimumQuantity) || 0)
      return q <= 0 || (min > 0 && q <= min)
    }).length

    return (
      <div className="space-y-6">
        {/* CABEÇALHO DO HUB CENTRAL DE RELATÓRIO */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-slate-800 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
              <FileBarChart className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              Central de Relatório
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Selecione um dos módulos abaixo para auditoria, visualização, exportação e impressão de relatórios.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={isLoading}
              className="gap-2 rounded-xl border-gray-200 dark:border-slate-800 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar Dados
            </Button>
          </div>
        </div>

        {/* CATÁLOGO EXCLUSIVO DOS MÓDULOS DE RELATÓRIO */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Módulos Disponíveis
            </h2>
            <span className="text-xs text-gray-400">
              Clique no módulo desejado para acessar os filtros e emitir relatórios
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. MÓDULO: RELATÓRIO GERAL DE CADASTROS */}
            <Card className="group relative overflow-hidden rounded-2xl border-gray-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/60 p-3 text-blue-700 dark:text-blue-300">
                      <UserCheck className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-blue-800 dark:text-blue-300">
                      CADASTROS &amp; EQUIPE
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold tracking-wide text-gray-900 dark:text-white">
                    RELATÓRIO GERAL DE CADASTROS
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-gray-600 dark:text-slate-400">
                    Auditoria cadastral completa de usuários do sistema, equipe de funcionários, fornecedores homologados e carteira de clientes.
                  </p>
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <span>Usuários: <b>{registrationsAnalytics.totalUsers}</b></span>
                    <span>Funcionários: <b>{registrationsAnalytics.employeesCount}</b></span>
                    <span>Fornecedores: <b>{registrationsAnalytics.totalSuppliers}</b></span>
                    <span>Clientes: <b>{registrationsAnalytics.totalCustomers}</b></span>
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
                      Abrir Relatório de Cadastros
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 2. MÓDULO: RELATÓRIO DE O.S E ORÇAMENTOS */}
            <Card className="group relative overflow-hidden rounded-2xl border-gray-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/60 p-3 text-amber-700 dark:text-amber-300">
                      <Wrench className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-amber-50 dark:bg-amber-950/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-800 dark:text-amber-300">
                      ORDENS DE SERVIÇO &amp; PROPOSTAS
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold tracking-wide text-gray-900 dark:text-white">
                    RELATÓRIO DE O.S &amp; ORÇAMENTOS
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-gray-600 dark:text-slate-400">
                    Auditoria e controle detalhado de Ordens de Serviço (O.S) e Orçamentos comerciais. Visualize e filtre por Dia, Mês ou Período Específico com exportação Excel e XML.
                  </p>
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <span>O.S Emitidas: <b>{dataset.serviceOrders.length}</b></span>
                    <span>Orçamentos: <b>{dataset.quotes.length}</b></span>
                    <span>Total Registros: <b>{totalQuotesOrdersAll}</b></span>
                    <span>Volume Total: <b>{formatCurrency(grandFinanceAll.toFixed(2))}</b></span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    size="sm"
                    onClick={() => navigateToView('quotes_orders')}
                    className="w-full justify-between rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-xs"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Abrir Relatório de O.S &amp; Orçamentos
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 3. MÓDULO: RELATÓRIO DE ESTOQUE */}
            <Card className="group relative overflow-hidden rounded-2xl border-gray-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 p-3 text-emerald-700 dark:text-emerald-300">
                      <Package className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-800 dark:text-emerald-300">
                      ESTOQUE &amp; INVENTÁRIO
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold tracking-wide text-gray-900 dark:text-white">
                    RELATÓRIO DE ESTOQUE
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-gray-600 dark:text-slate-400">
                    Balanço analítico do inventário físico, controle de reposição mínima, itens esgotados, valorização a custo e venda, e Curva ABC.
                  </p>
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <span>Itens / SKUs: <b>{totalInventorySkus}</b></span>
                    <span>Unidades Físicas: <b>{totalInventoryUnits}</b></span>
                    <span>Atenção / Baixo: <b className={inventoryAttentionCount > 0 ? 'text-amber-600 font-bold' : ''}>{inventoryAttentionCount}</b></span>
                    <span>Valor de Venda: <b>{formatCurrency(totalInventorySaleValue.toFixed(2))}</b></span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    size="sm"
                    onClick={() => navigateToView('inventory')}
                    className="w-full justify-between rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Boxes className="h-4 w-4" />
                      Abrir Relatório de Estoque
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
  // VIEW: RELATÓRIO DE O.S E ORÇAMENTOS (FILTROS POR DIA, MÊS E ESPECÍFICO)
  // ============================================================================
  if (currentView === 'quotes_orders') {
    return (
      <div className="space-y-6">
        {/* CABEÇALHO EXCLUSIVO DE IMPRESSÃO (A4 PRINT MEDIA) */}
        <ReportPrintHeader
          organizationName={currentOrganization?.name}
          organizationLogoUrl={currentOrganization?.logoUrl}
          reportTitle="Relatório de Ordens de Serviço & Orçamentos"
          moduleTitle={
            qoStatus === 'queue'
              ? 'O.S - Fila de Atendimento'
              : qoStatus === 'maintenance_pending'
                ? 'O.S - Manutenção Pendente'
                : qoStatus === 'ready'
                  ? 'O.S - Pronto'
                  : qoStatus === 'closed'
                    ? 'O.S - Encerrada'
                    : qoTab === 'orders'
                      ? 'Ordens de Serviço (O.S)'
                      : qoTab === 'quotes'
                        ? 'Orçamentos Comerciais'
                        : 'Visão Consolidada (O.S & Orçamentos)'
          }
          totalRecords={filteredQoRecords.length}
          emissionWeekday={emissionWeekday}
          emissionDate={emissionDate}
          emissionTime={emissionTime}
          periodLabel={qoPeriodInfo.label}
          periodRange={qoPeriodInfo.rangeText}
        />

        {/* BARRA DE AÇÃO COM VOLTAR, EXCEL, XML E IMPRESSÃO */}
        <ReportActionBar
          title="Relatório de O.S e Orçamentos"
          badgeText="Ordens de Serviço & Propostas"
          badgeColorClass="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
          description="Auditoria analítica e controle de Ordens de Serviço (O.S) e Orçamentos comerciais com filtros flexíveis por Dia, Mês ou Período Específico."
          onBack={() => navigateToView('home')}
          onExportExcel={handleExportQoExcel}
          onExportXml={handleExportQoXml}
          onPrint={() => window.print()}
          onRefresh={() => void loadData()}
          isRefreshing={isLoading}
          disableExport={filteredQoRecords.length === 0}
        />

        {/* BARRA DE FILTROS: POR DIA / POR MÊS / DATA ESPECÍFICA */}
        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs print:hidden">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Seletor de Modo: Dia / Mês / Específico */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setQoPeriodMode('day')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    qoPeriodMode === 'day'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Por Dia
                </button>
                <button
                  type="button"
                  onClick={() => setQoPeriodMode('month')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    qoPeriodMode === 'month'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Por Mês
                </button>
                <button
                  type="button"
                  onClick={() => setQoPeriodMode('custom')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    qoPeriodMode === 'custom'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Data Específica / Período
                </button>
              </div>

              {/* Controles do Seletor conforme o Modo Ativo */}
              {qoPeriodMode === 'day' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(qoSelectedDay + 'T12:00:00')
                      d.setDate(d.getDate() - 1)
                      setQoSelectedDay(d.toISOString().split('T')[0])
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                    title="Dia anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <input
                    type="date"
                    value={qoSelectedDay}
                    onChange={(e) => setQoSelectedDay(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(qoSelectedDay + 'T12:00:00')
                      d.setDate(d.getDate() + 1)
                      setQoSelectedDay(d.toISOString().split('T')[0])
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                    title="Próximo dia"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setQoSelectedDay(todayIso)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 transition"
                  >
                    Hoje
                  </button>
                </div>
              )}

              {qoPeriodMode === 'month' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const [y, m] = qoSelectedMonth.split('-').map(Number)
                      const d = new Date(y, m - 2, 1)
                      const prevM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                      setQoSelectedMonth(prevM)
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                    title="Mês anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <input
                    type="month"
                    value={qoSelectedMonth}
                    onChange={(e) => setQoSelectedMonth(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const [y, m] = qoSelectedMonth.split('-').map(Number)
                      const d = new Date(y, m, 1)
                      const nextM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                      setQoSelectedMonth(nextM)
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                    title="Próximo mês"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setQoSelectedMonth(currentMonthIso)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 transition"
                  >
                    Mês Atual
                  </button>
                </div>
              )}

              {qoPeriodMode === 'custom' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">De:</span>
                  <input
                    type="date"
                    value={qoCustomStartDate}
                    onChange={(e) => setQoCustomStartDate(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="text-xs text-slate-500">Até:</span>
                  <input
                    type="date"
                    value={qoCustomEndDate}
                    onChange={(e) => setQoCustomEndDate(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>

            {/* Linha Secundária de Filtros: Sub-aba (Todos / O.S / Orçamentos), Status e Busca */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQoTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    qoTab === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Todos ({allUnifiedRecords.length})
                </button>
                <button
                  type="button"
                  onClick={() => setQoTab('orders')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    qoTab === 'orders'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Ordens de Serviço ({dataset.serviceOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setQoTab('quotes')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    qoTab === 'quotes'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Orçamentos ({dataset.quotes.length})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Filtro de Status */}
                <select
                  value={qoStatus}
                  onChange={(e) => setQoStatus(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                >
                  <option value="all">Fila de Todas (O.S &amp; Orçamentos)</option>
                  <option value="queue">Fila de Atendimento (O.S)</option>
                  <option value="maintenance_pending">Manutenção Pendente (O.S)</option>
                  <option value="in_maintenance">Em Manutenção (O.S)</option>
                  <option value="pending">Pendente (O.S)</option>
                  <option value="ready">Pronto (O.S)</option>
                  <option value="closed">O.S. Encerrada</option>
                  <option value="draft">Rascunho (Orçamento)</option>
                  <option value="approved">Aprovado (Orçamento)</option>
                  <option value="rejected">Rejeitado (Orçamento)</option>
                  <option value="expired">Expirado (Orçamento)</option>
                </select>

                {/* Campo de Busca */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar O.S, orçamento, cliente..."
                    value={qoSearch}
                    onChange={(e) => setQoSearch(e.target.value)}
                    className="w-48 sm:w-60 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* LINHA DE FILAS RÁPIDAS DE O.S */}
            <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-gray-100 dark:border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                Fila de O.S:
              </span>
              <button
                type="button"
                onClick={() => setQoStatus('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  qoStatus === 'all'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Fila de Todas ({queueCounts.all})
              </button>
              <button
                type="button"
                onClick={() => {
                  setQoStatus('queue')
                  if (qoTab === 'quotes') setQoTab('orders')
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  qoStatus === 'queue'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                }`}
              >
                Fila de Atendimento ({queueCounts.queue})
              </button>
              <button
                type="button"
                onClick={() => {
                  setQoStatus('maintenance_pending')
                  if (qoTab === 'quotes') setQoTab('orders')
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  qoStatus === 'maintenance_pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                }`}
              >
                Manutenção Pendente ({queueCounts.maintenance_pending})
              </button>
              <button
                type="button"
                onClick={() => {
                  setQoStatus('ready')
                  if (qoTab === 'quotes') setQoTab('orders')
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  qoStatus === 'ready'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                }`}
              >
                Pronto ({queueCounts.ready})
              </button>
              <button
                type="button"
                onClick={() => {
                  setQoStatus('closed')
                  if (qoTab === 'quotes') setQoTab('orders')
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  qoStatus === 'closed'
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                O.S. Encerrada ({queueCounts.closed})
              </button>
            </div>
          </CardContent>
        </Card>

        {/* CARDS DE MÉTRICAS VISUAIS (EXIBIÇÃO EM TELA, OCULTOS NA IMPRESSÃO A4) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 print:hidden">
          {qoTab === 'quotes' ? (
            <>
              {/* 1. Total de Orçamentos */}
              <Card
                onClick={() => setQoStatus('all')}
                className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/30 dark:to-slate-900 ${
                  qoStatus === 'all' ? 'ring-2 ring-indigo-500/50' : ''
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Total de Orçamentos
                    </p>
                    <p className="text-xl font-extrabold text-indigo-700 dark:text-indigo-300 mt-0.5">
                      {quoteStatusCounts.total} cadastrado(s)
                    </p>
                  </div>
                  <div className="rounded-xl bg-indigo-100 dark:bg-indigo-900/60 p-2 text-indigo-700 dark:text-indigo-300">
                    <FileText className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* 2. Em Rascunho */}
              <Card
                onClick={() => setQoStatus('draft')}
                className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-amber-100 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/30 dark:to-slate-900 ${
                  qoStatus === 'draft' ? 'ring-2 ring-amber-500/50' : ''
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Em Rascunho
                    </p>
                    <p className="text-xl font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">
                      {quoteStatusCounts.draft} rascunho(s)
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-100 dark:bg-amber-900/60 p-2 text-amber-700 dark:text-amber-300">
                    <FileEdit className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* 3. Aprovados */}
              <Card
                onClick={() => setQoStatus('approved')}
                className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-emerald-100 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/30 dark:to-slate-900 ${
                  qoStatus === 'approved' ? 'ring-2 ring-emerald-500/50' : ''
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Orçamentos Aprovados
                    </p>
                    <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {quoteStatusCounts.approved} aprovado(s)
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/60 p-2 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* 4. Enviado ao Cliente */}
              <Card
                onClick={() => setQoStatus('sent')}
                className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-blue-100 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/30 dark:to-slate-900 ${
                  qoStatus === 'sent' ? 'ring-2 ring-blue-500/50' : ''
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Enviado ao Cliente
                    </p>
                    <p className="text-xl font-extrabold text-blue-700 dark:text-blue-300 mt-0.5">
                      {quoteStatusCounts.sent} enviado(s)
                    </p>
                  </div>
                  <div className="rounded-xl bg-blue-100 dark:bg-blue-900/60 p-2 text-blue-700 dark:text-blue-300">
                    <Send className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* 5. Recusados */}
              <Card
                onClick={() => setQoStatus('rejected')}
                className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-rose-100 dark:border-rose-900/50 bg-gradient-to-br from-rose-50/50 to-white dark:from-rose-950/30 dark:to-slate-900 ${
                  qoStatus === 'rejected' ? 'ring-2 ring-rose-500/50' : ''
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Recusados
                    </p>
                    <p className="text-xl font-extrabold text-rose-700 dark:text-rose-300 mt-0.5">
                      {quoteStatusCounts.rejected} recusado(s)
                    </p>
                  </div>
                  <div className="rounded-xl bg-rose-100 dark:bg-rose-900/60 p-2 text-rose-700 dark:text-rose-300">
                    <Ban className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </>
          ) : qoTab === 'orders' ? (
            <>
              {/* 1. Total O.S */}
              <Card
                onClick={() => setQoStatus('all')}
                className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/30 dark:to-slate-900 ${
                  qoStatus === 'all' ? 'ring-2 ring-indigo-500/50' : ''
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Total de O.S
                    </p>
                    <p className="text-xl font-extrabold text-indigo-700 dark:text-indigo-300 mt-0.5">
                      {queueCounts.all} cadastrada(s)
                    </p>
                  </div>
                  <div className="rounded-xl bg-indigo-100 dark:bg-indigo-900/60 p-2 text-indigo-700 dark:text-indigo-300">
                    <Wrench className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* 2. Fila de Atendimento */}
              <Card
                onClick={() => setQoStatus('queue')}
                className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-blue-100 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/30 dark:to-slate-900 ${
                  qoStatus === 'queue' ? 'ring-2 ring-blue-500/50' : ''
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Fila de Atendimento
                    </p>
                    <p className="text-xl font-extrabold text-blue-700 dark:text-blue-300 mt-0.5">
                      {queueCounts.queue} na fila
                    </p>
                  </div>
                  <div className="rounded-xl bg-blue-100 dark:bg-blue-900/60 p-2 text-blue-700 dark:text-blue-300">
                    <FileText className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* 3. Manutenção Pendente */}
              <Card
                onClick={() => setQoStatus('maintenance_pending')}
                className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-amber-100 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/30 dark:to-slate-900 ${
                  qoStatus === 'maintenance_pending' ? 'ring-2 ring-amber-500/50' : ''
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Manutenção Pendente
                    </p>
                    <p className="text-xl font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">
                      {queueCounts.maintenance_pending} em serviço
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-100 dark:bg-amber-900/60 p-2 text-amber-700 dark:text-amber-300">
                    <Wrench className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* 4. Pronto */}
              <Card
                onClick={() => setQoStatus('ready')}
                className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-emerald-100 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/30 dark:to-slate-900 ${
                  qoStatus === 'ready' ? 'ring-2 ring-emerald-500/50' : ''
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Pronto p/ Retirada
                    </p>
                    <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {queueCounts.ready} pronto(s)
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/60 p-2 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* 5. O.S Encerrada */}
              <Card
                onClick={() => setQoStatus('closed')}
                className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-100 to-white dark:from-slate-900 dark:to-slate-950 ${
                  qoStatus === 'closed' ? 'ring-2 ring-slate-500/50' : ''
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      O.S. Encerradas
                    </p>
                    <p className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">
                      {queueCounts.closed} encerrada(s)
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-200 dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              {/* 1. Total Geral */}
              <Card
                onClick={() => setQoStatus('all')}
                className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/30 dark:to-slate-900 ${
                  qoStatus === 'all' ? 'ring-2 ring-indigo-500/50' : ''
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Total Registros
                    </p>
                    <p className="text-xl font-extrabold text-indigo-700 dark:text-indigo-300 mt-0.5">
                      {qoMetrics.totalCount} cadastrado(s)
                    </p>
                  </div>
                  <div className="rounded-xl bg-indigo-100 dark:bg-indigo-900/60 p-2 text-indigo-700 dark:text-indigo-300">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* 2. Ordens de Serviço */}
              <Card
                onClick={() => {
                  setQoTab('orders')
                  setQoStatus('all')
                }}
                className="cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-amber-100 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/30 dark:to-slate-900"
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Ordens de Serviço
                    </p>
                    <p className="text-xl font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">
                      {qoMetrics.ordersCount} O.S
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-100 dark:bg-amber-900/60 p-2 text-amber-700 dark:text-amber-300">
                    <Wrench className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* 3. Orçamentos */}
              <Card
                onClick={() => {
                  setQoTab('quotes')
                  setQoStatus('all')
                }}
                className="cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-blue-100 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/30 dark:to-slate-900"
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Orçamentos
                    </p>
                    <p className="text-xl font-extrabold text-blue-700 dark:text-blue-300 mt-0.5">
                      {qoMetrics.quotesCount} proposta(s)
                    </p>
                  </div>
                  <div className="rounded-xl bg-blue-100 dark:bg-blue-900/60 p-2 text-blue-700 dark:text-blue-300">
                    <FileText className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* 4. Total Consolidado */}
              <Card className="transition-all rounded-xl shadow-xs border-emerald-100 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/30 dark:to-slate-900">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Total Consolidado
                    </p>
                    <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5 font-mono">
                      {formatCurrency(qoMetrics.grandTotal.toFixed(2))}
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/60 p-2 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* 5. Período */}
              <Card className="transition-all rounded-xl shadow-xs border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Período Auditado
                    </p>
                    <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200 mt-0.5 truncate max-w-[120px]">
                      {qoPeriodInfo.rangeText}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-200 dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-300">
                    <Calendar className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* LISTAGEM EM TABELA OFICIAL FORMATADA PARA TELA E IMPRESSÃO A4 */}
        <div className="space-y-4">
          {filteredQoRecords.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center bg-white dark:bg-slate-900/40">
              <ClipboardList className="h-10 w-10 text-slate-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Nenhum registro encontrado
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Não foram localizadas Ordens de Serviço ou Orçamentos para os filtros selecionados.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs print:border-slate-400 print:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs print:text-[11px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Número</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Telefone</th>
                      <th className="py-2.5 px-3">Equipamento / Descrição</th>
                      <th className="py-2.5 px-3">Responsável</th>
                      <th className="py-2.5 px-3 text-center">Status / Fila</th>
                      <th className="py-2.5 px-3 text-right">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredQoRecords.map((item) => (
                      <tr
                        key={`${item.kind}-${item.id}`}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors break-inside-avoid"
                      >
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {item.number}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                          {item.kind === 'order' ? 'O.S' : 'Orçamento'}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-500">
                          {item.date ? new Date(item.date).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                          <span>{item.customerName}</span>
                          {item.customerDocument && (
                            <span className="block text-[10px] text-slate-400 font-mono">
                              {item.customerDocument}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {item.customerPhone ? formatPhoneNumber(item.customerPhone) : '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                          {item.description}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {item.responsiblePerson || '—'}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${item.statusBadgeColor}`}
                          >
                            {item.statusLabel}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-xs">
                    <tr>
                      <td colSpan={8} className="py-2.5 px-3 uppercase text-slate-700 dark:text-slate-300">
                        Total Geral ({filteredQoRecords.length} registros)
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700 dark:text-emerald-300 font-black whitespace-nowrap">
                        {formatCurrency(qoMetrics.grandTotal.toFixed(2))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ OFICIAL DE IMPRESSÃO */}
        <ReportPrintFooter
          emissionWeekday={emissionWeekday}
          emissionDate={emissionDate}
          emissionTime={emissionTime}
          documentType="Relatório Oficial de Auditoria de O.S & Orçamentos"
        />
      </div>
    )
  }

  // ============================================================================
  // VIEW: RELATÓRIO DE ESTOQUE
  // ============================================================================
  if (currentView === 'inventory') {
    return (
      <div className="space-y-6">
        {/* CABEÇALHO EXCLUSIVO DE IMPRESSÃO (A4 PRINT MEDIA) */}
        <ReportPrintHeader
          organizationName={currentOrganization?.name}
          organizationLogoUrl={currentOrganization?.logoUrl}
          reportTitle="Relatório Analítico de Estoque"
          moduleTitle={`Balanço de Estoque • ${inventoryStatusLabel}`}
          totalRecords={filteredInventory.length}
          totalAmountLabel="Valor Total de Venda"
          totalAmountValue={formatCurrency(inventoryMetrics.totalSaleValue.toFixed(2))}
          emissionWeekday={emissionWeekday}
          emissionDate={emissionDate}
          emissionTime={emissionTime}
          periodLabel="Posição Atual do Estoque"
          periodRange={invCategory !== 'all' ? `Categoria: ${invCategory}` : 'Todas as Categorias'}
        />

        {/* BARRA DE AÇÃO COM VOLTAR, EXCEL, XML E IMPRESSÃO */}
        <ReportActionBar
          title="Relatório de Estoque"
          badgeText="Inventário & Balanço Físico"
          badgeColorClass="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
          description="Auditoria analítica e controle de estoque com filtros de reposição mínima, itens zerados/esgotados, valorização a custo e venda, e Curva ABC."
          onBack={() => navigateToView('home')}
          onExportExcel={handleExportInventoryExcel}
          onExportXml={handleExportInventoryXml}
          onPrint={() => window.print()}
          onRefresh={() => void loadData()}
          isRefreshing={isLoading}
          disableExport={filteredInventory.length === 0}
        />

        {/* PAINEL DE FILTROS AVANÇADOS DO ESTOQUE */}
        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs print:hidden">
          <CardContent className="p-4 space-y-4">
            {/* Linha 1: Status do Estoque (Pills Rápidos com Contadores) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                  Status:
                </span>
                <button
                  type="button"
                  onClick={() => setInvStatus('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    invStatus === 'all'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Todos ({inventoryGlobalCounts.all})
                </button>
                <button
                  type="button"
                  onClick={() => setInvStatus('normal')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    invStatus === 'normal'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                  }`}
                >
                  Estoque Normal ({inventoryGlobalCounts.normal})
                </button>
                <button
                  type="button"
                  onClick={() => setInvStatus('low')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    invStatus === 'low'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                  }`}
                >
                  Estoque Baixo ({inventoryGlobalCounts.low})
                </button>
                <button
                  type="button"
                  onClick={() => setInvStatus('out')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    invStatus === 'out'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                  }`}
                >
                  Zerado / Esgotado ({inventoryGlobalCounts.out})
                </button>
                <button
                  type="button"
                  onClick={() => setInvStatus('excess')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    invStatus === 'excess'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                  }`}
                >
                  Excedente ({inventoryGlobalCounts.excess})
                </button>
              </div>

              {/* Botão para limpar todos os filtros */}
              {(invStatus !== 'all' ||
                invCategory !== 'all' ||
                invSupplier !== 'all' ||
                invAbcClass !== 'all' ||
                invActiveFilter !== 'all' ||
                invSearch.trim() ||
                invSortBy !== 'value_desc') && (
                <button
                  type="button"
                  onClick={() => {
                    setInvStatus('all')
                    setInvCategory('all')
                    setInvSupplier('all')
                    setInvAbcClass('all')
                    setInvActiveFilter('all')
                    setInvSearch('')
                    setInvSortBy('value_desc')
                  }}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
                  title="Restaurar todos os filtros"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Limpar Filtros</span>
                </button>
              )}
            </div>

            {/* CARDS DE MÉTRICAS VISUAIS (DIRETAMENTE ABAIXO DO STATUS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-1">
              {/* 1. Total Itens */}
              <Card
                onClick={() => setInvStatus('all')}
                className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/30 dark:to-slate-900 ${
                  invStatus === 'all' ? 'ring-2 ring-indigo-500/50' : ''
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Total de Produtos
                    </p>
                    <p className="text-xl font-extrabold text-indigo-700 dark:text-indigo-300 mt-0.5">
                      {inventoryMetrics.totalItems} produto(s)
                    </p>
                  </div>
                  <div className="rounded-xl bg-indigo-100 dark:bg-indigo-900/60 p-2 text-indigo-700 dark:text-indigo-300">
                    <Package className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* 2. Em Falta (Zerados) */}
              <Card
                onClick={() => setInvStatus('out')}
                className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-rose-100 dark:border-rose-900/50 bg-gradient-to-br from-rose-50/50 to-white dark:from-rose-950/30 dark:to-slate-900 ${
                  invStatus === 'out' ? 'ring-2 ring-rose-500/50' : ''
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Em Falta (Zerado)
                    </p>
                    <p className="text-xl font-extrabold text-rose-700 dark:text-rose-300 mt-0.5">
                      {inventoryMetrics.outCount} zerado(s)
                    </p>
                  </div>
                  <div className="rounded-xl bg-rose-100 dark:bg-rose-900/60 p-2 text-rose-700 dark:text-rose-300">
                    <Ban className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* 3. Estoque Baixo */}
              <Card
                onClick={() => setInvStatus('low')}
                className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-amber-100 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/30 dark:to-slate-900 ${
                  invStatus === 'low' ? 'ring-2 ring-amber-500/50' : ''
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Abaixo do Mínimo
                    </p>
                    <p className="text-xl font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">
                      {inventoryMetrics.lowCount} alerta(s)
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-100 dark:bg-amber-900/60 p-2 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* 4. Valor a Custo */}
              <Card className="transition-all rounded-xl shadow-xs border-blue-100 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/30 dark:to-slate-900">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Valor a Custo
                    </p>
                    <p className="text-lg font-extrabold text-blue-700 dark:text-blue-300 mt-0.5 font-mono">
                      {formatCurrency(inventoryMetrics.totalCostValue.toFixed(2))}
                    </p>
                  </div>
                  <div className="rounded-xl bg-blue-100 dark:bg-blue-900/60 p-2 text-blue-700 dark:text-blue-300">
                    <FileText className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* 5. Valor a Venda */}
              <Card className="transition-all rounded-xl shadow-xs border-emerald-100 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/30 dark:to-slate-900">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Valor a Venda
                    </p>
                    <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5 font-mono">
                      {formatCurrency(inventoryMetrics.totalSaleValue.toFixed(2))}
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/60 p-2 text-emerald-700 dark:text-emerald-300">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Linha 2: Dropdowns de Categoria, Fornecedor, Curva ABC, Situação, Ordenação e Busca */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-gray-100 dark:border-slate-800/80">
              {/* Filtro de Categoria */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Categoria
                </label>
                <select
                  value={invCategory}
                  onChange={(e) => setInvCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">Todas as Categorias</option>
                  {invCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro de Fornecedor */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Fornecedor
                </label>
                <select
                  value={invSupplier}
                  onChange={(e) => setInvSupplier(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">Todos os Fornecedores</option>
                  {invSuppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro Curva ABC */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Curva ABC
                </label>
                <select
                  value={invAbcClass}
                  onChange={(e) => setInvAbcClass(e.target.value as 'all' | 'A' | 'B' | 'C')}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">Todas as Classes</option>
                  <option value="A">Classe A (80% do Valor)</option>
                  <option value="B">Classe B (15% do Valor)</option>
                  <option value="C">Classe C (5% do Valor)</option>
                </select>
              </div>

              {/* Filtro Situação Cadastral */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Situação
                </label>
                <select
                  value={invActiveFilter}
                  onChange={(e) => setInvActiveFilter(e.target.value as 'all' | 'active' | 'inactive' | 'can_sell')}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">Todos os Itens</option>
                  <option value="active">Apenas Ativos</option>
                  <option value="can_sell">Disponíveis para Venda</option>
                  <option value="inactive">Inativos</option>
                </select>
              </div>

              {/* Ordenação */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Ordenar Por
                </label>
                <select
                  value={invSortBy}
                  onChange={(e) => setInvSortBy(e.target.value as 'value_desc' | 'cost_desc' | 'qty_asc' | 'qty_desc' | 'name_asc' | 'margin_desc')}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="value_desc">Maior Valor Venda</option>
                  <option value="cost_desc">Maior Valor Custo</option>
                  <option value="qty_asc">Menor Qtd. (Reposição)</option>
                  <option value="qty_desc">Maior Qtd.</option>
                  <option value="name_asc">Nome (A - Z)</option>
                  <option value="margin_desc">Maior Margem (%)</option>
                </select>
              </div>

              {/* Busca Textual */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Pesquisar
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Nome, SKU, barras..."
                    value={invSearch}
                    onChange={(e) => setInvSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TABELA OFICIAL DE ITENS FORMATADA PARA TELA E IMPRESSÃO A4 */}
        <div className="space-y-4">
          {filteredInventory.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center bg-white dark:bg-slate-900/40">
              <Boxes className="h-10 w-10 text-slate-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Nenhum produto encontrado no estoque
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Não foram localizados itens com os critérios e filtros selecionados. Tente ajustar os parâmetros.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs print:border-slate-400 print:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-3">Código / SKU</th>
                      <th className="py-3 px-3">Produto / Descrição</th>
                      <th className="py-3 px-3">Categoria</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-right">Qtd. Atual</th>
                      <th className="py-3 px-3 text-right">Mínimo</th>
                      <th className="py-3 px-3 text-right">Custo Unit.</th>
                      <th className="py-3 px-3 text-right">Venda Unit.</th>
                      <th className="py-3 px-3 text-right">Total Custo</th>
                      <th className="py-3 px-3 text-right">Total Venda</th>
                      <th className="py-3 px-3 text-center">Curva ABC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredInventory.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors break-inside-avoid"
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {item.sku || item.barcode || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            {item.name}
                          </span>
                          {(item.brand || item.model || item.location) && (
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {[item.brand, item.model, item.location ? `Loc: ${item.location}` : null]
                                .filter(Boolean)
                                .join(' • ')}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {item.category || 'Sem Categoria'}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${item.statusBadgeColor}`}
                          >
                            {item.statusLabel}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {item.qty} <span className="text-[10px] text-slate-400 font-normal">{item.unit || 'UN'}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500 whitespace-nowrap">
                          {item.minQty}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatCurrency(item.cost.toFixed(2))}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(item.price.toFixed(2))}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatCurrency(item.totalCostValue.toFixed(2))}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {formatCurrency(item.totalSaleValue.toFixed(2))}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                              item.abcClass === 'A'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : item.abcClass === 'B'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {item.abcClass}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-xs">
                    <tr>
                      <td colSpan={4} className="py-3 px-3 uppercase text-slate-700 dark:text-slate-300">
                        Totais Consolidados ({filteredInventory.length} itens)
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {inventoryMetrics.totalUnits.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400">—</td>
                      <td className="py-3 px-3 text-right text-slate-400">—</td>
                      <td className="py-3 px-3 text-right text-slate-400">—</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {formatCurrency(inventoryMetrics.totalCostValue.toFixed(2))}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-700 dark:text-emerald-300 font-black whitespace-nowrap">
                        {formatCurrency(inventoryMetrics.totalSaleValue.toFixed(2))}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ OFICIAL DE IMPRESSÃO */}
        <ReportPrintFooter
          emissionWeekday={emissionWeekday}
          emissionDate={emissionDate}
          emissionTime={emissionTime}
          documentType="Relatório Oficial de Auditoria & Balanço de Estoque"
        />
      </div>
    )
  }

  // ============================================================================
  // VIEW: RELATÓRIO GERAL DE CADASTROS (DETALHADO)
  // ============================================================================
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
        periodRange={
          dateFilter.startDate && dateFilter.endDate
            ? `${dateFilter.startDate.split('-').reverse().join('/')} a ${dateFilter.endDate.split('-').reverse().join('/')}`
            : ''
        }
      />

      {/* CABEÇALHO PADRÃO EM TELA COM BOTÃO VOLTAR */}
      <ReportActionBar
        title="Relatório Geral de Cadastros"
        badgeText="Cadastros & Equipe"
        badgeColorClass="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
        description="Auditoria cadastral completa de usuários do sistema, equipe de funcionários, fornecedores homologados e carteira de clientes."
        onBack={() => navigateToView('home')}
        onExportExcel={handleExportCadastrosExcel}
        onExportXml={handleExportCadastrosXml}
        onPrint={() => window.print()}
        onRefresh={() => void loadData()}
        isRefreshing={isLoading}
        disableExport={activeTabRecordsCount === 0}
      />

      {/* FILTROS DE PERÍODO */}
      <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs print:hidden">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['today', '7d', 'month', '30d', 'year', 'all'] as ReportPeriodPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  const range = getPresetDateRange(preset)
                  setDateFilter({ preset, startDate: range.startDate, endDate: range.endDate })
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  dateFilter.preset === preset
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
              value={dateFilter.startDate}
              onChange={(e) =>
                setDateFilter((prev) => ({
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
              value={dateFilter.endDate}
              onChange={(e) =>
                setDateFilter((prev) => ({
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

      {/* ABAS DO RELATÓRIO GERAL DE CADASTROS */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 print:hidden">
        <div className="flex space-x-1 sm:space-x-4">
          <button
            type="button"
            onClick={() => handleTabChange('users')}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-xs font-bold transition ${
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
            onClick={() => handleTabChange('employees')}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-xs font-bold transition ${
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
            onClick={() => handleTabChange('suppliers')}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-xs font-bold transition ${
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
            onClick={() => handleTabChange('customers')}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-xs font-bold transition ${
              registrationsTab === 'customers'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:hover:text-slate-300'
            }`}
          >
            <Users className="h-4 w-4" />
            Clientes ({filteredCustomers.length})
          </button>
        </div>

        {/* Busca por texto */}
        <div className="relative pb-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar nos cadastros..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 sm:w-64 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* CARDS DE MÉTRICAS VISUAIS (EXIBIÇÃO EM TELA, OCULTOS NA IMPRESSÃO A4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 print:hidden">
        {/* 1. Usuários */}
        <Card
          onClick={() => handleTabChange('users')}
          className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-purple-100 dark:border-purple-900/50 bg-gradient-to-br from-purple-50/50 to-white dark:from-purple-950/30 dark:to-slate-900 ${
            registrationsTab === 'users' ? 'ring-2 ring-purple-500/50' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Usuários Acesso
              </p>
              <p className="text-xl font-extrabold text-purple-700 dark:text-purple-300 mt-0.5">
                {filteredUsers.length} usuário(s)
              </p>
            </div>
            <div className="rounded-xl bg-purple-100 dark:bg-purple-900/60 p-2 text-purple-700 dark:text-purple-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 2. Funcionários */}
        <Card
          onClick={() => handleTabChange('employees')}
          className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/30 dark:to-slate-900 ${
            registrationsTab === 'employees' ? 'ring-2 ring-indigo-500/50' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Funcionários
              </p>
              <p className="text-xl font-extrabold text-indigo-700 dark:text-indigo-300 mt-0.5">
                {filteredEmployees.length} funcionário(s)
              </p>
            </div>
            <div className="rounded-xl bg-indigo-100 dark:bg-indigo-900/60 p-2 text-indigo-700 dark:text-indigo-300">
              <Briefcase className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 3. Fornecedores */}
        <Card
          onClick={() => handleTabChange('suppliers')}
          className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-blue-100 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/30 dark:to-slate-900 ${
            registrationsTab === 'suppliers' ? 'ring-2 ring-blue-500/50' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Fornecedores
              </p>
              <p className="text-xl font-extrabold text-blue-700 dark:text-blue-300 mt-0.5">
                {filteredSuppliers.length} fornecedor(es)
              </p>
            </div>
            <div className="rounded-xl bg-blue-100 dark:bg-blue-900/60 p-2 text-blue-700 dark:text-blue-300">
              <Truck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 4. Clientes */}
        <Card
          onClick={() => handleTabChange('customers')}
          className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-emerald-100 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/30 dark:to-slate-900 ${
            registrationsTab === 'customers' ? 'ring-2 ring-emerald-500/50' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Clientes
              </p>
              <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {filteredCustomers.length} cliente(s)
              </p>
            </div>
            <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/60 p-2 text-emerald-700 dark:text-emerald-300">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 5. Total Compras Clientes */}
        <Card className="transition-all rounded-xl shadow-xs border-amber-100 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/30 dark:to-slate-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Faturamento Clientes
              </p>
              <p className="text-lg font-extrabold text-amber-700 dark:text-amber-300 mt-0.5 font-mono">
                {formatCurrency(
                  filteredCustomers
                    .reduce((sum, c) => sum + (customerMetricsMap.get(c.id)?.totalSpent || 0), 0)
                    .toFixed(2),
                )}
              </p>
            </div>
            <div className="rounded-xl bg-amber-100 dark:bg-amber-900/60 p-2 text-amber-700 dark:text-amber-300">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CONTEÚDO DAS ABAS DE CADASTROS */}
      <div className="space-y-4">
        {registrationsTab === 'users' && (
          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
                Nenhum usuário encontrado.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs print:border-slate-400 print:shadow-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-3">Usuário / Exibição</th>
                        <th className="py-3 px-3">E-mail de Acesso</th>
                        <th className="py-3 px-3">Papel no Sistema</th>
                        <th className="py-3 px-3">Nível de Permissão</th>
                        <th className="py-3 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {filteredUsers.map((u) => (
                        <tr
                          key={u.userId}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors break-inside-avoid"
                        >
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                            {u.displayName || u.email.split('@')[0]}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                            {u.email}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                            {u.role === 'owner' ? 'Proprietário' : u.role === 'admin' ? 'Administrador' : 'Operador'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                            {u.isOwner ? 'Acesso Total (Owner)' : u.isAdmin ? 'Acesso Administrativo' : 'Acesso Operacional'}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                                u.isOwner
                                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                                  : u.isAdmin
                                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              Ativo
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-xs">
                      <tr>
                        <td colSpan={4} className="py-2.5 px-3 uppercase text-slate-700 dark:text-slate-300">
                          Total de Usuários Cadastrados
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                          {filteredUsers.length}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {registrationsTab === 'employees' && (
          <div className="space-y-4">
            {filteredEmployees.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
                Nenhum funcionário cadastrado.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs print:border-slate-400 print:shadow-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-3">Nome do Funcionário</th>
                        <th className="py-3 px-3">Cargo / Função</th>
                        <th className="py-3 px-3">E-mail Corporativo</th>
                        <th className="py-3 px-3">Atribuição</th>
                        <th className="py-3 px-3 text-center">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {filteredEmployees.map((e) => (
                        <tr
                          key={e.userId}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors break-inside-avoid"
                        >
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                            {e.name}
                          </td>
                          <td className="py-2.5 px-3 text-indigo-600 dark:text-indigo-400 font-medium">
                            {e.jobTitle}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                            {e.email}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                            {e.role === 'owner' ? 'Gestão Geral' : e.role === 'admin' ? 'Supervisão' : 'Operação'}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Ativo
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-xs">
                      <tr>
                        <td colSpan={4} className="py-2.5 px-3 uppercase text-slate-700 dark:text-slate-300">
                          Total de Funcionários
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                          {filteredEmployees.length}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {registrationsTab === 'suppliers' && (
          <div className="space-y-4">
            {filteredSuppliers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
                Nenhum fornecedor cadastrado.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs print:border-slate-400 print:shadow-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-3">Razão Social / Nome</th>
                        <th className="py-3 px-3">CNPJ / CPF</th>
                        <th className="py-3 px-3">Telefone / WhatsApp</th>
                        <th className="py-3 px-3">E-mail Comercial</th>
                        <th className="py-3 px-3">Endereço</th>
                        <th className="py-3 px-3 text-center">Data Cadastro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {filteredSuppliers.map((s) => (
                        <tr
                          key={s.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors break-inside-avoid"
                        >
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                            {s.name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {s.document || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {s.phone ? formatPhoneNumber(s.phone) : '—'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                            {s.email || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                            {s.address || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap text-slate-500">
                            {s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-BR') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-xs">
                      <tr>
                        <td colSpan={5} className="py-2.5 px-3 uppercase text-slate-700 dark:text-slate-300">
                          Total de Fornecedores Homologados
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                          {filteredSuppliers.length}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {registrationsTab === 'customers' && (
          <div className="space-y-4">
            {filteredCustomers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
                Nenhum cliente cadastrado.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs print:border-slate-400 print:shadow-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-3">Cliente / Razão Social</th>
                        <th className="py-3 px-3 text-center">Tipo</th>
                        <th className="py-3 px-3">Documento (CPF/CNPJ)</th>
                        <th className="py-3 px-3">Telefone / WhatsApp</th>
                        <th className="py-3 px-3">E-mail</th>
                        <th className="py-3 px-3 text-right">Total Compras</th>
                        <th className="py-3 px-3 text-center">Faturamentos</th>
                        <th className="py-3 px-3 text-center">Data Cadastro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {filteredCustomers.map((c) => {
                        const metrics = customerMetricsMap.get(c.id)
                        return (
                          <tr
                            key={c.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors break-inside-avoid"
                          >
                            <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                              {c.name}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span className="inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {c.personType === 'company' ? 'PJ' : 'PF'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {c.document || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {c.phone ? formatPhoneNumber(c.phone) : '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                              {c.email || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              {formatCurrency((metrics?.totalSpent || 0).toFixed(2))}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {metrics?.salesCount || 0}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap text-slate-500">
                              {c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-xs">
                      <tr>
                        <td colSpan={5} className="py-2.5 px-3 uppercase text-slate-700 dark:text-slate-300">
                          Total de Clientes ({filteredCustomers.length})
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700 dark:text-emerald-300 font-black whitespace-nowrap">
                          {formatCurrency(
                            filteredCustomers
                              .reduce((sum, c) => sum + (customerMetricsMap.get(c.id)?.totalSpent || 0), 0)
                              .toFixed(2),
                          )}
                        </td>
                        <td colSpan={2} className="py-2.5 px-3 text-center text-slate-400">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
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
