import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { inventoryService } from '../services/inventory.service'
import type { InventoryItem } from '@shared/types/common'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Input } from '@shared/components/ui/Input'
import { ListBox } from '@shared/components/ui/ListBox'
import { ImagePreviewModal } from '@shared/components/ui/ImagePreviewModal'
import { DeleteInventoryItemModal } from '../components/DeleteInventoryItemModal'
import { ImportInvoiceModal } from '../components/ImportInvoiceModal'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileUp,
  Layers,
  Loader2,
  Package,
  Pencil,
  Search,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react'

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
  const { canEditInventoryProduct, canCreateInventoryProduct } = useModuleAccess()
  const navigate = useNavigate()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loadedOrganizationId, setLoadedOrganizationId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [inventoryFilter, setInventoryFilter] = useState<
    'all' | 'completed' | 'awaiting' | 'active' | 'inactive' | 'low'
  >('all')
  const [loadError, setLoadError] = useState('')
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null)
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isConsolidating, setIsConsolidating] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string
    type: 'success' | 'error'
  } | null>(null)

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

  const handleConfirmDelete = async (reason: string) => {
    if (!currentOrganization || !itemToDelete) return
    setIsDeleting(true)
    const result = await inventoryService.delete(currentOrganization.id, itemToDelete.id, reason)
    setIsDeleting(false)

    if (result.success) {
      const deletedName = itemToDelete.name
      setItems((prev) => prev.filter((i) => i.id !== itemToDelete.id))
      setItemToDelete(null)
      setFeedbackMessage({
        text: `O produto "${deletedName}" foi excluído com sucesso.`,
        type: 'success',
      })
    } else {
      setFeedbackMessage({
        text: result.error,
        type: 'error',
      })
    }
  }

  const handleConsolidateDuplicates = async () => {
    if (!currentOrganization) return
    setIsConsolidating(true)
    try {
      const result = await inventoryService.consolidateDuplicates(currentOrganization.id)
      if (result.success) {
        const msg =
          result.data.itemsMerged > 0
            ? `${result.data.itemsMerged} produto(s) duplicado(s) foram unificados em ${result.data.groupsMerged} código(s) com sucesso.`
            : 'Nenhum produto duplicado foi encontrado no estoque.'
        setFeedbackMessage({
          text: msg,
          type: 'success',
        })
        const refreshed = await inventoryService.list(currentOrganization.id)
        if (refreshed.success) {
          setItems(refreshed.data)
        }
      } else {
        setFeedbackMessage({
          text: result.error || 'Erro ao unificar produtos duplicados.',
          type: 'error',
        })
      }
    } catch (err: any) {
      setFeedbackMessage({
        text: err?.message || 'Erro inesperado ao unificar produtos.',
        type: 'error',
      })
    } finally {
      setIsConsolidating(false)
    }
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
    const isAwaiting = item.registrationStatus === 'awaiting_information' || Number(item.unitPrice) <= 0 || !item.canSell
    const isCompleted = item.registrationStatus === 'completed' || (!isAwaiting && Number(item.unitPrice) > 0)

    const matchesStatus =
      inventoryFilter === 'all' ||
      (inventoryFilter === 'completed' && isCompleted) ||
      (inventoryFilter === 'awaiting' && isAwaiting) ||
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

        <div className="flex flex-wrap items-center gap-2">
          {canEditInventoryProduct && (
            <button
              type="button"
              disabled={isConsolidating}
              onClick={() => {
                void handleConsolidateDuplicates()
              }}
              title="Mescla produtos com o mesmo código/SKU, somando quantidades em estoque e unificando o cadastro."
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition disabled:opacity-50"
            >
              {isConsolidating ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />
              ) : (
                <Layers className="h-4 w-4 text-blue-600" aria-hidden="true" />
              )}
              {isConsolidating ? 'Unificando...' : 'Juntar Duplicados'}
            </button>
          )}

          {canCreateInventoryProduct && (
            <button
              type="button"
              onClick={() => {
                setIsImportModalOpen(true)
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <FileUp className="h-4 w-4" aria-hidden="true" />
              Importar Nota Fiscal
            </button>
          )}
        </div>
      </div>

      {feedbackMessage && (
        <div
          role="alert"
          className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-sm ${
            feedbackMessage.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
            ) : (
              <X className="h-5 w-5 text-red-600" aria-hidden="true" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setFeedbackMessage(null)
            }}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Fechar mensagem"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

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
              Pesquise por nome, código interno, código de barras, marca ou fornecedor.
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="shrink-0">Mostrar:</span>
              <ListBox
                className="w-48"
                searchable={false}
                value={inventoryFilter}
                onChange={(val) => {
                  setInventoryFilter(
                    val as 'all' | 'completed' | 'awaiting' | 'active' | 'inactive' | 'low',
                  )
                }}
                options={[
                  { value: 'all', label: 'Todos os materiais' },
                  { value: 'completed', label: 'Concluídos' },
                  { value: 'awaiting', label: 'Aguardando informação' },
                  { value: 'active', label: 'Ativos' },
                  { value: 'inactive', label: 'Inativos' },
                  { value: 'low', label: 'Estoque baixo' },
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm font-medium text-gray-700 dark:text-slate-300" aria-live="polite">
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
            const isAwaiting =
              item.registrationStatus === 'awaiting_information' ||
              Number(item.unitPrice) <= 0 ||
              !item.canSell
            return (
              <Card
                key={item.id}
                className={`rounded-xl shadow-sm transition-all ${
                  isAwaiting
                    ? 'border-amber-200 bg-amber-50/20'
                    : !item.isActive
                    ? 'border-gray-200 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-900/40 opacity-60 hover:opacity-90'
                    : 'bg-white dark:bg-[#111827] border-gray-200 dark:border-slate-800'
                }`}
              >
                <CardContent className="space-y-4 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                      {item.imagePath ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (item.imagePath) {
                              setPreviewImage({ src: item.imagePath, title: item.name })
                            }
                          }}
                          className={`group relative flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-sm transition hover:border-blue-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            !item.isActive ? 'grayscale-[35%] opacity-80' : ''
                          }`}
                          title="Clique para ampliar a foto"
                          aria-label={`Ampliar foto de ${item.name}`}
                        >
                          <img
                            src={item.imagePath}
                            alt={item.name}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                            <ZoomIn className="h-6 w-6 text-white drop-shadow" aria-hidden="true" />
                          </div>
                        </button>
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-400">
                          <Package className="h-4 w-4" aria-hidden="true" />
                          <span className="text-[9px] font-medium text-gray-400">Sem foto</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {!item.isActive && (
                            <span className="shrink-0 rounded-md border border-gray-300 bg-gray-200 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-gray-700">
                              Inativo
                            </span>
                          )}
                          {isAwaiting ? (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">
                              <AlertCircle className="h-3 w-3 text-amber-600" />
                              Aguardando informação
                            </span>
                          ) : (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700">
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                              Concluído
                            </span>
                          )}
                          <span className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                            Cód. #{item.sku || '—'}
                          </span>
                          <h2
                            className={`truncate text-base font-bold ${
                              !item.isActive ? 'text-gray-600' : 'text-gray-900'
                            }`}
                          >
                            {item.name}
                          </h2>
                        </div>
                        <p className="text-sm text-gray-500">
                          Código: <strong>#{item.sku || '—'}</strong> · Unidade: {item.unit}
                        </p>
                        {item.category && (
                          <p className="text-xs text-gray-400">
                            {item.category}
                            {item.brand ? ` · ${item.brand}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    {canEditInventoryProduct && (
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => {
                            void navigate(`/orcafacil/inventory/${item.id}/edit`)
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            isAwaiting
                              ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 font-semibold'
                              : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-blue-700 dark:hover:text-blue-400'
                          }`}
                          aria-label={`Editar ${item.name}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          {isAwaiting ? 'Completar cadastro' : 'Editar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setItemToDelete(item)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 hover:border-red-300"
                          aria-label={`Excluir ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>

                  {isAwaiting && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                      <div className="flex items-center gap-1.5 font-medium">
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                        <span>
                          <strong>Cadastro incompleto:</strong>{' '}
                          {item.pendingFields && item.pendingFields.length > 0
                            ? item.pendingFields.join(', ')
                            : 'Falta definir preço de venda'}.{' '}
                          Este material não pode ser usado em outros módulos até ser concluído.
                        </span>
                      </div>
                      {canEditInventoryProduct && (
                        <button
                          type="button"
                          onClick={() => {
                            void navigate(`/orcafacil/inventory/${item.id}/edit`)
                          }}
                          className="font-bold underline text-amber-800 hover:text-amber-950 transition"
                        >
                          Completar cadastro agora →
                        </button>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 p-4 sm:grid-cols-2 xl:grid-cols-5 border border-gray-100 dark:border-slate-800">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Código do produto
                      </p>
                      <p className="mt-1 text-sm font-bold text-blue-700 dark:text-blue-400">
                        #{item.sku || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Saldo disponível
                      </p>
                      <p
                        className={`mt-1 text-sm font-semibold ${isLowStock ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-slate-100'}`}
                      >
                        {formatQuantity(item.quantityOnHand)} {item.unit}
                        {isLowStock && <span className="ml-2 text-xs">(estoque baixo)</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Estoque mínimo
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-slate-100">
                        {formatQuantity(item.minimumQuantity)} {item.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Valor por unidade
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-slate-100">
                        {formatPrice(item.unitPrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Fornecedor
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-slate-100">
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

      <ImagePreviewModal
        open={previewImage !== null}
        src={previewImage?.src}
        title={previewImage?.title}
        onClose={() => {
          setPreviewImage(null)
        }}
      />

      <DeleteInventoryItemModal
        open={itemToDelete !== null}
        item={itemToDelete}
        isDeleting={isDeleting}
        onClose={() => {
          if (!isDeleting) setItemToDelete(null)
        }}
        onConfirm={handleConfirmDelete}
      />

      <ImportInvoiceModal
        open={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false)
        }}
        onSuccess={() => {
          if (currentOrganization) {
            void inventoryService.list(currentOrganization.id).then((result) => {
              if (result.success) setItems(result.data)
            })
          }
        }}
      />
    </div>
  )
}
