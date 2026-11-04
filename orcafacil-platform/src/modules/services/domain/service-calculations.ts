/**
 * Regras de cálculo financeiro e precificação do Módulo de Serviços.
 *
 * IMPORTANTE:
 * Margem de lucro é calculada sobre a RECEITA/PREÇO DE VENDA:
 * Margem % = ((Preço - Custo) / Preço) * 100
 * Não confundir com Markup (acréscimo sobre custo).
 */

export interface ServiceCostComposition {
  operationalCost: number
  laborCost: number
  materialsCost: number
}

/**
 * Calcula o custo total somando custos operacionais, mão de obra e materiais.
 */
export function calculateServiceTotalCost(composition: ServiceCostComposition): number {
  const operational = Math.max(0, Number(composition.operationalCost) || 0)
  const labor = Math.max(0, Number(composition.laborCost) || 0)
  const materials = Math.max(0, Number(composition.materialsCost) || 0)
  return operational + labor + materials
}

/**
 * Calcula a Margem de Lucro Real (%) sobre o Preço de Venda:
 * Margem % = ((Preço - Custo) / Preço) * 100
 */
export function calculateProfitMargin(cost: number, salePrice: number): number {
  const c = Math.max(0, Number(cost) || 0)
  const p = Math.max(0, Number(salePrice) || 0)

  if (p <= 0) return 0
  const profit = p - c
  const margin = (profit / p) * 100
  return Number(margin.toFixed(2))
}

/**
 * Calcula o Preço de Venda Sugerido a partir de um Custo e da Margem de Lucro Desejada (%):
 * Preço = Custo / (1 - (Margem / 100))
 */
export function calculatePriceFromMargin(cost: number, targetMarginPercent: number): number {
  const c = Math.max(0, Number(cost) || 0)
  const m = Number(targetMarginPercent) || 0

  if (m >= 100) return c
  if (m <= 0) return c

  const price = c / (1 - m / 100)
  return Number(price.toFixed(2))
}

/**
 * Valida se um preço ofertado atende ao preço mínimo estipulado para o serviço.
 */
export function isPriceAboveMinimum(offeredPrice: number, minimumPrice: number): boolean {
  const min = Math.max(0, Number(minimumPrice) || 0)
  const offered = Math.max(0, Number(offeredPrice) || 0)

  if (min <= 0) return true
  return offered >= min
}

