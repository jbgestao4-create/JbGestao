import { describe, expect, it, vi } from 'vitest'
import { customerPortalService } from './customer-portal.service'
import { supabase } from '@app/config/supabase'

vi.mock('@app/config/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

describe('customerPortalService', () => {
  it('buildPortalUrl builds correct absolute path using origin and token', () => {
    const url = customerPortalService.buildPortalUrl('test-token-123')
    expect(url).toContain('/portal/orcamentos/test-token-123')
  })

  it('generateToken calls supabase rpc generate_customer_portal_token and returns data on success', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true, token: 'token-abc', has_document: true },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as any)

    const res = await customerPortalService.generateToken('org-1', 'cust-1', 'quote-1')
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.token).toBe('token-abc')
      expect(res.data.hasDocument).toBe(true)
    }
  })

  it('getPublicInfo returns public details when token is valid', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        found: true,
        organization_name: 'Minha Empresa',
        organization_phone: '11999999999',
        customer_name: 'João Silva',
        customer_first_name: 'João',
        has_document: true,
        masked_document: '***.***.123-**',
        quote_number: 'ORC-001',
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as any)

    const res = await customerPortalService.getPublicInfo('valid-token')
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.organizationName).toBe('Minha Empresa')
      expect(res.data.customerFirstName).toBe('João')
      expect(res.data.maskedDocument).toBe('***.***.123-**')
    }
  })

  it('accessQuotes returns quotes and customer info when cpf matches', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        success: true,
        customer: { id: 'cust-1', name: 'João Silva' },
        organization: { id: 'org-1', name: 'Minha Empresa' },
        highlightedQuoteId: 'quote-1',
        quotes: [
          {
            id: 'quote-1',
            quoteNumber: 'ORC-001',
            status: 'sent',
            subtotal: '100.00',
            discount: '0.00',
            total: '100.00',
            items: [],
          },
        ],
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as any)

    const res = await customerPortalService.accessQuotes('valid-token', '12345678901')
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.quotes).toHaveLength(1)
      expect(res.data.quotes[0].quoteNumber).toBe('ORC-001')
      expect(res.data.customer.name).toBe('João Silva')
    }
  })

  it('accessQuotes returns error when document mismatch occurs', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        success: false,
        error: 'DOCUMENT_MISMATCH',
        message: 'O CPF/CNPJ informado não coincide.',
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as any)

    const res = await customerPortalService.accessQuotes('valid-token', '00000000000')
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error).toContain('não coincide')
    }
  })

  it('approveQuote calls approve_customer_portal_quote rpc and returns success', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        success: true,
        message: 'Orçamento aprovado com sucesso!',
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as any)

    const res = await customerPortalService.approveQuote('valid-token', 'quote-123')
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.message).toBe('Orçamento aprovado com sucesso!')
    }
  })

  it('approveQuote returns error message on rpc failure', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        success: false,
        error: 'QUOTE_ALREADY_COMPLETED',
        message: 'Este orçamento já foi concluído.',
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as any)

    const res = await customerPortalService.approveQuote('valid-token', 'quote-123')
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error).toBe('Este orçamento já foi concluído.')
    }
  })

  it('rejectQuote calls reject_customer_portal_quote rpc and returns success', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        success: true,
        message: 'Orçamento recusado com sucesso.',
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as any)

    const res = await customerPortalService.rejectQuote('valid-token', 'quote-123')
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.message).toBe('Orçamento recusado com sucesso.')
    }
  })

  it('rejectQuote returns error message on rpc failure', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        success: false,
        error: 'QUOTE_ALREADY_APPROVED',
        message: 'Este orçamento já foi aprovado e não pode ser recusado pelo portal.',
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as any)

    const res = await customerPortalService.rejectQuote('valid-token', 'quote-123')
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error).toBe('Este orçamento já foi aprovado e não pode ser recusado pelo portal.')
    }
  })
})
