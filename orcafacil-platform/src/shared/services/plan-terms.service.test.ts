import { describe, it, expect, beforeEach, vi } from 'vitest'
import { planTermsService, DEFAULT_PLAN_TERMS } from './plan-terms.service'

vi.mock('@app/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Table offline in mock' },
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}))

describe('planTermsService', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('retorna os termos padrão quando nada estiver salvo', async () => {
    const terms = await planTermsService.getAllTerms()
    expect(terms).toBeDefined()
    expect(terms['00000000-0000-4000-8000-000000000001']).toBeDefined()
    expect(terms['00000000-0000-4000-8000-000000000001'].planName).toBe('Básico')
    expect(terms.default).toBeDefined()
  })

  it('retorna o termo específico por ID do plano', async () => {
    const planId = '00000000-0000-4000-8000-000000000002'
    const term = await planTermsService.getTermForPlan(planId)
    expect(term.planId).toBe(planId)
    expect(term.title).toContain('Plano Básico + PDV sem NF-e')
  })

  it('retorna o termo buscando por nome do plano', async () => {
    const term = await planTermsService.getTermForPlan('Completo sem emissão de NF-e e NFC-e')
    expect(term.planId).toBe('00000000-0000-4000-8000-000000000003')
    expect(term.content).toContain('PLANO COMPLETO SEM NF-E/NFC-E')
  })

  it('permite salvar alterações no termo de um plano', async () => {
    const planId = '00000000-0000-4000-8000-000000000001'
    const updated = await planTermsService.saveTermForPlan(
      planId,
      {
        title: 'Termo Customizado Básico',
        version: '2.1',
        content: 'Novas cláusulas customizadas do plano básico.',
      },
      'admin@controlesoft.com',
    )

    expect(updated.success).toBe(true)
    if (updated.success) {
      expect(updated.data.title).toBe('Termo Customizado Básico')
      expect(updated.data.version).toBe('2.1')
    }

    // Consulta novamente para checar persistência
    const fetched = await planTermsService.getTermForPlan(planId)
    expect(fetched.title).toBe('Termo Customizado Básico')
    expect(fetched.version).toBe('2.1')
  })

  it('permite restaurar o termo de um plano para o padrão de fábrica', async () => {
    const planId = '00000000-0000-4000-8000-000000000001'
    // Modifica
    await planTermsService.saveTermForPlan(planId, { title: 'Modificado' })
    let term = await planTermsService.getTermForPlan(planId)
    expect(term.title).toBe('Modificado')

    // Restaura
    await planTermsService.resetTermToDefault(planId)
    term = await planTermsService.getTermForPlan(planId)
    expect(term.title).toBe(DEFAULT_PLAN_TERMS[planId].title)
  })
})
