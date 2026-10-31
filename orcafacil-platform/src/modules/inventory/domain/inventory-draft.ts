import type { InventoryItemParams } from '../services/inventory.service'

const DRAFT_VERSION = 1
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000
const MAX_DRAFT_SIZE = 64 * 1024

const stringFields = [
  'supplierId',
  'name',
  'unit',
  'quantityOnHand',
  'minimumQuantity',
  'unitPrice',
  'sku',
  'barcode',
  'description',
  'category',
  'subcategory',
  'brand',
  'manufacturer',
  'model',
  'manufacturerReference',
  'purchasePrice',
  'extraPurchaseCost',
  'supplierProductCode',
  'leadTimeDays',
  'promotionalPrice',
  'targetMarginPercent',
  'minimumSalePrice',
  'maximumQuantity',
  'idealRestockQuantity',
  'location',
  'warehouse',
  'fiscalNcm',
  'fiscalCest',
  'fiscalOrigin',
  'commercialUnit',
  'fiscalProductCode',
  'gtin',
  'notes',
  'purchaseUnit',
  'purchaseUnitFactor',
] as const satisfies readonly (keyof InventoryItemParams)[]

const booleanFields = [
  'allowNegativeStock',
  'trackExpiry',
  'trackLot',
  'trackSerialNumber',
  'isActive',
  'canSell',
  'canPurchase',
] as const satisfies readonly (keyof InventoryItemParams)[]

interface InventoryDraftEnvelope {
  version: number
  savedAt: number
  form: InventoryItemParams
}

export type InventoryDraftReadResult =
  | { status: 'draft'; form: InventoryItemParams }
  | { status: 'empty' | 'invalid' | 'expired' | 'unavailable' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isInventoryItemParams(value: unknown): value is InventoryItemParams {
  if (!isRecord(value)) return false
  if (!stringFields.every((field) => typeof value[field] === 'string')) return false
  if (!booleanFields.every((field) => typeof value[field] === 'boolean')) return false
  if (
    !Array.isArray(value.supplierIds) ||
    !value.supplierIds.every((id) => typeof id === 'string')
  ) {
    return false
  }
  if (!isRecord(value.attributes)) return false
  return Object.values(value.attributes).every((attribute) => typeof attribute === 'string')
}

export function normalizeInventoryItemParams(value: unknown): InventoryItemParams | null {
  if (!isRecord(value)) return null
  const normalized: Record<string, unknown> = { ...value }

  for (const field of stringFields) {
    const fieldValue = normalized[field]
    if (typeof fieldValue === 'string') continue
    if (typeof fieldValue === 'number' && Number.isFinite(fieldValue)) {
      normalized[field] = String(fieldValue)
      continue
    }
    return null
  }

  if (!isInventoryItemParams(normalized)) return null
  return normalized
}

export function getInventoryDraftKey(userId: string, organizationId: string, itemId?: string) {
  return `jb:inventory:draft:v1:${encodeURIComponent(userId)}:${encodeURIComponent(organizationId)}:${encodeURIComponent(itemId ?? 'new')}`
}

export function readInventoryDraft(key: string): InventoryDraftReadResult {
  let serialized: string | null
  try {
    serialized = window.sessionStorage.getItem(key)
  } catch {
    return { status: 'unavailable' }
  }
  if (!serialized) return { status: 'empty' }

  if (serialized.length > MAX_DRAFT_SIZE) {
    try {
      window.sessionStorage.removeItem(key)
    } catch {
      return { status: 'unavailable' }
    }
    return { status: 'invalid' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    try {
      window.sessionStorage.removeItem(key)
    } catch {
      return { status: 'unavailable' }
    }
    return { status: 'invalid' }
  }

  if (!isRecord(parsed)) {
    try {
      window.sessionStorage.removeItem(key)
    } catch {
      return { status: 'unavailable' }
    }
    return { status: 'invalid' }
  }

  const envelope = parsed as Partial<InventoryDraftEnvelope>
  const form = normalizeInventoryItemParams(envelope.form)
  if (
    envelope.version !== DRAFT_VERSION ||
    typeof envelope.savedAt !== 'number' ||
    !Number.isFinite(envelope.savedAt) ||
    !form
  ) {
    try {
      window.sessionStorage.removeItem(key)
    } catch {
      return { status: 'unavailable' }
    }
    return { status: 'invalid' }
  }

  if (Date.now() - envelope.savedAt > DRAFT_TTL_MS || envelope.savedAt > Date.now()) {
    try {
      window.sessionStorage.removeItem(key)
    } catch {
      return { status: 'unavailable' }
    }
    return { status: 'expired' }
  }

  return { status: 'draft', form }
}

export function writeInventoryDraft(key: string, form: unknown): boolean {
  const normalizedForm = normalizeInventoryItemParams(form)
  if (!normalizedForm) return false
  try {
    const serialized = JSON.stringify({
      version: DRAFT_VERSION,
      savedAt: Date.now(),
      form: normalizedForm,
    } satisfies InventoryDraftEnvelope)
    if (serialized.length > MAX_DRAFT_SIZE) return false
    window.sessionStorage.setItem(key, serialized)
    return true
  } catch {
    return false
  }
}

export function clearInventoryDraft(key: string): boolean {
  try {
    window.sessionStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}
