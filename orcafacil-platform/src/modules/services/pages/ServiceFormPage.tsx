import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useAuth } from '@modules/auth/context/AuthContext'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Package,
  Plus,
  Save,
  Trash2,
  Wrench,
  AlertCircle,
} from 'lucide-react'
import {
  serviceService,
  type ServiceCategory,
  type ServiceMaterialInput,
  BILLING_UNITS,
} from '../services/service.service'
import {
  calculateServiceTotalCost,
  calculateProfitMargin,
  calculatePriceFromMargin,
} from '../domain/service-calculations'
import { ServiceCategoryModal } from '../components/ServiceCategoryModal'
import { supabase } from '@app/config/supabase'

interface InventoryProductOption {
  id: string
  name: string
  unit: string
  unit_price: number
  quantity_on_hand: number
}

export function ServiceFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { currentOrganization } = useOrganization()
  const { user, profile } = useAuth()

  const [activeTab, setActiveTab] = useState<'general' | 'pricing' | 'materials' | 'fiscal'>('general')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(isEditing)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)

  // Categorias cadastradas & Produtos do Estoque
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProductOption[]>([])

  // ABA 1: Informações Gerais
  const [serviceCode, setServiceCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [billingUnit, setBillingUnit] = useState<string>('unidade')
  const [estimatedTime, setEstimatedTime] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [internalNotes, setInternalNotes] = useState('')

  // ABA 2: Precificação
  const [operationalCostInput, setOperationalCostInput] = useState('0,00')
  const [laborCostInput, setLaborCostInput] = useState('0,00')
  const [salePriceInput, setSalePriceInput] = useState('0,00')
  const [profitMarginInput, setProfitMarginInput] = useState('0,00')
  const [minimumSalePriceInput, setMinimumSalePriceInput] = useState('0,00')
  const [allowDiscount, setAllowDiscount] = useState(true)
  const [commissionRateInput, setCommissionRateInput] = useState('0,00')

  // ABA 3: Materiais do Estoque vinculados
  const [materials, setMaterials] = useState<
    (ServiceMaterialInput & { id: string; productName: string; availableStock?: number })[]
  >([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [materialQtyInput, setMaterialQtyInput] = useState('1')

  // ABA 4: Dados Fiscais (NFS-e & Reforma 2026)
  const [lc116Item, setLc116Item] = useState('')
  const [nfsNationalCode, setNfsNationalCode] = useState('')
  const [nfsMunicipalCode, setNfsMunicipalCode] = useState('')
  const [cnaeCode, setCnaeCode] = useState('')
  const [nbsCode, setNbsCode] = useState('')
  const [fiscalDescription, setFiscalDescription] = useState('')
  const [issRateInput, setIssRateInput] = useState('0,00')
  const [issTaxType, setIssTaxType] = useState('tributavel')
  const [issWithheld, setIssWithheld] = useState(false)
  const [deductionsAllowed, setDeductionsAllowed] = useState(false)
  const [issRequirement, setIssRequirement] = useState('exigivel')
  const [cstIbsCbs, setCstIbsCbs] = useState('')
  const [cClassTrib, setCClassTrib] = useState('')
  const [ibsRateInput, setIbsRateInput] = useState('0,00')
  const [cbsRateInput, setCbsRateInput] = useState('0,00')
  const [taxRulesNotes, setTaxRulesNotes] = useState('')

  // Helpers de parsing de moeda pt-BR
  const parseCurrencyInput = (val: string): number => {
    if (!val) return 0
    const clean = val.replace(/\./g, '').replace(',', '.')
    const n = parseFloat(clean)
    return isNaN(n) ? 0 : n
  }

  const formatNumberToCurrencyInput = (num: number): string => {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Custo de materiais calculado
  const computedMaterialsCost = materials.reduce((acc, m) => {
    const q = Number(m.quantity) || 0
    const c = Number(m.unitCost) || 0
    return acc + q * c
  }, 0)

  // Custo Total
  const computedTotalCost = calculateServiceTotalCost({
    operationalCost: parseCurrencyInput(operationalCostInput),
    laborCost: parseCurrencyInput(laborCostInput),
    materialsCost: computedMaterialsCost,
  })

  // Efeito ao carregar dados iniciais (ou serviço a ser editado)
  useEffect(() => {
    if (!currentOrganization) return

    const loadInitials = async () => {
      // 1. Carrega categorias
      const catRes = await serviceService.listCategories(currentOrganization.id)
      if (catRes.success) {
        setCategories(catRes.data)
      }

      // 2. Carrega produtos do estoque disponíveis
      const { data: invData } = await supabase
        .from('inventory_items')
        .select('id, name, unit, unit_price, quantity_on_hand')
        .eq('organization_id', currentOrganization.id)
        .order('name', { ascending: true })

      if (invData) {
        setInventoryProducts(invData)
      }

      // 3. Se for edição, carrega dados do serviço
      if (isEditing && id) {
        const servRes = await serviceService.getServiceById(currentOrganization.id, id)
        if (servRes.success) {
          const s = servRes.data
          setServiceCode(s.serviceCode)
          setName(s.name)
          setDescription(s.description || '')
          setCategoryId(s.categoryId || '')
          setBillingUnit(s.billingUnit || 'unidade')
          setEstimatedTime(s.estimatedTime || '')
          setIsActive(s.isActive)
          setInternalNotes(s.internalNotes || '')

          setOperationalCostInput(formatNumberToCurrencyInput(Number(s.operationalCost)))
          setLaborCostInput(formatNumberToCurrencyInput(Number(s.laborCost)))
          setSalePriceInput(formatNumberToCurrencyInput(Number(s.salePrice)))
          setProfitMarginInput(formatNumberToCurrencyInput(Number(s.profitMargin)))
          setMinimumSalePriceInput(formatNumberToCurrencyInput(Number(s.minimumSalePrice)))
          setAllowDiscount(s.allowDiscount)
          setCommissionRateInput(formatNumberToCurrencyInput(Number(s.commissionRate)))

          setMaterials(
            s.materials.map((m) => ({
              id: m.id,
              inventoryItemId: m.inventoryItemId,
              productName: m.productName,
              quantity: m.quantity,
              unit: m.unit,
              unitCost: m.unitCost,
              totalCost: m.totalCost,
              availableStock: m.availableStock ? Number(m.availableStock) : undefined,
            })),
          )

          setLc116Item(s.lc116Item || '')
          setNfsNationalCode(s.nfsNationalCode || '')
          setNfsMunicipalCode(s.nfsMunicipalCode || '')
          setCnaeCode(s.cnaeCode || '')
          setNbsCode(s.nbsCode || '')
          setFiscalDescription(s.fiscalDescription || '')
          setIssRateInput(formatNumberToCurrencyInput(Number(s.issRate)))
          setIssTaxType(s.issTaxType || 'tributavel')
          setIssWithheld(s.issWithheld)
          setDeductionsAllowed(s.deductionsAllowed)
          setIssRequirement(s.issRequirement || 'exigivel')
          setCstIbsCbs(s.cstIbsCbs || '')
          setCClassTrib(s.cClassTrib || '')
          setIbsRateInput(formatNumberToCurrencyInput(Number(s.ibsRate)))
          setCbsRateInput(formatNumberToCurrencyInput(Number(s.cbsRate)))
          setTaxRulesNotes(s.taxRulesNotes || '')
        } else {
          setErrorMessage(servRes.error)
        }
        setIsLoadingData(false)
      } else {
        // Código automático para novo serviço
        const nextCode = await serviceService.generateNextServiceCode(currentOrganization.id)
        setServiceCode(nextCode)
        setIsLoadingData(false)
      }
    }

    void loadInitials()
  }, [currentOrganization, id, isEditing])

  // Recalcula margem quando o preço de venda é alterado
  const handleSalePriceChange = (val: string) => {
    setSalePriceInput(val)
    const price = parseCurrencyInput(val)
    if (price > 0 && computedTotalCost > 0) {
      const margin = calculateProfitMargin(computedTotalCost, price)
      setProfitMarginInput(formatNumberToCurrencyInput(margin))
    }
  }

  // Recalcula preço sugerido quando a margem é alterada diretamente
  const handleProfitMarginChange = (val: string) => {
    setProfitMarginInput(val)
    const margin = parseCurrencyInput(val)
    if (computedTotalCost > 0 && margin > 0 && margin < 100) {
      const price = calculatePriceFromMargin(computedTotalCost, margin)
      setSalePriceInput(formatNumberToCurrencyInput(price))
    }
  }

  // Adicionar Material do Estoque
  const handleAddMaterial = () => {
    if (!selectedProductId) return
    const prod = inventoryProducts.find((p) => p.id === selectedProductId)
    if (!prod) return

    // Se já estiver na lista, apenas atualiza quantidade
    const existingIndex = materials.findIndex((m) => m.inventoryItemId === prod.id)
    const qty = Math.max(0.0001, parseFloat(materialQtyInput.replace(',', '.')) || 1)
    const unitCost = Number(prod.unit_price) || 0

    if (existingIndex >= 0) {
      const updated = [...materials]
      const newQty = Number(updated[existingIndex].quantity) + qty
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQty.toFixed(4),
        totalCost: (newQty * unitCost).toFixed(4),
      }
      setMaterials(updated)
    } else {
      setMaterials([
        ...materials,
        {
          id: crypto.randomUUID(),
          inventoryItemId: prod.id,
          productName: prod.name,
          quantity: qty.toFixed(4),
          unit: prod.unit,
          unitCost: unitCost.toFixed(4),
          totalCost: (qty * unitCost).toFixed(4),
          availableStock: prod.quantity_on_hand,
        },
      ])
    }

    setSelectedProductId('')
    setMaterialQtyInput('1')
  }

  // Remover material da lista
  const handleRemoveMaterial = (itemId: string) => {
    setMaterials(materials.filter((m) => m.inventoryItemId !== itemId && m.id !== itemId))
  }

  // Submit do formulário
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentOrganization) return

    if (!name.trim()) {
      setErrorMessage('Informe o nome do serviço.')
      setActiveTab('general')
      return
    }

    const salePrice = parseCurrencyInput(salePriceInput)
    const minimumPrice = parseCurrencyInput(minimumSalePriceInput)
    if (minimumPrice > 0 && salePrice < minimumPrice) {
      setErrorMessage(
        `O preço de venda (${formatCurrency(salePrice)}) não pode ser menor que o preço mínimo estabelecido (${formatCurrency(minimumPrice)}).`,
      )
      setActiveTab('pricing')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    const payload = {
      serviceCode: serviceCode.trim(),
      name: name.trim(),
      description: description.trim() || null,
      categoryId: categoryId || null,
      billingUnit,
      estimatedTime: estimatedTime.trim() || null,
      isActive,
      internalNotes: internalNotes.trim() || null,

      operationalCost: parseCurrencyInput(operationalCostInput).toFixed(4),
      laborCost: parseCurrencyInput(laborCostInput).toFixed(4),
      materialsCost: computedMaterialsCost.toFixed(4),
      totalCost: computedTotalCost.toFixed(4),
      salePrice: salePrice.toFixed(4),
      profitMargin: parseCurrencyInput(profitMarginInput).toFixed(2),
      minimumSalePrice: minimumPrice.toFixed(4),
      allowDiscount,
      commissionRate: parseCurrencyInput(commissionRateInput).toFixed(2),

      lc116Item: lc116Item.trim() || null,
      nfsNationalCode: nfsNationalCode.trim() || null,
      nfsMunicipalCode: nfsMunicipalCode.trim() || null,
      cnaeCode: cnaeCode.trim() || null,
      nbsCode: nbsCode.trim() || null,
      fiscalDescription: fiscalDescription.trim() || null,
      issRate: parseCurrencyInput(issRateInput).toFixed(4),
      issTaxType,
      issWithheld,
      deductionsAllowed,
      issRequirement,
      cstIbsCbs: cstIbsCbs.trim() || null,
      cClassTrib: cClassTrib.trim() || null,
      ibsRate: parseCurrencyInput(ibsRateInput).toFixed(4),
      cbsRate: parseCurrencyInput(cbsRateInput).toFixed(4),
      taxRulesNotes: taxRulesNotes.trim() || null,

      materials: materials.map((m) => ({
        inventoryItemId: m.inventoryItemId,
        quantity: m.quantity,
        unit: m.unit,
        unitCost: m.unitCost,
      })),
      creatorName: profile?.displayName || user?.email?.split('@')[0] || 'Operador',
    }

    const res = isEditing && id
      ? await serviceService.updateService(currentOrganization.id, id, payload)
      : await serviceService.createService(currentOrganization.id, payload)

    setIsSubmitting(false)

    if (res.success) {
      void navigate('/services')
    } else {
      setErrorMessage(res.error)
    }
  }

  if (isLoadingData) {
    return (
      <div className="py-24 text-center text-sm text-gray-500 dark:text-slate-400">
        Carregando dados do serviço...
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div>
        <Link
          to="/services"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Serviços
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/60 p-2.5 text-indigo-700 dark:text-indigo-400">
              <Wrench className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {isEditing ? `Editar Serviço: ${serviceCode}` : 'Cadastrar Novo Serviço'}
              </h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
                Configure precificação com margem real, materiais do estoque e dados para NFS-e.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/services">
              <Button type="button" variant="outline" size="sm">
                Cancelar
              </Button>
            </Link>
            <Button
              type="button"
              onClick={handleSubmit}
              isLoading={isSubmitting}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs"
            >
              <Save className="h-4 w-4" />
              {isEditing ? 'Salvar Alterações' : 'Concluir Cadastro'}
            </Button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/50 p-4 border border-red-200 dark:border-red-800 flex items-start gap-3 text-red-800 dark:text-red-300 text-xs">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-bold">Atenção ao salvar:</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Navegação por Abas */}
      <div className="border-b border-gray-200 dark:border-slate-800 flex gap-6 text-sm font-semibold">
        {[
          { id: 'general', label: '1. Informações Gerais', icon: Wrench },
          { id: 'pricing', label: '2. Precificação & Custos', icon: DollarSign },
          { id: 'materials', label: `3. Materiais Utilizados (${materials.length})`, icon: Package },
          { id: 'fiscal', label: '4. Dados Fiscais (NFS-e)', icon: FileText },
        ].map((tab) => {
          const active = activeTab === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 pb-3 border-b-2 transition ${
                active
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Formulário Central */}
      <form onSubmit={handleSubmit}>
        {/* ABA 1: INFORMAÇÕES GERAIS */}
        {activeTab === 'general' && (
          <Card className="rounded-2xl shadow-xs">
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Código do Serviço <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={serviceCode}
                    onChange={(e) => setServiceCode(e.target.value)}
                    placeholder="SRV-0001"
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono font-bold text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Gerado automaticamente, mas editável.</p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Nome do Serviço <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Instalação de Ar Condicionado Split, Troca de Óleo, Consultoria..."
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                      Categoria do Serviço
                    </label>
                    <button
                      type="button"
                      onClick={() => setCategoryModalOpen(true)}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" /> Nova
                    </button>
                  </div>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Selecione uma categoria (opcional)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Unidade de Cobrança <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={billingUnit}
                    onChange={(e) => setBillingUnit(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  >
                    {BILLING_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Tempo Estimado de Execução
                  </label>
                  <div className="relative">
                    <Clock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={estimatedTime}
                      onChange={(e) => setEstimatedTime(e.target.value)}
                      placeholder="Ex: 2 horas, 1 dia, 45 min..."
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-8 pr-3 py-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Descrição Detalhada do Serviço
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o escopo, etapas de execução ou especificações do serviço..."
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Observações Internas (visíveis apenas para sua equipe)
                </label>
                <textarea
                  rows={2}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Anotações para técnicos, particularidades de execução ou orientações..."
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-slate-200">
                    Situação do Serviço
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    Serviços inativos não aparecem na criação de novos orçamentos ou vendas.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                  <span className="ml-2 text-xs font-bold text-gray-700 dark:text-slate-300">
                    {isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ABA 2: PRECIFICAÇÃO */}
        {activeTab === 'pricing' && (
          <div className="space-y-4">
            <Card className="rounded-2xl shadow-xs">
              <CardContent className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Composição dos Custos do Serviço
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    O custo total soma custos operacionais, mão de obra e os materiais vinculados da Aba 3.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Custo Operacional (R$)
                    </label>
                    <input
                      type="text"
                      value={operationalCostInput}
                      onChange={(e) => setOperationalCostInput(e.target.value)}
                      placeholder="0,00"
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Deslocamento, energia, ferramental.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Custo Mão de Obra (R$)
                    </label>
                    <input
                      type="text"
                      value={laborCostInput}
                      onChange={(e) => setLaborCostInput(e.target.value)}
                      placeholder="0,00"
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Valor pago aos técnicos/operadores.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Custo Materiais (R$)
                    </label>
                    <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-gray-800 dark:text-slate-200">
                      {formatCurrency(computedMaterialsCost)}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Calculado dos itens na Aba 3.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-red-700 dark:text-red-400 mb-1">
                      Custo Total Estimado
                    </label>
                    <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/40 px-3 py-2 text-xs font-extrabold text-red-700 dark:text-red-300">
                      {formatCurrency(computedTotalCost)}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                        Preço de Venda e Margem Real
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                        A Margem de Lucro Real é calculada sobre a receita: ((Preço - Custo) / Preço) * 100.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-400 mb-1">
                        Preço de Venda Padrão (R$) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={salePriceInput}
                        onChange={(e) => handleSalePriceChange(e.target.value)}
                        placeholder="0,00"
                        className="w-full rounded-lg border-2 border-indigo-400 dark:border-indigo-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold text-indigo-800 dark:text-indigo-200 focus:border-indigo-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                        Margem de Lucro Real (%)
                      </label>
                      <input
                        type="text"
                        value={profitMarginInput}
                        onChange={(e) => handleProfitMarginChange(e.target.value)}
                        placeholder="0,00"
                        className="w-full rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold text-emerald-700 dark:text-emerald-300 focus:border-emerald-600 focus:outline-none"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Altere a margem para recalcular o preço.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Preço Mínimo de Venda (R$)
                      </label>
                      <input
                        type="text"
                        value={minimumSalePriceInput}
                        onChange={(e) => setMinimumSalePriceInput(e.target.value)}
                        placeholder="0,00"
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Limite mínimo para vendedores.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="allowDiscount"
                        checked={allowDiscount}
                        onChange={(e) => setAllowDiscount(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="allowDiscount" className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                        Permitir concessão de descontos neste serviço
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Comissão de Vendedor / Funcionário (%)
                      </label>
                      <input
                        type="text"
                        value={commissionRateInput}
                        onChange={(e) => setCommissionRateInput(e.target.value)}
                        placeholder="0,00"
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ABA 3: MATERIAIS UTILIZADOS */}
        {activeTab === 'materials' && (
          <div className="space-y-4">
            <Card className="rounded-2xl shadow-xs">
              <CardContent className="p-6 space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Vincular Materiais do Estoque ao Serviço
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Materiais vinculados são abatidos do estoque no momento da execução/conclusão da venda.
                  </p>
                </div>

                {/* Seletor de Material */}
                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-800/40 p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Selecionar Produto / Material do Estoque
                      </label>
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="">Selecione um produto cadastrado no estoque...</option>
                        {inventoryProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Saldo: {p.quantity_on_hand} {p.unit} · Custo: {formatCurrency(p.unit_price)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Quantidade Utilizada
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={materialQtyInput}
                          onChange={(e) => setMaterialQtyInput(e.target.value)}
                          placeholder="1"
                          className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                        />
                        <Button
                          type="button"
                          onClick={handleAddMaterial}
                          disabled={!selectedProductId}
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabela de Materiais */}
                {materials.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 dark:text-slate-500 border border-dashed border-gray-200 dark:border-slate-800 rounded-xl">
                    <Package className="h-8 w-8 mx-auto text-gray-300 dark:text-slate-600 mb-1.5" />
                    <p className="font-semibold text-xs text-gray-600 dark:text-slate-400">
                      Nenhum material vinculado
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                      Você pode cadastrar serviços puros (sem material) ou vincular produtos acima.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 uppercase font-semibold">
                          <tr>
                            <th className="px-3 py-2.5">Material (Estoque)</th>
                            <th className="px-3 py-2.5 text-center">Quantidade</th>
                            <th className="px-3 py-2.5 text-right">Custo Unitário</th>
                            <th className="px-3 py-2.5 text-right">Custo Total</th>
                            <th className="px-3 py-2.5 text-center">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                          {materials.map((m) => (
                            <tr key={m.inventoryItemId} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                              <td className="px-3 py-2.5">
                                <p className="font-semibold text-gray-900 dark:text-white">{m.productName}</p>
                                {m.availableStock !== undefined && (
                                  <p className="text-[10px] text-gray-400">
                                    Disponível: {m.availableStock} {m.unit}
                                  </p>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center font-medium text-gray-700 dark:text-slate-300">
                                {m.quantity} {m.unit}
                              </td>
                              <td className="px-3 py-2.5 text-right text-gray-600 dark:text-slate-400">
                                {formatCurrency(m.unitCost)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold text-gray-900 dark:text-white">
                                {formatCurrency(Number(m.quantity) * Number(m.unitCost))}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMaterial(m.inventoryItemId)}
                                  className="text-gray-400 hover:text-red-600 p-1 rounded"
                                  title="Remover material"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-3 flex justify-between items-center rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 p-3 text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                      <span>Custo Total dos Materiais:</span>
                      <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                        {formatCurrency(computedMaterialsCost)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ABA 4: DADOS FISCAIS (NFS-e) */}
        {activeTab === 'fiscal' && (
          <div className="space-y-4">
            <Card className="rounded-2xl shadow-xs">
              <CardContent className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Classificação Fiscal do Serviço (NFS-e / LC 116/2003)
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Parâmetros para preenchimento de Nota Fiscal de Serviço Eletrônica.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Item da Lista de Serviços (LC 116/2003)
                    </label>
                    <input
                      type="text"
                      value={lc116Item}
                      onChange={(e) => setLc116Item(e.target.value)}
                      placeholder="Ex: 01.01, 07.02, 14.01..."
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Código de Tributação Nacional da NFS-e
                    </label>
                    <input
                      type="text"
                      value={nfsNationalCode}
                      onChange={(e) => setNfsNationalCode(e.target.value)}
                      placeholder="Ex: 010101, 140101..."
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Código CNAE Relacionado
                    </label>
                    <input
                      type="text"
                      value={cnaeCode}
                      onChange={(e) => setCnaeCode(e.target.value)}
                      placeholder="Ex: 4321-5/00..."
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Código NBS (Nomenclatura Brasileira de Serviços)
                    </label>
                    <input
                      type="text"
                      value={nbsCode}
                      onChange={(e) => setNbsCode(e.target.value)}
                      placeholder="Ex: 1.0101.10.00..."
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Discriminação Padrão para Nota Fiscal
                  </label>
                  <textarea
                    rows={2}
                    value={fiscalDescription}
                    onChange={(e) => setFiscalDescription(e.target.value)}
                    placeholder="Texto complementar impresso no corpo da NFS-e..."
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Tributação de ISS (Imposto Sobre Serviços)
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Alíquota do ISS (%)
                      </label>
                      <input
                        type="text"
                        value={issRateInput}
                        onChange={(e) => setIssRateInput(e.target.value)}
                        placeholder="Ex: 2,00 a 5,00"
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Tipo de Tributação
                      </label>
                      <select
                        value={issTaxType}
                        onChange={(e) => setIssTaxType(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="tributavel">Tributável no Município</option>
                        <option value="isento">Isento</option>
                        <option value="imune">Imune</option>
                        <option value="suspensa">Exigibilidade Suspensa</option>
                        <option value="nao_incidente">Não Incidente</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Exigibilidade do ISS
                      </label>
                      <select
                        value={issRequirement}
                        onChange={(e) => setIssRequirement(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="exigivel">Exigível</option>
                        <option value="suspensa_judicial">Suspensa por Decisão Judicial</option>
                        <option value="suspensa_administrativa">Suspensa por Processo Adm.</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-6 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={issWithheld}
                        onChange={(e) => setIssWithheld(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      ISS Retido na Fonte pelo Tomador
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={deductionsAllowed}
                        onChange={(e) => setDeductionsAllowed(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Permite Dedução de Materiais na Base de Cálculo do ISS
                    </label>
                  </div>
                </div>

                {/* Seção Reforma Tributária 2026 */}
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/40 to-white dark:from-blue-950/30 dark:to-slate-900 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-blue-100 dark:bg-blue-900/60 p-1 text-blue-700 dark:text-blue-300">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                        Preparação para Reforma Tributária 2026 (IBS / CBS)
                      </h4>
                      <p className="text-[11px] text-blue-700 dark:text-blue-300">
                        Campos pré-configurados para conformidade com a transição do Imposto sobre Bens e Serviços.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        CST IBS/CBS
                      </label>
                      <input
                        type="text"
                        value={cstIbsCbs}
                        onChange={(e) => setCstIbsCbs(e.target.value)}
                        placeholder="Ex: 01, 20, 40..."
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Classificação Tributária (cClassTrib)
                      </label>
                      <input
                        type="text"
                        value={cClassTrib}
                        onChange={(e) => setCClassTrib(e.target.value)}
                        placeholder="Código Nacional"
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Alíquota Estimada IBS (%)
                      </label>
                      <input
                        type="text"
                        value={ibsRateInput}
                        onChange={(e) => setIbsRateInput(e.target.value)}
                        placeholder="0,00"
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Alíquota Estimada CBS (%)
                      </label>
                      <input
                        type="text"
                        value={cbsRateInput}
                        onChange={(e) => setCbsRateInput(e.target.value)}
                        placeholder="0,00"
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Barra Inferior de Ação */}
        <div className="mt-6 flex items-center justify-between border-t border-gray-200 dark:border-slate-800 pt-4">
          <Link to="/services">
            <Button type="button" variant="outline" size="sm">
              Voltar
            </Button>
          </Link>

          <Button
            type="submit"
            size="md"
            isLoading={isSubmitting}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isEditing ? 'Salvar Alterações do Serviço' : 'Salvar e Concluir Cadastro'}
          </Button>
        </div>
      </form>

      {/* Modal de Nova Categoria */}
      {currentOrganization && (
        <ServiceCategoryModal
          open={categoryModalOpen}
          organizationId={currentOrganization.id}
          onClose={() => setCategoryModalOpen(false)}
          onCategoryCreated={(newCat) => {
            setCategories([...categories, newCat])
            setCategoryId(newCat.id)
          }}
        />
      )}
    </div>
  )
}
