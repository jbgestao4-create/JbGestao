import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import {
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Filter,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Search,
  ShoppingCart,
  Store,
  X,
} from 'lucide-react'
import {
  salesService,
  type SaleDetail,
  type SaleListItem,
  PAYMENT_METHOD_LABELS,
} from '../services/sales.service'
import { quoteService, type QuoteDetail } from '@modules/orcafacil/services/quote.service'
import { SaleReceiptModal } from '../components/SaleReceiptModal'
import { FiscalInvoiceModal } from '../components/FiscalInvoiceModal'
import { LinkedQuoteModal } from '../components/LinkedQuoteModal'

export function SalesListPage() {
  const { currentOrganization } = useOrganization()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [sales, setSales] = useState<SaleListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('tab') || 'all')
  const [dateFilter, setDateFilter] = useState('')

  // Modais de ação
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<SaleDetail | null>(null)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [fiscalModalOpen, setFiscalModalOpen] = useState(false)
  const [isFaturando, setIsFaturando] = useState<string | null>(null)

  // Orçamento vinculado
  const [selectedLinkedQuote, setSelectedLinkedQuote] = useState<QuoteDetail | null>(null)
  const [linkedQuoteModalOpen, setLinkedQuoteModalOpen] = useState(false)

  const loadSales = async () => {
    if (!currentOrganization) return
    setIsLoading(true)
    const res = await salesService.listSales(currentOrganization.id)
    setIsLoading(false)
    if (res.success) {
      setSales(res.data)
    }
  }

  useEffect(() => {
    void loadSales()
  }, [currentOrganization])

  // Filtragem dos dados
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (statusFilter === 'completed' && s.status !== 'completed') return false
      if (statusFilter === 'approved' && s.status !== 'approved') return false
      if (statusFilter === 'fiscal' && !s.hasFiscalInvoice) return false
      if (statusFilter === 'pdv' && !s.isPdv) return false

      if (dateFilter) {
        const saleDate = s.createdAt.slice(0, 10)
        if (saleDate !== dateFilter) return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchNumber = s.saleNumber.toLowerCase().includes(q)
        const matchCustomer = s.customerName.toLowerCase().includes(q)
        const matchDoc = s.customerDocument?.toLowerCase().includes(q) || false
        if (!matchNumber && !matchCustomer && !matchDoc) return false
      }

      return true
    })
  }, [sales, statusFilter, dateFilter, searchQuery])

  // Métricas de faturamento
  const metrics = useMemo(() => {
    const completedOrApproved = sales.filter((s) => s.status === 'completed' || s.status === 'approved')
    const totalRevenue = completedOrApproved.reduce((acc, s) => acc + Number(s.total), 0)
    const count = completedOrApproved.length
    const ticketMedio = count > 0 ? totalRevenue / count : 0

    return {
      totalRevenue: totalRevenue.toFixed(2),
      count,
      ticketMedio: ticketMedio.toFixed(2),
    }
  }, [sales])

  const handleOpenReceipt = async (saleItem: SaleListItem) => {
    if (!currentOrganization) return
    const res = await salesService.getSaleById(currentOrganization.id, saleItem.id)
    if (res.success) {
      setSelectedSaleDetail(res.data)
      setReceiptModalOpen(true)
    }
  }

  const handleOpenFiscal = async (saleItem: SaleListItem) => {
    if (!currentOrganization) return
    const res = await salesService.getSaleById(currentOrganization.id, saleItem.id)
    if (res.success) {
      setSelectedSaleDetail(res.data)
      setFiscalModalOpen(true)
    }
  }

  const handleOpenLinkedQuote = async (quoteId: string) => {
    if (!currentOrganization) return
    const res = await quoteService.getQuote(currentOrganization.id, quoteId)
    if (res.success) {
      setSelectedLinkedQuote(res.data)
      setLinkedQuoteModalOpen(true)
    } else {
      alert(res.error || 'Não foi possível carregar os detalhes do orçamento.')
    }
  }

  const handleFaturarAgora = async (quoteId: string) => {
    if (!currentOrganization) return
    setIsFaturando(quoteId)
    const res = await salesService.faturarOrcamento(currentOrganization.id, quoteId, 'money')
    setIsFaturando(null)
    if (res.success) {
      await loadSales()
    } else {
      alert(res.error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <Link
          to="/orcafacil/sales"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Hub de Vendas
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Consultar Vendas e Faturamento
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Histórico de pedidos, faturamento e emissão de notas fiscais.
              </p>
            </div>
          </div>

          <Button
            onClick={() => {
              void navigate('/orcafacil/sales/new')
            }}
            className="gap-2 bg-blue-600 hover:bg-blue-700 rounded-xl"
          >
            <Plus className="h-4 w-4" />
            Nova Venda (PDV)
          </Button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-xl shadow-xs border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Total Faturado
              </p>
              <p className="text-xl font-extrabold text-emerald-700 mt-0.5">
                {formatCurrency(metrics.totalRevenue)}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-xs border-blue-100 bg-gradient-to-br from-blue-50/50 to-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Vendas Concluídas
              </p>
              <p className="text-xl font-extrabold text-blue-700 mt-0.5">
                {metrics.count} venda(s)
              </p>
            </div>
            <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-xs border-purple-100 bg-gradient-to-br from-purple-50/50 to-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Ticket Médio
              </p>
              <p className="text-xl font-extrabold text-purple-700 mt-0.5">
                {formatCurrency(metrics.ticketMedio)}
              </p>
            </div>
            <div className="rounded-xl bg-purple-100 p-2 text-purple-700">
              <Store className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Campo de Busca */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por cliente, número do pedido ou CPF/CNPJ..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-8 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filtro por Data */}
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="rounded-lg border border-gray-300 py-1.5 px-2.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
              />
              {dateFilter && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDateFilter('')}
                  className="h-8 text-xs text-gray-500"
                >
                  Limpar Data
                </Button>
              )}
            </div>
          </div>

          {/* Abas de Status */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100 text-xs font-medium">
            <span className="text-gray-400 mr-1 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Filtrar:
            </span>
            {[
              { id: 'all', label: 'Todas as Vendas' },
              { id: 'completed', label: 'Concluídas / Faturadas' },
              { id: 'approved', label: 'Aprovadas' },
              { id: 'fiscal', label: 'Com NFC-e / NF-e' },
              { id: 'pdv', label: 'Apenas PDV Balcão' },
            ].map((tab) => {
              const active = statusFilter === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-lg px-2.5 py-1 transition ${
                    active
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Vendas */}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-gray-500">Carregando vendas...</div>
          ) : filteredSales.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              Nenhuma venda localizada com os filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 font-semibold">Nº Pedido / Venda</th>
                    <th className="px-3 py-3 font-semibold">Data / Hora</th>
                    <th className="px-3 py-3 font-semibold">Cliente</th>
                    <th className="px-3 py-3 font-semibold">Vendedor</th>
                    <th className="px-3 py-3 text-center font-semibold">Itens</th>
                    <th className="px-3 py-3 text-right font-semibold">Total</th>
                    <th className="px-3 py-3 font-semibold">Pagamento</th>
                    <th className="px-3 py-3 text-center font-semibold">Fiscal</th>
                    <th className="px-3 py-3 text-center font-semibold">Status</th>
                    <th className="px-4 py-3 text-center font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSales.map((s) => {
                    const isCompleted = s.status === 'completed'
                    const isApproved = s.status === 'approved'

                    return (
                      <tr key={s.id} className="hover:bg-gray-50/60 transition">
                        <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{s.saleNumber}</span>
                            {s.isPdv && (
                              <span className="rounded bg-blue-100 px-1 py-0.2 text-[9px] font-bold text-blue-700">
                                PDV
                              </span>
                            )}
                          </div>
                          {s.originQuoteId && (
                            <div className="mt-1">
                              <button
                                type="button"
                                onClick={() => void handleOpenLinkedQuote(s.originQuoteId!)}
                                className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                                title="Visualizar orçamento de origem"
                              >
                                <FileSpreadsheet className="h-3 w-3 text-amber-600" />
                                {s.originQuoteNumber || 'Ver Orçamento'}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                          {new Intl.DateTimeFormat('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          }).format(new Date(s.createdAt))}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-gray-900">{s.customerName}</p>
                          {s.customerDocument && (
                            <p className="text-[10px] text-gray-400">{s.customerDocument}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <p className="font-semibold text-gray-800">
                            {s.sellerName || s.creatorName || 'Operador'}
                          </p>
                          {s.originQuoteCreatorName && (
                            <p className="text-[10px] text-gray-400">
                              Orçado por: {s.originQuoteCreatorName}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-600 font-medium">
                          {s.itemsCount} item(ns)
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-gray-900 whitespace-nowrap">
                          {formatCurrency(s.total)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                            {PAYMENT_METHOD_LABELS[s.paymentMethod]}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {s.hasFiscalInvoice ? (
                            <button
                              type="button"
                              onClick={() => void handleOpenFiscal(s)}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition"
                            >
                              <QrCode className="h-3 w-3" />
                              {s.fiscalInvoice?.type.toUpperCase()}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleOpenFiscal(s)}
                              className="text-[10px] text-gray-400 hover:text-blue-600 underline font-medium"
                            >
                              Emitir Nota
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-800'
                                : isApproved
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isCompleted ? 'Concluída' : isApproved ? 'Aprovada' : s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {isApproved && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                isLoading={isFaturando === s.id}
                                onClick={() => void handleFaturarAgora(s.id)}
                                className="h-7 text-xs px-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Faturar
                              </Button>
                            )}

                            {s.originQuoteId && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void handleOpenLinkedQuote(s.originQuoteId!)}
                                className="h-7 w-7 p-0 text-amber-700 border-amber-200 hover:bg-amber-50"
                                title={`Visualizar orçamento ${s.originQuoteNumber || ''}`}
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleOpenReceipt(s)}
                              className="h-7 w-7 p-0 text-gray-600 hover:text-blue-600"
                              title="Imprimir comprovante"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleOpenFiscal(s)}
                              className="h-7 w-7 p-0 text-gray-600 hover:text-purple-600"
                              title="Nota fiscal NF-e / NFC-e"
                            >
                              <FileText className="h-3.5 w-3.5" />
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
        </CardContent>
      </Card>

      {/* Modais */}
      <SaleReceiptModal
        open={receiptModalOpen}
        sale={selectedSaleDetail}
        onClose={() => setReceiptModalOpen(false)}
      />

      <FiscalInvoiceModal
        open={fiscalModalOpen}
        sale={selectedSaleDetail}
        organizationId={currentOrganization?.id || ''}
        onClose={() => setFiscalModalOpen(false)}
        onEmitted={() => {
          void loadSales()
        }}
      />

      <LinkedQuoteModal
        open={linkedQuoteModalOpen}
        quote={selectedLinkedQuote}
        organizationName={currentOrganization?.name}
        onClose={() => {
          setLinkedQuoteModalOpen(false)
          setSelectedLinkedQuote(null)
        }}
      />
    </div>
  )
}
