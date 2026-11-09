import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatScreenTime,
  formatLastAccess,
  screenTimeService,
} from './screen-time.service'
import { supabase } from '@app/config/supabase'

vi.mock('@app/config/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}))

describe('screen-time.service', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('formatScreenTime', () => {
    it('formata 0 segundos como 00:00:00', () => {
      expect(formatScreenTime(0)).toBe('00:00:00')
      expect(formatScreenTime(null)).toBe('00:00:00')
      expect(formatScreenTime(undefined)).toBe('00:00:00')
      expect(formatScreenTime(-10)).toBe('00:00:00')
    })

    it('formata 30 minutos (1800 segundos) como 00:30:00', () => {
      expect(formatScreenTime(1800)).toBe('00:30:00')
    })

    it('formata valores arbitrários de horas, minutos e segundos', () => {
      // 45 segundos
      expect(formatScreenTime(45)).toBe('00:00:45')
      // 1 hora, 15 minutos e 20 segundos = 3600 + 900 + 20 = 4520
      expect(formatScreenTime(4520)).toBe('01:15:20')
      // 10 horas
      expect(formatScreenTime(36000)).toBe('10:00:00')
    })
  })

  describe('formatLastAccess', () => {
    it('retorna "Nunca acessou" para datas nulas ou indefinidas', () => {
      expect(formatLastAccess(null)).toBe('Nunca acessou')
      expect(formatLastAccess(undefined)).toBe('Nunca acessou')
      expect(formatLastAccess('')).toBe('Nunca acessou')
      expect(formatLastAccess('data-invalida')).toBe('Nunca acessou')
    })

    it('formata data ISO válida no padrão brasileiro', () => {
      const fixedDate = new Date(2026, 10, 8, 14, 30, 45) // 08/11/2026 14:30:45
      const formatted = formatLastAccess(fixedDate.toISOString())
      expect(formatted).toMatch(/08\/11\/2026 às 14:30:45/)
    })
  })

  describe('recordScreenTime', () => {
    it('salva no cache local do localStorage e chama RPC no Supabase', async () => {
      const mockRpc = vi.fn().mockResolvedValue({ error: null })
      ;(supabase.rpc as any) = mockRpc

      const userId = '11111111-1111-1111-1111-111111111111'
      await screenTimeService.recordScreenTime(userId, 15)

      // Verifica localStorage
      const cached = screenTimeService.getLocalActivity(userId)
      expect(cached?.screenTimeSeconds).toBe(15)
      expect(cached?.lastAccessAt).toBeTruthy()

      // Verifica chamada RPC
      expect(mockRpc).toHaveBeenCalledWith('record_user_screen_time', {
        p_seconds: 15,
        p_user_id: userId,
      })
    })

    it('faz fallback para a tabela profiles quando a RPC falha', async () => {
      const mockRpc = vi.fn().mockResolvedValue({ error: { message: 'function not found' } })
      ;(supabase.rpc as any) = mockRpc

      const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { screen_time_seconds: 10 }, error: null }),
        }),
      })

      ;(supabase.from as any) = vi.fn().mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      })

      const userId = '22222222-2222-2222-2222-222222222222'
      await screenTimeService.recordScreenTime(userId, 30)

      expect(mockRpc).toHaveBeenCalled()
      expect(supabase.from).toHaveBeenCalledWith('profiles')
    })
  })

  describe('getOrganizationMembersActivity', () => {
    it('retorna mapa de atividade dos membros via RPC', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            user_id: 'user-1',
            screen_time_seconds: 1800,
            last_access_at: '2026-11-08T18:00:00.000Z',
          },
          {
            user_id: 'user-2',
            screen_time_seconds: 3600,
            last_access_at: '2026-11-08T19:00:00.000Z',
          },
        ],
        error: null,
      })
      ;(supabase.rpc as any) = mockRpc

      const result = await screenTimeService.getOrganizationMembersActivity('org-1')
      expect(result.get('user-1')?.screenTimeSeconds).toBe(1800)
      expect(result.get('user-2')?.screenTimeSeconds).toBe(3600)
    })
  })
})
