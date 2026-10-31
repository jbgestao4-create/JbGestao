import { describe, expect, it } from 'vitest'
import { calculateMarginPercent, calculateSalePrice } from './pricing'

describe('calculateSalePrice', () => {
  it('adds the margin over the purchase price', () => {
    expect(calculateSalePrice('100', '30')).toBe('130.00')
    expect(calculateSalePrice('8', '50')).toBe('12.00')
    expect(calculateSalePrice('10.99', '0')).toBe('10.99')
  })

  it('rounds to cents', () => {
    expect(calculateSalePrice('3.33', '33.33')).toBe('4.44')
  })

  it('returns empty when values are missing or invalid', () => {
    expect(calculateSalePrice('', '30')).toBe('')
    expect(calculateSalePrice('100', '')).toBe('')
    expect(calculateSalePrice('-1', '30')).toBe('')
    expect(calculateSalePrice('abc', '30')).toBe('')
  })
})

describe('calculateMarginPercent', () => {
  it('derives the margin from a manual sale price', () => {
    expect(calculateMarginPercent('100', '130')).toBe('30')
    expect(calculateMarginPercent('8', '12')).toBe('50')
    expect(calculateMarginPercent('3', '4')).toBe('33.33')
  })

  it('returns empty when it cannot be derived', () => {
    expect(calculateMarginPercent('0', '10')).toBe('')
    expect(calculateMarginPercent('10', '5')).toBe('')
    expect(calculateMarginPercent('', '5')).toBe('')
  })
})

