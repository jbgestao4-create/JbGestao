import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
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
  CheckCircle2,
  FileDown,
  FileEdit,
  FileSpreadsheet,
  FileText,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  Send,
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

const VALID_STATUSES: readonly ('all' | QuoteStatus)[] = [
  'all',
  'draft',
  'sent',
  'approved',
  'completed',
  'rejected',
  'expired',
]

const FILTER_TABS: readonly ('all' | QuoteStatus)[] = [
  'all',
  'draft',
  'sent',
  'completed',
  'rejected',
]

const STATUS_SORT_PRIORITY: Record<QuoteStatus, number> = {
  draft: 1,
  approved: 2,
  sent: 3,
  completed: 4,
  rejected: 5,
  expired: 6,
}

function parseStatusParam(value: string | null): ('all' | QuoteStatus) | null {
  if (value && (VALID_STATUSES as readonly string[]).includes(value)) {
    return value as 'all' | QuoteStatus
  }
  return null
}

export function QuotesListPage() {
  const { currentOrganization, userRole } = useOrganization()
  const { canAccessSubFeature } = useModuleAccess()
  const canCreateQuote = canAccessSubFeature('MOD-04_CREATE')
  const [searchParams, setSearchParams] = useSearchParams()
  const [quotes, setQuotes] = useState<QuoteListItem[]>([])
  const [filterStatus, setFilterStatus] = useState<'all' | QuoteStatus>(
    () => parseStatusParam(searchParams.get('status') || searchParams.get('tab')) || 'all',
  )
  const [filterCustomerName, setFilterCustomerName] = useState('')
  const [filterQuoteNumber, setFilterQuoteNumber] = useState('')
  const [filterQuoteDate, setFilterQuoteDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [printError, setPrintError] = useState<string | null>(null)
  const [quoteToDelete, setQuoteToDelete] = useState<QuoteListItem | null>(null)
  const [quoteToCancel, setQuoteToCancel] = useState<QuoteListItem | null>(null)
  const [quoteToRestore, setQuoteToRestore] = useState<QuoteListItem | null>(null)
  const [restoreReason, setRestoreReason] = useState('')
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
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

  useEffect(() => {
    const statusParam = parseStatusParam(searchParams.get('status') || searchParams.get('tab'))
    if (statusParam && statusParam !== filterStatus) {
      setFilterStatus(statusParam)
    }
  }, [searchParams, filterStatus])

  const handleFilterStatusChange = (st: 'all' | QuoteStatus) => {
    setFilterStatus(st)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (st === 'all') {
          next.delete('status')
          next.delete('tab')
        } else {
          next.set('status', st)
          next.delete('tab')
        }
        return next
      },
      { replace: true },
    )
  }

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
        handleFilterStatusChange(newStatus)
      }

      if (isTransitioningFromDraftToSent) {
        const found = quotes.find((q) => q.id === quoteId) ?? null
        const detailRes = await quoteService.getQuote(currentOrganization.id, quoteId)
        if (detailRes.success) {
          setQuoteDetailForWhatsApp(detailRes.data)
          setQuoteForWhatsApp(
            found
              ? { ...found, status: 'sent' }
              : {
                  id: detailRes.data.id,
                  organizationId: detailRes.data.organizationId,
                  customerId: detailRes.data.customerId,
                  customerName: detailRes.data.customerName,
                  customerPhone: detailRes.data.customerPhone,
                  quoteNumber: detailRes.data.quoteNumber,
                  status: 'sent',
                  subtotal: detailRes.data.subtotal,
                  discount: detailRes.data.discount,
                  total: detailRes.data.total,
                  validUntil: detailRes.data.validUntil,
                  createdAt: detailRes.data.createdAt,
                  updatedAt: detailRes.data.updatedAt,
                  creatorName: detailRes.data.creatorName,
                  sellerName: detailRes.data.sellerName,
                  saleId: detailRes.data.saleId,
                  saleNumber: detailRes.data.saleNumber,
                },
          )
        } else {
          setQuoteForWhatsApp(found ? { ...found, status: 'sent' } : null)
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

  const handleRestoreQuote = async () => {
    if (!currentOrganization || !quoteToRestore) return
    const trimmed = restoreReason.trim()
    if (!trimmed) {
      setRestoreError('Informe o motivo para restaurar o orçamento.')
      return
    }

    setIsRestoring(true)
    setRestoreError(null)
    const res = await quoteService.restoreQuote(currentOrganization.id, quoteToRestore.id, trimmed)
    setIsRestoring(false)

    if (res.success) {
      setQuoteToRestore(null)
      setRestoreReason('')
      await loadQuotes()
      handleFilterStatusChange('draft')
    } else {
      setRestoreError(res.error)
    }
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

  // Métricas do Topo
  const metrics = useMemo(() => {
    const commercialQuotes = quotes.filter((q) => !q.quoteNumber?.startsWith('VND-'))
    const totalCount = commercialQuotes.length
    const draftCount = commercialQuotes.filter((q) => q.status === 'draft').length
    const approvedCount = commercialQuotes.filter(
      (q) => q.status === 'approved' || q.status === 'completed',
    ).length
    const sentCount = commercialQuotes.filter((q) => q.status === 'sent').length
    const rejectedCount = commercialQuotes.filter((q) => q.status === 'rejected').length

    return {
      totalCount,
      draftCount,
      approvedCount,
      sentCount,
      rejectedCount,
    }
  }, [quotes])

  const normalizedCustomerName = filterCustomerName.trim().toLocaleLowerCase('pt-BR')
  const normalizedQuoteNumber = filterQuoteNumber.trim().toLocaleLowerCase('pt-BR')
  const filteredQuotes = quotes
    .filter((quote) => {
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
    .sort((a, b) => {
      const priorityA = STATUS_SORT_PRIORITY[a.status] ?? 99
      const priorityB = STATUS_SORT_PRIORITY[b.status] ?? 99
      if (priorityA !== priorityB) {
        return priorityA - priorityB
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Orçamentos</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
            Gerenciamento comercial, propostas e histórico de negociações
          </p>
        </div>

        {canCreateQuote && (
          <Link to="/orcafacil/quotes/new">
            <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs">
              <Plus className="w-4 h-4" /> Novo Orçamento
            </Button>
          </Link>
        )}
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

      {/* Cards de Métricas - Sequência: Total, Em Rascunho, Aprovados, Enviado ao Cliente, Recusado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* 1. Total de Orçamentos */}
        <Card
          onClick={() => handleFilterStatusChange('all')}
          className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/30 dark:to-slate-900 ${
            filterStatus === 'all' ? 'ring-2 ring-indigo-500/50' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Total de Orçamentos
              </p>
              <p className="text-xl font-extrabold text-indigo-700 dark:text-indigo-300 mt-0.5">
                {metrics.totalCount} cadastrado(s)
              </p>
            </div>
            <div className="rounded-xl bg-indigo-100 dark:bg-indigo-900/60 p-2 text-indigo-700 dark:text-indigo-300">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 2. Em Rascunho */}
        <Card
          onClick={() => handleFilterStatusChange('draft')}
          className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-amber-100 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/30 dark:to-slate-900 ${
            filterStatus === 'draft' ? 'ring-2 ring-amber-500/50' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Em Rascunho
              </p>
              <p className="text-xl font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">
                {metrics.draftCount} rascunho(s)
              </p>
            </div>
            <div className="rounded-xl bg-amber-100 dark:bg-amber-900/60 p-2 text-amber-700 dark:text-amber-300">
              <FileEdit className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 3. Orçamentos Aprovados */}
        <Card
          onClick={() => handleFilterStatusChange('approved')}
          className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-emerald-100 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/30 dark:to-slate-900 ${
            filterStatus === 'approved' ? 'ring-2 ring-emerald-500/50' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Orçamentos Aprovados
              </p>
              <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {metrics.approvedCount} aprovado(s)
              </p>
            </div>
            <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/60 p-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 4. Enviado ao Cliente */}
        <Card
          onClick={() => handleFilterStatusChange('sent')}
          className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-blue-100 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/30 dark:to-slate-900 ${
            filterStatus === 'sent' ? 'ring-2 ring-blue-500/50' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Enviado ao Cliente
              </p>
              <p className="text-xl font-extrabold text-blue-700 dark:text-blue-300 mt-0.5">
                {metrics.sentCount} enviado(s)
              </p>
            </div>
            <div className="rounded-xl bg-blue-100 dark:bg-blue-900/60 p-2 text-blue-700 dark:text-blue-300">
              <Send className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 5. Recusados */}
        <Card
          onClick={() => handleFilterStatusChange('rejected')}
          className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-rose-100 dark:border-rose-900/50 bg-gradient-to-br from-rose-50/50 to-white dark:from-rose-950/30 dark:to-slate-900 ${
            filterStatus === 'rejected' ? 'ring-2 ring-rose-500/50' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Recusados
              </p>
              <p className="text-xl font-extrabold text-rose-700 dark:text-rose-300 mt-0.5">
                {metrics.rejectedCount} recusado(s)
              </p>
            </div>
            <div className="rounded-xl bg-rose-100 dark:bg-rose-900/60 p-2 text-rose-700 dark:text-rose-300">
              <Ban className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="sticky top-0 z-20 -mx-4 space-y-3 border-b border-gray-200 dark:border-slate-800 bg-gray-50/95 dark:bg-[#0f172a]/95 px-4 py-3 shadow-xs backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTER_TABS.map(
            (st) => {
              const label = st === 'all' ? 'Todos' : getStatusLabel(st)
              return (
                <button
                  key={st}
                  onClick={() => {
                    handleFilterStatusChange(st)
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
              {canCreateQuote && (
                <Link
                  to="/orcafacil/quotes/new"
                  className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                >
                  Criar novo orçamento
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1360px] table-fixed text-left text-sm text-gray-600 dark:text-slate-300">
                <colgroup>
                  <col className="w-[140px]" />
                  <col className="w-[160px]" />
                  <col className="w-[120px]" />
                  <col className="w-[104px]" />
                  <col className="w-[120px]" />
                  <col className="w-[136px]" />
                  <col className="w-[100px]" />
                  <col className="w-[180px]" />
                  <col className="w-[340px]" />
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
                    <th className="px-3 py-3">Status</th>
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
                            className={`inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClasses(
                              q.status,
                              q.approvedBy || (q.status === 'approved' ? 'user' : undefined),
                            )}`}
                          >
                            {getStatusLabel(
                              q.status,
                              q.approvedBy || (q.status === 'approved' ? 'user' : undefined),
                            )}
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
                            ) : q.status === 'rejected' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setQuoteToRestore(q)
                                  setRestoreReason('')
                                  setRestoreError(null)
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 px-2.5 py-1.5 text-xs font-bold shadow-2xs transition-colors whitespace-nowrap cursor-pointer"
                                title="Restaurar orçamento recusado para rascunho"
                              >
                                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                                Restaurar orçamento
                              </button>
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
                            {q.status !== 'rejected' && (
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
                            )}
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
      {quoteToRestore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => {
            if (!isRestoring) {
              setQuoteToRestore(null)
              setRestoreReason('')
              setRestoreError(null)
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Restaurar Orçamento
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {quoteToRestore.quoteNumber} • {quoteToRestore.customerName}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
              O orçamento voltará para o status <strong className="text-amber-700 dark:text-amber-400">Rascunho</strong> para que possa ser editado e reenviado. Informe abaixo o motivo da restauração:
            </p>

            <div className="space-y-1.5">
              <label
                htmlFor="restore-reason-input"
                className="block text-xs font-semibold text-gray-700 dark:text-slate-300"
              >
                Motivo para restaurar <span className="text-red-500">*</span>
              </label>
              <textarea
                id="restore-reason-input"
                rows={3}
                autoFocus
                value={restoreReason}
                onChange={(e) => {
                  setRestoreReason(e.target.value)
                  if (restoreError) setRestoreError(null)
                }}
                placeholder="Ex.: Cliente solicitou revisão de valores ou novos itens..."
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              {restoreError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{restoreError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRestoring}
                onClick={() => {
                  setQuoteToRestore(null)
                  setRestoreReason('')
                  setRestoreError(null)
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                isLoading={isRestoring}
                onClick={() => {
                  void handleRestoreQuote()
                }}
                className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Confirmar Restauração
              </Button>
            </div>
          </div>
        </div>
      )}
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
                <img src="/controlesoft-mark.png" alt="Logo ControleSoft" className="h-14 w-14 object-contain" />
                <div>
                  <p className="text-lg font-bold text-gray-900">ControleSoft</p>
                  <p className="text-sm text-gray-500">Comprovante de pagamento</p>
                </div>
              </div>
              <span className="rounded-full border border-purple-300 bg-purple-50 px-3 py-1 text-sm font-semibold text-purple-800">
                {getStatusLabel(
                  quoteToPrint.status,
                  quoteToPrint.approvedBy ||
                    (quoteToPrint.status === 'approved' ? 'user' : undefined),
                )}
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
