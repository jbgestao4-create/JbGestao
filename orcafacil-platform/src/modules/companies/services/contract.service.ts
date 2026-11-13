import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult } from '@shared/types/common'

export type ContractStatus = 'active' | 'draft' | 'cancelled' | 'suspended'

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
}
