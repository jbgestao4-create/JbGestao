import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('@app/config/supabase', () => ({
  supabase: { rpc },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

vi.mock('@app/config/env', () => ({
  env: { supabase: { url: 'https://example.supabase.co', anonKey: 'test-key' } },
}))

vi.mock('@shared/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('@modules/access-control/services/module-access.service', () => ({
  DASHBOARD_MODULES: [],
}))

import { organizationService } from './organization.service'

describe('organizationService.resetMemberPassword', () => {
  beforeEach(() => {
    rpc.mockReset()
  })

  it('calls the organization-scoped password reset RPC', async () => {
    rpc.mockResolvedValue({ error: null })

    const result = await organizationService.resetMemberPassword('org-1', 'user-2')

    expect(result).toEqual({ success: true, data: undefined })
    expect(rpc).toHaveBeenCalledWith('reset_organization_member_password', {
      p_org_id: 'org-1',
      p_user_id: 'user-2',
    })
  })

  it('returns the database error when the reset is rejected', async () => {
    rpc.mockResolvedValue({ error: { message: 'Apenas administradores desta organização podem redefinir senhas.' } })

    const result = await organizationService.resetMemberPassword('org-1', 'user-2')

    expect(result).toEqual({
      success: false,
      error: 'Apenas administradores desta organização podem redefinir senhas.',
    })
  })
})
