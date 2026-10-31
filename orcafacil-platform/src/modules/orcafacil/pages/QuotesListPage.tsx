import { useEffect, useState } from 'react'
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
import { FileSpreadsheet, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react'
import type { QuoteStatus } from '@shared/types/database'
import { ConfirmActionDialog } from '@shared/components/ConfirmActionDialog'
import type { ServiceResult } from '@shared/types/common'

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
  const [quoteToPrint, setQuoteToPrint] = useState<QuoteDetail | null>(null)

  const loadQuotes = async () => {
    if (!currentOrganization) return
    setIsLoading(true)
    const res = await quoteService.listQuotes(currentOrganization.id)
    if (res.success) {
      setQuotes(res.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    void loadQuotes()
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

    const res = await quoteService.updateStatus(currentOrganization.id, quoteId, newStatus)
    if (res.success) {
      await loadQuotes()
    } else {
      setStatusError(res.error)
    }
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

  const normalizedCustomerName = filterCustomerName.trim().toLocaleLowerCase('pt-BR')
  const normalizedQuoteNumber = filterQuoteNumber.trim().toLocaleLowerCase('pt-BR')
  const filteredQuotes = quotes.filter((quote) => {
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
    <div className="space-y-6">
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

      <div className="sticky top-0 z-20 -mx-8 space-y-3 border-b border-gray-200 bg-gray-50/95 px-8 py-3 shadow-sm backdrop-blur">
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
                      : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-100'
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
            <span className="mb-1 block text-xs font-medium text-gray-600">Nome do cliente</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-gray-400"
            />
            <input
              type="search"
              value={filterCustomerName}
              onChange={(event) => {
                setFilterCustomerName(event.target.value)
              }}
              placeholder="Filtrar pelo cliente"
              aria-label="Filtrar orçamentos pelo nome do cliente"
              className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">
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
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Data do orçamento</span>
            <input
              type="date"
              value={filterQuoteDate}
              onChange={(event) => {
                setFilterQuoteDate(event.target.value)
              }}
              aria-label="Filtrar orçamentos pela data do orçamento"
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      <Card className="-mx-8">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-gray-500">Carregando orçamentos...</div>
          ) : filteredQuotes.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              <FileSpreadsheet className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              Nenhum orçamento encontrado com o filtro selecionado.{' '}
              <Link
                to="/orcafacil/quotes/new"
                className="text-blue-600 font-medium hover:underline"
              >
                Criar novo orçamento
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1260px] table-fixed text-left text-sm text-gray-600">
                <colgroup>
                  <col className="w-24" />
                  <col className="w-[148px]" />
                  <col className="w-[120px]" />
                  <col className="w-[104px]" />
                  <col className="w-[120px]" />
                  <col className="w-[136px]" />
                  <col className="w-[100px]" />
                  <col className="w-24" />
                  <col className="w-[340px]" />
                </colgroup>
                <thead className="bg-gray-50/75 text-xs uppercase text-gray-400 font-semibold border-b border-gray-100">
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
                <tbody className="divide-y divide-gray-100">
                  {filteredQuotes.map((q) => {
                    const allowedNext = ALLOWED_STATUS_TRANSITIONS[q.status]

                    return (
                      <tr key={q.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="break-all px-3 py-4 font-semibold text-gray-900">
                          {q.quoteNumber}
                        </td>
                        <td className="break-words px-3 py-4" title={q.customerName}>
                          {q.customerName}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-right text-xs text-gray-500">
                          {formatCurrency(q.subtotal)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-right text-xs text-red-600">
                          {parseFloat(q.discount) > 0 ? `-${formatCurrency(q.discount)}` : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-right font-bold text-gray-900">
                          {formatCurrency(q.total)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-right text-xs text-gray-500">
                          {new Date(q.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-right text-xs text-gray-400">
                          {q.validUntil ? new Date(q.validUntil).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="px-3 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClasses(
                              q.status,
                            )}`}
                          >
                            {getStatusLabel(q.status)}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {filterStatus !== 'all' && allowedNext.length > 0 && (
                              <select
                                aria-label="Alterar Status"
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    void handleStatusChange(
                                      q.id,
                                      q.status,
                                      e.target.value as QuoteStatus,
                                    )
                                  }
                                }}
                                className="w-[128px] max-w-full text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-700 cursor-pointer"
                              >
                                <option value="" disabled>
                                  Mudar status...
                                </option>
                                {allowedNext.map((st) => (
                                  <option key={st} value={st}>
                                    → {getStatusLabel(st)}
                                  </option>
                                ))}
                              </select>
                            )}
                            {canEditQuote(q.status, userRole) && (
                              <Link
                                to={`/orcafacil/quotes/${q.id}/edit`}
                                className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                                title="Editar orçamento"
                                aria-label={`Editar orçamento ${q.quoteNumber}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Link>
                            )}
                            {isQuotePrintable(q.status) && (
                              <button
                                onClick={() => {
                                  void handlePrint(q.id)
                                }}
                                className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                                title="Imprimir comprovante do orçamento"
                                aria-label={`Imprimir comprovante do orçamento ${q.quoteNumber}`}
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setQuoteToDelete(q)
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
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
    </div>
  )
}
