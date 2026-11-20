import { describe, expect, it } from 'vitest'
import {
  checkDependenciesOnDeselect,
  resolveDependenciesOnSelect,
  validateModuleDependencies,
} from './module-dependencies.service'

describe('module-dependencies.service', () => {
  it('validates that Vendas (MOD-01) requires Estoque (MOD-02) and Caixa (MOD-05)', () => {
    const res = validateModuleDependencies(['MOD-01'], ['MOD-01', 'MOD-02', 'MOD-05'])
    expect(res.isValid).toBe(false)
    expect(res.errors.length).toBeGreaterThan(0)
    expect(res.missingDependencies.some((m) => m.requiredModule === 'MOD-02')).toBe(true)
    expect(res.missingDependencies.some((m) => m.requiredModule === 'MOD-05')).toBe(true)
  })

  it('validates correctly when all dependencies are fulfilled', () => {
    const res = validateModuleDependencies(['MOD-01', 'MOD-02', 'MOD-05'], ['MOD-01', 'MOD-02', 'MOD-05'])
    expect(res.isValid).toBe(true)
    expect(res.errors).toHaveLength(0)
  })

  it('automatically resolves strict dependencies when selecting MOD-01', () => {
    const { autoAddedModules, message } = resolveDependenciesOnSelect(
      'MOD-01',
      [],
      ['MOD-01', 'MOD-02', 'MOD-05'],
    )
    expect(autoAddedModules).toContain('MOD-02')
    expect(autoAddedModules).toContain('MOD-05')
    expect(message).toContain('Vendas (MOD-01)')
  })

  it('detects dependent modules when deselecting MOD-02 while MOD-01 is selected', () => {
    const { hasDependents, dependents, warningMessage } = checkDependenciesOnDeselect(
      'MOD-02',
      ['MOD-01', 'MOD-02'],
    )
    expect(hasDependents).toBe(true)
    expect(dependents.some((d) => d.code === 'MOD-01')).toBe(true)
    expect(warningMessage).toContain('Vendas (MOD-01)')
  })
})
