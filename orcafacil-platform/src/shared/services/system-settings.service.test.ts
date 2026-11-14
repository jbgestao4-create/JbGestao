import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  systemSettingsService,
  DEFAULT_INACTIVITY_MINUTES,
} from './system-settings.service'

vi.mock('@app/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          key: 'inactivity_timeout',
          value: { timeout_minutes: 5 },
          updated_at: '2026-11-13T22:00:00Z',
        },
        error: null,
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}))

describe('systemSettingsService', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('deve retornar o tempo padrão de 2 minutos quando não houver valor no localStorage', () => {
    const mins = systemSettingsService.getLocalInactivityTimeoutMinutes()
    expect(mins).toBe(DEFAULT_INACTIVITY_MINUTES)
  })

  it('deve salvar e retornar tempo de inatividade no localStorage e propagar evento', async () => {
    let eventReceived = false
    const handler = (e: any) => {
      if (e.detail?.timeoutMinutes === 10) {
        eventReceived = true
      }
    }
    window.addEventListener('inactivity-timeout-changed', handler)

    const res = await systemSettingsService.setInactivityTimeoutMinutes(10, 'user-123')
    expect(res.success).toBe(true)
    if (!res.success) return

    expect(res.data.timeoutMinutes).toBe(10)
    expect(systemSettingsService.getLocalInactivityTimeoutMinutes()).toBe(10)
    expect(eventReceived).toBe(true)

    window.removeEventListener('inactivity-timeout-changed', handler)
  })

  it('deve limitar valores inválidos entre 1 e 480 minutos', async () => {
    const resLow = await systemSettingsService.setInactivityTimeoutMinutes(-5)
    expect(resLow.success).toBe(true)
    if (resLow.success) {
      expect(resLow.data.timeoutMinutes).toBe(1)
    }

    const resHigh = await systemSettingsService.setInactivityTimeoutMinutes(9999)
    expect(resHigh.success).toBe(true)
    if (resHigh.success) {
      expect(resHigh.data.timeoutMinutes).toBe(480)
    }
  })

  it('deve buscar configurações remotas do Supabase e sincronizar localmente', async () => {
    const res = await systemSettingsService.getInactivitySettings()
    expect(res.success).toBe(true)
    if (!res.success) return

    expect(res.data.timeoutMinutes).toBe(5)
    expect(systemSettingsService.getLocalInactivityTimeoutMinutes()).toBe(5)
  })
})
