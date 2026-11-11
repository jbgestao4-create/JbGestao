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
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileBarChart,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react'
import { ReportPrintHeader } from '../components/ReportPrintHeader'
import { ReportPrintFooter } from '../components/ReportPrintFooter'
import { ReportActionBar } from '../components/ReportActionBar'

type ReportView = 'home' | 'registrations' | 'quotes_orders'
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
      let statusLabel = 'Pendente'
      let statusBadgeColor = 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300'
      if (os.status === 'in_maintenance') {
        statusLabel = 'Em Manutenção'
        statusBadgeColor = 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300'
      } else if (os.status === 'ready') {
        statusLabel = 'Pronto'
        statusBadgeColor = 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
      } else if (os.status === 'closed') {
        statusLabel = 'Entregue / Concluído'
        statusBadgeColor = 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300'
      } else if (os.status === 'queue') {
        statusLabel = 'Na Fila'
        statusBadgeColor = 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300'
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

      // 3. Filtro de Status
      if (qoStatus !== 'all' && rec.status !== qoStatus) return false

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
  // VIEW: CENTRAL DE RELATÓRIO (HUB PRINCIPAL LIMPO)
  // ============================================================================
  if (currentView === 'home') {
    const totalQuotesOrdersAll = dataset.serviceOrders.length + dataset.quotes.length
    const grandFinanceAll =
      dataset.serviceOrders.reduce((sum, os) => sum + (parseFloat(os.total) || 0), 0) +
      dataset.quotes.reduce((sum, q) => sum + (parseFloat(q.total) || 0), 0)

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
            qoTab === 'orders'
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
                  <option value="all">Todos os Status</option>
                  <option value="queue">Na Fila (O.S)</option>
                  <option value="pending">Pendente (O.S)</option>
                  <option value="in_maintenance">Em Manutenção (O.S)</option>
                  <option value="ready">Pronto (O.S)</option>
                  <option value="closed">Entregue / Concluído (O.S)</option>
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
          </CardContent>
        </Card>

        {/* INDICADORES RESUMIDOS DO PERÍODO SELECIONADO */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-gray-500 uppercase">Ordens de Serviço</span>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(qoMetrics.ordersTotal.toFixed(2))}
                </h4>
                <p className="text-[10px] text-gray-400">{qoMetrics.ordersCount} O.S filtradas</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-gray-500 uppercase">Orçamentos</span>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(qoMetrics.quotesTotal.toFixed(2))}
                </h4>
                <p className="text-[10px] text-gray-400">{qoMetrics.quotesCount} orçamentos filtrados</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-gray-500 uppercase">Total Consolidado</span>
                <h4 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(qoMetrics.grandTotal.toFixed(2))}
                </h4>
                <p className="text-[10px] text-gray-400">{qoMetrics.totalCount} registros totais</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-gray-500 uppercase">Período Auditado</span>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                  {qoPeriodInfo.rangeText}
                </h4>
                <p className="text-[10px] text-gray-400">{qoPeriodInfo.label}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* LISTAGEM DETALHADA DE REGISTROS FORMATADOS PARA TELA E IMPRESSÃO A4 */}
        <div className="space-y-4">
          {filteredQoRecords.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center bg-white dark:bg-slate-900/40">
              <ClipboardList className="h-10 w-10 text-slate-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Nenhuma Ordem de Serviço ou Orçamento encontrado
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Não foram localizados registros para o período ({qoPeriodInfo.rangeText}) com os filtros selecionados.
              </p>
            </div>
          ) : (
            filteredQoRecords.map((item) => (
              <div
                key={`${item.kind}-${item.id}`}
                className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs break-inside-avoid print:border-slate-400 print:shadow-none print:p-4 print:mb-4"
              >
                {/* Linha Superior: Tipo, Número, Status e Valor Total */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        item.kind === 'order'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      }`}
                    >
                      {item.kind === 'order' ? <Wrench className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                          {item.number}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${item.statusBadgeColor}`}
                        >
                          {item.statusLabel}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 uppercase">
                          • {item.kind === 'order' ? 'Ordem de Serviço' : 'Orçamento'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Emissão: {item.date ? new Date(item.date).toLocaleString('pt-BR') : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Valor Total</span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatCurrency(item.total)}
                    </span>
                    {parseFloat(item.discount) > 0 && (
                      <span className="text-[10px] text-rose-500 block">
                        Desconto: {formatCurrency(item.discount)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Grade de Detalhes do Registro */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Cliente</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {item.customerName}
                    </span>
                    {item.customerDocument && (
                      <span className="block text-[11px] text-slate-400 font-mono mt-0.5">
                        {item.customerDocument}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Contato</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {item.customerPhone ? formatPhoneNumber(item.customerPhone) : 'Telefone não informado'}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">
                      {item.kind === 'order' ? 'Técnico Responsável' : 'Vendedor / Criador'}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {item.responsiblePerson || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">
                      {item.kind === 'order' ? 'Previsão de Entrega' : 'Validade da Proposta'}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {item.kind === 'order'
                        ? item.estimatedDelivery
                          ? new Date(item.estimatedDelivery).toLocaleDateString('pt-BR')
                          : 'Não especificada'
                        : item.validUntil
                          ? new Date(item.validUntil).toLocaleDateString('pt-BR')
                          : 'Sem data limite'}
                    </span>
                  </div>

                  {item.description && (
                    <div className="sm:col-span-2 lg:col-span-4 pt-1">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">
                        {item.kind === 'order' ? 'Equipamento & Diagnóstico' : 'Observações'}
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 text-xs bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 mt-1">
                        {item.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))
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

      {/* CONTEÚDO DAS ABAS DE CADASTROS */}
      <div className="space-y-4">
        {registrationsTab === 'users' && (
          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                Nenhum usuário encontrado.
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
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">
                          {u.displayName || u.email.split('@')[0]}
                        </h4>
                        <span className="font-mono text-xs text-slate-500">{u.email}</span>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                        u.isOwner
                          ? 'bg-purple-100 text-purple-800'
                          : u.isAdmin
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {u.isOwner ? 'Proprietário' : u.isAdmin ? 'Administrador' : 'Usuário Padrão'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">E-mail de Acesso</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono truncate block">
                        {u.email}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Papel no Sistema</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {u.role === 'owner' ? 'Proprietário' : u.role === 'admin' ? 'Administrador' : 'Operador'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Nível de Permissão</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {u.isOwner ? 'Acesso Total (Owner)' : u.isAdmin ? 'Acesso Administrativo' : 'Acesso Operacional'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Status da Conta</span>
                      <span className="font-semibold text-emerald-600">Ativo</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {registrationsTab === 'employees' && (
          <div className="space-y-4">
            {filteredEmployees.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                Nenhum funcionário cadastrado.
              </div>
            ) : (
              filteredEmployees.map((e) => (
                <div
                  key={e.userId}
                  className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs break-inside-avoid print:border-slate-400 print:shadow-none print:p-4 print:mb-4"
                >
                  <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 font-bold text-sm">
                        <Briefcase className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">{e.name}</h4>
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          {e.jobTitle}
                        </span>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {e.role === 'owner' ? 'Proprietário' : e.role === 'admin' ? 'Administrador' : 'Colaborador'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Cargo / Função</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{e.jobTitle}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">E-mail Corporativo</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono truncate block">
                        {e.email}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Atribuição</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {e.role === 'owner' ? 'Gestão Geral' : e.role === 'admin' ? 'Supervisão' : 'Operação'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Situação Cadastral</span>
                      <span className="font-semibold text-emerald-600">Ativo na Organização</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {registrationsTab === 'suppliers' && (
          <div className="space-y-4">
            {filteredSuppliers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                Nenhum fornecedor cadastrado.
              </div>
            ) : (
              filteredSuppliers.map((s) => (
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
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">{s.name}</h4>
                        <span className="font-mono text-xs text-slate-500">
                          {s.document || 'Documento não informado'}
                        </span>
                      </div>
                    </div>
                    <span className="rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 px-3 py-1 text-xs font-semibold">
                      Fornecedor Homologado
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Telefone</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {s.phone ? formatPhoneNumber(s.phone) : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">E-mail Comercial</span>
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
              ))
            )}
          </div>
        )}

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
                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Classificação</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {c.personType === 'company' ? 'PJ - Empresarial' : 'PF - Individual'}
                        </span>
                      </div>
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
