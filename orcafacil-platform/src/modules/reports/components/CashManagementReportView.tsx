import { useMemo, useState } from 'react'
import {
  BookOpen,
  Calendar,
  CalendarCheck,
  Printer,
  Search,
  UserCheck,
  Wallet,
} from 'lucide-react'
import { formatCurrency } from '@shared/utils/monetary'
import { Card, CardContent } from '@shared/components/ui/Card'
import { PAYMENT_METHOD_LABELS } from '@modules/sales/services/sales.service'
import {
  exportRowsToExcel,
  exportRowsToXml,
  getPresetDateRange,
  isDateInRange,
  type DateRangeFilter,
  type ReportPeriodPreset,
  type ReportsDataset,
} from '../services/reports.service'
import { ReportActionBar } from './ReportActionBar'
import { ReportPrintHeader } from './ReportPrintHeader'
import { ReportPrintFooter } from './ReportPrintFooter'

export type CashReportTab = 'cash_book' | 'sessions' | 'by_employee' | 'monthly_closing'

interface DailyClosingRow {
  dateKey: string // YYYY-MM-DD
  dateLabel: string // DD/MM/YYYY
  salesCount: number
  money: number
  pix: number
  creditCard: number
  debitCard: number
  onCreditAndOther: number
  total: number
}

interface CashBookRow {
  id: string
  timestamp: string
  origin: 'Abertura de Caixa' | 'Suprimento' | 'Sangria' | 'Venda' | 'Lançamento Financeiro'
  description: string
  operatorName: string
  paymentMethod: string
  income: number
  expense: number
  runningBalance: number
}

interface EmployeeCashSummary {
  employeeName: string
  sessionsCount: number
  salesCount: number
  totalSales: number
  totalMoney: number
  totalPix: number
  totalCredit: number
  totalDebit: number
  totalSupplies: number
  totalWithdrawals: number
  totalDifference: number
}

interface CashManagementReportViewProps {
  dataset: ReportsDataset
  organizationName?: string
  organizationLogoUrl?: string | null
  isRefreshing: boolean
  onRefresh: () => void
  onBack: () => void
  printOrientationMode: 'auto' | 'portrait' | 'landscape'
  effectiveOrientation: 'portrait' | 'landscape'
  onPrintOrientationChange: (mode: 'auto' | 'portrait' | 'landscape') => void
}

const CASH_PERIOD_PRESETS: Array<{ id: ReportPeriodPreset; label: string }> = [
  { id: 'today', label: 'Dia (Hoje)' },
  { id: '7d', label: 'Semana (7 dias)' },
  { id: 'month', label: 'Mês (Este Mês)' },
  { id: '30d', label: '30 dias' },
  { id: 'year', label: 'Este Ano' },
  { id: 'all', label: 'Tudo' },
  { id: 'custom', label: 'Personalizado' },
]

function formatDateTimePtBr(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CashManagementReportView({
  dataset,
  organizationName,
  organizationLogoUrl,
  isRefreshing,
  onRefresh,
  onBack,
  printOrientationMode,
  effectiveOrientation,
  onPrintOrientationChange,
}: CashManagementReportViewProps) {
  const [activeTab, setActiveTab] = useState<CashReportTab>('cash_book')
  const [employeeFilter, setEmployeeFilter] = useState<string>('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [closingMonth, setClosingMonth] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>(() => {
    const initial = getPresetDateRange('month')
    return {
      preset: 'month',
      startDate: initial.startDate,
      endDate: initial.endDate,
    }
  })

  const handleClosingMonthChange = (ym: string) => {
    setClosingMonth(ym)
    const [yStr, mStr] = ym.split('-')
    const year = Number(yStr)
    const month = Number(mStr)
    if (!year || !month) return
    const lastDay = new Date(year, month, 0).getDate()
    setDateFilter({
      preset: 'custom',
      startDate: `${yStr}-${mStr}-01`,
      endDate: `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`,
    })
  }

  const handlePresetChange = (preset: ReportPeriodPreset) => {
    if (preset === 'custom') {
      setDateFilter((prev) => ({ ...prev, preset: 'custom' }))
      return
    }
    const range = getPresetDateRange(preset)
    setDateFilter({ preset, startDate: range.startDate, endDate: range.endDate })
  }

  // Lista única de funcionários/operadores para o filtro
  const employeeOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of dataset.cashSessions) {
      if (s.operatorName?.trim()) set.add(s.operatorName.trim())
    }
    for (const m of dataset.cashMovements) {
      if (m.operatorName?.trim()) set.add(m.operatorName.trim())
    }
    for (const sale of dataset.sales) {
      if (sale.sellerName?.trim()) set.add(sale.sellerName.trim())
    }
    for (const mem of dataset.members) {
      if (mem.displayName?.trim()) set.add(mem.displayName.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [dataset.cashSessions, dataset.cashMovements, dataset.sales, dataset.members])

  // Lista única de formas de pagamento para o filtro
  const paymentMethodOptions = useMemo(() => {
    const set = new Set<string>(Object.values(PAYMENT_METHOD_LABELS))
    for (const entry of dataset.cashEntries) {
      for (const p of entry.payments || []) {
        if (p.paymentMethod?.trim()) {
          const mapped =
            PAYMENT_METHOD_LABELS[p.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ||
            p.paymentMethod.trim()
          set.add(mapped)
        }
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [dataset.cashEntries])

  // Sessões filtradas por período, funcionário e busca
  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return dataset.cashSessions.filter((s) => {
      if (!isDateInRange(s.openedAt, dateFilter)) return false
      if (
        employeeFilter !== 'all' &&
        s.operatorName.trim().toLowerCase() !== employeeFilter.trim().toLowerCase()
      ) {
        return false
      }
      if (!q) return true
      return (
        s.operatorName.toLowerCase().includes(q) ||
        (s.registerName && s.registerName.toLowerCase().includes(q)) ||
        (s.notes && s.notes.toLowerCase().includes(q)) ||
        s.status.toLowerCase().includes(q)
      )
    })
  }, [dataset.cashSessions, dateFilter, employeeFilter, searchQuery])

  // Resumo agrupado por funcionário/operador
  const employeeSummaries = useMemo<EmployeeCashSummary[]>(() => {
    const map = new Map<string, EmployeeCashSummary>()

    for (const s of filteredSessions) {
      const key = s.operatorName?.trim() || 'Operador não identificado'
      const cur = map.get(key) || {
        employeeName: key,
        sessionsCount: 0,
        salesCount: 0,
        totalSales: 0,
        totalMoney: 0,
        totalPix: 0,
        totalCredit: 0,
        totalDebit: 0,
        totalSupplies: 0,
        totalWithdrawals: 0,
        totalDifference: 0,
      }
      cur.sessionsCount += 1
      cur.salesCount += Number(s.salesCount || 0)
      cur.totalSales += Number(s.totalSales || 0)
      cur.totalMoney += Number(s.totalMoney || 0)
      cur.totalPix += Number(s.totalPix || 0)
      cur.totalCredit += Number(s.totalCreditCard || 0)
      cur.totalDebit += Number(s.totalDebitCard || 0)
      cur.totalSupplies += Number(s.totalAdditionalEntries || 0)
      cur.totalWithdrawals += Number(s.totalWithdrawals || 0)
      cur.totalDifference += Number(s.difference || 0)
      map.set(key, cur)
    }

    return Array.from(map.values()).sort((a, b) => b.totalSales - a.totalSales)
  }, [filteredSessions])

  // Livro do Caixa Detalhado e Completo (cronológico com saldo acumulado)
  const cashBookRows = useMemo<CashBookRow[]>(() => {
    const raw: Array<Omit<CashBookRow, 'runningBalance'>> = []
    const sessionById = new Map(dataset.cashSessions.map((s) => [s.id, s]))

    // 1. Aberturas de caixa
    for (const s of dataset.cashSessions) {
      if (!isDateInRange(s.openedAt, dateFilter)) continue
      const opening = Number(s.openingBalance || 0)
      if (opening <= 0) continue
      raw.push({
        id: `session-open-${s.id}`,
        timestamp: s.openedAt,
        origin: 'Abertura de Caixa',
        description: `Fundo inicial — ${s.registerName || 'Caixa'} (${s.status === 'open' ? 'Aberto' : 'Fechado'})`,
        operatorName: s.operatorName || 'Operador',
        paymentMethod: 'Dinheiro',
        income: opening,
        expense: 0,
      })
    }

    // 2. Suprimentos e Sangrias
    for (const m of dataset.cashMovements) {
      if (!isDateInRange(m.createdAt, dateFilter)) continue
      const amount = Number(m.amount || 0)
      if (amount <= 0) continue
      const session = sessionById.get(m.sessionId)
      const isSupply = m.type === 'supply'
      raw.push({
        id: `mov-${m.id}`,
        timestamp: m.createdAt,
        origin: isSupply ? 'Suprimento' : 'Sangria',
        description: `${m.category ? `[${m.category}] ` : ''}${m.reason || (isSupply ? 'Reforço de caixa' : 'Retirada de caixa')}`,
        operatorName: m.operatorName || session?.operatorName || 'Operador',
        paymentMethod: 'Dinheiro',
        income: isSupply ? amount : 0,
        expense: isSupply ? 0 : amount,
      })
    }

    // 3. Vendas concluídas
    for (const sale of dataset.sales) {
      if (sale.status === 'rejected' || sale.status === 'expired') continue
      if (!isDateInRange(sale.createdAt, dateFilter)) continue
      const total = Number(sale.total || 0)
      if (total <= 0) continue
      const methodLabel =
        PAYMENT_METHOD_LABELS[sale.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ||
        sale.paymentMethod ||
        'Não informado'
      raw.push({
        id: `sale-${sale.id}`,
        timestamp: sale.createdAt,
        origin: 'Venda',
        description: `Venda #${sale.saleNumber}${sale.customerName ? ` — ${sale.customerName}` : ''}`,
        operatorName: sale.sellerName || sale.creatorName || 'Vendedor / PDV',
        paymentMethod: methodLabel,
        income: total,
        expense: 0,
      })
    }

    // 4. Lançamentos financeiros quitados (Entradas e Saídas manuais / Contas)
    for (const entry of dataset.cashEntries) {
      if (entry.canceledAt) continue
      for (const p of entry.payments || []) {
        const refDate = p.paidAt || entry.createdAt
        if (!isDateInRange(refDate, dateFilter)) continue
        const amt = Number(p.amount || 0)
        if (amt <= 0) continue
        const isIncome = entry.direction === 'income'
        const party = entry.customerName || entry.supplierName
        const mappedMethod =
          PAYMENT_METHOD_LABELS[p.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ||
          p.paymentMethod ||
          'Não informado'
        raw.push({
          id: `entry-${entry.id}-${p.id}`,
          timestamp: refDate,
          origin: 'Lançamento Financeiro',
          description: `${entry.description}${party ? ` (${party})` : ''}${entry.category ? ` • ${entry.category}` : ''}`,
          operatorName: 'Financeiro / Caixa',
          paymentMethod: mappedMethod,
          income: isIncome ? amt : 0,
          expense: isIncome ? 0 : amt,
        })
      }
    }

    // Filtra por funcionário, forma de pagamento e busca antes de calcular o saldo acumulado
    const q = searchQuery.trim().toLowerCase()
    const filtered = raw
      .filter((row) => {
        if (
          employeeFilter !== 'all' &&
          row.operatorName.trim().toLowerCase() !== employeeFilter.trim().toLowerCase()
        ) {
          return false
        }
        if (
          paymentMethodFilter !== 'all' &&
          row.paymentMethod.trim().toLowerCase() !== paymentMethodFilter.trim().toLowerCase()
        ) {
          return false
        }
        if (!q) return true
        return (
          row.description.toLowerCase().includes(q) ||
          row.origin.toLowerCase().includes(q) ||
          row.operatorName.toLowerCase().includes(q) ||
          row.paymentMethod.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    let balance = 0
    return filtered.map((row) => {
      balance += row.income - row.expense
      return { ...row, runningBalance: balance }
    })
  }, [
    dataset.cashSessions,
    dataset.cashMovements,
    dataset.sales,
    dataset.cashEntries,
    dateFilter,
    employeeFilter,
    paymentMethodFilter,
    searchQuery,
  ])

  // Fechamento Mensal do Caixa: todas as vendas e valores vendidos por data em cada forma de pagamento
  const monthlyClosingData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const filteredSales = dataset.sales
      .filter((sale) => {
        if (sale.status === 'rejected' || sale.status === 'expired') return false
        if (!isDateInRange(sale.createdAt, dateFilter)) return false
        const operator = sale.sellerName || sale.creatorName || 'Vendedor / PDV'
        if (
          employeeFilter !== 'all' &&
          operator.trim().toLowerCase() !== employeeFilter.trim().toLowerCase()
        ) {
          return false
        }
        const methodLabel =
          PAYMENT_METHOD_LABELS[sale.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ||
          sale.paymentMethod ||
          'Outro'
        if (
          paymentMethodFilter !== 'all' &&
          methodLabel.trim().toLowerCase() !== paymentMethodFilter.trim().toLowerCase()
        ) {
          return false
        }
        if (!q) return true
        return (
          String(sale.saleNumber).toLowerCase().includes(q) ||
          (sale.customerName && sale.customerName.toLowerCase().includes(q)) ||
          operator.toLowerCase().includes(q) ||
          methodLabel.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    const byDate = new Map<string, DailyClosingRow>()
    const totals = {
      salesCount: 0,
      money: 0,
      pix: 0,
      creditCard: 0,
      debitCard: 0,
      onCreditAndOther: 0,
      total: 0,
    }

    for (const sale of filteredSales) {
      const dateKey = sale.createdAt.slice(0, 10)
      const [y, m, d] = dateKey.split('-')
      const dateLabel = y && m && d ? `${d}/${m}/${y}` : dateKey
      const amount = Number(sale.total || 0)

      const row = byDate.get(dateKey) || {
        dateKey,
        dateLabel,
        salesCount: 0,
        money: 0,
        pix: 0,
        creditCard: 0,
        debitCard: 0,
        onCreditAndOther: 0,
        total: 0,
      }

      row.salesCount += 1
      row.total += amount
      totals.salesCount += 1
      totals.total += amount

      if (sale.paymentMethod === 'money') {
        row.money += amount
        totals.money += amount
      } else if (sale.paymentMethod === 'pix') {
        row.pix += amount
        totals.pix += amount
      } else if (sale.paymentMethod === 'credit_card') {
        row.creditCard += amount
        totals.creditCard += amount
      } else if (sale.paymentMethod === 'debit_card') {
        row.debitCard += amount
        totals.debitCard += amount
      } else {
        row.onCreditAndOther += amount
        totals.onCreditAndOther += amount
      }

      byDate.set(dateKey, row)
    }

    return {
      sales: filteredSales,
      dailyRows: Array.from(byDate.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
      totals,
    }
  }, [dataset.sales, dateFilter, employeeFilter, paymentMethodFilter, searchQuery])

  const kpis = useMemo(() => {
    const totalIncome = cashBookRows.reduce((sum, r) => sum + r.income, 0)
    const totalExpense = cashBookRows.reduce((sum, r) => sum + r.expense, 0)
    const netBalance = totalIncome - totalExpense
    return {
      totalIncome,
      totalExpense,
      netBalance,
      sessionsCount: filteredSessions.length,
      entriesCount: cashBookRows.length,
    }
  }, [cashBookRows, filteredSessions])

  const now = new Date()
  const emissionWeekday = now.toLocaleDateString('pt-BR', { weekday: 'long' })
  const emissionDate = now.toLocaleDateString('pt-BR')
  const emissionTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const periodLabel =
    CASH_PERIOD_PRESETS.find((p) => p.id === dateFilter.preset)?.label || 'Período'
  const periodRange =
    dateFilter.startDate && dateFilter.endDate
      ? `${dateFilter.startDate.split('-').reverse().join('/')} até ${dateFilter.endDate.split('-').reverse().join('/')}`
      : 'Todo o período'

  const handleExport = (format: 'excel' | 'xml') => {
    const dateStamp = new Date().toISOString().slice(0, 10)
    if (activeTab === 'cash_book') {
      const headers = [
        'Data/Hora',
        'Origem',
        'Descrição',
        'Funcionário / Operador',
        'Forma de Pagamento',
        'Entrada (R$)',
        'Saída (R$)',
        'Saldo Acumulado (R$)',
      ]
      const rows = cashBookRows.map((r) => [
        formatDateTimePtBr(r.timestamp),
        r.origin,
        r.description,
        r.operatorName,
        r.paymentMethod,
        r.income.toFixed(2),
        r.expense.toFixed(2),
        r.runningBalance.toFixed(2),
      ])
      if (format === 'excel') {
        exportRowsToExcel(`livro-caixa-${dateStamp}.csv`, headers, rows)
      } else {
        exportRowsToXml(`livro-caixa-${dateStamp}.xml`, 'LivroCaixa', 'Lancamento', headers, rows)
      }
      return
    }

    if (activeTab === 'sessions') {
      const headers = [
        'Caixa',
        'Funcionário / Operador',
        'Abertura',
        'Fechamento',
        'Status',
        'Fundo Inicial (R$)',
        'Vendas (R$)',
        'Dinheiro (R$)',
        'PIX (R$)',
        'Cartão (R$)',
        'Suprimentos (R$)',
        'Sangrias (R$)',
        'Diferença (R$)',
      ]
      const rows = filteredSessions.map((s) => [
        s.registerName || 'Caixa',
        s.operatorName,
        formatDateTimePtBr(s.openedAt),
        formatDateTimePtBr(s.closedAt),
        s.status === 'open' ? 'Aberto' : 'Fechado',
        Number(s.openingBalance || 0).toFixed(2),
        Number(s.totalSales || 0).toFixed(2),
        Number(s.totalMoney || 0).toFixed(2),
        Number(s.totalPix || 0).toFixed(2),
        (Number(s.totalCreditCard || 0) + Number(s.totalDebitCard || 0)).toFixed(2),
        Number(s.totalAdditionalEntries || 0).toFixed(2),
        Number(s.totalWithdrawals || 0).toFixed(2),
        Number(s.difference || 0).toFixed(2),
      ])
      if (format === 'excel') {
        exportRowsToExcel(`sessoes-caixa-${dateStamp}.csv`, headers, rows)
      } else {
        exportRowsToXml(`sessoes-caixa-${dateStamp}.xml`, 'SessoesCaixa', 'Sessao', headers, rows)
      }
      return
    }

    if (activeTab === 'monthly_closing') {
      const headers = [
        'Data',
        'Qtd. Vendas',
        'Dinheiro (R$)',
        'PIX (R$)',
        'Cartão Crédito (R$)',
        'Cartão Débito (R$)',
        'A Prazo / Outros (R$)',
        'Total Vendido (R$)',
      ]
      const rows: Array<Array<string | number>> = monthlyClosingData.dailyRows.map((d) => [
        d.dateLabel,
        d.salesCount,
        d.money.toFixed(2),
        d.pix.toFixed(2),
        d.creditCard.toFixed(2),
        d.debitCard.toFixed(2),
        d.onCreditAndOther.toFixed(2),
        d.total.toFixed(2),
      ])
      rows.push([
        'TOTAL DO PERÍODO',
        monthlyClosingData.totals.salesCount,
        monthlyClosingData.totals.money.toFixed(2),
        monthlyClosingData.totals.pix.toFixed(2),
        monthlyClosingData.totals.creditCard.toFixed(2),
        monthlyClosingData.totals.debitCard.toFixed(2),
        monthlyClosingData.totals.onCreditAndOther.toFixed(2),
        monthlyClosingData.totals.total.toFixed(2),
      ])
      if (format === 'excel') {
        exportRowsToExcel(`fechamento-mensal-caixa-${dateStamp}.csv`, headers, rows)
      } else {
        exportRowsToXml(
          `fechamento-mensal-caixa-${dateStamp}.xml`,
          'FechamentoMensalCaixa',
          'Dia',
          headers,
          rows,
        )
      }
      return
    }

    const headers = [
      'Funcionário / Operador',
      'Sessões',
      'Qtd. Vendas',
      'Total Vendas (R$)',
      'Dinheiro (R$)',
      'PIX (R$)',
      'Cartão Crédito (R$)',
      'Cartão Débito (R$)',
      'Suprimentos (R$)',
      'Sangrias (R$)',
      'Diferença Acumulada (R$)',
    ]
    const rows = employeeSummaries.map((e) => [
      e.employeeName,
      e.sessionsCount,
      e.salesCount,
      e.totalSales.toFixed(2),
      e.totalMoney.toFixed(2),
      e.totalPix.toFixed(2),
      e.totalCredit.toFixed(2),
      e.totalDebit.toFixed(2),
      e.totalSupplies.toFixed(2),
      e.totalWithdrawals.toFixed(2),
      e.totalDifference.toFixed(2),
    ])
    if (format === 'excel') {
      exportRowsToExcel(`caixa-por-funcionario-${dateStamp}.csv`, headers, rows)
    } else {
      exportRowsToXml(`caixa-por-funcionario-${dateStamp}.xml`, 'CaixaPorFuncionario', 'Funcionario', headers, rows)
    }
  }

  return (
    <div className="space-y-6">
      <ReportPrintHeader
        organizationName={organizationName}
        organizationLogoUrl={organizationLogoUrl}
        reportTitle={
          activeTab === 'cash_book'
            ? 'Livro do Caixa Detalhado e Completo'
            : activeTab === 'sessions'
              ? 'Relatório de Sessões e Fechamentos de Caixa'
              : activeTab === 'monthly_closing'
                ? 'Fechamento Mensal do Caixa — Vendas por Data e Forma de Pagamento'
                : 'Relatório de Caixa por Funcionário / Operador'
        }
        reportType="Gerenciamento de Caixa"
        totalRecords={
          activeTab === 'cash_book'
            ? cashBookRows.length
            : activeTab === 'sessions'
              ? filteredSessions.length
              : activeTab === 'monthly_closing'
                ? monthlyClosingData.sales.length
                : employeeSummaries.length
        }
        totalAmountLabel={
          activeTab === 'monthly_closing' ? 'Total Vendido no Período' : 'Saldo Líquido do Período'
        }
        totalAmountValue={formatCurrency(
          (activeTab === 'monthly_closing'
            ? monthlyClosingData.totals.total
            : kpis.netBalance
          ).toFixed(2),
        )}
        emissionWeekday={emissionWeekday}
        emissionDate={emissionDate}
        emissionTime={emissionTime}
        periodLabel={`${periodLabel}${employeeFilter !== 'all' ? ` • Operador: ${employeeFilter}` : ''}${paymentMethodFilter !== 'all' ? ` • Pagamento: ${paymentMethodFilter}` : ''}`}
        periodRange={periodRange}
      />

      <ReportActionBar
        title="Relatórios de Gerenciamento de Caixa"
        badgeText="MÓDULO 4 • CAIXA"
        badgeColorClass="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
        description="Relatório do dia, semana, mês, por funcionário e livro do caixa detalhado e completo."
        onBack={onBack}
        onExportExcel={() => handleExport('excel')}
        onExportXml={() => handleExport('xml')}
        onPrint={() => window.print()}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        printOrientationMode={printOrientationMode}
        effectiveOrientation={effectiveOrientation}
        onPrintOrientationChange={onPrintOrientationChange}
      />

      {/* Abas do Módulo de Caixa + Botão Visível de Impressão */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('cash_book')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
            activeTab === 'cash_book'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Livro do Caixa Detalhado ({cashBookRows.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
            activeTab === 'sessions'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Wallet className="h-4 w-4" />
          Sessões & Fechamentos ({filteredSessions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('by_employee')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
            activeTab === 'by_employee'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Por Funcionário ({employeeSummaries.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('monthly_closing')
            handleClosingMonthChange(closingMonth)
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
            activeTab === 'monthly_closing'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <CalendarCheck className="h-4 w-4" />
          Fechamento Mensal do Caixa ({monthlyClosingData.sales.length})
        </button>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer shrink-0"
        >
          <Printer className="h-4 w-4" />
          Imprimir Relatório / PDF
        </button>
      </div>

      {/* Filtros: Dia / Semana / Mês / Funcionário / Busca */}
      <Card className="border-gray-200 dark:border-slate-800 shadow-xs print:hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 mr-1">
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              Período:
            </span>
            {CASH_PERIOD_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetChange(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  dateFilter.preset === p.id
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
            {activeTab === 'monthly_closing' && (
              <div className="flex items-center gap-2 ml-auto">
                <label className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  Mês do Fechamento:
                </label>
                <input
                  type="month"
                  value={closingMonth}
                  onChange={(e) => handleClosingMonthChange(e.target.value)}
                  className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 px-2.5 py-1 text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {dateFilter.preset === 'custom' && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Data Inicial
                  </label>
                  <input
                    type="date"
                    value={dateFilter.startDate}
                    onChange={(e) =>
                      setDateFilter((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Data Final
                  </label>
                  <input
                    type="date"
                    value={dateFilter.endDate}
                    onChange={(e) =>
                      setDateFilter((prev) => ({ ...prev, endDate: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Funcionário / Operador
              </label>
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white"
              >
                <option value="all">Todos os Funcionários</option>
                {employeeOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Forma de Pagamento
              </label>
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white"
              >
                <option value="all">Todas as Formas</option>
                {paymentMethodOptions.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>

            <div className={dateFilter.preset === 'custom' ? 'sm:col-span-2 lg:col-span-4' : 'sm:col-span-2 lg:col-span-2'}>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Busca Rápida
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por descrição, origem, operador, forma de pagamento ou caixa..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards KPI Resumo (apenas tela; na impressão o cabeçalho oficial exibe os totais como no padrão O.S.) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        {activeTab === 'monthly_closing' ? (
          <>
            <Card className="border-emerald-200/80 dark:border-emerald-900/50 print:border-slate-300 print:shadow-none print:rounded-lg">
              <CardContent className="p-4 print:p-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 print:text-slate-600">
                  Total Vendido no Período
                </div>
                <div className="mt-1 text-xl print:text-base font-extrabold text-emerald-700 dark:text-emerald-300 print:text-slate-900">
                  {formatCurrency(monthlyClosingData.totals.total.toFixed(2))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-200/80 dark:border-blue-900/50 print:border-slate-300 print:shadow-none print:rounded-lg">
              <CardContent className="p-4 print:p-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 print:text-slate-600">
                  Dinheiro + PIX
                </div>
                <div className="mt-1 text-xl print:text-base font-extrabold text-blue-700 dark:text-blue-300 print:text-slate-900">
                  {formatCurrency(
                    (monthlyClosingData.totals.money + monthlyClosingData.totals.pix).toFixed(2),
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border-purple-200/80 dark:border-purple-900/50 print:border-slate-300 print:shadow-none print:rounded-lg">
              <CardContent className="p-4 print:p-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 print:text-slate-600">
                  Cartões (Créd. + Déb.)
                </div>
                <div className="mt-1 text-xl print:text-base font-extrabold text-purple-700 dark:text-purple-300 print:text-slate-900">
                  {formatCurrency(
                    (
                      monthlyClosingData.totals.creditCard + monthlyClosingData.totals.debitCard
                    ).toFixed(2),
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 dark:border-slate-800 print:border-slate-300 print:shadow-none print:rounded-lg">
              <CardContent className="p-4 print:p-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 print:text-slate-600">
                  Vendas / Dias
                </div>
                <div className="mt-1 text-xl print:text-base font-extrabold text-slate-900 dark:text-white">
                  {monthlyClosingData.totals.salesCount} vendas • {monthlyClosingData.dailyRows.length} dias
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="border-emerald-200/80 dark:border-emerald-900/50 print:border-slate-300 print:shadow-none print:rounded-lg">
              <CardContent className="p-4 print:p-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 print:text-slate-600">
                  Total de Entradas
                </div>
                <div className="mt-1 text-xl print:text-base font-extrabold text-emerald-700 dark:text-emerald-300 print:text-slate-900">
                  {formatCurrency(kpis.totalIncome.toFixed(2))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-rose-200/80 dark:border-rose-900/50 print:border-slate-300 print:shadow-none print:rounded-lg">
              <CardContent className="p-4 print:p-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 print:text-slate-600">
                  Total de Saídas
                </div>
                <div className="mt-1 text-xl print:text-base font-extrabold text-rose-700 dark:text-rose-300 print:text-slate-900">
                  {formatCurrency(kpis.totalExpense.toFixed(2))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-200/80 dark:border-blue-900/50 print:border-slate-300 print:shadow-none print:rounded-lg">
              <CardContent className="p-4 print:p-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 print:text-slate-600">
                  Saldo Líquido do Período
                </div>
                <div className="mt-1 text-xl print:text-base font-extrabold text-blue-700 dark:text-blue-300 print:text-slate-900">
                  {formatCurrency(kpis.netBalance.toFixed(2))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 dark:border-slate-800 print:border-slate-300 print:shadow-none print:rounded-lg">
              <CardContent className="p-4 print:p-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 print:text-slate-600">
                  Sessões / Lançamentos
                </div>
                <div className="mt-1 text-xl print:text-base font-extrabold text-slate-900 dark:text-white">
                  {kpis.sessionsCount} sessões • {kpis.entriesCount} itens
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Tabela da Aba Ativa (Padrão Oficial O.S.: report-fit-table + overflow-visible na impressão) */}
      <div className="overflow-hidden print:overflow-visible rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="overflow-x-auto print:overflow-visible">
          {activeTab === 'cash_book' && (
            <table className="report-fit-table w-full text-left text-xs print:text-[9.5px]">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 print-nowrap">Data / Hora</th>
                  <th className="py-2.5 px-3">Origem</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-3">Funcionário</th>
                  <th className="py-2.5 px-3">Pagamento</th>
                  <th className="py-2.5 px-3 text-right print-nowrap">Entrada (+)</th>
                  <th className="py-2.5 px-3 text-right print-nowrap">Saída (-)</th>
                  <th className="py-2.5 px-3 text-right print-nowrap">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {cashBookRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Nenhum lançamento encontrado no livro do caixa para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  cashBookRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 print-nowrap text-slate-600 dark:text-slate-300">
                        {formatDateTimePtBr(row.timestamp)}
                      </td>
                      <td className="py-2 px-3 print-nowrap">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border print-nowrap ${
                            row.origin === 'Sangria' || row.expense > 0
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                              : row.origin === 'Abertura de Caixa'
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                          }`}
                        >
                          {row.origin}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                        {row.description}
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                        {row.operatorName}
                      </td>
                      <td className="py-2 px-3 print-nowrap text-slate-600 dark:text-slate-400">
                        {row.paymentMethod}
                      </td>
                      <td className="py-2 px-3 print-nowrap text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 print:text-slate-900">
                        {row.income > 0 ? formatCurrency(row.income.toFixed(2)) : '—'}
                      </td>
                      <td className="py-2 px-3 print-nowrap text-right font-mono font-bold text-rose-700 dark:text-rose-400 print:text-slate-900">
                        {row.expense > 0 ? formatCurrency(row.expense.toFixed(2)) : '—'}
                      </td>
                      <td className="py-2 px-3 print-nowrap text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(row.runningBalance.toFixed(2))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {cashBookRows.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-xs print:break-inside-avoid">
                  <tr>
                    <td colSpan={5} className="py-2.5 px-3 uppercase text-slate-700 dark:text-slate-300">
                      Total Geral do Período ({cashBookRows.length} lançamentos)
                    </td>
                    <td className="py-2.5 px-3 print-nowrap text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 print:text-slate-900">
                      {formatCurrency(kpis.totalIncome.toFixed(2))}
                    </td>
                    <td className="py-2.5 px-3 print-nowrap text-right font-mono font-bold text-rose-700 dark:text-rose-400 print:text-slate-900">
                      {formatCurrency(kpis.totalExpense.toFixed(2))}
                    </td>
                    <td className="py-2.5 px-3 print-nowrap text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(kpis.netBalance.toFixed(2))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {activeTab === 'sessions' && (
            <table className="report-fit-table w-full text-left text-xs print:text-[9.5px]">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Caixa</th>
                  <th className="py-2.5 px-3">Funcionário</th>
                  <th className="py-2.5 px-3">Abertura / Fechamento</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Fundo Inicial</th>
                  <th className="py-2.5 px-3 text-right">Vendas</th>
                  <th className="py-2.5 px-3 text-right">Suprimentos</th>
                  <th className="py-2.5 px-3 text-right">Sangrias</th>
                  <th className="py-2.5 px-3 text-right">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      Nenhuma sessão de caixa encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((s) => {
                    const diff = Number(s.difference || 0)
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          {s.registerName || 'Caixa'}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {s.operatorName}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          <div>Ab: {formatDateTimePtBr(s.openedAt)}</div>
                          <div>Fc: {formatDateTimePtBr(s.closedAt)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              s.status === 'open'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {s.status === 'open' ? 'Aberto' : 'Fechado'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(Number(s.openingBalance || 0).toFixed(2))}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(Number(s.totalSales || 0).toFixed(2))}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-700 dark:text-blue-400">
                          {formatCurrency(Number(s.totalAdditionalEntries || 0).toFixed(2))}
                        </td>
                        <td className="px-4 py-3 text-right text-rose-700 dark:text-rose-400">
                          {formatCurrency(Number(s.totalWithdrawals || 0).toFixed(2))}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-bold ${
                            diff < 0
                              ? 'text-rose-600'
                              : diff > 0
                                ? 'text-blue-600'
                                : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {formatCurrency(diff.toFixed(2))}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              {filteredSessions.length > 0 && (
                <tfoot className="bg-slate-100 dark:bg-slate-900 font-extrabold border-t-2 border-slate-300 dark:border-slate-700 print:break-inside-avoid">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 print:px-2 print:py-1.5 text-slate-900 dark:text-white">
                      TOTAIS DAS SESSÕES ({filteredSessions.length})
                    </td>
                    <td className="px-4 py-3 print:px-2 print:py-1.5 text-right">
                      {formatCurrency(
                        filteredSessions.reduce((acc, s) => acc + Number(s.openingBalance || 0), 0).toFixed(2),
                      )}
                    </td>
                    <td className="px-4 py-3 print:px-2 print:py-1.5 text-right text-emerald-700 dark:text-emerald-400 print:text-slate-900">
                      {formatCurrency(
                        filteredSessions.reduce((acc, s) => acc + Number(s.totalSales || 0), 0).toFixed(2),
                      )}
                    </td>
                    <td className="px-4 py-3 print:px-2 print:py-1.5 text-right text-blue-700 dark:text-blue-400 print:text-slate-900">
                      {formatCurrency(
                        filteredSessions
                          .reduce((acc, s) => acc + Number(s.totalAdditionalEntries || 0), 0)
                          .toFixed(2),
                      )}
                    </td>
                    <td className="px-4 py-3 print:px-2 print:py-1.5 text-right text-rose-700 dark:text-rose-400 print:text-slate-900">
                      {formatCurrency(
                        filteredSessions
                          .reduce((acc, s) => acc + Number(s.totalWithdrawals || 0), 0)
                          .toFixed(2),
                      )}
                    </td>
                    <td className="px-4 py-3 print:px-2 print:py-1.5 text-right">
                      {formatCurrency(
                        filteredSessions.reduce((acc, s) => acc + Number(s.difference || 0), 0).toFixed(2),
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {activeTab === 'by_employee' && (
            <table className="report-fit-table w-full text-left text-xs print:text-[9.5px]">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Funcionário / Operador</th>
                  <th className="py-2.5 px-3 text-right">Sessões</th>
                  <th className="py-2.5 px-3 text-right">Qtd. Vendas</th>
                  <th className="py-2.5 px-3 text-right">Total Vendas</th>
                  <th className="py-2.5 px-3 text-right">Dinheiro</th>
                  <th className="py-2.5 px-3 text-right">PIX</th>
                  <th className="py-2.5 px-3 text-right">Cartões</th>
                  <th className="py-2.5 px-3 text-right">Suprimentos</th>
                  <th className="py-2.5 px-3 text-right">Sangrias</th>
                  <th className="py-2.5 px-3 text-right">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {employeeSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      Nenhum dado de caixa por funcionário encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  employeeSummaries.map((emp) => (
                    <tr key={emp.employeeName} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        {emp.employeeName}
                      </td>
                      <td className="px-4 py-3 text-right">{emp.sessionsCount}</td>
                      <td className="px-4 py-3 text-right">{emp.salesCount}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(emp.totalSales.toFixed(2))}
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(emp.totalMoney.toFixed(2))}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(emp.totalPix.toFixed(2))}</td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency((emp.totalCredit + emp.totalDebit).toFixed(2))}
                      </td>
                      <td className="px-4 py-3 text-right text-blue-700 dark:text-blue-400">
                        {formatCurrency(emp.totalSupplies.toFixed(2))}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-700 dark:text-rose-400">
                        {formatCurrency(emp.totalWithdrawals.toFixed(2))}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${
                          emp.totalDifference < 0 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {formatCurrency(emp.totalDifference.toFixed(2))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {employeeSummaries.length > 0 && (
                <tfoot className="bg-slate-100 dark:bg-slate-900 font-extrabold border-t-2 border-slate-300 dark:border-slate-700 print:break-inside-avoid">
                  <tr>
                    <td className="px-4 py-3 text-slate-900 dark:text-white">TOTAIS ({employeeSummaries.length})</td>
                    <td className="px-4 py-3 text-right">
                      {employeeSummaries.reduce((acc, e) => acc + e.sessionsCount, 0)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {employeeSummaries.reduce((acc, e) => acc + e.salesCount, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400 print:text-slate-900">
                      {formatCurrency(
                        employeeSummaries.reduce((acc, e) => acc + e.totalSales, 0).toFixed(2),
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(
                        employeeSummaries.reduce((acc, e) => acc + e.totalMoney, 0).toFixed(2),
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(
                        employeeSummaries.reduce((acc, e) => acc + e.totalPix, 0).toFixed(2),
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(
                        employeeSummaries
                          .reduce((acc, e) => acc + e.totalCredit + e.totalDebit, 0)
                          .toFixed(2),
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-700 dark:text-blue-400 print:text-slate-900">
                      {formatCurrency(
                        employeeSummaries.reduce((acc, e) => acc + e.totalSupplies, 0).toFixed(2),
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-700 dark:text-rose-400 print:text-slate-900">
                      {formatCurrency(
                        employeeSummaries.reduce((acc, e) => acc + e.totalWithdrawals, 0).toFixed(2),
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(
                        employeeSummaries.reduce((acc, e) => acc + e.totalDifference, 0).toFixed(2),
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {activeTab === 'monthly_closing' && (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {/* Tabela 1: Resumo por Data e Forma de Pagamento */}
              <div>
                <div className="px-4 py-3 bg-emerald-50/70 dark:bg-emerald-950/30 border-b border-emerald-200/70 dark:border-emerald-900/50 flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Resumo Diário por Forma de Pagamento ({monthlyClosingData.dailyRows.length}{' '}
                    {monthlyClosingData.dailyRows.length === 1 ? 'dia' : 'dias'})
                  </span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    Total Vendido: {formatCurrency(monthlyClosingData.totals.total.toFixed(2))}
                  </span>
                </div>
                <table className="report-fit-table w-full text-left text-xs print:text-[9.5px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3 text-right">Qtd. Vendas</th>
                      <th className="py-2.5 px-3 text-right">Dinheiro</th>
                      <th className="py-2.5 px-3 text-right">PIX</th>
                      <th className="py-2.5 px-3 text-right">Cartão Crédito</th>
                      <th className="py-2.5 px-3 text-right">Cartão Débito</th>
                      <th className="py-2.5 px-3 text-right">A Prazo / Outros</th>
                      <th className="py-2.5 px-3 text-right">Total no Dia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {monthlyClosingData.dailyRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                          Nenhuma venda registrada no período selecionado.
                        </td>
                      </tr>
                    ) : (
                      monthlyClosingData.dailyRows.map((d) => (
                        <tr key={d.dateKey} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                            {d.dateLabel}
                          </td>
                          <td className="px-4 py-3 text-right">{d.salesCount}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(d.money.toFixed(2))}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(d.pix.toFixed(2))}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(d.creditCard.toFixed(2))}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(d.debitCard.toFixed(2))}</td>
                          <td className="px-4 py-3 text-right">
                            {formatCurrency(d.onCreditAndOther.toFixed(2))}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(d.total.toFixed(2))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {monthlyClosingData.dailyRows.length > 0 && (
                    <tfoot className="bg-slate-100 dark:bg-slate-900 font-extrabold border-t-2 border-slate-300 dark:border-slate-700">
                      <tr>
                        <td className="px-4 py-3 text-slate-900 dark:text-white">TOTAL DO PERÍODO</td>
                        <td className="px-4 py-3 text-right">{monthlyClosingData.totals.salesCount}</td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(monthlyClosingData.totals.money.toFixed(2))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(monthlyClosingData.totals.pix.toFixed(2))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(monthlyClosingData.totals.creditCard.toFixed(2))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(monthlyClosingData.totals.debitCard.toFixed(2))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(monthlyClosingData.totals.onCreditAndOther.toFixed(2))}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(monthlyClosingData.totals.total.toFixed(2))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Tabela 2: Lista Completa de Todas as Vendas do Fechamento */}
              <div>
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Detalhamento de Todas as Vendas ({monthlyClosingData.sales.length})
                  </span>
                </div>
                <table className="report-fit-table w-full text-left text-xs print:text-[9.5px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Data / Hora</th>
                      <th className="py-2.5 px-3">Nº Venda</th>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Funcionário / Vendedor</th>
                      <th className="py-2.5 px-3">Forma de Pagamento</th>
                      <th className="py-2.5 px-3 text-right">Valor Vendido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {monthlyClosingData.sales.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          Nenhuma venda encontrada para o período e filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      monthlyClosingData.sales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                            {formatDateTimePtBr(sale.createdAt)}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                            #{sale.saleNumber}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                            {sale.customerName || 'Consumidor Final'}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                            {sale.sellerName || sale.creatorName || 'Vendedor / PDV'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              {PAYMENT_METHOD_LABELS[
                                sale.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS
                              ] ||
                                sale.paymentMethod ||
                                'Outro'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(Number(sale.total || 0).toFixed(2))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <ReportPrintFooter
        emissionWeekday={emissionWeekday}
        emissionDate={emissionDate}
        emissionTime={emissionTime}
        documentType="Relatório Oficial de Gerenciamento de Caixa"
      />
    </div>
  )
}
