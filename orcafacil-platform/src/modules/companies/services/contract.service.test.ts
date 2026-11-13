import { describe, it, expect, beforeEach, vi } from 'vitest'
import { contractService, type SoftwareContract } from './contract.service'

vi.mock('@app/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Table offline' } }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}))

describe('contractService', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('deve gerar número de contrato sequencial com ano atual', () => {
    const year = new Date().getFullYear()
    const num1 = contractService.generateContractNumber(0)
    expect(num1).toBe(`CTR-${year}-0001`)

    const num2 = contractService.generateContractNumber(15)
    expect(num2).toBe(`CTR-${year}-0016`)
  })

  it('deve salvar um novo contrato no armazenamento e listar corretamente', async () => {
    const contractData: Partial<SoftwareContract> = {
      clientName: 'Oficina Central Ltda',
      clientDocument: '12.345.678/0001-99',
      clientResponsibleName: 'Carlos Alberto',
      monthlyAmount: 250.0,
      billingDay: 15,
      startDate: '2026-03-01',
      durationMonths: 12,
      planName: 'Plano Pro JB Gestão',
    }

    const saveResult = await contractService.saveContract(contractData)
    expect(saveResult.success).toBe(true)
    if (!saveResult.success) return

    expect(saveResult.data).toBeDefined()
    expect(saveResult.data.clientName).toBe('Oficina Central Ltda')
    expect(saveResult.data.clientResponsibleName).toBe('Carlos Alberto')
    expect(saveResult.data.monthlyAmount).toBe(250.0)
    expect(saveResult.data.billingDay).toBe(15)

    const listResult = await contractService.listContracts()
    expect(listResult.success).toBe(true)
    if (!listResult.success) return

    expect(listResult.data.length).toBe(1)
    expect(listResult.data[0].clientName).toBe('Oficina Central Ltda')
  })

  it('deve atualizar um contrato existente e permitir exclusão', async () => {
    const created = await contractService.saveContract({
      clientName: 'Cliente Teste',
      clientResponsibleName: 'Maria Silva',
      monthlyAmount: 180.0,
      billingDay: 5,
    })

    expect(created.success).toBe(true)
    if (!created.success) return

    const id = created.data.id

    // Atualiza
    const updated = await contractService.saveContract({
      ...created.data,
      monthlyAmount: 200.0,
      clientResponsibleName: 'Maria Silva Santos',
    })

    expect(updated.success).toBe(true)
    if (!updated.success) return

    expect(updated.data.monthlyAmount).toBe(200.0)
    expect(updated.data.clientResponsibleName).toBe('Maria Silva Santos')

    // Exclui
    const deleteRes = await contractService.deleteContract(id)
    expect(deleteRes.success).toBe(true)

    const listAfter = await contractService.listContracts()
    expect(listAfter.success).toBe(true)
    if (!listAfter.success) return

    expect(listAfter.data.length).toBe(0)
  })
})
