import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  emailPasswordResetService,
  maskEmail,
} from './email-password-reset.service'

vi.mock('@app/config/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

describe('emailPasswordResetService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maskEmail oculta os caracteres intermediários do e-mail para exibição segura', () => {
    expect(maskEmail('carlos@empresa.com')).toBe('ca***s@empresa.com')
    expect(maskEmail('a@b.com')).toBe('a***@b.com')
  })

  it('requestResetCode rejeita e-mail inválido', async () => {
    const res = await emailPasswordResetService.requestResetCode('email-invalido')
    expect(res.success).toBe(false)
  })

  it('requestResetCode solicita reset para o e-mail via Supabase Auth', async () => {
    const { supabase } = await import('@app/config/supabase')
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
      data: {} as any,
      error: null,
    })

    const res = await emailPasswordResetService.requestResetCode('carlos@empresa.com')
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.email).toBe('carlos@empresa.com')
      expect(res.data.maskedEmail).toBe('ca***s@empresa.com')
    }
  })

  it('verifyResetCode valida código OTP com sucesso', async () => {
    const { supabase } = await import('@app/config/supabase')
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValueOnce({
      data: { session: {} as any, user: {} as any },
      error: null,
    })

    const res = await emailPasswordResetService.verifyResetCode('carlos@empresa.com', '123456')
    expect(res.success).toBe(true)
  })

  it('completePasswordReset exige requisitos de senha forte', async () => {
    const res = await emailPasswordResetService.completePasswordReset('fraca')
    expect(res.success).toBe(false)
  })

  it('completePasswordReset atualiza senha quando atende requisitos', async () => {
    const { supabase } = await import('@app/config/supabase')
    vi.mocked(supabase.auth.updateUser).mockResolvedValueOnce({
      data: { user: {} as any },
      error: null,
    })
    vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({ error: null })

    const res = await emailPasswordResetService.completePasswordReset('NovaSenha@2026')
    expect(res.success).toBe(true)
  })
})
