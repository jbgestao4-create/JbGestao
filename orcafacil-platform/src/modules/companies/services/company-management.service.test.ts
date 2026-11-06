import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  companyManagementService,
  ALL_PLATFORM_DASHBOARD_MODULES,
} from './company-management.service'
import { supabase } from '@app/config/supabase'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signUp: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  })),
}))

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

  it('deve atualizar o nome e o identificador da empresa pela RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    } as any)

    const result = await companyManagementService.updateCompanyDetails('org-123', {
      name: 'Empresa Atualizada',
      slug: 'empresa-atualizada',
    })

    expect(result.success).toBe(true)
    expect(vi.mocked(supabase.rpc).mock.calls[0]).toEqual([
      'admin_update_full_company_details',
      {
        p_org_id: 'org-123',
        p_name: 'Empresa Atualizada',
        p_slug: 'empresa-atualizada',
        p_cnpj: null,
        p_address: null,
        p_responsible: null,
        p_notes: null,
        p_is_active: undefined,
        p_trial_ends_at: undefined,
        p_admin_name: null,
        p_admin_email: null,
        p_admin_password: null,
        p_modules: null,
      },
    ])
  })

  it('deve configurar e estender o período de teste salvando na RPC e no storage', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    } as any)

    const trialDate = '2026-12-31T23:59:59.000Z'
    const result = await companyManagementService.setTrialPeriod('org-123', trialDate)

    expect(result.success).toBe(true)
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('admin_set_organization_trial', {
      p_org_id: 'org-123',
      p_trial_ends_at: trialDate,
    })
    expect(localStorage.getItem('jb_company_trial_org-123')).toBe(trialDate)

    // Testar remoção de expiração (acesso ilimitado / null)
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    } as any)

    const resultUnlimited = await companyManagementService.setTrialPeriod('org-123', null)
    expect(resultUnlimited.success).toBe(true)
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('admin_set_organization_trial', {
      p_org_id: 'org-123',
      p_trial_ends_at: null,
    })
    expect(localStorage.getItem('jb_company_trial_org-123')).toBe('')
  })

  it('não informa sucesso nem armazena permissões quando a atualização de páginas falha', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'Acesso negado' },
    } as any)

    const result = await companyManagementService.updateCompanyModules('org-123', ['MOD-01'])

    expect(result).toEqual({ success: false, error: 'Acesso negado' })
    expect(localStorage.getItem('jb_company_modules_org-123')).toBeNull()
  })

  it('respeita a lista vazia retornada pelo banco mesmo se houver cache local antigo', async () => {
    localStorage.setItem('jb_company_modules_org-123', JSON.stringify(['MOD-01']))
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    vi.mocked(supabase.from).mockReturnValueOnce(query as any)

    const modules = await companyManagementService.getCompanyModules('org-123')

    expect(modules).toEqual([])
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
      modules: ['MOD-01', 'MOD-01_QUICK_SALE', 'MOD-02', 'MOD-09', 'MOD-10'],
    })

    expect(res.success).toBe(true)
    expect(supabase.rpc).toHaveBeenCalledWith(
      'admin_register_company_with_admin',
      expect.objectContaining({
        p_modules: ['MOD-01', 'MOD-01_QUICK_SALE', 'MOD-02', 'MOD-09', 'MOD-10'],
      }),
    )
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

  it('deve excluir a empresa através da RPC com motivo', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    } as any)

    localStorage.setItem('jb_company_modules_org-del-1', JSON.stringify(['MOD-01']))
    localStorage.setItem('jb_company_status_org-del-1', 'active')

    const res = await companyManagementService.deleteCompany('org-del-1', 'Encerramento de contrato')

    expect(res.success).toBe(true)
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('admin_delete_organization_with_reason', {
      p_org_id: 'org-del-1',
      p_reason: 'Encerramento de contrato',
    })
    expect(localStorage.getItem('jb_company_modules_org-del-1')).toBeNull()
    expect(localStorage.getItem('jb_company_status_org-del-1')).toBeNull()
  })

  it('deve usar fallback direto na tabela caso a RPC de exclusão retorne erro de schema cache', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function' },
    } as any)

    const query = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from).mockReturnValueOnce(query as any)

    const res = await companyManagementService.deleteCompany('org-del-2')

    expect(res.success).toBe(true)
    expect(query.delete).toHaveBeenCalled()
    expect(query.eq).toHaveBeenCalledWith('id', 'org-del-2')
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

  it('deve atualizar e persistir os campos estendidos (cnpj, endereco, responsavel, observacoes)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    } as any)

    const result = await companyManagementService.updateCompanyDetails('org-extended-1', {
      name: 'Auto Mecânica VIP',
      slug: 'auto-mecanica-vip',
      cnpj: '12.345.678/0001-90',
      address: 'Rua das Flores, 123, Bairro Centro',
      responsible: 'José Carlos',
      notes: 'Cliente especial da rede',
      adminEmail: 'jose@vip.com',
      adminName: 'José Carlos',
    })

    expect(result.success).toBe(true)
    expect(vi.mocked(supabase.rpc).mock.calls[0]).toEqual([
      'admin_update_full_company_details',
      {
        p_org_id: 'org-extended-1',
        p_name: 'Auto Mecânica VIP',
        p_slug: 'auto-mecanica-vip',
        p_cnpj: '12.345.678/0001-90',
        p_address: 'Rua das Flores, 123, Bairro Centro',
        p_responsible: 'José Carlos',
        p_notes: 'Cliente especial da rede',
        p_is_active: undefined,
        p_trial_ends_at: undefined,
        p_admin_name: 'José Carlos',
        p_admin_email: 'jose@vip.com',
        p_admin_password: null,
        p_modules: null,
      },
    ])

    const storedRaw = localStorage.getItem('jb_company_details_org-extended-1')
    expect(storedRaw).not.toBeNull()
    const stored = JSON.parse(storedRaw!)
    expect(stored.cnpj).toBe('12.345.678/0001-90')
    expect(stored.responsible).toBe('José Carlos')
    expect(stored.address).toBe('Rua das Flores, 123, Bairro Centro')
    expect(stored.notes).toBe('Cliente especial da rede')
    expect(stored.adminEmail).toBe('jose@vip.com')
  })

  it('deve permitir cadastrar e redefinir a senha do administrador da organização no editar empresa', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    } as any)

    const result = await companyManagementService.updateCompanyDetails('org-pwd-reset-1', {
      name: 'Centro Automotivo Master',
      slug: 'centro-automotivo-master',
      adminName: 'Fernando Ramos',
      adminEmail: 'fernando@master.com',
      adminPassword: 'nova-senha-segura-789',
    })

    expect(result.success).toBe(true)
    expect(vi.mocked(supabase.rpc).mock.calls[0]).toEqual([
      'admin_update_full_company_details',
      {
        p_org_id: 'org-pwd-reset-1',
        p_name: 'Centro Automotivo Master',
        p_slug: 'centro-automotivo-master',
        p_cnpj: null,
        p_address: null,
        p_responsible: null,
        p_notes: null,
        p_is_active: undefined,
        p_trial_ends_at: undefined,
        p_admin_name: 'Fernando Ramos',
        p_admin_email: 'fernando@master.com',
        p_admin_password: 'nova-senha-segura-789',
        p_modules: null,
      },
    ])
  })

  it('deve consultar os usuários cadastrados na empresa via RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [
        {
          user_id: 'user-1',
          display_name: 'Carlos Admin',
          email: 'carlos@empresa.com',
          role: 'admin',
          job_title: 'Gerente Geral',
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          user_id: 'user-2',
          display_name: 'Mariana Silva',
          email: 'mariana@empresa.com',
          role: 'member',
          job_title: 'Vendedora',
          created_at: '2026-02-01T00:00:00Z',
        },
      ],
      error: null,
    } as any)

    const res = await companyManagementService.getCompanyUsers('org-users-1')
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data).toHaveLength(2)
      expect(res.data[0].displayName).toBe('Carlos Admin')
      expect(res.data[0].role).toBe('admin')
      expect(res.data[1].displayName).toBe('Mariana Silva')
    }
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('admin_get_company_users', {
      p_org_id: 'org-users-1',
    })
  })

  it('deve redefinir a senha do usuário cadastrado na empresa', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    } as any)

    const res = await companyManagementService.resetCompanyUserPassword(
      'org-users-1',
      'user-2',
      'nova-senha-colaborador-123',
      'mariana@empresa.com',
    )

    expect(res.success).toBe(true)
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('admin_reset_company_user_password', {
      p_org_id: 'org-users-1',
      p_user_id: 'user-2',
      p_new_password: 'nova-senha-colaborador-123',
      p_user_email: 'mariana@empresa.com',
    })
  })

  it('deve permitir cadastrar e redefinir a senha do administrador da organização no editar empresa', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    } as any)

    const result = await companyManagementService.updateCompanyDetails('org-pwd-reset-1', {
      name: 'Centro Automotivo Master',
      slug: 'centro-automotivo-master',
      adminName: 'Fernando Ramos',
      adminEmail: 'fernando@master.com',
      adminPassword: 'nova-senha-segura-789',
    })

    expect(result.success).toBe(true)
    expect(vi.mocked(supabase.rpc).mock.calls[0]).toEqual([
      'admin_update_full_company_details',
      {
        p_org_id: 'org-pwd-reset-1',
        p_name: 'Centro Automotivo Master',
        p_slug: 'centro-automotivo-master',
        p_cnpj: null,
        p_address: null,
        p_responsible: null,
        p_notes: null,
        p_is_active: undefined,
        p_trial_ends_at: undefined,
        p_admin_name: 'Fernando Ramos',
        p_admin_email: 'fernando@master.com',
        p_admin_password: 'nova-senha-segura-789',
        p_modules: null,
      },
    ])
  })

  it('deve consultar os usuários cadastrados na empresa via RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [
        {
          user_id: 'user-1',
          display_name: 'Carlos Admin',
          email: 'carlos@empresa.com',
          role: 'admin',
          job_title: 'Gerente Geral',
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          user_id: 'user-2',
          display_name: 'Mariana Silva',
          email: 'mariana@empresa.com',
          role: 'member',
          job_title: 'Vendedora',
          created_at: '2026-02-01T00:00:00Z',
        },
      ],
      error: null,
    } as any)

    const res = await companyManagementService.getCompanyUsers('org-users-1')
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data).toHaveLength(2)
      expect(res.data[0].displayName).toBe('Carlos Admin')
      expect(res.data[0].role).toBe('admin')
      expect(res.data[1].displayName).toBe('Mariana Silva')
    }
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('admin_get_company_users', {
      p_org_id: 'org-users-1',
    })
  })

  it('deve redefinir a senha do usuário cadastrado na empresa', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    } as any)

    const res = await companyManagementService.resetCompanyUserPassword(
      'org-users-1',
      'user-2',
      'nova-senha-colaborador-123',
      'mariana@empresa.com',
    )

    expect(res.success).toBe(true)
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('admin_reset_company_user_password', {
      p_org_id: 'org-users-1',
      p_user_id: 'user-2',
      p_new_password: 'nova-senha-colaborador-123',
      p_user_email: 'mariana@empresa.com',
    })
  })

  it('deve remover o administrador da organização', async () => {
    const res = await companyManagementService.removeCompanyAdmin(
      'org-users-1',
      'carlos@empresa.com',
    )
    expect(res.success).toBe(true)
  })
})
