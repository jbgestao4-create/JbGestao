import { describe, it, expect, vi } from 'vitest'
import {
  SYSTEM_DEFAULT_ACCESS_PLANS,
  getPlanSlug,
  resolvePlanFromSlugOrId,
} from './access-plan.service'
import { planTermsService } from '@shared/services/plan-terms.service'

vi.mock('@app/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Table offline in mock' },
      }),
    })),
  },
}))

describe('accessPlanService - Slugs e URLs Amigáveis', () => {
  it('retorna os slugs encurtados corretos para cada plano', () => {
    expect(getPlanSlug('00000000-0000-4000-8000-000000000001')).toBe('basico')
    expect(getPlanSlug('00000000-0000-4000-8000-000000000002')).toBe('basico-pdv')
    expect(getPlanSlug('00000000-0000-4000-8000-000000000003')).toBe('completo')
    expect(getPlanSlug('00000000-0000-4000-8000-000000000004')).toBe('completo-fiscal')
    expect(getPlanSlug('00000000-0000-4000-8000-000000000005')).toBe('pdv-fiscal')
  })

  it('resolve o plano a partir de slug amigável curto', () => {
    const plan = resolvePlanFromSlugOrId('basico-pdv', SYSTEM_DEFAULT_ACCESS_PLANS)
    expect(plan).toBeDefined()
    expect(plan?.id).toBe('00000000-0000-4000-8000-000000000002')
    expect(plan?.name).toBe('Básico + PDV sem NF-e')
  })

  it('resolve o plano a partir de número simplificado', () => {
    const plan2 = resolvePlanFromSlugOrId('2', SYSTEM_DEFAULT_ACCESS_PLANS)
    expect(plan2).toBeDefined()
    expect(plan2?.id).toBe('00000000-0000-4000-8000-000000000002')

    const plan1 = resolvePlanFromSlugOrId('1', SYSTEM_DEFAULT_ACCESS_PLANS)
    expect(plan1?.id).toBe('00000000-0000-4000-8000-000000000001')

    const plan3 = resolvePlanFromSlugOrId('3', SYSTEM_DEFAULT_ACCESS_PLANS)
    expect(plan3?.id).toBe('00000000-0000-4000-8000-000000000003')
  })

  it('mantém compatibilidade total com o UUID legado longo', () => {
    const plan = resolvePlanFromSlugOrId(
      '00000000-0000-4000-8000-000000000002',
      SYSTEM_DEFAULT_ACCESS_PLANS,
    )
    expect(plan).toBeDefined()
    expect(plan?.id).toBe('00000000-0000-4000-8000-000000000002')
  })

  it('permite que planTermsService busque termos usando o slug curto', async () => {
    const term = await planTermsService.getTermForPlan('basico-pdv')
    expect(term).toBeDefined()
    expect(term.planId).toBe('00000000-0000-4000-8000-000000000002')
    expect(term.title).toContain('Básico + PDV sem NF-e')
  })
})
