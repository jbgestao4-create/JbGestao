import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supplierService } from './supplier.service'
import { supabase } from '@app/config/supabase'

vi.mock('@app/config/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('supplierService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('deve rejeitar cadastro de fornecedor com CNPJ inválido', async () => {
    const result = await supplierService.create('org-123', {
      name: 'Fornecedor Inválido',
      document: '12.345.678/0001-99', // Dígitos verificadores incorretos
      contactName: 'Contato',
      phone: '31999999999',
      email: 'contato@fornecedor.com',
      address: 'Rua A, 100',
      notes: '',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('CNPJ inválido. Os dígitos verificadores não conferem.')
    }
  })

  it('deve permitir cadastro de fornecedor com CNPJ numérico válido', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'supp-1',
        organization_id: 'org-123',
        name: 'Fornecedor Válido',
        document: '00000000000191',
        contact_name: 'Contato',
        phone: '31999999999',
        email: 'contato@fornecedor.com',
        address: 'Rua A, 100',
        notes: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    })

    const query = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      returns: vi.fn().mockReturnValue({
        single: singleMock,
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(query as never)

    const result = await supplierService.create('org-123', {
      name: 'Fornecedor Válido',
      document: '00.000.000/0001-91',
      contactName: 'Contato',
      phone: '31999999999',
      email: 'contato@fornecedor.com',
      address: 'Rua A, 100',
      notes: '',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Fornecedor Válido')
    }
  })

  it('deve permitir cadastro de fornecedor com CNPJ alfanumérico válido', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'supp-2',
        organization_id: 'org-123',
        name: 'Fornecedor AlfaNum Válido',
        document: '12ABC34501DE35',
        contact_name: 'Contato',
        phone: '31999999999',
        email: 'contato@fornecedor.com',
        address: 'Rua A, 100',
        notes: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    })

    const query = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      returns: vi.fn().mockReturnValue({
        single: singleMock,
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(query as never)

    const result = await supplierService.create('org-123', {
      name: 'Fornecedor AlfaNum Válido',
      document: '12.ABC.345/01DE-35',
      contactName: 'Contato',
      phone: '31999999999',
      email: 'contato@fornecedor.com',
      address: 'Rua A, 100',
      notes: '',
    })

    expect(result.success).toBe(true)
  })

  it('deve rejeitar atualização de fornecedor com CNPJ inválido', async () => {
    const result = await supplierService.update('org-123', 'supp-1', {
      name: 'Fornecedor Editado',
      document: '11.222.333/0001-00', // Inválido
      contactName: 'Contato',
      phone: '31999999999',
      email: 'contato@fornecedor.com',
      address: 'Rua A, 100',
      notes: '',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('CNPJ inválido. Os dígitos verificadores não conferem.')
    }
  })
})
