import { describe, expect, it } from 'vitest'
import {
  calculateServiceTotalCost,
  calculateProfitMargin,
  calculatePriceFromMargin,
  isPriceAboveMinimum,
} from './service-calculations'

describe('service-calculations', () => {
  it('calcula custo total corretamente', () => {
    const cost = calculateServiceTotalCost({
      operationalCost: 50,
      laborCost: 100,
      materialsCost: 75.5,
    })
    expect(cost).toBe(225.5)
  })

  it('calcula margem de lucro real sobre o preço de venda', () => {
    // Exemplo: Custo 150, Preço 200 -> Lucro 50 -> Margem = (50 / 200) * 100 = 25%
    const margin = calculateProfitMargin(150, 200)
    expect(margin).toBe(25)

    // Preço zero ou menor que custo
    expect(calculateProfitMargin(100, 0)).toBe(0)
    expect(calculateProfitMargin(100, 50)).toBe(-100)
  })

  it('calcula preço sugerido a partir de custo e margem', () => {
    // Custo 75, Margem 25% -> Preço = 75 / 0.75 = 100
    const price = calculatePriceFromMargin(75, 25)
    expect(price).toBe(100)
  })

  it('valida preço mínimo corretamente', () => {
    expect(isPriceAboveMinimum(100, 80)).toBe(true)
    expect(isPriceAboveMinimum(80, 80)).toBe(true)
    expect(isPriceAboveMinimum(79.99, 80)).toBe(false)
    expect(isPriceAboveMinimum(50, 0)).toBe(true)
  })
})

