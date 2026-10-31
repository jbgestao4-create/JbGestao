import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearInventoryDraft,
  getInventoryDraftKey,
  readInventoryDraft,
  writeInventoryDraft,
} from './inventory-draft'
import type { InventoryItemParams } from '../services/inventory.service'

const form: InventoryItemParams = {
  supplierId: 'supplier-a',
  supplierIds: ['supplier-a'],
  name: 'Cabo flexível',
  unit: 'M',
  quantityOnHand: '0',
  minimumQuantity: '1',
  unitPrice: '12.50',
  sku: 'SKU-TESTE',
  barcode: '',
  description: '',
  category: 'Elétrica',
  subcategory: '',
  brand: '',
  manufacturer: '',
  model: '',
  manufacturerReference: '',
  purchasePrice: '8.00',
  extraPurchaseCost: '0',
  supplierProductCode: '',
  leadTimeDays: '',
  promotionalPrice: '',
  targetMarginPercent: '',
  minimumSalePrice: '',
  maximumQuantity: '0',
  idealRestockQuantity: '0',
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
  purchaseUnitFactor: '1',
  attributes: { color: 'Azul' },
}

describe('inventory draft storage', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('scopes drafts to user, organization and product', () => {
    expect(getInventoryDraftKey('user-a', 'org-a')).not.toBe(
      getInventoryDraftKey('user-b', 'org-a'),
    )
    expect(getInventoryDraftKey('user-a', 'org-a')).not.toBe(
      getInventoryDraftKey('user-a', 'org-b'),
    )
    expect(getInventoryDraftKey('user-a', 'org-a', 'item-a')).not.toBe(
      getInventoryDraftKey('user-a', 'org-a', 'item-b'),
    )
  })

  it('restores a valid draft from this browser tab session', () => {
    const key = getInventoryDraftKey('user-a', 'org-a')
    expect(writeInventoryDraft(key, form)).toBe(true)
    expect(readInventoryDraft(key)).toEqual({ status: 'draft', form })
  })

  it('normalizes numeric form values before saving a draft', () => {
    const key = getInventoryDraftKey('user-a', 'org-a')
    const formWithNumericValues = { ...form, minimumQuantity: 2, unitPrice: 12.5 }
    expect(writeInventoryDraft(key, formWithNumericValues)).toBe(true)
    expect(readInventoryDraft(key)).toEqual({
      status: 'draft',
      form: { ...form, minimumQuantity: '2', unitPrice: '12.5' },
    })
  })

  it('rejects malformed or outdated data rather than restoring it', () => {
    const key = getInventoryDraftKey('user-a', 'org-a')
    window.sessionStorage.setItem(
      key,
      JSON.stringify({ version: 1, savedAt: Date.now(), form: {} }),
    )
    expect(readInventoryDraft(key)).toEqual({ status: 'invalid' })
    expect(window.sessionStorage.getItem(key)).toBeNull()
  })

  it('reports when browser session storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable')
    })
    expect(readInventoryDraft(getInventoryDraftKey('user-a', 'org-a'))).toEqual({
      status: 'unavailable',
    })
  })

  it('expires old drafts and clears saved drafts after submission', () => {
    const key = getInventoryDraftKey('user-a', 'org-a')
    window.sessionStorage.setItem(
      key,
      JSON.stringify({ version: 1, savedAt: Date.now() - 25 * 60 * 60 * 1000, form }),
    )
    expect(readInventoryDraft(key)).toEqual({ status: 'expired' })
    expect(writeInventoryDraft(key, form)).toBe(true)
    expect(clearInventoryDraft(key)).toBe(true)
    expect(readInventoryDraft(key)).toEqual({ status: 'empty' })
  })
})
