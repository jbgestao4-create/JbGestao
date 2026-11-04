import { describe, it, expect } from 'vitest'
import {
  getStatusLabel,
  getStatusBadgeClasses,
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

  it('deve permitir transição de approved para rejected (cancelamento)', () => {
    expect(isValidStatusTransition('approved', 'rejected')).toBe(true)
  })

  it('deve permitir manter o mesmo status', () => {
    expect(isValidStatusTransition('draft', 'draft')).toBe(true)
    expect(isValidStatusTransition('approved', 'approved')).toBe(true)
  })

  it('permite membros editar Rascunho e Enviado, mas não Aprovado ou Concluído', () => {
    expect(canEditQuote('draft', 'member')).toBe(true)
    expect(canEditQuote('sent', 'member')).toBe(true)
    expect(canEditQuote('approved', 'member')).toBe(false)
    expect(canEditQuote('completed', 'member')).toBe(false)
    expect(canEditQuote('draft', null)).toBe(false)
  })

  it('não permite edição em Aprovado e Concluído nem mesmo por administradores ou donos', () => {
    expect(canEditQuote('approved', 'owner')).toBe(false)
    expect(canEditQuote('approved', 'admin')).toBe(false)
    expect(canEditQuote('completed', 'owner')).toBe(false)
    expect(canEditQuote('completed', 'admin')).toBe(false)
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

  it('deve diferenciar aprovação pelo cliente ou pelo usuário quando especificado', () => {
    expect(getStatusLabel('approved', 'client')).toBe('Aprovado pelo cliente')
    expect(getStatusLabel('approved', 'customer')).toBe('Aprovado pelo cliente')
    expect(getStatusLabel('approved', 'user')).toBe('Aprovado pelo usuário')
  })

  it('deve fornecer classes de badge distintas para aprovado pelo cliente vs usuário', () => {
    const clientClasses = getStatusBadgeClasses('approved', 'client')
    const userClasses = getStatusBadgeClasses('approved', 'user')

    expect(clientClasses).toContain('emerald')
    expect(userClasses).toContain('teal')
    expect(clientClasses).not.toBe(userClasses)
  })
})
