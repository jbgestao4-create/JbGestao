import { beforeEach, describe, expect, it, vi } from 'vitest'

const { signInWithPassword, rpc, refreshSession, from } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  rpc: vi.fn(),
  refreshSession: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@app/config/supabase', () => ({
  supabase: {
    auth: { signInWithPassword, refreshSession },
    rpc,
    from,
  },
}))

vi.mock('@shared/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}))

import { authService } from './auth.service'

describe('authService', () => {
  beforeEach(() => {
    signInWithPassword.mockReset()
    rpc.mockReset()
    refreshSession.mockReset()
  })

  it('signIn reports connection failures instead of incorrect credentials', async () => {
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

  it('updates the password through the forced-change RPC and refreshes the session', async () => {
    rpc.mockResolvedValue({ error: null })
    refreshSession.mockResolvedValue({ error: null })

    const result = await authService.completeForcedPasswordChange('senha-nova-segura')

    expect(result).toEqual({ success: true, data: undefined })
    expect(rpc).toHaveBeenCalledWith('complete_forced_password_change', {
      p_new_password: 'senha-nova-segura',
    })
    expect(refreshSession).toHaveBeenCalledOnce()
  })

  it('does not allow the temporary password as the forced replacement', async () => {
    const result = await authService.completeForcedPasswordChange('12345678')

    expect(result).toEqual({
      success: false,
      error: 'A nova senha não pode ser igual à senha temporária 12345678.',
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('updates theme color preference in user profile', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    from.mockReturnValue({ update: updateMock })

    const result = await authService.updateThemeColor('user-uuid', '#16a34a')

    expect(result).toEqual({ success: true, data: undefined })
    expect(from).toHaveBeenCalledWith('profiles')
    expect(updateMock).toHaveBeenCalledWith({ theme_color: '#16a34a' })
    expect(eqMock).toHaveBeenCalledWith('id', 'user-uuid')
  })
})
