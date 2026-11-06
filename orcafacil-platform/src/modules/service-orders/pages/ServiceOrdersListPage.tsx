import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { ListBox } from '@shared/components/ui/ListBox'
import { ConfirmActionDialog } from '@shared/components/ConfirmActionDialog'
import { formatCurrency } from '@shared/utils/monetary'
import type { ServiceResult } from '@shared/types/common'
import { salesService, type SaleDetail } from '@modules/sales/services/sales.service'
import { SaleReceiptModal } from '@modules/sales/components/SaleReceiptModal'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import {
  SERVICE_ORDER_PRIORITY_BADGE_CLASSES,
  SERVICE_ORDER_PRIORITY_LABELS,
  SERVICE_ORDER_STATUS_BADGE_CLASSES,
  SERVICE_ORDER_STATUS_LABELS,
  type ServiceOrderDetail,
  type ServiceOrderListItem,
  type ServiceOrderStatus,
} from '../domain/service-order'
import { serviceOrderService } from '../services/service-order.service'
import { ServiceOrderPrintModal } from '../components/ServiceOrderPrintModal'
import { SendServiceOrderWhatsAppModal } from '../components/SendServiceOrderWhatsAppModal'

const STATUS_TABS: readonly ('all' | ServiceOrderStatus)[] = [
  'all',
  'queue',
  'in_maintenance',
  'pending',
  'ready',
  'closed',
]

const STATUS_SORT_ORDER: Record<ServiceOrderStatus, number> = {
  queue: 1,
  in_maintenance: 2,
  pending: 3,
  ready: 4,
  closed: 5,
}

export function ServiceOrdersListPage() {
  const { currentOrganization } = useOrganization()
  const { canAccessSubFeature } = useModuleAccess()
  const canCreateOrder = canAccessSubFeature('MOD-10_CREATE')
  const [searchParams, setSearchParams] = useSearchParams()

  const [orders, setOrders] = useState<ServiceOrderListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | ServiceOrderStatus>(() => {
    const param = searchParams.get('status')
    if (param && (STATUS_TABS as readonly string[]).includes(param)) {
      return param as 'all' | ServiceOrderStatus
    }
    return 'all'
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [orderToDelete, setOrderToDelete] = useState<ServiceOrderListItem | null>(null)
  const [orderToPrint, setOrderToPrint] = useState<ServiceOrderDetail | null>(null)
  const [orderForWhatsApp, setOrderForWhatsApp] = useState<ServiceOrderListItem | null>(null)
  const [orderForPendingModal, setOrderForPendingModal] = useState<ServiceOrderListItem | null>(null)
  const [pendingReasonInput, setPendingReasonInput] = useState('')
  const [pendingReasonError, setPendingReasonError] = useState<string | null>(null)
  const [isSavingPending, setIsSavingPending] = useState(false)
  const [orderForCloseModal, setOrderForCloseModal] = useState<ServiceOrderListItem | null>(null)
  const [closeReasonInput, setCloseReasonInput] = useState('')
  const [closeReasonError, setCloseReasonError] = useState<string | null>(null)
  const [isSavingClose, setIsSavingClose] = useState(false)

  // Modal para confirmação/preenchimento da Solução antes de passar para Pronto
  const [orderForSolutionModal, setOrderForSolutionModal] = useState<ServiceOrderListItem | null>(null)
  const [solutionInput, setSolutionInput] = useState('')
  const [solutionError, setSolutionError] = useState<string | null>(null)
  const [isSavingSolution, setIsSavingSolution] = useState(false)
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<SaleDetail | null>(null)
  const [saleModalOpen, setSaleModalOpen] = useState(false)

  const loadOrders = useCallback(async () => {
    if (!currentOrganization) return
    setIsLoading(true)
    const res = await serviceOrderService.list(currentOrganization.id)
    if (res.success) {
      setOrders(res.data)
      const notifyReadyId = searchParams.get('notifyReady')
      if (notifyReadyId) {
        const target = res.data.find((item) => item.id === notifyReadyId)
        if (target) {
          setOrderForWhatsApp(target)
        }
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('notifyReady')
            return next
          },
          { replace: true },
        )
      }
    } else {
      setErrorMsg(res.error)
    }
    setIsLoading(false)
  }, [currentOrganization, searchParams, setSearchParams])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  const handleFilterChange = (status: 'all' | ServiceOrderStatus) => {
    setFilterStatus(status)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (status === 'all') {
          next.delete('status')
        } else {
          next.set('status', status)
        }
        return next
      },
      { replace: true },
    )
  }

  const handleStatusChange = async (orderId: string, newStatus: ServiceOrderStatus) => {
    if (!currentOrganization) return
    setErrorMsg(null)
    const currentOrder = orders.find((o) => o.id === orderId)

    // Ao encaminhar para Pendente, abre a janela pedindo o motivo da pendência
    if (newStatus === 'pending') {
      if (currentOrder) {
        setOrderForPendingModal(currentOrder)
        setPendingReasonInput(currentOrder.pendingReason || '')
        setPendingReasonError(null)
      }
      return
    }

        // Ao tentar movimentar para Pronto: confirma se foi adicionada informação no campo solução!
    if (newStatus === 'ready') {
      const hasSolution = Boolean(currentOrder?.solutionApplied && currentOrder.solutionApplied.trim().length > 0)
      if (!hasSolution) {
        if (currentOrder) {
          setErrorMsg('Para fechar a O.S. é necessário adicionar a solução do problema.')
          setOrderForSolutionModal(currentOrder)
          setSolutionInput('')
          setSolutionError('Para fechar a O.S. é necessário adicionar a solução do problema.')
        }
        return
      }
    }

    // Ao clicar em Encerrar O.S., solicita o motivo do encerramento
    if (newStatus === 'closed') {
      if (currentOrder) {
        setOrderForCloseModal(currentOrder)
        setCloseReasonInput('')
        setCloseReasonError(null)
      }
      return
    }

    const isTransitioningToReady =
      currentOrder && currentOrder.status !== 'ready' && newStatus === 'ready'

    const res = await serviceOrderService.updateStatus(currentOrganization.id, orderId, newStatus)
    if (res.success) {
      await loadOrders()
      handleFilterChange(newStatus)
      if (isTransitioningToReady && currentOrder) {
        setOrderForWhatsApp({ ...currentOrder, status: 'ready' })
      }
    } else {
      setErrorMsg(res.error)
    }
  }

  const handleConfirmSolutionStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrganization || !orderForSolutionModal) return

    const trimmedSolution = solutionInput.trim()
    if (!trimmedSolution) {
      setSolutionError('Para fechar a O.S. é necessário adicionar a solução do problema.')
      return
    }

    setIsSavingSolution(true)
    setSolutionError(null)

    const res = await serviceOrderService.updateStatus(
      currentOrganization.id,
      orderForSolutionModal.id,
      'ready',
      undefined,
      trimmedSolution,
    )

    setIsSavingSolution(false)

    if (res.success) {
      const orderToNotify = {
        ...orderForSolutionModal,
        status: 'ready' as ServiceOrderStatus,
        solutionApplied: trimmedSolution,
      }
      setOrderForSolutionModal(null)
      setSolutionInput('')
      await loadOrders()
      handleFilterChange('ready')
      setOrderForWhatsApp(orderToNotify)
    } else {
      setSolutionError(res.error)
    }
  }

  const handleConfirmPendingStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrganization || !orderForPendingModal) return

    const trimmedReason = pendingReasonInput.trim()
    if (!trimmedReason) {
      setPendingReasonError('Informe o motivo da pendência para encaminhar a O.S.')
      return
    }

    setIsSavingPending(true)
    setPendingReasonError(null)

    const res = await serviceOrderService.updateStatus(
      currentOrganization.id,
      orderForPendingModal.id,
      'pending',
      trimmedReason,
    )

    setIsSavingPending(false)

    if (res.success) {
      setOrderForPendingModal(null)
      setPendingReasonInput('')
      await loadOrders()
      handleFilterChange('pending')
    } else {
      setPendingReasonError(res.error)
    }
  }

  const handleConfirmCloseStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrganization || !orderForCloseModal) return

    const trimmedReason = closeReasonInput.trim()
    if (!trimmedReason) {
      setCloseReasonError('Informe o motivo para encerrar a Ordem de Serviço.')
      return
    }

    setIsSavingClose(true)
    setCloseReasonError(null)

    const res = await serviceOrderService.updateStatus(
      currentOrganization.id,
      orderForCloseModal.id,
      'closed',
      trimmedReason,
    )

    setIsSavingClose(false)

    if (res.success) {
      setOrderForCloseModal(null)
      setCloseReasonInput('')
      await loadOrders()
      handleFilterChange('closed')
    } else {
      setCloseReasonError(res.error)
    }
  }

  const handleDelete = async (): Promise<ServiceResult<void>> => {
    if (!currentOrganization || !orderToDelete) {
      return { success: false, error: 'Ordem de Serviço não identificada.' }
    }
    const res = await serviceOrderService.delete(currentOrganization.id, orderToDelete.id)
    if (res.success) {
      setOrderToDelete(null)
      await loadOrders()
    }
    return res
  }

  const handleOpenPrint = async (orderId: string) => {
    if (!currentOrganization) return
    setErrorMsg(null)
    const res = await serviceOrderService.getById(currentOrganization.id, orderId)
    if (res.success) {
      setOrderToPrint(res.data)
    } else {
      setErrorMsg(res.error)
    }
  }

  const handleViewLinkedSale = async (saleId: string) => {
    if (!currentOrganization) return
    setErrorMsg(null)
    const res = await salesService.getSaleById(currentOrganization.id, saleId)
    if (res.success) {
      setSelectedSaleDetail(res.data)
      setSaleModalOpen(true)
    } else {
      setErrorMsg(res.error || 'Não foi possível carregar os dados da venda vinculada.')
    }
  }

  const metrics = useMemo(() => {
    return {
      total: orders.length,
      queue: orders.filter((o) => o.status === 'queue').length,
      pending: orders.filter((o) => o.status === 'pending').length,
      inMaintenance: orders.filter((o) => o.status === 'in_maintenance').length,
      ready: orders.filter((o) => o.status === 'ready').length,
      closed: orders.filter((o) => o.status === 'closed').length,
    }
  }, [orders])

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('pt-BR')
    return orders
      .filter((o) => {
        const matchStatus = filterStatus === 'all' || o.status === filterStatus
        const matchQuery =
          !q ||
          o.orderNumber.toLocaleLowerCase('pt-BR').includes(q) ||
          o.customerName.toLocaleLowerCase('pt-BR').includes(q) ||
          o.equipmentName.toLocaleLowerCase('pt-BR').includes(q) ||
          (o.serialNumber && o.serialNumber.toLocaleLowerCase('pt-BR').includes(q)) ||
          (o.equipmentBrand && o.equipmentBrand.toLocaleLowerCase('pt-BR').includes(q)) ||
          (o.equipmentModel && o.equipmentModel.toLocaleLowerCase('pt-BR').includes(q))
        return matchStatus && matchQuery
      })
      .sort((a, b) => {
        const pA = STATUS_SORT_ORDER[a.status] ?? 99
        const pB = STATUS_SORT_ORDER[b.status] ?? 99
        if (pA !== pB) return pA - pB
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [orders, filterStatus, searchQuery])

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Ordens de Serviço (O.S.)
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
            Controle de equipamentos, fotos e avarias, diagnóstico, peças, serviços e envio para fechamento de venda
          </p>
        </div>

        {canCreateOrder && (
          <Link to="/service-orders/new">
            <Button
              size="sm"
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
            >
              <Plus className="w-4 h-4" /> Nova Ordem de Serviço
            </Button>
          </Link>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-200 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Cards de Métricas por Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <Card
          onClick={() => handleFilterChange('all')}
          className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/30 dark:to-slate-900 ${
            filterStatus === 'all' ? 'ring-2 ring-indigo-500/50' : ''
          }`}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase">
                Total de O.S.
              </p>
              <p className="text-lg font-extrabold text-indigo-700 dark:text-indigo-300 mt-0.5">
                {metrics.total} registrada(s)
              </p>
            </div>
            <div className="rounded-xl bg-indigo-100 dark:bg-indigo-900/60 p-2 text-indigo-700 dark:text-indigo-300">
              <FileText className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => handleFilterChange('queue')}
          className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-violet-100 dark:border-violet-900/50 bg-gradient-to-br from-violet-50/50 to-white dark:from-violet-950/30 dark:to-slate-900 ${
            filterStatus === 'queue' ? 'ring-2 ring-violet-500/50' : ''
          }`}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase">
                Fila de Atendimento
              </p>
              <p className="text-lg font-extrabold text-violet-700 dark:text-violet-300 mt-0.5">
                {metrics.queue} na fila
              </p>
            </div>
            <div className="rounded-xl bg-violet-100 dark:bg-violet-900/60 p-2 text-violet-700 dark:text-violet-300">
              <Clock className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => handleFilterChange('pending')}
          className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-amber-100 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/30 dark:to-slate-900 ${
            filterStatus === 'pending' ? 'ring-2 ring-amber-500/50' : ''
          }`}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase">
                Pendente
              </p>
              <p className="text-lg font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">
                {metrics.pending} pendente(s)
              </p>
            </div>
            <div className="rounded-xl bg-amber-100 dark:bg-amber-900/60 p-2 text-amber-700 dark:text-amber-300">
              <Clock className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => handleFilterChange('in_maintenance')}
          className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-blue-100 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/30 dark:to-slate-900 ${
            filterStatus === 'in_maintenance' ? 'ring-2 ring-blue-500/50' : ''
          }`}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase">
                Em Manutenção
              </p>
              <p className="text-lg font-extrabold text-blue-700 dark:text-blue-300 mt-0.5">
                {metrics.inMaintenance} em bancada
              </p>
            </div>
            <div className="rounded-xl bg-blue-100 dark:bg-blue-900/60 p-2 text-blue-700 dark:text-blue-300">
              <Wrench className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => handleFilterChange('ready')}
          className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-emerald-100 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/30 dark:to-slate-900 ${
            filterStatus === 'ready' ? 'ring-2 ring-emerald-500/50' : ''
          }`}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase">
                Pronto
              </p>
              <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {metrics.ready} pronto(s)
              </p>
            </div>
            <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/60 p-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => handleFilterChange('closed')}
          className={`cursor-pointer transition-all hover:shadow-md rounded-xl shadow-xs border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-100/60 to-white dark:from-slate-800/40 dark:to-slate-900 ${
            filterStatus === 'closed' ? 'ring-2 ring-slate-500/50' : ''
          }`}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase">
                O.S. Encerrada
              </p>
              <p className="text-lg font-extrabold text-slate-700 dark:text-slate-300 mt-0.5">
                {metrics.closed} encerrada(s)
              </p>
            </div>
            <div className="rounded-xl bg-slate-200 dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-300">
              <ClipboardCheck className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <div className="sticky top-0 z-20 -mx-4 space-y-3 border-b border-gray-200 dark:border-slate-800 bg-gray-50/95 dark:bg-[#0f172a]/95 px-4 py-3 shadow-xs backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {STATUS_TABS.map((st) => {
              const label = st === 'all' ? 'Todas' : SERVICE_ORDER_STATUS_LABELS[st]
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => handleFilterChange(st)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    filterStatus === st
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nº O.S., cliente, equipamento, série..."
              className="h-9 w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 text-xs text-gray-700 dark:text-slate-200 placeholder:text-gray-400 focus:border-blue-500 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Ordens de Serviço */}
      <Card className="w-full">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-gray-500 dark:text-slate-400">
              Carregando Ordens de Serviço...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500 dark:text-slate-400">
              <Wrench className="w-8 h-8 mx-auto text-gray-300 dark:text-slate-600 mb-2" />
              Nenhuma Ordem de Serviço encontrada com o filtro selecionado.{' '}
              {canCreateOrder && (
                <Link
                  to="/service-orders/new"
                  className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                >
                  Abrir nova O.S.
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1160px] text-left text-sm text-gray-600 dark:text-slate-300">
                <thead className="bg-gray-50/75 dark:bg-slate-800/60 text-xs uppercase text-gray-400 dark:text-slate-400 font-semibold border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-3">Nº O.S.</th>
                    <th className="px-3 py-3">Cliente</th>
                    <th className="px-3 py-3">Técnico</th>
                    <th className="px-3 py-3">Equipamento / Avarias</th>
                    <th className="px-3 py-3">Problema &amp; Solução</th>
                    <th className="px-3 py-3 text-right">Total</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {filteredOrders.map((o) => (
                    <tr
                      key={o.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Número O.S. */}
                      <td className="px-3 py-3 align-top">
                        <div className="font-bold text-gray-900 dark:text-white">
                          {o.orderNumber}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-slate-400">
                          {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                        <span
                          className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${SERVICE_ORDER_PRIORITY_BADGE_CLASSES[o.priority]}`}
                        >
                          Prioridade: {SERVICE_ORDER_PRIORITY_LABELS[o.priority]}
                        </span>
                        {o.saleId && (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => void handleViewLinkedSale(o.saleId!)}
                              className="inline-flex items-center gap-1 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 cursor-pointer"
                            >
                              <ShoppingCart className="w-3 h-3" />
                              {o.saleNumber || 'Ver Venda'}
                            </button>
                          </div>
                        )}
                      </td>

                                            {/* Cliente */}
                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {o.customerName}
                        </div>
                        {o.customerPhone && (
                          <div className="text-xs text-gray-500 dark:text-slate-400">
                            {o.customerPhone}
                          </div>
                        )}
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 text-[11px] font-bold text-blue-800 dark:text-blue-300">
                            <Wrench className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
                            <span>{o.technicianName ? `Téc: ${o.technicianName}` : 'Sem técnico atribuído'}</span>
                          </span>
                        </div>
                      </td>

                      {/* Técnico Responsável */}
                      <td className="px-3 py-3 align-top whitespace-nowrap">
                        {o.technicianName ? (
                          <div className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 px-2.5 py-1 text-xs font-bold text-blue-800 dark:text-blue-300 shadow-2xs">
                            <Wrench className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                            <span>{o.technicianName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-slate-500 italic">
                            Não informado
                          </span>
                        )}
                      </td>

                      {/* Equipamento / Fotos / Avarias */}
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-start gap-2.5">
                          {o.firstPhotoUrl && (
                            <img
                              src={o.firstPhotoUrl}
                              alt={o.equipmentName}
                              className="h-10 w-10 rounded-lg object-cover border border-gray-200 shrink-0"
                            />
                          )}
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {o.equipmentName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-slate-400">
                              {[o.equipmentBrand, o.equipmentModel, o.serialNumber && `S/N: ${o.serialNumber}`]
                                .filter(Boolean)
                                .join(' • ') || 'Sem marca/modelo'}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {o.photosCount > 0 && (
                                <span className="inline-flex items-center gap-1 rounded bg-sky-50 dark:bg-sky-950/50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                                  <Camera className="h-3 w-3" />
                                  {o.photosCount} foto(s)
                                </span>
                              )}
                              {o.hasDamage && (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                                  <AlertTriangle className="h-3 w-3" />
                                  Com avarias
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Problema & Solução */}
                      <td className="px-3 py-3 align-top max-w-xs">
                        <div className="text-xs text-gray-800 dark:text-slate-200 line-clamp-2">
                          <span className="font-bold text-rose-600 dark:text-rose-400">Problema: </span>
                          {o.reportedProblem}
                        </div>
                        {o.status === 'pending' && o.pendingReason && (
                          <div className="mt-1 rounded-md border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/50 px-2 py-1 text-xs text-amber-800 dark:text-amber-300">
                            <span className="font-bold">Pendência: </span>
                            {o.pendingReason}
                          </div>
                        )}
                        {o.status === 'closed' && !o.saleId && o.pendingReason && (
                          <div className="mt-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/70 px-2 py-1 text-xs text-slate-700 dark:text-slate-300">
                            <span className="font-bold">Motivo do Encerramento: </span>
                            {o.pendingReason}
                          </div>
                        )}
                        {o.solutionApplied && (
                          <div className="text-xs text-gray-600 dark:text-slate-400 mt-1 line-clamp-2">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">Solução: </span>
                            {o.solutionApplied}
                          </div>
                        )}
                      </td>

                      {/* Valores */}
                      <td className="px-3 py-3 align-top text-right whitespace-nowrap">
                        <div className="font-bold text-gray-900 dark:text-white">
                          {formatCurrency(o.total)}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          Peças: {formatCurrency(o.productsSubtotal)} • Serv.:{' '}
                          {formatCurrency(o.servicesSubtotal)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-semibold border ${SERVICE_ORDER_STATUS_BADGE_CLASSES[o.status]}`}
                        >
                          {SERVICE_ORDER_STATUS_LABELS[o.status]}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-3 py-3 align-top text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {!o.saleId && o.status !== 'closed' && (
                            <div className="w-40 text-left">
                              <ListBox
                                placeholder="Mudar status..."
                                searchable={false}
                                value=""
                                onChange={(val) => {
                                  if (val) {
                                    void handleStatusChange(o.id, val as ServiceOrderStatus)
                                  }
                                }}
                                options={
                                  o.status === 'queue'
                                    ? [
                                        {
                                          value: 'in_maintenance',
                                          label: `→ ${SERVICE_ORDER_STATUS_LABELS.in_maintenance}`,
                                        },
                                        {
                                          value: 'pending',
                                          label: `→ ${SERVICE_ORDER_STATUS_LABELS.pending}`,
                                        },
                                      ]
                                    : o.status === 'in_maintenance'
                                      ? [
                                          {
                                            value: 'ready',
                                            label: `→ ${SERVICE_ORDER_STATUS_LABELS.ready}`,
                                          },
                                          {
                                            value: 'pending',
                                            label: `→ ${SERVICE_ORDER_STATUS_LABELS.pending}`,
                                          },
                                        ]
                                      : o.status === 'pending'
                                        ? [
                                            {
                                              value: 'in_maintenance',
                                              label: '→ Voltar para Manutenção',
                                            },
                                          ]
                                        : [
                                            {
                                              value: 'in_maintenance',
                                              label: '→ Voltar para Manutenção',
                                            },
                                          ]
                                }
                              />
                            </div>
                          )}

                          {o.status === 'ready' && (
                            <button
                              type="button"
                              onClick={() => setOrderForWhatsApp(o)}
                              className="inline-flex items-center rounded p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                              title="Enviar aviso no WhatsApp informando que o equipamento está pronto"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          )}

                          {!o.saleId && o.status === 'ready' && (
                            <Link
                              to={`/orcafacil/sales/new?serviceOrderId=${o.id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
                              title="Enviar esta Ordem de Serviço com peças e serviços para o fechamento de venda"
                            >
                              <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                              Fechar Venda
                            </Link>
                          )}

                          <Link
                            to={`/service-orders/${o.id}/edit`}
                            className="inline-flex items-center rounded p-1.5 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                            title="Editar Ordem de Serviço"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>

                          <button
                            type="button"
                            onClick={() => void handleOpenPrint(o.id)}
                            className="inline-flex items-center rounded p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                            title="Visualizar e Imprimir O.S."
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setOrderToDelete(o)}
                            className="inline-flex items-center rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Excluir O.S."
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={orderToDelete !== null}
        title="Excluir Ordem de Serviço?"
        description={`Tem certeza de que deseja excluir a O.S. ${orderToDelete?.orderNumber || ''}?`}
        confirmLabel="Sim, excluir"
        onCancel={() => setOrderToDelete(null)}
        onConfirm={handleDelete}
      />

      <ServiceOrderPrintModal
        open={orderToPrint !== null}
        order={orderToPrint}
        organizationName={currentOrganization?.name}
        onClose={() => setOrderToPrint(null)}
      />

      <SendServiceOrderWhatsAppModal
        open={orderForWhatsApp !== null}
        order={orderForWhatsApp}
        organizationName={currentOrganization?.name}
        onClose={() => setOrderForWhatsApp(null)}
      />

      {/* Modal para Informar o Motivo da Pendência ao Encaminhar para Pendente */}
      {orderForPendingModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setOrderForPendingModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-gray-100 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/60 p-2 text-amber-600 dark:text-amber-400">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Encaminhar para Pendente
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    O.S. {orderForPendingModal.orderNumber} • {orderForPendingModal.equipmentName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderForPendingModal(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPendingStatus} className="mt-4 space-y-4">
              {pendingReasonError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{pendingReasonError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Motivo da Pendência <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  autoFocus
                  required
                  value={pendingReasonInput}
                  onChange={(e) => setPendingReasonInput(e.target.value)}
                  placeholder="Ex.: Aguardando chegada da peça (tela / placa), aguardando aprovação do cliente..."
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-gray-900 dark:text-white focus:border-amber-500 focus:outline-hidden"
                />
                <span className="mt-1 block text-[11px] text-gray-500 dark:text-slate-400">
                  Esta informação ficará visível em Problema &amp; Solução enquanto a O.S. estiver pendente.
                </span>
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOrderForPendingModal(null)}
                  className="flex-1 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingPending}
                  className="flex-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                >
                  {isSavingPending ? 'Encaminhando...' : 'Confirmar e Encaminhar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {orderForSolutionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setOrderForSolutionModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-gray-100 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Solução do Problema Necessária
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    O.S. {orderForSolutionModal.orderNumber} • {orderForSolutionModal.equipmentName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderForSolutionModal(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-xs font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>Para fechar a O.S. é necessário adicionar a solução do problema.</span>
            </div>

            <form onSubmit={handleConfirmSolutionStatus} className="mt-4 space-y-4">
              {solutionError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{solutionError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Solução Aplicada / Serviço Realizado <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  autoFocus
                  required
                  value={solutionInput}
                  onChange={(e) => setSolutionInput(e.target.value)}
                  placeholder="Descreva o reparo realizado, peças trocadas e a solução aplicada..."
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOrderForSolutionModal(null)}
                  className="flex-1 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingSolution}
                  className="flex-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  {isSavingSolution ? 'Salvando...' : 'Salvar Solução e Marcar Pronto'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {orderForCloseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setOrderForCloseModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-gray-100 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-300">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Encerrar Ordem de Serviço
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    O.S. {orderForCloseModal.orderNumber} • {orderForCloseModal.equipmentName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderForCloseModal(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCloseStatus} className="mt-4 space-y-4">
              {closeReasonError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{closeReasonError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Motivo do Encerramento da O.S. <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  autoFocus
                  required
                  value={closeReasonInput}
                  onChange={(e) => setCloseReasonInput(e.target.value)}
                  placeholder="Informe o motivo para encerrar esta O.S. (ex.: cliente não aprovou o orçamento, equipamento sem reparo...)"
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-gray-900 dark:text-white focus:border-slate-500 focus:outline-hidden"
                />
                <span className="mt-1 block text-[11px] text-gray-500 dark:text-slate-400">
                  Esta informação ficará registrada na Ordem de Serviço encerrada.
                </span>
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOrderForCloseModal(null)}
                  className="flex-1 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingClose}
                  className="flex-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold"
                >
                  {isSavingClose ? 'Encerrando...' : 'Confirmar e Encerrar O.S.'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {saleModalOpen && selectedSaleDetail && (
        <SaleReceiptModal
          open={saleModalOpen}
          sale={selectedSaleDetail}
          onClose={() => {
            setSaleModalOpen(false)
            setSelectedSaleDetail(null)
          }}
        />
      )}
    </div>
  )
}
