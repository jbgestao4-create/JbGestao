/**
 * Tipos de domínio compartilhados entre módulos.
 * Estes tipos representam contratos públicos — evite detalhes de implementação aqui.
 */

/** Identificador único (UUID) */
export type UUID = string

/** Papel do usuário dentro de uma organização */
export type OrganizationRole = 'owner' | 'admin' | 'member'

/** Tipo de pessoa de um cliente cadastrado */
export type CustomerType = 'individual' | 'company'

/** Código único e estável de um módulo da plataforma */
export type ModuleCode = 'orcafacil' | 'agendapro' | 'estoqueleve'

/** Cartões da página inicial que podem ser liberados individualmente para operadores */
export type DashboardModuleCode =
  'MOD-01' | 'MOD-02' | 'MOD-03' | 'MOD-04' | 'MOD-05' | 'MOD-06' | 'MOD-07'

/** Perfil do usuário autenticado */
export interface UserProfile {
  id: UUID
  displayName: string | null
  avatarUrl: string | null
  email: string
  createdAt: string
}

/** Organização da qual o usuário é membro */
export interface Organization {
  id: UUID
  name: string
  slug: string
  createdAt: string
}

/** Associação do usuário a uma organização */
export interface OrganizationMembership {
  organizationId: UUID
  userId: UUID
  role: OrganizationRole
}

/** Detalhes completos do membro da organização para gestão de equipe */
export interface OrganizationMemberDetail {
  userId: UUID
  organizationId: UUID
  role: OrganizationRole
  displayName: string
  email: string
  jobTitle: string | null
  modules: ModuleCode[]
  dashboardModules: DashboardModuleCode[]
  createdAt: string
}

export interface Supplier {
  id: UUID
  organizationId: UUID
  name: string
  document: string | null
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface InventoryItem {
  id: UUID
  organizationId: UUID
  supplierId: UUID | null
  supplierName: string | null
  name: string
  unit: string
  quantityOnHand: string
  minimumQuantity: string
  unitPrice: string
  sku: string
  barcode: string | null
  description: string | null
  category: string | null
  subcategory: string | null
  brand: string | null
  manufacturer: string | null
  model: string | null
  manufacturerReference: string | null
  attributes: Record<string, string>
  purchasePrice: string
  lastPurchasePrice: string
  averageCost: string
  extraPurchaseCost: string
  supplierProductCode: string | null
  leadTimeDays: number | null
  lastPurchaseAt: string | null
  promotionalPrice: string | null
  targetMarginPercent: string | null
  minimumSalePrice: string | null
  maximumQuantity: string
  idealRestockQuantity: string
  location: string | null
  warehouse: string | null
  allowNegativeStock: boolean
  trackExpiry: boolean
  trackLot: boolean
  trackSerialNumber: boolean
  fiscalNcm: string | null
  fiscalCest: string | null
  fiscalOrigin: string | null
  commercialUnit: string | null
  fiscalProductCode: string | null
  gtin: string | null
  isActive: boolean
  canSell: boolean
  canPurchase: boolean
  notes: string | null
  parentItemId: UUID | null
  purchaseUnit: string | null
  purchaseUnitFactor: string
  imagePath: string | null
  suppliers: InventoryItemSupplier[]
  createdAt: string
  updatedAt: string
}

export interface InventoryItemSupplier {
  id: UUID
  supplierId: UUID
  supplierName: string
  supplierProductCode: string | null
  purchasePrice: string
  leadTimeDays: number | null
  notes: string | null
}

export interface InventoryMovement {
  id: UUID
  organizationId: UUID
  inventoryItemId: UUID
  movementType: string
  quantity: string
  balanceBefore: string
  balanceAfter: string
  unitPrice: string | null
  reason: string
  documentReference: string | null
  supplierId: UUID | null
  quoteId: UUID | null
  userId: UUID | null
  movedAt: string
}

/** Resultado genérico de uma operação de serviço */
export type ServiceResult<T> =
  { success: true; data: T } | { success: false; error: string; code?: string }
