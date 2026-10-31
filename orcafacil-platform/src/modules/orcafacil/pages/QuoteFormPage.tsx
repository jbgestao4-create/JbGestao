import { useEffect, useState, type SyntheticEvent } from 'react'
import { useNavigate, Link, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { customerService, type Customer } from '@modules/customers/services/customer.service'
import { inventoryService } from '@modules/inventory/services/inventory.service'
import type { InventoryItem } from '@shared/types/common'
import { formatCustomerDocument } from '@modules/customers/utils/customer-document'
import { quoteService } from '../services/quote.service'
import { canEditQuote } from '../domain/quote-status'
import { getMinimumSalePriceViolations } from '../domain/minimum-sale-price'
import {
  calculateItemTotal,
  calculateSubtotal,
  calculateTotal,
  formatCurrency,
} from '@shared/utils/monetary'
import { Card, CardContent, CardHeader } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { ListBox } from '@shared/components/ui/ListBox'
import { formatPhoneNumber } from '@shared/utils/phone'
import { Plus, Trash2, ArrowLeft, Search, UserRoundPlus } from 'lucide-react'

interface FormItem {
  id: string
  itemType: 'service' | 'material'
  description: string
  quantity: string
  unitPrice: string
  inventoryItemId: string
  unit: string
}

interface QuoteFormDraft {
  selectedCustomerId: string
  quoteDate: string
  validUntil: string
  notes: string
  discount: string
  items: FormItem[]
}

interface QuoteCustomerReturnState {
  createdCustomerId?: string
  quoteDraft?: QuoteFormDraft
}

function getLocalDateValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return [String(year), month, day].join('-')
}

export function QuoteFormPage() {
  const { user, profile } = useAuth()
  const { currentOrganization, userRole, isLoading: isOrganizationLoading } = useOrganization()
  const navigate = useNavigate()
  const location = useLocation()
  const { quoteId } = useParams()
  const isEditing = quoteId !== undefined
  const customerReturnState = location.state as QuoteCustomerReturnState | null

  const [customers, setCustomers] = useState<Customer[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [inventoryLoadError, setInventoryLoadError] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [isCustomerSearchActive, setIsCustomerSearchActive] = useState(false)
  const [quoteDate, setQuoteDate] = useState(getLocalDateValue)
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [discount, setDiscount] = useState('0.00')

  const [items, setItems] = useState<FormItem[]>([])

  const [error, setError] = useState('')
  const [quoteLoadError, setQuoteLoadError] = useState('')
  const [isLoadingQuote, setIsLoadingQuote] = useState(isEditing)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!currentOrganization || isOrganizationLoading) return
    const isActive = { current: true }
    const isCurrentEffect = () => isActive.current

    const loadForm = async () => {
      setQuoteLoadError('')
      const [customersResult, inventoryResult] = await Promise.all([
        customerService.list(currentOrganization.id),
        inventoryService.list(currentOrganization.id),
      ])
      if (!isCurrentEffect()) return

      if (inventoryResult.success) {
        setInventoryItems(inventoryResult.data)
        setInventoryLoadError('')
      } else {
        setInventoryLoadError(inventoryResult.error)
      }

      if (!customersResult.success) {
        setQuoteLoadError(customersResult.error)
        setIsLoadingQuote(false)
        return
      }

      setCustomers(customersResult.data)

      if (!quoteId) {
        if (customerReturnState?.quoteDraft) {
          setSelectedCustomerId(
            customerReturnState.createdCustomerId ??
              customerReturnState.quoteDraft.selectedCustomerId,
          )
          setQuoteDate(customerReturnState.quoteDraft.quoteDate)
          setValidUntil(customerReturnState.quoteDraft.validUntil)
          setNotes(customerReturnState.quoteDraft.notes)
          setDiscount(customerReturnState.quoteDraft.discount)
          setItems(customerReturnState.quoteDraft.items)
        }
        return
      }

      const quoteResult = await quoteService.getQuote(currentOrganization.id, quoteId)
      if (!isCurrentEffect()) return

      if (!quoteResult.success) {
        setQuoteLoadError(quoteResult.error)
        setIsLoadingQuote(false)
        return
      }

      const quote = quoteResult.data
      setQuoteDate(getLocalDateValue(new Date(quote.createdAt)))
      if (!canEditQuote(quote.status, userRole)) {
        setQuoteLoadError(
          'Este orçamento só pode ser editado por um proprietário ou administrador.',
        )
        setIsLoadingQuote(false)
        return
      }

      setSelectedCustomerId(quote.customerId)
      setValidUntil(quote.validUntil?.slice(0, 10) ?? '')
      setNotes(quote.notes ?? '')
      setDiscount(quote.discount)
      setItems(
        quote.items.map((item) => ({
          id: item.id,
          itemType: item.inventoryItemId ? 'material' : 'service',
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          inventoryItemId: item.inventoryItemId ?? '',
          unit: item.unit ?? '',
        })),
      )
      if (customerReturnState?.quoteDraft) {
        setSelectedCustomerId(
          customerReturnState.createdCustomerId ??
            customerReturnState.quoteDraft.selectedCustomerId,
        )
        setQuoteDate(customerReturnState.quoteDraft.quoteDate)
        setValidUntil(customerReturnState.quoteDraft.validUntil)
        setNotes(customerReturnState.quoteDraft.notes)
        setDiscount(customerReturnState.quoteDraft.discount)
        setItems(customerReturnState.quoteDraft.items)
      }
      setIsLoadingQuote(false)
    }

    void loadForm()
    return () => {
      isActive.current = false
    }
  }, [currentOrganization, customerReturnState, isOrganizationLoading, quoteId, userRole])

  const handleAddItem = (itemType: FormItem['itemType']) => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        itemType,
        description: '',
        quantity: '1.0000',
        unitPrice: '0.00',
        inventoryItemId: '',
        unit: '',
      },
    ])
  }

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleUpdateItem = (id: string, field: keyof FormItem, value: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  const handleSelectInventoryItem = (itemId: string, inventoryItemId: string) => {
    const inventoryItem = inventoryItems.find((item) => item.id === inventoryItemId)
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              inventoryItemId,
              description: inventoryItem?.name ?? item.description,
              unit: inventoryItem?.unit ?? '',
              unitPrice: inventoryItem?.unitPrice ?? item.unitPrice,
            }
          : item,
      ),
    )
  }

  // Cálculos dinâmicos em tempo real para a interface
  const itemTotals = items.map((i) => calculateItemTotal(i.quantity, i.unitPrice))
  const subtotal = calculateSubtotal(itemTotals)
  const total = calculateTotal(subtotal, discount)
  const minimumPriceViolations = getMinimumSalePriceViolations(
    items.map((item, itemIndex) => ({
      itemIndex,
      inventoryItemId: item.inventoryItemId,
      unitPrice: item.unitPrice,
    })),
    inventoryItems,
  )
  const minimumPriceViolationsByIndex = new Map(
    minimumPriceViolations.map((violation) => [violation.itemIndex, violation]),
  )
  const normalizedCustomerSearch = customerSearch.trim().toLocaleLowerCase('pt-BR')
  const matchingCustomers = normalizedCustomerSearch
    ? customers.filter((customer) =>
        [customer.name, customer.phone, customer.document, customer.email]
          .filter(Boolean)
          .some((value) => value?.toLocaleLowerCase('pt-BR').includes(normalizedCustomerSearch)),
      )
    : customers
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId)
  const currentUserName =
    profile?.displayName?.trim() || user?.email?.trim() || 'Usuário não identificado'

  const handleCreateCustomer = () => {
    const quoteDraft: QuoteFormDraft = {
      selectedCustomerId,
      quoteDate,
      validUntil,
      notes,
      discount,
      items,
    }

    void navigate('/orcafacil/customers/new', {
      state: { returnTo: location.pathname, quoteDraft },
    })
  }

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!currentOrganization) return

    if (!selectedCustomerId) {
      setError('Selecione um cliente para o orçamento.')
      return
    }

    if (items.length === 0) {
      setError('Adicione pelo menos um material ou serviço ao orçamento.')
      return
    }

    const invalidItem = items.find(
      (i) =>
        !i.description.trim() || !Number.isFinite(Number(i.quantity)) || Number(i.quantity) <= 0,
    )
    if (invalidItem) {
      setError('Todos os itens devem possuir descrição e quantidade válida maior que zero.')
      return
    }
    if (items.some((item) => item.itemType === 'material' && !item.inventoryItemId)) {
      setError('Selecione a referência do estoque para cada item do tipo material.')
      return
    }
    if (minimumPriceViolations.length > 0) {
      setError(
        'O valor de venda não pode ficar abaixo do mínimo cadastrado para os materiais vinculados.',
      )
      return
    }
    if (
      items.some((item) => !Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0)
    ) {
      setError('Informe um valor unitário válido e igual ou maior que zero para cada item.')
      return
    }

    setIsSubmitting(true)
    setError('')

    const params = {
      customerId: selectedCustomerId,
      validUntil: validUntil || null,
      notes: notes || null,
      discount: discount || '0.00',
      items: items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        inventoryItemId: i.inventoryItemId || null,
        unit: i.unit || null,
      })),
    }
    const res = quoteId
      ? await quoteService.updateQuote(currentOrganization.id, quoteId, params)
      : await quoteService.createQuote(currentOrganization.id, params)

    if (res.success) {
      await navigate('/orcafacil/quotes')
    } else {
      setError(res.error)
    }

    setIsSubmitting(false)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          to="/orcafacil/quotes"
          className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {isEditing ? 'Editar Orçamento' : 'Novo Orçamento'}
          </h1>
          <p className="text-sm text-gray-500">
            {isEditing
              ? 'Atualize os dados da proposta comercial e seus itens'
              : 'Preencha os dados da proposta comercial e adicione os itens de serviço ou materiais'}
          </p>
        </div>
      </div>

      {isEditing && isLoadingQuote && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Carregando orçamento...
        </div>
      )}

      {quoteLoadError && (
        <div className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{quoteLoadError}</p>
          <Link to="/orcafacil/quotes">
            <Button type="button" variant="outline">
              Voltar para orçamentos
            </Button>
          </Link>
        </div>
      )}

      {(!isEditing || (!isLoadingQuote && !quoteLoadError)) && (
        <>
          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
            {/* CABEÇALHO DO ORÇAMENTO */}
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-gray-900">Dados do Cliente e Validade</h2>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {!isEditing && (
                  <div>
                    <label
                      htmlFor="quote-created-by"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Funcionário responsável
                    </label>
                    <input
                      id="quote-created-by"
                      type="text"
                      value={currentUserName}
                      readOnly
                      aria-readonly="true"
                      className="h-10 w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-600"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Preenchido automaticamente pelo usuário conectado.
                    </p>
                  </div>
                )}
                <Input
                  label="Data do Orçamento"
                  type="date"
                  value={quoteDate}
                  disabled
                  aria-readonly="true"
                  helperText="Preenchida automaticamente e não pode ser alterada."
                  className="disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-100"
                />
                <Input
                  label="Validade da Proposta"
                  type="date"
                  value={validUntil}
                  onChange={(e) => {
                    setValidUntil(e.target.value)
                  }}
                />
                <div className="min-w-0 sm:col-span-2">
                  <label
                    htmlFor="quote-customer-search"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Cliente *
                  </label>
                  {customers.length === 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                      <span className="text-xs text-amber-700">Nenhum cliente cadastrado.</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCreateCustomer}
                      >
                        <UserRoundPlus className="h-4 w-4" aria-hidden="true" />
                        Cadastrar cliente
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="relative min-w-0 flex-1">
                          <Search
                            aria-hidden="true"
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                          />
                          <input
                            id="quote-customer-search"
                            type="search"
                            value={
                              isCustomerSearchActive
                                ? customerSearch
                                : (selectedCustomer?.name ?? customerSearch)
                            }
                            onFocus={() => {
                              setIsCustomerSearchActive(true)
                              setCustomerSearch('')
                            }}
                            onChange={(event) => {
                              setCustomerSearch(event.target.value)
                            }}
                            placeholder="Pesquisar por nome, telefone ou documento"
                            aria-label="Pesquisar cliente por nome, telefone ou documento"
                            aria-autocomplete="list"
                            aria-controls="quote-customer-results"
                            aria-expanded={isCustomerSearchActive}
                            className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCreateCustomer}
                          aria-label="Cadastrar novo cliente"
                          title="Cadastrar novo cliente"
                          className="h-10 w-10 shrink-0 px-0 py-0"
                        >
                          <UserRoundPlus className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                      {isCustomerSearchActive && (
                        <div
                          id="quote-customer-results"
                          role="listbox"
                          aria-label="Clientes encontrados"
                          className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm"
                        >
                          {matchingCustomers.length > 0 ? (
                            matchingCustomers.map((customer) => (
                              <button
                                key={customer.id}
                                type="button"
                                role="option"
                                aria-selected={customer.id === selectedCustomerId}
                                onClick={() => {
                                  setSelectedCustomerId(customer.id)
                                  setCustomerSearch('')
                                  setIsCustomerSearchActive(false)
                                }}
                                className="flex w-full flex-col items-start border-b border-gray-100 px-3 py-2 text-left last:border-b-0 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                              >
                                <span className="text-sm font-medium text-gray-800">
                                  {customer.name}
                                </span>
                                {(customer.phone || customer.document) && (
                                  <span className="text-xs text-gray-500">
                                    {[customer.phone, customer.document]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </span>
                                )}
                              </button>
                            ))
                          ) : (
                            <p className="px-3 py-2 text-sm text-gray-500">
                              {normalizedCustomerSearch
                                ? 'Nenhum cliente encontrado para essa pesquisa.'
                                : 'Nenhum cliente cadastrado.'}
                            </p>
                          )}
                        </div>
                      )}
                      {selectedCustomer && (
                        <div className="space-y-0.5 text-xs text-gray-600">
                          <p>
                            Cliente selecionado:{' '}
                            <span className="font-semibold">{selectedCustomer.name}</span>
                          </p>
                          <p>
                            Número de celular:{' '}
                            <span className="font-medium">
                              {selectedCustomer.phone
                                ? formatPhoneNumber(selectedCustomer.phone)
                                : 'Não informado'}
                            </span>
                            {' · '}
                            {selectedCustomer.personType === 'individual' ? 'CPF' : 'CNPJ'}:{' '}
                            <span className="font-medium">
                              {selectedCustomer.document
                                ? formatCustomerDocument(
                                    selectedCustomer.document,
                                    selectedCustomer.personType,
                                  )
                                : 'Não informado'}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ITENS DO ORÇAMENTO */}
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Itens e Serviços</h2>
                  <p className="text-xs text-gray-500">
                    Materiais vinculados ao estoque e serviços prestados
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleAddItem('material')
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Material
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleAddItem('service')
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Serviço
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {inventoryLoadError && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Não foi possível carregar os materiais do estoque: {inventoryLoadError}
                  </p>
                )}
                {minimumPriceViolations.length > 0 && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    O valor de venda não pode ficar abaixo do mínimo cadastrado:{' '}
                    {minimumPriceViolations
                      .map(
                        (violation) =>
                          `${violation.productName} (mínimo ${formatCurrency(violation.minimumSalePrice)})`,
                      )
                      .join('; ')}
                    .
                  </p>
                )}

                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500">
                    Nenhum item adicionado ao orçamento. Use os botões acima para adicionar um material ou serviço.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-xs">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="border-b border-gray-200 bg-gray-50/75 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        <tr>
                          <th className="py-2.5 pl-3 pr-2 w-28">Tipo</th>
                          <th className="py-2.5 px-2">Descrição / Material</th>
                          <th className="py-2.5 px-2 w-28 text-right">Qtd</th>
                          <th className="py-2.5 px-2 w-36 text-right">Preço Unit.</th>
                          <th className="py-2.5 px-2 w-28 text-right">Total</th>
                          <th className="py-2.5 pl-2 pr-3 w-12 text-center">
                            <span className="sr-only">Ações</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map((item, itemIndex) => {
                          const lineTotal = calculateItemTotal(item.quantity, item.unitPrice)
                          const linkedInventoryItem = inventoryItems.find(
                            (inventoryItem) => inventoryItem.id === item.inventoryItemId,
                          )
                          const minimumPriceViolation = minimumPriceViolationsByIndex.get(itemIndex)

                          return (
                            <tr key={item.id} className="transition-colors hover:bg-gray-50/50">
                              <td className="py-2 pl-3 pr-2 align-top">
                                {item.itemType === 'material' ? (
                                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                    Material
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-700/10">
                                    Serviço
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2 align-top">
                                {item.itemType === 'material' ? (
                                  <div className="space-y-1">
                                    <ListBox
                                      id={`quote-inventory-${item.id}`}
                                      placeholder="Selecione o material..."
                                      searchPlaceholder="Buscar material..."
                                      value={item.inventoryItemId}
                                      onChange={(val) => {
                                        handleSelectInventoryItem(item.id, val as string)
                                      }}
                                      options={inventoryItems
                                        .filter(
                                          (inventoryItem) =>
                                            inventoryItem.canSell ||
                                            inventoryItem.id === item.inventoryItemId,
                                        )
                                        .map((inventoryItem) => ({
                                          value: inventoryItem.id,
                                          label: inventoryItem.name,
                                          description: `${inventoryItem.sku} · Estoque: ${Number(inventoryItem.quantityOnHand).toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ${inventoryItem.unit}`,
                                        }))}
                                    />
                                    {item.inventoryItemId && (
                                      <input
                                        type="text"
                                        className="w-full text-xs text-gray-500 bg-transparent border-b border-dashed border-gray-200 focus:border-blue-400 focus:outline-none py-0.5 px-1"
                                        placeholder="Descrição complementar / observação"
                                        value={item.description}
                                        onChange={(e) => {
                                          handleUpdateItem(item.id, 'description', e.target.value)
                                        }}
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <input
                                    type="text"
                                    className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Descrição do serviço"
                                    value={item.description}
                                    onChange={(e) => {
                                      handleUpdateItem(item.id, 'description', e.target.value)
                                    }}
                                    required
                                  />
                                )}
                              </td>
                              <td className="py-2 px-2 align-top">
                                <div className="flex flex-col items-end">
                                  <input
                                    type="number"
                                    step="0.0001"
                                    min="0.0001"
                                    className="h-10 w-full rounded-lg border border-gray-300 px-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={item.quantity}
                                    onChange={(e) => {
                                      handleUpdateItem(item.id, 'quantity', e.target.value)
                                    }}
                                    required
                                  />
                                  {item.unit && (
                                    <span className="text-[11px] text-gray-400 mt-0.5">
                                      {item.unit}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-2 align-top">
                                <div className="flex flex-col items-end">
                                  <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    className={`h-10 w-full rounded-lg border px-2 text-right text-sm focus:outline-none focus:ring-2 ${
                                      minimumPriceViolation
                                        ? 'border-red-400 text-red-600 focus:ring-red-400'
                                        : 'border-gray-300 focus:ring-blue-500'
                                    }`}
                                    value={item.unitPrice}
                                    onChange={(e) => {
                                      handleUpdateItem(item.id, 'unitPrice', e.target.value)
                                    }}
                                    required
                                  />
                                  {minimumPriceViolation ? (
                                    <span className="text-[11px] text-red-500 mt-0.5 text-right">
                                      Mín: {formatCurrency(minimumPriceViolation.minimumSalePrice)}
                                    </span>
                                  ) : linkedInventoryItem?.minimumSalePrice ? (
                                    <span className="text-[11px] text-gray-400 mt-0.5 text-right">
                                      Mín: {formatCurrency(linkedInventoryItem.minimumSalePrice)}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="py-2 px-2 align-middle text-right font-medium text-gray-900 whitespace-nowrap">
                                {formatCurrency(lineTotal)}
                              </td>
                              <td className="py-2 pl-2 pr-3 align-middle text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleRemoveItem(item.id)
                                  }}
                                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                  title="Remover item"
                                  aria-label={`Remover item ${String(itemIndex + 1)}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* TOTAIS E DESCONTO */}
                <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-end sm:justify-between gap-4">
                  <div className="w-full sm:w-64">
                    <Input
                      label="Desconto em R$"
                      type="number"
                      step="0.01"
                      min="0"
                      value={discount}
                      onChange={(e) => {
                        setDiscount(e.target.value)
                      }}
                    />
                  </div>

                  <div className="text-right space-y-1">
                    <div className="text-xs text-gray-500">
                      Subtotal:{' '}
                      <span className="font-medium text-gray-700">{formatCurrency(subtotal)}</span>
                    </div>
                    {parseFloat(discount) > 0 && (
                      <div className="text-xs text-red-600">
                        Desconto: -{formatCurrency(discount)}
                      </div>
                    )}
                    <div className="text-xl font-bold text-gray-900">
                      Total: <span className="text-blue-600">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* OBSERVAÇÕES */}
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-gray-900">
                  Observações e Condições de Pagamento
                </h2>
              </CardHeader>
              <CardContent>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Pagamento 50% na aprovação e 50% na conclusão da obra."
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value)
                  }}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Link to="/orcafacil/quotes">
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  Cancelar
                </Button>
              </Link>
              <Button
                type="submit"
                isLoading={isSubmitting}
                disabled={isSubmitting || minimumPriceViolations.length > 0}
              >
                {isEditing ? 'Salvar alterações' : 'Salvar e Gerar Orçamento'}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
