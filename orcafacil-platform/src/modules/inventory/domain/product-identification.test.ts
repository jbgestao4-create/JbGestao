import { describe, expect, it } from 'vitest'
import {
  getInventoryUniqueConstraintError,
  getSalesIndicators,
  isValidBarcode,
} from './product-identification'

describe('getInventoryUniqueConstraintError', () => {
  it('maps duplicate barcode constraint to a clear message', () => {
    expect(
      getInventoryUniqueConstraintError(
        '23505',
        'duplicate key value violates unique constraint "inventory_items_org_barcode_key"',
      ),
    ).toBe('Ja existe um produto com esse codigo de barras cadastrado')
  })

  it('maps duplicate SKU but leaves unrelated constraints to the generic handler', () => {
    expect(
      getInventoryUniqueConstraintError(
        '23505',
        'duplicate key value violates unique constraint "inventory_items_org_sku_key"',
      ),
    ).toBe('Ja existe um produto com esse codigo interno cadastrado')
    expect(
      getInventoryUniqueConstraintError(
        '23505',
        'duplicate key value violates unique constraint "other_constraint"',
      ),
    ).toBeNull()
    expect(getInventoryUniqueConstraintError('42501', 'inventory_items_org_barcode_key')).toBeNull()
  })
})

describe('isValidBarcode', () => {
  it('accepts empty barcodes and valid EAN/UPC check digits', () => {
    expect(isValidBarcode('')).toBe(true)
    expect(isValidBarcode('4006381333931')).toBe(true)
    expect(isValidBarcode('96385074')).toBe(true)
    expect(isValidBarcode('036000291452')).toBe(true)
  })

  it('rejects invalid check digits and malformed numeric barcodes', () => {
    expect(isValidBarcode('4006381333932')).toBe(false)
    expect(isValidBarcode('12345')).toBe(false)
  })

  it('allows non-numeric compatible codes within a reasonable length', () => {
    expect(isValidBarcode('ABC-12345')).toBe(true)
    expect(isValidBarcode('x')).toBe(false)
  })
})

describe('getSalesIndicators', () => {
  it('calculates gross profit, margin over sales, and markup', () => {
    expect(getSalesIndicators('50.00', '80.00')).toEqual({
      grossProfit: '30.00',
      marginPercent: 37.5,
      markupPercent: 60,
    })
  })

  it('handles missing or zero sales prices', () => {
    expect(getSalesIndicators('50.00', '0')).toEqual({
      grossProfit: '0.00',
      marginPercent: 0,
      markupPercent: 0,
    })
  })
})
