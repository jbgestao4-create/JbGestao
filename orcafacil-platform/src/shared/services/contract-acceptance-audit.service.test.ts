import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  contractAcceptanceAuditService,
  computeSha256,
} from './contract-acceptance-audit.service'

vi.mock('@app/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}))

describe('contractAcceptanceAuditService', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('calcula o SHA-256 de forma determinística e com 64 caracteres hexadecimais', async () => {
    const text = 'CONTRATO DE LICENÇA DE SOFTWARE JB GESTÃO V2.0'
    const hash1 = await computeSha256(text)
    const hash2 = await computeSha256(text)

    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)
    expect(/^[a-f0-9]{64}$/.test(hash1)).toBe(true)

    // Diferença em 1 caractere deve alterar drasticamente o hash
    const hashModified = await computeSha256(text + '.')
    expect(hashModified).not.toBe(hash1)
  })

  it('registra o aceite com evidências completas e encadeamento criptográfico', async () => {
    const res = await contractAcceptanceAuditService.recordAcceptance({
      contractId: 'term-basic-plan',
      contractNumber: 'CTR-2026-TEST',
      contractName: 'Termo de Adesão Básico',
      contractVersion: '2.0',
      documentContent: 'Cláusula 1: Objeto do Contrato. Cláusula 2: Preço.',
      userId: 'usr-123',
      userName: 'Carlos Silva',
      userEmail: 'carlos@empresa.com.br',
      userDocument: '123.456.789-00',
      companyId: 'comp-456',
      companyName: 'Empresa Teste Ltda',
      companyDocument: '12.345.678/0001-90',
      planId: 'plan-basic',
      planName: 'Plano Básico',
      authMethod: 'password',
    })

    expect(res.success).toBe(true)
    if (!res.success) throw new Error('Falha esperada em teste')
    const record = res.data
    expect(record).toBeDefined()
    expect(record.receiptNumber).toMatch(/^CERT-ACEITE-/)
    expect(record.documentSha256).toHaveLength(64)
    expect(record.evidenceSha256).toHaveLength(64)
    expect(record.auditChainHeadHash).toHaveLength(64)
    expect(record.auditEvents.length).toBeGreaterThanOrEqual(4)
    expect(record.userEmail).toBe('carlos@empresa.com.br')
  })

  it('valida a integridade com sucesso quando o registro não foi adulterado', async () => {
    const res = await contractAcceptanceAuditService.recordAcceptance({
      contractId: 'term-pro-plan',
      contractNumber: 'CTR-PRO-001',
      contractName: 'Termo de Adesão Pro',
      contractVersion: '2.1',
      documentContent: 'Conteúdo original e autêntico assinado pelo usuário.',
      userName: 'Mariana Costa',
      userEmail: 'mariana@contabilidade.com.br',
      companyName: 'Mariana Contabilidade',
    })

    expect(res.success).toBe(true)
    if (!res.success) throw new Error('Falha esperada em teste')
    const record = res.data
    const check = await contractAcceptanceAuditService.verifyRecordIntegrity(record)
    expect(check.isValid).toBe(true)
    expect(check.documentHashValid).toBe(true)
    expect(check.evidenceHashValid).toBe(true)
    expect(check.auditChainValid).toBe(true)
  })

  it('detecta adulteração caso o conteúdo do documento aceito seja modificado', async () => {
    const res = await contractAcceptanceAuditService.recordAcceptance({
      contractId: 'term-gold',
      contractNumber: 'CTR-GOLD',
      contractName: 'Termo Gold',
      contractVersion: '1.0',
      documentContent: 'Mensalidade acordada: R$ 149,90.',
      userName: 'João Admin',
      userEmail: 'joao@loja.com.br',
    })

    expect(res.success).toBe(true)
    if (!res.success) throw new Error('Falha esperada em teste')
    const record = res.data

    // Simulação de adulteração do texto do contrato
    const tamperedRecord = {
      ...record,
      documentContent: 'Mensalidade acordada: R$ 999,90.',
    }

    const check = await contractAcceptanceAuditService.verifyRecordIntegrity(tamperedRecord)
    expect(check.isValid).toBe(false)
    expect(check.documentHashValid).toBe(false)
    expect(check.details).toContain('divergência')
  })

  it('localiza o registro por empresa ou e-mail', async () => {
    await contractAcceptanceAuditService.recordAcceptance({
      contractId: 'term-1',
      contractName: 'Termo Teste Busca',
      contractVersion: '1.0',
      documentContent: 'Texto de teste.',
      userName: 'Lucas Pereira',
      userEmail: 'lucas@busca.com.br',
      companyId: 'comp-uuid-999',
      companyName: 'Busca Ltda',
    })

    const foundByCompany = await contractAcceptanceAuditService.getByCompanyOrEmail('comp-uuid-999', null)
    expect(foundByCompany).not.toBeNull()
    expect(foundByCompany?.userName).toBe('Lucas Pereira')

    const foundByEmail = await contractAcceptanceAuditService.getByCompanyOrEmail(null, 'lucas@busca.com.br')
    expect(foundByEmail).not.toBeNull()
    expect(foundByEmail?.companyId).toBe('comp-uuid-999')
  })

  it('gera dossiê JSON com todas as evidências técnicas e conformidade legal', async () => {
    const res = await contractAcceptanceAuditService.recordAcceptance({
      contractId: 'term-dossier',
      contractName: 'Termo para Dossiê Forense',
      contractVersion: '2.0',
      documentContent: 'Texto integral do contrato para exportação forense.',
      userName: 'Dr. Roberto',
      userEmail: 'roberto@juridico.com.br',
      userDocument: '111.222.333-44',
      companyName: 'Escritório Roberto & Associados',
    })

    expect(res.success).toBe(true)
    if (!res.success) throw new Error('Falha esperada em teste')
    const record = res.data

    const rawJson = contractAcceptanceAuditService.exportDossierJson(record)
    expect(rawJson).toBeDefined()
    const dossier = JSON.parse(rawJson)

    expect(dossier.specVersion).toBe('1.0')
    expect(dossier.receiptNumber).toBe(record.receiptNumber)
    expect(dossier.contract.documentSha256).toBe(record.documentSha256)
    expect(dossier.legalCompliance).toBeDefined()
    expect(dossier.legalCompliance.statutes.some((s: string) => s.includes('2.200-2/2001'))).toBe(true)
    expect(dossier.technicalConnection.ipAddress).toBeDefined()
    expect(dossier.chronologicalAuditTrail.events.length).toBeGreaterThan(0)
  })
})
