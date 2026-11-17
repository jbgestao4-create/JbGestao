import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult } from '@shared/types/common'
import { calculateNewLicenseExpiry } from '../utils/license.utils'

export type ContractStatus = 'active' | 'draft' | 'cancelled' | 'suspended'

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'

export interface ContractInvoice {
  id: string
  contractId: string
  companyId?: string | null
  invoiceNumber: string
  clientName: string
  clientDocument?: string
  referenceMonth: string // Ex: "11/2026"
  amount: number
  dueDate: string // YYYY-MM-DD
  paymentDate?: string | null // YYYY-MM-DD
  paymentMethod?: string | null
  status: InvoiceStatus
  pixKey?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export function getInvoiceEffectiveStatus(inv: ContractInvoice): 'paid' | 'overdue' | 'pending' | 'cancelled' {
  if (inv.status === 'paid') return 'paid'
  if (inv.status === 'cancelled') return 'cancelled'
  const today = new Date().toISOString().split('T')[0]
  if (inv.dueDate < today) return 'overdue'
  return 'pending'
}

/**
 * Calcula a diferença em dias entre uma data YYYY-MM-DD e o dia atual.
 * Positivo se for no futuro, 0 se for hoje, negativo se for no passado.
 */
export function getDiffDaysFromToday(targetDateStr: string): number {
  try {
    const [y, m, d] = targetDateStr.split('-').map(Number)
    const target = new Date(y, m - 1, d)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    target.setHours(0, 0, 0, 0)

    const diffMs = target.getTime() - today.getTime()
    return Math.round(diffMs / (1000 * 60 * 60 * 24))
  } catch {
    return 0
  }
}

/**
 * Calcula a referência e data de vencimento do próximo mês a partir de uma fatura ativa.
 */
export function getNextCycleInfo(referenceMonth: string, dueDate: string, billingDay?: number) {
  let nextMonth: number
  let nextYear: number

  const parts = referenceMonth.split('/')
  if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
    const curMonth = Number(parts[0])
    const curYear = Number(parts[1])
    nextMonth = curMonth === 12 ? 1 : curMonth + 1
    nextYear = curMonth === 12 ? curYear + 1 : curYear
  } else {
    const [y, m] = dueDate.split('-').map(Number)
    const baseDate = new Date(y, m - 1, 1)
    baseDate.setMonth(baseDate.getMonth() + 1)
    nextMonth = baseDate.getMonth() + 1
    nextYear = baseDate.getFullYear()
  }

  const mm = String(nextMonth).padStart(2, '0')
  const nextRefMonth = `${mm}/${nextYear}`

  const targetDay = billingDay
    ? Math.min(billingDay, 28)
    : Math.min(Number(dueDate.split('-')[2]) || 10, 28)
  const dd = String(targetDay).padStart(2, '0')
  const nextDueDate = `${nextYear}-${mm}-${dd}`

  return { nextRefMonth, nextDueDate }
}

export function getContractOverdueInfo(contractId: string, invoices: ContractInvoice[]) {
  const contractInvoices = invoices.filter((inv) => inv.contractId === contractId)
  const overdueInvoices = contractInvoices.filter(
    (inv) => getInvoiceEffectiveStatus(inv) === 'overdue',
  )
  const sortedOverdue = [...overdueInvoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const oldest = sortedOverdue[0] || null
  const totalOverdueAmount = overdueInvoices.reduce((acc, inv) => acc + (inv.amount || 0), 0)

  return {
    hasOverdue: overdueInvoices.length > 0,
    overdueCount: overdueInvoices.length,
    oldestDueDate: oldest ? oldest.dueDate : null,
    totalOverdueAmount,
    overdueInvoices,
  }
}

export interface SoftwareContract {
  id: string
  companyId?: string | null
  contractNumber: string
  clientName: string
  clientTradeName?: string | null
  clientDocument: string // CNPJ ou CPF
  clientResponsibleName: string
  clientResponsibleDocument?: string | null
  clientResponsibleRole?: string | null
  clientEmail?: string | null
  clientPhone?: string | null
  clientAddress?: string | null
  planName: string
  monthlyAmount: number
  setupFee?: number
  billingDay: number
  paymentMethod: string
  startDate: string
  durationMonths: number
  hasTrialPeriod?: boolean
  trialDurationMonths?: number
  trialEndsAt?: string | null
  isSigned?: boolean
  signedAt?: string | null
  status: ContractStatus
  licensorName: string
  licensorTradeName?: string
  licensorDocument: string
  licensorResponsible: string
  licensorEmail?: string
  licensorPhone?: string
  licensorAddress?: string
  includedModules?: string[]
  customTerms?: string | null
  createdAt: string
  updatedAt: string
}

const LOCAL_STORAGE_KEY = 'jb_software_contracts'
const LOCAL_STORAGE_INVOICES_KEY = 'jb_contract_invoices'

function getLocalContracts(): SoftwareContract[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function setLocalContracts(contracts: SoftwareContract[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(contracts))
  } catch {
    // ignore
  }
}

function getLocalInvoices(): ContractInvoice[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_INVOICES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function setLocalInvoices(invoices: ContractInvoice[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_STORAGE_INVOICES_KEY, JSON.stringify(invoices))
  } catch {
    // ignore
  }
}

const LOCAL_UNDONE_TIMESTAMPS_KEY = 'cs_undone_invoice_timestamps_v1'

function getUndoneTimestamps(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LOCAL_UNDONE_TIMESTAMPS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function recordUndoneTimestamp(keys: Array<string | null | undefined>, iso: string): void {
  if (typeof window === 'undefined') return
  try {
    const map = getUndoneTimestamps()
    for (const k of keys) {
      if (k && k.trim()) {
        map[k.trim().toLowerCase()] = iso
      }
    }
    localStorage.setItem(LOCAL_UNDONE_TIMESTAMPS_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

export const contractService = {
  /**
   * Gera um número sequencial amigável para o contrato. Ex: CTR-2026-0001
   */
  generateContractNumber(existingCount = 0): string {
    const year = new Date().getFullYear()
    const seq = String(existingCount + 1).padStart(4, '0')
    return `CTR-${year}-${seq}`
  },

  /**
   * Lista todos os contratos gerados.
   */
  async listContracts(): Promise<ServiceResult<SoftwareContract[]>> {
    try {
      const { data, error } = await supabase
        .from('software_contracts')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        // Fallback para localStorage
        logger.warn('Tabela software_contracts não disponível, usando fallback local', { message: error.message })
        const local = getLocalContracts()
        return { success: true, data: local }
      }

      const mapped: SoftwareContract[] = (data || []).map((row: any) => ({
        id: row.id,
        companyId: row.company_id,
        contractNumber: row.contract_number,
        clientName: row.client_name,
        clientTradeName: row.client_trade_name,
        clientDocument: row.client_document,
        clientResponsibleName: row.client_responsible_name,
        clientResponsibleDocument: row.client_responsible_document,
        clientResponsibleRole: row.client_responsible_role,
        clientEmail: row.client_email,
        clientPhone: row.client_phone,
        clientAddress: row.client_address,
        planName: row.plan_name,
        monthlyAmount: Number(row.monthly_amount) || 0,
        setupFee: Number(row.setup_fee) || 0,
        billingDay: Number(row.billing_day) || 10,
        paymentMethod: row.payment_method || 'PIX / Boleto',
        startDate: row.start_date,
        durationMonths: Number(row.duration_months) || 12,
        hasTrialPeriod: Boolean(row.has_trial_period),
        trialDurationMonths: row.trial_duration_months ? Number(row.trial_duration_months) : undefined,
        trialEndsAt: row.trial_ends_at || null,
        isSigned: Boolean(row.is_signed),
        signedAt: row.signed_at || null,
        status: (row.status as ContractStatus) || 'active',
        licensorName: row.licensor_name,
        licensorTradeName: row.licensor_trade_name,
        licensorDocument: row.licensor_document,
        licensorResponsible: row.licensor_responsible,
        licensorEmail: row.licensor_email,
        licensorPhone: row.licensor_phone,
        licensorAddress: row.licensor_address,
        includedModules: Array.isArray(row.included_modules) ? row.included_modules : [],
        customTerms: row.custom_terms,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))

      // Sincroniza cópia local
      setLocalContracts(mapped)

      return { success: true, data: mapped }
    } catch (err: any) {
      logger.error('Erro ao listar contratos', err)
      return { success: true, data: getLocalContracts() }
    }
  },

  /**
   * Salva ou atualiza um contrato.
   */
  async saveContract(contract: Partial<SoftwareContract>): Promise<ServiceResult<SoftwareContract>> {
    const isNew = !contract.id
    const now = new Date().toISOString()
    const id = contract.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}`)

    const cleanContract: SoftwareContract = {
      id,
      companyId: contract.companyId || null,
      contractNumber: contract.contractNumber || this.generateContractNumber(),
      clientName: contract.clientName?.trim() || 'Cliente sem nome',
      clientTradeName: contract.clientTradeName?.trim() || null,
      clientDocument: contract.clientDocument?.trim() || '',
      clientResponsibleName: contract.clientResponsibleName?.trim() || 'Responsável não informado',
      clientResponsibleDocument: contract.clientResponsibleDocument?.trim() || null,
      clientResponsibleRole: contract.clientResponsibleRole?.trim() || null,
      clientEmail: contract.clientEmail?.trim() || null,
      clientPhone: contract.clientPhone?.trim() || null,
      clientAddress: contract.clientAddress?.trim() || null,
      planName: contract.planName?.trim() || 'Plano Padrão JB Gestão',
      monthlyAmount: Number(contract.monthlyAmount) || 0,
      setupFee: Number(contract.setupFee) || 0,
      billingDay: Number(contract.billingDay) || 10,
      paymentMethod: contract.paymentMethod?.trim() || 'PIX / Boleto Bancário',
      startDate: contract.startDate || now.split('T')[0],
      durationMonths: Number(contract.durationMonths) || 12,
      hasTrialPeriod: Boolean(contract.hasTrialPeriod),
      trialDurationMonths: contract.hasTrialPeriod ? (Number(contract.trialDurationMonths) || 1) : undefined,
      trialEndsAt: contract.trialEndsAt || null,
      isSigned: Boolean(contract.isSigned),
      signedAt: contract.isSigned ? (contract.signedAt || now) : null,
      status: contract.status || 'active',
      licensorName: contract.licensorName?.trim() || 'JB SOFTWARE & TECNOLOGIA LTDA',
      licensorTradeName: contract.licensorTradeName?.trim() || 'JB Software Gestão Inteligente',
      licensorDocument: contract.licensorDocument?.trim() || '00.000.000/0001-00',
      licensorResponsible: contract.licensorResponsible?.trim() || 'Bryan Mendes - Administrador Geral',
      licensorEmail: contract.licensorEmail?.trim() || 'controlesoft@outlook.com',
      licensorPhone: contract.licensorPhone?.trim() || '(00) 00000-0000',
      licensorAddress: contract.licensorAddress?.trim() || 'Brasil',
      includedModules: contract.includedModules || [],
      customTerms: contract.customTerms?.trim() || null,
      createdAt: contract.createdAt || now,
      updatedAt: now,
    }

    // Salva no LocalStorage
    const local = getLocalContracts()
    const existingIdx = local.findIndex((c) => c.id === cleanContract.id)
    if (existingIdx >= 0) {
      local[existingIdx] = cleanContract
    } else {
      local.unshift(cleanContract)
    }
    setLocalContracts(local)

    // Tenta persistir no Supabase se possível
    try {
      const payload: any = {
        id: cleanContract.id,
        company_id: cleanContract.companyId || null,
        contract_number: cleanContract.contractNumber,
        client_name: cleanContract.clientName,
        client_trade_name: cleanContract.clientTradeName,
        client_document: cleanContract.clientDocument,
        client_responsible_name: cleanContract.clientResponsibleName,
        client_responsible_document: cleanContract.clientResponsibleDocument,
        client_responsible_role: cleanContract.clientResponsibleRole,
        client_email: cleanContract.clientEmail,
        client_phone: cleanContract.clientPhone,
        client_address: cleanContract.clientAddress,
        plan_name: cleanContract.planName,
        monthly_amount: cleanContract.monthlyAmount,
        setup_fee: cleanContract.setupFee,
        billing_day: cleanContract.billingDay,
        payment_method: cleanContract.paymentMethod,
        start_date: cleanContract.startDate,
        duration_months: cleanContract.durationMonths,
        has_trial_period: cleanContract.hasTrialPeriod,
        trial_duration_months: cleanContract.trialDurationMonths,
        trial_ends_at: cleanContract.trialEndsAt,
        is_signed: cleanContract.isSigned,
        signed_at: cleanContract.signedAt,
        status: cleanContract.status,
        licensor_name: cleanContract.licensorName,
        licensor_trade_name: cleanContract.licensorTradeName,
        licensor_document: cleanContract.licensorDocument,
        licensor_responsible: cleanContract.licensorResponsible,
        licensor_email: cleanContract.licensorEmail,
        licensor_phone: cleanContract.licensorPhone,
        licensor_address: cleanContract.licensorAddress,
        included_modules: cleanContract.includedModules,
        custom_terms: cleanContract.customTerms,
        updated_at: now,
      }

      if (isNew) {
        payload.created_at = now
      }

      await supabase.from('software_contracts').upsert(payload)
    } catch (err) {
      logger.warn('Não foi possível sincronizar contrato com Supabase (mantido no armazenamento local)', {
        error: String(err),
      })
    }

    return { success: true, data: cleanContract }
  },

  /**
   * Exclui um contrato.
   */
  async deleteContract(id: string): Promise<ServiceResult<void>> {
    const local = getLocalContracts().filter((c) => c.id !== id)
    setLocalContracts(local)

    try {
      await supabase.from('software_contracts').delete().eq('id', id)
    } catch (err) {
      logger.warn('Erro ao deletar contrato remoto', { error: String(err) })
    }

    return { success: true, data: undefined }
  },

  /**
   * Alterna ou define se o contrato foi assinado pelo cliente contratante.
   */
  async toggleContractSigned(
    contractId: string,
    forcedStatus?: boolean,
  ): Promise<ServiceResult<SoftwareContract>> {
    const contractsRes = await this.listContracts()
    if (!contractsRes.success || !contractsRes.data) {
      return { success: false, error: 'Não foi possível carregar os contratos.' }
    }
    const target = contractsRes.data.find((c) => c.id === contractId)
    if (!target) {
      return { success: false, error: 'Contrato não encontrado.' }
    }

    const nextIsSigned = forcedStatus !== undefined ? forcedStatus : !target.isSigned
    const now = new Date().toISOString()

    const updated: SoftwareContract = {
      ...target,
      isSigned: nextIsSigned,
      signedAt: nextIsSigned ? (target.signedAt || now) : null,
      updatedAt: now,
    }

    return this.saveContract(updated)
  },

  /**
   * Gera número sequencial amigável para a fatura.
   */
  generateInvoiceNumber(contractNumber: string, seq: number): string {
    const cleanNum = contractNumber.replace('CTR-', '')
    const seqStr = String(seq).padStart(2, '0')
    return `FAT-${cleanNum}-${seqStr}`
  },

  /**
   * Lista todas as faturas cadastradas (opcionalmente filtradas por contrato).
   */
  async listInvoices(contractId?: string): Promise<ServiceResult<ContractInvoice[]>> {
    try {
      let query = supabase.from('software_contract_invoices').select('*')

      if (contractId) {
        query = query.eq('contract_id', contractId)
      }

      const { data, error } = await query.order('due_date', { ascending: false })

      if (error) {
        logger.warn('Tabela software_contract_invoices não disponível, usando fallback local', {
          message: error.message,
        })
        let local = getLocalInvoices()
        if (contractId) {
          local = local.filter((inv) => inv.contractId === contractId)
        }
        return { success: true, data: local }
      }

      const mapped: ContractInvoice[] = (data || []).map((row: any) => ({
        id: row.id,
        contractId: row.contract_id,
        companyId: row.company_id,
        invoiceNumber: row.invoice_number,
        clientName: row.client_name,
        clientDocument: row.client_document,
        referenceMonth: row.reference_month,
        amount: Number(row.amount) || 0,
        dueDate: row.due_date,
        paymentDate: row.payment_date,
        paymentMethod: row.payment_method,
        status: (row.status as InvoiceStatus) || 'pending',
        pixKey: row.pix_key,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))

      const merged = contractId
        ? [...getLocalInvoices().filter((inv) => inv.contractId !== contractId), ...mapped]
        : mapped
      setLocalInvoices(merged)

      return { success: true, data: mapped }
    } catch (err: any) {
      logger.error('Erro ao listar faturas', err)
      let local = getLocalInvoices()
      if (contractId) {
        local = local.filter((inv) => inv.contractId === contractId)
      }
      return { success: true, data: local }
    }
  },

  /**
   * Salva ou atualiza uma fatura.
   */
  async saveInvoice(invoice: Partial<ContractInvoice>): Promise<ServiceResult<ContractInvoice>> {
    const isNew = !invoice.id
    const now = new Date().toISOString()
    const id = invoice.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`)

    const cleanInvoice: ContractInvoice = {
      id,
      contractId: invoice.contractId || '',
      companyId: invoice.companyId || null,
      invoiceNumber: invoice.invoiceNumber?.trim() || `FAT-${Date.now()}`,
      clientName: invoice.clientName?.trim() || 'Cliente',
      clientDocument: invoice.clientDocument?.trim() || undefined,
      referenceMonth: invoice.referenceMonth?.trim() || 'Mensalidade',
      amount: Number(invoice.amount) || 0,
      dueDate: invoice.dueDate || now.split('T')[0],
      paymentDate: invoice.paymentDate || null,
      paymentMethod: invoice.paymentMethod?.trim() || 'PIX',
      status: invoice.status || 'pending',
      pixKey: invoice.pixKey?.trim() || null,
      notes: invoice.notes?.trim() || null,
      createdAt: invoice.createdAt || now,
      updatedAt: now,
    }

    // Salva no LocalStorage
    const local = getLocalInvoices()
    const idx = local.findIndex((i) => i.id === cleanInvoice.id)
    if (idx >= 0) {
      local[idx] = cleanInvoice
    } else {
      local.unshift(cleanInvoice)
    }
    setLocalInvoices(local)

    // Tenta persistir no Supabase
    try {
      const payload: any = {
        id: cleanInvoice.id,
        contract_id: cleanInvoice.contractId,
        company_id: cleanInvoice.companyId || null,
        invoice_number: cleanInvoice.invoiceNumber,
        client_name: cleanInvoice.clientName,
        client_document: cleanInvoice.clientDocument || null,
        reference_month: cleanInvoice.referenceMonth,
        amount: cleanInvoice.amount,
        due_date: cleanInvoice.dueDate,
        payment_date: cleanInvoice.paymentDate || null,
        payment_method: cleanInvoice.paymentMethod || null,
        status: cleanInvoice.status,
        pix_key: cleanInvoice.pixKey || null,
        notes: cleanInvoice.notes || null,
        updated_at: now,
      }
      if (isNew) {
        payload.created_at = now
      }

      await supabase.from('software_contract_invoices').upsert(payload)
    } catch (err) {
      logger.warn('Erro ao sincronizar fatura com Supabase (mantida localmente)', { error: String(err) })
    }

    return { success: true, data: cleanInvoice }
  },

  /**
   * Gera um lote de faturas mensais para um contrato (ex: próximos 3, 6 ou 12 meses).
   */
  async generateInvoicesBatch(
    contract: SoftwareContract,
    monthsCount = 6,
  ): Promise<ServiceResult<ContractInvoice[]>> {
    const generated: ContractInvoice[] = []
    const existingResult = await this.listInvoices(contract.id)
    const existing = existingResult.success && existingResult.data ? existingResult.data : []
    const existingRefs = new Set(existing.map((e) => e.referenceMonth))

    const startDate = new Date()
    const billingDay = Math.min(contract.billingDay || 10, 28)

    for (let i = 0; i < monthsCount; i++) {
      const targetDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1)
      const yyyy = targetDate.getFullYear()
      const mm = String(targetDate.getMonth() + 1).padStart(2, '0')
      const refMonth = `${mm}/${yyyy}`

      if (existingRefs.has(refMonth)) {
        continue // Já existe fatura para esse mês
      }

      const dayStr = String(billingDay).padStart(2, '0')
      const dueDate = `${yyyy}-${mm}-${dayStr}`
      const invNum = this.generateInvoiceNumber(contract.contractNumber, existing.length + generated.length + 1)

      const isFirstTrialMonth = Boolean(
        contract.hasTrialPeriod && i === 0 && existing.length === 0,
      )

      const saveRes = await this.saveInvoice({
        contractId: contract.id,
        companyId: contract.companyId,
        invoiceNumber: invNum,
        clientName: contract.clientName,
        clientDocument: contract.clientDocument,
        referenceMonth: refMonth,
        amount: isFirstTrialMonth ? 0 : contract.monthlyAmount,
        dueDate,
        paymentMethod: isFirstTrialMonth ? 'Isenção / Período de Teste' : (contract.paymentMethod || 'PIX'),
        status: isFirstTrialMonth ? 'paid' : 'pending',
        paymentDate: isFirstTrialMonth ? new Date().toISOString().split('T')[0] : null,
        notes: isFirstTrialMonth
          ? `Período de Teste Gratuito de 1 Mês - Isenção total de mensalidade (${contract.planName})`
          : `Mensalidade referente ao aluguel de software - ${contract.planName}`,
      })

      if (saveRes.success && saveRes.data) {
        generated.push(saveRes.data)
      }
    }

    return { success: true, data: generated }
  },

  /**
   * Garante a geração da primeira fatura de um contrato caso ainda não possua nenhuma.
   */
  async ensureInitialInvoice(
    contract: SoftwareContract,
  ): Promise<ServiceResult<ContractInvoice | null>> {
    const existingResult = await this.listInvoices(contract.id)
    const existing = existingResult.success && existingResult.data ? existingResult.data : []
    if (existing.length > 0) {
      return { success: true, data: null }
    }

    const startDate = contract.startDate ? new Date(`${contract.startDate}T00:00:00`) : new Date()
    const yyyy = startDate.getFullYear()
    const mm = String(startDate.getMonth() + 1).padStart(2, '0')
    const refMonth = `${mm}/${yyyy}`

    const billingDay = Math.min(contract.billingDay || 10, 28)
    const dayStr = String(billingDay).padStart(2, '0')
    const dueDate = `${yyyy}-${mm}-${dayStr}`
    const invNum = this.generateInvoiceNumber(contract.contractNumber, 1)

    const isTrial = Boolean(contract.hasTrialPeriod)

    const saveRes = await this.saveInvoice({
      contractId: contract.id,
      companyId: contract.companyId,
      invoiceNumber: invNum,
      clientName: contract.clientName,
      clientDocument: contract.clientDocument,
      referenceMonth: refMonth,
      amount: isTrial ? 0 : contract.monthlyAmount,
      dueDate,
      paymentMethod: isTrial ? 'Isenção / Período de Teste' : (contract.paymentMethod || 'PIX'),
      status: isTrial ? 'paid' : 'pending',
      paymentDate: isTrial ? new Date().toISOString().split('T')[0] : null,
      notes: isTrial
        ? `Período de Teste Gratuito de 1 Mês - Isenção total de mensalidade (${contract.planName})`
        : `Mensalidade referente ao aluguel de software - ${contract.planName}`,
    })

    return saveRes
  },

  /**
   * Rotina Automática:
   * Identifica faturas que estejam a 3 dias ou menos do vencimento (ou vencidas)
   * e gera automaticamente a nova fatura do próximo ciclo no mesmo valor da anterior.
   */
  async autoGenerateInvoicesDueSoon(): Promise<ServiceResult<ContractInvoice[]>> {
    const generated: ContractInvoice[] = []
    const [cRes, iRes] = await Promise.all([this.listContracts(), this.listInvoices()])
    const contracts = cRes.success && cRes.data ? cRes.data : []
    const allInvoices = iRes.success && iRes.data ? iRes.data : []

    for (const contract of contracts) {
      if (contract.status === 'cancelled') continue

      const contractInvoices = allInvoices.filter(
        (inv) => inv.contractId === contract.id && inv.status !== 'cancelled',
      )

      if (contractInvoices.length === 0) {
        const initRes = await this.ensureInitialInvoice(contract)
        if (initRes.success && initRes.data) {
          generated.push(initRes.data)
          allInvoices.unshift(initRes.data)
        }
        continue
      }

      // Ordena por vencimento para identificar a fatura mais recente do ciclo
      const sorted = [...contractInvoices].sort((a, b) => b.dueDate.localeCompare(a.dueDate))
      const latestInvoice = sorted[0]

      // Condição: 3 dias ou menos antes do vencimento
      const diffDays = getDiffDaysFromToday(latestInvoice.dueDate)

      if (diffDays <= 3) {
        const { nextRefMonth, nextDueDate } = getNextCycleInfo(
          latestInvoice.referenceMonth,
          latestInvoice.dueDate,
          contract.billingDay,
        )

        // Se a fatura para o próximo ciclo já existir, não duplica
        const alreadyExists = contractInvoices.some(
          (inv) => inv.referenceMonth === nextRefMonth || inv.dueDate === nextDueDate,
        )
        if (alreadyExists) continue

        // Gera a nova fatura no mesmo valor da anterior (ou valor cheio caso a anterior tenha sido teste gratuito R$ 0)
        let nextAmount = latestInvoice.amount
        if (nextAmount === 0 && contract.monthlyAmount > 0) {
          nextAmount = contract.monthlyAmount
        }

        const nextInvNum = this.generateInvoiceNumber(
          contract.contractNumber,
          contractInvoices.length + generated.length + 1,
        )

        const saveRes = await this.saveInvoice({
          contractId: contract.id,
          companyId: contract.companyId,
          invoiceNumber: nextInvNum,
          clientName: contract.clientName,
          clientDocument: contract.clientDocument,
          referenceMonth: nextRefMonth,
          amount: nextAmount,
          dueDate: nextDueDate,
          paymentMethod: contract.paymentMethod || latestInvoice.paymentMethod || 'PIX',
          status: 'pending',
          pixKey: (contract as any).pixKey || latestInvoice.pixKey || null,
          notes: `Mensalidade referente ao aluguel de software - ${contract.planName || 'Sistema'} (Renovação automática)`,
        })

        if (saveRes.success && saveRes.data) {
          generated.push(saveRes.data)
          allInvoices.unshift(saveRes.data)
        }
      }
    }

    return { success: true, data: generated }
  },

  /**
   * Marca uma fatura como paga.
   */
  async markInvoiceAsPaid(
    invoiceId: string,
    paymentMethod = 'PIX',
    paymentDate?: string,
    extendLicense = false,
  ): Promise<ServiceResult<ContractInvoice>> {
    const today = new Date().toISOString().split('T')[0]
    let local = getLocalInvoices()
    let target = local.find((i) => i.id === invoiceId)

    // Se não encontrou no LocalStorage, busca direto no Supabase
    if (!target) {
      try {
        const { data: dbInv } = await supabase
          .from('software_contract_invoices')
          .select('*')
          .eq('id', invoiceId)
          .maybeSingle()

        if (dbInv) {
          target = {
            id: dbInv.id,
            contractId: dbInv.contract_id,
            companyId: dbInv.company_id,
            invoiceNumber: dbInv.invoice_number,
            clientName: dbInv.client_name,
            clientDocument: dbInv.client_document,
            referenceMonth: dbInv.reference_month,
            amount: Number(dbInv.amount) || 0,
            dueDate: dbInv.due_date,
            paymentDate: dbInv.payment_date,
            paymentMethod: dbInv.payment_method,
            status: dbInv.status,
            pixKey: dbInv.pix_key,
            notes: dbInv.notes,
            createdAt: dbInv.created_at,
            updatedAt: dbInv.updated_at,
          }
        }
      } catch (err) {
        logger.warn('Erro ao buscar fatura no Supabase para baixa:', { error: String(err) })
      }
    }

    if (!target) {
      return { success: false, error: 'Fatura não encontrada.' }
    }

    const updated: ContractInvoice = {
      ...target,
      status: 'paid',
      paymentDate: paymentDate || today,
      paymentMethod: paymentMethod || target.paymentMethod || 'PIX',
      updatedAt: new Date().toISOString(),
    }

    // Ao confirmar o pagamento da fatura, estende a licença da empresa SOMENTE se explicitamente solicitado
    if (extendLicense) {
      let effectiveCompanyId = target.companyId || null
      if (!effectiveCompanyId && target.contractId) {
        try {
          const { data: cRow } = await supabase
            .from('software_contracts')
            .select('company_id')
            .eq('id', target.contractId)
            .maybeSingle()
          if (cRow?.company_id) effectiveCompanyId = cRow.company_id
        } catch {
          // ignore
        }
      }
      if (!effectiveCompanyId && target.clientName) {
        try {
          const { data: oRow } = await supabase
            .from('organizations')
            .select('id')
            .ilike('name', target.clientName.trim())
            .limit(1)
            .maybeSingle()
          if (oRow?.id) effectiveCompanyId = oRow.id
        } catch {
          // ignore
        }
      }

      if (effectiveCompanyId) {
        try {
          const { error: rpcErr } = await supabase.rpc('admin_add_company_license_days', {
            p_company_id: effectiveCompanyId,
            p_days: 30,
          })
          if (rpcErr) {
            const { data: orgData } = await supabase
              .from('organizations')
              .select('trial_ends_at')
              .eq('id', effectiveCompanyId)
              .maybeSingle()

            const currExpiry = (orgData as any)?.trial_ends_at ? new Date((orgData as any).trial_ends_at) : null
            const now = new Date()
            const base = currExpiry && currExpiry.getTime() > now.getTime() ? currExpiry : now
            const newIso = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

            await supabase
              .from('organizations')
              .update({ trial_ends_at: newIso, is_active: true } as any)
              .eq('id', effectiveCompanyId)
          }
        } catch (e) {
          logger.warn('Erro ao estender licença na baixa de fatura:', { error: String(e) })
        }
      }
    }

    const res = await this.saveInvoice(updated)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('organization-billing-updated'))
      window.dispatchEvent(new CustomEvent('company-license-updated'))
    }
    return res
  },

  /**
   * Baixa flexível e infalível de fatura após pagamento PIX.
   * Procura a fatura por ID, por número (#FAT-...) ou pela mais antiga pendente do cliente/organização.
   */
  async settleInvoiceByPayment(params: {
    invoiceId?: string | null
    invoiceNumber?: string | null
    companyId?: string | null
    clientName?: string | null
    amount?: number | null
    paymentMethod?: string
    extendLicense?: boolean
  }): Promise<ServiceResult<ContractInvoice | null>> {
    const today = new Date().toISOString().split('T')[0]
    const method = params.paymentMethod || 'PIX'
    let local = getLocalInvoices()
    let target: ContractInvoice | undefined

    const cleanNum = params.invoiceNumber?.replace(/^#/, '').trim()

    // 1. Tenta achar por ID no LocalStorage
    if (params.invoiceId) {
      target = local.find((i) => i.id === params.invoiceId)
    }

    // 2. Tenta achar por número de fatura no LocalStorage
    if (!target && cleanNum) {
      target = local.find(
        (i) => i.invoiceNumber.replace(/^#/, '').trim().toLowerCase() === cleanNum.toLowerCase(),
      )
    }

    // 3. Tenta achar por empresa ou nome de cliente no LocalStorage (fatura pendente/vencida mais antiga)
    if (!target && (params.companyId || params.clientName)) {
      const normClient = params.clientName?.trim().toLowerCase()
      const candidateList = local
        .filter((inv) => {
          if (inv.status !== 'pending' && inv.status !== 'overdue') return false
          if (params.companyId && inv.companyId === params.companyId) return true
          if (normClient && inv.clientName.trim().toLowerCase() === normClient) return true
          return false
        })
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

      if (candidateList.length > 0) {
        target = candidateList[0]
      }
    }

    // 4. Se ainda não achou localmente, busca no Supabase
    if (!target) {
      try {
        let query = supabase.from('software_contract_invoices').select('*')
        if (params.invoiceId) {
          query = query.eq('id', params.invoiceId)
        } else if (cleanNum) {
          query = query.eq('invoice_number', cleanNum)
        } else if (params.companyId) {
          query = query.eq('company_id', params.companyId).in('status', ['pending', 'overdue'])
        } else if (params.clientName) {
          query = query.ilike('client_name', `%${params.clientName.trim()}%`).in('status', ['pending', 'overdue'])
        }

        const { data: dbRows } = await query.order('due_date', { ascending: true }).limit(1)
        let matchedRow = dbRows && dbRows[0] ? dbRows[0] : null

        // Fallback por nome do cliente caso a fatura no banco não tenha company_id vinculado
        if (!matchedRow && params.companyId && params.clientName) {
          const { data: nameRows } = await supabase
            .from('software_contract_invoices')
            .select('*')
            .ilike('client_name', `%${params.clientName.trim()}%`)
            .in('status', ['pending', 'overdue'])
            .order('due_date', { ascending: true })
            .limit(1)
          if (nameRows && nameRows[0]) {
            matchedRow = nameRows[0]
          }
        }

        if (matchedRow) {
          const row = matchedRow
          target = {
            id: row.id,
            contractId: row.contract_id,
            companyId: row.company_id,
            invoiceNumber: row.invoice_number,
            clientName: row.client_name,
            clientDocument: row.client_document,
            referenceMonth: row.reference_month,
            amount: Number(row.amount) || 0,
            dueDate: row.due_date,
            paymentDate: row.payment_date,
            paymentMethod: row.payment_method,
            status: row.status,
            pixKey: row.pix_key,
            notes: row.notes,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }
        }
      } catch (err) {
        logger.warn('Erro ao buscar fatura no Supabase para baixa flexível:', { error: String(err) })
      }
    }

    if (!target) {
      logger.warn('Nenhuma fatura correspondente encontrada para baixa.', params)
      return { success: false, error: 'Fatura não encontrada para baixa.' }
    }

    const updated: ContractInvoice = {
      ...target,
      status: 'paid',
      paymentDate: today,
      paymentMethod: method,
      updatedAt: new Date().toISOString(),
    }

    // Salva localmente
    const idx = local.findIndex((i) => i.id === updated.id || i.invoiceNumber === updated.invoiceNumber)
    if (idx >= 0) {
      local[idx] = updated
    } else {
      local.unshift(updated)
    }
    setLocalInvoices(local)

    // Atualiza no Supabase de forma resiliente (por ID e por invoice_number)
    try {
      const updatePayload = {
        status: 'paid',
        payment_date: today,
        payment_method: method,
        updated_at: new Date().toISOString(),
      }

      await supabase
        .from('software_contract_invoices')
        .update(updatePayload)
        .eq('id', updated.id)

      await supabase
        .from('software_contract_invoices')
        .update(updatePayload)
        .eq('invoice_number', updated.invoiceNumber)
    } catch (dbErr) {
      logger.warn('Erro ao sincronizar baixa da fatura no Supabase:', { error: String(dbErr) })
    }

    // Estende a licença da empresa (+30 dias) APENAS quando explicitamente solicitado (ex: no checkout PIX)
    const effectiveCompanyId = updated.companyId || params.companyId
    if (params.extendLicense && effectiveCompanyId) {
      try {
        const { error: rpcErr } = await supabase.rpc('admin_add_company_license_days', {
          p_company_id: effectiveCompanyId,
          p_days: 30,
        })
        if (rpcErr) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('trial_ends_at')
            .eq('id', effectiveCompanyId)
            .maybeSingle()

          const currExpiry = (orgData as any)?.trial_ends_at ? new Date((orgData as any).trial_ends_at) : null
          const now = new Date()
          const base = currExpiry && currExpiry.getTime() > now.getTime() ? currExpiry : now
          const newIso = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

          await supabase
            .from('organizations')
            .update({ trial_ends_at: newIso, is_active: true } as any)
            .eq('id', effectiveCompanyId)
        }
      } catch (e) {
        logger.warn('Erro ao estender licença na baixa de fatura:', { error: String(e) })
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('organization-billing-updated'))
    }

    return { success: true, data: updated }
  },

  /**
   * Sincroniza pagamentos PIX aprovados recentes com faturas em aberto.
   * Se houver fatura pendente ou vencida de uma empresa/cliente que já teve PIX aprovado,
   * realiza a baixa imediata e automática (e garante +30 dias apenas uma vez se license_activated ainda for false).
   */
  async syncApprovedPixPaymentsWithInvoices(): Promise<void> {
    try {
      const { data: approvedTxs, error } = await supabase
        .from('mercadopago_pix_transactions')
        .select('id, organization_id, contract_invoice_id, description, payer_name, amount, license_activated, license_days_granted, paid_at, created_at')
        .eq('status', 'approved')
        .order('paid_at', { ascending: false })
        .limit(20)

      if (error || !approvedTxs || approvedTxs.length === 0) return

      const undoneMap = getUndoneTimestamps()

      const { data: dbUnpaid } = await supabase
        .from('software_contract_invoices')
        .select('id, contract_id, company_id, invoice_number, client_name, due_date, status')
        .in('status', ['pending', 'overdue'])
        .order('due_date', { ascending: true })

      const localInvoices = getLocalInvoices()
      const unpaidPool: Array<{
        id: string
        companyId?: string | null
        invoiceNumber: string
        clientName: string
        dueDate: string
        status: string
      }> = []

      const seenIds = new Set<string>()
      for (const r of dbUnpaid || []) {
        seenIds.add(r.id)
        unpaidPool.push({
          id: r.id,
          companyId: r.company_id,
          invoiceNumber: r.invoice_number,
          clientName: r.client_name,
          dueDate: r.due_date,
          status: r.status,
        })
      }
      for (const l of localInvoices) {
        if (!seenIds.has(l.id) && (l.status === 'pending' || l.status === 'overdue')) {
          unpaidPool.push({
            id: l.id,
            companyId: l.companyId,
            invoiceNumber: l.invoiceNumber,
            clientName: l.clientName,
            dueDate: l.dueDate,
            status: l.status,
          })
        }
      }

      for (const tx of approvedTxs) {
        const txTimeMs = new Date(tx.paid_at || tx.created_at || 0).getTime()
        const orgUndoneIso = tx.organization_id ? undoneMap[tx.organization_id.toLowerCase()] : undefined
        const invUndoneIso = tx.contract_invoice_id ? undoneMap[tx.contract_invoice_id.toLowerCase()] : undefined
        const payerUndoneIso = tx.payer_name ? undoneMap[tx.payer_name.trim().toLowerCase()] : undefined
        const latestUndoneMs = Math.max(
          orgUndoneIso ? new Date(orgUndoneIso).getTime() : 0,
          invUndoneIso ? new Date(invUndoneIso).getTime() : 0,
          payerUndoneIso ? new Date(payerUndoneIso).getTime() : 0,
        )
        if (latestUndoneMs > 0 && txTimeMs <= latestUndoneMs) {
          continue
        }

        // Garante +30 dias UMA ÚNICA VEZ caso a transação aprovada ainda não tenha ativado a licença
        if (!tx.license_activated && tx.organization_id) {
          const days = Number(tx.license_days_granted) || 30
          try {
            const { error: rpcErr } = await supabase.rpc('admin_add_company_license_days', {
              p_company_id: tx.organization_id,
              p_days: days,
            })
            if (rpcErr) {
              const { data: orgData } = await supabase
                .from('organizations')
                .select('trial_ends_at')
                .eq('id', tx.organization_id)
                .maybeSingle()

              const currExpiry = (orgData as any)?.trial_ends_at ? new Date((orgData as any).trial_ends_at) : null
              const now = new Date()
              const base = currExpiry && currExpiry.getTime() > now.getTime() ? currExpiry : now
              const newIso = new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString()

              await supabase
                .from('organizations')
                .update({ trial_ends_at: newIso, is_active: true } as any)
                .eq('id', tx.organization_id)
            }
            await supabase
              .from('mercadopago_pix_transactions')
              .update({ license_activated: true, updated_at: new Date().toISOString() } as any)
              .eq('id', tx.id)
          } catch (actErr) {
            logger.warn('Erro ao ativar dias pendentes de PIX aprovado:', { error: String(actErr) })
          }
        }

        // 1. Se tem contract_invoice_id vinculado, essa transação pertence EXCLUSIVAMENTE a essa fatura
        if (tx.contract_invoice_id) {
          const idx = unpaidPool.findIndex((i) => i.id === tx.contract_invoice_id)
          if (idx >= 0) {
            const inv = unpaidPool[idx]
            unpaidPool.splice(idx, 1)
            await this.settleInvoiceByPayment({
              invoiceId: inv.id,
              companyId: inv.companyId || tx.organization_id,
              clientName: inv.clientName || tx.payer_name,
              extendLicense: false,
            })
          }
          // Nunca reaproveita uma transação já vinculada a um contract_invoice_id para baixar outra fatura!
          continue
        }

        // 2. Se a descrição menciona #FAT-xxxx ou FAT-xxxx, pertence EXCLUSIVAMENTE a essa fatura
        const descMatch = (tx.description || '').match(/FAT-[\w-]+/)
        if (descMatch) {
          const invNum = descMatch[0]
          const idx = unpaidPool.findIndex(
            (i) => i.invoiceNumber.replace(/^#/, '').trim().toLowerCase() === invNum.toLowerCase(),
          )
          if (idx >= 0) {
            const inv = unpaidPool[idx]
            unpaidPool.splice(idx, 1)
            await this.settleInvoiceByPayment({
              invoiceId: inv.id,
              invoiceNumber: invNum,
              companyId: inv.companyId || tx.organization_id,
              clientName: inv.clientName || tx.payer_name,
              extendLicense: false,
            })
          }
          // Nunca reaproveita uma transação de fatura específica para baixar outra fatura!
          continue
        }

        // 3. Transação genérica (sem fatura vinculada): baixa APENAS a fatura mais antiga e vincula o contract_invoice_id para não repetir
        const unpaidForOrg = unpaidPool.filter((inv) => {
          if (tx.organization_id && inv.companyId === tx.organization_id) return true
          if (tx.payer_name && inv.clientName.trim().toLowerCase() === tx.payer_name.trim().toLowerCase()) return true
          return false
        })

        if (unpaidForOrg.length > 0) {
          const oldest = unpaidForOrg.sort(
            (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
          )[0]
          const poolIdx = unpaidPool.findIndex((i) => i.id === oldest.id)
          if (poolIdx >= 0) unpaidPool.splice(poolIdx, 1)

          await this.settleInvoiceByPayment({
            invoiceId: oldest.id,
            invoiceNumber: oldest.invoiceNumber,
            companyId: oldest.companyId || tx.organization_id,
            clientName: oldest.clientName,
            extendLicense: false,
          })

          // Vincula contract_invoice_id na transação para que ela nunca baixe uma segunda fatura
          try {
            await supabase
              .from('mercadopago_pix_transactions')
              .update({ contract_invoice_id: oldest.id } as any)
              .eq('id', tx.id)
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      logger.warn('Erro ao sincronizar pagamentos PIX com faturas:', { error: String(err) })
    }
  },

  /**
   * Localiza a fatura pendente ou vencida mais antiga de uma organização e dá baixa automática.
   */
  async settleOldestUnpaidInvoiceForOrg(companyId: string, clientName?: string): Promise<ServiceResult<ContractInvoice | null>> {
    return this.settleInvoiceByPayment({ companyId, clientName })
  },

  /**
   * Desfaz a baixa do pagamento, retornando a fatura para pendente,
   * reduzindo 30 dias da licença da empresa e estornando transações PIX vinculadas para permitir novos testes.
   */
  async undoInvoicePayment(invoiceId: string): Promise<ServiceResult<ContractInvoice>> {
    const local = getLocalInvoices()
    let target = local.find((i) => i.id === invoiceId)

    if (!target) {
      try {
        const { data: dbRow } = await supabase
          .from('software_contract_invoices')
          .select('*')
          .eq('id', invoiceId)
          .maybeSingle()
        if (dbRow) {
          target = {
            id: dbRow.id,
            contractId: dbRow.contract_id,
            companyId: dbRow.company_id,
            invoiceNumber: dbRow.invoice_number,
            clientName: dbRow.client_name,
            clientDocument: dbRow.client_document,
            referenceMonth: dbRow.reference_month,
            amount: Number(dbRow.amount) || 0,
            dueDate: dbRow.due_date,
            paymentDate: dbRow.payment_date,
            paymentMethod: dbRow.payment_method,
            status: dbRow.status,
            pixKey: dbRow.pix_key,
            notes: dbRow.notes,
            createdAt: dbRow.created_at,
            updatedAt: dbRow.updated_at,
          }
        }
      } catch {
        // ignore
      }
    }

    if (!target) {
      return { success: false, error: 'Fatura não encontrada.' }
    }

    const nowIso = new Date().toISOString()
    const updated: ContractInvoice = {
      ...target,
      status: 'pending',
      paymentDate: null,
      updatedAt: nowIso,
    }

    const saveRes = await this.saveInvoice(updated)

    // Garante atualização direta no Supabase por id e por invoice_number
    try {
      await supabase
        .from('software_contract_invoices')
        .update({ status: 'pending', payment_date: null, updated_at: nowIso })
        .eq('id', updated.id)

      await supabase
        .from('software_contract_invoices')
        .update({ status: 'pending', payment_date: null, updated_at: nowIso })
        .eq('invoice_number', updated.invoiceNumber)
    } catch {
      // ignore
    }

    // Resolve o ID da empresa vinculada à fatura
    let effectiveCompanyId = target.companyId || null
    if (!effectiveCompanyId && target.contractId) {
      try {
        const { data: contractRow } = await supabase
          .from('software_contracts')
          .select('company_id')
          .eq('id', target.contractId)
          .maybeSingle()
        if (contractRow?.company_id) {
          effectiveCompanyId = contractRow.company_id
        }
      } catch {
        // ignore
      }
    }
    if (!effectiveCompanyId && target.clientName) {
      try {
        const { data: orgByName } = await supabase
          .from('organizations')
          .select('id')
          .ilike('name', target.clientName.trim())
          .limit(1)
          .maybeSingle()
        if (orgByName?.id) {
          effectiveCompanyId = orgByName.id
        }
      } catch {
        // ignore
      }
    }

    // Diminui 30 dias da licença da empresa
    if (effectiveCompanyId) {
      try {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('trial_ends_at')
          .eq('id', effectiveCompanyId)
          .maybeSingle()

        const currExpiry = (orgData as any)?.trial_ends_at || null
        const preview = calculateNewLicenseExpiry(currExpiry, 'decrease', 0)
        // Reduz até 30 dias do saldo positivo restante sem empurrar a data para -30/-61 dias no passado
        const daysToReduce = Math.min(30, preview.previousRemainingDays)
        const calc = calculateNewLicenseExpiry(
          preview.previousRemainingDays > 0 ? currExpiry : null,
          'decrease',
          daysToReduce,
        )

        const { error: rpcErr } = await supabase.rpc('admin_adjust_company_license_days', {
          p_company_id: effectiveCompanyId,
          p_days_delta: -daysToReduce,
          p_reason: `Estorno / Desfazer pagamento da fatura #${target.invoiceNumber}`,
          p_new_expiry: calc.newExpiryIso,
        })

        if (rpcErr) {
          await supabase
            .from('organizations')
            .update({
              trial_ends_at: calc.newExpiryIso,
              is_active: !calc.isBlocked,
              updated_at: nowIso,
            } as any)
            .eq('id', effectiveCompanyId)
        }
      } catch (err) {
        logger.warn('Erro ao reduzir 30 dias ao desfazer pagamento:', { error: String(err) })
      }
    }

    // Registra timestamp de estorno para que transações PIX antigas não deem baixa automática novamente no reload
    recordUndoneTimestamp(
      [
        target.id,
        target.invoiceNumber.replace(/^#/, '').trim(),
        effectiveCompanyId,
        target.clientName,
      ],
      nowIso,
    )

    // Marca TODAS as transações PIX aprovadas vinculadas como estornadas (refunded)
    try {
      const refundPayload = {
        status: 'refunded',
        status_detail: 'undone_by_admin',
        license_activated: false,
        updated_at: nowIso,
      }

      await supabase
        .from('mercadopago_pix_transactions')
        .update(refundPayload as any)
        .eq('contract_invoice_id', target.id)
        .eq('status', 'approved')

      const cleanNum = target.invoiceNumber.replace(/^#/, '').trim()
      if (cleanNum) {
        await supabase
          .from('mercadopago_pix_transactions')
          .update(refundPayload as any)
          .ilike('description', `%${cleanNum}%`)
          .eq('status', 'approved')
      }

      if (effectiveCompanyId) {
        await supabase
          .from('mercadopago_pix_transactions')
          .update(refundPayload as any)
          .eq('organization_id', effectiveCompanyId)
          .eq('status', 'approved')
      }
    } catch (txErr) {
      logger.warn('Aviso ao estornar transação PIX vinculada:', { error: String(txErr) })
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('organization-billing-updated'))
      window.dispatchEvent(new CustomEvent('company-license-updated'))
    }

    return saveRes
  },

  /**
   * Exclui uma fatura.
   */
  async deleteInvoice(invoiceId: string): Promise<ServiceResult<void>> {
    const local = getLocalInvoices().filter((i) => i.id !== invoiceId)
    setLocalInvoices(local)

    try {
      await supabase.from('software_contract_invoices').delete().eq('id', invoiceId)
    } catch (err) {
      logger.warn('Erro ao deletar fatura no Supabase', { error: String(err) })
    }

    return { success: true, data: undefined }
  },

  /**
   * Busca o contrato associado a uma organização específica.
   */
  async getContractForOrganization(orgId: string, orgName?: string): Promise<SoftwareContract | null> {
    const res = await this.listContracts()
    if (!res.success || !res.data) return null
    const list = res.data
    const normalizedName = orgName?.trim().toLowerCase()

    return (
      list.find((c) => c.companyId === orgId) ||
      (normalizedName ? list.find((c) => c.clientName.trim().toLowerCase() === normalizedName) : null) ||
      null
    )
  },

  /**
   * Lista todas as faturas associadas a uma organização específica.
   */
  async listInvoicesForOrganization(orgId: string, orgName?: string): Promise<ContractInvoice[]> {
    const [cRes, iRes] = await Promise.all([this.listContracts(), this.listInvoices()])
    const contracts = cRes.success && cRes.data ? cRes.data : []
    const invoices = iRes.success && iRes.data ? iRes.data : []

    const normalizedName = orgName?.trim().toLowerCase()

    const matchingContractIds = new Set(
      contracts
        .filter(
          (c) =>
            c.companyId === orgId ||
            (normalizedName && c.clientName.trim().toLowerCase() === normalizedName),
        )
        .map((c) => c.id),
    )

    return invoices.filter(
      (inv) =>
        inv.companyId === orgId ||
        (inv.contractId && matchingContractIds.has(inv.contractId)) ||
        (normalizedName && inv.clientName.trim().toLowerCase() === normalizedName),
    )
  },
}
