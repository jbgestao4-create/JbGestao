import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { quoteService, type QuoteDetail, type QuoteListItem } from '../services/quote.service'
import {
  getStatusBadgeClasses,
  getStatusLabel,
  canEditQuote,
  isQuotePrintable,
  isValidStatusTransition,
  ALLOWED_STATUS_TRANSITIONS,
} from '../domain/quote-status'
import { formatCurrency } from '@shared/utils/monetary'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { ListBox } from '@shared/components/ui/ListBox'
import {
  Ban,
  FileDown,
  FileSpreadsheet,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react'
import { SendQuoteWhatsAppModal } from '../components/SendQuoteWhatsAppModal'
import { downloadQuotePdf } from '../utils/quote-pdf'
import type { QuoteStatus } from '@shared/types/database'
import { ConfirmActionDialog } from '@shared/components/ConfirmActionDialog'
import type { ServiceResult } from '@shared/types/common'
import { salesService, type SaleDetail } from '@modules/sales/services/sales.service'
import { SaleReceiptModal } from '@modules/sales/components/SaleReceiptModal'

function getLocalDateValue(value: string) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${String(year)}-${month}-${day}`
}

export function QuotesListPage() {
  const { currentOrganization, userRole } = useOrganization()
  const [quotes, setQuotes] = useState<QuoteListItem[]>([])
  const [filterStatus, setFilterStatus] = useState<'all' | QuoteStatus>('all')
  const [filterCustomerName, setFilterCustomerName] = useState('')
  const [filterQuoteNumber, setFilterQuoteNumber] = useState('')
  const [filterQuoteDate, setFilterQuoteDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [printError, setPrintError] = useState<string | null>(null)
  const [quoteToDelete, setQuoteToDelete] = useState<QuoteListItem | null>(null)
  const [quoteToCancel, setQuoteToCancel] = useState<QuoteListItem | null>(null)
  const [quoteToPrint, setQuoteToPrint] = useState<QuoteDetail | null>(null)
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false)
  const [quoteForWhatsApp, setQuoteForWhatsApp] = useState<QuoteListItem | null>(null)
  const [quoteDetailForWhatsApp, setQuoteDetailForWhatsApp] = useState<QuoteDetail | null>(null)
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<SaleDetail | null>(null)
  const [saleModalOpen, setSaleModalOpen] = useState(false)

  const loadQuotes = useCallback(async () => {
    if (!currentOrganization) return
    setIsLoading(true)
    const res = await quoteService.listQuotes(currentOrganization.id)
    if (res.success) {
      setQuotes(res.data)
    }
    setIsLoading(false)
  }, [currentOrganization])

  useEffect(() => {
    let isCancelled = false
    if (!currentOrganization) return

    void quoteService.listQuotes(currentOrganization.id).then((res) => {
      if (!isCancelled) {
        if (res.success) {
          setQuotes(res.data)
        }
        setIsLoading(false)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [currentOrganization])

  useEffect(() => {
    if (!quoteToPrint) return

    const printTimer = window.setTimeout(() => {
      window.print()
    }, 100)
    const handleAfterPrint = () => {
      setQuoteToPrint(null)
    }
    window.addEventListener('afterprint', handleAfterPrint)

    return () => {
      window.clearTimeout(printTimer)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [quoteToPrint])

  const handleStatusChange = async (
    quoteId: string,
    currentStatus: QuoteStatus,
    newStatus: QuoteStatus,
  ) => {
    if (!currentOrganization) return
    setStatusError(null)

    if (!isValidStatusTransition(currentStatus, newStatus)) {
      setStatusError(
        `Transição inválida: Não é permitido mudar de "${getStatusLabel(
          currentStatus,
        )}" para "${getStatusLabel(newStatus)}".`,
      )
      return
    }

    const isTransitioningFromDraftToSent = currentStatus === 'draft' && newStatus === 'sent'

    const res = await quoteService.updateStatus(currentOrganization.id, quoteId, newStatus)
    if (res.success) {
      await loadQuotes()

      // Acompanha o orçamento para a respectiva aba, exceto se for recusado
      if (newStatus !== 'rejected') {
        setFilterStatus(newStatus)
      }

      if (isTransitioningFromDraftToSent) {
        const found = quotes.find((q) => q.id === quoteId) ?? null
        setQuoteForWhatsApp(found)
        const detailRes = await quoteService.getQuote(currentOrganization.id, quoteId)
        if (detailRes.success) {
          setQuoteDetailForWhatsApp(detailRes.data)
        } else {
          setQuoteDetailForWhatsApp(null)
        }
        setWhatsAppModalOpen(true)
      }
    } else {
      setStatusError(res.error)
    }
  }

  const handleOpenWhatsApp = async (q: QuoteListItem) => {
    if (!currentOrganization) return
    setQuoteForWhatsApp(q)
    const detailRes = await quoteService.getQuote(currentOrganization.id, q.id)
    if (detailRes.success) {
      setQuoteDetailForWhatsApp(detailRes.data)
    } else {
      setQuoteDetailForWhatsApp(null)
    }
    setWhatsAppModalOpen(true)
  }

  const handleDelete = async (): Promise<ServiceResult<void>> => {
    if (!currentOrganization || !quoteToDelete) {
      return { success: false, error: 'Não foi possível identificar o orçamento.' }
    }

    const res = await quoteService.deleteQuote(currentOrganization.id, quoteToDelete.id)
    if (res.success) {
      setQuoteToDelete(null)
      await loadQuotes()
    }
    return res
  }

  const handleCancelQuote = async (): Promise<ServiceResult<void>> => {
    if (!currentOrganization || !quoteToCancel) {
      return { success: false, error: 'Não foi possível identificar o orçamento.' }
    }

    const res = await quoteService.updateStatus(currentOrganization.id, quoteToCancel.id, 'rejected')
    if (res.success) {
      setQuoteToCancel(null)
      await loadQuotes()
    } else {
      setStatusError(res.error)
    }
    return res
  }

  const handlePrint = async (quoteId: string) => {
    if (!currentOrganization) return
    setPrintError(null)
    const res = await quoteService.getQuote(currentOrganization.id, quoteId)
    if (res.success) {
      setQuoteToPrint(res.data)
    } else {
      setPrintError(res.error)
    }
  }

  const handleDownloadDirectPdf = async (quoteId: string) => {
    if (!currentOrganization) return
    setPrintError(null)
    const res = await quoteService.getQuote(currentOrganization.id, quoteId)
    if (res.success) {
      downloadQuotePdf(res.data, { organizationName: currentOrganization.name })
    } else {
      setPrintError(res.error)
    }
  }

  const handleViewLinkedSale = async (saleId: string) => {
    if (!currentOrganization) return
    setPrintError(null)
    const res = await salesService.getSaleById(currentOrganization.id, saleId)
    if (res.success) {
      setSelectedSaleDetail(res.data)
      setSaleModalOpen(true)
    } else {
      setPrintError(res.error || 'Não foi possível carregar os dados da venda vinculada.')
    }
  }

  const normalizedCustomerName = filterCustomerName.trim().toLocaleLowerCase('pt-BR')
  const normalizedQuoteNumber = filterQuoteNumber.trim().toLocaleLowerCase('pt-BR')
  const filteredQuotes = quotes.filter((quote) => {
    // Exclui vendas geradas pelo PDV ou faturamento direto (devem aparecer somente em Vendas)
    if (quote.quoteNumber.startsWith('VND-')) return false

    const matchesStatus = filterStatus === 'all' || quote.status === filterStatus
    const matchesCustomer =
      !normalizedCustomerName ||
      quote.customerName.toLocaleLowerCase('pt-BR').includes(normalizedCustomerName)
    const matchesQuoteNumber =
      !normalizedQuoteNumber ||
      quote.quoteNumber.toLocaleLowerCase('pt-BR').includes(normalizedQuoteNumber)
    const matchesDate = !filterQuoteDate || getLocalDateValue(quote.createdAt) === filterQuoteDate

    return matchesStatus && matchesCustomer && matchesQuoteNumber && matchesDate
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Orçamentos</h1>
          <p className="text-sm text-gray-500">
            Gerenciamento comercial, propostas e histórico de negociações
          </p>
        </div>

        <Link to="/orcafacil/quotes/new">
          <Button size="sm">
            <Plus className="w-4 h-4" /> Novo Orçamento
          </Button>
        </Link>
      </div>

      {statusError && (
        <div className="p-4 bg-amber-50 text-amber-800 text-sm rounded-xl border border-amber-200">
          {statusError}
        </div>
      )}
      {printError && (
        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
          {printError}
        </div>
      )}

      <div className="sticky top-0 z-20 -mx-4 space-y-3 border-b border-gray-200 dark:border-slate-800 bg-gray-50/95 dark:bg-[#0f172a]/95 px-4 py-3 shadow-xs backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'draft', 'sent', 'approved', 'completed', 'rejected', 'expired'] as const).map(
            (st) => {
              const label = st === 'all' ? 'Todos' : getStatusLabel(st)
              return (
                <button
                  key={st}
                  onClick={() => {
                    setFilterStatus(st)
                  }}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    filterStatus === st
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              )
            },
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="relative block">
            <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-300">Nome do cliente</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-gray-400 dark:text-slate-500"
            />
            <input
              type="search"
              value={filterCustomerName}
              onChange={(event) => {
                setFilterCustomerName(event.target.value)
              }}
              placeholder="Filtrar pelo cliente"
              aria-label="Filtrar orçamentos pelo nome do cliente"
              className="h-10 w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 text-sm text-gray-700 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-300">
              Número do orçamento
            </span>
            <input
              type="search"
              value={filterQuoteNumber}
              onChange={(event) => {
                setFilterQuoteNumber(event.target.value)
              }}
              placeholder="Ex.: ORC-2026"
              aria-label="Filtrar orçamentos pelo número"
              className="h-10 w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-gray-700 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-300">Data do orçamento</span>
            <input
              type="date"
              value={filterQuoteDate}
              onChange={(event) => {
                setFilterQuoteDate(event.target.value)
              }}
              aria-label="Filtrar orçamentos pela data do orçamento"
              className="h-10 w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-gray-700 dark:text-slate-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      <Card className="w-full">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-gray-500 dark:text-slate-400">Carregando orçamentos...</div>
          ) : filteredQuotes.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500 dark:text-slate-400">
              <FileSpreadsheet className="w-8 h-8 mx-auto text-gray-300 dark:text-slate-600 mb-2" />
              Nenhum orçamento encontrado com o filtro selecionado.{' '}
              <Link
                to="/orcafacil/quotes/new"
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
              >
                Criar novo orçamento
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1260px] table-fixed text-left text-sm text-gray-600 dark:text-slate-300">
                <colgroup>
                  <col className="w-[140px]" />
                  <col className="w-[160px]" />
                  <col className="w-[120px]" />
                  <col className="w-[104px]" />
                  <col className="w-[120px]" />
                  <col className="w-[136px]" />
                  <col className="w-[100px]" />
                  <col className="w-24" />
                  <col className="w-[380px]" />
                </colgroup>
                <thead className="bg-gray-50/75 dark:bg-slate-800/60 text-xs uppercase text-gray-400 dark:text-slate-400 font-semibold border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-3">Número</th>
                    <th className="px-3 py-3">Cliente</th>
                    <th className="px-3 py-3 text-right">Subtotal</th>
                    <th className="px-3 py-3 text-right">Desconto</th>
                    <th className="px-3 py-3 text-right">Total</th>
                    <th className="px-3 py-3 text-right">Data do Orçamento</th>
                    <th className="px-3 py-3 text-right">Validade</th>
                    <th className="px-3 py-3">{filterStatus !== 'all' ? 'Status' : ''}</th>
                    <th className="px-3 py-3 text-right" aria-label="Ações" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {filteredQuotes.map((q) => {
                    const allowedNext = ALLOWED_STATUS_TRANSITIONS[q.status]

                    return (
                      <tr key={q.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="break-all px-3 py-2.5 font-semibold text-gray-900 dark:text-white">
                          <div className="font-bold">{q.quoteNumber}</div>
                          <div className="text-[11px] font-normal text-gray-500 dark:text-slate-400">
                            Por: <span className="font-medium text-gray-700 dark:text-slate-300">{q.creatorName || 'Sistema'}</span>
                          </div>
                          {q.saleId && (
                            <div className="mt-1">
                              <button
                                type="button"
                                onClick={() => void handleViewLinkedSale(q.saleId!)}
                                className="inline-flex items-center gap-1 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition cursor-pointer"
                                title={`Visualizar venda gerada (${q.saleNumber || 'Venda'})`}
                              >
                                <ShoppingCart className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                {q.saleNumber || 'Ver Venda'}
                              </button>
                              {q.sellerName && (
                                <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                                  Vendido por: <span className="font-medium text-gray-600 dark:text-slate-400">{q.sellerName}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="break-words px-3 py-2.5 text-gray-800 dark:text-slate-200" title={q.customerName}>
                          {q.customerName}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-gray-500 dark:text-slate-400">
                          {formatCurrency(q.subtotal)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-red-600 dark:text-red-400">
                          {parseFloat(q.discount) > 0 ? `-${formatCurrency(q.discount)}` : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-gray-900 dark:text-white">
                          {formatCurrency(q.total)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-gray-500 dark:text-slate-400">
                          {new Date(q.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-gray-400 dark:text-slate-500">
                          {q.validUntil ? new Date(q.validUntil).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClasses(
                              q.status,
                            )}`}
                          >
                            {getStatusLabel(q.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {q.status === 'approved' ? (
                              <>
                                <Link
                                  to={`/orcafacil/sales/new?quoteId=${q.id}`}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-xs font-bold shadow-xs transition-colors whitespace-nowrap cursor-pointer"
                                  title="Abrir tela de venda com as informações deste orçamento preenchidas automaticamente"
                                >
                                  <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                                  Enviar para Venda
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => setQuoteToCancel(q)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 px-2 py-1.5 text-xs font-semibold shadow-2xs transition-colors whitespace-nowrap cursor-pointer"
                                  title="Cancelar orçamento aprovado"
                                >
                                  <Ban className="w-3.5 h-3.5 shrink-0" />
                                  Cancelar
                                </button>
                              </>
                            ) : allowedNext.length > 0 ? (
                              <div className="w-36 text-left">
                                <ListBox
                                  placeholder="Mudar status..."
                                  searchable={false}
                                  value=""
                                  onChange={(val) => {
                                    if (val) {
                                      void handleStatusChange(
                                        q.id,
                                        q.status,
                                        val as QuoteStatus,
                                      )
                                    }
                                  }}
                                  options={allowedNext.map((st) => ({
                                    value: st,
                                    label: `→ ${getStatusLabel(st)}`,
                                  }))}
                                />
                              </div>
                            ) : null}
                            {canEditQuote(q.status, userRole) && (
                              <Link
                                to={`/orcafacil/quotes/${q.id}/edit`}
                                className="inline-flex items-center gap-1.5 rounded p-1.5 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                                title="Editar orçamento"
                                aria-label={`Editar orçamento ${q.quoteNumber}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Link>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                void handleOpenWhatsApp(q)
                              }}
                              className="inline-flex items-center gap-1.5 rounded p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                              title="Enviar cópia via WhatsApp"
                              aria-label={`Enviar orçamento ${q.quoteNumber} via WhatsApp`}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                            {isQuotePrintable(q.status) && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleDownloadDirectPdf(q.id)
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                                  title="Baixar arquivo PDF"
                                  aria-label={`Baixar PDF do orçamento ${q.quoteNumber}`}
                                >
                                  <FileDown className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handlePrint(q.id)
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded p-1.5 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Imprimir comprovante do orçamento"
                                  aria-label={`Imprimir comprovante do orçamento ${q.quoteNumber}`}
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {q.saleId && (
                              <button
                                type="button"
                                onClick={() => {
                                  void handleViewLinkedSale(q.saleId!)
                                }}
                                className="inline-flex items-center gap-1.5 rounded p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                                title={`Visualizar venda gerada (${q.saleNumber || 'Venda'})`}
                                aria-label={`Visualizar venda gerada ${q.saleNumber || ''}`}
                              >
                                <Receipt className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setQuoteToDelete(q)
                              }}
                              className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Excluir Orçamento"
                              aria-label={`Excluir orçamento ${q.quoteNumber}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
      <SendQuoteWhatsAppModal
        open={whatsAppModalOpen}
        quote={quoteForWhatsApp}
        quoteDetail={quoteDetailForWhatsApp}
        organizationName={currentOrganization?.name}
        organizationId={currentOrganization?.id}
        onClose={() => {
          setWhatsAppModalOpen(false)
          setQuoteForWhatsApp(null)
          setQuoteDetailForWhatsApp(null)
        }}
      />
      <ConfirmActionDialog
        open={quoteToDelete !== null}
        title="Excluir orçamento?"
        description="Tem certeza de que deseja excluir este orçamento e seus itens?"
        confirmLabel="Sim, excluir"
        onCancel={() => {
          setQuoteToDelete(null)
        }}
        onConfirm={handleDelete}
      />
      <ConfirmActionDialog
        open={quoteToCancel !== null}
        title="Cancelar orçamento aprovado?"
        description={`Tem certeza de que deseja cancelar o orçamento ${quoteToCancel?.quoteNumber}? Ele será marcado como cancelado/recusado.`}
        confirmLabel="Sim, cancelar orçamento"
        onCancel={() => {
          setQuoteToCancel(null)
        }}
        onConfirm={handleCancelQuote}
      />
      {quoteToPrint && (
        <>
          <style>{`
            .quote-print-sheet { display: none; }
            @media print {
              @page { size: A4; margin: 0; }
              body * { visibility: hidden !important; }
              .quote-print-sheet,
              .quote-print-sheet * { visibility: visible !important; }
              .quote-print-sheet {
                display: block !important;
                position: fixed;
                inset: 0;
                width: 100%;
                min-height: 297mm;
                box-sizing: border-box;
                padding: 14mm;
                background: #fff;
                color: #111827;
                font-family: Arial, sans-serif;
              }
            }
          `}</style>
          <section className="quote-print-sheet">
            <header className="mb-8 flex items-center justify-between border-b border-gray-300 pb-5">
              <div className="flex items-center gap-3">
                <img src="/jb-software-mark.svg" alt="Logo JB Software" className="h-14 w-14" />
                <div>
                  <p className="text-lg font-bold text-gray-900">JB Gestão Comercial</p>
                  <p className="text-sm text-gray-500">Comprovante de pagamento</p>
                </div>
              </div>
              <span className="rounded-full border border-purple-300 bg-purple-50 px-3 py-1 text-sm font-semibold text-purple-800">
                {getStatusLabel(quoteToPrint.status)}
              </span>
            </header>

            <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Orçamento
                </p>
                <p className="mt-1 font-semibold">{quoteToPrint.quoteNumber}</p>
                <p>Data: {new Date(quoteToPrint.createdAt).toLocaleDateString('pt-BR')}</p>
                <p>Funcionário responsável: {quoteToPrint.creatorName ?? 'Não informado'}</p>
                {quoteToPrint.validUntil && (
                  <p>Validade: {new Date(quoteToPrint.validUntil).toLocaleDateString('pt-BR')}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Cliente
                </p>
                <p className="mt-1 font-semibold">{quoteToPrint.customerName}</p>
                {quoteToPrint.customerPhone && <p>Telefone: {quoteToPrint.customerPhone}</p>}
                {quoteToPrint.customerEmail && <p>E-mail: {quoteToPrint.customerEmail}</p>}
                {quoteToPrint.customerAddress && <p>Endereço: {quoteToPrint.customerAddress}</p>}
              </div>
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-y border-gray-300 text-left text-xs uppercase text-gray-500">
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="px-3 py-2 text-right">Quantidade</th>
                  <th className="px-3 py-2 text-right">Valor unitário</th>
                  <th className="py-2 pl-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {quoteToPrint.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="py-3 pr-3">{item.description}</td>
                    <td className="px-3 py-3 text-right">
                      {Number(item.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
                      {item.unit ? ` ${item.unit}` : ''}
                    </td>
                    <td className="px-3 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-3 pl-3 text-right">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ml-auto mt-6 w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(quoteToPrint.subtotal)}</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>Desconto</span>
                <span>
                  {parseFloat(quoteToPrint.discount) > 0
                    ? `-${formatCurrency(quoteToPrint.discount)}`
                    : formatCurrency(0)}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-400 pt-2 text-base font-bold">
                <span>Total</span>
                <span>{formatCurrency(quoteToPrint.total)}</span>
              </div>
            </div>

            {quoteToPrint.notes && (
              <div className="mt-8 border-t border-gray-200 pt-4 text-sm">
                <p className="font-semibold">Observações</p>
                <p className="mt-1 whitespace-pre-wrap">{quoteToPrint.notes}</p>
              </div>
            )}
          </section>
        </>
      )}

      <SaleReceiptModal
        open={saleModalOpen}
        sale={selectedSaleDetail}
        onClose={() => {
          setSaleModalOpen(false)
          setSelectedSaleDetail(null)
        }}
      />
    </div>
  )
}
