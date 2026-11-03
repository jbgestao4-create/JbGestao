import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { customerService, type Customer } from '@modules/customers/services/customer.service'
import { inventoryService } from '@modules/inventory/services/inventory.service'
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
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Package,
  Plus,
  QrCode,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  User,
  Zap,
} from 'lucide-react'
import {
  salesService,
  type PaymentMethod,
  type SaleDetail,
  PAYMENT_METHOD_LABELS,
} from '../services/sales.service'
import { SaleReceiptModal } from '../components/SaleReceiptModal'

interface CartItem {
  id: string
  inventoryItemId?: string
  description: string
  unit: string
  quantity: string
  unitPrice: string
  total: string
  availableStock?: string
  sku?: string
}

export function SaleFormPage() {
  const { currentOrganization } = useOrganization()
  const navigate = useNavigate()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])

  // Cliente
  const [isConsumidorFinal, setIsConsumidorFinal] = useState(true)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [customerName, setCustomerName] = useState('Consumidor Final')
  const [customerDocument, setCustomerDocument] = useState('')

  // Itens da venda
  const [cart, setCart] = useState<CartItem[]>([])

  // Busca e seleção rápida de produto
  const [productQuery, setProductQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null)
  const [itemQuantity, setItemQuantity] = useState('1')
  const [itemUnitPrice, setItemUnitPrice] = useState('')

  // Pagamento e Totais
  const [discount, setDiscount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('money')
  const [emitFiscalNow, setEmitFiscalNow] = useState(true)
  const [notes, setNotes] = useState('')

  // Estado de envio e resultado
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedSale, setCompletedSale] = useState<SaleDetail | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)

  useEffect(() => {
    if (!currentOrganization) return

    let active = true

    void Promise.all([
      customerService.list(currentOrganization.id),
      inventoryService.list(currentOrganization.id),
    ]).then(([custRes, invRes]) => {
      if (!active) return
      if (custRes.success) setCustomers(custRes.data)
      if (invRes.success) {
        setInventoryItems(
          invRes.data.filter(
            (i: InventoryItem) =>
              i.isActive && i.canSell && i.registrationStatus !== 'awaiting_information',
          ),
        )
      }
    })

    return () => {
      active = false
    }
  }, [currentOrganization])

  // Produtos filtrados pelo campo de busca
  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    if (!q) return []
    return inventoryItems
      .filter((i) => {
        if (!i.canSell || i.registrationStatus === 'awaiting_information') return false
        const matchName = i.name.toLowerCase().includes(q)
        const matchSku = i.sku.toLowerCase().includes(q)
        const matchBarcode = i.barcode?.toLowerCase().includes(q) || false
        return matchName || matchSku || matchBarcode
      })
      .slice(0, 8)
  }, [productQuery, inventoryItems])

  const handleSelectProduct = (product: InventoryItem) => {
    if (!product.canSell || product.registrationStatus === 'awaiting_information') {
      setError(
        `O produto "${product.name}" está com status "Aguardando informação" e não pode ser utilizado em vendas até ser concluído no estoque.`,
      )
      return
    }
    setSelectedProduct(product)
    setProductQuery(product.name)
    const salePrice = Number(product.unitPrice) > 0 ? Number(product.unitPrice).toFixed(2) : ''
    setItemUnitPrice(salePrice)
  }

  const handleAddToCart = () => {
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
  const subtotal = useMemo(() => calculateSubtotal(cart.map((c) => c.total)), [cart])
  const total = useMemo(() => calculateTotal(subtotal, discount || '0.00'), [subtotal, discount])

  const handleFinalizeSale = async () => {
    if (!currentOrganization) return

    if (cart.length === 0) {
      setError('Adicione pelo menos um produto ao carrinho antes de finalizar.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const params = {
      customerId: isConsumidorFinal ? undefined : selectedCustomerId || undefined,
      customerName: isConsumidorFinal ? 'Consumidor Final' : customerName,
      customerDocument: isConsumidorFinal ? undefined : customerDocument,
      items: cart.map((it) => ({
        inventoryItemId: it.inventoryItemId,
        description: it.description,
        unit: it.unit,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
      discount: discount || '0.00',
      paymentMethod,
      notes,
      isPdv: true,
      emitFiscalNow,
      fiscalType: 'nfce' as const,
    }

    const res = await salesService.createSale(currentOrganization.id, params)
    setIsSubmitting(false)

    if (res.success) {
      // Carrega os detalhes para o recibo
      const detailRes = await salesService.getSaleById(currentOrganization.id, res.data.saleId)
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
                Frente de Caixa (PDV)
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

          {/* Card: Adicionar Produtos do Estoque */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Package className="h-4 w-4 text-blue-600" />
                <span>Adicionar Produtos ao Carrinho</span>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Campo de Busca Rápida / Código de Barras */}
              <div className="relative">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Localizar por Nome, Código SKU ou Código de Barras (EAN):
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={productQuery}
                    onChange={(e) => {
                      setProductQuery(e.target.value)
                      if (selectedProduct) setSelectedProduct(null)
                    }}
                    placeholder="Digite o nome do produto ou escaneie o código de barras..."
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Dropdown de Resultados da Busca */}
                {filteredProducts.length > 0 && !selectedProduct && (
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
              </div>

              {selectedProduct && (
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

              {/* Quantidade e Valor Unitário */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <Input
                  label={`Quantidade (${selectedProduct?.unit || 'UN'})`}
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
                  className="h-10 gap-2 bg-blue-600 hover:bg-blue-700"
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
                  Nenhum produto adicionado à venda até o momento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/70 text-gray-500 uppercase tracking-wide">
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
                  <span>Subtotal:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(subtotal)}</span>
                </div>
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

              {/* Opção Fiscal */}
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

              {/* Botão de Finalizar Venda */}
              <Button
                type="button"
                size="lg"
                isLoading={isSubmitting}
                onClick={() => void handleFinalizeSale()}
                disabled={cart.length === 0}
                className="w-full justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 text-sm shadow-md transition"
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Finalizar Venda &amp; Baixar Estoque
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
