import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  companyManagementService,
  ALL_PLATFORM_DASHBOARD_MODULES,
} from './company-management.service'
import { supabase } from '@app/config/supabase'

vi.mock('@app/config/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}))

describe('companyManagementService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('deve listar todas as empresas usando a RPC admin_get_all_organizations', async () => {
    const mockCompanies = [
      {
        id: 'org-1',
        name: 'Empresa Alfa',
        slug: 'empresa-alfa',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        admin_email: 'admin@alfa.com',
        admin_name: 'Carlos Alfa',
        members_count: 3,
        modules: ['MOD-01', 'MOD-02'],
      },
      {
        id: 'org-2',
        name: 'Empresa Beta',
        slug: 'empresa-beta',
        is_active: false,
        created_at: '2026-01-02T00:00:00Z',
        admin_email: 'admin@beta.com',
        admin_name: 'Marcos Beta',
        members_count: 1,
        modules: ['MOD-03'],
      },
    ]

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: mockCompanies,
      error: null,
    } as any)

    const result = await companyManagementService.listAll()

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(2)
      expect(result.data[0].name).toBe('Empresa Alfa')
      expect(result.data[0].isActive).toBe(true)
      expect(result.data[1].isActive).toBe(false)
      expect(result.data[0].slug).toBe('empresa-alfa')
    }
  })

  it('deve alternar o status de ativação da empresa e salvar em storage', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    } as any)

    const res = await companyManagementService.setCompanyActive('org-123', false)
    expect(res.success).toBe(true)
    expect(localStorage.getItem('jb_company_status_org-123')).toBe('false')

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    } as any)

    const resActive = await companyManagementService.setCompanyActive('org-123', true)
    expect(resActive.success).toBe(true)
    expect(localStorage.getItem('jb_company_status_org-123')).toBe('true')
  })

  it('deve atualizar os módulos permitidos da empresa', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    } as any)

    const res = await companyManagementService.updateCompanyModules('org-123', [
      'MOD-01',
      'MOD-04',
      'MOD-05',
    ])

    expect(res.success).toBe(true)
    const stored = localStorage.getItem('jb_company_modules_org-123')
    expect(stored).toBe(JSON.stringify(['MOD-01', 'MOD-04', 'MOD-05']))
  })

  it('deve cadastrar uma nova empresa com administrador e permissões de módulos', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        organizationId: 'new-org-uuid',
        adminUserId: 'admin-uuid',
        slug: 'mecanica-silva',
      },
      error: null,
    } as any)

    const res = await companyManagementService.registerCompanyWithAdmin({
      name: 'Mecânica Silva & Cia',
      slug: 'mecanica-silva',
      adminName: 'Roberto Silva',
      adminEmail: 'roberto@silva.com',
      adminPassword: 'senha-forte-123',
      modules: ['MOD-01', 'MOD-02', 'MOD-09', 'MOD-10'],
    })

    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.organizationId).toBe('new-org-uuid')
      expect(res.data.slug).toBe('mecanica-silva')
    }
  })

  it('deve usar fallback se a RPC admin_register_company_with_admin não estiver no schema cache', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: {
        message: 'Could not find the function public.admin_register_company_with_admin in the schema cache',
        code: 'PGRST202',
      },
    } as any)

    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: { id: 'current-owner-id', email: 'owner@jb.com' } },
      error: null,
    } as any)

    // Mock create_organization_with_owner fallback
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: 'fallback-org-uuid',
      error: null,
    } as any)

    const res = await companyManagementService.registerCompanyWithAdmin({
      name: 'Empresa Fallback',
      slug: 'empresa-fallback',
      adminName: 'Admin Fallback',
      adminEmail: 'admin@fallback.com',
      adminPassword: 'password123',
      modules: ['MOD-01', 'MOD-03'],
    })

    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.organizationId).toBe('fallback-org-uuid')
      expect(res.data.slug).toBe('empresa-fallback')
    }
  })

  it('deve conter todos os 10 módulos da plataforma no catálogo completo', () => {
    expect(ALL_PLATFORM_DASHBOARD_MODULES).toHaveLength(10)
    const codes = ALL_PLATFORM_DASHBOARD_MODULES.map((m) => m.code)
    expect(codes).toContain('MOD-01')
    expect(codes).toContain('MOD-02')
    expect(codes).toContain('MOD-03')
    expect(codes).toContain('MOD-04')
    expect(codes).toContain('MOD-05')
    expect(codes).toContain('MOD-06')
    expect(codes).toContain('MOD-07')
    expect(codes).toContain('MOD-08')
    expect(codes).toContain('MOD-09')
    expect(codes).toContain('MOD-10')
  })
})
