import { describe, it, expect } from 'vitest'
import {
  calculateItemTotal,
  calculateSubtotal,
  calculateTotal,
  formatCurrency,
  isValidDecimal,
  normalizeQuantity,
} from './monetary'

describe('Monetary Utilities', () => {
  describe('calculateItemTotal', () => {
    it('deve multiplicar quantidade e valor unitário com arredondamento HALF_UP de 2 casas', () => {
      // 2.5 * 100 = 250.00
      expect(calculateItemTotal('2.5000', '100.0000')).toBe('250.00')

      // 3 * 33.3333 = 99.9999 -> 100.00
      expect(calculateItemTotal('3', '33.3333')).toBe('100.00')

      // 1.5 * 10.55 = 15.825 -> 15.83
      expect(calculateItemTotal('1.5000', '10.5500')).toBe('15.83')
    })

    it('deve retornar 0.00 para valores inválidos ou não finitos', () => {
      expect(calculateItemTotal('abc', '10')).toBe('0.00')
      expect(calculateItemTotal('10', 'xyz')).toBe('0.00')
    })
  })

  describe('calculateSubtotal', () => {
    it('deve somar os subtotais com precisão decimal', () => {
      const items = ['150.50', '49.50', '100.00']
      expect(calculateSubtotal(items)).toBe('300.00')
    })

    it('deve retornar 0.00 para lista vazia', () => {
      expect(calculateSubtotal([])).toBe('0.00')
    })
  })

  describe('calculateTotal', () => {
    it('deve subtrair o desconto do subtotal', () => {
      expect(calculateTotal('500.00', '50.00')).toBe('450.00')
    })

    it('nunca deve permitir total negativo quando o desconto excede o subtotal', () => {
      expect(calculateTotal('100.00', '150.00')).toBe('0.00')
    })

    it('deve lidar com desconto zero ou ausente', () => {
      expect(calculateTotal('250.00', '0.00')).toBe('250.00')
    })
  })

  describe('formatCurrency', () => {
    it('deve formatar valores para o padrão monetário BRL', () => {
      const formatted = formatCurrency('1250.50')
      // Normaliza espaços para evitar falhas com no-break space de Intl
      const normalized = formatted.replace(/\u00a0/g, ' ')
      expect(normalized).toBe('R$ 1.250,50')
    })

    it('deve formatar zero adequadamente', () => {
      const formatted = formatCurrency('0.00')
      const normalized = formatted.replace(/\u00a0/g, ' ')
      expect(normalized).toBe('R$ 0,00')
    })
  })

  describe('isValidDecimal', () => {
    it('deve validar strings numéricas decimais corretamente', () => {
      expect(isValidDecimal('100')).toBe(true)
      expect(isValidDecimal('100.50')).toBe(true)
      expect(isValidDecimal('0.0001')).toBe(true)
      expect(isValidDecimal('abc')).toBe(false)
      expect(isValidDecimal('100,50')).toBe(false) // deve usar ponto decimal
    })
  })

  describe('normalizeQuantity', () => {
    it('deve normalizar quantidades para 4 casas decimais', () => {
      expect(normalizeQuantity('2')).toBe('2.0000')
      expect(normalizeQuantity('1.5')).toBe('1.5000')
    })

    it('deve retornar padrão 1.0000 para valores inválidos ou negativos', () => {
      expect(normalizeQuantity('-5')).toBe('1.0000')
      expect(normalizeQuantity('invalid')).toBe('1.0000')
    })
  })
})

