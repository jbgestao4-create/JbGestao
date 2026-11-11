import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { customerService, type Customer } from '@modules/customers/services/customer.service'
import { inventoryService } from '@modules/inventory/services/inventory.service'
import { quoteService, type QuoteDetail } from '@modules/orcafacil/services/quote.service'
import type { InventoryItem } from '@shared/types/common'
import { Card, CardContent, CardHeader } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { ListBox } from '@shared/components/ui/ListBox'
import {
  calculateItemTotal,
  calculateSubtotal,
  calculateTotal,
  formatCurrency,
} from '@shared/utils/monetary'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  Package,
  Plus,
  QrCode,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  User,
  Wrench,
  Zap,
} from 'lucide-react'
import { appointmentService } from '@modules/agendapro/services/appointment.service'
import { ForwardToScheduleCard } from '@modules/agendapro/components/ForwardToScheduleCard'
import {
  salesService,
  type PaymentMethod,
  type SaleDetail,
  PAYMENT_METHOD_LABELS,
} from '../services/sales.service'
import { SaleReceiptModal } from '../components/SaleReceiptModal'
import { serviceService, type ServiceListItem } from '@modules/services/services/service.service'
import { serviceOrderService } from '@modules/service-orders/services/service-order.service'
import type { ServiceOrderDetail } from '@modules/service-orders/domain/service-order'
import { cashSessionService } from '@modules/cash/services/cash-session.service'

interface CartItem {
  id: string
  itemType?: 'product' | 'service'
  inventoryItemId?: string
  serviceId?: string
  description: string
  unit: string
  quantity: string
  unitPrice: string
  total: string
  availableStock?: string
  sku?: string
}

export function SaleFormPage() {
  const { user, profile } = useAuth()
  const { currentOrganization } = useOrganization()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const quoteId = searchParams.get('quoteId')
  const serviceOrderId = searchParams.get('serviceOrderId')

  const sellerName = profile?.displayName || user?.email?.split('@')[0] || 'Vendedor'

  const [originQuote, setOriginQuote] = useState<QuoteDetail | null>(null)
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)

  const [originServiceOrder, setOriginServiceOrder] = useState<ServiceOrderDetail | null>(null)
  const [isLoadingServiceOrder, setIsLoadingServiceOrder] = useState(false)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [availableServices, setAvailableServices] = useState<ServiceListItem[]>([])

  // Cliente
  const [isConsumidorFinal, setIsConsumidorFinal] = useState(true)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [customerName, setCustomerName] = useState('Consumidor Final')
  const [customerDocument, setCustomerDocument] = useState('')

  // Itens da venda
  const [cart, setCart] = useState<CartItem[]>([])

  // Tipo de item a adicionar: produto ou serviço
  const [itemTypeToAdd, setItemTypeToAdd] = useState<'product' | 'service'>('product')

  // Busca e seleção rápida de produto ou serviço
  const [productQuery, setProductQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null)
  const [selectedService, setSelectedService] = useState<ServiceListItem | null>(null)
  const [itemQuantity, setItemQuantity] = useState('1')
  const [itemUnitPrice, setItemUnitPrice] = useState('')

  // Pagamento e Totais
  const [discount, setDiscount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('money')
  const [emitFiscalNow, setEmitFiscalNow] = useState(false)
  const [notes, setNotes] = useState('')

  // Somente exibe "Emitir NFC-e imediatamente" se a organização estiver com o plano
  // "Completo com emissão de NF-e e NFC-e" (ID '00000000-0000-4000-8000-000000000004')
  const FULL_FISCAL_ACCESS_PLAN_ID = '00000000-0000-4000-8000-000000000004'
  const hasFullFiscalAccessPlan =
    currentOrganization?.accessPlanId === FULL_FISCAL_ACCESS_PLAN_ID ||
    Boolean(
      currentOrganization?.accessPlanName &&
        currentOrganization.accessPlanName.toLowerCase().includes('completo') &&
        currentOrganization.accessPlanName.toLowerCase().includes('emiss'),
    )

  // Agendamento / Encaminhar para agenda
  const [forwardToSchedule, setForwardToSchedule] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [scheduleAssignedTo, setScheduleAssignedTo] = useState('')
  const [scheduleNotes, setScheduleNotes] = useState('')

  // Estado de envio e resultado
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedSale, setCompletedSale] = useState<SaleDetail | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [hasOpenCashSession, setHasOpenCashSession] = useState<boolean | null>(null)

  const checkCashStatus = async () => {
    if (!currentOrganization) return false
    try {
      const [mgmtRes, pdvSession] = await Promise.all([
        cashSessionService.getOpenCashManagementSession(currentOrganization.id),
        cashSessionService.findBestOpenSession(currentOrganization.id, user?.id, 'pdv'),
      ])
      const isOpen = (mgmtRes.success && !!mgmtRes.data) || !!pdvSession
      setHasOpenCashSession(isOpen)
      return isOpen
    } catch {
      return false
    }
  }

  useEffect(() => {
    if (!currentOrganization) return

    let active = true

    void checkCashStatus()

    void Promise.all([
      customerService.list(currentOrganization.id),
      inventoryService.list(currentOrganization.id),
      serviceService.listServices(currentOrganization.id, { status: 'active', pageSize: 100 }),
    ]).then(([custRes, invRes, svcRes]) => {
      if (!active) return
      if (custRes.success) setCustomers(custRes.data)
      if (svcRes.success) setAvailableServices(svcRes.data.items)
      if (invRes.success) {
        setInventoryItems(
          invRes.data.filter(
            (i: InventoryItem) =>
              i.isActive &&
              i.canSell &&
              i.registrationStatus !== 'awaiting_information' &&
              Number(i.quantityOnHand) > 0,
          ),
        )
      }
    })

    return () => {
      active = false
    }
  }, [currentOrganization])

  // Carrega os dados do orçamento quando iniciado a partir de "Enviar para Venda"
  useEffect(() => {
    if (!currentOrganization || !quoteId) return

    let isCurrent = true
    setIsLoadingQuote(true)

    void quoteService.getQuote(currentOrganization.id, quoteId).then((res) => {
      if (!isCurrent) return
      setIsLoadingQuote(false)

      if (res.success) {
        const q = res.data
        setOriginQuote(q)

        // Preenche cliente do orçamento
        if (q.customerId) {
          setIsConsumidorFinal(false)
          setSelectedCustomerId(q.customerId)
          setCustomerName(q.customerName || 'Cliente')
          setCustomerDocument('')
        } else if (q.customerName && q.customerName !== 'Consumidor Final') {
          setIsConsumidorFinal(false)
          setSelectedCustomerId('')
          setCustomerName(q.customerName)
          setCustomerDocument('')
        } else {
          setIsConsumidorFinal(true)
          setCustomerName('Consumidor Final')
        }

        // Preenche desconto e observações
        if (q.discount && Number(q.discount) > 0) {
          setDiscount(String(q.discount))
        }
        if (q.notes) {
          setNotes(q.notes)
        }

        // Preenche itens do orçamento no carrinho
        if (q.items && q.items.length > 0) {
          setCart(
            q.items.map((it) => ({
              id: it.id || `quote-item-${Date.now()}-${Math.random().toString().slice(2, 6)}`,
              itemType: it.itemType || (it.serviceId ? 'service' : 'product'),
              inventoryItemId: it.inventoryItemId ?? undefined,
              serviceId: it.serviceId ?? undefined,
              description: it.description,
              unit: it.unit || 'UN',
              quantity: String(it.quantity),
              unitPrice: String(it.unitPrice),
              total: String(it.total),
            })),
          )
        }
      } else {
        setError(`Não foi possível carregar os dados do orçamento: ${res.error}`)
      }
    })

    return () => {
      isCurrent = false
    }
  }, [currentOrganization, quoteId])

  // Carrega os dados da Ordem de Serviço quando iniciado a partir de "Enviar para Fechamento de Venda"
  useEffect(() => {
    if (!currentOrganization || !serviceOrderId) return

    let isCurrent = true
    setIsLoadingServiceOrder(true)

    void serviceOrderService.getById(currentOrganization.id, serviceOrderId).then((res) => {
      if (!isCurrent) return
      setIsLoadingServiceOrder(false)

      if (res.success) {
        const os = res.data
        setOriginServiceOrder(os)

        // Preenche cliente da O.S.
        if (os.customerId) {
          setIsConsumidorFinal(false)
          setSelectedCustomerId(os.customerId)
          setCustomerName(os.customerName || 'Cliente')
          setCustomerDocument(os.customerDocument || '')
        } else if (os.customerName && os.customerName !== 'Consumidor Final') {
          setIsConsumidorFinal(false)
          setSelectedCustomerId('')
          setCustomerName(os.customerName)
          setCustomerDocument(os.customerDocument || '')
        } else {
          setIsConsumidorFinal(true)
          setCustomerName('Consumidor Final')
        }

        // Preenche desconto e observações
        if (os.discount && Number(os.discount) > 0) {
          setDiscount(String(os.discount))
        }
        const osNotePrefix = `Referente à Ordem de Serviço ${os.orderNumber} (${os.equipmentName}${os.equipmentBrand ? ` - ${os.equipmentBrand}` : ''}${os.equipmentModel ? ` ${os.equipmentModel}` : ''})`
        setNotes(os.solutionApplied ? `${osNotePrefix} • Solução: ${os.solutionApplied}` : osNotePrefix)

        // Preenche produtos e serviços da O.S. no carrinho
        if (os.items && os.items.length > 0) {
          setCart(
            os.items.map((it: any) => ({
              id: it.id || `os-item-${Date.now()}-${Math.random().toString().slice(2, 6)}`,
              itemType: it.itemType,
              inventoryItemId: it.inventoryItemId ?? undefined,
              serviceId: it.serviceId ?? undefined,
              description: it.description,
              unit: it.unit || 'UN',
              quantity: String(it.quantity),
              unitPrice: String(it.unitPrice),
              total: String(it.total),
            })),
          )
        }
      } else {
        setError(`Não foi possível carregar os dados da Ordem de Serviço: ${res.error}`)
      }
    })

    return () => {
      isCurrent = false
    }
  }, [currentOrganization, serviceOrderId])

  // Produtos filtrados pelo campo de busca (apenas produtos com estoque positivo)
  const filteredProducts = useMemo(() => {
    if (itemTypeToAdd !== 'product') return []
    const q = productQuery.trim().toLowerCase()
    if (!q) return []
    return inventoryItems
      .filter((i) => {
        if (!i.canSell || i.registrationStatus === 'awaiting_information') return false
        if (Number(i.quantityOnHand) <= 0) return false
        const matchName = i.name.toLowerCase().includes(q)
        const matchSku = i.sku.toLowerCase().includes(q)
        const matchBarcode = i.barcode?.toLowerCase().includes(q) || false
        return matchName || matchSku || matchBarcode
      })
      .slice(0, 8)
  }, [productQuery, inventoryItems, itemTypeToAdd])

  // Serviços filtrados pelo campo de busca
  const filteredServices = useMemo(() => {
    if (itemTypeToAdd !== 'service') return []
    const q = productQuery.trim().toLowerCase()
    if (!q) return []
    return availableServices
      .filter((s) => {
        if (!s.isActive) return false
        const matchName = s.name.toLowerCase().includes(q)
        const matchCode = s.serviceCode.toLowerCase().includes(q)
        return matchName || matchCode
      })
      .slice(0, 8)
  }, [productQuery, availableServices, itemTypeToAdd])

  const handleSelectProduct = (product: InventoryItem) => {
    if (!product.canSell || product.registrationStatus === 'awaiting_information') {
      setError(
        `O produto "${product.name}" está com status "Aguardando informação" e não pode ser utilizado em vendas até ser concluído no estoque.`,
      )
      return
    }
    if (Number(product.quantityOnHand) <= 0) {
      setError(`O produto "${product.name}" está sem estoque e não pode ser adicionado.`)
      return
    }
    setSelectedProduct(product)
    setSelectedService(null)
    setProductQuery(product.name)
    const salePrice = Number(product.unitPrice) > 0 ? Number(product.unitPrice).toFixed(2) : ''
    setItemUnitPrice(salePrice)
  }

  const handleSelectService = (srv: ServiceListItem) => {
    setSelectedService(srv)
    setSelectedProduct(null)
    setProductQuery(srv.name)
    const salePrice = Number(srv.salePrice) > 0 ? Number(srv.salePrice).toFixed(2) : ''
    setItemUnitPrice(salePrice)
  }

  const handleAddToCart = () => {
    if (itemTypeToAdd === 'service') {
      if (!selectedService && !productQuery.trim()) {
        setError('Selecione um serviço cadastrado ou informe a descrição.')
        return
      }

      const description = selectedService?.name || productQuery.trim()
      const unit = selectedService?.billingUnit || 'UN'
      const qty = Number(itemQuantity)

      if (!Number.isFinite(qty) || qty <= 0) {
        setError('Informe uma quantidade maior que zero.')
        return
      }

      const price = Number(itemUnitPrice)
      if (!Number.isFinite(price) || price < 0) {
        setError('Informe um valor unitário válido.')
        return
      }

      if (selectedService && Number(selectedService.minimumSalePrice) > 0) {
        if (price < Number(selectedService.minimumSalePrice)) {
          setError(
            `O valor de venda do serviço não pode ser menor que o preço mínimo cadastrado (${formatCurrency(selectedService.minimumSalePrice)}).`,
          )
          return
        }
      }

      const total = calculateItemTotal(itemQuantity, itemUnitPrice)
      const newItem: CartItem = {
        id: crypto.randomUUID(),
        itemType: 'service',
        serviceId: selectedService?.id,
        description,
        unit,
        quantity: itemQuantity,
        unitPrice: itemUnitPrice,
        total,
        sku: selectedService?.serviceCode,
      }
      setCart([...cart, newItem])
      setSelectedService(null)
      setProductQuery('')
      setItemQuantity('1')
      setItemUnitPrice('')
      setError(null)
      return
    }

    // Se for Produto de Estoque
    if (!selectedProduct && !productQuery.trim()) {
      setError('Selecione um produto do estoque ou informe a descrição.')
      return
    }

    if (selectedProduct && (!selectedProduct.canSell || selectedProduct.registrationStatus === 'awaiting_information')) {
      setError(
        `O material "${selectedProduct.name}" está com status "Aguardando informação" e não pode ser utilizado em vendas até que o cadastro esteja concluído no estoque.`,
      )
      return
    }

    const description = selectedProduct?.name || productQuery.trim()
    const unit = selectedProduct?.unit || 'UN'
    const qty = Number(itemQuantity)

    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Informe uma quantidade maior que zero.')
      return
    }

    const price = Number(itemUnitPrice)
    if (!Number.isFinite(price) || price < 0) {
      setError('Informe um valor unitário válido.')
      return
    }

    if (selectedProduct) {
      const available = Number(selectedProduct.quantityOnHand ?? 0)
      const existingInCart = cart.find((c) => c.inventoryItemId === selectedProduct.id)
      const currentQtyInCart = existingInCart ? Number(existingInCart.quantity) : 0
      if (available < currentQtyInCart + qty) {
        setError(
          `Estoque insuficiente para "${selectedProduct.name}". Saldo disponível: ${selectedProduct.quantityOnHand} ${selectedProduct.unit} (solicitado: ${currentQtyInCart + qty}).`,
        )
        return
      }
    }

    // Se o item já estiver no carrinho, soma a quantidade
    const existingIndex = cart.findIndex(
      (c) =>
        (selectedProduct && c.inventoryItemId === selectedProduct.id) ||
        (!selectedProduct && c.description.toLowerCase() === description.toLowerCase()),
    )

    if (existingIndex >= 0) {
      const current = cart[existingIndex]
      const newQty = (Number(current.quantity) + qty).toString()
      const newTotal = calculateItemTotal(newQty, current.unitPrice)
      const updated = [...cart]
      updated[existingIndex] = { ...current, quantity: newQty, total: newTotal }
      setCart(updated)
    } else {
      const total = calculateItemTotal(itemQuantity, itemUnitPrice)
      const newItem: CartItem = {
        id: crypto.randomUUID(),
        itemType: 'product',
        inventoryItemId: selectedProduct?.id,
        description,
        unit,
        quantity: itemQuantity,
        unitPrice: itemUnitPrice,
        total,
        availableStock: selectedProduct?.quantityOnHand,
        sku: selectedProduct?.sku,
      }
      setCart([...cart, newItem])
    }

    // Limpa campos de inserção
    setSelectedProduct(null)
    setProductQuery('')
    setItemQuantity('1')
    setItemUnitPrice('')
    setError(null)
  }

  const handleRemoveItem = (id: string) => {
    setCart(cart.filter((c) => c.id !== id))
  }

  const handleUpdateItemQuantity = (id: string, newQtyStr: string) => {
    const qty = Number(newQtyStr)
    if (!Number.isFinite(qty) || qty <= 0) return
    setCart(
      cart.map((it) => {
        if (it.id === id) {
          return {
            ...it,
            quantity: newQtyStr,
            total: calculateItemTotal(newQtyStr, it.unitPrice),
          }
        }
        return it
      }),
    )
  }

  // Cálculos de totais
  const productsSubtotal = useMemo(
    () =>
      calculateSubtotal(
        cart.filter((c) => c.itemType !== 'service').map((c) => c.total),
      ),
    [cart],
  )
  const servicesSubtotal = useMemo(
    () =>
      calculateSubtotal(
        cart.filter((c) => c.itemType === 'service').map((c) => c.total),
      ),
    [cart],
  )
  const subtotal = useMemo(() => calculateSubtotal(cart.map((c) => c.total)), [cart])
  const total = useMemo(() => calculateTotal(subtotal, discount || '0.00'), [subtotal, discount])

  const handleFinalizeSale = async () => {
    if (!currentOrganization) return

    if (cart.length === 0) {
      setError('Adicione pelo menos um item ao carrinho antes de finalizar.')
      return
    }

    if (forwardToSchedule && !scheduleDate) {
      setError('Informe o dia do agendamento para atribuição.')
      return
    }

    const isCashOpen = await checkCashStatus()
    if (!isCashOpen) {
      setError('Não é possível realizar uma venda com o caixa fechado. Por favor, abra o Caixa Geral ou o terminal PDV antes de continuar.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const params = {
      customerId: isConsumidorFinal ? undefined : selectedCustomerId || undefined,
      customerName: isConsumidorFinal ? 'Consumidor Final' : customerName,
      customerDocument: isConsumidorFinal ? undefined : customerDocument,
      items: cart.map((it) => ({
        inventoryItemId: it.itemType === 'service' ? undefined : it.inventoryItemId,
        serviceId: it.serviceId,
        itemType: it.itemType || (it.serviceId ? 'service' : 'product'),
        description: it.description,
        unit: it.unit,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
      discount: discount || '0.00',
      paymentMethod,
      notes,
      isPdv: false,
      emitFiscalNow: hasFullFiscalAccessPlan ? emitFiscalNow : false,
      fiscalType: 'nfce' as const,
      operatorId: user?.id,
      operatorName: sellerName,
      sellerName,
      originQuoteId: originQuote?.id,
      originQuoteNumber: originQuote?.quoteNumber,
      originQuoteCreatorName: originQuote?.creatorName || undefined,
      originServiceOrderId: originServiceOrder?.id,
      originServiceOrderNumber: originServiceOrder?.orderNumber,
    }

    const res = await salesService.createSale(currentOrganization.id, params)
    setIsSubmitting(false)

    if (res.success) {
      if (originQuote?.id) {
        // Atualiza status do orçamento de 'approved' para 'completed' (concluído)
        void quoteService.updateStatus(currentOrganization.id, originQuote.id, 'completed')
      }
      // Carrega os detalhes para o recibo
      const detailRes = await salesService.getSaleById(currentOrganization.id, res.data.saleId)

      if (forwardToSchedule) {
        const foundCust = customers.find((c) => c.id === selectedCustomerId)
        await appointmentService.create(currentOrganization.id, {
          title: `Entrega / Venda #${detailRes.success ? detailRes.data.saleNumber : res.data.saleId.slice(0, 8)} - ${customerName}`,
          appointmentDate: scheduleDate,
          startTime: scheduleTime,
          customerId: selectedCustomerId || undefined,
          customerName,
          customerPhone: foundCust?.phone || undefined,
          type: 'sale',
          referenceType: 'sale',
          referenceId: res.data.saleId,
          description: scheduleNotes || notes || 'Entrega/Instalação agendada na venda',
          assignedTo: scheduleAssignedTo || sellerName,
          creatorName: sellerName,
          createdBy: user?.id,
        })
      }
      if (originServiceOrder?.id) {
        // Marca a Ordem de Serviço como 'closed' (O.S. Encerrada) vinculada à venda
        void serviceOrderService.markClosedWithSale(
          currentOrganization.id,
          originServiceOrder.id,
          res.data.saleId,
          detailRes.success ? detailRes.data.saleNumber : undefined,
        )
      }
      if (detailRes.success) {
        setCompletedSale(detailRes.data)
        setShowReceipt(true)
      } else {
        void navigate('/orcafacil/sales/search')
      }
    } else {
      setError(res.error)
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
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Frente de Caixa
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Emissão ágil de venda com baixa de estoque e faturamento no caixa.
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Zap className="h-3.5 w-3.5" />
              PDV Conectado ao Estoque
            </span>
          </div>
        </div>
      </div>

      {/* Alerta de Caixa Fechado */}
      {hasOpenCashSession === false && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 text-amber-900 dark:text-amber-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">Caixa Fechado</p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                É obrigatório que o Caixa Geral ou o terminal PDV esteja aberto para realizar uma nova venda e baixar estoque.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/cash')}
            className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
          >
            Abrir Caixa Agora →
          </Button>
        </div>
      )}

      {isLoadingQuote && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 p-4 text-xs font-medium text-blue-700 dark:text-blue-300 animate-pulse">
          Carregando informações do orçamento selecionado...
        </div>
      )}

      {isLoadingServiceOrder && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 dark:bg-sky-950/30 p-4 text-xs font-medium text-sky-700 dark:text-sky-300 animate-pulse">
          Carregando informações da Ordem de Serviço selecionada...
        </div>
      )}

      {originServiceOrder && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 p-4 text-sky-900 dark:text-sky-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white shadow-xs">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">
                Fechamento de Venda da Ordem de Serviço:{' '}
                <span className="font-mono text-sky-700 dark:text-sky-300">
                  {originServiceOrder.orderNumber}
                </span>
              </p>
              <p className="text-xs text-sky-700 dark:text-sky-400">
                Cliente: {originServiceOrder.customerName || 'Consumidor Final'} • Equipamento:{' '}
                <strong>{originServiceOrder.equipmentName}</strong> • Peças, serviços e valores preenchidos automaticamente.
              </p>
            </div>
          </div>
          <Link
            to={`/service-orders/${originServiceOrder.id}/edit`}
            className="rounded-md border border-sky-300 dark:border-sky-700 bg-white/80 dark:bg-sky-900/60 px-2.5 py-1 text-xs font-semibold text-sky-800 dark:text-sky-300 hover:bg-white transition"
          >
            Ver O.S. → Ao finalizar, a O.S. será Encerrada
          </Link>
        </div>
      )}

      {originQuote && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-emerald-900 dark:text-emerald-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">
                Faturamento de Orçamento:{' '}
                <span className="font-mono text-emerald-700 dark:text-emerald-300">
                  {originQuote.quoteNumber}
                </span>
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Cliente: {originQuote.customerName || 'Consumidor Final'} • Itens, quantidades e valores preenchidos automaticamente.
              </p>
            </div>
          </div>
          <span className="rounded-md border border-emerald-300 dark:border-emerald-700 bg-white/70 dark:bg-emerald-900/60 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            Orçamento Aprovado → Concluir Venda
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-medium">
          {error}
        </div>
      )}

      {/* Grid Principal: Lado Esquerdo (Itens e Produtos) / Lado Direito (Checkout e Totais) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LADO ESQUERDO: SELEÇÃO DE CLIENTE & PRODUTOS */}
        <div className="space-y-6 lg:col-span-2">
          {/* Card: Identificação do Cliente */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <User className="h-4 w-4 text-blue-600" />
                  <span>Identificação do Cliente</span>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      setIsConsumidorFinal(true)
                      setCustomerName('Consumidor Final')
                      setCustomerDocument('')
                    }}
                    className={`rounded-md px-2.5 py-1 transition ${
                      isConsumidorFinal ? 'bg-white text-gray-900 shadow-xs font-semibold' : 'text-gray-600'
                    }`}
                  >
                    Consumidor Final
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConsumidorFinal(false)}
                    className={`rounded-md px-2.5 py-1 transition ${
                      !isConsumidorFinal ? 'bg-white text-gray-900 shadow-xs font-semibold' : 'text-gray-600'
                    }`}
                  >
                    Cliente Cadastrado
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {isConsumidorFinal ? (
                <div className="flex items-center justify-between text-xs text-gray-600 bg-gray-50/70 p-3 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Venda balcão rápida para <strong>Consumidor Final</strong> (sem necessidade de cadastro).</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <ListBox
                    label="Selecionar Cliente Cadastrado"
                    placeholder="Busque cliente por nome ou documento..."
                    searchable
                    value={selectedCustomerId}
                    onChange={(val) => {
                      const id = val as string
                      setSelectedCustomerId(id)
                      const found = customers.find((c) => c.id === id)
                      if (found) {
                        setCustomerName(found.name)
                        setCustomerDocument(found.document || '')
                      }
                    }}
                    options={customers.map((c) => ({
                      value: c.id,
                      label: c.name,
                      description: c.document ? `Doc: ${c.document}` : undefined,
                    }))}
                  />
                  {selectedCustomerId && (
                    <div className="text-xs text-blue-700 bg-blue-50/60 p-2.5 rounded-lg border border-blue-200 flex justify-between items-center">
                      <span>Cliente: <strong>{customerName}</strong> {customerDocument && `· ${customerDocument}`}</span>
                      <Link to="/orcafacil/customers/new" className="text-blue-600 underline font-medium">
                        Novo cadastro
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card: Adicionar Itens (Produtos ou Serviços) */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                {itemTypeToAdd === 'product' ? (
                  <Package className="h-4 w-4 text-blue-600" />
                ) : (
                  <Wrench className="h-4 w-4 text-emerald-600" />
                )}
                <span>Adicionar {itemTypeToAdd === 'product' ? 'Produto' : 'Serviço'} ao Carrinho</span>
              </div>
              <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setItemTypeToAdd('product')
                    setSelectedProduct(null)
                    setSelectedService(null)
                    setProductQuery('')
                    setItemUnitPrice('')
                  }}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 transition ${
                    itemTypeToAdd === 'product'
                      ? 'bg-white text-blue-700 shadow-xs font-bold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Package className="h-3.5 w-3.5" />
                  Produto (Estoque)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setItemTypeToAdd('service')
                    setSelectedProduct(null)
                    setSelectedService(null)
                    setProductQuery('')
                    setItemUnitPrice('')
                  }}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 transition ${
                    itemTypeToAdd === 'service'
                      ? 'bg-white text-emerald-700 shadow-xs font-bold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  Serviço
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Campo de Busca Rápida */}
              <div className="relative">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {itemTypeToAdd === 'product'
                    ? 'Localizar produto por Nome, Código SKU ou Código de Barras (EAN):'
                    : 'Localizar serviço por Nome ou Código:'}
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={productQuery}
                    onChange={(e) => {
                      setProductQuery(e.target.value)
                      if (selectedProduct) setSelectedProduct(null)
                      if (selectedService) setSelectedService(null)
                    }}
                    placeholder={
                      itemTypeToAdd === 'product'
                        ? 'Digite o nome do produto ou escaneie o código de barras...'
                        : 'Digite o nome ou código do serviço...'
                    }
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Dropdown de Resultados de Produtos */}
                {itemTypeToAdd === 'product' && filteredProducts.length > 0 && !selectedProduct && (
                  <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProduct(p)}
                        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs hover:bg-blue-50/70 border-b border-gray-100 last:border-0"
                      >
                        <div>
                          <p className="font-semibold text-gray-900">{p.name}</p>
                          <p className="text-[11px] text-gray-500">
                            Cód. #{p.sku} {p.barcode ? `· EAN: ${p.barcode}` : ''} · Unidade: {p.unit}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-700 text-sm">
                            {Number(p.unitPrice) > 0 ? formatCurrency(p.unitPrice) : 'Sob Consulta'}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Saldo: {p.quantityOnHand} {p.unit}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Dropdown de Resultados de Serviços */}
                {itemTypeToAdd === 'service' && filteredServices.length > 0 && !selectedService && (
                  <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                    {filteredServices.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectService(s)}
                        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs hover:bg-emerald-50/70 border-b border-gray-100 last:border-0"
                      >
                        <div>
                          <p className="font-semibold text-gray-900">{s.name}</p>
                          <p className="text-[11px] text-gray-500">
                            Cód. {s.serviceCode} · {s.categoryName || 'Geral'} · Unidade: {s.billingUnit}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-700 text-sm">
                            {formatCurrency(s.salePrice)}
                          </p>
                          {Number(s.minimumSalePrice) > 0 && (
                            <p className="text-[10px] text-gray-400">
                              Mínimo: {formatCurrency(s.minimumSalePrice)}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedProduct && itemTypeToAdd === 'product' && (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
                  <span>
                    Material selecionado: <strong>{selectedProduct.name}</strong> (Saldo disponível:{' '}
                    <strong>{selectedProduct.quantityOnHand} {selectedProduct.unit}</strong>)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProduct(null)
                      setProductQuery('')
                    }}
                    className="text-xs text-emerald-700 underline font-semibold"
                  >
                    Trocar
                  </button>
                </div>
              )}

              {selectedService && itemTypeToAdd === 'service' && (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
                  <span>
                    Serviço selecionado: <strong>{selectedService.name}</strong> ({selectedService.serviceCode}) · Cobrança por{' '}
                    <strong>{selectedService.billingUnit}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedService(null)
                      setProductQuery('')
                    }}
                    className="text-xs text-emerald-700 underline font-semibold"
                  >
                    Trocar
                  </button>
                </div>
              )}

              {/* Quantidade e Valor Unitário */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <Input
                  label={`Quantidade (${
                    itemTypeToAdd === 'service'
                      ? selectedService?.billingUnit || 'UN'
                      : selectedProduct?.unit || 'UN'
                  })`}
                  type="number"
                  min="0.001"
                  step="any"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(e.target.value)}
                />
                <Input
                  label="Valor Unitário (R$)"
                  currency
                  placeholder="0,00"
                  value={itemUnitPrice}
                  onChange={(e) => setItemUnitPrice(e.target.value)}
                />
                <Button
                  type="button"
                  onClick={handleAddToCart}
                  className={`h-10 gap-2 ${
                    itemTypeToAdd === 'service'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar ao Carrinho
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card: Itens do Carrinho */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
                <span>Itens da Venda ({cart.length})</span>
              </div>
              {cart.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCart([])}
                  className="h-7 text-xs text-red-600 hover:bg-red-50"
                >
                  Limpar Carrinho
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  Nenhum item adicionado à venda até o momento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/70 text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-2.5 font-semibold">Tipo</th>
                        <th className="px-4 py-2.5 font-semibold">Item</th>
                        <th className="px-3 py-2.5 text-center font-semibold">Qtd</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Unitário</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                        <th className="px-3 py-2.5 text-center font-semibold">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cart.map((it) => (
                        <tr key={it.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3">
                            {it.itemType === 'service' ? (
                              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-700/20">
                                Serviço
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-inset ring-blue-700/20">
                                Material
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-900">{it.description}</p>
                            {it.sku && <p className="text-[10px] text-gray-400">#{it.sku}</p>}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={it.quantity}
                              onChange={(e) => handleUpdateItemQuantity(it.id, e.target.value)}
                              className="w-16 rounded border border-gray-300 py-1 px-1.5 text-center text-xs text-gray-900 focus:border-blue-500 focus:outline-none"
                            />
                            <span className="text-[10px] text-gray-400 block mt-0.5">{it.unit}</span>
                          </td>
                          <td className="px-3 py-3 text-right text-gray-600">
                            {formatCurrency(it.unitPrice)}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-gray-900">
                            {formatCurrency(it.total)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(it.id)}
                              className="text-gray-400 hover:text-red-600 p-1 rounded transition"
                              title="Remover item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* LADO DIREITO: RESUMO, FORMA DE PAGAMENTO & FINALIZAÇÃO */}
        <div className="space-y-6">
          <Card className="rounded-xl shadow-md border-blue-200/80 bg-gradient-to-b from-blue-50/30 to-white">
            <CardHeader className="pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <span>Fechamento da Venda</span>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Valores */}
              <div className="space-y-2 text-xs pb-3 border-b border-gray-200">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal Geral:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(subtotal)}</span>
                </div>
                {Number(productsSubtotal) > 0 && (
                  <div className="flex justify-between text-gray-500 text-[11px] pl-2">
                    <span>• Materiais ({cart.filter((c) => c.itemType !== 'service').length}):</span>
                    <span className="font-medium text-gray-700">{formatCurrency(productsSubtotal)}</span>
                  </div>
                )}
                {Number(servicesSubtotal) > 0 && (
                  <div className="flex justify-between text-gray-500 text-[11px] pl-2">
                    <span>• Serviços ({cart.filter((c) => c.itemType === 'service').length}):</span>
                    <span className="font-medium text-gray-700">{formatCurrency(servicesSubtotal)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-gray-600">
                  <span>Desconto (R$):</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-24 rounded border border-gray-300 py-1 px-2 text-right text-xs font-semibold text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-gray-900 pt-2 border-t border-gray-200">
                  <span>TOTAL A PAGAR:</span>
                  <span className="text-xl font-extrabold text-blue-700">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Forma de Pagamento */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Forma de Pagamento:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['money', 'pix', 'credit_card', 'debit_card', 'on_credit'] as PaymentMethod[]).map(
                    (method) => {
                      const isSelected = paymentMethod === method
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`rounded-lg border p-2.5 text-xs text-left transition font-medium ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold ring-1 ring-blue-600'
                              : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {PAYMENT_METHOD_LABELS[method]}
                        </button>
                      )
                    },
                  )}
                </div>
              </div>

              {/* Opção Fiscal — Exclusiva para o plano "Completo com emissão de NF-e e NFC-e" */}
              {hasFullFiscalAccessPlan && (
                <div className="rounded-xl border border-gray-200 p-3 bg-white space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-gray-800">
                    <input
                      type="checkbox"
                      checked={emitFiscalNow}
                      onChange={(e) => setEmitFiscalNow(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-1.5">
                      <QrCode className="h-4 w-4 text-purple-600" />
                      <span>Emitir NFC-e imediatamente</span>
                    </div>
                  </label>
                  <p className="text-[11px] text-gray-500 pl-6">
                    Gera autorização da NFC-e com protocolo SEFAZ e QR Code para o cliente.
                  </p>
                </div>
              )}

              {/* Observações da Venda */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Observações do Pedido (opcional):
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instruções de entrega, garantia ou observações..."
                  className="w-full rounded-lg border border-gray-300 p-2 text-xs text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* ENCAMINHAR PARA AGENDA */}
              <ForwardToScheduleCard
                enabled={forwardToSchedule}
                onChangeEnabled={setForwardToSchedule}
                date={scheduleDate}
                onChangeDate={setScheduleDate}
                time={scheduleTime}
                onChangeTime={setScheduleTime}
                assignedTo={scheduleAssignedTo}
                onChangeAssignedTo={setScheduleAssignedTo}
                notes={scheduleNotes}
                onChangeNotes={setScheduleNotes}
                title="Encaminhar para agenda"
                description="Agendar data de entrega, instalação ou atendimento para esta venda."
              />

              {/* Botão de Finalizar Venda */}
              <Button
                type="button"
                size="lg"
                isLoading={isSubmitting}
                onClick={() => void handleFinalizeSale()}
                disabled={cart.length === 0 || hasOpenCashSession === false}
                className="w-full justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 text-sm shadow-md transition disabled:opacity-50"
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                {hasOpenCashSession === false
                  ? 'Caixa Fechado (Abra o Caixa para Vender)'
                  : 'Finalizar Venda & Baixar Estoque'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Comprovante de Venda */}
      <SaleReceiptModal
        open={showReceipt}
        sale={completedSale}
        onClose={() => {
          setShowReceipt(false)
          void navigate('/orcafacil/sales/search')
        }}
      />
    </div>
  )
}
