import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { inventoryService } from '../services/inventory.service'
import type { InventoryItem, ServiceResult } from '@shared/types/common'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { ListBox } from '@shared/components/ui/ListBox'
import { ConfirmActionDialog } from '@shared/components/ConfirmActionDialog'
import { ArrowLeft, ArrowLeftRight, Archive, Package, Pencil, Plus, Search, X } from 'lucide-react'

function formatQuantity(value: string) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(Number(value))
}

function formatPrice(value: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(value),
  )
}

export function InventoryListPage() {
  const { currentOrganization } = useOrganization()
  const navigate = useNavigate()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loadedOrganizationId, setLoadedOrganizationId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'active' | 'inactive' | 'low'>(
    'all',
  )
  const [loadError, setLoadError] = useState('')
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null)

  const loadItems = async () => {
    if (!currentOrganization) {
      setItems([])
      setLoadedOrganizationId(null)
      return
    }

    setLoadError('')
    const result = await inventoryService.list(currentOrganization.id)
    if (result.success) {
      setItems(result.data)
      setLoadedOrganizationId(currentOrganization.id)
    } else {
      setLoadError(result.error)
      setLoadedOrganizationId(currentOrganization.id)
    }
  }

  useEffect(() => {
    if (!currentOrganization) return
    let isActive = true
    void inventoryService.list(currentOrganization.id).then(
      (result) => {
        if (!isActive) return
        if (result.success) {
          setItems(result.data)
          setLoadError('')
        } else {
          setLoadError(result.error)
        }
        setLoadedOrganizationId(currentOrganization.id)
      },
      () => {
        if (!isActive) return
        setLoadError('Erro inesperado ao consultar o estoque.')
        setLoadedOrganizationId(currentOrganization.id)
      },
    )
    return () => {
      isActive = false
    }
  }, [currentOrganization])

  const handleDeactivate = async (): Promise<ServiceResult<void>> => {
    if (!currentOrganization || !itemToDelete) {
      return { success: false, error: 'Não foi possível identificar o material.' }
    }
    const result = await inventoryService.deactivate(currentOrganization.id, itemToDelete.id)
    if (result.success) {
      setItemToDelete(null)
      await loadItems()
    }
    return result
  }

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('pt-BR')
  const visibleItems = loadedOrganizationId === currentOrganization?.id ? items : []
  const isLoading = !!currentOrganization && loadedOrganizationId !== currentOrganization.id
  const filteredItems = visibleItems.filter((item) => {
    const matchesSearch = [
      item.name,
      item.unit,
      item.supplierName,
      item.sku,
      item.barcode,
      item.brand,
      item.model,
      item.category,
      ...item.suppliers.map((supplier) => supplier.supplierName),
    ]
      .filter(Boolean)
      .some((value) => value?.toLocaleLowerCase('pt-BR').includes(normalizedSearch))
    const isLowStock = Number(item.quantityOnHand) <= Number(item.minimumQuantity) && item.isActive
    const matchesStatus =
      inventoryFilter === 'all' ||
      (inventoryFilter === 'active' && item.isActive) ||
      (inventoryFilter === 'inactive' && !item.isActive) ||
      (inventoryFilter === 'low' && isLowStock)
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => {
              void navigate('/orcafacil/inventory')
            }}
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Consultar Estoque</h1>
          <p className="mt-1 text-sm text-gray-500">
            Consulte e gerencie materiais, unidades, saldos e fornecedores.
          </p>
        </div>
        <Button
          onClick={() => {
            void navigate('/orcafacil/inventory/new')
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Cadastrar material
        </Button>
      </div>

      <Card className="rounded-xl border-blue-200 shadow-sm ring-1 ring-blue-100">
        <CardContent className="p-3 sm:p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <Input
              aria-label="Pesquisar material ou fornecedor"
              placeholder="Digite o material ou fornecedor para consultar..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
              }}
              className="h-12 border-blue-300 pl-11 pr-12 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-gray-100 p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800"
                aria-label="Limpar pesquisa"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              Pesquise por nome, SKU, código de barras, marca ou fornecedor.
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="shrink-0">Mostrar:</span>
              <ListBox
                className="w-40"
                searchable={false}
                value={inventoryFilter}
                onChange={(val) => {
                  setInventoryFilter(val as 'all' | 'active' | 'inactive' | 'low')
                }}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'active', label: 'Ativos' },
                  { value: 'inactive', label: 'Inativos' },
                  { value: 'low', label: 'Estoque baixo' },
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm font-medium text-gray-700" aria-live="polite">
        Exibindo {String(filteredItems.length)} de {String(visibleItems.length)} produto(s)
      </p>

      {!currentOrganization ? (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-8 text-center text-sm text-gray-500">
            Selecione uma organização para consultar o estoque.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-8 text-center text-sm text-gray-500">
            Carregando estoque...
          </CardContent>
        </Card>
      ) : loadError ? (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-8 text-center text-sm text-red-700">{loadError}</CardContent>
        </Card>
      ) : visibleItems.length === 0 ? (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <Package className="mb-3 h-9 w-9 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-600">Ainda não há materiais cadastrados no estoque.</p>
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
      ) : filteredItems.length === 0 ? (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-8 text-center text-sm text-gray-500">
            Nenhum produto encontrado com os filtros atuais para “{searchTerm}”.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const isLowStock = Number(item.quantityOnHand) <= Number(item.minimumQuantity)
            return (
              <Card key={item.id} className="rounded-xl shadow-sm">
                <CardContent className="space-y-4 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                        <Package className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-base font-bold text-gray-900">
                            {item.name}
                          </h2>
                          {!item.isActive && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                              Inativo
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          SKU: {item.sku} · Unidade: {item.unit}
                        </p>
                        {item.category && (
                          <p className="text-xs text-gray-400">
                            {item.category}
                            {item.brand ? ` · ${item.brand}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          void navigate(`/orcafacil/inventory/${item.id}/movements`)
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50"
                        aria-label={`Movimentações de ${item.name}`}
                      >
                        <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                        Movimentar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void navigate(`/orcafacil/inventory/${item.id}/edit`)
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-blue-700"
                        aria-label={`Editar ${item.name}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Editar
                      </button>
                      {item.isActive && (
                        <button
                          type="button"
                          onClick={() => {
                            setItemToDelete(item)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                          aria-label={`Desativar ${item.name}`}
                        >
                          <Archive className="h-4 w-4" aria-hidden="true" />
                          Desativar
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Saldo disponível
                      </p>
                      <p
                        className={`mt-1 text-sm font-semibold ${isLowStock ? 'text-amber-700' : 'text-gray-900'}`}
                      >
                        {formatQuantity(item.quantityOnHand)} {item.unit}
                        {isLowStock && <span className="ml-2 text-xs">(estoque baixo)</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Estoque mínimo
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {formatQuantity(item.minimumQuantity)} {item.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Valor por unidade
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {formatPrice(item.unitPrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Fornecedor
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {item.supplierName || 'Não informado'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmActionDialog
        open={itemToDelete !== null}
        title="Desativar produto?"
        description={`Desativar ${itemToDelete?.name ?? 'este produto'}? O histórico será preservado e o produto poderá ser reativado na edição.`}
        confirmLabel="Sim, desativar"
        onCancel={() => {
          setItemToDelete(null)
        }}
        onConfirm={handleDeactivate}
      />
    </div>
  )
}
