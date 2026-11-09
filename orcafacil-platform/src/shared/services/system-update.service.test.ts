import { describe, it, expect, vi, beforeEach } from 'vitest'
import { systemUpdateService } from './system-update.service'

vi.mock('@app/config/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
  },
}))

describe('systemUpdateService', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('retorna a versão padrão v1.0 quando não há atualizações ou cache', async () => {
    const { supabase } = await import('@app/config/supabase')
    const queryMock: any = {}
    queryMock.select = vi.fn().mockReturnValue(queryMock)
    queryMock.not = vi.fn().mockReturnValue(queryMock)
    queryMock.neq = vi.fn().mockReturnValue(queryMock)
    queryMock.order = vi.fn().mockReturnValue(queryMock)
    queryMock.limit = vi.fn().mockReturnValue(queryMock)
    queryMock.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })

    vi.mocked(supabase.from).mockReturnValueOnce(queryMock)

    const version = await systemUpdateService.getLatestVersion()
    expect(version).toBe('v1.0')
  })

  it('notifica e atualiza o localStorage via notifyVersionChange', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    systemUpdateService.notifyVersionChange('v2.5.0')

    expect(localStorage.getItem('jb_system_latest_version')).toBe('v2.5.0')
    expect(dispatchSpy).toHaveBeenCalled()
    const callArg = dispatchSpy.mock.calls[0][0] as CustomEvent
    expect(callArg.type).toBe('system-version-changed')
    expect(callArg.detail).toEqual({ version: 'v2.5.0' })
  })

  it('usa o cache do localStorage caso o Supabase falhe', async () => {
    localStorage.setItem('jb_system_latest_version', 'v2.4.0')
    const { supabase } = await import('@app/config/supabase')
    const queryMock: any = {}
    queryMock.select = vi.fn().mockReturnValue(queryMock)
    queryMock.not = vi.fn().mockReturnValue(queryMock)
    queryMock.neq = vi.fn().mockReturnValue(queryMock)
    queryMock.order = vi.fn().mockReturnValue(queryMock)
    queryMock.limit = vi.fn().mockReturnValue(queryMock)
    queryMock.maybeSingle = vi.fn().mockRejectedValue(new Error('Network error'))

    vi.mocked(supabase.from).mockReturnValueOnce(queryMock)

    const version = await systemUpdateService.getLatestVersion()
    expect(version).toBe('v2.4.0')
  })

  it('formata versões com prefixo v quando informadas como número puro', () => {
    systemUpdateService.notifyVersionChange('1.0')
    expect(localStorage.getItem('jb_system_latest_version')).toBe('v1.0')

    systemUpdateService.notifyVersionChange('v2.1.0')
    expect(localStorage.getItem('jb_system_latest_version')).toBe('v2.1.0')
  })
})
