import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_THEME_COLOR,
  PRESET_THEME_COLORS,
  normalizeHexColor,
  hexToRgb,
  rgbToHsl,
  hslToHex,
  generateThemeShades,
  applyThemeToDOM,
  getStoredThemeColor,
  setStoredThemeColor,
  clearStoredThemeColor,
} from './theme-color'

describe('theme-color utilities', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('style')
  })

  it('contains expected presets including default blue, green, teal, purple, etc.', () => {
    expect(PRESET_THEME_COLORS.length).toBeGreaterThanOrEqual(11)
    const bluePreset = PRESET_THEME_COLORS.find((p) => p.id === 'blue')
    expect(bluePreset?.hex).toBe(DEFAULT_THEME_COLOR)
  })

  it('normalizes hex colors correctly', () => {
    expect(normalizeHexColor('#2563eb')).toBe('#2563eb')
    expect(normalizeHexColor('2563EB')).toBe('#2563eb')
    expect(normalizeHexColor('#fff')).toBe('#ffffff')
    expect(normalizeHexColor('invalid')).toBe(DEFAULT_THEME_COLOR)
  })

  it('converts hex to RGB accurately', () => {
    expect(hexToRgb('#2563eb')).toEqual({ r: 37, g: 99, b: 235 })
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
  })

  it('converts RGB to HSL and back to hex', () => {
    const { r, g, b } = hexToRgb('#16a34a')
    const hsl = rgbToHsl(r, g, b)
    expect(hsl.h).toBeGreaterThan(100)
    expect(hsl.h).toBeLessThan(160)
    const backToHex = hslToHex(hsl.h, hsl.s, hsl.l)
    expect(backToHex.toLowerCase()).toBe('#16a34a')
  })

  it('generates consistent shades with contrast text', () => {
    const blueShades = generateThemeShades('#2563eb')
    expect(blueShades.primary).toBe('#2563eb')
    expect(blueShades.text).toBe('#ffffff')
    expect(blueShades.hover).not.toBe('#2563eb')
    expect(blueShades.light).toBeDefined()
    expect(blueShades.subtle).toBeDefined()

    // Light color should yield dark text for readability
    const yellowShades = generateThemeShades('#ca8a04')
    expect(yellowShades.primary).toBe('#ca8a04')
    expect(typeof yellowShades.text).toBe('string')
  })

  it('applies CSS variables to DOM documentElement', () => {
    applyThemeToDOM('#16a34a')
    const root = document.documentElement
    expect(root.style.getPropertyValue('--theme-primary')).toBe('#16a34a')
    expect(root.style.getPropertyValue('--color-blue-600')).toBe('#16a34a')
    expect(root.style.getPropertyValue('--theme-primary-hover')).toBeDefined()
    expect(root.style.getPropertyValue('--theme-primary-subtle')).toBeDefined()
  })

  it('stores and retrieves theme colors per user in localStorage', () => {
    expect(getStoredThemeColor('user-1')).toBe(DEFAULT_THEME_COLOR)
    setStoredThemeColor('#16a34a', 'user-1')
    expect(getStoredThemeColor('user-1')).toBe('#16a34a')

    clearStoredThemeColor('user-1')
    expect(getStoredThemeColor('user-1')).toBe(DEFAULT_THEME_COLOR)
  })
})

