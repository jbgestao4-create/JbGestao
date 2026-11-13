import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { customerService, type Customer } from '@modules/customers/services/customer.service'
import { inventoryService } from '@modules/inventory/services/inventory.service'
import { serviceService, type ServiceListItem } from '@modules/services/services/service.service'
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
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  Laptop,
  Package,
  Plus,
  Save,
  Search,
  Trash2,
  User,
  Wrench,
  X,
} from 'lucide-react'
import { appointmentService } from '@modules/agendapro/services/appointment.service'
import { ForwardToScheduleCard } from '@modules/agendapro/components/ForwardToScheduleCard'
import {
  DEFAULT_DAMAGE_CHECKLIST_OPTIONS,
  NO_DAMAGE_IDENTIFIED_OPTION,
  SERVICE_ORDER_PRIORITY_LABELS,
  SERVICE_ORDER_STATUS_BADGE_CLASSES,
  SERVICE_ORDER_STATUS_LABELS,
  type ServiceOrderItem,
  type ServiceOrderPhoto,
  type ServiceOrderPriority,
  type ServiceOrderStatus,
} from '../domain/service-order'
import { serviceOrderService } from '../services/service-order.service'

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const maxDim = 1024
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(reader.result as string)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => reject(new Error('Falha ao processar imagem'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem'))
    reader.readAsDataURL(file)
  })
}

export function ServiceOrderFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { currentOrganization } = useOrganization()

  const operatorName = profile?.displayName || user?.email?.split('@')[0] || 'Técnico'

  // Catálogos auxiliares
  const [customers, setCustomers] = useState<Customer[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [availableServices, setAvailableServices] = useState<ServiceListItem[]>([])
  const [equipmentCatalog, setEquipmentCatalog] = useState<string[]>([])
  const [showEquipmentModal, setShowEquipmentModal] = useState(false)
  const [newEquipmentInput, setNewEquipmentInput] = useState('')
  const [equipmentModalError, setEquipmentModalError] = useState<string | null>(null)

  // Dados principais da O.S.
  const [orderNumber, setOrderNumber] = useState('')
  const [status, setStatus] = useState<ServiceOrderStatus>('queue')
  const [initialStatus, setInitialStatus] = useState<ServiceOrderStatus>('queue')
  const [priority, setPriority] = useState<ServiceOrderPriority>('normal')

  // Cliente
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerDocument, setCustomerDocument] = useState('')
  const customerDropdownRef = useRef<HTMLDivElement>(null)

  // Equipamento e Avarias
  const [equipmentName, setEquipmentName] = useState('')
  const [equipmentBrand, setEquipmentBrand] = useState('')
  const [equipmentModel, setEquipmentModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [equipmentColor, setEquipmentColor] = useState('')
  const [accessories, setAccessories] = useState('')
  const [devicePassword, setDevicePassword] = useState('')
  const [damageChecklist, setDamageChecklist] = useState<string[]>([])
  const [damageNotes, setDamageNotes] = useState('')
  const [photos, setPhotos] = useState<ServiceOrderPhoto[]>([])
  const [previewPhoto, setPreviewPhoto] = useState<ServiceOrderPhoto | null>(null)
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Problema, Diagnóstico, Pendência e Solução
  const [reportedProblem, setReportedProblem] = useState('')
  const [pendingReason, setPendingReason] = useState('')
  const [technicalDiagnosis, setTechnicalDiagnosis] = useState('')
  const [solutionApplied, setSolutionApplied] = useState('')
  const [technicianName, setTechnicianName] = useState(operatorName)
  const [showPendingModal, setShowPendingModal] = useState(false)
  const [pendingModalInput, setPendingModalInput] = useState('')
  const [pendingModalError, setPendingModalError] = useState<string | null>(null)
  const [saveAfterPendingConfirm, setSaveAfterPendingConfirm] = useState(false)

  // Agendamento / Encaminhar para agenda
  const [forwardToSchedule, setForwardToSchedule] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [scheduleAssignedTo, setScheduleAssignedTo] = useState(operatorName)
  const [scheduleNotes, setScheduleNotes] = useState('')
  const FIXED_WARRANTY_TERMS =
    'Garantia legal referente exclusivamente aos serviços executados e peças substituídas descritas nesta Ordem de Serviço.'

  // Mantém o Técnico Responsável sincronizado com o usuário logado no momento
  useEffect(() => {
    setTechnicianName(operatorName)
  }, [operatorName])

  // Fecha a lista de sugestões de clientes ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCustomerSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Produtos e Serviços na O.S.
  const [items, setItems] = useState<ServiceOrderItem[]>([])
  const [discount, setDiscount] = useState('0.00')
  const [itemTypeToAdd, setItemTypeToAdd] = useState<'service' | 'product'>('service')
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null)
  const [selectedService, setSelectedService] = useState<ServiceListItem | null>(null)
  const [itemQuantity, setItemQuantity] = useState('1')
  const [itemUnitPrice, setItemUnitPrice] = useState('')
  const [itemUnit, setItemUnit] = useState('UN')

  // Controle de carregamento e salvamento
  const [isLoading, setIsLoading] = useState(isEditing)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Carrega clientes, estoque, serviços, catálogo de equipamentos e número sequencial / dados da O.S.
  useEffect(() => {
    if (!currentOrganization) return
    let active = true

    void Promise.all([
      serviceOrderService.listEquipmentCatalog(currentOrganization.id),
      customerService.list(currentOrganization.id),
      inventoryService.list(currentOrganization.id),
      serviceService.listServices(currentOrganization.id, { status: 'active', pageSize: 200 }),
      !isEditing
        ? serviceOrderService.getNextOrderNumber(currentOrganization.id)
        : Promise.resolve(''),
    ]).then(([equipmentRes, custRes, invRes, svcRes, nextNum]) => {
      if (!active) return
      if (equipmentRes.success) {
        setEquipmentCatalog(equipmentRes.data)
      } else {
        setError(equipmentRes.error)
      }
      if (custRes.success) setCustomers(custRes.data)
      if (invRes.success) {
        setInventoryItems(invRes.data.filter((i) => i.isActive))
      }
      if (svcRes.success) {
        setAvailableServices(svcRes.data.items)
      }
      if (!isEditing && nextNum) {
        setOrderNumber(nextNum)
      }
    })

    return () => {
      active = false
    }
  }, [currentOrganization, isEditing])

  useEffect(() => {
    if (!currentOrganization || !id) return
    let active = true
    setIsLoading(true)

    void serviceOrderService.getById(currentOrganization.id, id).then((res) => {
      if (!active) return
      setIsLoading(false)
      if (res.success) {
        const d = res.data
        const effectiveStatus: ServiceOrderStatus = d.status
        setOrderNumber(d.orderNumber)
        setStatus(effectiveStatus)
        setInitialStatus(effectiveStatus)
        setPriority(d.priority)
        setSelectedCustomerId(d.customerId || '')
        setCustomerName(d.customerName)
        setCustomerPhone(d.customerPhone || '')
        setCustomerDocument(d.customerDocument || '')
        setEquipmentName(d.equipmentName)
        setEquipmentBrand(d.equipmentBrand || '')
        setEquipmentModel(d.equipmentModel || '')
        setSerialNumber(d.serialNumber || '')
        setEquipmentColor(d.equipmentColor || '')
        setAccessories(d.accessories || '')
        setDevicePassword(d.devicePassword || '')
        setDamageChecklist(d.damageChecklist)
        setDamageNotes(d.damageNotes || '')
        setPhotos(d.photos)
        setReportedProblem(d.reportedProblem)
        setPendingReason(d.pendingReason || d.internalNotes || '')
        setTechnicalDiagnosis(d.technicalDiagnosis || '')
        setSolutionApplied(d.solutionApplied || '')
        setTechnicianName(operatorName)
        setItems(d.items)
        setDiscount(d.discount || '0.00')

        if (id) {
          void appointmentService
            .getByReference(currentOrganization.id, 'service_order', id)
            .then((apptRes) => {
              if (apptRes.success && apptRes.data) {
                setForwardToSchedule(true)
                setScheduleDate(apptRes.data.appointmentDate)
                setScheduleTime(apptRes.data.startTime || '09:00')
                setScheduleAssignedTo(apptRes.data.assignedTo || operatorName)
                setScheduleNotes(apptRes.data.notes || apptRes.data.description || '')
              }
            })
        }
      } else {
        setError(res.error)
      }
    })

    return () => {
      active = false
    }
  }, [currentOrganization, id, operatorName])

  // Filtro de clientes diretamente pelo campo Nome do Cliente enquanto digita
  const filteredCustomers = useMemo(() => {
    const q = customerName.trim().toLocaleLowerCase('pt-BR')
    if (!q || !showCustomerSuggestions) return []
    return customers
      .filter(
        (c) =>
          c.name.toLocaleLowerCase('pt-BR').includes(q) ||
          (c.document && c.document.toLocaleLowerCase('pt-BR').includes(q)) ||
          (c.phone && c.phone.toLocaleLowerCase('pt-BR').includes(q)),
      )
      .slice(0, 8)
  }, [customers, customerName, showCustomerSuggestions])

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomerId(c.id)
    setCustomerName(c.name)
    setCustomerPhone(c.phone || '')
    setCustomerDocument(c.document || '')
    setShowCustomerSuggestions(false)
  }

  const equipmentOptions = useMemo(() => {
    const list = [...equipmentCatalog]
    const currentTrimmed = equipmentName.trim()
    if (
      currentTrimmed &&
      !list.some((item) => item.toLocaleLowerCase('pt-BR') === currentTrimmed.toLocaleLowerCase('pt-BR'))
    ) {
      list.unshift(currentTrimmed)
    }
    return list.map((item) => ({
      value: item,
      label: item,
    }))
  }, [equipmentCatalog, equipmentName])

  const handleAddEquipmentItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrganization) return
    const clean = newEquipmentInput.trim()
    if (!clean) {
      setEquipmentModalError('Informe o nome do equipamento / aparelho para cadastrar.')
      return
    }
    const res = await serviceOrderService.addEquipmentToCatalog(currentOrganization.id, clean)
    if (!res.success) {
      setEquipmentModalError(res.error)
      return
    }
    setEquipmentCatalog(res.data)
    const matched =
      res.data.find((item) => item.toLocaleLowerCase('pt-BR') === clean.toLocaleLowerCase('pt-BR')) ||
      clean
    setEquipmentName(matched)
    setNewEquipmentInput('')
    setEquipmentModalError(null)
    setShowEquipmentModal(false)
  }

  const handleRemoveEquipmentItem = async (itemToRemove: string) => {
    if (!currentOrganization) return
    const result = await serviceOrderService.removeEquipmentFromCatalog(
      currentOrganization.id,
      itemToRemove,
    )
    if (!result.success) {
      setEquipmentModalError(result.error)
      return
    }
    setEquipmentCatalog(result.data)
    if (equipmentName.toLocaleLowerCase('pt-BR') === itemToRemove.toLocaleLowerCase('pt-BR')) {
      setEquipmentName('')
    }
  }

  const hasNoDamage =
    damageChecklist.includes(NO_DAMAGE_IDENTIFIED_OPTION) ||
    damageChecklist.includes('Sem avarias externas aparentes')

  const handleToggleNoDamage = () => {
    if (hasNoDamage) {
      setDamageChecklist((prev) =>
        prev.filter(
          (item) =>
            item !== NO_DAMAGE_IDENTIFIED_OPTION && item !== 'Sem avarias externas aparentes',
        ),
      )
    } else {
      setDamageChecklist([NO_DAMAGE_IDENTIFIED_OPTION])
      setDamageNotes('')
    }
  }

  // Checklist de avarias
  const handleToggleDamageItem = (option: string) => {
    if (hasNoDamage) return
    setDamageChecklist((prev) =>
      prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option],
    )
  }

  // Upload de fotos do equipamento / avarias
  const processPhotoFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (fileArray.length === 0) return

    const newPhotos: ServiceOrderPhoto[] = []
    for (const file of fileArray) {
      try {
        const dataUrl = await compressImageFile(file)
        newPhotos.push({
          id: crypto.randomUUID(),
          dataUrl,
          caption: file.name.replace(/\.[^/.]+$/, ''),
          createdAt: new Date().toISOString(),
        })
      } catch {
        setError(`Não foi possível processar a imagem "${file.name}".`)
      }
    }

    setPhotos((prev) => [...prev, ...newPhotos])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUploadPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    await processPhotoFiles(files)
  }

  const handleUpdatePhotoCaption = (photoId: string, caption: string) => {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, caption } : p)))
  }

  const handleRemovePhoto = (photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
  }

  // Seleção de Produtos (Estoque) e Serviços (Módulo Serviços) para adicionar na O.S.
  const handleChooseProductById = (productId: string) => {
    const prod = inventoryItems.find((i) => i.id === productId) || null
    setSelectedProduct(prod)
    setSelectedService(null)
    if (prod) {
      setItemUnit(prod.unit || 'UN')
      setItemUnitPrice(Number(prod.unitPrice || 0).toFixed(2))
    } else {
      setItemUnit('UN')
      setItemUnitPrice('')
    }
  }

  const handleChooseServiceById = (serviceId: string) => {
    const srv = availableServices.find((s) => s.id === serviceId) || null
    setSelectedService(srv)
    setSelectedProduct(null)
    if (srv) {
      setItemUnit(srv.billingUnit || 'UN')
      setItemUnitPrice(Number(srv.salePrice || 0).toFixed(2))
    } else {
      setItemUnit('UN')
      setItemUnitPrice('')
    }
  }

  const handleAddItem = () => {
    if (itemTypeToAdd === 'product' && !selectedProduct) {
      setError('Selecione um produto / peça cadastrado no módulo de Estoque.')
      return
    }
    if (itemTypeToAdd === 'service' && !selectedService) {
      setError('Selecione um serviço cadastrado no módulo de Serviços.')
      return
    }

    const desc =
      itemTypeToAdd === 'product' ? selectedProduct!.name : selectedService!.name

    const qty = Number(itemQuantity.replace(',', '.'))
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Informe uma quantidade válida maior que zero.')
      return
    }

    const price = Number(itemUnitPrice.replace(',', '.'))
    if (!Number.isFinite(price) || price < 0) {
      setError('Informe um valor unitário válido.')
      return
    }

    const cleanQty = String(qty)
    const cleanPrice = price.toFixed(2)
    const total = calculateItemTotal(cleanQty, cleanPrice)

    const newItem: ServiceOrderItem = {
      id: crypto.randomUUID(),
      itemType: itemTypeToAdd,
      inventoryItemId: itemTypeToAdd === 'product' ? selectedProduct?.id ?? null : null,
      serviceId: itemTypeToAdd === 'service' ? selectedService?.id ?? null : null,
      description: desc,
      unit: itemUnit || 'UN',
      quantity: cleanQty,
      unitPrice: cleanPrice,
      total,
    }

    setItems((prev) => [...prev, newItem])
    setSelectedProduct(null)
    setSelectedService(null)
    setItemQuantity('1')
    setItemUnitPrice('')
    setItemUnit('UN')
    setError(null)
  }

  const handleUpdateItem = (itemId: string, field: 'quantity' | 'unitPrice', value: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it
        const nextQty = field === 'quantity' ? value : it.quantity
        const nextPrice = field === 'unitPrice' ? value : it.unitPrice
        const numQty = Number(nextQty.replace(',', '.'))
        const numPrice = Number(nextPrice.replace(',', '.'))
        const safeTotal =
          Number.isFinite(numQty) && numQty > 0 && Number.isFinite(numPrice) && numPrice >= 0
            ? calculateItemTotal(String(numQty), String(numPrice))
            : it.total
        return {
          ...it,
          [field]: value,
          total: safeTotal,
        }
      }),
    )
  }

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId))
  }

  // Totais calculados
  const productsSubtotal = useMemo(
    () =>
      calculateSubtotal(
        items.filter((i) => i.itemType === 'product').map((i) => i.total),
      ),
    [items],
  )
  const servicesSubtotal = useMemo(
    () =>
      calculateSubtotal(
        items.filter((i) => i.itemType === 'service').map((i) => i.total),
      ),
    [items],
  )
  const subtotal = useMemo(() => calculateSubtotal(items.map((i) => i.total)), [items])
  const grandTotal = useMemo(
    () => calculateTotal(subtotal, discount.replace(',', '.') || '0.00'),
    [subtotal, discount],
  )

  const handleSave = async (options?: {
    overrideStatus?: ServiceOrderStatus
    overridePendingReason?: string
  }) => {
    if (!currentOrganization) return
    setError(null)

    if (!customerName.trim()) {
      setError('Informe o nome do cliente da Ordem de Serviço.')
      return
    }
    if (!equipmentName.trim()) {
      setError('Informe o equipamento / aparelho recebido na Ordem de Serviço.')
      return
    }
    if (!reportedProblem.trim()) {
      setError('Descreva o problema / defeito relatado pelo cliente.')
      return
    }
    if (forwardToSchedule && !scheduleDate) {
      setError('Informe o dia do agendamento para atribuição.')
      return
    }

    const nextStatus: ServiceOrderStatus = !isEditing
      ? 'queue'
      : (options?.overrideStatus ?? initialStatus)
    const effectivePendingReason = (options?.overridePendingReason ?? pendingReason).trim()

    // Regra: Não permite concluir para Pronto sem Solução
    if (nextStatus === 'ready' && !solutionApplied.trim()) {
      setError('Para fechar a O.S. e marcar como Pronto, é necessário adicionar a solução do problema.')
      return
    }

    // Regra: Uma O.S. pendente só pode voltar para Manutenção
    if (isEditing && initialStatus === 'pending' && (nextStatus === 'ready' || nextStatus === 'closed')) {
      setError('Uma Ordem de Serviço pendente deve voltar para Manutenção antes de ser concluída.')
      return
    }

    if (nextStatus === 'pending' && !effectivePendingReason) {
      handleRequestPending(Boolean(options?.overrideStatus === 'pending'))
      return
    }

    setStatus(nextStatus)
    setIsSaving(true)

    const payload = {
      orderNumber,
      status: nextStatus,
      priority,
      customerId: selectedCustomerId || null,
      customerName,
      customerPhone,
      customerDocument,
      equipmentName,
      equipmentBrand,
      equipmentModel,
      serialNumber,
      equipmentColor,
      accessories,
      devicePassword,
      damageChecklist,
      damageNotes,
      photos,
      reportedProblem,
      technicalDiagnosis,
      solutionApplied,
      technicianName: operatorName,
      estimatedDeliveryDate: null,
      warrantyDays: 0,
      warrantyTerms: FIXED_WARRANTY_TERMS,
      internalNotes: effectivePendingReason || null,
      pendingReason: effectivePendingReason || null,
      discount: discount.replace(',', '.') || '0.00',
      items,
      createdBy: user?.id || null,
      creatorName: operatorName,
    }

    const res =
      isEditing && id
        ? await serviceOrderService.update(currentOrganization.id, id, payload)
        : await serviceOrderService.create(currentOrganization.id, payload)

    setIsSaving(false)

    if (res.success) {
      const osId = id || res.data.id
      const osNumber = isEditing ? orderNumber : res.data.orderNumber
      if (osId) {
        await appointmentService.syncFromEntity(currentOrganization.id, {
          referenceType: 'service_order',
          referenceId: osId,
          forwardToSchedule,
          appointmentDate: scheduleDate,
          startTime: scheduleTime,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || undefined,
          customerId: selectedCustomerId || undefined,
          title: `O.S. #${osNumber || osId.slice(0, 8)} - ${equipmentName.trim()}`,
          description: scheduleNotes || reportedProblem.trim() || 'Atendimento / Diagnóstico da O.S.',
          assignedTo: scheduleAssignedTo || operatorName,
          operatorName,
          userId: user?.id,
        })
      }

      if (!isEditing) {
        void navigate('/service-orders?status=queue')
      } else if (nextStatus === 'ready' && initialStatus !== 'ready') {
        void navigate(`/service-orders?status=ready&notifyReady=${res.data.id}`)
      } else {
        void navigate(`/service-orders?status=${nextStatus}`)
      }
    } else {
      setError(res.error)
    }
  }

  const handleRequestPending = (shouldSaveAfter = false) => {
    setPendingModalInput(pendingReason)
    setPendingModalError(null)
    setSaveAfterPendingConfirm(shouldSaveAfter)
    setShowPendingModal(true)
  }

  const handleConfirmPendingModal = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = pendingModalInput.trim()
    if (!trimmed) {
      setPendingModalError('Informe o motivo da pendência para encaminhar a O.S.')
      return
    }
    setPendingReason(trimmed)
    setStatus('pending')
    setShowPendingModal(false)
    if (saveAfterPendingConfirm) {
      void handleSave({ overrideStatus: 'pending', overridePendingReason: trimmed })
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Carregando dados da Ordem de Serviço...
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Topo e Status da O.S. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link
            to={isEditing ? `/service-orders?status=${initialStatus}` : '/service-orders'}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Ordens de Serviço
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {isEditing ? `Editar O.S. ${orderNumber}` : `Nova Ordem de Serviço (${orderNumber || 'O.S.'})`}
            </h1>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${SERVICE_ORDER_STATUS_BADGE_CLASSES[status]}`}
            >
              {SERVICE_ORDER_STATUS_LABELS[status]}
            </span>

            {/* Ações de Mudar Status no topo da O.S. */}
            {isEditing && (
              <div className="flex items-center gap-2">
                {initialStatus === 'pending' && (
                  <Button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void handleSave({ overrideStatus: 'in_maintenance' })}
                    className="gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-3"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    <span>Voltar para Manutenção</span>
                  </Button>
                )}

                {initialStatus === 'in_maintenance' && (
                  <>
                    <Button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void handleSave({ overrideStatus: 'ready' })}
                      className="gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Marcar como Pronto</span>
                    </Button>
                    <Button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleRequestPending(true)}
                      variant="outline"
                      className="gap-1.5 rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 text-xs font-bold py-1.5 px-3"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>Pendente</span>
                    </Button>
                  </>
                )}

                {initialStatus === 'queue' && (
                  <Button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void handleSave({ overrideStatus: 'in_maintenance' })}
                    className="gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-3"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    <span>Iniciar Manutenção</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-200 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. CLIENTE E DADOS DO ATENDIMENTO */}
      <Card>
        <CardHeader className="border-b border-gray-100 dark:border-slate-800 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                1. Cliente e Dados do Atendimento
              </h2>
            </div>
            {selectedCustomerId && (
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                Cliente cadastrado selecionado
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId('')
                    setCustomerName('')
                    setCustomerPhone('')
                    setCustomerDocument('')
                  }}
                  className="text-blue-500 hover:text-blue-800 dark:hover:text-white underline cursor-pointer"
                >
                  Limpar
                </button>
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          {/* Linha 1: Dados do Cliente */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
              Dados do Cliente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* Nome do Cliente com busca automática enquanto digita */}
              <div className="md:col-span-6 relative" ref={customerDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  Nome do Cliente *
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 left-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onFocus={() => {
                      if (customerName.trim().length > 0 && !selectedCustomerId) {
                        setShowCustomerSuggestions(true)
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value
                      setCustomerName(val)
                      if (selectedCustomerId) {
                        setSelectedCustomerId('')
                        setCustomerPhone('')
                        setCustomerDocument('')
                      }
                      setShowCustomerSuggestions(val.trim().length > 0)
                    }}
                    placeholder="Digite o nome do cliente para buscar ou cadastrar..."
                    className="flex h-10 w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-8 py-2 text-sm text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  />
                  {customerName && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId('')
                        setCustomerName('')
                        setCustomerPhone('')
                        setCustomerDocument('')
                        setShowCustomerSuggestions(false)
                      }}
                      title="Limpar cliente"
                      className="absolute top-1/2 -translate-y-1/2 right-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {showCustomerSuggestions && filteredCustomers.length > 0 && (
                  <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg divide-y divide-gray-100 dark:divide-slate-800">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCustomer(c)}
                        className="w-full px-4 py-2.5 text-left text-xs hover:bg-blue-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 dark:text-white truncate">
                            {c.name}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-slate-400">
                            {c.document ? `CPF/CNPJ: ${c.document}` : 'Sem CPF/CNPJ'}
                          </p>
                        </div>
                        {c.phone && (
                          <span className="shrink-0 rounded-md bg-gray-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-gray-600 dark:text-slate-300">
                            {c.phone}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* CPF / CNPJ (fica off quando cliente cadastrado é selecionado) */}
              <div className="md:col-span-3">
                <Input
                  label="CPF / CNPJ"
                  value={customerDocument}
                  onChange={(e) => setCustomerDocument(e.target.value)}
                  placeholder="000.000.000-00"
                  disabled={Boolean(selectedCustomerId)}
                  className={
                    selectedCustomerId
                      ? 'bg-gray-100 dark:bg-slate-900 text-gray-500 dark:text-slate-400'
                      : ''
                  }
                />
              </div>

              {/* Telefone / WhatsApp (fica off quando cliente cadastrado é selecionado) */}
              <div className="md:col-span-3">
                <Input
                  label="Telefone / WhatsApp"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  disabled={Boolean(selectedCustomerId)}
                  className={
                    selectedCustomerId
                      ? 'bg-gray-100 dark:bg-slate-900 text-gray-500 dark:text-slate-400'
                      : ''
                  }
                />
              </div>
            </div>
          </div>

          {/* Linha 2: Dados do Atendimento */}
          <div className="border-t border-gray-100 dark:border-slate-800 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
              Dados do Atendimento
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* Número da O.S. */}
              <div className="md:col-span-4">
                <Input
                  label="Número da O.S."
                  value={orderNumber || 'Gerado automaticamente'}
                  disabled
                  className="bg-gray-100 dark:bg-slate-900 font-semibold text-gray-600 dark:text-slate-300"
                />
              </div>

              {/* Técnico Responsável (usuário logado no momento) */}
              <div className="md:col-span-4">
                <Input
                  label="Técnico Responsável (Usuário Logado)"
                  value={technicianName}
                  disabled
                  className="bg-gray-100 dark:bg-slate-900 font-semibold text-gray-700 dark:text-slate-200"
                />
              </div>

              {/* Prioridade da O.S. */}
              <div className="md:col-span-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  Prioridade da O.S.
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ServiceOrderPriority)}
                  className="h-10 w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {(Object.keys(SERVICE_ORDER_PRIORITY_LABELS) as ServiceOrderPriority[]).map(
                    (p) => (
                      <option key={p} value={p}>
                        {SERVICE_ORDER_PRIORITY_LABELS[p]}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. EQUIPAMENTO, AVARIAS E FOTOS */}
      <Card>
        <CardHeader className="border-b border-gray-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Laptop className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              2. Equipamento, Vistoria de Avarias e Fotos
            </h2>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ListBox
              label="Equipamento / Aparelho *"
              placeholder="Selecione o equipamento..."
              searchPlaceholder="Buscar equipamento / aparelho..."
              searchable
              value={equipmentName}
              onChange={(val) => setEquipmentName(val as string)}
              options={equipmentOptions}
              actionButton={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNewEquipmentInput('')
                    setEquipmentModalError(null)
                    setShowEquipmentModal(true)
                  }}
                  title="Adicionar novo Equipamento / Aparelho"
                  className="h-10 w-10 shrink-0 p-0 rounded-lg border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              }
            />
            <Input
              label="Marca"
              value={equipmentBrand}
              onChange={(e) => setEquipmentBrand(e.target.value)}
              placeholder="Ex.: Dell, Samsung, Apple, Brastemp..."
            />
            <Input
              label="Modelo"
              value={equipmentModel}
              onChange={(e) => setEquipmentModel(e.target.value)}
              placeholder="Ex.: Inspiron 15, Galaxy S23..."
            />
            <Input
              label="Nº de Série / IMEI / Placa"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="Identificação única do equipamento"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Cor / Característica Visual"
              value={equipmentColor}
              onChange={(e) => setEquipmentColor(e.target.value)}
              placeholder="Ex.: Preto, Prata, Grafite..."
            />
            <Input
              label="Acessórios Entregues Junto"
              value={accessories}
              onChange={(e) => setAccessories(e.target.value)}
              placeholder="Ex.: Carregador original, capa, bolsa, cabo..."
            />
            <Input
              label="Senha / Padrão de Desbloqueio (se houver)"
              value={devicePassword}
              onChange={(e) => setDevicePassword(e.target.value)}
              placeholder="Ex.: PIN 1234, Senha do Windows..."
              helperText="Uso estrito para testes técnicos sob responsabilidade e sigilo da assistência (LGPD)."
            />
          </div>

          <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 p-3 text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
            <strong>Termo de Consentimento e Sigilo (MOD-10 / LGPD):</strong> Ao registrar a senha de desbloqueio do equipamento (<code>device_password</code>) e fotos de vistoria, certifique-se de colher a autorização do cliente na via impressa ou digital da O.S. para realização dos testes técnicos. A guarda física do aparelho e o sigilo das credenciais informadas competem exclusivamente à equipe da empresa contratante, eximindo a fornecedora do software de responsabilidade sobre o manuseio do dispositivo.
          </div>

          {/* Checklist de Avarias */}
          <div className="rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-amber-900 dark:text-amber-300">
                  Checklist de Vistoria e Avarias na Entrada
                </h3>
              </div>

              <button
                type="button"
                onClick={handleToggleNoDamage}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold border transition-all cursor-pointer ${
                  hasNoDamage
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {hasNoDamage ? '✓ Sem Avarias identificadas' : 'Sem Avarias identificadas'}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {DEFAULT_DAMAGE_CHECKLIST_OPTIONS.map((option) => {
                const active = damageChecklist.includes(option)
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={hasNoDamage}
                    onClick={() => handleToggleDamageItem(option)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${
                      hasNoDamage
                        ? 'bg-gray-100 dark:bg-slate-800/50 text-gray-400 dark:text-slate-600 border-gray-200 dark:border-slate-800 cursor-not-allowed opacity-50'
                        : active
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs cursor-pointer'
                          : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-amber-400 cursor-pointer'
                    }`}
                  >
                    {active ? `✓ ${option}` : option}
                  </button>
                )
              })}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Descrição Detalhada das Avarias / Estado Físico do Equipamento
              </label>
              <textarea
                rows={2}
                disabled={hasNoDamage}
                value={damageNotes}
                onChange={(e) => setDamageNotes(e.target.value)}
                placeholder={
                  hasNoDamage
                    ? 'Desativado: marcado como "Sem Avarias identificadas".'
                    : 'Descreva riscos específicos, partes quebradas, trincos, estado de conservação ao receber o equipamento...'
                }
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs text-gray-800 dark:text-slate-100 focus:border-amber-500 focus:outline-hidden disabled:bg-gray-100 dark:disabled:bg-slate-800/60 disabled:text-gray-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Fotos do Equipamento e Avarias */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsDraggingPhotos(true)
            }}
            onDragEnter={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsDraggingPhotos(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsDraggingPhotos(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsDraggingPhotos(false)
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                void processPhotoFiles(e.dataTransfer.files)
              }
            }}
            className={`rounded-xl border p-4 space-y-3 transition-colors ${
              isDraggingPhotos
                ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30'
                : 'border-gray-200 dark:border-slate-800'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-blue-600" />
                  Fotos do Equipamento e Avarias ({photos.length})
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  Arraste uma ou mais fotos para cá ou clique para selecionar várias de uma só vez
                </p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => void handleUploadPhotos(e)}
                  className="hidden"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5 rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
                >
                  <Camera className="h-4 w-4" />
                  Adicionar Fotos do Equipamento
                </Button>
              </div>
            </div>

            {photos.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed py-8 text-center transition-colors ${
                  isDraggingPhotos
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                    : 'border-gray-200 dark:border-slate-800 hover:border-blue-400'
                }`}
              >
                <Camera className="h-7 w-7 mx-auto text-gray-400 mb-1.5" />
                <p className="text-xs font-medium text-gray-600 dark:text-slate-400">
                  Clique aqui para selecionar ou arraste uma ou mais fotos do equipamento e avarias
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 p-2 flex flex-col gap-1.5"
                    >
                      <div className="relative h-28 w-full overflow-hidden rounded-lg bg-black/5">
                        <img
                          src={photo.dataUrl}
                          alt={photo.caption || 'Foto do equipamento'}
                          onClick={() => setPreviewPhoto(photo)}
                          className="h-full w-full object-cover cursor-pointer hover:scale-105 transition-transform"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(photo.id)}
                          title="Remover foto"
                          className="absolute top-1.5 right-1.5 rounded-full bg-red-600/90 p-1 text-white hover:bg-red-700 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={photo.caption || ''}
                        onChange={(e) => handleUpdatePhotoCaption(photo.id, e.target.value)}
                        placeholder="Legenda (ex: Tela trincada)"
                        className="w-full rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] text-gray-700 dark:text-slate-200 focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>
                  ))}
                </div>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-xl border-2 border-dashed py-3 text-center transition-colors ${
                    isDraggingPhotos
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                      : 'border-gray-200 dark:border-slate-800 hover:border-blue-400'
                  }`}
                >
                  <p className="text-xs font-medium text-gray-600 dark:text-slate-400">
                    + Clique ou arraste mais fotos para adicionar
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. PROBLEMA, DIAGNÓSTICO E SOLUÇÃO */}
      <Card>
        <CardHeader className="border-b border-gray-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-rose-600" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              3. Problema Relatado, Diagnóstico e Solução
            </h2>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-bold text-rose-700 dark:text-rose-400 uppercase mb-1.5">
                Problema / Defeito Relatado pelo Cliente *
              </label>
              <textarea
                rows={6}
                required
                value={reportedProblem}
                onChange={(e) => setReportedProblem(e.target.value)}
                placeholder="Descreva o problema informado pelo cliente ao deixar o equipamento..."
                className="w-full min-h-[150px] rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-base font-medium leading-relaxed text-gray-900 dark:text-slate-100 focus:border-rose-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-blue-700 dark:text-blue-400 uppercase mb-1.5">
                Diagnóstico / Laudo Técnico
              </label>
              <textarea
                rows={6}
                value={technicalDiagnosis}
                onChange={(e) => setTechnicalDiagnosis(e.target.value)}
                placeholder="Resultado dos testes técnicos, causa identificada do defeito..."
                className="w-full min-h-[150px] rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-base font-medium leading-relaxed text-gray-900 dark:text-slate-100 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-1.5">
                Solução Aplicada / Serviço Realizado
              </label>
              <textarea
                rows={6}
                value={solutionApplied}
                onChange={(e) => setSolutionApplied(e.target.value)}
                placeholder="Descreva o reparo realizado, peças trocadas e solução final..."
                className="w-full min-h-[150px] rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-base font-medium leading-relaxed text-gray-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {status === 'pending' && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/40 p-4">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="flex items-center gap-1.5 text-sm font-bold text-amber-800 dark:text-amber-300 uppercase">
                  <Clock className="h-4 w-4" />
                  Informações da Pendência (Motivo de estar Pendente) *
                </label>
                <button
                  type="button"
                  onClick={() => handleRequestPending(false)}
                  className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                >
                  Editar motivo em janela
                </button>
              </div>
              <textarea
                rows={3}
                value={pendingReason}
                onChange={(e) => setPendingReason(e.target.value)}
                placeholder="Descreva o motivo da pendência (ex.: aguardando chegada de peça, aguardando aprovação do cliente...)"
                className="w-full rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 p-4 text-base font-medium leading-relaxed text-gray-900 dark:text-slate-100 focus:border-amber-500 focus:outline-hidden"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. ADICIONAR PRODUTOS (PEÇAS) E SERVIÇOS NA O.S. */}
      {isEditing && (
      <Card>
        <CardHeader className="border-b border-gray-100 dark:border-slate-800 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                4. Produtos (Peças) e Serviços da O.S.
              </h2>
            </div>

            <div className="inline-flex rounded-xl border border-gray-200 dark:border-slate-700 p-1 bg-gray-50 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setItemTypeToAdd('service')
                  setSelectedProduct(null)
                  setSelectedService(null)
                  setItemUnitPrice('')
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  itemTypeToAdd === 'service'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-gray-600 dark:text-slate-300 hover:bg-white/60'
                }`}
              >
                <Wrench className="h-3.5 w-3.5" />
                + Adicionar Serviço
              </button>
              <button
                type="button"
                onClick={() => {
                  setItemTypeToAdd('product')
                  setSelectedService(null)
                  setSelectedProduct(null)
                  setItemUnitPrice('')
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  itemTypeToAdd === 'product'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-gray-600 dark:text-slate-300 hover:bg-white/60'
                }`}
              >
                <Package className="h-3.5 w-3.5" />
                + Adicionar Produto / Peça
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {/* Barra de Inserção de Produto (Estoque) ou Serviço (Serviços) */}
          <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/40 p-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-6">
                {itemTypeToAdd === 'service' ? (
                  <ListBox
                    label="Selecionar Serviço Cadastrado (Módulo Serviços)"
                    placeholder="Selecione um serviço cadastrado..."
                    searchPlaceholder="Buscar serviço por nome ou código..."
                    searchable
                    value={selectedService?.id || ''}
                    onChange={(val) => handleChooseServiceById(val as string)}
                    options={availableServices.map((s) => ({
                      value: s.id,
                      label: s.name,
                      description: `Cód. ${s.serviceCode} · ${s.categoryName || 'Geral'} · Preço: ${formatCurrency(s.salePrice)} / ${s.billingUnit}`,
                    }))}
                  />
                ) : (
                  <ListBox
                    label="Selecionar Produto / Peça Cadastrado (Módulo Estoque)"
                    placeholder="Selecione um produto / peça do estoque..."
                    searchPlaceholder="Buscar produto por nome ou código SKU..."
                    searchable
                    value={selectedProduct?.id || ''}
                    onChange={(val) => handleChooseProductById(val as string)}
                    options={inventoryItems
                      .filter(
                        (p) =>
                          p.canSell &&
                          p.registrationStatus !== 'awaiting_information',
                      )
                      .map((p) => ({
                        value: p.id,
                        label: p.name,
                        description: `Cód. #${p.sku} · Estoque: ${Number(p.quantityOnHand).toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ${p.unit} · ${formatCurrency(p.unitPrice)}`,
                      }))}
                  />
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Quantidade
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(e.target.value)}
                  className="h-10 w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-gray-800 dark:text-slate-100 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Valor Unitário (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemUnitPrice}
                  onChange={(e) => setItemUnitPrice(e.target.value)}
                  placeholder="0.00"
                  className="h-10 w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-gray-800 dark:text-slate-100 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <Button
                  type="button"
                  onClick={handleAddItem}
                  className={`h-10 w-full rounded-xl text-xs font-bold text-white gap-1.5 ${
                    itemTypeToAdd === 'service'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>

          {/* Lista de Itens da O.S. */}
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 dark:border-slate-800 py-8 text-center text-xs text-gray-500">
              Nenhum produto ou serviço adicionado ainda nesta Ordem de Serviço.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-slate-800/70 text-[11px] uppercase text-gray-500 font-bold border-b border-gray-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-2.5">Tipo</th>
                    <th className="px-3 py-2.5">Descrição</th>
                    <th className="px-3 py-2.5 text-right w-28">Qtd</th>
                    <th className="px-3 py-2.5 text-right w-36">Valor Unit. (R$)</th>
                    <th className="px-3 py-2.5 text-right w-32">Total</th>
                    <th className="px-3 py-2.5 text-right w-14" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            it.itemType === 'service'
                              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                              : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {it.itemType === 'service' ? (
                            <>
                              <Wrench className="h-3 w-3" /> Serviço
                            </>
                          ) : (
                            <>
                              <Package className="h-3 w-3" /> Produto / Peça
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">
                        {it.description}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={it.quantity}
                          onChange={(e) => handleUpdateItem(it.id, 'quantity', e.target.value)}
                          className="w-20 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-right text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.unitPrice}
                          onChange={(e) => handleUpdateItem(it.id, 'unitPrice', e.target.value)}
                          className="w-28 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-right text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900 dark:text-white">
                        {formatCurrency(it.total)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
                          className="rounded p-1 text-gray-400 hover:text-red-600 cursor-pointer"
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

          {/* Resumo Financeiro da O.S. */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-gray-50 dark:bg-slate-800/60 p-4 border border-gray-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-slate-300">
              <div>
                Total em Peças / Produtos:{' '}
                <strong className="text-gray-900 dark:text-white">
                  {formatCurrency(productsSubtotal)}
                </strong>
              </div>
              <div>
                Total em Serviços:{' '}
                <strong className="text-gray-900 dark:text-white">
                  {formatCurrency(servicesSubtotal)}
                </strong>
              </div>
              <div className="flex items-center gap-2">
                <span>Desconto (R$):</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-24 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-right text-xs font-semibold text-red-600"
                />
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs uppercase font-bold text-gray-500 dark:text-slate-400 block">
                Valor Total da O.S.
              </span>
              <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

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
        description="Quando marcada, gera um agendamento na Agenda para o diagnóstico, manutenção ou entrega do equipamento."
      />

      {/* Barra de Ações Final */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <Link to={isEditing ? `/service-orders?status=${initialStatus}` : '/service-orders'}>
          <Button type="button" variant="outline" className="rounded-xl">
            Cancelar
          </Button>
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          {isEditing && initialStatus === 'pending' && (
            <Button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave({ overrideStatus: 'in_maintenance' })}
              className="gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              <Wrench className="h-4 w-4" />
              <span>Salvar e Voltar para Manutenção</span>
            </Button>
          )}

          {isEditing && initialStatus === 'in_maintenance' && (
            <Button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave({ overrideStatus: 'ready' })}
              className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Salvar e Marcar como Pronto</span>
            </Button>
          )}

          <Button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            variant={isEditing && (initialStatus === 'pending' || initialStatus === 'ready') ? 'outline' : 'primary'}
            className={`gap-2 rounded-xl ${
              isEditing && (initialStatus === 'pending' || initialStatus === 'ready')
                ? ''
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Save className="h-4 w-4" />
            {isSaving
              ? 'Salvando...'
              : isEditing
                ? `Salvar (Manter em ${SERVICE_ORDER_STATUS_LABELS[initialStatus]})`
                : 'Salvar Ordem de Serviço'}
          </Button>
        </div>
      </div>

      {/* Modal para Cadastrar Equipamento / Aparelho */}
      {showEquipmentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setShowEquipmentModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-gray-100 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2 text-blue-600 dark:text-blue-400">
                  <Laptop className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Equipamento / Aparelho
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Adicione itens para ficarem disponíveis para seleção
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEquipmentModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddEquipmentItem} className="mt-4 space-y-4">
              {equipmentModalError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{equipmentModalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Nome do Equipamento / Aparelho <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={newEquipmentInput}
                    onChange={(e) => setNewEquipmentInput(e.target.value)}
                    placeholder="Ex.: Notebook, Celular, Impressora, Monitor..."
                    className="h-10 flex-1 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:outline-hidden"
                  />
                  <Button
                    type="submit"
                    className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 px-4"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </div>

              {equipmentCatalog.length > 0 && (
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                    Itens Cadastrados ({equipmentCatalog.length})
                  </span>
                  <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800 rounded-xl border border-gray-200 dark:border-slate-800">
                    {equipmentCatalog.map((item) => (
                      <div
                        key={item}
                        className="flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-800/60"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setEquipmentName(item)
                            setShowEquipmentModal(false)
                          }}
                          className="font-medium text-gray-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 text-left flex-1 cursor-pointer"
                        >
                          {item}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveEquipmentItem(item)}
                          title="Remover item"
                          className="p-1 text-gray-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-1 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEquipmentModal(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Fechar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Informar o Motivo da Pendência */}
      {showPendingModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setShowPendingModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-gray-100 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/60 p-2 text-amber-600 dark:text-amber-400">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Encaminhar para Pendente
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Informe o motivo da pendência desta Ordem de Serviço
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPendingModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPendingModal} className="mt-4 space-y-4">
              {pendingModalError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{pendingModalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Motivo da Pendência <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  autoFocus
                  required
                  value={pendingModalInput}
                  onChange={(e) => setPendingModalInput(e.target.value)}
                  placeholder="Ex.: Aguardando chegada da peça (tela / placa), aguardando aprovação do cliente..."
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-gray-900 dark:text-white focus:border-amber-500 focus:outline-hidden"
                />
                <span className="mt-1 block text-[11px] text-gray-500 dark:text-slate-400">
                  Esta informação ficará visível em Problema &amp; Solução enquanto a O.S. estiver pendente.
                </span>
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPendingModal(false)}
                  className="flex-1 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                >
                  {saveAfterPendingConfirm
                    ? 'Confirmar e Encaminhar para Pendente'
                    : 'Confirmar Pendência'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Visualização Ampliada de Foto */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="max-w-3xl w-full rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {previewPhoto.caption || 'Foto do Equipamento / Avaria'}
              </span>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <img
              src={previewPhoto.dataUrl}
              alt={previewPhoto.caption || 'Foto'}
              className="max-h-[75vh] w-full object-contain rounded-xl bg-black"
            />
          </div>
        </div>
      )}
    </div>
  )
}
