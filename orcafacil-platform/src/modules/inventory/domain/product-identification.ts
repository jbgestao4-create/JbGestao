export function areCodesMatching(
  codeA: string | null | undefined,
  codeB: string | null | undefined,
): boolean {
  if (!codeA || !codeB) return false
  const cleanA = codeA.trim().toLowerCase().replace(/^#+/, '')
  const cleanB = codeB.trim().toLowerCase().replace(/^#+/, '')
  if (!cleanA || !cleanB) return false

  // Ignore invalid / placeholder barcodes
  if (
    cleanA === 'sem gtin' ||
    cleanA === 'semgtin' ||
    cleanA === '0' ||
    cleanB === 'sem gtin' ||
    cleanB === 'semgtin' ||
    cleanB === '0'
  ) {
    return false
  }

  // Exact match
  if (cleanA === cleanB) return true

  // Numeric comparison without leading zeros (e.g. 000000000016005166 vs 16005166)
  const noZerosA = cleanA.replace(/^0+/, '')
  const noZerosB = cleanB.replace(/^0+/, '')
  if (noZerosA && noZerosB && noZerosA === noZerosB) return true

  return false
}

export function getInventoryUniqueConstraintError(
  code: string | undefined,
  message: string | undefined,
): string | null {
  if (code !== '23505' || !message) return null
  if (message.includes('inventory_items_org_barcode_key')) {
    return 'Ja existe um produto com esse codigo de barras cadastrado'
  }
  if (message.includes('inventory_items_org_sku_key')) {
    return 'Ja existe um produto com esse codigo interno cadastrado'
  }
  return null
}

export function isValidBarcode(value: string) {
  const barcode = value.trim()
  if (!barcode) return true
  if (!/^\d+$/.test(barcode)) return barcode.length >= 4 && barcode.length <= 50
  if (![8, 12, 13, 14].includes(barcode.length)) return false

  const digits = Array.from(barcode, Number)
  const checkDigit = digits.pop()
  if (checkDigit === undefined) return false

  const weightedSum = digits
    .slice()
    .reverse()
    .reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 3 : 1), 0)
  return (10 - (weightedSum % 10)) % 10 === checkDigit
}

export function getSalesIndicators(purchasePrice: string, salePrice: string) {
  const purchase = Number(purchasePrice)
  const sale = Number(salePrice)
  if (!Number.isFinite(purchase) || !Number.isFinite(sale) || sale <= 0) {
    return { grossProfit: '0.00', marginPercent: 0, markupPercent: 0 }
  }

  const purchaseCents = Math.round(purchase * 100)
  const saleCents = Math.round(sale * 100)
  const grossProfitCents = saleCents - purchaseCents
  return {
    grossProfit: (grossProfitCents / 100).toFixed(2),
    marginPercent: (grossProfitCents / saleCents) * 100,
    markupPercent: purchaseCents > 0 ? (grossProfitCents / purchaseCents) * 100 : 0,
  }
}
