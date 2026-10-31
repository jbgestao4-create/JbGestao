import { describe, expect, it } from 'vitest'
import { getMinimumSalePriceViolations } from './minimum-sale-price'

describe('getMinimumSalePriceViolations', () => {
  const inventory = [
    { id: 'item-a', name: 'Cabo elétrico', minimumSalePrice: '12.5000' },
    { id: 'item-b', name: 'Tinta', minimumSalePrice: null },
  ]

  it('finds linked stock items priced below their configured minimum', () => {
    expect(
      getMinimumSalePriceViolations(
        [{ itemIndex: 1, inventoryItemId: 'item-a', unitPrice: '12.49' }],
        inventory,
      ),
    ).toEqual([{ itemIndex: 1, productName: 'Cabo elétrico', minimumSalePrice: '12.5000' }])
  })

  it('allows prices equal to or above minimum and items without a minimum', () => {
    expect(
      getMinimumSalePriceViolations(
        [
          { itemIndex: 0, inventoryItemId: 'item-a', unitPrice: '12.5000' },
          { itemIndex: 1, inventoryItemId: 'item-a', unitPrice: '12.51' },
          { itemIndex: 2, inventoryItemId: 'item-b', unitPrice: '0' },
          { itemIndex: 3, inventoryItemId: '', unitPrice: '0' },
        ],
        inventory,
      ),
    ).toEqual([])
  })

  it('compares precise decimal values without floating point rounding', () => {
    expect(
      getMinimumSalePriceViolations(
        [{ itemIndex: 0, inventoryItemId: 'item-a', unitPrice: '12.4999' }],
        inventory,
      ),
    ).toHaveLength(1)
  })

  it('accepts numeric prices returned by the database', () => {
    expect(
      getMinimumSalePriceViolations(
        [{ itemIndex: 0, inventoryItemId: 'item-a', unitPrice: 12.49 }],
        [{ id: 'item-a', name: 'Cabo elétrico', minimumSalePrice: 12.5 }],
      ),
    ).toEqual([{ itemIndex: 0, productName: 'Cabo elétrico', minimumSalePrice: 12.5 }])
  })

  it('does not throw when a price value is not a string or finite number', () => {
    expect(() =>
      getMinimumSalePriceViolations(
        [
          { itemIndex: 0, inventoryItemId: 'item-a', unitPrice: Number.NaN },
          { itemIndex: 1, inventoryItemId: 'item-a', unitPrice: Number.POSITIVE_INFINITY },
        ],
        [{ id: 'item-a', name: 'Cabo elétrico', minimumSalePrice: 12.5 }],
      ),
    ).not.toThrow()
  })
})
