import { describe, expect, it, vi } from 'vitest'
import { buildQuoteWhatsAppMessage, openQuoteWhatsApp } from './quote-whatsapp'

describe('quote-whatsapp', () => {
  it('builds clean message without itemizing products, stating quote is completed and available in PDF', () => {
    const msg = buildQuoteWhatsAppMessage(
      {
        customerName: 'Maria Silva',
        quoteNumber: 'ORC-202611-0001',
        createdAt: '2026-11-03T12:00:00Z',
        validUntil: '2026-11-10T12:00:00Z',
        subtotal: '250.00',
        discount: '20.00',
        total: '230.00',
        notes: 'Entregar na sede da empresa.',
      },
      'Empresa Teste',
    )

    // Notifica conclusão e disponibilidade no PDF
    expect(msg).toContain('Maria Silva')
    expect(msg).toContain('concluído com sucesso e está disponível no PDF enviado')
    expect(msg).toContain('#ORC-202611-0001')
    expect(msg).toContain('R$')
    expect(msg).toContain('230,00')
    expect(msg).toContain('Empresa Teste')
    expect(msg).toContain('PDF completo com o detalhamento dos itens')

    // Garante que não há enumeração de itens descritos linha a linha em texto
    expect(msg).not.toContain('ITENS INCLUÍDOS')
    expect(msg).not.toContain('1.')
  })

  it('includes portal url in message when provided', () => {
    const msg = buildQuoteWhatsAppMessage(
      {
        customerName: 'Carlos Santos',
        quoteNumber: 'ORC-202611-0002',
        createdAt: '2026-11-04T10:00:00Z',
        validUntil: null,
        subtotal: '100.00',
        discount: '0.00',
        total: '100.00',
      },
      'JB Software',
      'https://jbgestao.com/portal/orcamentos/abc123xyz',
    )

    expect(msg).toContain('PORTAL DE ORÇAMENTOS')
    expect(msg).toContain('https://jbgestao.com/portal/orcamentos/abc123xyz')
    expect(msg).toContain('confirme seu CPF ao acessar o link')
  })

  it('formats openQuoteWhatsApp target url with country code 55', () => {
    let capturedUrl = ''
    const spy = vi.spyOn(window, 'open').mockImplementation((url: string | URL | undefined) => {
      capturedUrl = String(url)
      return null
    })

    try {
      const result = openQuoteWhatsApp('(11) 98765-4321', 'Olá')
      expect(result).toBe(true)
      expect(capturedUrl).toContain('https://wa.me/5511987654321?text=Ol%C3%A1')
    } finally {
      spy.mockRestore()
    }
  })
})
