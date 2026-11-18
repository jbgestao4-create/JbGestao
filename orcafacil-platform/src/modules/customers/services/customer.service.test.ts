import { describe, expect, it, vi, beforeEach } from 'vitest'
import { customerService } from './customer.service'
import { supabase } from '@app/config/supabase'
import { CPF_INVALID_ERROR, CNPJ_INVALID_ERROR } from './document-validator.service'

vi.mock('@app/config/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('customerService backend validation', () => {
  const fakeOrgId = '00000000-0000-0000-0000-000000000001'
  const fakeCustomerId = '00000000-0000-0000-0000-000000000002'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('bloqueia cadastro com CPF de dígitos verificadores incorretos sem chamar a API do Supabase', async () => {
      const result = await customerService.create(fakeOrgId, {
        name: 'Cliente Teste',
        personType: 'individual',
        document: '529.982.247-95', // Primeiro DV incorreto (deveria ser 2)
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(CPF_INVALID_ERROR)
      }
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('bloqueia cadastro com CPF de todos os dígitos repetidos', async () => {
      const result = await customerService.create(fakeOrgId, {
        name: 'Cliente Teste',
        personType: 'individual',
        document: '111.111.111-11',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(CPF_INVALID_ERROR)
      }
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('bloqueia cadastro com CNPJ numérico de dígitos verificadores incorretos', async () => {
      const result = await customerService.create(fakeOrgId, {
        name: 'Empresa Teste',
        personType: 'company',
        document: '00.000.000/0001-31', // DV1 incorreto (deveria ser 9)
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(CNPJ_INVALID_ERROR)
      }
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('bloqueia cadastro com CNPJ alfanumérico de dígitos verificadores incorretos', async () => {
      const result = await customerService.create(fakeOrgId, {
        name: 'Empresa Alfanumérica',
        personType: 'company',
        document: '12.ABC.345/01DE-99', // DVs incorretos (deveria ser 35)
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(CNPJ_INVALID_ERROR)
      }
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('permite cadastro com CPF válido e grava documento devidamente sanitizado', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: fakeCustomerId,
              organization_id: fakeOrgId,
              name: 'Cliente Válido',
              person_type: 'individual',
              document: '52998224725',
              phone: null,
              email: null,
              address: null,
              postal_code: null,
              address_number: null,
              notes: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await customerService.create(fakeOrgId, {
        name: 'Cliente Válido',
        personType: 'individual',
        document: '529.982.247-25',
      })

      expect(result.success).toBe(true)
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: fakeOrgId,
          name: 'Cliente Válido',
          person_type: 'individual',
          document: '52998224725',
        }),
      )
    })

    it('permite cadastro com CNPJ alfanumérico válido preservando letras e zeros à esquerda', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: fakeCustomerId,
              organization_id: fakeOrgId,
              name: 'Empresa Alfa Válida',
              person_type: 'company',
              document: '00ABC000000145',
              phone: null,
              email: null,
              address: null,
              postal_code: null,
              address_number: null,
              notes: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await customerService.create(fakeOrgId, {
        name: 'Empresa Alfa Válida',
        personType: 'company',
        document: '00.ABC.000/0001-45',
      })

      expect(result.success).toBe(true)
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: fakeOrgId,
          person_type: 'company',
          document: '00ABC000000145',
        }),
      )
    })
  })

  describe('update', () => {
    it('bloqueia atualização com CPF inválido sem disparar update no banco', async () => {
      const result = await customerService.update(fakeOrgId, fakeCustomerId, {
        personType: 'individual',
        document: '529.982.247-00', // Inválido
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(CPF_INVALID_ERROR)
      }
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('bloqueia atualização com CNPJ alfanumérico inválido', async () => {
      const result = await customerService.update(fakeOrgId, fakeCustomerId, {
        personType: 'company',
        document: '12.ABC.345/01DE-00', // Inválido
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(CNPJ_INVALID_ERROR)
      }
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('permite atualização com CNPJ alfanumérico válido e sanitiza documento', async () => {
      const mockEq2 = vi.fn().mockResolvedValue({ error: null })
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await customerService.update(fakeOrgId, fakeCustomerId, {
        personType: 'company',
        document: '12.ABC.345/01DE-35',
      })

      expect(result.success).toBe(true)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          document: '12ABC34501DE35',
        }),
      )
    })
  })
})
