import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UUID } from '@shared/types/common'
import type { BoletoCategory } from './boleto-pdf-parser.service'
import { cashSessionService } from './cash-session.service'
import { toCents, toMoneyString } from '../domain/cash-session'

export type CashBillStatus = 'pending' | 'paid' | 'cancelled' | 'archived'
export type BillPaymentMethod =
  | 'money'
  | 'pix'
  | 'debit_card'
  | 'credit_card'
  | 'bank_transfer'
  | 'boleto'
  | 'other'

export const BILL_CATEGORIES: readonly BoletoCategory[] = [
  'Água',
  'Luz',
  'Internet',
  'Fornecedor',
  'Aluguel',
  'Impostos',
  'Outros',
] as const

export const BILL_PAYMENT_METHOD_LABELS: Record<BillPaymentMethod, string> = {
  money: 'Dinheiro (Caixa)',
  pix: 'PIX',
  debit_card: 'Cartão de Débito',
  credit_card: 'Cartão de Crédito',
  bank_transfer: 'Transferência / Conta Bancária',
  boleto: 'Compensação Bancária',
  other: 'Outro',
}

export interface CashBill {
  id: string
  organizationId: string
  description: string
  beneficiaryName: string | null
  supplierId: string | null
  supplierName: string | null
  category: BoletoCategory
  amount: string
  dueDate: string // YYYY-MM-DD
  barcode: string | null
  status: CashBillStatus
  paidAt: string | null
  paidAmount: string | null
  paymentMethod: BillPaymentMethod | null
  cashSessionId: string | null
  cashEntryId: string | null
  attachmentName: string | null
  attachmentPath: string | null
  attachmentDataUrl: string | null
  notes: string | null
  creatorName: string | null
  createdAt: string
  updatedAt: string
}

export interface CashBillAlert extends CashBill {
  daysUntilDue: number // Negativo = vencido, 0 = vence hoje, 1..10 = vence nos próximos 10 dias
  urgencyLevel: 'overdue' | 'today' | 'urgent' | 'upcoming'
}

export interface CreateCashBillParams {
  description: string
  beneficiaryName?: string | null
  supplierId?: string | null
  supplierName?: string | null
  category: BoletoCategory
  amount: string | number
  dueDate: string
  barcode?: string | null
  status?: CashBillStatus
  paymentMethod?: BillPaymentMethod | null
  attachmentFile?: File | null
  attachmentName?: string | null
  attachmentDataUrl?: string | null
  notes?: string | null
  creatorName?: string | null
  userId?: string | null
}

export interface PayCashBillParams {
  paymentMethod: BillPaymentMethod
  paidAmount?: string | number
  sessionId?: string | null
  openSessionId?: string | null
  deductFromOpenSession?: boolean
  notes?: string | null
  operatorName?: string | null
  userId?: string | null
}

const BILLS_STORAGE_KEY_PREFIX = 'orcafacil_cash_bills_'
const DISMISSED_ALERTS_KEY_PREFIX = 'orcafacil_dismissed_bill_alerts_'

function getLocalBills(orgId: string): CashBill[] {
  try {
    const raw = localStorage.getItem(`${BILLS_STORAGE_KEY_PREFIX}${orgId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CashBill[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLocalBills(orgId: string, bills: CashBill[]) {
  try {
    localStorage.setItem(`${BILLS_STORAGE_KEY_PREFIX}${orgId}`, JSON.stringify(bills))
  } catch {
    // ignore storage quota errors
  }
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${String(year)}-${month}-${day}`
}

/**
 * Calcula quantos dias faltam para o vencimento (em relação à data local de referência).
 * - Negativo: já vencido
 * - 0: vence hoje
 * - 1..10: vence nos próximos 10 dias
 */
export function calculateDaysUntilDue(dueDateStr: string, referenceDate = new Date()): number {
  const todayIso = formatLocalDate(referenceDate)
  const [tY, tM, tD] = todayIso.split('-').map(Number)
  const [dY, dM, dD] = dueDateStr.slice(0, 10).split('-').map(Number)

  const todayUtc = Date.UTC(tY, (tM || 1) - 1, tD || 1)
  const dueUtc = Date.UTC(dY, (dM || 1) - 1, dD || 1)

  return Math.round((dueUtc - todayUtc) / 86400000)
}

/**
 * Converte um File PDF em DataURL base64 para visualização rápida no navegador
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Falha ao converter PDF.'))
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo PDF.'))
    reader.readAsDataURL(file)
  })
}

interface CashBillRow {
  id: string
  organization_id: string
  description: string
  beneficiary_name: string | null
  supplier_id: string | null
  category: BoletoCategory
  amount: string | number
  due_date: string
  barcode: string | null
  status: CashBillStatus
  paid_at: string | null
  paid_amount: string | number | null
  payment_method: BillPaymentMethod | null
  cash_session_id: string | null
  cash_entry_id: string | null
  attachment_name: string | null
  attachment_path: string | null
  attachment_data_url: string | null
  notes: string | null
  creator_name: string | null
  created_at: string
  updated_at: string
  suppliers?: { name: string } | { name: string }[] | null
}

function mapBillRow(row: CashBillRow): CashBill {
  const sup = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers
  return {
    id: row.id,
    organizationId: row.organization_id,
    description: row.description,
    beneficiaryName: row.beneficiary_name,
    supplierId: row.supplier_id,
    supplierName: sup?.name ?? null,
    category: row.category || 'Outros',
    amount: toMoneyString(toCents(row.amount)),
    dueDate: row.due_date.slice(0, 10),
    barcode: row.barcode,
    status: row.status,
    paidAt: row.paid_at,
    paidAmount: row.paid_amount ? toMoneyString(toCents(row.paid_amount)) : null,
    paymentMethod: row.payment_method,
    cashSessionId: row.cash_session_id,
    cashEntryId: row.cash_entry_id,
    attachmentName: row.attachment_name,
    attachmentPath: row.attachment_path,
    attachmentDataUrl: row.attachment_data_url,
    notes: row.notes,
    creatorName: row.creator_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const cashBillsService = {
  /**
   * Lista todos os boletos e contas a pagar da organização
   */
  async listBills(organizationId: UUID): Promise<ServiceResult<CashBill[]>> {
    try {
      const localBills = getLocalBills(organizationId)

      const { data, error } = await supabase
        .from('cash_bills')
        .select('*, suppliers(name)')
        .eq('organization_id', organizationId)
        .order('due_date', { ascending: true })

      if (!error && Array.isArray(data)) {
        const remoteBills = (data as CashBillRow[]).map(mapBillRow)
        const byId = new Map<string, CashBill>()

        for (const r of remoteBills) {
          const localMatch = localBills.find((l) => l.id === r.id)
          byId.set(r.id, {
            ...r,
            supplierName: r.supplierName || localMatch?.supplierName || null,
            attachmentDataUrl: r.attachmentDataUrl || localMatch?.attachmentDataUrl || null,
          })
        }

        for (const l of localBills) {
          if (!byId.has(l.id)) {
            byId.set(l.id, l)
          }
        }

        const merged = Array.from(byId.values()).sort((a, b) =>
          a.dueDate.localeCompare(b.dueDate),
        )
        saveLocalBills(organizationId, merged)
        return { success: true, data: merged }
      }

      return {
        success: true,
        data: [...localBills].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      }
    } catch (err) {
      logger.warn('Erro ao consultar boletos no banco, usando cache local', err as Record<string, unknown>)
      const localBills = getLocalBills(organizationId)
      return {
        success: true,
        data: [...localBills].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      }
    }
  },

  /**
   * Obtém todos os boletos PENDENTES com vencimento nos próximos 10 dias (ou já vencidos)
   * Regra: dueDate <= hoje + 10 dias e status === 'pending'
   */
  async getUpcomingDueAlerts(
    organizationId: UUID,
    referenceDate = new Date(),
  ): Promise<ServiceResult<CashBillAlert[]>> {
    const listRes = await this.listBills(organizationId)
    if (!listRes.success) {
      return { success: false, error: listRes.error }
    }

    const alerts: CashBillAlert[] = []
    for (const bill of listRes.data) {
      if (bill.status !== 'pending') continue
      const daysUntilDue = calculateDaysUntilDue(bill.dueDate, referenceDate)
      if (daysUntilDue <= 10) {
        let urgencyLevel: CashBillAlert['urgencyLevel'] = 'upcoming'
        if (daysUntilDue < 0) urgencyLevel = 'overdue'
        else if (daysUntilDue === 0) urgencyLevel = 'today'
        else if (daysUntilDue <= 3) urgencyLevel = 'urgent'

        alerts.push({
          ...bill,
          daysUntilDue,
          urgencyLevel,
        })
      }
    }

    alerts.sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    return { success: true, data: alerts }
  },

  /**
   * Controle de exibição do pop-up diário na sessão atual
   */
  wasAlertDismissedInCurrentSession(organizationId: string): boolean {
    try {
      return sessionStorage.getItem(`${DISMISSED_ALERTS_KEY_PREFIX}${organizationId}`) === 'true'
    } catch {
      return false
    }
  },

  dismissAlertForCurrentSession(organizationId: string): void {
    try {
      sessionStorage.setItem(`${DISMISSED_ALERTS_KEY_PREFIX}${organizationId}`, 'true')
    } catch {
      // ignore
    }
  },

  clearAlertDismissal(organizationId: string): void {
    try {
      sessionStorage.removeItem(`${DISMISSED_ALERTS_KEY_PREFIX}${organizationId}`)
    } catch {
      // ignore
    }
  },

  /**
   * Cadastra um novo boleto ou conta a pagar
   */
  async createBill(
    organizationId: UUID,
    params: CreateCashBillParams,
  ): Promise<ServiceResult<CashBill>> {
    try {
      const cleanDesc = params.description.trim()
      if (cleanDesc.length < 2) {
        return { success: false, error: 'Informe uma descrição válida para o boleto/conta.' }
      }

      const amountCents = toCents(params.amount)
      if (amountCents <= 0) {
        return { success: false, error: 'O valor do boleto deve ser maior que zero.' }
      }

      if (!params.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(params.dueDate.slice(0, 10))) {
        return { success: false, error: 'Informe uma data de vencimento válida.' }
      }

      let attachmentDataUrl = params.attachmentDataUrl || null
      let attachmentName = params.attachmentName || null

      if (params.attachmentFile) {
        attachmentName = params.attachmentFile.name
        if (params.attachmentFile.size <= 8 * 1024 * 1024) {
          try {
            attachmentDataUrl = await fileToDataUrl(params.attachmentFile)
          } catch {
            // fallback sem dataUrl se falhar leitura
          }
        }
      }

      const amountStr = toMoneyString(amountCents)
      const dueDateStr = params.dueDate.slice(0, 10)
      const status: CashBillStatus = params.status || 'pending'
      const nowIso = new Date().toISOString()

      // Tenta criar também em cash_entries para manter a tabela de fluxo geral sincronizada
      let cashEntryId: string | null = null
      try {
        const { data: entryData } = await supabase
          .from('cash_entries')
          .insert({
            organization_id: organizationId,
            direction: 'expense',
            description: cleanDesc,
            amount: amountStr,
            category: `Boleto - ${params.category}`,
            due_date: dueDateStr,
            supplier_id: params.supplierId || null,
            notes: params.barcode
              ? `Linha Digitável: ${params.barcode}${params.notes ? ` • ${params.notes}` : ''}`
              : params.notes?.trim() || null,
            created_by: params.userId || null,
          })
          .select('id')
          .single()

        if (entryData?.id) {
          cashEntryId = String(entryData.id)
        }
      } catch {
        // Ignora se tabela cash_entries não estiver acessível
      }

      const insertPayload = {
        organization_id: organizationId,
        description: cleanDesc,
        beneficiary_name: params.beneficiaryName?.trim() || null,
        supplier_id: params.supplierId || null,
        category: params.category || 'Outros',
        amount: amountStr,
        due_date: dueDateStr,
        barcode: params.barcode?.trim() || null,
        status,
        paid_at: status === 'paid' ? nowIso : null,
        paid_amount: status === 'paid' ? amountStr : null,
        payment_method: status === 'paid' ? params.paymentMethod || 'money' : null,
        cash_entry_id: cashEntryId,
        attachment_name: attachmentName,
        attachment_data_url: attachmentDataUrl,
        notes: params.notes?.trim() || null,
        created_by: params.userId || null,
        creator_name: params.creatorName || null,
      }

      const { data, error } = await supabase
        .from('cash_bills')
        .insert(insertPayload)
        .select('*, suppliers(name)')
        .single()

      let createdBill: CashBill
      if (!error && data) {
        createdBill = {
          ...mapBillRow(data as CashBillRow),
          supplierName:
            mapBillRow(data as CashBillRow).supplierName || params.supplierName || null,
          attachmentDataUrl,
        }
      } else {
        createdBill = {
          id: crypto.randomUUID ? crypto.randomUUID() : `bill-${Date.now()}`,
          organizationId,
          description: cleanDesc,
          beneficiaryName: params.beneficiaryName?.trim() || null,
          supplierId: params.supplierId || null,
          supplierName: params.supplierName || null,
          category: params.category || 'Outros',
          amount: amountStr,
          dueDate: dueDateStr,
          barcode: params.barcode?.trim() || null,
          status,
          paidAt: status === 'paid' ? nowIso : null,
          paidAmount: status === 'paid' ? amountStr : null,
          paymentMethod: status === 'paid' ? params.paymentMethod || 'money' : null,
          cashSessionId: null,
          cashEntryId,
          attachmentName,
          attachmentPath: null,
          attachmentDataUrl,
          notes: params.notes?.trim() || null,
          creatorName: params.creatorName || null,
          createdAt: nowIso,
          updatedAt: nowIso,
        }
      }

      const currentLocal = getLocalBills(organizationId).filter((b) => b.id !== createdBill.id)
      saveLocalBills(organizationId, [createdBill, ...currentLocal])

      // Se um novo boleto pendente nos próximos 10 dias foi cadastrado, reativa o alerta
      if (status === 'pending' && calculateDaysUntilDue(dueDateStr) <= 10) {
        this.clearAlertDismissal(organizationId)
      }

      return { success: true, data: createdBill }
    } catch (err) {
      logger.error('Exceção ao cadastrar boleto', err)
      return { success: false, error: 'Erro inesperado ao salvar o boleto.' }
    }
  },

  /**
   * Realiza a baixa (pagamento) de um boleto ou conta a pagar,
   * refletindo automaticamente como saída no fluxo de caixa e na sessão de caixa aberta!
   */
  async payBill(
    organizationId: UUID,
    billId: string,
    params: PayCashBillParams,
  ): Promise<ServiceResult<CashBill>> {
    try {
      const listRes = await this.listBills(organizationId)
      const existing = listRes.success ? listRes.data.find((b) => b.id === billId) : null

      if (!existing) {
        return { success: false, error: 'Boleto ou conta a pagar não encontrado.' }
      }
      if (existing.status === 'paid') {
        return { success: false, error: 'Este boleto já consta como pago.' }
      }

      const paidAmountCents =
        params.paidAmount !== undefined && params.paidAmount !== ''
          ? toCents(params.paidAmount)
          : toCents(existing.amount)

      if (paidAmountCents <= 0) {
        return { success: false, error: 'O valor pago deve ser maior que zero.' }
      }

      const paidAmountStr = toMoneyString(paidAmountCents)
      const nowIso = new Date().toISOString()

      // Verifica se existe uma sessão de caixa aberta para lançar a saída correspondente
      let targetSessionId = params.openSessionId || params.sessionId || null
      if (!targetSessionId) {
        const bestOpen = await cashSessionService.findBestOpenSession(
          organizationId,
          params.userId || undefined,
        )
        if (bestOpen) {
          targetSessionId = bestOpen.id
        }
      }

      // Se houver caixa aberto e o pagamento for em Dinheiro do caixa (ou marcado para descontar do caixa),
      // registra automaticamente a saída (Sangria de Pagamento de Boleto/Fornecedor) na sessão!
      const shouldDeductFromCashDrawer =
        params.deductFromOpenSession !== undefined
          ? params.deductFromOpenSession
          : params.paymentMethod === 'money'

      if (targetSessionId && shouldDeductFromCashDrawer) {
        await cashSessionService.recordMovement(organizationId, targetSessionId, {
          type: 'bleed',
          amount: paidAmountStr,
          reason: `Baixa de Boleto (${existing.category}): ${existing.description}`,
          category: `Pagamento de Boleto (${existing.category})`,
          referenceId: existing.id,
          operatorName: params.operatorName || undefined,
          userId: params.userId || undefined,
        })
      }

      // Atualiza no banco remoto se possível
      try {
        await supabase
          .from('cash_bills')
          .update({
            status: 'paid',
            paid_at: nowIso,
            paid_amount: paidAmountStr,
            payment_method: params.paymentMethod,
            cash_session_id: targetSessionId,
            notes: params.notes
              ? existing.notes
                ? `${existing.notes} • Baixa: ${params.notes}`
                : params.notes
              : existing.notes,
            updated_at: nowIso,
          })
          .eq('organization_id', organizationId)
          .eq('id', billId)
      } catch {
        // fallback local
      }

      const updatedBill: CashBill = {
        ...existing,
        status: 'paid',
        paidAt: nowIso,
        paidAmount: paidAmountStr,
        paymentMethod: params.paymentMethod,
        cashSessionId: targetSessionId,
        notes: params.notes
          ? existing.notes
            ? `${existing.notes} • Baixa: ${params.notes}`
            : params.notes
          : existing.notes,
        updatedAt: nowIso,
      }

      const local = getLocalBills(organizationId).map((b) =>
        b.id === billId ? updatedBill : b,
      )
      saveLocalBills(organizationId, local)

      return { success: true, data: updatedBill }
    } catch (err) {
      logger.error('Exceção ao dar baixa no boleto', err)
      return { success: false, error: 'Erro inesperado ao registrar pagamento do boleto.' }
    }
  },

  /**
   * Altera o status de um boleto (ex: 'archived' para Remover/Arquivar do alerta, ou 'cancelled')
   */
  async updateBillStatus(
    organizationId: UUID,
    billId: string,
    status: CashBillStatus,
  ): Promise<ServiceResult<void>> {
    try {
      const nowIso = new Date().toISOString()

      try {
        await supabase
          .from('cash_bills')
          .update({ status, updated_at: nowIso })
          .eq('organization_id', organizationId)
          .eq('id', billId)
      } catch {
        // fallback local
      }

      const local = getLocalBills(organizationId).map((b) =>
        b.id === billId ? { ...b, status, updatedAt: nowIso } : b,
      )
      saveLocalBills(organizationId, local)

      return { success: true, data: undefined }
    } catch {
      return { success: false, error: 'Não foi possível atualizar o status do boleto.' }
    }
  },

  /**
   * Exclui permanentemente um boleto
   */
  async deleteBill(organizationId: UUID, billId: string): Promise<ServiceResult<void>> {
    try {
      try {
        await supabase
          .from('cash_bills')
          .delete()
          .eq('organization_id', organizationId)
          .eq('id', billId)
      } catch {
        // fallback local
      }

      const local = getLocalBills(organizationId).filter((b) => b.id !== billId)
      saveLocalBills(organizationId, local)
      return { success: true, data: undefined }
    } catch {
      return { success: false, error: 'Não foi possível remover o boleto.' }
    }
  },
}

