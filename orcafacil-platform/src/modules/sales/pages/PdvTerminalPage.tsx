import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { customerService, type Customer } from '@modules/customers/services/customer.service'
import { inventoryService } from '@modules/inventory/services/inventory.service'
import { cashSessionService } from '@modules/cash/services/cash-session.service'
import {
  reconcileCash,
  type CashRegister,
  type CashSession,
} from '@modules/cash/domain/cash-session'
import {
  salesService,
  type PaymentMethod,
  type SaleDetail,
} from '../services/sales.service'
import { SaleReceiptModal } from '../components/SaleReceiptModal'
import { pdvSound } from '../utils/pdv-sound'
import type { InventoryItem } from '@shared/types/common'
import {
  calculateItemTotal,
  calculateSubtotal,
  calculateTotal,
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyInput,
} from '@shared/utils/monetary'
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Barcode,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Hash,
  Lock,
  LogOut,
  Maximize,
  Minus,
  Plus,
  Phone,
  Printer,
  QrCode,
  Receipt,
  ShoppingCart,
  Store,
  Tag,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react'

function getCustomerInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toLocaleUpperCase()
}

interface CartItem {
  id: string
  inventoryItemId?: string
  description: string
  unit: string
  quantity: string
  unitPrice: string
  total: string
  barcode?: string
  sku?: string
  availableStock?: string
  allowNegativeStock?: boolean
}

export function PdvTerminalPage() {
  const { user, profile } = useAuth()
  const { currentOrganization } = useOrganization()
  const navigate = useNavigate()

  // Sessão de Caixa e Seleção de Terminal PDV
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [selectedRegister, setSelectedRegister] = useState<string>('Caixa 01')
  const [showInlineNewRegister, setShowInlineNewRegister] = useState(false)
  const [inlineNewRegisterName, setInlineNewRegisterName] = useState('')
  const [isCreatingInlineRegister, setIsCreatingInlineRegister] = useState(false)
  const [session, setSession] = useState<CashSession | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [showOpenSessionModal, setShowOpenSessionModal] = useState(false)
  const [openingBalanceInput, setOpeningBalanceInput] = useState('0,00')
  const [openSessionError, setOpenSessionError] = useState<string | null>(null)

  // Dados do Sistema (Clientes & Produtos)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  // Venda Atual
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [customerName, setCustomerName] = useState('Consumidor Final')
  const [customerDocument, setCustomerDocument] = useState('')
  const [discount, setDiscount] = useState('0,00')
  const [lastScannedItem, setLastScannedItem] = useState<CartItem | null>(null)

  // Input de Leitura de Código de Barras
  const [barcodeQuery, setBarcodeQuery] = useState('')
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // Modais do PDV
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('money')
  const [cardType, setCardType] = useState<'credit' | 'debit'>('credit')
  const [showCardTypeSelection, setShowCardTypeSelection] = useState(false)
  const [amountReceivedInput, setAmountReceivedInput] = useState('')
  const [isSubmittingSale, setIsSubmittingSale] = useState(false)
  const [saleError, setSaleError] = useState<string | null>(null)

  // Fechamento de Caixa (Tecla 9)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [countedMoneyInput, setCountedMoneyInput] = useState('')
  const [closureJustification, setClosureJustification] = useState('')
  const [supervisorAuthInput, setSupervisorAuthInput] = useState('')
  const [conferenceAttempts, setConferenceAttempts] = useState(1)
  const [isClosingSession, setIsClosingSession] = useState(false)
  const [closureError, setClosureError] = useState<string | null>(null)
  const [closedSessionReport, setClosedSessionReport] = useState<CashSession | null>(null)

  // Modo Tela Cheia Fixa (Terminal PDV)
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement))

  // Bloqueio da tecla Escape via Keyboard Lock API (Chromium/Edge/Chrome)
  const lockEscapeKey = useCallback(async () => {
    try {
      const nav = navigator as unknown as {
        keyboard?: {
          lock?: (keys?: string[]) => Promise<void>
          unlock?: () => void
        }
      }
      if (nav.keyboard && typeof nav.keyboard.lock === 'function') {
        await nav.keyboard.lock(['Escape'])
      }
    } catch {
      // Ignora caso o navegador não suporte
    }
  }, [])

  const unlockEscapeKey = useCallback(() => {
    try {
      const nav = navigator as unknown as {
        keyboard?: {
          unlock?: () => void
        }
      }
      if (nav.keyboard && typeof nav.keyboard.unlock === 'function') {
        nav.keyboard.unlock()
      }
    } catch {
      // Ignora
    }
  }, [])

  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      }
      await lockEscapeKey()
      sessionStorage.setItem('pdv_fullscreen_locked', 'true')
      setIsFullscreen(true)
    } catch {
      // Bloqueios de auto-início do navegador são resolvidos no próximo gesto/toque
    }
  }, [lockEscapeKey])

  // Desativa tela cheia e libera bloqueios somente ao clicar em "Sair para Vendas"
  const handleExitToSales = useCallback(async () => {
    sessionStorage.removeItem('pdv_fullscreen_locked')
    unlockEscapeKey()
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      }
    } catch {
      // Ignora erros ao sair de fullscreen
    }
    navigate('/orcafacil/sales')
  }, [navigate, unlockEscapeKey])

  // Imprime o comprovante de fechamento e sai do PDV imediatamente
  const handlePrintAndExit = useCallback(() => {
    window.print()
    setTimeout(() => {
      void handleExitToSales()
    }, 400)
  }, [handleExitToSales])

  // Gerenciador de Fullscreen: auto-ativação, persistência após refresh (F5), proteção contra ESC e beforeunload
  useEffect(() => {
    sessionStorage.setItem('pdv_fullscreen_locked', 'true')
    void enterFullscreen()

    const onFullscreenChange = () => {
      const inFull = Boolean(document.fullscreenElement)
      setIsFullscreen(inFull)
      if (inFull) {
        void lockEscapeKey()
      }
    }

    // Qualquer clique ou tecla na janela reentra em fullscreen se tiver saído (ex: após refresh F5)
    const handleGlobalInteraction = () => {
      if (!document.fullscreenElement && sessionStorage.getItem('pdv_fullscreen_locked') === 'true') {
        void enterFullscreen()
      }
    }

    // Intercepta Escape no nível de captura para garantir que não saia do modo Fullscreen do browser
    const handleEscapeCapture = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sessionStorage.getItem('pdv_fullscreen_locked') === 'true') {
        if (document.fullscreenElement) {
          void lockEscapeKey()
        }
      }
    }

    // Previne atualização / fechamento acidental da página durante o PDV
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sessionStorage.getItem('pdv_fullscreen_locked') === 'true') {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    window.addEventListener('pointerdown', handleGlobalInteraction, { capture: true })
    window.addEventListener('keydown', handleGlobalInteraction, { capture: true })
    window.addEventListener('keydown', handleEscapeCapture, { capture: true })
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      window.removeEventListener('pointerdown', handleGlobalInteraction, { capture: true })
      window.removeEventListener('keydown', handleGlobalInteraction, { capture: true })
      window.removeEventListener('keydown', handleEscapeCapture, { capture: true })
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [enterFullscreen, lockEscapeKey])

  // Dados do Cliente Selecionado
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId],
  )
  const customerPhone = selectedCustomer?.phone || ''

  // Modais de Ação Rápida (Cliente, Desconto, Cancelar, Suprimento, Sangria)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [customerSelectedIndex, setCustomerSelectedIndex] = useState(0)
  const customerSearchInputRef = useRef<HTMLInputElement>(null)

  const customerCandidates = useMemo(() => {
    const list: Array<{ id: string; name: string; document?: string | null; phone?: string | null; isDefault?: boolean }> = [
      { id: '', name: 'Consumidor Final', document: undefined, phone: undefined, isDefault: true },
    ]
    const query = customerSearchQuery.trim().toLowerCase()
    const filtered = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.document && c.document.includes(query)) ||
        (c.phone && c.phone.includes(query)),
    )
    for (const c of filtered.slice(0, 25)) {
      list.push({ id: c.id, name: c.name, document: c.document, phone: c.phone })
    }
    return list
  }, [customers, customerSearchQuery])

  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [discountInput, setDiscountInput] = useState('')

  // Quantidade para o Próximo Item (F9) — Multiplicar ou Subtrair
  const [nextItemQuantity, setNextItemQuantity] = useState(0)
  const [quantityOperation, setQuantityOperation] = useState<'multiply' | 'subtract'>('multiply')
  const [showQuantityModal, setShowQuantityModal] = useState(false)
  const [quantityInput, setQuantityInput] = useState('')
  const [modalOperation, setModalOperation] = useState<'multiply' | 'subtract'>('multiply')

  const handleOpenQuantityModal = () => {
    setQuantityInput('')
    setModalOperation('multiply')
    setShowQuantityModal(true)
  }

  const handleConfirmQuantity = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const parsed = parseInt(quantityInput.replace(/\D/g, ''), 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      setNextItemQuantity(parsed)
      setQuantityOperation(modalOperation)
      pdvSound.playScan()
    } else {
      setNextItemQuantity(0)
      setQuantityOperation('multiply')
    }
    setShowQuantityModal(false)
    focusBarcodeInput()
  }
  const [showCancelSaleModal, setShowCancelSaleModal] = useState(false)
  const [showMovementModal, setShowMovementModal] = useState(false)
  const [movementType, setMovementType] = useState<'supply' | 'bleed'>('supply')
  const [movementAmountInput, setMovementAmountInput] = useState('')
  const [movementReasonInput, setMovementReasonInput] = useState('')

  // Comprovante de Venda
  const [completedSale, setCompletedSale] = useState<SaleDetail | null>(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)

  // Relógio do Terminal
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => { setCurrentTime(new Date()); }, 1000)
    return () => { clearInterval(timer); }
  }, [])

  // Carrega Sessão de Caixa Atual e Caixas Cadastrados
  const loadActiveSession = useCallback(
    async (overrideRegisterName?: string) => {
      if (!currentOrganization) return
      setIsLoadingSession(true)

      const savedRegister =
        overrideRegisterName || cashSessionService.getSelectedRegisterName(currentOrganization.id)

      const regRes = await cashSessionService.listRegisters(currentOrganization.id)
      const regList = regRes.success ? regRes.data : []
      setRegisters(regList)

      const targetRegister = regList.some((r) => r.name === savedRegister)
        ? savedRegister
        : regList[0]?.name || 'Caixa 01'

      setSelectedRegister(targetRegister)
      cashSessionService.setSelectedRegisterName(currentOrganization.id, targetRegister)

      const [res, openListRes] = await Promise.all([
        cashSessionService.getOpenSession(currentOrganization.id, targetRegister),
        cashSessionService.listOpenSessions(currentOrganization.id),
      ])

      const otherOpenByCurrentUser =
        openListRes.success && user
          ? openListRes.data.find(
              (s) => s.openedBy === user.id && s.registerId !== targetRegister,
            )
          : undefined

      if (res.success && res.data) {
        if (user && res.data.openedBy !== user.id) {
          setSession(null)
          setOpenSessionError(
            `O ${targetRegister} já consta aberto pelo usuário "${res.data.operatorName}". Você só poderá usar este caixa após o fechamento.`,
          )
          setShowOpenSessionModal(true)
        } else {
          setOpenSessionError(null)
          setSession(res.data)
          setShowOpenSessionModal(false)
        }
      } else {
        setSession(null)
        if (otherOpenByCurrentUser) {
          setOpenSessionError(
            `Você já possui o "${otherOpenByCurrentUser.registerId}" aberto. Cada usuário só pode ter um caixa aberto por vez. Feche primeiro o "${otherOpenByCurrentUser.registerId}" para mudar de caixa.`,
          )
        } else {
          setOpenSessionError(null)
        }
        setShowOpenSessionModal(true)
      }
      setIsLoadingSession(false)
    },
    [currentOrganization, user],
  )

  const handleSelectTerminalInModal = async (registerName: string) => {
    if (!currentOrganization) return
    setOpenSessionError(null)
    cashSessionService.setSelectedRegisterName(currentOrganization.id, registerName)
    setSelectedRegister(registerName)
    await loadActiveSession(registerName)
  }

  const handleCreateInlineRegister = async () => {
    if (!currentOrganization) return
    const trimmed = inlineNewRegisterName.trim()
    if (!trimmed) {
      setOpenSessionError('Informe o nome do novo caixa PDV.')
      return
    }
    setIsCreatingInlineRegister(true)
    setOpenSessionError(null)
    const res = await cashSessionService.createRegister(currentOrganization.id, {
      name: trimmed,
    })
    setIsCreatingInlineRegister(false)
    if (res.success) {
      const createdName = res.data.name
      setInlineNewRegisterName('')
      setShowInlineNewRegister(false)
      cashSessionService.setSelectedRegisterName(currentOrganization.id, createdName)
      setSelectedRegister(createdName)
      await loadActiveSession(createdName)
    } else {
      setOpenSessionError(res.error)
    }
  }

  useEffect(() => {
    void loadActiveSession()
  }, [loadActiveSession])

  // Carrega Estoque e Clientes
  useEffect(() => {
    if (!currentOrganization) return
    let active = true

    void Promise.all([
      inventoryService.list(currentOrganization.id),
      customerService.list(currentOrganization.id),
    ]).then(([invRes, custRes]) => {
      if (!active) return
      if (invRes.success) {
        setInventoryItems(
          invRes.data.filter(
            (item: InventoryItem) =>
              item.isActive &&
              item.canSell &&
              item.registrationStatus !== 'awaiting_information' &&
              Number(item.quantityOnHand) > 0,
          ),
        )
      }
      if (custRes.success) {
        setCustomers(custRes.data)
      }
    })

    return () => {
      active = false
    }
  }, [currentOrganization])

  // Foco automático no leitor de código de barras
  const focusBarcodeInput = useCallback(() => {
    setTimeout(() => {
      barcodeInputRef.current?.focus()
      barcodeInputRef.current?.select()
    }, 50)
  }, [])

  useEffect(() => {
    if (session && !showPaymentModal && !showCloseModal && !showCustomerModal && !showDiscountModal && !showCancelSaleModal && !showMovementModal && !showQuantityModal && !showReceiptModal && !closedSessionReport) {
      focusBarcodeInput()
    }
  }, [session, showPaymentModal, showCloseModal, showCustomerModal, showDiscountModal, showCancelSaleModal, showMovementModal, showQuantityModal, showReceiptModal, closedSessionReport, focusBarcodeInput])

  // Cálculo dos Totais
  const subtotal = useMemo(() => {
    return calculateSubtotal(cart.map((item) => item.total))
  }, [cart])

  const discountValue = useMemo(() => {
    const clean = discount.replace(',', '.')
    const parsed = parseFloat(clean)
    return Number.isFinite(parsed) && parsed > 0 ? parsed.toFixed(2) : '0.00'
  }, [discount])

  const grandTotal = useMemo(() => {
    return calculateTotal(subtotal, discountValue)
  }, [subtotal, discountValue])

  const totalItemsCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + parseInt(item.quantity || '0', 10), 0)
  }, [cart])

  // Cálculo do Troco em Dinheiro
  const cashChange = useMemo(() => {
    const received = parseFloat(amountReceivedInput.replace(',', '.')) || 0
    const total = parseFloat(grandTotal) || 0
    const diff = received - total
    return {
      received,
      total,
      change: Math.max(0, diff),
      isSufficient: received >= total,
      missing: diff < 0 ? Math.abs(diff) : 0,
    }
  }, [amountReceivedInput, grandTotal])

  // Proteção contra saída acidental (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (session && session.status === 'open') {
        e.preventDefault()
        e.returnValue = 'O caixa do PDV continua aberto. É obrigatório realizar o fechamento do caixa (Tecla F12) antes de sair.'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => { window.removeEventListener('beforeunload', handleBeforeUnload); }
  }, [session])

  // Abertura de Caixa
  const handleOpenSession = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!currentOrganization || !user) return

    setOpenSessionError(null)
    cashSessionService.setSelectedRegisterName(currentOrganization.id, selectedRegister)
    const opName = profile?.displayName || user.email?.split('@')[0] || 'Operador'
    const cleanBalance = parseCurrencyInput(openingBalanceInput)

    const res = await cashSessionService.openSession(currentOrganization.id, {
      registerId: selectedRegister,
      operatorId: user.id,
      operatorName: opName,
      openingBalance: cleanBalance,
    })

    if (res.success) {
      setSession(res.data)
      setShowOpenSessionModal(false)
      pdvSound.playSuccess()
      focusBarcodeInput()
    } else {
      setOpenSessionError(res.error)
      pdvSound.playError()
    }
  }

  // Produtos filtrados para sugestão rápida durante digitação (apenas com estoque disponível)
  const matchedProducts = useMemo(() => {
    const q = barcodeQuery.trim().toLowerCase()
    if (!q || q.length < 2) return []
    if (/^([*xX+\-]\s*\d+|\d+\s*[*xX+\-])$/.test(q)) return []
    return inventoryItems
      .filter((item) => {
        if (!item.isActive || !item.canSell || item.registrationStatus === 'awaiting_information') return false
        if (Number(item.quantityOnHand) <= 0) return false
        const matchName = item.name.toLowerCase().includes(q)
        const matchSku = item.sku.toLowerCase().includes(q)
        const matchBarcode = item.barcode ? item.barcode.toLowerCase().includes(q) : false
        return matchName || matchSku || matchBarcode
      })
      .slice(0, 6)
  }, [barcodeQuery, inventoryItems])

  // Função centralizada para adicionar produto ao carrinho do PDV
  const handleAddProductToCart = (found: InventoryItem) => {
    if (Number(found.quantityOnHand) <= 0) {
      pdvSound.playError()
      setScanFeedback({
        type: 'error',
        message: `Produto "${found.name}" sem estoque disponível no momento.`,
      })
      setBarcodeQuery('')
      return
    }

    const qtyModifier = nextItemQuantity > 0 ? nextItemQuantity : 1
    const isSubtraction = nextItemQuantity > 0 && quantityOperation === 'subtract'

    // OPERAÇÃO SUBTRAIR DA PRÓXIMA LEITURA (F9)
    if (isSubtraction) {
      const existingIndex = cart.findIndex((item) => item.inventoryItemId === found.id)
      if (existingIndex < 0) {
        pdvSound.playError()
        setScanFeedback({
          type: 'error',
          message: `O item "${found.name}" não está no carrinho para subtrair.`,
        })
        setBarcodeQuery('')
        setNextItemQuantity(0)
        setQuantityOperation('multiply')
        return
      }

      const current = cart[existingIndex]
      const currentQty = parseInt(current.quantity, 10)

      pdvSound.playScan()

      let updatedCart: CartItem[]
      if (currentQty <= qtyModifier) {
        // Remove totalmente o item do carrinho
        updatedCart = cart.filter((_, idx) => idx !== existingIndex)
        setScanFeedback({
          type: 'success',
          message: `Item "${found.name}" removido do carrinho (-${currentQty} ${found.unit}).`,
        })
        setLastScannedItem(null)
      } else {
        // Reduz a quantidade
        const newQty = String(currentQty - qtyModifier)
        const newTotal = calculateItemTotal(newQty, current.unitPrice)
        const updatedItem = { ...current, quantity: newQty, total: newTotal }
        updatedCart = [...cart]
        updatedCart[existingIndex] = updatedItem
        setLastScannedItem(updatedItem)
        setScanFeedback({
          type: 'success',
          message: `-${qtyModifier} ${found.name} (Restam ${newQty} ${found.unit}).`,
        })
      }

      setCart(updatedCart)
      setBarcodeQuery('')
      setNextItemQuantity(0) // Volta para zero na próxima leitura
      setQuantityOperation('multiply')
      focusBarcodeInput()
      return
    }

    // OPERAÇÃO MULTIPLICAR / ADICIONAR (COMPORTAMENTO PADRÃO)
    const qtyToAdd = qtyModifier

    // Valida estoque disponível
    const existingIndex = cart.findIndex((item) => item.inventoryItemId === found.id)
    const currentQtyInCart = existingIndex >= 0 ? parseInt(cart[existingIndex].quantity, 10) : 0
    const available = parseFloat(found.quantityOnHand)

    if (available < currentQtyInCart + qtyToAdd) {
      pdvSound.playError()
      setScanFeedback({
        type: 'error',
        message: `Estoque insuficiente para "${found.name}". Saldo disponível: ${found.quantityOnHand} ${found.unit} (solicitado: ${currentQtyInCart + qtyToAdd}).`,
      })
      setBarcodeQuery('')
      return
    }

    pdvSound.playScan()

    let updatedCart: CartItem[]
    let scannedItem: CartItem

    if (existingIndex >= 0) {
      // Incrementa quantidade
      const current = cart[existingIndex]
      const newQty = String(parseInt(current.quantity, 10) + qtyToAdd)
      const newTotal = calculateItemTotal(newQty, current.unitPrice)
      scannedItem = { ...current, quantity: newQty, total: newTotal }

      updatedCart = [...cart]
      updatedCart[existingIndex] = scannedItem
    } else {
      // Novo item com quantidade definida pelo F9 (ou 1 por padrão)
      const initialQtyStr = String(qtyToAdd)
      scannedItem = {
        id: `pdv-item-${Date.now()}-${Math.random().toString().slice(2, 6)}`,
        inventoryItemId: found.id,
        description: found.name,
        unit: found.unit || 'UN',
        quantity: initialQtyStr,
        unitPrice: found.unitPrice,
        total: calculateItemTotal(initialQtyStr, found.unitPrice),
        barcode: found.barcode || undefined,
        sku: found.sku || undefined,
        availableStock: found.quantityOnHand,
        allowNegativeStock: found.allowNegativeStock,
      }
      updatedCart = [scannedItem, ...cart]
    }

    setCart(updatedCart)
    setLastScannedItem(scannedItem)
    setScanFeedback({
      type: 'success',
      message: `+${qtyToAdd} ${found.name} (${formatCurrency(scannedItem.total)})`,
    })
    setBarcodeQuery('')
    setNextItemQuantity(0) // Volta para zero na próxima leitura
    setQuantityOperation('multiply')
    focusBarcodeInput()
  }

  // Bipar / Adicionar Produto pelo Código de Barras ou Nome
  const handleScanBarcode = (e: React.FormEvent) => {
    e.preventDefault()
    const raw = barcodeQuery.trim()
    if (!raw) {
      if (cart.length > 0) {
        handleOpenPayment()
      }
      return
    }

    // 1. Operações rápidas de quantidade no próprio input:
    // Multiplicação / Adição: *6, 6*, x6, 6x, +6, 6+
    // Subtração: -6, 6-
    const prefixOpMatch = raw.match(/^([*xX+\-])\s*(\d+)$/)
    const suffixOpMatch = raw.match(/^(\d+)\s*([*xX+\-])$/)
    const opMatch = prefixOpMatch || suffixOpMatch

    if (opMatch) {
      const op = prefixOpMatch ? prefixOpMatch[1] : opMatch[2]
      const qtyStr = prefixOpMatch ? prefixOpMatch[2] : opMatch[1]
      const qty = parseInt(qtyStr, 10)

      if (qty > 0) {
        if (op === '-') {
          setNextItemQuantity(qty)
          setQuantityOperation('subtract')
          pdvSound.playScan()
          setScanFeedback({
            type: 'success',
            message: `Operação definida: Subtrair -${qty} no próximo produto.`,
          })
        } else {
          setNextItemQuantity(qty)
          setQuantityOperation('multiply')
          pdvSound.playScan()
          setScanFeedback({
            type: 'success',
            message: `Operação definida: Multiplicar/Adicionar +${qty}x no próximo produto.`,
          })
        }
        setBarcodeQuery('')
        return
      }
    }

    // 2. Operação inline opcional com produto (ex: "*6 7891234", "+2 Coca", "-1 Heineken")
    const inlinePrefixMatch = raw.match(/^([*xX+\-])\s*(\d+)\s+(.+)$/)
    const inlineSuffixMatch = raw.match(/^(\d+)\s*([*xX+\-])\s+(.+)$/)
    const inlineMatch = inlinePrefixMatch || inlineSuffixMatch
    let code = raw

    if (inlineMatch) {
      const op = inlinePrefixMatch ? inlinePrefixMatch[1] : inlineMatch[2]
      const qtyStr = inlinePrefixMatch ? inlinePrefixMatch[2] : inlineMatch[1]
      const qty = parseInt(qtyStr, 10)
      if (qty > 0) {
        setNextItemQuantity(qty)
        setQuantityOperation(op === '-' ? 'subtract' : 'multiply')
        code = (inlinePrefixMatch ? inlinePrefixMatch[3] : inlineMatch[3]).trim()
      }
    }

    // Busca exata por barcode, depois sku, depois nome
    const found = inventoryItems.find((item) => {
      if (item.barcode && item.barcode.trim().toLowerCase() === code.toLowerCase()) return true
      if (item.sku && item.sku.trim().toLowerCase() === code.toLowerCase()) return true
      return false
    }) || inventoryItems.find((item) => item.name.toLowerCase().includes(code.toLowerCase()))

    if (!found) {
      pdvSound.playError()
      setScanFeedback({
        type: 'error',
        message: `Produto ou código "${code}" não cadastrado ou sem estoque disponível.`,
      })
      setBarcodeQuery('')
      return
    }

    handleAddProductToCart(found)
  }

  // Remover Item do Carrinho
  const handleRemoveItem = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId))
    pdvSound.playScan()
    focusBarcodeInput()
  }

  // Abrir Modal de Pagamento
  const handleOpenPayment = () => {
    if (cart.length === 0) {
      pdvSound.playError()
      setScanFeedback({ type: 'error', message: 'Adicione pelo menos um item antes de finalizar.' })
      return
    }
    setAmountReceivedInput(grandTotal)
    setSelectedPaymentMethod('money')
    setShowPaymentModal(true)
  }

  // Confirmar Venda
  const handleConfirmSale = async () => {
    if (!currentOrganization || !session || cart.length === 0 || isSubmittingSale) return

    if (selectedPaymentMethod === 'money' && !cashChange.isSufficient) {
      setSaleError('O valor recebido em dinheiro é inferior ao total da venda.')
      pdvSound.playError()
      return
    }

    setIsSubmittingSale(true)
    setSaleError(null)

    const finalMethod: PaymentMethod =
      selectedPaymentMethod === 'credit_card' && cardType === 'debit'
        ? 'debit_card'
        : selectedPaymentMethod

    const res = await salesService.createSale(currentOrganization.id, {
      customerId: selectedCustomerId || null,
      customerName,
      customerDocument: customerDocument || undefined,
      items: cart.map((item) => ({
        inventoryItemId: item.inventoryItemId || null,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      discount: discountValue,
      paymentMethod: finalMethod,
      isPdv: true,
      sessionId: session.id,
      amountReceived: selectedPaymentMethod === 'money' ? amountReceivedInput : grandTotal,
      changeAmount: selectedPaymentMethod === 'money' ? cashChange.change.toFixed(2) : '0.00',
      operatorId: user?.id,
      operatorName: session.operatorName ?? undefined,
      sellerName: session.operatorName || profile?.displayName || user?.email?.split('@')[0] || 'Operador',
    })

    if (res.success) {
      pdvSound.playSuccess()

      // Busca dados completos para o cupom
      const saleDetailRes = await salesService.getSaleById(currentOrganization.id, res.data.saleId)
      if (saleDetailRes.success) {
        setCompletedSale(saleDetailRes.data)
        setShowReceiptModal(true)
      }

      // Atualiza estado da sessão localmente
      const saleTotal = grandTotal
      const payment = finalMethod
      void cashSessionService.recordSaleInSession(currentOrganization.id, session.id, {
        total: saleTotal,
        paymentMethod: payment,
        amountReceived: selectedPaymentMethod === 'money' ? amountReceivedInput : grandTotal,
      }).then((sRes) => {
        if (sRes.success && sRes.data) setSession(sRes.data)
      })

      // Limpa carrinho para a próxima venda
      setCart([])
      setDiscount('0,00')
      setSelectedCustomerId('')
      setCustomerName('Consumidor Final')
      setCustomerDocument('')
      setLastScannedItem(null)
      setShowPaymentModal(false)
      setScanFeedback({ type: 'success', message: `Venda ${res.data.saleNumber} concluída!` })
    } else {
      pdvSound.playError()
      setSaleError(res.error)
    }

    setIsSubmittingSale(false)
  }

  // Tecla 9 — Abrir Fechamento de Caixa
  const handleOpenCloseSession = () => {
    if (!session) return
    setCountedMoneyInput('')
    setClosureJustification('')
    setSupervisorAuthInput('')
    setClosureError(null)
    setShowCloseModal(true)
  }

  // Confirmar Fechamento de Caixa
  const handleConfirmCloseSession = async () => {
    if (!currentOrganization || !session || !user || isClosingSession) return

    const countedVal = parseCurrencyInput(countedMoneyInput)
    if (countedVal.trim() === '') {
      setClosureError('Informe o valor físico existente em dinheiro na gaveta.')
      pdvSound.playError()
      return
    }

    setIsClosingSession(true)
    setClosureError(null)

    const res = await cashSessionService.closeSession(currentOrganization.id, session.id, {
      countedMoney: countedVal,
      justification: closureJustification,
      supervisorAuth: supervisorAuthInput,
      closedBy: user.id,
    })

    if (res.success) {
      pdvSound.playSuccess()
      setClosedSessionReport(res.data)
      setShowCloseModal(false)
      setSession(null)
    } else {
      pdvSound.playError()
      setClosureError(res.error)
      setConferenceAttempts((prev) => prev + 1)
    }

    setIsClosingSession(false)
  }

  // Registrar Sangria / Suprimento
  const handleConfirmMovement = async () => {
    if (!currentOrganization || !session || !user) return
    const cleanAmount = parseCurrencyInput(movementAmountInput)
    if (!cleanAmount || parseFloat(cleanAmount) <= 0) {
      pdvSound.playError()
      return
    }
    if (!movementReasonInput.trim()) {
      pdvSound.playError()
      return
    }

    const res = await cashSessionService.recordMovement(currentOrganization.id, session.id, {
      type: movementType,
      amount: cleanAmount,
      reason: movementReasonInput.trim(),
      userId: user.id,
    })

    if (res.success) {
      setSession(res.data)
      setShowMovementModal(false)
      setMovementAmountInput('')
      setMovementReasonInput('')
      pdvSound.playSuccess()
      focusBarcodeInput()
    }
  }

  // Atalhos Globais de Teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT'

      // Quando nenhum modal estiver aberto
      const anyModalOpen =
        showPaymentModal ||
        showCloseModal ||
        showOpenSessionModal ||
        showCustomerModal ||
        showDiscountModal ||
        showCancelSaleModal ||
        showMovementModal ||
        showQuantityModal ||
        showReceiptModal ||
        Boolean(closedSessionReport)

      if (!anyModalOpen) {
        // F11 — Garantir / Reentrar em Tela Cheia
        if (e.key === 'F11') {
          e.preventDefault()
          void enterFullscreen()
          return
        }

        // F12 — Fechamento de Caixa
        if (e.key === 'F12') {
          e.preventDefault()
          e.stopPropagation()
          handleOpenCloseSession()
          return
        }

        // Tecla 1 — Iniciar leitura / Foco no código de barras
        if (e.key === '1' && !isInput) {
          e.preventDefault()
          focusBarcodeInput()
          return
        }

        // Enter — Finalizar Venda (quando campo de barcode vazio e carrinho com itens)
        if (
          e.key === 'Enter' &&
          (!isInput || (activeEl === barcodeInputRef.current && barcodeQuery.trim() === ''))
        ) {
          if (cart.length > 0) {
            e.preventDefault()
            handleOpenPayment()
            return
          }
        }

        // Delete — Remover último item registrado
        if (
          e.key === 'Delete' &&
          (!isInput || (activeEl === barcodeInputRef.current && barcodeQuery.trim() === ''))
        ) {
          if (lastScannedItem) {
            e.preventDefault()
            handleRemoveItem(lastScannedItem.id)
            return
          }
        }

        // F2 — Selecionar Cliente
        if (e.key === 'F2') {
          e.preventDefault()
          setShowCustomerModal(true)
          return
        }

        // F3 — Desconto
        if (e.key === 'F3') {
          e.preventDefault()
          setDiscountInput(discount)
          setShowDiscountModal(true)
          return
        }

        // F4 — Cancelar Venda
        if (e.key === 'F4') {
          e.preventDefault()
          if (cart.length > 0) setShowCancelSaleModal(true)
          return
        }

        // F7 — Suprimento de Caixa
        if (e.key === 'F7') {
          e.preventDefault()
          setMovementType('supply')
          setShowMovementModal(true)
          return
        }

        // F8 — Sangria de Caixa
        if (e.key === 'F8') {
          e.preventDefault()
          setMovementType('bleed')
          setShowMovementModal(true)
          return
        }

        // F9 — Definir Quantidade do Próximo Item (Multiplicar ou Subtrair)
        if (e.key === 'F9') {
          e.preventDefault()
          handleOpenQuantityModal()
          return
        }

        // Escape — Limpar código ou refocar leitor / cancelar operação de quantidade pendente
        if (e.key === 'Escape') {
          e.preventDefault()
          if (barcodeQuery) {
            setBarcodeQuery('')
          } else if (nextItemQuantity > 0) {
            setNextItemQuantity(0)
            setQuantityOperation('multiply')
            pdvSound.playScan()
          } else {
            focusBarcodeInput()
          }
          return
        }
      } else if (showCustomerModal) {
        // Navegação de clientes por teclado (F2)
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setCustomerSelectedIndex((prev) => Math.min(customerCandidates.length - 1, prev + 1))
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setCustomerSelectedIndex((prev) => Math.max(0, prev - 1))
          return
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          const chosen = customerCandidates[customerSelectedIndex]
          if (chosen) {
            if (chosen.isDefault) {
              setSelectedCustomerId('')
              setCustomerName('Consumidor Final')
              setCustomerDocument('')
            } else {
              setSelectedCustomerId(chosen.id)
              setCustomerName(chosen.name)
              setCustomerDocument(chosen.document || '')
            }
            setShowCustomerModal(false)
            focusBarcodeInput()
          }
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setShowCustomerModal(false)
          focusBarcodeInput()
          return
        }
      } else if (showPaymentModal) {
        // Atalhos do Modal de Pagamento: D (Dinheiro), P (Pix), C (Cartão), Enter (Confirmar), Escape (Cancelar)
        if (e.key === 'Enter') {
          e.preventDefault()
          void handleConfirmSale()
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setShowPaymentModal(false)
          setShowCardTypeSelection(false)
          focusBarcodeInput()
          return
        }

        const isTypingAmount = activeEl?.getAttribute('data-money-input') === 'true'

        if (!showCardTypeSelection && !isTypingAmount) {
          if (e.key.toLowerCase() === 'd') {
            e.preventDefault()
            setSelectedPaymentMethod('money')
            return
          }
          if (e.key.toLowerCase() === 'p') {
            e.preventDefault()
            setSelectedPaymentMethod('pix')
            return
          }
          if (e.key.toLowerCase() === 'c') {
            e.preventDefault()
            setSelectedPaymentMethod('credit_card')
            setShowCardTypeSelection(true)
            return
          }
        } else if (showCardTypeSelection) {
          // Submenu Cartão: C (Crédito), D (Débito)
          if (e.key.toLowerCase() === 'c') {
            e.preventDefault()
            setCardType('credit')
            setShowCardTypeSelection(false)
            return
          }
          if (e.key.toLowerCase() === 'd') {
            e.preventDefault()
            setCardType('debit')
            setShowCardTypeSelection(false)
            return
          }
        }
      } else if (showCloseModal) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setShowCloseModal(false)
          focusBarcodeInput()
          return
        }
        if (e.key === 'Enter' && activeEl?.tagName !== 'TEXTAREA') {
          e.preventDefault()
          void handleConfirmCloseSession()
          return
        }
      } else if (closedSessionReport) {
        if (e.key === 'Enter' || e.key.toLowerCase() === 'p') {
          e.preventDefault()
          handlePrintAndExit()
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          void handleExitToSales()
          return
        }
      } else if (showDiscountModal) {
        if (e.key === 'Enter') {
          e.preventDefault()
          setDiscount(discountInput)
          setShowDiscountModal(false)
          focusBarcodeInput()
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setShowDiscountModal(false)
          focusBarcodeInput()
          return
        }
      } else if (showCancelSaleModal) {
        if (e.key === 'Enter') {
          e.preventDefault()
          setCart([])
          setDiscount('0,00')
          setLastScannedItem(null)
          setShowCancelSaleModal(false)
          pdvSound.playError()
          focusBarcodeInput()
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setShowCancelSaleModal(false)
          focusBarcodeInput()
          return
        }
      } else if (showMovementModal) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setShowMovementModal(false)
          focusBarcodeInput()
          return
        }
      } else if (showQuantityModal) {
        if (e.key === 'Enter') {
          e.preventDefault()
          handleConfirmQuantity()
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setShowQuantityModal(false)
          focusBarcodeInput()
          return
        }
        if (e.key.toLowerCase() === 'm') {
          e.preventDefault()
          setModalOperation('multiply')
          return
        }
        if (e.key.toLowerCase() === 's') {
          e.preventDefault()
          setModalOperation('subtract')
          return
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          setModalOperation((prev) => (prev === 'multiply' ? 'subtract' : 'multiply'))
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown); }
  }, [
    showPaymentModal,
    showCloseModal,
    showOpenSessionModal,
    showCustomerModal,
    showDiscountModal,
    showCancelSaleModal,
    showMovementModal,
    showQuantityModal,
    showReceiptModal,
    quantityInput,
    modalOperation,
    closedSessionReport,
    showCardTypeSelection,
    customerCandidates,
    customerSelectedIndex,
    cart,
    discount,
    discountInput,
    barcodeQuery,
    lastScannedItem,
    focusBarcodeInput,
    handleConfirmSale,
    handleConfirmCloseSession,
    enterFullscreen,
    handleExitToSales,
    handlePrintAndExit,
    navigate,
  ])

  // Dados de conciliação para o fechamento
  const reconciliation = useMemo(() => {
    if (!session) return null
    return reconcileCash(parseCurrencyInput(countedMoneyInput), session.expectedMoney)
  }, [session, countedMoneyInput])

  if (isLoadingSession) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-slate-100">
        <Store className="h-12 w-12 animate-pulse text-emerald-400 mb-4" />
        <h2 className="text-xl font-bold">Iniciando Terminal PDV...</h2>
        <p className="text-sm text-slate-400 mt-1">Verificando sessões de caixa e estoque da loja</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* ============================================================== */}
      {/* 1. BARRA SUPERIOR DO TERMINAL (STATUS, CAIXA, OPERADOR, HORÁRIO) */}
      {/* ============================================================== */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-emerald-500/20 p-1.5 text-emerald-400 ring-1 ring-emerald-500/40">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                JB SOFTWARE
              </span>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                PONTO DE VENDA (PDV)
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE
                </span>
              </h1>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 border-l border-slate-800 pl-4 text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{session?.registerId || selectedRegister}</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-300">
              <User className="h-3.5 w-3.5 text-slate-400" />
              {session?.operatorName || profile?.displayName || 'Operador'}
            </span>
            <span>•</span>
            <span className="text-slate-400">
              Vendas no Turno: <b className="text-emerald-400">{session?.salesCount || 0}</b>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs sm:text-sm">
          {isFullscreen ? (
            <div
              title="PDV em Modo Tela Cheia Bloqueado"
              className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-emerald-400 border border-emerald-500/30 select-none font-bold"
            >
              <Maximize className="h-4 w-4" />
              <span className="hidden sm:inline font-mono text-xs">Tela Cheia Fixa</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { void enterFullscreen(); }}
              title="Restaurar Tela Cheia [F11]"
              className="flex items-center gap-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 px-3.5 py-2 text-amber-300 border border-amber-500/40 transition-colors animate-pulse font-bold cursor-pointer"
            >
              <Maximize className="h-4 w-4" />
              <span className="font-mono text-xs sm:text-sm">Restaurar Tela Cheia [F11]</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-2 rounded-xl bg-slate-800 px-3.5 py-2 text-slate-200 border border-slate-700">
            <User className="h-4 w-4 text-blue-400" />
            <span className="text-xs sm:text-sm">Cliente: <b className="text-white">{customerName}</b></span>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-slate-800 px-3.5 py-2 text-slate-200 border border-slate-700 font-mono text-xs sm:text-sm">
            <Clock className="h-4 w-4 text-emerald-400" />
            <span>{currentTime.toLocaleTimeString('pt-BR')}</span>
          </div>

          <button
            type="button"
            onClick={() => { void handleExitToSales(); }}
            title="Sair do PDV e voltar para a listagem de vendas [Esc]"
            className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-rose-950/80 hover:border-rose-500/60 border border-slate-700 px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-200 hover:text-white transition-all shadow-sm cursor-pointer ml-1"
          >
            <LogOut className="h-4 w-4 text-rose-400 shrink-0" />
            <span className="font-semibold">Sair do PDV</span>
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. ÁREA CENTRAL (GRADE PRINCIPAL DO PDV)                         */}
      {/* ============================================================== */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* COLUNA ESQUERDA: LEITURA DE CÓDIGO DE BARRAS E TABELA DE PRODUTOS (8/12) */}
        <section className="lg:col-span-8 flex flex-col gap-4 overflow-hidden">
          {/* CAMPO DE LEITURA DE CÓDIGO DE BARRAS */}
          <div className="rounded-2xl border-2 border-emerald-500/40 bg-slate-900 p-3 shadow-lg relative">
            <div className="flex items-center justify-between pb-1.5 px-1 text-xs text-slate-400">
              <span className="font-semibold flex items-center gap-1.5">
                <Barcode className="h-4 w-4 text-emerald-400" />
                Leitor de Código de Barras / Nome do Produto
              </span>
              {nextItemQuantity > 0 ? (
                <span
                  className={`flex items-center gap-1.5 font-bold px-2.5 py-0.5 rounded-md border font-mono text-xs animate-pulse ${
                    quantityOperation === 'subtract'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  }`}
                >
                  {quantityOperation === 'subtract' ? (
                    <>
                      <Minus className="h-3 w-3" />
                      <span>Subtrair: <b>-{nextItemQuantity}x</b> no próximo produto</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3" />
                      <span>Quantidade: <b>+{nextItemQuantity}x</b> no próximo produto</span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setNextItemQuantity(0)
                      setQuantityOperation('multiply')
                    }}
                    className="ml-1 text-slate-400 hover:text-white"
                    title="Cancelar operação [Esc]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : (
                <span className="text-[11px] text-slate-500">
                  Pressione <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-400 font-mono font-bold">F9</kbd> ou digite <kbd className="bg-slate-800 px-1 py-0.5 rounded text-emerald-400 font-mono font-bold">*6</kbd> / <kbd className="bg-slate-800 px-1 py-0.5 rounded text-rose-400 font-mono font-bold">-1</kbd> para Quantidade (+ / -)
                </span>
              )}
            </div>
            <div className="relative">
              <form onSubmit={handleScanBarcode} className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none text-emerald-400">
                  <Barcode className="h-6 w-6 animate-pulse" />
                </div>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeQuery}
                  onChange={(e) => { setBarcodeQuery(e.target.value); }}
                  placeholder="Pressione [1] ou aponte o leitor de código de barras / digite o Nome do produto."
                  className="w-full rounded-xl bg-slate-950 py-3.5 pl-12 pr-28 text-base font-semibold text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-400 tracking-wide"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="absolute right-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-black text-white uppercase tracking-wider shadow-md hover:shadow-emerald-600/30 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Barcode className="h-4.5 w-4.5" />
                  <span>Bipar (Enter)</span>
                </button>
              </form>

              {/* SUGESTÕES DE PRODUTOS COM ESTOQUE DISPONÍVEL */}
              {matchedProducts.length > 0 && barcodeQuery.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden divide-y divide-slate-800">
                  <div className="px-3 py-1.5 bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex justify-between items-center">
                    <span>Produtos com Estoque Disponível</span>
                    <span>Clique para bipar</span>
                  </div>
                  {matchedProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddProductToCart(p)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-800/90 transition-colors cursor-pointer group"
                    >
                      <div>
                        <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          SKU: {p.sku} {p.barcode ? `· EAN: ${p.barcode}` : ''} · Un: {p.unit}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-400">
                          {formatCurrency(p.unitPrice)}
                        </p>
                        <p className="text-[10px] text-emerald-500 font-semibold">
                          Saldo: {p.quantityOnHand} {p.unit}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* FEEDBACK DA LEITURA */}
            {scanFeedback && (
              <div
                className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  scanFeedback.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}
              >
                {scanFeedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <span>{scanFeedback.message}</span>
              </div>
            )}
          </div>

          {/* TABELA DE PRODUTOS DA VENDA ATUAL */}
          <div className="flex-1 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-emerald-400" />
                <span>CARRINHO DE COMPRAS ({cart.length} itens)</span>
              </div>
              <span className="text-slate-400">Total Volumes: {totalItemsCount}</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-500">
                  <div className="rounded-2xl bg-slate-800/50 p-4 mb-3 border border-slate-800">
                    <Barcode className="h-10 w-10 text-slate-600" />
                  </div>
                  <p className="text-base font-semibold text-slate-400">Caixa Livre • Aguardando Leitura</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Pressione <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-emerald-400 font-mono">1</kbd> para ativar o leitor USB ou digite o código de barras e pressione <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-white font-mono">Enter</kbd>.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-950/90 backdrop-blur-xs text-slate-400 border-b border-slate-800 uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3">Produto</th>
                      <th className="py-2.5 px-3">Cód / SKU</th>
                      <th className="py-2.5 px-3 text-center">Qtd</th>
                      <th className="py-2.5 px-3 text-right">Unitário</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                      <th className="py-2.5 px-3 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-slate-200">
                    {cart.map((item, index) => {
                      const isLast = lastScannedItem?.id === item.id
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isLast ? 'bg-emerald-950/30 text-emerald-300 font-bold' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-center text-slate-500 font-sans">{index + 1}</td>
                          <td className="py-3 px-3 font-sans font-medium text-slate-100">
                            {item.description}
                          </td>
                          <td className="py-3 px-3 text-slate-400 text-[11px]">
                            {item.barcode || item.sku || '—'}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-white">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-3 px-3 text-right text-slate-300">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-400">
                            {formatCurrency(item.total)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => { handleRemoveItem(item.id); }}
                              title="Remover Item"
                              className="rounded-lg p-1 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>

        {/* COLUNA DIREITA: DISPLAY DE VALORES, CLIENTE, ÚLTIMO ITEM E BOTÃO FINALIZAR (4/12) */}
        <section className="lg:col-span-4 flex flex-col gap-4 overflow-hidden">
          {/* CAIXA DE IDENTIFICAÇÃO DO CLIENTE */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-md">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-blue-400" />
                Cliente Selecionado
              </span>
              <button
                type="button"
                onClick={() => { setShowCustomerModal(true); }}
                className="text-xs font-bold text-blue-200 bg-blue-600/30 hover:bg-blue-600/50 px-3 py-1.5 rounded-lg border border-blue-400/50 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Pressione F2 para selecionar ou alterar o cliente"
              >
                <Users className="h-3.5 w-3.5 text-blue-300" />
                <span>[F2] Alterar</span>
              </button>
            </div>

            <div className="mt-3 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 font-bold border border-blue-500/30 text-sm">
                {getCustomerInitials(customerName)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white truncate" title={customerName}>
                  {customerName}
                </h3>
                <div className="mt-1 flex flex-col gap-0.5 text-xs">
                  {customerPhone ? (
                    <div className="flex items-center gap-1.5 text-emerald-400 font-mono">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{customerPhone}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                      <Phone className="h-3 w-3 shrink-0 opacity-40" />
                      <span>Sem telefone informado</span>
                    </div>
                  )}

                  {customerDocument ? (
                    <span className="text-[11px] text-slate-400 font-mono">
                      Doc: {customerDocument}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* ÚLTIMO PRODUTO BIPADO */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-md">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Último Item Registrado
            </span>
            {lastScannedItem ? (
              <div className="mt-2 space-y-1">
                <h3 className="text-base font-bold text-white truncate">
                  {lastScannedItem.description}
                </h3>
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>
                    {lastScannedItem.quantity} {lastScannedItem.unit} x {formatCurrency(lastScannedItem.unitPrice)}
                  </span>
                  <span className="text-sm font-bold text-emerald-400">
                    {formatCurrency(lastScannedItem.total)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500 italic">Nenhum produto registrado ainda.</p>
            )}
          </div>

          {/* CARD DE VALORES & TOTAL (ESTILO DISPLAY DE SUPERMERCADO) */}
          <div className="flex-1 flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-sm text-slate-400 font-mono">
                <span>Subtotal:</span>
                <span className="text-base font-bold text-slate-200">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-sm text-slate-400 font-mono">
                <span>Desconto:</span>
                <span className="text-base font-bold text-rose-400">
                  - {formatCurrency(discountValue)}
                </span>
              </div>

              {/* DISPLAY GIGANTE DO TOTAL (DESTAQUE VERDE SUPERMERCADO) */}
              <div className="pt-2">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                  TOTAL A PAGAR
                </span>
                <div className="mt-1.5 rounded-xl border-2 border-emerald-500/50 bg-emerald-950/80 p-4 text-right shadow-[inset_0_0_20px_rgba(16,185,129,0.2)]">
                  <div className="font-mono text-4xl xl:text-5xl font-black text-emerald-400 tracking-tight">
                    {formatCurrency(grandTotal)}
                  </div>
                </div>
              </div>
            </div>

            {/* BOTÃO FINALIZAR VENDA */}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleOpenPayment}
                disabled={cart.length === 0}
                className="w-full flex items-center justify-center gap-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 py-4.5 text-lg font-black tracking-wider text-white uppercase shadow-xl shadow-emerald-950/70 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all ring-2 ring-emerald-400/40 cursor-pointer"
              >
                <CheckCircle2 className="h-7 w-7 text-emerald-100" />
                <span>[Enter] Finalizar Venda</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* ============================================================== */}
      {/* 3. BARRA INFERIOR DE ATALHOS DO TECLADO                         */}
      {/* ============================================================== */}
      <footer className="min-h-18 lg:h-20 shrink-0 border-t-2 border-slate-800 bg-slate-900/95 px-4 lg:px-6 flex items-center justify-between overflow-x-auto gap-3 text-sm shadow-2xl py-2">
        <div className="flex items-center gap-2.5 font-sans">
          <button
            type="button"
            onClick={focusBarcodeInput}
            className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-3.5 py-2.5 text-slate-100 font-bold border border-slate-700 hover:border-slate-600 transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Barcode className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
            <kbd className="rounded-lg bg-emerald-500/20 px-2 py-0.5 text-emerald-400 font-mono font-black text-xs">1</kbd>
            <span>Bipar Produto</span>
          </button>

          <button
            type="button"
            onClick={handleOpenPayment}
            disabled={cart.length === 0}
            className="flex items-center gap-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 px-4 py-2.5 text-white font-extrabold border border-emerald-500/50 shadow-md shadow-emerald-950/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-200 shrink-0" />
            <kbd className="rounded-lg bg-white/20 px-2.5 py-0.5 text-white font-mono font-black text-xs">Enter</kbd>
            <span>Finalizar</span>
          </button>

          <button
            type="button"
            onClick={() => { setShowCustomerModal(true); }}
            className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-3.5 py-2.5 text-slate-100 font-bold border border-slate-700 hover:border-slate-600 transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Users className="h-4.5 w-4.5 text-blue-400 shrink-0" />
            <kbd className="rounded-lg bg-blue-500/20 px-2 py-0.5 text-blue-400 font-mono font-black text-xs">F2</kbd>
            <span>Cliente</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDiscountInput(discount)
              setShowDiscountModal(true)
            }}
            className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-3.5 py-2.5 text-slate-100 font-bold border border-slate-700 hover:border-slate-600 transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Tag className="h-4.5 w-4.5 text-amber-400 shrink-0" />
            <kbd className="rounded-lg bg-amber-500/20 px-2 py-0.5 text-amber-400 font-mono font-black text-xs">F3</kbd>
            <span>Desconto</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (cart.length > 0) setShowCancelSaleModal(true)
            }}
            disabled={cart.length === 0}
            className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-rose-950/70 hover:border-rose-600/50 px-3.5 py-2.5 text-slate-200 hover:text-rose-200 font-bold border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="h-4.5 w-4.5 text-rose-400 shrink-0" />
            <kbd className="rounded-lg bg-rose-500/20 px-2 py-0.5 text-rose-400 font-mono font-black text-xs">F4</kbd>
            <span>Cancelar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMovementType('supply')
              setShowMovementModal(true)
            }}
            className="hidden xl:flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-3.5 py-2.5 text-slate-100 font-bold border border-slate-700 hover:border-slate-600 transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <ArrowDownCircle className="h-4.5 w-4.5 text-cyan-400 shrink-0" />
            <kbd className="rounded-lg bg-cyan-500/20 px-2 py-0.5 text-cyan-400 font-mono font-black text-xs">F7</kbd>
            <span>Suprimento</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMovementType('bleed')
              setShowMovementModal(true)
            }}
            className="hidden xl:flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-3.5 py-2.5 text-slate-100 font-bold border border-slate-700 hover:border-slate-600 transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <ArrowUpCircle className="h-4.5 w-4.5 text-purple-400 shrink-0" />
            <kbd className="rounded-lg bg-purple-500/20 px-2 py-0.5 text-purple-400 font-mono font-black text-xs">F8</kbd>
            <span>Sangria</span>
          </button>

          <button
            type="button"
            onClick={handleOpenQuantityModal}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 font-bold border transition-all shadow-xs cursor-pointer whitespace-nowrap ${
              nextItemQuantity > 0
                ? quantityOperation === 'subtract'
                  ? 'bg-rose-500/20 text-rose-200 border-rose-500 ring-2 ring-rose-500/40 animate-pulse'
                  : 'bg-amber-500/20 text-amber-200 border-amber-500 ring-2 ring-amber-500/40 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 hover:border-slate-600'
            }`}
          >
            <Hash className="h-4.5 w-4.5 text-amber-400 shrink-0" />
            <kbd className={`rounded-lg px-2 py-0.5 font-mono font-black text-xs ${
              quantityOperation === 'subtract' && nextItemQuantity > 0 ? 'bg-rose-500/30 text-rose-300' : 'bg-amber-500/20 text-amber-400'
            }`}>
              F9
            </kbd>
            <span>
              {nextItemQuantity > 0
                ? `${quantityOperation === 'subtract' ? 'Subtrair' : 'Multiplicar'} (${nextItemQuantity}x)`
                : 'Quantidade'}
            </span>
          </button>
        </div>

        {/* ATALHO TECLA F12: FECHAMENTO DE CAIXA */}
        <div>
          <button
            type="button"
            onClick={handleOpenCloseSession}
            className="flex items-center gap-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 px-5 py-3 text-white font-black text-sm tracking-wide border border-rose-400/60 shadow-lg shadow-rose-950/60 transition-all cursor-pointer whitespace-nowrap"
          >
            <Lock className="h-5 w-5 text-white" />
            <kbd className="rounded-lg bg-white/20 px-2 py-0.5 text-white font-mono font-black text-xs">F12</kbd>
            <span>FECHAR CAIXA</span>
          </button>
        </div>
      </footer>

      {/* ============================================================== */}
      {/* 4. MODAL DE ABERTURA DE CAIXA (OBRIGATÓRIO QUANDO NÃO HOUVER)   */}
      {/* ============================================================== */}
      {showOpenSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="rounded-xl bg-emerald-500/20 p-2 text-emerald-400">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Abertura de Caixa (PDV)</h3>
                <p className="text-xs text-slate-400">Inicie um novo turno para operar o terminal</p>
              </div>
            </div>

            <form onSubmit={handleOpenSession} className="mt-5 space-y-4">
              {openSessionError && (
                <div className="rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-400 border border-rose-500/20 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{openSessionError}</span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-400">
                    Terminal / Caixa PDV
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInlineNewRegister((prev) => !prev)
                      setOpenSessionError(null)
                    }}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
                  >
                    {showInlineNewRegister ? 'Cancelar novo caixa' : '+ Cadastrar novo caixa'}
                  </button>
                </div>

                {showInlineNewRegister ? (
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="text"
                      value={inlineNewRegisterName}
                      onChange={(e) => setInlineNewRegisterName(e.target.value)}
                      placeholder="Ex.: Caixa 02, Balcão..."
                      className="flex-1 rounded-xl bg-slate-950 px-3 py-2 text-sm text-white border border-slate-700 focus:border-emerald-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      disabled={isCreatingInlineRegister}
                      onClick={() => {
                        void handleCreateInlineRegister()
                      }}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                    >
                      {isCreatingInlineRegister ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedRegister}
                    onChange={(e) => {
                      void handleSelectTerminalInModal(e.target.value)
                    }}
                    className="mt-1 w-full rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-200 border border-slate-800 focus:border-emerald-500 focus:outline-hidden"
                  >
                    {registers.map((reg) => (
                      <option key={reg.id} value={reg.name}>
                        {reg.name}
                        {reg.description ? ` — ${reg.description}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400">Operador Logado</label>
                <input
                  type="text"
                  readOnly
                  value={profile?.displayName || user?.email?.split('@')[0] || 'Operador'}
                  className="mt-1 w-full rounded-xl bg-slate-950 px-3 py-2 text-sm text-slate-300 border border-slate-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400">
                  Saldo Inicial / Fundo de Troco (R$)
                </label>
                <input
                  type="text"
                  autoFocus
                  value={openingBalanceInput}
                  onChange={(e) => { setOpeningBalanceInput(formatCurrencyInput(e.target.value)); }}
                  onFocus={(e) => e.target.select()}
                  placeholder="0,00"
                  className="mt-1 w-full rounded-xl bg-slate-950 px-3 py-2.5 text-lg font-bold text-emerald-400 font-mono border border-slate-800 focus:border-emerald-500 focus:outline-hidden"
                />
                <span className="text-[11px] text-slate-500">
                  Informe o valor das moedas e cédulas deixadas na gaveta para troco.
                </span>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Abrir Caixa e Iniciar Operação</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. MODAL DE FINALIZAÇÃO DA VENDA (FORMAS DE PAGAMENTO)         */}
      {/* ============================================================== */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Finalização de Venda</h3>
                <p className="text-xs text-slate-400">Selecione a forma de pagamento pelo teclado</p>
              </div>
              <button
                type="button"
                onClick={() => { setShowPaymentModal(false); }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* TOTAL DA VENDA */}
            <div className="my-4 rounded-xl bg-slate-950 p-4 border border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase">Total a Receber:</span>
              <span className="font-mono text-3xl font-black text-emerald-400">
                {formatCurrency(grandTotal)}
              </span>
            </div>

            {saleError && (
              <div className="mb-4 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-400 border border-rose-500/20 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{saleError}</span>
              </div>
            )}

            {/* SELEÇÃO DAS FORMAS DE PAGAMENTO */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedPaymentMethod('money')
                  setShowCardTypeSelection(false)
                }}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl p-3 border font-semibold text-xs transition-all ${
                  selectedPaymentMethod === 'money'
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-400'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <DollarSign className="h-6 w-6" />
                <span>[D] Dinheiro</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedPaymentMethod('pix')
                  setShowCardTypeSelection(false)
                }}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl p-3 border font-semibold text-xs transition-all ${
                  selectedPaymentMethod === 'pix'
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-400'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <QrCode className="h-6 w-6" />
                <span>[P] Pix</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedPaymentMethod('credit_card')
                  setShowCardTypeSelection(true)
                }}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl p-3 border font-semibold text-xs transition-all ${
                  selectedPaymentMethod === 'credit_card' || selectedPaymentMethod === 'debit_card'
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-400'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Receipt className="h-6 w-6" />
                <span>[C] Cartão</span>
              </button>
            </div>

            {/* DETALHES POR FORMA DE PAGAMENTO */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {/* SELEÇÃO DO CARTÃO: CRÉDITO OU DÉBITO */}
              {showCardTypeSelection && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                  <span className="text-xs font-bold text-slate-300">Modalidade do Cartão:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCardType('credit')
                        setShowCardTypeSelection(false)
                      }}
                      className={`rounded-lg p-2 text-xs font-bold border ${
                        cardType === 'credit'
                          ? 'border-emerald-500 bg-emerald-950/40 text-emerald-400'
                          : 'border-slate-800 bg-slate-900 text-slate-400'
                      }`}
                    >
                      [C] Crédito
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCardType('debit')
                        setShowCardTypeSelection(false)
                      }}
                      className={`rounded-lg p-2 text-xs font-bold border ${
                        cardType === 'debit'
                          ? 'border-emerald-500 bg-emerald-950/40 text-emerald-400'
                          : 'border-slate-800 bg-slate-900 text-slate-400'
                      }`}
                    >
                      [D] Débito
                    </button>
                  </div>
                </div>
              )}

              {/* DETALHE DINHEIRO: VALOR RECEBIDO E TROCO */}
              {selectedPaymentMethod === 'money' && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400">
                      Valor Recebido em Dinheiro (R$)
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={amountReceivedInput}
                      onChange={(e) => { setAmountReceivedInput(e.target.value); }}
                      placeholder="0,00"
                      className="mt-1 w-full rounded-xl bg-slate-900 px-3 py-2 text-xl font-bold font-mono text-white border border-slate-700 focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  {/* DISPLAY DE TROCO */}
                  <div className="flex items-center justify-between rounded-lg bg-slate-900 p-3 border border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase">Troco:</span>
                    <span
                      className={`font-mono text-2xl font-black ${
                        cashChange.isSufficient ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {cashChange.isSufficient
                        ? formatCurrency(cashChange.change)
                        : `Faltam ${formatCurrency(cashChange.missing)}`}
                    </span>
                  </div>
                </div>
              )}

              {/* DETALHE PIX */}
              {selectedPaymentMethod === 'pix' && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center space-y-2">
                  <QrCode className="h-16 w-16 text-emerald-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-300">
                    Chave Pix disponível no balcão da loja
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Confirme o recebimento do comprovante no aplicativo bancário do cliente antes de liberar.
                  </p>
                </div>
              )}

              {/* DETALHE CARTÃO CONFIRMADO */}
              {(selectedPaymentMethod === 'credit_card' || selectedPaymentMethod === 'debit_card') && !showCardTypeSelection && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center space-y-1">
                  <Receipt className="h-12 w-12 text-blue-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-200">
                    Cartão de {cardType === 'credit' ? 'Crédito' : 'Débito'}
                  </p>
                  <p className="text-xs text-slate-400">
                    Insira ou aproxime o cartão na maquininha de pagamento.
                  </p>
                </div>
              )}
            </div>

            {/* BOTÃO CONFIRMAR PAGAMENTO */}
            <div className="pt-4 border-t border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={() => { setShowPaymentModal(false); }}
                className="flex-1 rounded-xl bg-slate-800 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
              >
                [Esc] Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSale}
                disabled={isSubmittingSale || (selectedPaymentMethod === 'money' && !cashChange.isSufficient)}
                className="flex-2 rounded-xl bg-emerald-600 py-3 text-sm font-black text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/40 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                {isSubmittingSale ? (
                  <span>Registrando Venda...</span>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    <span>[Enter] Confirmar Venda</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. MODAL DE FECHAMENTO DE CAIXA (TECLA 9 — PROCEDIMENTO OFICIAL)*/}
      {/* ============================================================== */}
      {showCloseModal && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-rose-500/20 p-2 text-rose-400">
                  <Lock className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Fechamento de Caixa — Tecla F12</h3>
                  <p className="text-xs text-slate-400">
                    Conferência obrigatória dos valores físicos antes de encerrar o turno
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCloseModal(false)
                  focusBarcodeInput()
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              {closureError && (
                <div className="rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-400 border border-rose-500/20 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{closureError}</span>
                </div>
              )}

              {/* CABEÇALHO DO TURNO */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl bg-slate-950 p-3 border border-slate-800 text-[11px]">
                <div>
                  <span className="text-slate-400">Operador:</span>
                  <p className="font-bold text-white truncate">{session.operatorName}</p>
                </div>
                <div>
                  <span className="text-slate-400">Terminal:</span>
                  <p className="font-bold text-white">{session.registerId}</p>
                </div>
                <div>
                  <span className="text-slate-400">Abertura:</span>
                  <p className="font-bold text-white">
                    {new Date(session.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Fechamento:</span>
                  <p className="font-bold text-emerald-400">{currentTime.toLocaleTimeString('pt-BR')}</p>
                </div>
              </div>

              {/* RESUMO FINANCEIRO DO TURNO */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Resumo Financeiro da Sessão
                </span>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs pt-1">
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-400">Saldo Inicial (Troco):</span>
                    <span className="text-slate-200">{formatCurrency(session.openingBalance)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-400">Total Vendas ({session.salesCount}):</span>
                    <span className="text-emerald-400 font-bold">{formatCurrency(session.totalSales)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-400">Recebido em Dinheiro:</span>
                    <span className="text-slate-200">{formatCurrency(session.totalMoney)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-400">Recebido via Pix:</span>
                    <span className="text-slate-200">{formatCurrency(session.totalPix)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-400">Cartão de Crédito:</span>
                    <span className="text-slate-200">{formatCurrency(session.totalCreditCard)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-400">Cartão de Débito:</span>
                    <span className="text-slate-200">{formatCurrency(session.totalDebitCard)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-400">Entradas / Suprimentos (+):</span>
                    <span className="text-cyan-400">{formatCurrency(session.totalAdditionalEntries)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-400">Retiradas / Sangrias (-):</span>
                    <span className="text-rose-400">{formatCurrency(session.totalWithdrawals)}</span>
                  </div>
                </div>
              </div>

              {/* VALOR ESPERADO EM DINHEIRO */}
              <div className="flex items-center justify-between rounded-xl bg-slate-950 p-4 border border-slate-800">
                <div>
                  <span className="text-xs font-bold text-slate-300 uppercase">
                    Valor Esperado em Dinheiro na Gaveta:
                  </span>
                  <p className="text-[10px] text-slate-500">
                    Saldo inicial + vendas dinheiro + suprimentos - sangrias
                  </p>
                </div>
                <span className="font-mono text-2xl font-black text-emerald-400">
                  {formatCurrency(session.expectedMoney)}
                </span>
              </div>

              {/* CONTAGEM FÍSICA INFORMADA PELO OPERADOR */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-white uppercase">
                    Informe o Valor Físico Contado em Dinheiro (R$)
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={countedMoneyInput}
                    onChange={(e) => { setCountedMoneyInput(formatCurrencyInput(e.target.value)); }}
                    onFocus={(e) => e.target.select()}
                    placeholder="0,00"
                    className="mt-1 w-full rounded-xl bg-slate-900 px-3 py-2 text-xl font-bold font-mono text-emerald-400 border border-slate-700 focus:border-emerald-500 focus:outline-hidden"
                  />
                  <span className="text-[11px] text-slate-500">
                    Conte todas as notas e moedas presentes na gaveta e digite o valor total.
                  </span>
                </div>

                {/* RESULTADO DA CONCILIAÇÃO EM TEMPO REAL */}
                {reconciliation && countedMoneyInput.trim() !== '' && (
                  <div
                    className={`rounded-xl p-3 border flex items-center justify-between ${
                      reconciliation.discrepancyType === 'correct'
                        ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                        : reconciliation.discrepancyType === 'surplus'
                        ? 'border-amber-500/40 bg-amber-950/40 text-amber-300'
                        : 'border-rose-500/40 bg-rose-950/40 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {reconciliation.discrepancyType === 'correct' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                      )}
                      <div>
                        <p className="font-bold">
                          {reconciliation.discrepancyType === 'correct' && 'Caixa Correto: valores conferidos!'}
                          {reconciliation.discrepancyType === 'surplus' && 'Sobra de Caixa identificada'}
                          {reconciliation.discrepancyType === 'shortage' && 'Falta de Caixa identificada'}
                        </p>
                        <p className="text-[11px] opacity-80">
                          Tentativa de conferência: #{conferenceAttempts}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-base font-black">
                      {reconciliation.discrepancyType === 'correct'
                        ? 'R$ 0,00'
                        : `${reconciliation.discrepancyType === 'surplus' ? '+' : '-'} ${formatCurrency(
                            reconciliation.formattedDifference,
                          )}`}
                    </span>
                  </div>
                )}

                {/* JUSTIFICATIVA OBRIGATÓRIA SE HOUVER DIVERGÊNCIA */}
                {reconciliation && !reconciliation.isBalanced && countedMoneyInput.trim() !== '' && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div>
                      <label className="block text-xs font-bold text-amber-400">
                        Justificativa da Divergência (Obrigatória):
                      </label>
                      <textarea
                        rows={2}
                        value={closureJustification}
                        onChange={(e) => { setClosureJustification(e.target.value); }}
                        placeholder="Explique o motivo da sobra ou falta de caixa encontrada..."
                        className="mt-1 w-full rounded-xl bg-slate-900 p-2 text-xs text-white border border-slate-700 focus:border-amber-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400">
                        Autorização do Supervisor / Gerente (Opcional):
                      </label>
                      <input
                        type="text"
                        value={supervisorAuthInput}
                        onChange={(e) => { setSupervisorAuthInput(e.target.value); }}
                        placeholder="Nome ou código do supervisor autorizador"
                        className="mt-1 w-full rounded-xl bg-slate-900 px-3 py-1.5 text-xs text-white border border-slate-700 focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* BOTÕES DE AÇÃO DO FECHAMENTO */}
            <div className="pt-3 border-t border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCloseModal(false)
                  focusBarcodeInput()
                }}
                className="flex-1 rounded-xl bg-slate-800 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
              >
                [Esc] Retornar ao PDV
              </button>
              <button
                type="button"
                onClick={handleConfirmCloseSession}
                disabled={isClosingSession}
                className="flex-2 rounded-xl bg-rose-600 py-3 text-xs font-black text-white hover:bg-rose-500 shadow-lg shadow-rose-900/40 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                {isClosingSession ? (
                  <span>Fechando Turno...</span>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>[Enter] Confirmar e Encerrar Caixa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. RELATÓRIO DO FECHAMENTO DE CAIXA APÓS CONCLUSÃO             */}
      {/* ============================================================== */}
      {closedSessionReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-center space-y-4">
            <div className="rounded-full bg-emerald-500/20 p-3 text-emerald-400 w-12 h-12 mx-auto flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Caixa Encerrado com Sucesso!</h3>
              <p className="text-xs text-slate-400 mt-1">
                A sessão do operador foi fechada e os registros foram persistidos no sistema.
              </p>
            </div>

            <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 text-left font-mono text-xs space-y-1.5">
              <p><span className="text-slate-400">Terminal:</span> {closedSessionReport.registerId}</p>
              <p><span className="text-slate-400">Operador:</span> {closedSessionReport.operatorName}</p>
              <p><span className="text-slate-400">Vendas:</span> {closedSessionReport.salesCount} ({formatCurrency(closedSessionReport.totalSales)})</p>
              <p><span className="text-slate-400">Dinheiro Físico:</span> {formatCurrency(closedSessionReport.countedMoney || '0')}</p>
              <p><span className="text-slate-400">Divergência:</span> {closedSessionReport.difference || '0.00'}</p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => { void handleExitToSales(); }}
                className="flex-1 rounded-xl bg-slate-800 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                [Esc] Sair do PDV
              </button>
              <button
                type="button"
                onClick={handlePrintAndExit}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>[Enter] Imprimir e Sair</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 8. MODAL SELECIONAR CLIENTE (F2)                               */}
      {/* ============================================================== */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">[F2] Selecionar Cliente</h3>
                <p className="text-[11px] text-slate-400">Navegue com [↑/↓] e pressione [Enter] para selecionar</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCustomerModal(false)
                  focusBarcodeInput()
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="my-3">
              <input
                ref={customerSearchInputRef}
                type="text"
                autoFocus
                placeholder="Buscar por nome, CPF ou telefone..."
                value={customerSearchQuery}
                onChange={(e) => { setCustomerSearchQuery(e.target.value); }}
                className="w-full rounded-xl bg-slate-950 px-3 py-2 text-xs text-white border border-slate-700 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800 text-xs">
              {customerCandidates.map((candidate, idx) => {
                const isSelected = idx === customerSelectedIndex
                return (
                  <button
                    key={candidate.id || 'default'}
                    type="button"
                    onClick={() => {
                      if (candidate.isDefault) {
                        setSelectedCustomerId('')
                        setCustomerName('Consumidor Final')
                        setCustomerDocument('')
                      } else {
                        setSelectedCustomerId(candidate.id)
                        setCustomerName(candidate.name)
                        setCustomerDocument(candidate.document || '')
                      }
                      setShowCustomerModal(false)
                      focusBarcodeInput()
                    }}
                    className={`w-full py-2.5 px-3 text-left transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-600/20 text-blue-200 border-l-4 border-blue-500 pl-2 font-medium'
                        : 'hover:bg-slate-800/50 text-slate-200'
                    }`}
                  >
                    <div>
                      <p className="font-semibold flex items-center gap-1.5">
                        {candidate.name}
                        {candidate.isDefault && (
                          <span className="text-[10px] text-emerald-400 font-mono font-normal">(Padrão)</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        {candidate.document && <span>CPF: {candidate.document}</span>}
                        {candidate.phone && (
                          <span className="flex items-center gap-0.5 text-emerald-400 font-mono">
                            <Phone className="h-2.5 w-2.5" />
                            {candidate.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 ${isSelected ? 'text-blue-400' : 'text-slate-600'}`} />
                  </button>
                )
              })}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400 font-mono">
              <span>[↑/↓] Navegar • [Enter] Selecionar</span>
              <button
                type="button"
                onClick={() => {
                  setShowCustomerModal(false)
                  focusBarcodeInput()
                }}
                className="hover:text-white"
              >
                [Esc] Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 9. MODAL DE DESCONTO (F3)                                      */}
      {/* ============================================================== */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">[F3] Aplicar Desconto</h3>
            <div>
              <label className="block text-xs text-slate-400">Valor do Desconto (R$)</label>
              <input
                type="text"
                autoFocus
                value={discountInput}
                onChange={(e) => { setDiscountInput(formatCurrencyInput(e.target.value)); }}
                onFocus={(e) => e.target.select()}
                placeholder="0,00"
                className="mt-1 w-full rounded-xl bg-slate-950 px-3 py-2 text-lg font-bold font-mono text-rose-400 border border-slate-700 focus:outline-hidden"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDiscountModal(false)
                  focusBarcodeInput()
                }}
                className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscount(discountInput)
                  setShowDiscountModal(false)
                  focusBarcodeInput()
                }}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 10. MODAL CANCELAR VENDA (F4)                                  */}
      {/* ============================================================== */}
      {showCancelSaleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl text-center space-y-4">
            <div className="rounded-full bg-rose-500/20 p-3 text-rose-400 w-12 h-12 mx-auto flex items-center justify-center">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-white">Cancelar Venda Atual?</h3>
            <p className="text-xs text-slate-400">
              Todos os {cart.length} itens serão removidos do carrinho e a operação será cancelada.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCancelSaleModal(false)
                  focusBarcodeInput()
                }}
                className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-slate-300"
              >
                [Esc] Não
              </button>
              <button
                type="button"
                onClick={() => {
                  setCart([])
                  setDiscount('0,00')
                  setLastScannedItem(null)
                  setShowCancelSaleModal(false)
                  pdvSound.playError()
                  focusBarcodeInput()
                }}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-500"
              >
                [Enter] Sim, Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 11. MODAL SUPRIMENTO (F7) / SANGRIA (F8)                       */}
      {/* ============================================================== */}
      {showMovementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">
              {movementType === 'supply' ? '[F7] Suprimento de Caixa (Troco)' : '[F8] Sangria de Caixa (Retirada)'}
            </h3>
            <div>
              <label className="block text-xs text-slate-400">Valor (R$)</label>
              <input
                type="text"
                autoFocus
                value={movementAmountInput}
                onChange={(e) => { setMovementAmountInput(formatCurrencyInput(e.target.value)); }}
                onFocus={(e) => e.target.select()}
                placeholder="0,00"
                className="mt-1 w-full rounded-xl bg-slate-950 px-3 py-2 text-lg font-bold font-mono text-white border border-slate-700 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400">Motivo</label>
              <input
                type="text"
                value={movementReasonInput}
                onChange={(e) => { setMovementReasonInput(e.target.value); }}
                placeholder={movementType === 'supply' ? 'Ex: Reforço de troco da manhã' : 'Ex: Recolhimento para o cofre'}
                className="mt-1 w-full rounded-xl bg-slate-950 px-3 py-2 text-xs text-white border border-slate-700 focus:outline-hidden"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowMovementModal(false)
                  focusBarcodeInput()
                }}
                className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmMovement}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      
      {/* ============================================================== */}
      {/* MODAL DE QUANTIDADE (F9)                                       */}
      {/* ============================================================== */}
      {showQuantityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className={`rounded-lg p-1.5 ${
                  modalOperation === 'subtract' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  <Hash className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">[F9] Quantidade de Itens</h3>
                  <p className="text-[11px] text-slate-400">Defina a operação e a quantidade para a próxima leitura</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowQuantityModal(false)
                  focusBarcodeInput()
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmQuantity} className="space-y-4">
              {/* SELEÇÃO DA OPERAÇÃO: MULTIPLICAR OU SUBTRAIR */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Operação para a próxima leitura:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOperation('multiply')}
                    className={`flex items-center justify-center gap-2 rounded-xl p-3 border font-bold text-xs transition-all ${
                      modalOperation === 'multiply'
                        ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 ring-2 ring-emerald-500/40'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Plus className="h-4 w-4" />
                    <div className="text-left">
                      <p className="leading-none">Multiplicar</p>
                      <span className="text-[10px] font-normal text-slate-400">[M] Próxima leitura</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalOperation('subtract')}
                    className={`flex items-center justify-center gap-2 rounded-xl p-3 border font-bold text-xs transition-all ${
                      modalOperation === 'subtract'
                        ? 'border-rose-500 bg-rose-950/40 text-rose-300 ring-2 ring-rose-500/40'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Minus className="h-4 w-4" />
                    <div className="text-left">
                      <p className="leading-none">Subtrair</p>
                      <span className="text-[10px] font-normal text-slate-400">[S] Próxima leitura</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* INPUT DE QUANTIDADE */}
              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  {modalOperation === 'multiply' ? 'Multiplicar por (UN):' : 'Subtrair quantidade (UN):'}
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  autoFocus
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  placeholder="Ex: 5"
                  className={`mt-1.5 w-full rounded-xl bg-slate-950 px-4 py-3 text-2xl font-bold font-mono border focus:outline-hidden ${
                    modalOperation === 'subtract'
                      ? 'text-rose-400 border-slate-700 focus:border-rose-500'
                      : 'text-amber-400 border-slate-700 focus:border-emerald-500'
                  }`}
                />
                <span className="text-[11px] text-slate-400 mt-1.5 block">
                  {modalOperation === 'multiply'
                    ? 'O próximo código de barras lido adicionará esta quantidade e retornará a zero na leitura seguinte.'
                    : 'O próximo código de barras lido deduzirá esta quantidade do carrinho e retornará a zero na leitura seguinte.'}
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuantityModal(false)
                    focusBarcodeInput()
                  }}
                  className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  [Esc] Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex-1 rounded-xl py-2.5 text-xs font-bold text-white shadow-lg transition-colors flex items-center justify-center gap-1.5 ${
                    modalOperation === 'subtract'
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/40'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>[Enter] Confirmar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 12. COMPROVANTE DE VENDA (INTEGRADO COM SALERECEIPTMODAL)      */}
      {/* ============================================================== */}
      <SaleReceiptModal
        open={showReceiptModal}
        sale={completedSale}
        onClose={() => {
          setShowReceiptModal(false)
          focusBarcodeInput()
        }}
      />

      {/* ============================================================== */}
      {/* COMPROVANTE DE ENCERRAMENTO DE CAIXA (IMPRESSÃO TÉRMICA / A4) */}
      {/* ============================================================== */}
      {closedSessionReport && (
        <>
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              .pdv-closure-receipt-print, .pdv-closure-receipt-print * {
                visibility: visible !important;
              }
              .pdv-closure-receipt-print {
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 80mm !important;
                background: #ffffff !important;
                color: #000000 !important;
                padding: 4mm !important;
                font-family: monospace !important;
                font-size: 11px !important;
                line-height: 1.35 !important;
              }
            }
          `}</style>

          <div className="pdv-closure-receipt-print" style={{ display: 'none' }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '8px' }}>
              <p style={{ fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase' }}>
                {currentOrganization?.name || 'JB GESTÃO COMERCIAL'}
              </p>
              <p style={{ fontWeight: 'bold', fontSize: '11px', marginTop: '2px' }}>
                COMPROVANTE DE FECHAMENTO DE CAIXA
              </p>
              <p style={{ fontSize: '10px', marginTop: '2px' }}>
                DEMONSTRATIVO DE ENCERRAMENTO DE TURNO
              </p>
            </div>

            <div style={{ borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px', fontSize: '10px', lineHeight: '1.4' }}>
              <p><strong>TERMINAL:</strong> {closedSessionReport.registerId}</p>
              <p><strong>OPERADOR:</strong> {closedSessionReport.operatorName}</p>
              <p>
                <strong>ABERTURA:</strong>{' '}
                {new Date(closedSessionReport.openedAt).toLocaleString('pt-BR')}
              </p>
              <p>
                <strong>FECHAMENTO:</strong>{' '}
                {closedSessionReport.closedAt
                  ? new Date(closedSessionReport.closedAt).toLocaleString('pt-BR')
                  : new Date().toLocaleString('pt-BR')}
              </p>
            </div>

            <div style={{ borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px', fontSize: '10px', lineHeight: '1.4' }}>
              <p style={{ fontWeight: 'bold', textAlign: 'center', marginBottom: '4px' }}>
                -- RESUMO FINANCEIRO DO TURNO --
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>SALDO INICIAL (TROCO):</span>
                <strong>{formatCurrency(closedSessionReport.openingBalance)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>QTD. TOTAL DE VENDAS:</span>
                <strong>{closedSessionReport.salesCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>TOTAL BRUTO DE VENDAS:</span>
                <strong>{formatCurrency(closedSessionReport.totalSales)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                <span>• EM DINHEIRO:</span>
                <span>{formatCurrency(closedSessionReport.totalMoney)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                <span>• EM PIX:</span>
                <span>{formatCurrency(closedSessionReport.totalPix)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                <span>• CARTÃO DE CRÉDITO:</span>
                <span>{formatCurrency(closedSessionReport.totalCreditCard)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                <span>• CARTÃO DE DÉBITO:</span>
                <span>{formatCurrency(closedSessionReport.totalDebitCard)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>SUPRIMENTOS (+):</span>
                <span>{formatCurrency(closedSessionReport.totalAdditionalEntries)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>SANGRIAS (-):</span>
                <span>{formatCurrency(closedSessionReport.totalWithdrawals)}</span>
              </div>
            </div>

            <div style={{ borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px', fontSize: '10px', lineHeight: '1.4' }}>
              <p style={{ fontWeight: 'bold', textAlign: 'center', marginBottom: '4px' }}>
                -- CONCILIAÇÃO DA GAVETA (DINHEIRO) --
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>VALOR ESPERADO EM DINHEIRO:</span>
                <strong>{formatCurrency(closedSessionReport.expectedMoney)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>VALOR FÍSICO CONTADO:</span>
                <strong>{formatCurrency(closedSessionReport.countedMoney || '0')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>DIVERGÊNCIA / QUEBRA:</span>
                <strong>{closedSessionReport.difference || '0.00'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                <span>SITUAÇÃO DO CAIXA:</span>
                <strong>
                  {closedSessionReport.difference === '0.00'
                    ? 'CONFERIDO / CORRETO'
                    : parseFloat(closedSessionReport.difference || '0') > 0
                    ? 'SOBRA DE CAIXA'
                    : 'FALTA DE CAIXA'}
                </strong>
              </div>
              {closedSessionReport.discrepancyJustification && (
                <p style={{ marginTop: '4px', fontSize: '9px' }}>
                  <strong>JUSTIFICATIVA:</strong> {closedSessionReport.discrepancyJustification}
                </p>
              )}
              {closedSessionReport.supervisorAuthorizedBy && (
                <p style={{ marginTop: '2px', fontSize: '9px' }}>
                  <strong>SUPERVISOR:</strong> {closedSessionReport.supervisorAuthorizedBy}
                </p>
              )}
            </div>

            <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '9px' }}>
              <p style={{ marginBottom: '24px' }}>
                __________________________________________<br />
                Assinatura do Operador ({closedSessionReport.operatorName})
              </p>
              <p style={{ marginBottom: '16px' }}>
                __________________________________________<br />
                Visto da Supervisão / Gerência
              </p>
              <p style={{ fontSize: '8px', color: '#555' }}>
                Impresso em: {new Date().toLocaleString('pt-BR')} • PDV JB Software
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
