import { beforeEach, describe, expect, it, vi } from 'vitest'

const { signInWithPassword } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
}))

vi.mock('@app/config/supabase', () => ({
  supabase: {
    auth: { signInWithPassword },
  },
}))

vi.mock('@shared/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}))

import { authService } from './auth.service'

describe('authService.signIn', () => {
  beforeEach(() => {
    signInWithPassword.mockReset()
  })

  it('reports connection failures instead of incorrect credentials', async () => {
    signInWithPassword.mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await authService.signIn({
      email: 'user@example.com',
      password: 'password',
    })

    expect(result).toEqual({
      success: false,
      error:
        'Não foi possível conectar ao serviço de autenticação. Verifique a URL do Supabase e sua conexão com a internet.',
    })
  })
})
