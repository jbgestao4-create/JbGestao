import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  contractService,
  type SoftwareContract,
  getInvoiceEffectiveStatus,
  getContractOverdueInfo,
  getNextCycleInfo,
  getDiffDaysFromToday,
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

  it('deve marcar e desmarcar contrato como assinado pelo cliente contratante', async () => {
    const contract = await contractService.saveContract({
      contractNumber: 'CTR-SIGN-001',
      clientName: 'Cliente Assinatura Teste',
      clientResponsibleName: 'Gestor Sign',
      planName: 'Plano Assinatura',
      monthlyAmount: 300,
      billingDay: 20,
      startDate: '2026-11-01',
      status: 'active',
      isSigned: false,
    })

    expect(contract.success).toBe(true)
    if (!contract.success) return
    expect(contract.data.isSigned).toBe(false)

    // 1. Marca como assinado
    const signedRes = await contractService.toggleContractSigned(contract.data.id)
    expect(signedRes.success).toBe(true)
    if (!signedRes.success) return
    expect(signedRes.data.isSigned).toBe(true)
    expect(signedRes.data.signedAt).toBeTruthy()

    // 2. Desmarca assinatura
    const unsignedRes = await contractService.toggleContractSigned(contract.data.id)
    expect(unsignedRes.success).toBe(true)
    if (!unsignedRes.success) return
    expect(unsignedRes.data.isSigned).toBe(false)
    expect(unsignedRes.data.signedAt).toBeNull()
  })

  it('deve calcular corretamente o próximo ciclo de faturamento', () => {
    expect(getDiffDaysFromToday('2099-01-01')).toBeGreaterThan(0)

    const nov = getNextCycleInfo('11/2026', '2026-11-10', 10)
    expect(nov.nextRefMonth).toBe('12/2026')
    expect(nov.nextDueDate).toBe('2026-12-10')

    const dez = getNextCycleInfo('12/2026', '2026-12-15', 15)
    expect(dez.nextRefMonth).toBe('01/2027')
    expect(dez.nextDueDate).toBe('2027-01-15')
  })

  it('deve gerar nova fatura automaticamente 5 dias antes do vencimento (e não antes de 5 dias)', async () => {
    const formatLocalDate = (daysOffset: number) => {
      const d = new Date()
      d.setDate(d.getDate() + daysOffset)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }

    // 1. Cria contrato ativo com fatura vencendo em 6 dias -> NÃO deve gerar ainda
    const c6Res = await contractService.saveContract({
      contractNumber: 'CTR-RENEW-6D',
      clientName: 'Cliente 6 Dias',
      clientResponsibleName: 'Gestor 6D',
      planName: 'Plano Controle Mensal',
      monthlyAmount: 180.0,
      billingDay: 10,
      startDate: '2026-11-01',
      durationMonths: 12,
      status: 'active',
    })
    expect(c6Res.success).toBe(true)
    if (!c6Res.success) return

    await contractService.saveInvoice({
      contractId: c6Res.data.id,
      clientName: c6Res.data.clientName,
      amount: 180.0,
      dueDate: formatLocalDate(6),
      referenceMonth: '11/2026',
      status: 'pending',
    })

    const runAt6Days = await contractService.autoGenerateInvoicesDueSoon()
    expect(runAt6Days.success).toBe(true)
    if (!runAt6Days.success) return
    expect(runAt6Days.data.length).toBe(0)

    // 2. Cria contrato ativo com fatura vencendo em 5 dias -> DEVE gerar
    const contractRes = await contractService.saveContract({
      contractNumber: 'CTR-RENEW-001',
      clientName: 'Cliente Renovação Automática',
      clientResponsibleName: 'Gestor Auto',
      planName: 'Plano Controle Mensal',
      monthlyAmount: 180.0,
      billingDay: 10,
      startDate: '2026-11-01',
      durationMonths: 12,
      status: 'active',
    })
    expect(contractRes.success).toBe(true)
    if (!contractRes.success) return
    const contract = contractRes.data

    const initialInvoice = await contractService.saveInvoice({
      contractId: contract.id,
      clientName: contract.clientName,
      amount: 180.0,
      dueDate: formatLocalDate(5),
      referenceMonth: '11/2026',
      status: 'pending',
    })
    expect(initialInvoice.success).toBe(true)

    // 3. Executa a rotina de verificação automática
    const autoGenRes = await contractService.autoGenerateInvoicesDueSoon()
    expect(autoGenRes.success).toBe(true)
    if (!autoGenRes.success) return

    // Deve ter gerado 1 nova fatura para o próximo ciclo
    expect(autoGenRes.data.length).toBe(1)
    const newInvoice = autoGenRes.data[0]
    expect(newInvoice.contractId).toBe(contract.id)
    expect(newInvoice.referenceMonth).toBe('12/2026')
    // Deve ter exatamente o mesmo valor da anterior
    expect(newInvoice.amount).toBe(180.0)
    expect(newInvoice.status).toBe('pending')

    // 4. Executa a rotina novamente imediatamente (idempotência: não deve duplicar)
    const secondRun = await contractService.autoGenerateInvoicesDueSoon()
    expect(secondRun.success).toBe(true)
    if (!secondRun.success) return
    expect(secondRun.data.length).toBe(0)
  })

  it('deve gerar o primeiro boleto pago exatamente 5 dias antes do término do período de teste', async () => {
    const formatLocalDate = (daysOffset: number) => {
      const d = new Date()
      d.setDate(d.getDate() + daysOffset)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }

    // 1. Contrato em teste terminando em 6 dias -> NÃO deve gerar boleto pago ainda
    const trial6Res = await contractService.saveContract({
      contractNumber: 'CTR-TRIAL-6D',
      clientName: 'Empresa Teste 6 Dias',
      clientResponsibleName: 'Resp 6D',
      planName: 'Plano Completo',
      monthlyAmount: 249.9,
      billingDay: 15,
      startDate: formatLocalDate(-24),
      durationMonths: 12,
      hasTrialPeriod: true,
      trialDurationMonths: 1,
      trialEndsAt: formatLocalDate(6),
      status: 'active',
    })
    expect(trial6Res.success).toBe(true)
    if (!trial6Res.success) return

    const init6 = await contractService.ensureInitialInvoice(trial6Res.data)
    expect(init6.success).toBe(true)
    expect(init6.success && init6.data?.amount).toBe(0)
    expect(init6.success && init6.data?.status).toBe('paid')

    const gen6 = await contractService.autoGenerateInvoicesDueSoon()
    expect(gen6.success).toBe(true)
    if (!gen6.success) return
    expect(gen6.data.length).toBe(0)

    // 2. Contrato em teste terminando em 5 dias -> DEVE gerar o primeiro boleto pago
    const trial5Res = await contractService.saveContract({
      contractNumber: 'CTR-TRIAL-5D',
      clientName: 'Empresa Teste 5 Dias',
      clientResponsibleName: 'Resp 5D',
      planName: 'Plano Completo',
      monthlyAmount: 249.9,
      billingDay: 15,
      startDate: formatLocalDate(-25),
      durationMonths: 12,
      hasTrialPeriod: true,
      trialDurationMonths: 1,
      trialEndsAt: formatLocalDate(5),
      status: 'active',
    })
    expect(trial5Res.success).toBe(true)
    if (!trial5Res.success) return

    const init5 = await contractService.ensureInitialInvoice(trial5Res.data)
    expect(init5.success).toBe(true)
    expect(init5.success && init5.data?.amount).toBe(0)

    const gen5 = await contractService.autoGenerateInvoicesDueSoon()
    expect(gen5.success).toBe(true)
    if (!gen5.success) return
    expect(gen5.data.length).toBe(1)
    expect(gen5.data[0].contractId).toBe(trial5Res.data.id)
    expect(gen5.data[0].amount).toBe(249.9)
    expect(gen5.data[0].status).toBe('pending')
    expect(gen5.data[0].dueDate.endsWith('-15')).toBe(true)
  })
})
