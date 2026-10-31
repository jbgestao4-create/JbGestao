import { useEffect, useState, type SyntheticEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { supplierService } from '@modules/suppliers/services/supplier.service'
import { Button } from '@shared/components/ui/Button'
import { Card, CardContent, CardHeader } from '@shared/components/ui/Card'
import { Input } from '@shared/components/ui/Input'
import { ListBox } from '@shared/components/ui/ListBox'
import type { InventoryItem, InventoryMovement, Supplier } from '@shared/types/common'
import { ArrowLeft, ArrowLeftRight, History, Package } from 'lucide-react'
import { inventoryService } from '../services/inventory.service'

type MovementDirection = 'in' | 'out'
type MovementType = 'entry' | 'purchase' | 'return' | 'exit' | 'loss' | 'damaged' | 'adjustment'

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
  const navigate = useNavigate()
  const { inventoryItemId } = useParams()
  const [item, setItem] = useState<InventoryItem | null>(null)
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [supplierError, setSupplierError] = useState('')
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [direction, setDirection] = useState<MovementDirection>('in')
  const [type, setType] = useState<MovementType>('entry')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [documentReference, setDocumentReference] = useState('')
  const [supplierId, setSupplierId] = useState('')

  const loadData = async (organizationId: string, itemId: string) => {
    const [itemResult, movementsResult, suppliersResult] = await Promise.all([
      inventoryService.getById(organizationId, itemId),
      inventoryService.listMovements(organizationId, itemId),
      supplierService.list(organizationId),
    ])
    if (!itemResult.success) {
      setLoadError(itemResult.error)
      return
    }
    if (!movementsResult.success) {
      setLoadError(movementsResult.error)
      return
    }
    setItem(itemResult.data)
    setMovements(movementsResult.data)
    if (!itemResult.data.canPurchase) {
      setDirection('out')
      setType('exit')
    }
    if (suppliersResult.success) setSuppliers(suppliersResult.data)
    setSupplierError(suppliersResult.success ? '' : suppliersResult.error)
    setLoadedKey(`${organizationId}:${itemId}`)
    setLoadError('')
  }

  useEffect(() => {
    if (!currentOrganization || !inventoryItemId) return
    let active = true
    void Promise.all([
      inventoryService.getById(currentOrganization.id, inventoryItemId),
      inventoryService.listMovements(currentOrganization.id, inventoryItemId),
      supplierService.list(currentOrganization.id),
    ]).then(
      ([itemResult, movementsResult, suppliersResult]) => {
        if (!active) return
        if (!itemResult.success) {
          setLoadError(itemResult.error)
        } else if (!movementsResult.success) {
          setLoadError(movementsResult.error)
        } else {
          setItem(itemResult.data)
          setMovements(movementsResult.data)
          if (!itemResult.data.canPurchase) {
            setDirection('out')
            setType('exit')
          }
          if (suppliersResult.success) {
            setSuppliers(suppliersResult.data)
            setSupplierError('')
          } else {
            setSupplierError(suppliersResult.error)
          }
          setLoadedKey(`${currentOrganization.id}:${inventoryItemId}`)
          setLoadError('')
        }
      },
      () => {
        if (!active) return
        setLoadError('Não foi possível carregar o produto e seu histórico.')
      },
    )
    return () => {
      active = false
    }
  }, [currentOrganization, inventoryItemId])

  const expectedKey = `${currentOrganization?.id ?? ''}:${inventoryItemId ?? ''}`
  const isLoading = loadedKey !== expectedKey
  const handleDirectionChange = (nextDirection: MovementDirection) => {
    if (!item?.canPurchase && nextDirection === 'in') return
    setDirection(nextDirection)
    setType(nextDirection === 'in' ? 'entry' : 'exit')
  }

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentOrganization || !inventoryItemId || !item) return

    if (!item.canPurchase && direction === 'in') {
      setFormError('Este material não permite compras nem acréscimos de estoque.')
      return
    }

    const parsedQuantity = Number(quantity)
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setFormError('Informe uma quantidade maior que zero.')
      return
    }
    if (reason.trim().length < 2) {
      setFormError('Informe o motivo da movimentação.')
      return
    }
    if (unitPrice && (!Number.isFinite(Number(unitPrice)) || Number(unitPrice) < 0)) {
      setFormError('Informe um valor unitário válido ou deixe o campo em branco.')
      return
    }

    setIsSaving(true)
    setFormError('')
    const result = await inventoryService.recordMovement(currentOrganization.id, inventoryItemId, {
      type,
      direction,
      quantity,
      reason,
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
    setUnitPrice('')
    setDocumentReference('')
    setSupplierId('')
    setIsSaving(false)
    await loadData(currentOrganization.id, inventoryItemId)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          to="/orcafacil/inventory/search"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar ao estoque
        </Link>
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-xl bg-blue-50 p-2 text-blue-700">
            <Package className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Movimentações do estoque
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {item
                ? `${item.name} · saldo atual: ${formatQuantity(item.quantityOnHand, item.unit)}`
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
        <Card>
          <CardContent className="p-8 text-center text-sm text-gray-500">
            Selecione uma organização para consultar as movimentações.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-gray-500">
            Carregando produto e histórico...
          </CardContent>
        </Card>
      ) : item ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-gray-900">Registrar movimentação</h2>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
                {formError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}
                {!item.isActive && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Este produto está inativo e não pode receber movimentações.
                  </div>
                )}
                {!item.canPurchase && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Este produto está configurado para não permitir compras. Não é permitido acrescentar estoque nem realizar entradas.
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ListBox
                    label="Direção"
                    searchable={false}
                    disabled={!item.isActive || !item.canPurchase}
                    value={item.canPurchase ? direction : 'out'}
                    onChange={(val) => {
                      handleDirectionChange(val as MovementDirection)
                    }}
                    options={
                      item.canPurchase
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
                    disabled={!item.isActive}
                    value={type}
                    onChange={(val) => {
                      setType(val as MovementType)
                    }}
                    options={(direction === 'in'
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
                    )}
                  />
                  <Input
                    label={`Quantidade (${item.unit}) *`}
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={quantity}
                    onChange={(event) => {
                      setQuantity(event.target.value)
                    }}
                    required
                    disabled={!item.isActive}
                  />
                  <Input
                    label="Custo por unidade (R$)"
                    type="number"
                    min="0"
                    step="0.0001"
                    helperText="Opcional. Ao informar em uma entrada, atualiza o custo médio."
                    value={unitPrice}
                    onChange={(event) => {
                      setUnitPrice(event.target.value)
                    }}
                    disabled={!item.isActive}
                  />
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
                      disabled={!item.isActive}
                    />
                  )}
                  <Input
                    label="Documento de referência"
                    placeholder="Ex.: número da nota ou pedido"
                    value={documentReference}
                    onChange={(event) => {
                      setDocumentReference(event.target.value)
                    }}
                    disabled={!item.isActive}
                  />
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="inventory-movement-reason"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Motivo *
                    </label>
                    <textarea
                      id="inventory-movement-reason"
                      rows={2}
                      minLength={2}
                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value)
                      }}
                      placeholder="Descreva o motivo da movimentação."
                      required
                      disabled={!item.isActive}
                      className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    isLoading={isSaving}
                    disabled={!item.isActive || (!item.canPurchase && direction === 'in')}
                  >
                    Registrar movimentação
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-gray-500" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-gray-900">Histórico imutável</h2>
              </div>
            </CardHeader>
            <CardContent>
              {movements.length === 0 ? (
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
                      {movements.map((movement) => {
                        const isEntry =
                          Number(movement.balanceAfter) >= Number(movement.balanceBefore)
                        return (
                          <tr key={movement.id} className="border-b border-gray-100 last:border-0">
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
                              {formatQuantity(movement.quantity, item.unit)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right text-gray-700">
                              {formatQuantity(movement.balanceAfter, item.unit)}
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
        </>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-gray-500">
            Produto não encontrado.
          </CardContent>
        </Card>
      )}

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
    </div>
  )
}
