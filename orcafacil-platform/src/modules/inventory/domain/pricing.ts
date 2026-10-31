/**
 * Preço de venda = preço de compra + margem (%) aplicada sobre o preço de compra.
 * Retorna string vazia quando os valores não permitem o cálculo.
 */
export function calculateSalePrice(purchasePrice: string, marginPercent: string): string {
  if (purchasePrice.trim() === '' || marginPercent.trim() === '') return ''
  const purchase = Number(purchasePrice)
  const margin = Number(marginPercent)
  if (!Number.isFinite(purchase) || !Number.isFinite(margin) || purchase < 0 || margin < 0) {
    return ''
  }
  const purchaseCents = Math.round(purchase * 100)
  const saleCents = Math.round(purchaseCents * (1 + margin / 100))
  return (saleCents / 100).toFixed(2)
}

/**
 * Margem (%) sobre o preço de compra a partir de um preço de venda informado manualmente.
 * Retorna string vazia quando não é possível calcular (ex.: compra zerada).
 */
export function calculateMarginPercent(purchasePrice: string, salePrice: string): string {
  if (purchasePrice.trim() === '' || salePrice.trim() === '') return ''
  const purchase = Number(purchasePrice)
  const sale = Number(salePrice)
  if (!Number.isFinite(purchase) || !Number.isFinite(sale) || purchase <= 0 || sale < purchase) {
    return ''
  }
  const margin = ((Math.round(sale * 100) - Math.round(purchase * 100)) / Math.round(purchase * 100)) * 100
  return String(Math.round(margin * 100) / 100)
}

