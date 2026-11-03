import { describe, expect, it } from 'vitest'
import { generateQuotePdf } from './quote-pdf'
import type { QuoteDetail } from '../services/quote.service'

describe('quote-pdf', () => {
  it('generates a jsPDF instance with quote details and items', () => {
    const mockQuote: QuoteDetail = {
      id: '00000000-0000-0000-0000-000000000001',
      organizationId: '00000000-0000-0000-0000-000000000002',
      customerId: '00000000-0000-0000-0000-000000000003',
      customerName: 'Cliente Teste VIP',
      customerPhone: '(11) 98888-0000',
      customerEmail: 'cliente@teste.com',
      customerAddress: 'Rua Principal, 100',
      quoteNumber: 'ORC-202611-0042',
      status: 'sent',
      subtotal: '100.00',
      discount: '10.00',
      total: '90.00',
      validUntil: '2026-11-20T00:00:00Z',
      createdAt: '2026-11-03T10:00:00Z',
      updatedAt: '2026-11-03T10:00:00Z',
      notes: 'Pagamento em 3x no cartão.',
      creatorName: 'Vendedor Responsável',
      items: [
        {
          id: '00000000-0000-0000-0000-000000000010',
          description: 'Produto Teste A',
          quantity: '2',
          unitPrice: '50.00',
          total: '100.00',
          sortOrder: 0,
          inventoryItemId: null,
          unit: 'UN',
        },
      ],
    }

    const doc = generateQuotePdf(mockQuote, { organizationName: 'JB Gestão' })
    expect(doc).toBeDefined()
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })
})

