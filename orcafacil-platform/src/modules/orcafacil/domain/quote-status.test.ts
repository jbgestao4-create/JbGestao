import { describe, it, expect } from 'vitest'
import {
  getStatusLabel,
  canEditQuote,
  isQuotePrintable,
  isValidStatusTransition,
} from './quote-status'

describe('Quote Status FSM', () => {
  it('deve permitir transição válida de draft para sent', () => {
    expect(isValidStatusTransition('draft', 'sent')).toBe(true)
  })

  it('deve permitir transição de sent para approved ou rejected', () => {
    expect(isValidStatusTransition('sent', 'approved')).toBe(true)
    expect(isValidStatusTransition('sent', 'rejected')).toBe(true)
    expect(isValidStatusTransition('sent', 'expired')).toBe(true)
  })

  it('deve permitir concluir um orçamento aprovado sem retornar para rascunho', () => {
    expect(isValidStatusTransition('approved', 'completed')).toBe(true)
    expect(isValidStatusTransition('approved', 'draft')).toBe(false)
    expect(isValidStatusTransition('completed', 'approved')).toBe(false)
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

  it('permite membros editar Rascunho, Enviado e Aprovado', () => {
    expect(canEditQuote('draft', 'member')).toBe(true)
    expect(canEditQuote('sent', 'member')).toBe(true)
    expect(canEditQuote('approved', 'member')).toBe(true)
    expect(canEditQuote('draft', null)).toBe(false)
  })

  it('permite somente proprietários e administradores editar estados finais', () => {
    for (const status of ['completed', 'rejected', 'expired'] as const) {
      expect(canEditQuote(status, 'owner')).toBe(true)
      expect(canEditQuote(status, 'admin')).toBe(true)
      expect(canEditQuote(status, 'member')).toBe(false)
      expect(canEditQuote(status, null)).toBe(false)
    }
  })

  it('deve permitir imprimir comprovantes de orçamentos enviados, aprovados e concluídos', () => {
    expect(isQuotePrintable('sent')).toBe(true)
    expect(isQuotePrintable('approved')).toBe(true)
    expect(isQuotePrintable('completed')).toBe(true)
    expect(isQuotePrintable('draft')).toBe(false)
    expect(isQuotePrintable('rejected')).toBe(false)
    expect(isQuotePrintable('expired')).toBe(false)
  })

  it('deve fornecer rótulos em português', () => {
    expect(getStatusLabel('draft')).toBe('Rascunho')
    expect(getStatusLabel('sent')).toBe('Enviado')
    expect(getStatusLabel('approved')).toBe('Aprovado')
    expect(getStatusLabel('completed')).toBe('Concluído')
    expect(getStatusLabel('rejected')).toBe('Recusado')
    expect(getStatusLabel('expired')).toBe('Expirado')
  })
})
