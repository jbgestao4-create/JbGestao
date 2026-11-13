import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  contractService,
  type SoftwareContract,
  getInvoiceEffectiveStatus,
  getContractOverdueInfo,
} from './contract.service'

vi.mock('@app/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Table offline' } }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
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

  it('deve gerar faturas, gerenciar pagamentos e identificar vencimento em atraso', async () => {
    const contract = await contractService.saveContract({
      clientName: 'Auto Mecânica Express',
      clientDocument: '99.888.777/0001-11',
      clientResponsibleName: 'Roberto Souza',
      monthlyAmount: 199.9,
      billingDay: 10,
    })

    expect(contract.success).toBe(true)
    if (!contract.success) return

    // 1. Gera lote de faturas (ex: 3 meses)
    const batchRes = await contractService.generateInvoicesBatch(contract.data, 3)
    expect(batchRes.success).toBe(true)
    if (!batchRes.success) return
    expect(batchRes.data.length).toBe(3)

    const invoices = await contractService.listInvoices(contract.data.id)
    expect(invoices.success).toBe(true)
    if (!invoices.success) return
    expect(invoices.data.length).toBe(3)

    const firstInvoice = invoices.data[0]

    // 2. Marca como paga
    const paidRes = await contractService.markInvoiceAsPaid(firstInvoice.id, 'PIX', '2026-11-10')
    expect(paidRes.success).toBe(true)
    if (!paidRes.success) return
    expect(paidRes.data.status).toBe('paid')
    expect(paidRes.data.paymentDate).toBe('2026-11-10')
    expect(getInvoiceEffectiveStatus(paidRes.data)).toBe('paid')

    // 3. Desfaz pagamento
    const undoRes = await contractService.undoInvoicePayment(firstInvoice.id)
    expect(undoRes.success).toBe(true)
    if (!undoRes.success) return
    expect(undoRes.data.status).toBe('pending')
    expect(undoRes.data.paymentDate).toBeNull()

    // 4. Cria fatura retroativa vencida para testar getContractOverdueInfo
    const overdueRes = await contractService.saveInvoice({
      contractId: contract.data.id,
      clientName: contract.data.clientName,
      amount: 199.9,
      dueDate: '2026-01-10', // data no passado
      status: 'pending',
    })
    expect(overdueRes.success).toBe(true)
    if (!overdueRes.success) return

    const allInvoices = await contractService.listInvoices(contract.data.id)
    expect(allInvoices.success).toBe(true)
    if (!allInvoices.success) return

    const overdueInfo = getContractOverdueInfo(contract.data.id, allInvoices.data)
    expect(overdueInfo.hasOverdue).toBe(true)
    expect(overdueInfo.overdueCount).toBeGreaterThanOrEqual(1)
    expect(overdueInfo.totalOverdueAmount).toBeGreaterThan(0)
  })

  it('deve gerar faturas com isenção no 1º mês quando o contrato possui período de teste de 1 mês', async () => {
    const trialContract = await contractService.saveContract({
      contractNumber: 'CTR-TRIAL-001',
      clientName: 'Cliente Teste Degustação',
      clientResponsibleName: 'Gestor Teste',
      planName: 'Plano Pro Teste',
      monthlyAmount: 250,
      billingDay: 15,
      paymentMethod: 'PIX',
      startDate: '2026-11-01',
      durationMonths: 12,
      hasTrialPeriod: true,
      trialDurationMonths: 1,
      status: 'active',
    })

    expect(trialContract.success).toBe(true)
    if (!trialContract.success) return

    const batch = await contractService.generateInvoicesBatch(trialContract.data, 3)
    expect(batch.success).toBe(true)
    if (!batch.success) return
    expect(batch.data.length).toBe(3)

    // A primeira fatura deve ser gratuita (R$ 0,00) e já quitada/isenta
    const firstInvoice = batch.data[0]
    expect(firstInvoice.amount).toBe(0)
    expect(firstInvoice.status).toBe('paid')
    expect(firstInvoice.notes).toContain('Período de Teste Gratuito de 1 Mês')

    // A segunda fatura deve ter o valor cheio e status pending
    const secondInvoice = batch.data[1]
    expect(secondInvoice.amount).toBe(250)
    expect(secondInvoice.status).toBe('pending')
  })
})
