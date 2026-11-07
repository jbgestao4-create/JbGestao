/**
 * Utilitários para gestão centralizada de temas e cores dinâmicas no sistema JB Software.
 */

export interface ThemeColorPreset {
  id: string
  name: string
  hex: string
}

export const DEFAULT_THEME_COLOR = '#2563eb' // Azul padrão original do sistema

export const PRESET_THEME_COLORS: ThemeColorPreset[] = [
  { id: 'blue', name: 'Azul (Padrão)', hex: '#2563eb' },
  { id: 'green', name: 'Verde', hex: '#16a34a' },
  { id: 'teal', name: 'Verde-água', hex: '#0d9488' },
  { id: 'violet', name: 'Roxo', hex: '#7c3aed' },
  { id: 'purple', name: 'Violeta', hex: '#9333ea' },
  { id: 'red', name: 'Vermelho', hex: '#dc2626' },
  { id: 'orange', name: 'Laranja', hex: '#ea580c' },
  { id: 'yellow', name: 'Amarelo', hex: '#ca8a04' },
  { id: 'pink', name: 'Rosa', hex: '#db2777' },
  { id: 'gray', name: 'Cinza', hex: '#4b5563' },
  { id: 'black', name: 'Preto', hex: '#18181b' },
]

export interface ThemeShades {
  primary: string
  hover: string
  active: string
  light: string
  subtle: string
  border: string
  text: string
  darkBg: string
  darkText: string
}

const STORAGE_KEY_PREFIX = 'jb-theme-color:'

/**
 * Normaliza e valida um código hexadecimal de cor.
 */
export function normalizeHexColor(hex: string): string {
  let cleaned = hex.trim().replace(/^#/, '')
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (!/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
    return DEFAULT_THEME_COLOR
  }
  return `#${cleaned.toLowerCase()}`
}

/**
 * Converte hex para RGB.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex).replace('#', '')
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return { r, g, b }
}

/**
 * Converte RGB para HSL.
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255

  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)
        break
      case gNorm:
        h = (bNorm - rNorm) / d + 2
        break
      case bNorm:
        h = (rNorm - gNorm) / d + 4
        break
    }
    h /= 6
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  }
}

/**
 * Converte HSL para Hexadecimal.
 */
export function hslToHex(h: number, s: number, l: number): string {
  const hNorm = h / 360
  const sNorm = s / 100
  const lNorm = l / 100

  if (sNorm === 0) {
    const val = Math.round(lNorm * 255)
      .toString(16)
      .padStart(2, '0')
    return `#${val}${val}${val}`
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tNorm = t
    if (tNorm < 0) tNorm += 1
    if (tNorm > 1) tNorm -= 1
    if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm
    if (tNorm < 1 / 2) return q
    if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6
    return p
  }

  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm
  const p = 2 * lNorm - q

  const r = Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255)
  const g = Math.round(hue2rgb(p, q, hNorm) * 255)
  const b = Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Calcula a luminância relativa (WCAG 2.1)
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const cNorm = c / 255
    return cNorm <= 0.03928 ? cNorm / 12.92 : Math.pow((cNorm + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Gera a paleta de variações tonais a partir de uma cor primária.
 */
export function generateThemeShades(hex: string): ThemeShades {
  const primary = normalizeHexColor(hex)
  const rgb = hexToRgb(primary)
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const luminance = getRelativeLuminance(rgb.r, rgb.g, rgb.b)

  // Hover e Active: ligeiramente mais escuros para dar feedback ao clique
  const hoverLightness = Math.max(12, hsl.l - 8)
  const activeLightness = Math.max(8, hsl.l - 16)
  const hover = hslToHex(hsl.h, hsl.s, hoverLightness)
  const active = hslToHex(hsl.h, hsl.s, activeLightness)

  // Light (50-tint): fundo muito sutil para badges e cards
  const lightSat = Math.min(hsl.s, 45)
  const light = hslToHex(hsl.h, lightSat, 97)

  // Subtle (100-tint): fundo lateral/sidebar leve
  const subtleSat = Math.min(hsl.s, 40)
  const subtle = hslToHex(hsl.h, subtleSat, 94)

  // Border (200-tint): bordas destacadas e sutis
  const borderSat = Math.min(hsl.s, 50)
  const border = hslToHex(hsl.h, borderSat, 85)

  // Texto em cima do botão: branco ou quase preto garantindo contraste de leitura
  const text = luminance > 0.55 ? '#0f172a' : '#ffffff'

  // Dark mode adaptações
  const darkBg = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`
  const darkText = hslToHex(hsl.h, Math.min(hsl.s, 80), 78)

  return {
    primary,
    hover,
    active,
    light,
    subtle,
    border,
    text,
    darkBg,
    darkText,
  }
}

/**
 * Aplica os tokens e variáveis CSS dinamicamente no elemento raiz do documento.
 */
export function applyThemeToDOM(colorHex: string): void {
  if (typeof document === 'undefined') return
  const shades = generateThemeShades(colorHex)
  const root = document.documentElement

  // Variáveis centrais de tema
  root.style.setProperty('--theme-primary', shades.primary)
  root.style.setProperty('--theme-primary-hover', shades.hover)
  root.style.setProperty('--theme-primary-active', shades.active)
  root.style.setProperty('--theme-primary-light', shades.light)
  root.style.setProperty('--theme-primary-subtle', shades.subtle)
  root.style.setProperty('--theme-primary-border', shades.border)
  root.style.setProperty('--theme-primary-text', shades.text)
  root.style.setProperty('--theme-primary-dark-bg', shades.darkBg)
  root.style.setProperty('--theme-primary-dark-text', shades.darkText)

  // Sobrescreve as variáveis do Tailwind v4 para propagar automaticamente
  // em todos os componentes, botões e telas que utilizam utilitários Tailwind blue-*
  root.style.setProperty('--color-blue-50', shades.light)
  root.style.setProperty('--color-blue-100', shades.subtle)
  root.style.setProperty('--color-blue-200', shades.border)
  root.style.setProperty('--color-blue-500', shades.primary)
  root.style.setProperty('--color-blue-600', shades.primary)
  root.style.setProperty('--color-blue-700', shades.hover)
  root.style.setProperty('--color-blue-800', shades.active)

  // Cores do sky utilizadas no sidebar e headers
  root.style.setProperty('--color-sky-50', shades.light)
  root.style.setProperty('--color-sky-100', shades.subtle)
  root.style.setProperty('--color-sky-200', shades.border)
}

/**
 * Remove os overrides e restaura as variáveis para o padrão azul do sistema.
 */
export function resetThemeInDOM(): void {
  applyThemeToDOM(DEFAULT_THEME_COLOR)
}

/**
 * Lê a preferência salva em localStorage para carregamento rápido e sem flash.
 */
export function getStoredThemeColor(userId?: string | null): string {
  if (typeof window === 'undefined') return DEFAULT_THEME_COLOR
  const key = userId ? `${STORAGE_KEY_PREFIX}${userId}` : `${STORAGE_KEY_PREFIX}global`
  const stored = localStorage.getItem(key) || localStorage.getItem(`${STORAGE_KEY_PREFIX}global`)
  if (stored) {
    return normalizeHexColor(stored)
  }
  return DEFAULT_THEME_COLOR
}

/**
 * Grava a preferência no localStorage.
 */
export function setStoredThemeColor(color: string, userId?: string | null): void {
  if (typeof window === 'undefined') return
  const normalized = normalizeHexColor(color)
  if (userId) {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, normalized)
  }
  localStorage.setItem(`${STORAGE_KEY_PREFIX}global`, normalized)
}

/**
 * Limpa a preferência do localStorage.
 */
export function clearStoredThemeColor(userId?: string | null): void {
  if (typeof window === 'undefined') return
  if (userId) {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${userId}`)
  }
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}global`)
}
