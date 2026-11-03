import { useEffect, useState, type SyntheticEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { supplierService } from '@modules/suppliers/services/supplier.service'
import { Button } from '@shared/components/ui/Button'
import { Card, CardContent, CardHeader } from '@shared/components/ui/Card'
import { Input } from '@shared/components/ui/Input'
import { ListBox } from '@shared/components/ui/ListBox'
import type { InventoryItem, InventoryMovement, Supplier } from '@shared/types/common'
import { ArrowLeft, ArrowLeftRight, Check, History, Package, ZoomIn } from 'lucide-react'
import { ImagePreviewModal } from '@shared/components/ui/ImagePreviewModal'
import { inventoryService } from '../services/inventory.service'

type MovementDirection = 'in' | 'out'
type MovementType = 'entry' | 'purchase' | 'return' | 'exit' | 'loss' | 'damaged' | 'adjustment'

function getRegisteredCost(i: InventoryItem | null | undefined): string {
  if (!i) return ''
  const p = Number(i.purchasePrice)
  if (Number.isFinite(p) && p > 0) return p.toFixed(2)
  const lp = Number(i.lastPurchasePrice)
  if (Number.isFinite(lp) && lp > 0) return lp.toFixed(2)
  const ac = Number(i.averageCost)
  if (Number.isFinite(ac) && ac > 0) return ac.toFixed(2)
  return ''
}

function getRegisteredSalePrice(i: InventoryItem | null | undefined): string {
  if (!i) return ''
  const p = Number(i.unitPrice)
  return Number.isFinite(p) && p > 0 ? p.toFixed(2) : ''
}

const MOVEMENT_LABELS: Record<string, string> = {
  initial: 'Saldo inicial',
  entry: 'Entrada',
  exit: 'Saída',
  sale: 'Venda',
  purchase: 'Compra',
  return: 'Devolução',
  adjustment: 'Ajuste',
  loss: 'Perda',
  damaged: 'Avaria',
  quote_approval: 'Aprovação de orçamento',
  quote_edit: 'Edição de orçamento',
  quote_cancellation: 'Cancelamento de orçamento',
}

function formatQuantity(value: string, unit: string) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(Number(value))} ${unit}`
}

function isWholeUnit(unit: string) {
  return unit.trim().toUpperCase() === 'UN'
}

function formatPrice(value: string | null) {
  if (value === null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(value),
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function InventoryMovementsPage() {
  const { currentOrganization } = useOrganization()
  const { canMoveInventory, inventoryAccessLevel } = useModuleAccess()
  const navigate = useNavigate()
  const { inventoryItemId } = useParams()

  const [items, setItems] = useState<InventoryItem[]>([])
  const [item, setItem] = useState<InventoryItem | null>(null)
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [loadedItemKey, setLoadedItemKey] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [supplierError, setSupplierError] = useState('')
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [direction, setDirection] = useState<MovementDirection>('in')
  const [type, setType] = useState<MovementType>('entry')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [documentReference, setDocumentReference] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [updateRegisteredCost, setUpdateRegisteredCost] = useState(false)
  const [isUpdatingCost, setIsUpdatingCost] = useState(false)
  const [costUpdateMessage, setCostUpdateMessage] = useState('')
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null)

  // Carrega a lista de produtos e fornecedores da organização
  useEffect(() => {
    if (!currentOrganization) return

    let active = true
    void Promise.resolve().then(() => {
      if (active) setIsLoadingItems(true)
    })

    void Promise.all([
      inventoryService.list(currentOrganization.id),
      supplierService.list(currentOrganization.id),
    ]).then(([itemsResult, suppliersResult]) => {
      if (!active) return
      setIsLoadingItems(false)
      if (itemsResult.success) {
        setItems(itemsResult.data)
      } else {
        setLoadError(itemsResult.error)
      }
      if (suppliersResult.success) {
        setSuppliers(suppliersResult.data)
        setSupplierError('')
      } else {
        setSupplierError(suppliersResult.error)
      }
    })

    return () => {
      active = false
    }
  }, [currentOrganization])

  // Carrega dados do produto selecionado e seu histórico
  const reloadItemData = async (organizationId: string, itemId: string) => {
    const [itemResult, movementsResult, itemsResult] = await Promise.all([
      inventoryService.getById(organizationId, itemId),
      inventoryService.listMovements(organizationId, itemId),
      inventoryService.list(organizationId),
    ])

    if (!itemResult.success) {
      setLoadError(itemResult.error)
      setItem(null)
      return
    }
    if (!movementsResult.success) {
      setLoadError(movementsResult.error)
      return
    }

    setItem(itemResult.data)
    setMovements(movementsResult.data)
    if (itemsResult.success) {
      setItems(itemsResult.data)
    }
    if (!itemResult.data.canPurchase) {
      setDirection('out')
      setType('exit')
    }
    setUnitPrice(getRegisteredCost(itemResult.data))
    setSalePrice(getRegisteredSalePrice(itemResult.data))
    setCostUpdateMessage('')
    setLoadedItemKey(`${organizationId}:${itemId}`)
    setLoadError('')
  }

  useEffect(() => {
    if (!currentOrganization || !inventoryItemId) return

    let active = true
    void Promise.all([
      inventoryService.getById(currentOrganization.id, inventoryItemId),
      inventoryService.listMovements(currentOrganization.id, inventoryItemId),
    ]).then(
      ([itemResult, movementsResult]) => {
        if (!active) return
        if (!itemResult.success) {
          setLoadError(itemResult.error)
          setItem(null)
          setMovements([])
        } else if (!movementsResult.success) {
          setLoadError(movementsResult.error)
          setItem(itemResult.data)
          setMovements([])
        } else {
          setItem(itemResult.data)
          setMovements(movementsResult.data)
          if (!itemResult.data.canPurchase) {
            setDirection('out')
            setType('exit')
          }
          setUnitPrice(getRegisteredCost(itemResult.data))
          setSalePrice(getRegisteredSalePrice(itemResult.data))
          setCostUpdateMessage('')
          setLoadError('')
        }
        setLoadedItemKey(`${currentOrganization.id}:${inventoryItemId}`)
      },
      () => {
        if (!active) return
        setLoadError('Não foi possível carregar o produto e seu histórico.')
        setLoadedItemKey(`${currentOrganization.id}:${inventoryItemId}`)
      },
    )

    return () => {
      active = false
    }
  }, [currentOrganization, inventoryItemId])

  const activeItem = inventoryItemId ? item : null
  const activeMovements = inventoryItemId ? movements : []
  const expectedKey = `${currentOrganization?.id ?? ''}:${inventoryItemId ?? ''}`
  const isLoadingItem = Boolean(inventoryItemId) && loadedItemKey !== expectedKey

  const isReasonRequired = direction === 'out' || ['exit', 'loss', 'damaged'].includes(type)
  const isOutbound = direction === 'out'

  const handleDirectionChange = (nextDirection: MovementDirection) => {
    if (!activeItem?.canPurchase && nextDirection === 'in') return
    setDirection(nextDirection)
    const nextType: MovementType = nextDirection === 'in' ? 'entry' : 'exit'
    setType(nextType)
    if (nextDirection === 'out') {
      setUpdateRegisteredCost(false)
      setCostUpdateMessage('')
    }
  }

  const handleTypeChange = (nextType: MovementType) => {
    setType(nextType)
    if (direction === 'out' || ['exit', 'loss', 'damaged'].includes(nextType)) {
      setUpdateRegisteredCost(false)
      setCostUpdateMessage('')
    }
  }

  const handleItemChange = (newId: string) => {
    setFormError('')
    setQuantity('')
    setReason('')
    setDocumentReference('')
    setSupplierId('')
    setCostUpdateMessage('')
    setUpdateRegisteredCost(false)

    const selectedItem = items.find((i) => i.id === newId)
    setUnitPrice(getRegisteredCost(selectedItem))
    setSalePrice(getRegisteredSalePrice(selectedItem))

    if (newId) {
      void navigate(`/orcafacil/inventory/${newId}/movements`)
    } else {
      void navigate('/orcafacil/inventory/movements')
    }
  }

  const handleUpdatePricesNow = async () => {
    if (!currentOrganization || !inventoryItemId || !activeItem) return
    if (unitPrice && (!Number.isFinite(Number(unitPrice)) || Number(unitPrice) < 0)) {
      setFormError('Informe um valor de custo válido para atualizar no cadastro.')
      return
    }
    if (salePrice && (!Number.isFinite(Number(salePrice)) || Number(salePrice) < 0)) {
      setFormError('Informe um valor de venda válido para atualizar no cadastro.')
      return
    }
    setIsUpdatingCost(true)
    setCostUpdateMessage('')
    setFormError('')
    const result = await inventoryService.updatePrices(
      currentOrganization.id,
      inventoryItemId,
      { purchasePrice: unitPrice, salePrice },
    )
    setIsUpdatingCost(false)
    if (result.success) {
      const formattedCost = unitPrice ? Number(unitPrice).toFixed(2) : activeItem.purchasePrice
      const formattedSale = salePrice ? Number(salePrice).toFixed(2) : activeItem.unitPrice
      setCostUpdateMessage('Preços atualizados no cadastro com sucesso!')
      setItem((prev) =>
        prev ? { ...prev, purchasePrice: formattedCost, unitPrice: formattedSale } : null,
      )
      setItems((prev) =>
        prev.map((i) =>
          i.id === inventoryItemId
            ? { ...i, purchasePrice: formattedCost, unitPrice: formattedSale }
            : i,
        ),
      )
    } else {
      setFormError(result.error)
    }
  }

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentOrganization || !inventoryItemId || !activeItem) return

    if (!canMoveInventory) {
      setFormError('Seu nível de acesso não permite movimentar estoque (requer Nível 3).')
      return
    }

    if (!activeItem.canPurchase && direction === 'in') {
      setFormError('Este material não permite compras nem acréscimos de estoque.')
      return
    }

    const parsedQuantity = Number(quantity)
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setFormError('Informe uma quantidade maior que zero.')
      return
    }
    if (isWholeUnit(activeItem.unit) && !Number.isInteger(parsedQuantity)) {
      setFormError('Este material usa unidade inteira (UN). Informe uma quantidade inteira.')
      return
    }
    if (isReasonRequired && reason.trim().length < 2) {
      const typeLabel =
        type === 'loss' ? 'perda' : type === 'damaged' ? 'avaria' : 'saída'
      setFormError(`O preenchimento do motivo é obrigatório para registrar ${typeLabel}.`)
      return
    }
    if (unitPrice && (!Number.isFinite(Number(unitPrice)) || Number(unitPrice) < 0)) {
      setFormError('Informe um valor unitário de custo válido ou deixe o campo em branco.')
      return
    }
    if (salePrice && (!Number.isFinite(Number(salePrice)) || Number(salePrice) < 0)) {
      setFormError('Informe um valor de venda válido ou deixe o campo em branco.')
      return
    }

    setIsSaving(true)
    setFormError('')
    setCostUpdateMessage('')

    if (updateRegisteredCost) {
      const updatePricesResult = await inventoryService.updatePrices(
        currentOrganization.id,
        inventoryItemId,
        { purchasePrice: unitPrice, salePrice },
      )
      if (!updatePricesResult.success) {
        setFormError(updatePricesResult.error)
        setIsSaving(false)
        return
      }
    }

    const defaultReason =
      direction === 'in'
        ? type === 'purchase'
          ? 'Compra de mercadoria'
          : type === 'return'
            ? 'Devolução de mercadoria'
            : 'Entrada no estoque'
        : 'Saída de estoque'
    const finalReason = reason.trim() || defaultReason

    const result = await inventoryService.recordMovement(currentOrganization.id, inventoryItemId, {
      type,
      direction,
      quantity,
      reason: finalReason,
      unitPrice,
      documentReference,
      supplierId: direction === 'in' ? supplierId : '',
      movedAt: '',
    })
    if (!result.success) {
      setFormError(result.error)
      setIsSaving(false)
      return
    }

    setQuantity('')
    setReason('')
    setDocumentReference('')
    setSupplierId('')
    setUpdateRegisteredCost(false)
    setIsSaving(false)
    await reloadItemData(currentOrganization.id, inventoryItemId)
  }

  const visibleItems = currentOrganization ? items : []

  if (!canMoveInventory) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          to="/orcafacil/inventory"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar ao estoque
        </Link>
        <Card className="rounded-xl border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="p-8 text-center">
            <h2 className="text-lg font-semibold text-amber-900">Acesso Restrito ao Módulo</h2>
            <p className="mt-2 text-sm text-amber-800">
              Seu nível de acesso ao estoque (Nível {String(inventoryAccessLevel)}) não permite realizar movimentações de estoque.
              Essa funcionalidade requer <strong>Nível 3 (Acesso Geral)</strong>.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button
                onClick={() => {
                  void navigate('/orcafacil/inventory')
                }}
              >
                Voltar à Lista de Produtos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          to="/orcafacil/inventory"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar ao estoque
        </Link>
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-xl bg-purple-50 p-2 text-purple-700">
            <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Movimentação de estoque
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {activeItem
                ? `${activeItem.name} · Saldo disponível: ${formatQuantity(activeItem.quantityOnHand, activeItem.unit)}`
                : 'Entradas, saídas e histórico do produto.'}
            </p>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}
      {supplierError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Não foi possível carregar a lista de fornecedores: {supplierError}
        </div>
      )}

      {!currentOrganization ? (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-8 text-center text-sm text-gray-500">
            Selecione uma organização para consultar as movimentações.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <ListBox
                label="Material do estoque *"
                placeholder={
                  isLoadingItems
                    ? 'Carregando materiais...'
                    : 'Selecione um material para movimentar...'
                }
                searchPlaceholder="Buscar material por nome, código, unidade..."
                searchable
                value={inventoryItemId || ''}
                onChange={(val) => {
                  handleItemChange((val as string) || '')
                }}
                options={visibleItems.map((i) => ({
                  value: i.id,
                  label: i.name,
                  description: `Cód. #${i.sku || '—'} · Saldo: ${formatQuantity(i.quantityOnHand, i.unit)}${!i.isActive ? ' · (Inativo)' : ''}`,
                }))}
                disabled={isLoadingItems || visibleItems.length === 0}
              />
            </CardContent>
          </Card>

          {visibleItems.length === 0 && !isLoadingItems ? (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="flex flex-col items-center px-6 py-12 text-center">
                <Package className="mb-3 h-9 w-9 text-gray-300" aria-hidden="true" />
                <p className="text-sm text-gray-600">
                  Ainda não há materiais cadastrados no estoque para movimentar.
                </p>
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    void navigate('/orcafacil/inventory/new')
                  }}
                >
                  Cadastrar o primeiro material
                </Button>
              </CardContent>
            </Card>
          ) : !inventoryItemId ? (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="flex flex-col items-center px-6 py-12 text-center">
                <div className="mb-3 rounded-full bg-purple-50 p-3 text-purple-600">
                  <ArrowLeftRight className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">
                  Nenhum material selecionado
                </h3>
                <p className="mt-1 max-w-md text-sm text-gray-500">
                  Selecione um material no campo acima para registrar entradas, compras, saídas, perdas e consultar o histórico completo de movimentações.
                </p>
              </CardContent>
            </Card>
          ) : isLoadingItem ? (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="p-8 text-center text-sm text-gray-500">
                Carregando produto e histórico...
              </CardContent>
            </Card>
          ) : activeItem ? (
            <>
              {/* Card de identificação do produto selecionado com foto */}
              <Card className="rounded-xl border-purple-200/80 bg-gradient-to-r from-purple-50/50 to-white shadow-sm">
                <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5">
                  <div className="flex items-center gap-4 min-w-0">
                    {activeItem.imagePath ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (activeItem.imagePath) {
                            setPreviewImage({ src: activeItem.imagePath, title: activeItem.name })
                          }
                        }}
                        className="group relative flex h-28 w-28 sm:h-36 sm:w-36 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-md transition hover:border-purple-400 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        title="Clique para ampliar a foto"
                        aria-label={`Ampliar foto de ${activeItem.name}`}
                      >
                        <img
                          src={activeItem.imagePath}
                          alt={activeItem.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                          <ZoomIn className="h-7 w-7 text-white drop-shadow" aria-hidden="true" />
                        </div>
                      </button>
                    ) : (
                      <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-purple-200 bg-purple-50 text-purple-400">
                        <Package className="h-5 w-5" aria-hidden="true" />
                        <span className="text-[10px] font-medium text-purple-400 mt-0.5">Sem foto</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="shrink-0 rounded-md border border-purple-200 bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800">
                          Cód. #{activeItem.sku || '—'}
                        </span>
                        <h2 className="truncate text-base sm:text-lg font-bold text-gray-900">
                          {activeItem.name}
                        </h2>
                        {!activeItem.isActive && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Código do produto: <strong>#{activeItem.sku || '—'}</strong> · Unidade: {activeItem.unit}
                        {activeItem.category ? ` · ${activeItem.category}` : ''}
                        {activeItem.brand ? ` · ${activeItem.brand}` : ''}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center rounded-md bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
                          Saldo atual: {formatQuantity(activeItem.quantityOnHand, activeItem.unit)}
                        </span>
                        {Number(activeItem.purchasePrice) > 0 && (
                          <span className="text-xs text-gray-600">
                            Custo cadastrado: {formatPrice(activeItem.purchasePrice)}
                          </span>
                        )}
                        {Number(activeItem.unitPrice) > 0 && (
                          <span className="text-xs font-medium text-emerald-700">
                            Venda: {formatPrice(activeItem.unitPrice)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Link
                      to={`/orcafacil/inventory/${activeItem.id}/edit`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-blue-600"
                    >
                      Editar produto
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {activeItem.imagePath ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (activeItem.imagePath) {
                            setPreviewImage({ src: activeItem.imagePath, title: activeItem.name })
                          }
                        }}
                        className="group relative flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-purple-400"
                        title="Clique para ampliar a foto"
                      >
                        <img
                          src={activeItem.imagePath}
                          alt={activeItem.name}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                          <ZoomIn className="h-4 w-4 text-white" aria-hidden="true" />
                        </div>
                      </button>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                        <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">Registrar movimentação</h2>
                      <p className="text-xs text-gray-500">
                        {activeItem.name} · Saldo: {formatQuantity(activeItem.quantityOnHand, activeItem.unit)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
                    {formError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {formError}
                      </div>
                    )}
                    {!activeItem.isActive && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Este produto está inativo e não pode receber movimentações.
                      </div>
                    )}
                    {!activeItem.canPurchase && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Este produto está configurado para não permitir compras. Não é permitido acrescentar estoque nem realizar entradas.
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <ListBox
                        label="Direção"
                        searchable={false}
                        disabled={!activeItem.isActive || !activeItem.canPurchase}
                        value={activeItem.canPurchase ? direction : 'out'}
                        onChange={(val) => {
                          handleDirectionChange(val as MovementDirection)
                        }}
                        options={
                          activeItem.canPurchase
                            ? [
                                { value: 'in', label: 'Entrada' },
                                { value: 'out', label: 'Saída' },
                              ]
                            : [{ value: 'out', label: 'Saída' }]
                        }
                      />
                      <ListBox
                        label="Tipo"
                        searchable={false}
                        disabled={!activeItem.isActive}
                        value={type}
                        onChange={(val) => {
                          handleTypeChange(val as MovementType)
                        }}
                        options={
                          direction === 'in'
                            ? [
                                { value: 'entry', label: 'Entrada' },
                                { value: 'purchase', label: 'Compra' },
                                { value: 'return', label: 'Devolução' },
                                { value: 'adjustment', label: 'Ajuste positivo' },
                              ]
                            : [
                                { value: 'exit', label: 'Saída' },
                                { value: 'loss', label: 'Perda' },
                                { value: 'damaged', label: 'Avaria' },
                                { value: 'adjustment', label: 'Ajuste negativo' },
                              ]
                        }
                      />
                      <Input
                        label={`Quantidade (${activeItem.unit}) *`}
                        type="number"
                        min={isWholeUnit(activeItem.unit) ? '1' : '0.0001'}
                        step={isWholeUnit(activeItem.unit) ? '1' : '0.0001'}
                        helperText={
                          isWholeUnit(activeItem.unit)
                            ? 'Unidade inteira: informe apenas números inteiros.'
                            : undefined
                        }
                        value={quantity}
                        onChange={(event) => {
                          setQuantity(event.target.value)
                        }}
                        required
                        disabled={!activeItem.isActive}
                      />
                      {/* Seção de Preços (Custo e Venda) */}
                      <div className="sm:col-span-2 rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <label
                            className={`flex items-center gap-2 text-xs font-semibold select-none ${
                              isOutbound ? 'text-gray-400 cursor-not-allowed' : 'text-gray-800 cursor-pointer'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={updateRegisteredCost}
                              onChange={(e) => {
                                setUpdateRegisteredCost(e.target.checked)
                                setCostUpdateMessage('')
                              }}
                              disabled={!activeItem.isActive || isOutbound}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                            />
                            <span>Atualizar preço de custo no cadastro ao movimentar</span>
                          </label>

                          {isOutbound ? (
                            <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-[11px] font-medium text-gray-500">
                              Desmarcado (não aplicável a saídas/perdas/avarias)
                            </span>
                          ) : updateRegisteredCost ? (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-medium text-blue-800">
                              Campos de preço liberados para alteração
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-200/80 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
                              Campos desativados (marque a opção acima para alterar)
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Input
                            label="Custo por unidade (R$)"
                            currency
                            placeholder="0,00"
                            helperText={
                              Number(activeItem.purchasePrice) > 0
                                ? `Custo cadastrado: ${formatPrice(activeItem.purchasePrice)}`
                                : 'Valor de custo do produto.'
                            }
                            value={unitPrice}
                            onChange={(event) => {
                              setUnitPrice(event.target.value)
                              setCostUpdateMessage('')
                            }}
                            disabled={!activeItem.isActive || !updateRegisteredCost}
                          />

                          <Input
                            label="Valor de venda (R$)"
                            currency
                            placeholder="0,00"
                            helperText={
                              Number(activeItem.unitPrice) > 0
                                ? `Venda cadastrada: ${formatPrice(activeItem.unitPrice)}`
                                : 'Preço de venda praticado ao cliente.'
                            }
                            value={salePrice}
                            onChange={(event) => {
                              setSalePrice(event.target.value)
                              setCostUpdateMessage('')
                            }}
                            disabled={!activeItem.isActive || !updateRegisteredCost}
                          />
                        </div>

                        {updateRegisteredCost && (
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200/80">
                            <button
                              type="button"
                              disabled={!activeItem.isActive || isUpdatingCost || (!unitPrice && !salePrice)}
                              onClick={() => {
                                void handleUpdatePricesNow()
                              }}
                              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                              {isUpdatingCost ? 'Atualizando...' : 'Atualizar preços no cadastro agora'}
                            </button>

                            {costUpdateMessage && (
                              <span className="text-xs font-medium text-emerald-600">
                                ✓ {costUpdateMessage}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {direction === 'in' && (
                        <ListBox
                          label="Fornecedor"
                          placeholder="Não informado"
                          searchPlaceholder="Buscar fornecedor..."
                          value={supplierId}
                          onChange={(val) => {
                            setSupplierId(val as string)
                          }}
                          options={[
                            { value: '', label: 'Não informado' },
                            ...suppliers.map((s) => ({ value: s.id, label: s.name })),
                          ]}
                          disabled={!activeItem.isActive}
                        />
                      )}
                      <Input
                        label="Documento de referência"
                        placeholder="Ex.: número da nota ou pedido"
                        value={documentReference}
                        onChange={(event) => {
                          setDocumentReference(event.target.value)
                        }}
                        disabled={!activeItem.isActive}
                      />
                      <div
                        className={`sm:col-span-2 rounded-xl transition-all ${
                          isReasonRequired
                            ? 'border-2 border-amber-300 bg-amber-50/50 p-4 shadow-sm'
                            : 'space-y-1.5'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            htmlFor="inventory-movement-reason"
                            className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"
                          >
                            <span>Motivo</span>
                            {isReasonRequired && <span className="text-red-500">*</span>}
                          </label>

                          {isReasonRequired ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-red-700 animate-pulse">
                              ● Obrigatório
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 font-normal">
                              (Opcional para entradas)
                            </span>
                          )}
                        </div>

                        <textarea
                          id="inventory-movement-reason"
                          rows={2}
                          minLength={isReasonRequired ? 2 : 0}
                          value={reason}
                          onChange={(event) => {
                            setReason(event.target.value)
                          }}
                          placeholder={
                            isReasonRequired
                              ? type === 'loss'
                                ? 'Informe detalhadamente o motivo da perda do produto (obrigatório)...'
                                : type === 'damaged'
                                  ? 'Descreva a avaria ocorrida com o produto (obrigatório)...'
                                  : 'Descreva detalhadamente o motivo da saída (obrigatório)...'
                              : 'Descreva o motivo da entrada ou deixe em branco.'
                          }
                          required={isReasonRequired}
                          disabled={!activeItem.isActive}
                          className={`w-full rounded-lg p-3 text-sm focus:outline-none focus:ring-2 disabled:bg-gray-50 ${
                            isReasonRequired
                              ? 'border-2 border-amber-400 bg-white text-gray-900 focus:border-red-500 focus:ring-red-500'
                              : 'border border-gray-300 bg-white text-gray-900 focus:border-blue-500 focus:ring-blue-500'
                          }`}
                        />

                        {isReasonRequired && (
                          <p className="mt-1.5 text-xs font-semibold text-amber-900">
                            ⚠️ O preenchimento do motivo é obrigatório para registrar{' '}
                            {type === 'loss' ? 'perda' : type === 'damaged' ? 'avaria' : 'saída'}.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        isLoading={isSaving}
                        disabled={!activeItem.isActive || (!activeItem.canPurchase && direction === 'in')}
                      >
                        Registrar movimentação
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-gray-500" aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-gray-900">Histórico imutável</h2>
                  </div>
                </CardHeader>
                <CardContent>
                  {activeMovements.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-500">
                      Ainda não há movimentações registradas para este produto.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                            <th className="px-3 py-3 font-semibold">Data</th>
                            <th className="px-3 py-3 font-semibold">Tipo</th>
                            <th className="px-3 py-3 font-semibold">Motivo</th>
                            <th className="px-3 py-3 text-right font-semibold">Quantidade</th>
                            <th className="px-3 py-3 text-right font-semibold">Saldo após</th>
                            <th className="px-3 py-3 text-right font-semibold">Custo unitário</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeMovements.map((movement) => {
                            const isEntry =
                              Number(movement.balanceAfter) >= Number(movement.balanceBefore)
                            return (
                              <tr
                                key={movement.id}
                                className="border-b border-gray-100 last:border-0"
                              >
                                <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                                  {formatDate(movement.movedAt)}
                                </td>
                                <td className="px-3 py-3 font-medium text-gray-800">
                                  {MOVEMENT_LABELS[movement.movementType] ?? movement.movementType}
                                </td>
                                <td
                                  className="max-w-xs truncate px-3 py-3 text-gray-600"
                                  title={movement.reason}
                                >
                                  {movement.reason}
                                  {movement.documentReference && (
                                    <span className="block text-xs text-gray-400">
                                      Doc. {movement.documentReference}
                                    </span>
                                  )}
                                </td>
                                <td
                                  className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${isEntry ? 'text-emerald-700' : 'text-red-700'}`}
                                >
                                  {isEntry ? '+' : '−'}
                                  {formatQuantity(movement.quantity, activeItem.unit)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-right text-gray-700">
                                  {formatQuantity(movement.balanceAfter, activeItem.unit)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-right text-gray-700">
                                  {formatPrice(movement.unitPrice)}
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

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (inventoryItemId) {
                      void navigate(`/orcafacil/inventory/${inventoryItemId}/edit`)
                    }
                  }}
                >
                  Editar produto
                </Button>
              </div>
            </>
          ) : (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="p-8 text-center text-sm text-gray-500">
                Produto não encontrado.
              </CardContent>
            </Card>
          )}
        </>
      )}

      <ImagePreviewModal
        open={previewImage !== null}
        src={previewImage?.src}
        title={previewImage?.title}
        onClose={() => {
          setPreviewImage(null)
        }}
      />
    </div>
  )
}
