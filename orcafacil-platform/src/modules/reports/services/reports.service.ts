import { salesService, PAYMENT_METHOD_LABELS, type SaleListItem, type PaymentMethod } from '@modules/sales/services/sales.service'
import { inventoryService } from '@modules/inventory/services/inventory.service'
import { cashBillsService, type CashBill } from '@modules/cash/services/cash-bills.service'
import { cashService } from '@modules/cash/services/cash.service'
import { cashSessionService } from '@modules/cash/services/cash-session.service'
import { quoteService, type QuoteListItem } from '@modules/orcafacil/services/quote.service'
import { serviceOrderService, type ServiceOrderListItem } from '@modules/service-orders/services/service-order.service'
import { customerService, type Customer } from '@modules/customers/services/customer.service'
import { supplierService, type Supplier } from '@modules/suppliers/services/supplier.service'
import { organizationService } from '@modules/organizations/services/organization.service'
import type { CashSession } from '@modules/cash/domain/cash-session'
import type { CashEntry } from '@modules/cash/domain/cash-management'
import type { InventoryItem, OrganizationMemberDetail, UUID } from '@shared/types/common'

export type ReportPeriodPreset = 'today' | '7d' | 'month' | '30d' | 'year' | 'all' | 'custom'

export interface DateRangeFilter {
  preset: ReportPeriodPreset
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}

export interface PaymentMethodSummary {
  method: PaymentMethod
  label: string
  count: number
  total: number
  percentage: number
}

export interface SellerRankingItem {
  sellerName: string
  salesCount: number
  totalAmount: number
  averageTicket: number
  pdvCount: number
  counterCount: number
}

export interface DailySalesPoint {
  dateKey: string // YYYY-MM-DD
  label: string // DD/MM
  count: number
  total: number
}

export interface InventoryAbcItem {
  id: string
  name: string
  sku: string | null
  category: string
  unit: string
  quantityOnHand: number
  minimumQuantity: number
  purchasePrice: number
  unitPrice: number
  totalCostValue: number
  totalSaleValue: number
  potentialProfit: number
  marginPercent: number
  sharePercent: number
  cumulativePercent: number
  abcClass: 'A' | 'B' | 'C'
  stockStatus: 'out' | 'low' | 'normal'
}

export interface CategoryFinancialSummary {
  category: string
  count: number
  totalPaid: number
  totalPending: number
  totalAmount: number
  percentage: number
}

export interface CustomerRankingItem {
  customerId: string
  customerName: string
  document: string | null
  phone: string | null
  email: string | null
  personType: 'individual' | 'company'
  salesCount: number
  quotesCount: number
  serviceOrdersCount: number
  totalSpent: number
  averageTicket: number
  lastPurchaseAt: string | null
}

export interface ReportsDataset {
  sales: SaleListItem[]
  inventory: InventoryItem[]
  bills: CashBill[]
  cashEntries: CashEntry[]
  cashSessions: CashSession[]
  quotes: QuoteListItem[]
  serviceOrders: ServiceOrderListItem[]
  customers: Customer[]
  suppliers: Supplier[]
  members: OrganizationMemberDetail[]
}

export function getPresetDateRange(preset: ReportPeriodPreset): { startDate: string; endDate: string } {
  const now = new Date()
  const toIsoDate = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const endDate = toIsoDate(now)

  if (preset === 'today') {
    return { startDate: endDate, endDate }
  }
  if (preset === '7d') {
    const d = new Date(now)
    d.setDate(d.getDate() - 6)
    return { startDate: toIsoDate(d), endDate }
  }
  if (preset === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    return { startDate: toIsoDate(d), endDate }
  }
  if (preset === '30d') {
    const d = new Date(now)
    d.setDate(d.getDate() - 29)
    return { startDate: toIsoDate(d), endDate }
  }
  if (preset === 'year') {
    const d = new Date(now.getFullYear(), 0, 1)
    return { startDate: toIsoDate(d), endDate }
  }
  return { startDate: '', endDate: '' }
}

export function isDateInRange(isoDateStr: string | null | undefined, range: DateRangeFilter): boolean {
  if (range.preset === 'all') return true
  if (!isoDateStr) return false
  const dateOnly = isoDateStr.slice(0, 10)
  if (range.startDate && dateOnly < range.startDate) return false
  if (range.endDate && dateOnly > range.endDate) return false
  return true
}

export function exportRowsToCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>): void {
  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""'
    const str = String(val).replace(/"/g, '""')
    return `"${str}"`
  }

  const lines = [
    headers.map(escapeCell).join(';'),
    ...rows.map((row) => row.map(escapeCell).join(';')),
  ]

  // BOM UTF-8 (\uFEFF) para abertura direta no Microsoft Excel com acentuação correta
  const csvContent = `\uFEFF${lines.join('\r\n')}`
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportRowsToExcel(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): void {
  const finalName = filename.endsWith('.csv') ? filename : `${filename}.csv`
  exportRowsToCsv(finalName, headers, rows)
}

export function exportRowsToXml(
  filename: string,
  rootElement: string,
  itemElement: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  metadata?: Record<string, string | number | null | undefined>
): void {
  const sanitizeTag = (tag: string): string => {
    const clean = tag
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase()
    if (!clean) return 'campo'
    return clean[0] >= '0' && clean[0] <= '9' ? `campo_${clean}` : clean
  }

  const escapeXml = (unsafe: string | number | null | undefined): string => {
    if (unsafe === null || unsafe === undefined) return ''
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  const tags = headers.map(sanitizeTag)

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += `<${rootElement}>\n`

  if (metadata && Object.keys(metadata).length > 0) {
    xml += '  <metadados>\n'
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined) {
        const tag = sanitizeTag(key)
        xml += `    <${tag}>${escapeXml(value)}</${tag}>\n`
      }
    }
    xml += '  </metadados>\n'
  }

  xml += '  <registros>\n'
  for (const row of rows) {
    xml += `    <${itemElement}>\n`
    row.forEach((val, idx) => {
      const tag = tags[idx] || `campo_${idx + 1}`
      xml += `      <${tag}>${escapeXml(val)}</${tag}>\n`
    })
    xml += `    </${itemElement}>\n`
  }
  xml += '  </registros>\n'
  xml += `</${rootElement}>\n`

  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename.endsWith('.xml') ? filename : `${filename}.xml`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const reportsService = {
  async loadAllReportData(organizationId: UUID): Promise<ReportsDataset> {
    const [
      salesRes,
      inventoryRes,
      billsRes,
      entriesRes,
      sessionsRes,
      quotesRes,
      osRes,
      customersRes,
      suppliersRes,
      membersRes,
    ] = await Promise.all([
      salesService.listSales(organizationId),
      inventoryService.list(organizationId),
      cashBillsService.listBills(organizationId),
      cashService.listEntries(organizationId),
      cashSessionService.listHistory(organizationId),
      quoteService.listQuotes(organizationId),
      serviceOrderService.list(organizationId),
      customerService.list(organizationId),
      supplierService.list(organizationId),
      organizationService.getMembersWithDetails(organizationId),
    ])

    return {
      sales: salesRes.success ? salesRes.data : [],
      inventory: inventoryRes.success ? inventoryRes.data : [],
      bills: billsRes.success ? billsRes.data : [],
      cashEntries: entriesRes.success ? entriesRes.data : [],
      cashSessions: sessionsRes.success && sessionsRes.data ? sessionsRes.data : [],
      quotes: quotesRes.success ? quotesRes.data : [],
      serviceOrders: osRes.success ? osRes.data : [],
      customers: customersRes.success ? customersRes.data : [],
      suppliers: suppliersRes.success ? suppliersRes.data : [],
      members: membersRes.success ? membersRes.data : [],
    }
  },

  computeSalesAnalytics(sales: SaleListItem[]) {
    const activeSales = sales.filter((s) => s.status !== 'rejected' && s.status !== 'expired')
    const totalRevenue = activeSales.reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0)
    const totalSubtotal = activeSales.reduce((acc, s) => acc + (parseFloat(s.subtotal) || 0), 0)
    const totalDiscount = activeSales.reduce((acc, s) => acc + (parseFloat(s.discount) || 0), 0)
    const totalItems = activeSales.reduce((acc, s) => acc + (s.itemsCount || 0), 0)
    const salesCount = activeSales.length
    const averageTicket = salesCount > 0 ? totalRevenue / salesCount : 0
    const pdvSales = activeSales.filter((s) => s.isPdv)
    const counterSales = activeSales.filter((s) => !s.isPdv)
    const fiscalCount = activeSales.filter((s) => s.hasFiscalInvoice).length

    // Por forma de pagamento
    const methodMap = new Map<PaymentMethod, { count: number; total: number }>()
    for (const s of activeSales) {
      const m = s.paymentMethod || 'money'
      const cur = methodMap.get(m) ?? { count: 0, total: 0 }
      cur.count += 1
      cur.total += parseFloat(s.total) || 0
      methodMap.set(m, cur)
    }

    const byPaymentMethod: PaymentMethodSummary[] = Array.from(methodMap.entries())
      .map(([method, stats]) => ({
        method,
        label: PAYMENT_METHOD_LABELS[method] || method,
        count: stats.count,
        total: stats.total,
        percentage: totalRevenue > 0 ? (stats.total / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)

    // Ranking de vendedores/operadores
    const sellerMap = new Map<string, SellerRankingItem>()
    for (const s of activeSales) {
      const name = (s.sellerName || s.creatorName || 'Balcão / Operador Padrão').trim()
      const cur = sellerMap.get(name) ?? {
        sellerName: name,
        salesCount: 0,
        totalAmount: 0,
        averageTicket: 0,
        pdvCount: 0,
        counterCount: 0,
      }
      cur.salesCount += 1
      cur.totalAmount += parseFloat(s.total) || 0
      if (s.isPdv) cur.pdvCount += 1
      else cur.counterCount += 1
      cur.averageTicket = cur.totalAmount / cur.salesCount
      sellerMap.set(name, cur)
    }

    const sellerRanking = Array.from(sellerMap.values()).sort((a, b) => b.totalAmount - a.totalAmount)

    // Evolução diária
    const dailyMap = new Map<string, { count: number; total: number }>()
    for (const s of activeSales) {
      const dateKey = s.createdAt.slice(0, 10)
      const cur = dailyMap.get(dateKey) ?? { count: 0, total: 0 }
      cur.count += 1
      cur.total += parseFloat(s.total) || 0
      dailyMap.set(dateKey, cur)
    }

    const dailyEvolution: DailySalesPoint[] = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([dateKey, stats]) => {
        const [, m, d] = dateKey.split('-')
        return {
          dateKey,
          label: `${d}/${m}`,
          count: stats.count,
          total: stats.total,
        }
      })

    return {
      activeSales,
      totalRevenue,
      totalSubtotal,
      totalDiscount,
      totalItems,
      salesCount,
      averageTicket,
      pdvCount: pdvSales.length,
      pdvTotal: pdvSales.reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0),
      counterCount: counterSales.length,
      counterTotal: counterSales.reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0),
      fiscalCount,
      byPaymentMethod,
      sellerRanking,
      dailyEvolution,
    }
  },

  computeInventoryAbcAnalytics(items: InventoryItem[]) {
    const enriched = items.map((item) => {
      const qty = Math.max(0, parseFloat(item.quantityOnHand) || 0)
      const minQty = Math.max(0, parseFloat(item.minimumQuantity) || 0)
      const cost = Math.max(0, parseFloat(item.purchasePrice) || parseFloat(item.averageCost) || 0)
      const price = Math.max(0, parseFloat(item.unitPrice) || 0)
      const totalCostValue = qty * cost
      const totalSaleValue = qty * price
      const potentialProfit = totalSaleValue - totalCostValue
      const marginPercent = price > 0 ? ((price - cost) / price) * 100 : 0

      let stockStatus: 'out' | 'low' | 'normal' = 'normal'
      if (qty <= 0) stockStatus = 'out'
      else if (qty <= minQty) stockStatus = 'low'

      return {
        id: item.id,
        name: item.name,
        sku: item.sku,
        category: item.category || 'Sem Categoria',
        unit: item.unit,
        quantityOnHand: qty,
        minimumQuantity: minQty,
        purchasePrice: cost,
        unitPrice: price,
        totalCostValue,
        totalSaleValue,
        potentialProfit,
        marginPercent,
        stockStatus,
      }
    })

    // Ordena por valor potencial de venda em estoque para classificação da Curva ABC
    const sorted = [...enriched].sort((a, b) => b.totalSaleValue - a.totalSaleValue)
    const grandTotalSaleValue = sorted.reduce((acc, item) => acc + item.totalSaleValue, 0)
    const grandTotalCostValue = sorted.reduce((acc, item) => acc + item.totalCostValue, 0)
    const grandTotalPotentialProfit = grandTotalSaleValue - grandTotalCostValue

    let cumulative = 0
    const abcItems: InventoryAbcItem[] = sorted.map((item) => {
      const sharePercent = grandTotalSaleValue > 0 ? (item.totalSaleValue / grandTotalSaleValue) * 100 : 0
      cumulative += sharePercent
      let abcClass: 'A' | 'B' | 'C' = 'C'
      if (cumulative <= 80 || (cumulative - sharePercent < 80 && sharePercent > 0)) {
        abcClass = 'A'
      } else if (cumulative <= 95 || (cumulative - sharePercent < 95 && sharePercent > 0)) {
        abcClass = 'B'
      }

      return {
        ...item,
        sharePercent,
        cumulativePercent: Math.min(100, cumulative),
        abcClass,
      }
    })

    const outOfStockCount = abcItems.filter((i) => i.stockStatus === 'out').length
    const lowStockCount = abcItems.filter((i) => i.stockStatus === 'low').length
    const classACount = abcItems.filter((i) => i.abcClass === 'A').length
    const classBCount = abcItems.filter((i) => i.abcClass === 'B').length
    const classCCount = abcItems.filter((i) => i.abcClass === 'C').length

    return {
      abcItems,
      totalSkus: abcItems.length,
      totalUnits: abcItems.reduce((acc, i) => acc + i.quantityOnHand, 0),
      grandTotalCostValue,
      grandTotalSaleValue,
      grandTotalPotentialProfit,
      outOfStockCount,
      lowStockCount,
      classACount,
      classBCount,
      classCCount,
    }
  },

  computeFinancialAnalytics(
    sales: SaleListItem[],
    bills: CashBill[],
    entries: CashEntry[],
  ) {
    const activeSales = sales.filter((s) => s.status !== 'rejected' && s.status !== 'expired')
    const salesRevenue = activeSales.reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0)

    const activeBills = bills.filter((b) => b.status !== 'cancelled')
    const paidBills = activeBills.filter((b) => b.status === 'paid')
    const pendingBills = activeBills.filter((b) => b.status === 'pending')

    const totalBillsPaid = paidBills.reduce(
      (acc, b) => acc + (parseFloat(b.paidAmount || b.amount) || 0),
      0,
    )
    const totalBillsPending = pendingBills.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0)

    const todayStr = new Date().toISOString().slice(0, 10)
    const overdueBills = pendingBills.filter((b) => b.dueDate < todayStr)
    const totalBillsOverdue = overdueBills.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0)

    // Lançamentos manuais de caixa (excluindo os já espelhados de vendas/boletos)
    const activeEntries = entries.filter((e) => !e.canceledAt)
    const manualIncomes = activeEntries
      .filter((e) => e.direction === 'income' && !e.quoteId)
      .reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0)
    const manualExpenses = activeEntries
      .filter((e) => e.direction === 'expense' && !e.category.startsWith('Boleto -'))
      .reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0)

    const totalInflows = salesRevenue + manualIncomes
    const totalOutflows = totalBillsPaid + manualExpenses
    const netResult = totalInflows - totalOutflows

    // Despesas por categoria de boleto
    const catMap = new Map<string, { count: number; paid: number; pending: number; total: number }>()
    for (const b of activeBills) {
      const cat = b.category || 'Outros'
      const cur = catMap.get(cat) ?? { count: 0, paid: 0, pending: 0, total: 0 }
      const val = parseFloat(b.paidAmount || b.amount) || 0
      cur.count += 1
      cur.total += val
      if (b.status === 'paid') cur.paid += val
      if (b.status === 'pending') cur.pending += parseFloat(b.amount) || 0
      catMap.set(cat, cur)
    }

    const totalBillVolume = Array.from(catMap.values()).reduce((acc, c) => acc + c.total, 0)
    const byCategory: CategoryFinancialSummary[] = Array.from(catMap.entries())
      .map(([category, stats]) => ({
        category,
        count: stats.count,
        totalPaid: stats.paid,
        totalPending: stats.pending,
        totalAmount: stats.total,
        percentage: totalBillVolume > 0 ? (stats.total / totalBillVolume) * 100 : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)

    return {
      salesRevenue,
      manualIncomes,
      totalInflows,
      totalBillsPaid,
      manualExpenses,
      totalOutflows,
      netResult,
      totalBillsPending,
      totalBillsOverdue,
      overdueBillsCount: overdueBills.length,
      pendingBillsCount: pendingBills.length,
      paidBillsCount: paidBills.length,
      byCategory,
    }
  },

  computeQuotesAndServiceOrdersAnalytics(
    quotes: QuoteListItem[],
    serviceOrders: ServiceOrderListItem[],
  ) {
    const totalQuotes = quotes.length
    const approvedQuotes = quotes.filter((q) => q.status === 'approved' || Boolean(q.saleId))
    const pendingQuotes = quotes.filter((q) => q.status === 'draft' || q.status === 'sent')
    const rejectedQuotes = quotes.filter((q) => q.status === 'rejected' || q.status === 'expired')

    const totalQuotedValue = quotes.reduce((acc, q) => acc + (parseFloat(q.total) || 0), 0)
    const approvedQuotedValue = approvedQuotes.reduce((acc, q) => acc + (parseFloat(q.total) || 0), 0)
    const conversionRate = totalQuotes > 0 ? (approvedQuotes.length / totalQuotes) * 100 : 0

    const totalOs = serviceOrders.length
    const closedOs = serviceOrders.filter((os) => os.status === 'closed' || os.status === 'ready')
    const inProgressOs = serviceOrders.filter(
      (os) => os.status === 'in_maintenance' || os.status === 'queue' || os.status === 'pending',
    )
    const totalOsValue = serviceOrders.reduce((acc, os) => acc + (parseFloat(os.total) || 0), 0)
    const closedOsValue = closedOs.reduce((acc, os) => acc + (parseFloat(os.total) || 0), 0)

    return {
      totalQuotes,
      approvedQuotesCount: approvedQuotes.length,
      pendingQuotesCount: pendingQuotes.length,
      rejectedQuotesCount: rejectedQuotes.length,
      totalQuotedValue,
      approvedQuotedValue,
      conversionRate,
      totalOs,
      closedOsCount: closedOs.length,
      inProgressOsCount: inProgressOs.length,
      totalOsValue,
      closedOsValue,
    }
  },

  computeCustomersAnalytics(
    customers: Customer[],
    sales: SaleListItem[],
    quotes: QuoteListItem[],
    serviceOrders: ServiceOrderListItem[],
  ): {
    ranking: CustomerRankingItem[]
    totalCustomers: number
    activeBuyersCount: number
    individualCount: number
    companyCount: number
  } {
    const map = new Map<string, CustomerRankingItem>()

    for (const c of customers) {
      map.set(c.id, {
        customerId: c.id,
        customerName: c.name,
        document: c.document,
        phone: c.phone,
        email: c.email,
        personType: c.personType || 'individual',
        salesCount: 0,
        quotesCount: 0,
        serviceOrdersCount: 0,
        totalSpent: 0,
        averageTicket: 0,
        lastPurchaseAt: null,
      })
    }

    for (const s of sales) {
      if (s.status === 'rejected' || s.status === 'expired') continue
      const existing = map.get(s.customerId) ?? {
        customerId: s.customerId || s.customerName,
        customerName: s.customerName || 'Consumidor Final',
        document: s.customerDocument,
        phone: null,
        email: null,
        personType: 'individual' as const,
        salesCount: 0,
        quotesCount: 0,
        serviceOrdersCount: 0,
        totalSpent: 0,
        averageTicket: 0,
        lastPurchaseAt: null,
      }
      existing.salesCount += 1
      existing.totalSpent += parseFloat(s.total) || 0
      existing.averageTicket = existing.totalSpent / existing.salesCount
      if (!existing.lastPurchaseAt || s.createdAt > existing.lastPurchaseAt) {
        existing.lastPurchaseAt = s.createdAt
      }
      map.set(existing.customerId, existing)
    }

    for (const q of quotes) {
      const existing = map.get(q.customerId)
      if (existing) {
        existing.quotesCount += 1
      }
    }

    for (const os of serviceOrders) {
      if (os.customerId) {
        const existing = map.get(os.customerId)
        if (existing) {
          existing.serviceOrdersCount += 1
        }
      }
    }

    const ranking = Array.from(map.values()).sort((a, b) => {
      if (b.totalSpent !== a.totalSpent) return b.totalSpent - a.totalSpent
      return b.salesCount - a.salesCount
    })

    return {
      ranking,
      totalCustomers: customers.length,
      activeBuyersCount: ranking.filter((r) => r.salesCount > 0).length,
      individualCount: customers.filter((c) => c.personType !== 'company').length,
      companyCount: customers.filter((c) => c.personType === 'company').length,
    }
  },

  computeRegistrationsAnalytics(dataset: ReportsDataset) {
    const totalUsers = dataset.members.length
    const adminUsersCount = dataset.members.filter((m) => m.role === 'admin' || m.role === 'owner').length
    const standardUsersCount = dataset.members.filter((m) => m.role !== 'admin' && m.role !== 'owner').length

    // Funcionários e colaboradores da organização
    const employees = dataset.members.filter((m) => Boolean(m.jobTitle?.trim()) || m.role !== 'owner')
    const employeesCount = employees.length
    const employeesWithJobTitleCount = dataset.members.filter((m) => Boolean(m.jobTitle?.trim())).length

    const totalSuppliers = dataset.suppliers.length
    const suppliersWithCnpjCount = dataset.suppliers.filter((s) => Boolean(s.document?.trim())).length

    const totalCustomers = dataset.customers.length
    const individualCustomersCount = dataset.customers.filter((c) => c.personType !== 'company').length
    const companyCustomersCount = dataset.customers.filter((c) => c.personType === 'company').length

    return {
      totalUsers,
      adminUsersCount,
      standardUsersCount,
      employees,
      employeesCount,
      employeesWithJobTitleCount,
      totalSuppliers,
      suppliersWithCnpjCount,
      totalCustomers,
      individualCustomersCount,
      companyCustomersCount,
    }
  },
}
