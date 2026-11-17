import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mercadopagoService } from './mercadopago.service'
import { supabase } from '@app/config/supabase'

vi.mock('@app/config/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test-tx-uuid' },
            error: null,
          }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn().mockResolvedValue('ok'),
  },
}))

describe('mercadopagoService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('deve carregar configurações padrão quando a tabela remota estiver vazia', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'RPC not found' },
    } as any)

    const res = await mercadopagoService.getSettings()
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.isSandbox).toBe(true)
      expect(res.data.licenseDurationDays).toBe(30)
      expect(res.data.autoActivateLicense).toBe(true)
    }
  })

  it('deve retornar erro ao tentar gerar PIX se nenhum token estiver configurado', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        access_token: '',
        is_sandbox: true,
        license_duration_days: 30,
      },
      error: null,
    } as any)

    const res = await mercadopagoService.createPixPayment({
      organizationId: '00000000-0000-0000-0000-000000000001',
      amount: 99.9,
      payerName: 'Cliente Teste',
      payerEmail: 'cliente@teste.com',
    })

    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error).toContain('Access Token')
    }
  })

  it('deve chamar rpc de simulação de aprovação com sucesso', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true, message: 'Aprovado com sucesso!' },
      error: null,
    } as any)

    const res = await mercadopagoService.simulateApproval('00000000-0000-0000-0000-000000000002')
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.success).toBe(true)
    }
  })
})
