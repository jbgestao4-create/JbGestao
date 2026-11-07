import { describe, expect, it } from 'vitest'
import {
  getSuggestionModuleLabel,
  getSuggestionStatusTone,
  formatUnreadSuggestionCount,
  validateSuggestionImage,
} from './suggestion.utils'

describe('suggestion utilities', () => {
  it('identifies the module for common application routes', () => {
    expect(getSuggestionModuleLabel('/orcafacil/inventory/new')).toBe('Estoque')
    expect(getSuggestionModuleLabel('/service-orders')).toBe('Ordens de Serviço')
    expect(getSuggestionModuleLabel('/')).toBe('Página inicial')
  })

  it('validates attachment format and size', () => {
    expect(validateSuggestionImage(new File(['image'], 'image.png', { type: 'image/png' }))).toBeNull()
    expect(validateSuggestionImage(new File(['image'], 'image.gif', { type: 'image/gif' }))).toContain('JPG')
    expect(
      validateSuggestionImage(
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
      ),
    ).toContain('5 MB')
  })

  it('assigns a distinct visual tone to each workflow category', () => {
    expect(getSuggestionStatusTone('received')).toContain('sky')
    expect(getSuggestionStatusTone('completed')).toContain('emerald')
    expect(getSuggestionStatusTone('rejected')).toContain('rose')
  })

  it('formats the unread badge count without allowing it to grow excessively', () => {
    expect(formatUnreadSuggestionCount(1)).toBe('1')
    expect(formatUnreadSuggestionCount(99)).toBe('99')
    expect(formatUnreadSuggestionCount(100)).toBe('99+')
  })
})
