import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { supplierService } from '@modules/suppliers/services/supplier.service'
import { Button } from '@shared/components/ui/Button'
import { Card, CardContent, CardHeader } from '@shared/components/ui/Card'
import { Input } from '@shared/components/ui/Input'
import type { InventoryItem, Supplier } from '@shared/types/common'
import { logger } from '@shared/lib/logger'
import { ArrowLeft, Barcode, Package, Plus, ShoppingBag, Tag, Warehouse } from 'lucide-react'
import { inventoryService, type InventoryItemParams } from '../services/inventory.service'
import { warehouseService, type Warehouse as WarehouseOption } from '../services/warehouse.service'
import { generateSku, getSalesIndicators, isValidBarcode } from '../domain/product-identification'
import { calculateMarginPercent, calculateSalePrice } from '../domain/pricing'
import {
  clearInventoryDraft,
  getInventoryDraftKey,
  normalizeInventoryItemParams,
  readInventoryDraft,
  writeInventoryDraft,
} from '../domain/inventory-draft'

const EMPTY_FORM: InventoryItemParams = {
  supplierId: '',
  supplierIds: [],
  name: '',
  unit: '',
  quantityOnHand: '',
  minimumQuantity: '',
  unitPrice: '',
  sku: '',
  barcode: '',
  description: '',
  category: '',
  subcategory: '',
  brand: '',
  manufacturer: '',
  model: '',
  manufacturerReference: '',
  purchasePrice: '',
  extraPurchaseCost: '',
  supplierProductCode: '',
  leadTimeDays: '',
  promotionalPrice: '',
  targetMarginPercent: '',
  minimumSalePrice: '',
  maximumQuantity: '',
  idealRestockQuantity: '',
  location: '',
  warehouse: '',
  allowNegativeStock: false,
  trackExpiry: false,
  trackLot: false,
  trackSerialNumber: false,
  fiscalNcm: '',
  fiscalCest: '',
  fiscalOrigin: '',
  commercialUnit: '',
  fiscalProductCode: '',
  gtin: '',
  isActive: true,
  canSell: true,
  canPurchase: true,
  notes: '',
  purchaseUnit: '',
  purchaseUnitFactor: '',
  attributes: {},
}

const STANDARD_UNITS = [
  ['UN', 'Unidade (UN)'],
  ['KG', 'Quilograma (KG)'],
  ['G', 'Grama (G)'],
  ['L', 'Litro (L)'],
  ['ML', 'Mililitro (ML)'],
  ['M', 'Metro (M)'],
  ['CM', 'Centímetro (CM)'],
  ['M2', 'Metro quadrado (M²)'],
  ['M3', 'Metro cúbico (M³)'],
  ['CX', 'Caixa (CX)'],
  ['PCT', 'Pacote (PCT)'],
  ['FD', 'Fardo (FD)'],
  ['DZ', 'Dúzia (DZ)'],
]

function getFormFromItem(item: InventoryItem): InventoryItemParams {
  return {
    supplierId: item.supplierId ?? '',
    supplierIds: item.suppliers.map((supplier) => supplier.supplierId),
    name: item.name,
    unit: item.unit,
    quantityOnHand: item.quantityOnHand,
    minimumQuantity: item.minimumQuantity,
    unitPrice: item.unitPrice,
    sku: item.sku,
    barcode: item.barcode ?? '',
    description: item.description ?? '',
    category: item.category ?? '',
    subcategory: item.subcategory ?? '',
    brand: item.brand ?? '',
    manufacturer: item.manufacturer ?? '',
    model: item.model ?? '',
    manufacturerReference: item.manufacturerReference ?? '',
    purchasePrice: item.purchasePrice,
    extraPurchaseCost: item.extraPurchaseCost,
    supplierProductCode: item.supplierProductCode ?? '',
    leadTimeDays: item.leadTimeDays?.toString() ?? '',
    promotionalPrice: item.promotionalPrice ?? '',
    targetMarginPercent: item.targetMarginPercent ?? '',
    minimumSalePrice: item.minimumSalePrice ?? '',
    maximumQuantity: item.maximumQuantity,
    idealRestockQuantity: item.idealRestockQuantity,
    location: item.location ?? '',
    warehouse: item.warehouse ?? '',
    allowNegativeStock: item.allowNegativeStock,
    trackExpiry: item.trackExpiry,
    trackLot: item.trackLot,
    trackSerialNumber: item.trackSerialNumber,
    fiscalNcm: item.fiscalNcm ?? '',
    fiscalCest: item.fiscalCest ?? '',
    fiscalOrigin: item.fiscalOrigin ?? '',
    commercialUnit: item.commercialUnit ?? '',
    fiscalProductCode: item.fiscalProductCode ?? '',
    gtin: item.gtin ?? '',
    isActive: item.isActive,
    canSell: item.canSell,
    canPurchase: item.canPurchase,
    notes: item.notes ?? '',
    purchaseUnit: item.purchaseUnit ?? '',
    purchaseUnitFactor: item.purchaseUnitFactor,
    attributes: item.attributes,
  }
}

export function InventoryFormPage() {
  const { user } = useAuth()
  const { currentOrganization } = useOrganization()
  const navigate = useNavigate()
  const { inventoryItemId } = useParams()
  const isEditing = inventoryItemId !== undefined
  const organizationId = currentOrganization?.id
  const userId = user?.id
  const draftKey =
    organizationId && userId && isEditing
      ? getInventoryDraftKey(userId, organizationId, inventoryItemId)
      : null
  const resourceKey =
    organizationId && inventoryItemId ? `${organizationId}:${inventoryItemId}` : null
  const [form, setForm] = useState<InventoryItemParams>(() => ({
    ...EMPTY_FORM,
  }))
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [currentQuantity, setCurrentQuantity] = useState('0')
  const [formError, setFormError] = useState('')
  const [supplierError, setSupplierError] = useState('')
  const [draftStorageWarning, setDraftStorageWarning] = useState('')
  const [draftHydratedKey, setDraftHydratedKey] = useState<string | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const hasLoggedStorageError = useRef(false)
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [isCreatingWarehouse, setIsCreatingWarehouse] = useState(false)
  const [newWarehouseName, setNewWarehouseName] = useState('')
  const [warehouseError, setWarehouseError] = useState('')
  const [isSavingWarehouse, setIsSavingWarehouse] = useState(false)

  useEffect(() => {
    if (!organizationId) return
    let active = true
    void warehouseService.list(organizationId).then((result) => {
      if (!active) return
      if (result.success) {
        setWarehouses(result.data)
        setWarehouseError('')
      } else {
        setWarehouseError(result.error)
      }
    })
    return () => {
      active = false
    }
  }, [organizationId])

  useEffect(() => {
    if (!organizationId || !userId) return
    const active = { current: true }
    const isActive = () => active.current
    const activeDraftKey = getInventoryDraftKey(userId, organizationId, inventoryItemId)

    const loadForm = async () => {
      setFormError('')

      try {
        if (inventoryItemId === undefined) {
          clearInventoryDraft(activeDraftKey)
          setForm({ ...EMPTY_FORM })
          setCurrentQuantity('0')
          setDraftHydratedKey(null)
          setDraftStorageWarning('')

          const suppliersResult = await supplierService.list(organizationId)
          if (!isActive()) return
          if (suppliersResult.success) {
            setSuppliers(suppliersResult.data)
            setSupplierError('')
          } else {
            setSupplierError(suppliersResult.error)
          }
          return
        }

        const savedDraft = readInventoryDraft(activeDraftKey)
        if (savedDraft.status === 'unavailable') {
          setDraftStorageWarning(
            'O armazenamento desta aba está indisponível; o rascunho não poderá ser preservado.',
          )
        } else if (savedDraft.status === 'invalid' || savedDraft.status === 'expired') {
          setDraftStorageWarning('O rascunho anterior expirou ou estava inválido e foi descartado.')
        } else {
          setDraftStorageWarning('')
        }

        const [suppliersResult, result] = await Promise.all([
          supplierService.list(organizationId),
          inventoryService.getById(organizationId, inventoryItemId),
        ])
        if (!isActive()) return
        if (suppliersResult.success) {
          setSuppliers(suppliersResult.data)
          setSupplierError('')
        } else {
          setSupplierError(suppliersResult.error)
        }

        if (result.success) {
          setCurrentQuantity(result.data.quantityOnHand)
          setForm(savedDraft.status === 'draft' ? savedDraft.form : getFormFromItem(result.data))
        } else {
          setCurrentQuantity('0')
          setForm(
            savedDraft.status === 'draft' ? savedDraft.form : { ...EMPTY_FORM },
          )
          setFormError(result.error)
        }
        setDraftHydratedKey(activeDraftKey)
        setLoadedKey(`${organizationId}:${inventoryItemId}`)
      } catch (error) {
        if (!isActive()) return
        logger.error('Falha ao carregar o formulário do estoque', error)
        setFormError('Não foi possível carregar os dados do formulário. Tente novamente.')
        setDraftHydratedKey(activeDraftKey)
        if (inventoryItemId) setLoadedKey(`${organizationId}:${inventoryItemId}`)
      }
    }
    void loadForm()
    return () => {
      active.current = false
    }
  }, [organizationId, userId, inventoryItemId])

  const persistDraft = (nextForm: InventoryItemParams) => {
    if (!isEditing || !draftKey || draftHydratedKey !== draftKey) return
    if (!writeInventoryDraft(draftKey, nextForm)) {
      setDraftStorageWarning(
        'O salvamento automático do rascunho nesta aba falhou. Isso não impede salvar o material; clique em “Salvar alterações” para enviar.',
      )
      if (!hasLoggedStorageError.current) {
        logger.warn('Não foi possível preservar o rascunho do estoque nesta sessão.')
        hasLoggedStorageError.current = true
      }
      return
    }
    hasLoggedStorageError.current = false
    setDraftStorageWarning('')
  }

  const isLoading =
    isEditing && !!draftKey && (draftHydratedKey !== draftKey || loadedKey !== resourceKey)
  const salesIndicators = useMemo(
    () => getSalesIndicators(form.purchasePrice, form.unitPrice),
    [form.purchasePrice, form.unitPrice],
  )

  const updateFormFields = (changes: Partial<InventoryItemParams>) => {
    const updatedForm = { ...form, ...changes }
    setForm(updatedForm)
    persistDraft(updatedForm)
  }

  const updateForm = <K extends keyof InventoryItemParams>(
    field: K,
    value: InventoryItemParams[K],
  ) => {
    updateFormFields({ [field]: value })
  }

  const handleCreateWarehouse = async () => {
    if (!organizationId) return
    const name = newWarehouseName.trim()
    if (!name) {
      setWarehouseError('Informe o nome do depósito.')
      return
    }
    const existing = warehouses.find((w) => w.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      updateForm('warehouse', existing.name)
      setIsCreatingWarehouse(false)
      setNewWarehouseName('')
      setWarehouseError('')
      return
    }
    setIsSavingWarehouse(true)
    const result = await warehouseService.create(organizationId, name)
    setIsSavingWarehouse(false)
    if (!result.success) {
      setWarehouseError(result.error)
      return
    }
    setWarehouses((current) =>
      [...current, result.data].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    )
    updateForm('warehouse', result.data.name)
    setIsCreatingWarehouse(false)
    setNewWarehouseName('')
    setWarehouseError('')
  }

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentOrganization) {
      setFormError('Selecione uma organização antes de salvar o material.')
      return
    }

    const submittedForm = normalizeInventoryItemParams(form)
    if (!submittedForm) {
      setFormError('Os dados do formulário estão inválidos. Revise os campos e tente novamente.')
      return
    }

    if (submittedForm.name.trim().length < 2 || !submittedForm.unit.trim()) {
      setFormError('Informe o nome do material e sua unidade de medida.')
      return
    }
    const finalSku = submittedForm.sku.trim() || generateSku()
    if (!isValidBarcode(submittedForm.barcode)) {
      setFormError(
        'Confira o código de barras. EAN-8, UPC e EAN-13 precisam ter dígito verificador válido.',
      )
      return
    }
    const nonNegativeFields = [
      submittedForm.quantityOnHand,
      submittedForm.minimumQuantity,
      submittedForm.maximumQuantity,
      submittedForm.idealRestockQuantity,
      submittedForm.unitPrice,
      submittedForm.purchasePrice,
      submittedForm.extraPurchaseCost,
      submittedForm.promotionalPrice,
      submittedForm.targetMarginPercent,
      submittedForm.minimumSalePrice,
      submittedForm.leadTimeDays,
    ].filter((value) => value.trim() !== '')
    if (nonNegativeFields.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) {
      setFormError('Quantidades, prazos e valores devem ser números iguais ou maiores que zero.')
      return
    }
    if (
      Number(submittedForm.maximumQuantity) > 0 &&
      Number(submittedForm.minimumQuantity) > Number(submittedForm.maximumQuantity)
    ) {
      setFormError('O estoque máximo não pode ser menor que o estoque mínimo.')
      return
    }
    if (Number(currentQuantity) < 0 && !form.allowNegativeStock) {
      setFormError(
        'Ajuste o saldo para zero ou positivo antes de desativar a permissão de estoque negativo.',
      )
      return
    }
    const purchaseUnitFactor = submittedForm.purchaseUnitFactor.trim() || '1'
    if (
      !Number.isFinite(Number(purchaseUnitFactor)) ||
      Number(purchaseUnitFactor) <= 0
    ) {
      setFormError('O fator da unidade de compra deve ser maior que zero.')
      return
    }
    if (submittedForm.leadTimeDays && !Number.isInteger(Number(submittedForm.leadTimeDays))) {
      setFormError('O prazo de reposição deve ser informado em dias inteiros.')
      return
    }

    setIsSaving(true)
    setFormError('')
    try {
      const params = {
        ...submittedForm,
        sku: finalSku,
        quantityOnHand: submittedForm.quantityOnHand.trim() || '0',
        minimumQuantity: submittedForm.minimumQuantity.trim() || '0',
        unitPrice: submittedForm.unitPrice.trim() || '0.00',
        purchasePrice: submittedForm.purchasePrice.trim() || '0.00',
        extraPurchaseCost: submittedForm.extraPurchaseCost.trim() || '0.00',
        maximumQuantity: submittedForm.maximumQuantity.trim() || '0',
        idealRestockQuantity: submittedForm.idealRestockQuantity.trim() || '0',
        purchaseUnitFactor,
        supplierId: submittedForm.supplierIds[0] ?? submittedForm.supplierId,
      }
      const result =
        isEditing && inventoryItemId
          ? await inventoryService.update(currentOrganization.id, inventoryItemId, params)
          : await inventoryService.create(currentOrganization.id, params)

      if (!result.success) {
        setFormError(result.error)
        return
      }
      if (draftKey) {
        if (!clearInventoryDraft(draftKey)) {
          logger.warn('O produto foi salvo, mas o rascunho da sessão não pôde ser removido.')
          setDraftStorageWarning(
            'O material foi salvo, mas não foi possível limpar o rascunho automático desta aba.',
          )
        }
        setDraftHydratedKey(null)
      }
      void navigate('/orcafacil/inventory/search')
    } catch (error) {
      logger.error('Falha inesperada ao salvar material do estoque', error)
      setFormError('Não foi possível salvar o material. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/orcafacil/inventory/search"
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="Voltar ao estoque"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {isEditing ? 'Editar Material' : 'Cadastrar Material'}
          </h1>
          <p className="text-sm text-gray-500">
            Informe a unidade usada para controlar o saldo, como metro, quilo ou litro.
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-gray-500">
            Carregando material...
          </CardContent>
        </Card>
      ) : (
        <form noValidate onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {formError}
            </div>
          )}
          {supplierError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Não foi possível carregar os fornecedores: {supplierError}
            </div>
          )}
          {draftStorageWarning && (
            <div
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
            >
              {draftStorageWarning}
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Informações básicas</h2>
                  <p className="text-xs text-gray-500">Comece pelo que identifica o produto.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Nome do produto *"
                placeholder="Ex.: Cabo elétrico flexível"
                minLength={2}
                value={form.name}
                onChange={(event) => {
                  updateForm('name', event.target.value)
                }}
                required
              />
              <Input
                label="Código interno (SKU)"
                placeholder="Ex.: PRD-001 (ou deixe em branco para gerar automaticamente)"
                helperText="Código exclusivo para localizar o produto. Se deixar vazio, será gerado automaticamente."
                value={form.sku}
                onChange={(event) => {
                  updateForm('sku', event.target.value)
                }}
              />
              <Input
                label="Código de barras"
                placeholder="Digite ou leia com o leitor USB"
                helperText="Leitores USB funcionam como teclado: clique aqui e faça a leitura."
                value={form.barcode}
                onChange={(event) => {
                  updateForm('barcode', event.target.value)
                }}
                maxLength={50}
              />
              <Input
                label="Unidade usada no saldo *"
                list="inventory-standard-units"
                placeholder="Ex.: M, KG, L ou caixa"
                helperText="É a unidade usada para controlar e movimentar o estoque."
                value={form.unit}
                onChange={(event) => {
                  updateForm('unit', event.target.value)
                }}
                maxLength={30}
                required
              />
              <datalist id="inventory-standard-units">
                {STANDARD_UNITS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </datalist>
              <Input
                label="Categoria"
                placeholder="Ex.: Material elétrico"
                value={form.category}
                onChange={(event) => {
                  updateForm('category', event.target.value)
                }}
              />
              <Input
                label="Subcategoria"
                placeholder="Ex.: Cabos"
                value={form.subcategory}
                onChange={(event) => {
                  updateForm('subcategory', event.target.value)
                }}
              />
              <Input
                label="Marca"
                placeholder="Ex.: Marca do fabricante"
                value={form.brand}
                onChange={(event) => {
                  updateForm('brand', event.target.value)
                }}
              />
              <Input
                label="Modelo"
                placeholder="Ex.: Modelo ou linha"
                value={form.model}
                onChange={(event) => {
                  updateForm('model', event.target.value)
                }}
              />
              <div className="sm:col-span-2">
                <label
                  htmlFor="inventory-description"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Descrição
                </label>
                <textarea
                  id="inventory-description"
                  rows={2}
                  placeholder="Detalhes para ajudar a identificar este produto."
                  value={form.description}
                  onChange={(event) => {
                    updateForm('description', event.target.value)
                  }}
                  className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-amber-600" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Estoque e localização</h2>
                  <p className="text-xs text-gray-500">
                    O saldo será atualizado por movimentações registradas.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isEditing ? (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <p className="text-xs font-medium text-blue-800">Saldo atual</p>
                  <p className="mt-1 text-lg font-bold text-blue-900">
                    {Number(currentQuantity).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}{' '}
                    {form.unit}
                  </p>
                  <p className="mt-1 text-xs text-blue-700">
                    Para alterar o saldo, use uma entrada, saída ou ajuste no histórico.
                  </p>
                </div>
              ) : (
                <Input
                  label="Quantidade inicial"
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="0"
                  helperText="Se estiver começando agora, pode deixar em branco (zero) e registrar a entrada depois."
                  value={form.quantityOnHand}
                  onChange={(event) => {
                    updateForm('quantityOnHand', event.target.value)
                  }}
                />
              )}
              <Input
                label="Estoque mínimo"
                type="number"
                min="0"
                step="0.0001"
                placeholder="0"
                helperText="O sistema destaca o produto quando atingir esse saldo."
                value={form.minimumQuantity}
                onChange={(event) => {
                  updateForm('minimumQuantity', event.target.value)
                }}
              />
              <Input
                label="Estoque máximo"
                type="number"
                min="0"
                step="0.0001"
                placeholder="0"
                value={form.maximumQuantity}
                onChange={(event) => {
                  updateForm('maximumQuantity', event.target.value)
                }}
              />
              <Input
                label="Quantidade ideal para reposição"
                type="number"
                min="0"
                step="0.0001"
                placeholder="0"
                value={form.idealRestockQuantity}
                onChange={(event) => {
                  updateForm('idealRestockQuantity', event.target.value)
                }}
              />
              <div className="space-y-1.5">
                <label
                  htmlFor="inventory-warehouse"
                  className="block text-sm font-medium text-gray-700"
                >
                  Depósito
                </label>
                <div className="flex gap-2">
                  <select
                    id="inventory-warehouse"
                    value={form.warehouse}
                    onChange={(event) => {
                      updateForm('warehouse', event.target.value)
                    }}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione um depósito</option>
                    {form.warehouse &&
                      !warehouses.some((w) => w.name === form.warehouse) && (
                        <option value={form.warehouse}>{form.warehouse}</option>
                      )}
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.name}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreatingWarehouse((open) => !open)
                      setWarehouseError('')
                    }}
                    aria-label="Criar novo depósito"
                    title="Criar novo depósito"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Novo
                  </Button>
                </div>
                {isCreatingWarehouse && (
                  <div className="flex gap-2 pt-1">
                    <input
                      autoFocus
                      value={newWarehouseName}
                      placeholder="Ex.: Loja principal"
                      maxLength={100}
                      onChange={(event) => {
                        setNewWarehouseName(event.target.value)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void handleCreateWarehouse()
                        }
                        if (event.key === 'Escape') setIsCreatingWarehouse(false)
                      }}
                      className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button
                      type="button"
                      isLoading={isSavingWarehouse}
                      onClick={() => void handleCreateWarehouse()}
                    >
                      Salvar
                    </Button>
                  </div>
                )}
                {warehouseError ? (
                  <p className="text-xs text-red-600">{warehouseError}</p>
                ) : (
                  <p className="text-xs text-gray-500">
                    Depósitos criados ficam salvos para os próximos materiais.
                  </p>
                )}
              </div>
              <Input
                label="Localização"
                placeholder="Ex.: Corredor 2, prateleira A"
                value={form.location}
                onChange={(event) => {
                  updateForm('location', event.target.value)
                }}
              />
              <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.allowNegativeStock}
                  onChange={(event) => {
                    updateForm('allowNegativeStock', event.target.checked)
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Permitir saldo negativo para este produto
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Compra e venda</h2>
                  <p className="text-xs text-gray-500">
                    Compra, custo médio e venda são valores diferentes.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input
                  label="1. Preço de compra (R$)"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  helperText="Quanto você paga ao fornecedor."
                  value={form.purchasePrice}
                  onChange={(event) => {
                    const purchasePrice = event.target.value
                    const salePrice = calculateSalePrice(purchasePrice, form.targetMarginPercent)
                    updateFormFields(
                      salePrice ? { purchasePrice, unitPrice: salePrice } : { purchasePrice },
                    )
                  }}
                />
                <Input
                  label="2. Margem desejada (%)"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  helperText="Percentual somado ao preço de compra."
                  value={form.targetMarginPercent}
                  onChange={(event) => {
                    const targetMarginPercent = event.target.value
                    const salePrice = calculateSalePrice(form.purchasePrice, targetMarginPercent)
                    updateFormFields(
                      salePrice
                        ? { targetMarginPercent, unitPrice: salePrice }
                        : { targetMarginPercent },
                    )
                  }}
                />
                <Input
                  label="3. Preço de venda (R$)"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  helperText="Calculado automaticamente. Se alterar, a margem é recalculada."
                  value={form.unitPrice}
                  onChange={(event) => {
                    const unitPrice = event.target.value
                    const margin = calculateMarginPercent(form.purchasePrice, unitPrice)
                    const hasPurchasePrice = Number(form.purchasePrice) > 0
                    updateFormFields(
                      hasPurchasePrice ? { unitPrice, targetMarginPercent: margin } : { unitPrice },
                    )
                  }}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input
                  label="Outros custos de compra (R$)"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  helperText="Ex.: frete ou despesas adicionais."
                  value={form.extraPurchaseCost}
                  onChange={(event) => {
                    updateForm('extraPurchaseCost', event.target.value)
                  }}
                />
                <Input
                  label="Preço promocional (R$)"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.promotionalPrice}
                  onChange={(event) => {
                    updateForm('promotionalPrice', event.target.value)
                  }}
                />
                <Input
                  label="Preço mínimo de venda (R$)"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.minimumSalePrice}
                  onChange={(event) => {
                    updateForm('minimumSalePrice', event.target.value)
                  }}
                />
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">Estimativa de resultado</p>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-emerald-800">
                  <span>Lucro bruto: R$ {salesIndicators.grossProfit}</span>
                  <span>
                    Margem sobre a compra:{' '}
                    {salesIndicators.markupPercent.toLocaleString('pt-BR', {
                      maximumFractionDigits: 2,
                    })}
                    %
                  </span>
                  <span>
                    Participação do lucro na venda:{' '}
                    {salesIndicators.marginPercent.toLocaleString('pt-BR', {
                      maximumFractionDigits: 2,
                    })}
                    %
                  </span>
                </div>
                <p className="mt-2 text-xs text-emerald-700">
                  Estimativa antes de impostos e despesas operacionais.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-violet-600" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Fornecedores</h2>
                  <p className="text-xs text-gray-500">Você pode vincular mais de um fornecedor.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {suppliers.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nenhum fornecedor cadastrado. Você pode vincular um depois.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {suppliers.map((supplier) => (
                    <label
                      key={supplier.id}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={form.supplierIds.includes(supplier.id)}
                        onChange={(event) => {
                          const supplierIds = event.target.checked
                            ? [...form.supplierIds, supplier.id]
                            : form.supplierIds.filter((id) => id !== supplier.id)
                          updateFormFields({
                            supplierIds,
                            supplierId: supplierIds[0] ?? '',
                          })
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {supplier.name}
                    </label>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Código deste produto no fornecedor"
                  value={form.supplierProductCode}
                  onChange={(event) => {
                    updateForm('supplierProductCode', event.target.value)
                  }}
                />
                <Input
                  label="Prazo médio de reposição (dias)"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={form.leadTimeDays}
                  onChange={(event) => {
                    updateForm('leadTimeDays', event.target.value)
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <details className="group rounded-xl border border-gray-200 bg-white shadow-sm">
            <summary className="cursor-pointer list-none p-5 text-sm font-semibold text-gray-900">
              <span className="inline-flex items-center gap-2">
                <Barcode className="h-4 w-4 text-gray-500" aria-hidden="true" />
                Mais informações (opcional)
              </span>
              <p className="mt-1 pl-6 text-xs font-normal text-gray-500">
                Características, validade, lote, números de série e dados fiscais.
              </p>
            </summary>
            <div className="space-y-6 border-t border-gray-100 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Fabricante"
                  value={form.manufacturer}
                  onChange={(event) => {
                    updateForm('manufacturer', event.target.value)
                  }}
                />
                <Input
                  label="Referência do fabricante"
                  value={form.manufacturerReference}
                  onChange={(event) => {
                    updateForm('manufacturerReference', event.target.value)
                  }}
                />
                <Input
                  label="Unidade de compra (opcional)"
                  placeholder="Ex.: caixa"
                  value={form.purchaseUnit}
                  onChange={(event) => {
                    updateForm('purchaseUnit', event.target.value)
                  }}
                />
                <Input
                  label="Quantas unidades de estoque vêm na compra?"
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  placeholder="1"
                  helperText="Ex.: 1 caixa contém 12 unidades. Se não informado, o padrão é 1."
                  value={form.purchaseUnitFactor}
                  onChange={(event) => {
                    updateForm('purchaseUnitFactor', event.target.value)
                  }}
                />
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-800">Características</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    ['color', 'Cor'],
                    ['size', 'Tamanho'],
                    ['voltage', 'Voltagem'],
                    ['power', 'Potência'],
                    ['dimensions', 'Dimensões'],
                    ['weight', 'Peso'],
                    ['material', 'Material'],
                    ['capacity', 'Capacidade'],
                    ['compatibility', 'Compatibilidade'],
                  ].map(([key, label]) => (
                    <Input
                      key={key}
                      label={label}
                      value={form.attributes[key] ?? ''}
                      onChange={(event) => {
                        updateForm('attributes', { ...form.attributes, [key]: event.target.value })
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-800">Controle especial</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['trackExpiry', 'Controlar data de validade'],
                    ['trackLot', 'Controlar lote'],
                    ['trackSerialNumber', 'Controlar número de série'],
                  ].map(([field, label]) => (
                    <label key={field} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={form[field as 'trackExpiry' | 'trackLot' | 'trackSerialNumber']}
                        onChange={(event) => {
                          updateForm(
                            field as 'trackExpiry' | 'trackLot' | 'trackSerialNumber',
                            event.target.checked,
                          )
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  O registro detalhado de lotes, validade e números de série será habilitado em uma
                  próxima etapa.
                </p>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-800">Informações fiscais</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="NCM"
                    value={form.fiscalNcm}
                    onChange={(event) => {
                      updateForm('fiscalNcm', event.target.value)
                    }}
                  />
                  <Input
                    label="CEST"
                    value={form.fiscalCest}
                    onChange={(event) => {
                      updateForm('fiscalCest', event.target.value)
                    }}
                  />
                  <Input
                    label="Código fiscal do produto"
                    value={form.fiscalProductCode}
                    onChange={(event) => {
                      updateForm('fiscalProductCode', event.target.value)
                    }}
                  />
                  <Input
                    label="GTIN/EAN"
                    value={form.gtin}
                    onChange={(event) => {
                      updateForm('gtin', event.target.value)
                    }}
                  />
                  <label className="space-y-1.5 text-sm font-medium text-gray-700">
                    Origem da mercadoria
                    <select
                      value={form.fiscalOrigin}
                      onChange={(event) => {
                        updateForm('fiscalOrigin', event.target.value)
                      }}
                      className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal"
                    >
                      <option value="">Não informado</option>
                      <option value="0">0 · Nacional</option>
                      <option value="1">1 · Importação direta</option>
                      <option value="2">2 · Adquirida no mercado interno</option>
                    </select>
                  </label>
                  <Input
                    label="Unidade comercial"
                    value={form.commercialUnit}
                    onChange={(event) => {
                      updateForm('commercialUnit', event.target.value)
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-3">
                {[
                  ['isActive', 'Produto ativo'],
                  ['canSell', 'Permitir venda'],
                  ['canPurchase', 'Permitir compra'],
                ].map(([field, label]) => (
                  <label key={field} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form[field as 'isActive' | 'canSell' | 'canPurchase']}
                      onChange={(event) => {
                        updateForm(
                          field as 'isActive' | 'canSell' | 'canPurchase',
                          event.target.checked,
                        )
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div>
                <label
                  htmlFor="inventory-notes"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Observações internas
                </label>
                <textarea
                  id="inventory-notes"
                  rows={2}
                  value={form.notes}
                  onChange={(event) => {
                    updateForm('notes', event.target.value)
                  }}
                  className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </details>

          <div className="flex justify-end gap-3">
            <Link to="/orcafacil/inventory/search">
              <Button type="button" variant="outline" disabled={isSaving}>
                Cancelar
              </Button>
            </Link>
            <Button type="submit" isLoading={isSaving}>
              {isEditing ? 'Salvar alterações' : 'Cadastrar material'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
