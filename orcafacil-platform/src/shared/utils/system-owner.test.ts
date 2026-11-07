import { describe, it, expect, beforeEach } from 'vitest'
import { isSystemOwner, SYSTEM_OWNER_EMAILS } from './system-owner'

describe('isSystemOwner', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('deve retornar true para a conta mestre adm@adm.com', () => {
    expect(isSystemOwner('adm@adm.com')).toBe(true)
    expect(isSystemOwner('ADM@ADM.COM')).toBe(true)
    expect(isSystemOwner({ email: 'adm@adm.com' })).toBe(true)
  })

  it('deve retornar false para usuários de empresas cadastradas', () => {
    expect(isSystemOwner('carlos@empresa.com')).toBe(false)
    expect(isSystemOwner('financeiro@oficina.com.br')).toBe(false)
    expect(isSystemOwner({ email: 'cliente@loja.com' })).toBe(false)
  })

  it('deve conter a lista de e-mails mestres do proprietário', () => {
    expect(SYSTEM_OWNER_EMAILS).toContain('adm@adm.com')
    expect(SYSTEM_OWNER_EMAILS).toContain('bryan@administrador.com')
    expect(SYSTEM_OWNER_EMAILS).toContain('bryanmendes968@gmail.com')
  })

  it('deve reconhecer metadados de is_platform_owner se presentes', () => {
    expect(isSystemOwner({ email: 'outro@dominio.com', user_metadata: { is_platform_owner: true } })).toBe(true)
  })

  it('não deve conceder perfil de proprietário com base em dados locais', () => {
    localStorage.setItem('jb_system_owners', JSON.stringify(['cliente@loja.com']))
    expect(isSystemOwner({ email: 'cliente@loja.com' })).toBe(false)
  })
})
