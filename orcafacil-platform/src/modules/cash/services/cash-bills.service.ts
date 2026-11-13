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
  money: 'Dinheiro (Saldo Físico)',
  pix: 'PIX (Saldo em Conta)',
  debit_card: 'Cartão de Débito (Saldo em Conta)',
  credit_card: 'Cartão de Crédito (Saldo em Conta)',
  bank_transfer: 'Sangrias p/ Conta / Transferência (Saldo em Conta)',
  boleto: 'Compensação Bancária (Saldo em Conta)',
  other: 'Outro (Saldo em Conta)',
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
  attachmentUrl?: string | null
  attachmentName?: string | null
  attachmentFile?: File | null
  notes?: string | null
  operatorName?: string | null
  userId?: string | null
}

const DISMISSED_ALERTS_KEY_PREFIX = 'orcafacil_dismissed_bill_alerts_'
const RESUME_BILL_ALERT_AFTER_CASH_OPEN_KEY = 'orcafacil_resume_bill_alert_after_cash_open'

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
  attachment_data_url?: string | null
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
    attachmentDataUrl: row.attachment_data_url || null,
    notes: row.notes,
    creatorName: row.creator_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const cashBillsService = {
  /**
   * Lista todos os boletos e contas a pagar da organização
   * Otimização: remove attachment_data_url para evitar download de PDFs em base64 na listagem geral
   */
  async listBills(organizationId: UUID): Promise<ServiceResult<CashBill[]>> {
    try {
      const { data, error } = await supabase
        .from('cash_bills')
        .select(`
          id,
          organization_id,
          description,
          beneficiary_name,
          supplier_id,
          category,
          amount,
          due_date,
          barcode,
          status,
          paid_at,
          paid_amount,
          payment_method,
          cash_session_id,
          cash_entry_id,
          attachment_name,
          attachment_path,
          notes,
          created_by,
          creator_name,
          created_at,
          updated_at,
          suppliers (
            name
          )
        `)
        .eq('organization_id', organizationId)
        .order('due_date', { ascending: true })

      if (error) {
        logger.error('Erro ao consultar boletos no Supabase', error)
        return { success: false, error: 'Não foi possível carregar os boletos e contas a pagar.' }
      }

      return {
        success: true,
        data: ((data ?? []) as unknown as CashBillRow[])
          .map(mapBillRow)
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      }
    } catch (err) {
      logger.error('Erro inesperado ao consultar boletos no Supabase', err)
      return { success: false, error: 'Não foi possível carregar os boletos e contas a pagar.' }
    }
  },

  /**
   * Busca o anexo (PDF / imagem) do boleto sob demanda, somente quando solicitado pelo usuário
   */
  async getBillAttachment(organizationId: UUID, billId: string): Promise<ServiceResult<string | null>> {
    try {
      const { data, error } = await supabase
        .from('cash_bills')
        .select('attachment_data_url')
        .eq('organization_id', organizationId)
        .eq('id', billId)
        .maybeSingle()

      if (error) {
        logger.error('Erro ao consultar anexo do boleto no Supabase', error)
        return { success: false, error: 'Não foi possível carregar o anexo do boleto.' }
      }

      return {
        success: true,
        data: (data as { attachment_data_url: string | null } | null)?.attachment_data_url || null,
      }
    } catch (err) {
      logger.error('Erro inesperado ao consultar anexo do boleto no Supabase', err)
      return { success: false, error: 'Não foi possível carregar o anexo do boleto.' }
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

  clearAllAlertDismissals(): void {
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && key.startsWith(DISMISSED_ALERTS_KEY_PREFIX)) {
          keysToRemove.push(key)
        }
      }
      for (const key of keysToRemove) {
        sessionStorage.removeItem(key)
      }
      sessionStorage.removeItem(RESUME_BILL_ALERT_AFTER_CASH_OPEN_KEY)
    } catch {
      // ignore
    }
  },

  savePendingAlertPaymentForCashOpen(organizationId: string, billId: string | null): void {
    try {
      sessionStorage.setItem(
        RESUME_BILL_ALERT_AFTER_CASH_OPEN_KEY,
        JSON.stringify({ organizationId, billId }),
      )
    } catch {
      // ignore
    }
  },

  consumePendingAlertPaymentForCashOpen(
    organizationId: string,
  ): { billId: string | null } | null {
    try {
      const raw = sessionStorage.getItem(RESUME_BILL_ALERT_AFTER_CASH_OPEN_KEY)
      if (!raw) return null
      sessionStorage.removeItem(RESUME_BILL_ALERT_AFTER_CASH_OPEN_KEY)
      const parsed = JSON.parse(raw) as { organizationId?: string; billId?: string | null }
      if (parsed.organizationId && parsed.organizationId !== organizationId) {
        return null
      }
      return { billId: parsed.billId ?? null }
    } catch {
      return null
    }
  },

  clearPendingAlertPaymentForCashOpen(): void {
    try {
      sessionStorage.removeItem(RESUME_BILL_ALERT_AFTER_CASH_OPEN_KEY)
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

      if (error || !data) {
        logger.error('Erro ao cadastrar boleto no Supabase', error)
        const errMsg = error?.message?.includes('row-level security')
          ? 'Erro de permissão no Supabase (RLS): o usuário atual não tem permissão para cadastrar boletos nesta empresa. Aplique a migration 00117 no Supabase.'
          : 'Não foi possível salvar o boleto no Supabase.'
        return { success: false, error: errMsg }
      }

      const row = mapBillRow(data as CashBillRow)
      const createdBill: CashBill = {
        ...row,
        supplierName: row.supplierName || params.supplierName || null,
        attachmentDataUrl,
      }

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

      // Verifica se existe uma sessão de Caixa Geral aberta para lançar a saída correspondente
      let targetSessionId = params.openSessionId || params.sessionId || null
      if (!targetSessionId) {
        const mgmtRes = await cashSessionService.getOpenCashManagementSession(organizationId)
        if (mgmtRes.success && mgmtRes.data) {
          targetSessionId = mgmtRes.data.id
        } else {
          const openMgmt = await cashSessionService.findBestOpenSession(
            organizationId,
            params.userId || undefined,
            'cash_management',
          )
          targetSessionId = openMgmt?.id || null
        }
      }

      // Regra de negócio obrigatória: Baixa de fatura/boleto só é permitida com o Caixa Geral aberto
      if (!targetSessionId) {
        return {
          success: false,
          error: 'Para realizar o pagamento do boleto o caixa deve estar aberto.',
        }
      }

      // Faz upload do comprovante se fornecido como arquivo
      let finalAttachmentUrl = params.attachmentUrl || null
      let finalAttachmentName = params.attachmentName || null

      if (!finalAttachmentUrl && params.attachmentFile) {
        const uploadRes = await cashSessionService.uploadMovementAttachment(
          organizationId,
          params.attachmentFile,
        )
        if (uploadRes.success && uploadRes.data) {
          finalAttachmentUrl = uploadRes.data.url
          finalAttachmentName = uploadRes.data.fileName
        }
      }

      // Se houver caixa aberto e estiver marcado para realizar a sangria:
      // - Dinheiro ('money') desconta do Saldo Físico (gaveta)
      // - PIX, Cartões ou Sangrias p/ Conta descontam do Saldo em Conta
      const shouldDeductFromCashDrawer = params.deductFromOpenSession !== false

      if (targetSessionId && shouldDeductFromCashDrawer) {
        const isPhysicalMoney = params.paymentMethod === 'money'
        const balanceTag = isPhysicalMoney ? '[Saldo Físico]' : '[Saída Saldo em Conta]'
        const movRes = await cashSessionService.recordMovement(organizationId, targetSessionId, {
          type: 'bleed',
          amount: paidAmountStr,
          reason: `Baixa de Boleto/Fatura (${existing.category}): ${existing.description} • ${balanceTag}`,
          category: isPhysicalMoney
            ? `Pagamento de Boleto - Saldo Físico (${existing.category})`
            : `Pagamento de Boleto - Saída Saldo em Conta (${existing.category})`,
          referenceId: existing.id,
          attachmentUrl: finalAttachmentUrl || existing.attachmentDataUrl || null,
          attachmentName: finalAttachmentName || existing.attachmentName || null,
          operatorName: params.operatorName || undefined,
          userId: params.userId || undefined,
          deductFromPhysicalCash: isPhysicalMoney,
        })

        if (!movRes.success) {
          logger.warn('Aviso ao registrar sangria no caixa aberto', { error: movRes.error })
        }
      }

      const { error: updateError } = await supabase
        .from('cash_bills')
        .update({
            status: 'paid',
            paid_at: nowIso,
            paid_amount: paidAmountStr,
            payment_method: params.paymentMethod,
            cash_session_id: targetSessionId,
            attachment_name: finalAttachmentName || existing.attachmentName || null,
            attachment_data_url: finalAttachmentUrl || existing.attachmentDataUrl || null,
            notes: params.notes
              ? existing.notes
                ? `${existing.notes} • Baixa: ${params.notes}`
                : params.notes
              : existing.notes,
            updated_at: nowIso,
          })
          .eq('organization_id', organizationId)
          .eq('id', billId)

      if (updateError) {
        logger.error('Erro ao registrar pagamento do boleto no Supabase', updateError)
        const errMsg = updateError?.message?.includes('row-level security')
          ? 'Erro de permissão no Supabase (RLS): o usuário atual não tem permissão para atualizar boletos nesta empresa. Aplique a migration 00117 no Supabase.'
          : 'Não foi possível registrar o pagamento no Supabase.'
        return { success: false, error: errMsg }
      }

      const updatedBill: CashBill = {
        ...existing,
        status: 'paid',
        paidAt: nowIso,
        paidAmount: paidAmountStr,
        paymentMethod: params.paymentMethod,
        cashSessionId: targetSessionId,
        attachmentName: finalAttachmentName || existing.attachmentName || null,
        attachmentDataUrl: finalAttachmentUrl || existing.attachmentDataUrl || null,
        notes: params.notes
          ? existing.notes
            ? `${existing.notes} • Baixa: ${params.notes}`
            : params.notes
          : existing.notes,
        updatedAt: nowIso,
      }

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

      const { error } = await supabase
        .from('cash_bills')
        .update({ status, updated_at: nowIso })
        .eq('organization_id', organizationId)
        .eq('id', billId)

      if (error) {
        logger.error('Erro ao atualizar status do boleto no Supabase', error)
        return { success: false, error: 'Não foi possível atualizar o status do boleto.' }
      }

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
      const { error } = await supabase
        .from('cash_bills')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', billId)

      if (error) {
        logger.error('Erro ao excluir boleto no Supabase', error)
        return { success: false, error: 'Não foi possível remover o boleto.' }
      }

      return { success: true, data: undefined }
    } catch {
      return { success: false, error: 'Não foi possível remover o boleto.' }
    }
  },
}
