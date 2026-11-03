import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import {
  salesService,
  type SaleDetail,
  type SaleListItem,
} from '../services/sales.service'
import { FiscalInvoiceModal } from '../components/FiscalInvoiceModal'

export function SalesInvoicesPage() {
  const { currentOrganization } = useOrganization()
  const [sales, setSales] = useState<SaleListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'emitted' | 'pending'>('all')

  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

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

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (filterType === 'emitted' && !s.hasFiscalInvoice) return false
      if (filterType === 'pending' && s.hasFiscalInvoice) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchNumber = s.saleNumber.toLowerCase().includes(q)
        const matchCustomer = s.customerName.toLowerCase().includes(q)
        const matchDoc = s.customerDocument?.toLowerCase().includes(q) || false
        const matchKey = s.fiscalInvoice?.accessKey.toLowerCase().includes(q) || false
        if (!matchNumber && !matchCustomer && !matchDoc && !matchKey) return false
      }

      return true
    })
  }, [sales, filterType, searchQuery])

  const handleOpenFiscalModal = async (saleItem: SaleListItem) => {
    if (!currentOrganization) return
    const res = await salesService.getSaleById(currentOrganization.id, saleItem.id)
    if (res.success) {
      setSelectedSale(res.data)
      setModalOpen(true)
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
          Voltar às Vendas
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-50 p-2.5 text-purple-700">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Central de Notas Fiscais (NF-e / NFC-e)
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Emissão, controle de autorizações SEFAZ, chave de acesso de 44 dígitos e DANFE.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Informativo SEFAZ */}
      <Card className="rounded-xl border-purple-200/80 bg-gradient-to-r from-purple-50/60 to-white shadow-xs">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-purple-700 shrink-0" />
            <div className="text-xs text-gray-700">
              <p className="font-bold text-gray-900 text-sm">Transmissão Fiscal e Homologação SEFAZ</p>
              <p className="text-gray-500 mt-0.5">
                Emita NFC-e (Cupom Fiscal) para consumidor no balcão e NF-e para entregas e faturamentos com chave de acesso estruturada e cálculo automático.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 shrink-0">
            SEFAZ ONLINE
          </span>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente, pedido ou chave de acesso..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-8 text-xs text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
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

          <div className="flex items-center gap-1.5 text-xs font-medium shrink-0">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`rounded-lg px-3 py-1.5 transition ${
                filterType === 'all'
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todas ({sales.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('emitted')}
              className={`rounded-lg px-3 py-1.5 transition ${
                filterType === 'emitted'
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Emitidas ({sales.filter((s) => s.hasFiscalInvoice).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('pending')}
              className={`rounded-lg px-3 py-1.5 transition ${
                filterType === 'pending'
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Pendentes de Nota ({sales.filter((s) => !s.hasFiscalInvoice).length})
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Notas Fiscais */}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-gray-500">
              Carregando dados fiscais...
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              Nenhuma venda encontrada para os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 font-semibold">Venda / Pedido</th>
                    <th className="px-3 py-3 font-semibold">Cliente</th>
                    <th className="px-3 py-3 text-right font-semibold">Valor Total</th>
                    <th className="px-3 py-3 text-center font-semibold">Tipo Fiscal</th>
                    <th className="px-3 py-3 font-semibold">Chave de Acesso / Protocolo</th>
                    <th className="px-3 py-3 text-center font-semibold">Situação</th>
                    <th className="px-4 py-3 text-center font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSales.map((s) => {
                    const invoice = s.fiscalInvoice

                    return (
                      <tr key={s.id} className="hover:bg-gray-50/60 transition">
                        <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                          {s.saleNumber}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-gray-900">{s.customerName}</p>
                          {s.customerDocument && (
                            <p className="text-[10px] text-gray-400">{s.customerDocument}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-gray-900 whitespace-nowrap">
                          {formatCurrency(s.total)}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {invoice ? (
                            <span className="rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                              {invoice.type.toUpperCase()} (Mod. {invoice.type === 'nfce' ? '65' : '55'})
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 max-w-xs truncate">
                          {invoice ? (
                            <div>
                              <p className="font-mono text-[10px] text-gray-700 truncate select-all" title={invoice.accessKey}>
                                {invoice.accessKey}
                              </p>
                              <p className="text-[10px] text-gray-400">Prot: {invoice.protocol}</p>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Pendente de emissão</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {invoice ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3" />
                              AUTORIZADA
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                              PENDENTE
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleOpenFiscalModal(s)}
                            className="h-7 text-xs px-2.5 text-purple-700 border-purple-200 hover:bg-purple-50"
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            {invoice ? 'Ver DANFE' : 'Emitir Nota'}
                          </Button>
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

      {/* Modal Fiscal */}
      <FiscalInvoiceModal
        open={modalOpen}
        sale={selectedSale}
        organizationId={currentOrganization?.id || ''}
        onClose={() => setModalOpen(false)}
        onEmitted={() => {
          void loadSales()
        }}
      />
    </div>
  )
}
