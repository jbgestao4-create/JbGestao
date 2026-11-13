import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult } from '@shared/types/common'

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
      licensorEmail: contract.licensorEmail?.trim() || 'contato@jbsoftware.com.br',
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

      // Atualiza localmente
      const currentLocal = getLocalInvoices()
      const merged = contractId
        ? [...currentLocal.filter((inv) => inv.contractId !== contractId), ...mapped]
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
   * Marca uma fatura como paga.
   */
  async markInvoiceAsPaid(
    invoiceId: string,
    paymentMethod = 'PIX',
    paymentDate?: string,
  ): Promise<ServiceResult<ContractInvoice>> {
    const today = new Date().toISOString().split('T')[0]
    const local = getLocalInvoices()
    const target = local.find((i) => i.id === invoiceId)
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

    return this.saveInvoice(updated)
  },

  /**
   * Desfaz a baixa do pagamento, retornando para pendente.
   */
  async undoInvoicePayment(invoiceId: string): Promise<ServiceResult<ContractInvoice>> {
    const local = getLocalInvoices()
    const target = local.find((i) => i.id === invoiceId)
    if (!target) {
      return { success: false, error: 'Fatura não encontrada.' }
    }

    const updated: ContractInvoice = {
      ...target,
      status: 'pending',
      paymentDate: null,
      updatedAt: new Date().toISOString(),
    }

    return this.saveInvoice(updated)
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
