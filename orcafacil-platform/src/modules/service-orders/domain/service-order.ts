export type ServiceOrderStatus =
  | 'queue'
  | 'pending'
  | 'in_maintenance'
  | 'ready'
  | 'closed'

export type ServiceOrderPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface ServiceOrderPhoto {
  id: string
  dataUrl: string
  caption?: string
  createdAt: string
}

export interface ServiceOrderItem {
  id: string
  itemType: 'product' | 'service'
  inventoryItemId?: string | null
  serviceId?: string | null
  description: string
  unit: string
  quantity: string
  unitPrice: string
  total: string
}

export interface ServiceOrderListItem {
  id: string
  organizationId: string
  orderNumber: string
  status: ServiceOrderStatus
  priority: ServiceOrderPriority
  customerId: string | null
  customerName: string
  customerPhone: string | null
  customerDocument: string | null
  equipmentName: string
  equipmentBrand: string | null
  equipmentModel: string | null
  serialNumber: string | null
  reportedProblem: string
  pendingReason: string | null
  solutionApplied: string | null
  technicianName: string | null
  estimatedDeliveryDate: string | null
  photosCount: number
  firstPhotoUrl: string | null
  hasDamage: boolean
  productsSubtotal: string
  servicesSubtotal: string
  subtotal: string
  discount: string
  total: string
  saleId: string | null
  saleNumber: string | null
  creatorName: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ServiceOrderDetail {
  id: string
  organizationId: string
  orderNumber: string
  status: ServiceOrderStatus
  priority: ServiceOrderPriority
  customerId: string | null
  customerName: string
  customerPhone: string | null
  customerDocument: string | null
  equipmentName: string
  equipmentBrand: string | null
  equipmentModel: string | null
  serialNumber: string | null
  equipmentColor: string | null
  accessories: string | null
  devicePassword: string | null
  damageNotes: string | null
  damageChecklist: string[]
  photos: ServiceOrderPhoto[]
  reportedProblem: string
  technicalDiagnosis: string | null
  solutionApplied: string | null
  technicianName: string | null
  estimatedDeliveryDate: string | null
  warrantyDays: number
  warrantyTerms: string | null
  internalNotes: string | null
  pendingReason: string | null
  productsSubtotal: string
  servicesSubtotal: string
  subtotal: string
  discount: string
  total: string
  saleId: string | null
  saleNumber: string | null
  creatorName: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  items: ServiceOrderItem[]
}

export const SERVICE_ORDER_STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  queue: 'Fila de Atendimento',
  pending: 'Pendente',
  in_maintenance: 'Em Manutenção',
  ready: 'Pronto',
  closed: 'O.S. Encerrada',
}

export const SERVICE_ORDER_STATUS_BADGE_CLASSES: Record<ServiceOrderStatus, string> = {
  queue:
    'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
  pending:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  in_maintenance:
    'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  ready:
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  closed:
    'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
}

export const SERVICE_ORDER_PRIORITY_LABELS: Record<ServiceOrderPriority, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
}

export const SERVICE_ORDER_PRIORITY_BADGE_CLASSES: Record<ServiceOrderPriority, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400',
  normal: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  high: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  urgent: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
}

export const NO_DAMAGE_IDENTIFIED_OPTION = 'Sem Avarias identificadas'

export const DEFAULT_DAMAGE_CHECKLIST_OPTIONS = [
  'Riscos na carcaça / gabinete',
  'Tela trincada ou arranhada',
  'Amassados ou marcas de queda',
  'Parafusos ou tampas faltando',
  'Sinais de umidade / oxidação',
  'Cabos ou conectores danificados',
  'Botões / teclas com defeito físico',
  'Equipamento chegou desligado / não liga',
] as const

