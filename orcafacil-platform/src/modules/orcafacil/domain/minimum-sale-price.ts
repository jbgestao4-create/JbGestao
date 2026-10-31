export interface QuoteSalePriceInput {
  itemIndex: number
  inventoryItemId: string
  unitPrice: string | number
}

export interface InventoryMinimumSalePrice {
  id: string
  name: string
  minimumSalePrice: string | number | null
}

export interface MinimumSalePriceViolation {
  itemIndex: number
  productName: string
  minimumSalePrice: string | number
}

interface DecimalValue {
  integer: bigint
  scale: number
}

function parseDecimal(value: unknown): DecimalValue | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    value = String(value)
  }
  if (typeof value !== 'string') return null
  const decimal = value.trim()
  const match = /^(\d+)(?:\.(\d+))?$/.exec(decimal)
  if (!match) return null
  const fraction = match[2] || ''
  return {
    integer: BigInt(`${match[1]}${fraction}`),
    scale: fraction.length,
  }
}

function isBelowMinimum(value: unknown, minimum: unknown): boolean {
  const price = parseDecimal(value)
  const threshold = parseDecimal(minimum)
  if (!price || !threshold) return false
  const scale = Math.max(price.scale, threshold.scale)
  const normalizedPrice = price.integer * 10n ** BigInt(scale - price.scale)
  const normalizedMinimum = threshold.integer * 10n ** BigInt(scale - threshold.scale)
  return normalizedPrice < normalizedMinimum
}

export function getMinimumSalePriceViolations(
  items: QuoteSalePriceInput[],
  inventory: InventoryMinimumSalePrice[],
): MinimumSalePriceViolation[] {
  const inventoryById = new Map(inventory.map((product) => [product.id, product]))
  return items.flatMap((item) => {
    if (!item.inventoryItemId) return []
    const product = inventoryById.get(item.inventoryItemId)
    if (
      !product ||
      product.minimumSalePrice === null ||
      !isBelowMinimum(item.unitPrice, product.minimumSalePrice)
    ) {
      return []
    }
    return [
      {
        itemIndex: item.itemIndex,
        productName: product.name,
        minimumSalePrice: product.minimumSalePrice,
      },
    ]
  })
}
