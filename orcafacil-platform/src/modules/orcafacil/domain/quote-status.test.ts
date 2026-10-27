import { describe, it, expect } from 'vitest'
import { isValidStatusTransition, getStatusLabel } from './quote-status'

describe('Quote Status FSM', () => {
  it('deve permitir transição válida de draft para sent', () => {
    expect(isValidStatusTransition('draft', 'sent')).toBe(true)
  })

  it('deve permitir transição de sent para approved ou rejected', () => {
    expect(isValidStatusTransition('sent', 'approved')).toBe(true)
    expect(isValidStatusTransition('sent', 'rejected')).toBe(true)
    expect(isValidStatusTransition('sent', 'expired')).toBe(true)
  })

  it('deve rejeitar transições ilegais como draft direto para approved', () => {
    expect(isValidStatusTransition('draft', 'approved')).toBe(false)
  })

  it('deve rejeitar transição direta de approved para rejected', () => {
    expect(isValidStatusTransition('approved', 'rejected')).toBe(false)
  })

  it('deve permitir manter o mesmo status', () => {
    expect(isValidStatusTransition('draft', 'draft')).toBe(true)
    expect(isValidStatusTransition('approved', 'approved')).toBe(true)
  })

  it('deve fornecer rótulos em português', () => {
    expect(getStatusLabel('draft')).toBe('Rascunho')
    expect(getStatusLabel('sent')).toBe('Enviado')
    expect(getStatusLabel('approved')).toBe('Aprovado')
    expect(getStatusLabel('rejected')).toBe('Recusado')
    expect(getStatusLabel('expired')).toBe('Expirado')
  })
})

