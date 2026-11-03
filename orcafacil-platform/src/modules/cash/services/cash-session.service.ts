import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UUID } from '@shared/types/common'
import type { PaymentMethod } from '@modules/sales/services/sales.service'
import {
  type CashSession,
  type CashSessionMovement,
  calculateExpectedMoney,
  reconcileCash,
  validateSessionClosure,
  toCents,
  toMoneyString,
} from '../domain/cash-session'

const SESSIONS_STORAGE_KEY_PREFIX = 'orcafacil_cash_sessions_'
const MOVEMENTS_STORAGE_KEY_PREFIX = 'orcafacil_cash_movements_'

function getLocalStorageSessions(orgId: string): CashSession[] {
  try {
    const raw = localStorage.getItem(`${SESSIONS_STORAGE_KEY_PREFIX}${orgId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CashSession[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLocalStorageSessions(orgId: string, sessions: CashSession[]) {
  try {
    localStorage.setItem(`${SESSIONS_STORAGE_KEY_PREFIX}${orgId}`, JSON.stringify(sessions))
  } catch {
    // ignorar falha de gravação local
  }
}

function getLocalStorageMovements(orgId: string, sessionId: string): CashSessionMovement[] {
  try {
    const raw = localStorage.getItem(`${MOVEMENTS_STORAGE_KEY_PREFIX}${orgId}_${sessionId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CashSessionMovement[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLocalStorageMovement(orgId: string, sessionId: string, movement: CashSessionMovement) {
  try {
    const current = getLocalStorageMovements(orgId, sessionId)
    current.push(movement)
    localStorage.setItem(
      `${MOVEMENTS_STORAGE_KEY_PREFIX}${orgId}_${sessionId}`,
      JSON.stringify(current),
    )
  } catch {
    // ignorar falha
  }
}

interface CashSessionRow {
  id: string
  organization_id: string
  register_id: string
  opened_by: string
  closed_by: string | null
  operator_name: string
  status: 'open' | 'closed'
  opening_balance: string
  opened_at: string
  closed_at: string | null
  total_sales: string
  total_money: string
  total_pix: string
  total_credit_card: string
  total_debit_card: string
  total_additional_entries: string
  total_withdrawals: string
  total_cancellations: string
  expected_money: string
  counted_money: string | null
  difference: string | null
  conference_attempts: number
  discrepancy_justification: string | null
  supervisor_authorized_by: string | null
  sales_count: number
  notes: string | null
  created_at: string
  updated_at: string
}

function mapSessionRow(row: CashSessionRow): CashSession {
  return {
    id: row.id,
    organizationId: row.organization_id,
    registerId: row.register_id,
    openedBy: row.opened_by,
    closedBy: row.closed_by,
    operatorName: row.operator_name,
    status: row.status,
    openingBalance: row.opening_balance,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    totalSales: row.total_sales,
    totalMoney: row.total_money,
    totalPix: row.total_pix,
    totalCreditCard: row.total_credit_card,
    totalDebitCard: row.total_debit_card,
    totalAdditionalEntries: row.total_additional_entries,
    totalWithdrawals: row.total_withdrawals,
    totalCancellations: row.total_cancellations,
    expectedMoney: row.expected_money,
    countedMoney: row.counted_money,
    difference: row.difference,
    conferenceAttempts: row.conference_attempts,
    discrepancyJustification: row.discrepancy_justification,
    supervisorAuthorizedBy: row.supervisor_authorized_by,
    salesCount: row.sales_count,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface OpenSessionParams {
  registerId?: string
  operatorId: string
  operatorName: string
  openingBalance: string
}

export interface RecordSaleSessionParams {
  total: string
  paymentMethod: PaymentMethod
  amountReceived?: string
}

export interface RecordMovementParams {
  type: 'supply' | 'bleed'
  amount: string
  reason: string
  userId?: string
}

export interface CloseSessionParams {
  countedMoney: string
  justification?: string
  supervisorAuth?: string
  closedBy: string
}

export const cashSessionService = {
  /**
   * Obtém a sessão de caixa atualmente aberta para o caixa/operador da organização
   */
  async getOpenSession(
    organizationId: UUID,
    registerId = 'Caixa 01',
  ): Promise<ServiceResult<CashSession | null>> {
    try {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('register_id', registerId)
        .eq('status', 'open')
        .maybeSingle()

      if (!error && data) {
        return { success: true, data: mapSessionRow(data as CashSessionRow) }
      }

      // Se der erro de tabela inexistente no cache ou não encontrar no banco, consulta localmente
      const localSessions = getLocalStorageSessions(organizationId)
      const openLocal =
        localSessions.find((s) => s.registerId === registerId && s.status === 'open') || null

      return { success: true, data: openLocal }
    } catch (err) {
      logger.warn('Erro ao consultar sessão aberta no banco, buscando localmente', err as Record<string, unknown>)
      const localSessions = getLocalStorageSessions(organizationId)
      const openLocal =
        localSessions.find((s) => s.registerId === registerId && s.status === 'open') || null
      return { success: true, data: openLocal }
    }
  },

  /**
   * Abre um novo turno/sessão de caixa
   */
  async openSession(
    organizationId: UUID,
    params: OpenSessionParams,
  ): Promise<ServiceResult<CashSession>> {
    try {
      const registerId = params.registerId || 'Caixa 01'

      // 1. Verifica se já existe um caixa aberto para este terminal
      const checkResult = await this.getOpenSession(organizationId, registerId)
      if (checkResult.success && checkResult.data) {
        const existing = checkResult.data
        if (existing.openedBy !== params.operatorId) {
          return {
            success: false,
            error: `O ${registerId} já está aberto pelo operador "${existing.operatorName}". É obrigatório realizar o fechamento do caixa anterior (Tecla F12) antes de abrir uma nova sessão.`,
          }
        }
        return { success: true, data: existing }
      }

      const initialBalanceCents = toCents(params.openingBalance)
      const initialBalanceStr = toMoneyString(initialBalanceCents)
      const nowIso = new Date().toISOString()

      // Tenta gravar no Supabase
      const { data, error } = await supabase
        .from('cash_sessions')
        .insert({
          organization_id: organizationId,
          register_id: registerId,
          opened_by: params.operatorId,
          operator_name: params.operatorName,
          status: 'open',
          opening_balance: initialBalanceStr,
          opened_at: nowIso,
          total_sales: '0.00',
          total_money: '0.00',
          total_pix: '0.00',
          total_credit_card: '0.00',
          total_debit_card: '0.00',
          total_additional_entries: '0.00',
          total_withdrawals: '0.00',
          total_cancellations: '0.00',
          expected_money: initialBalanceStr,
          conference_attempts: 0,
          sales_count: 0,
        })
        .select('*')
        .single()

      let newSession: CashSession

      if (!error && data) {
        newSession = mapSessionRow(data as CashSessionRow)
      } else {
        // Fallback local caso tabela não esteja migrada no Supabase
        newSession = {
          id: `local-session-${Date.now()}`,
          organizationId,
          registerId,
          openedBy: params.operatorId,
          closedBy: null,
          operatorName: params.operatorName,
          status: 'open',
          openingBalance: initialBalanceStr,
          openedAt: nowIso,
          closedAt: null,
          totalSales: '0.00',
          totalMoney: '0.00',
          totalPix: '0.00',
          totalCreditCard: '0.00',
          totalDebitCard: '0.00',
          totalAdditionalEntries: '0.00',
          totalWithdrawals: '0.00',
          totalCancellations: '0.00',
          expectedMoney: initialBalanceStr,
          countedMoney: null,
          difference: null,
          conferenceAttempts: 0,
          discrepancyJustification: null,
          supervisorAuthorizedBy: null,
          salesCount: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        }
      }

      // Salva ou atualiza no localStorage
      const local = getLocalStorageSessions(organizationId).filter((s) => s.id !== newSession.id)
      local.push(newSession)
      saveLocalStorageSessions(organizationId, local)

      return { success: true, data: newSession }
    } catch (err) {
      logger.error('Exceção ao abrir sessão de caixa', err)
      return { success: false, error: 'Erro inesperado ao realizar abertura de caixa.' }
    }
  },

  /**
   * Acumula os valores de uma venda finalizada na sessão de caixa ativa
   */
  async recordSaleInSession(
    organizationId: UUID,
    sessionId: string,
    params: RecordSaleSessionParams,
  ): Promise<ServiceResult<CashSession>> {
    try {
      const currentRes = await this.getOpenSession(organizationId)
      let session: CashSession | null = currentRes.success ? currentRes.data : null
      if (!session || session.id !== sessionId) {
        // busca pelo id nas locais
        const local = getLocalStorageSessions(organizationId)
        session = local.find((s) => s.id === sessionId) || null
      }

      if (!session || session.status !== 'open') {
        return { success: false, error: 'Sessão de caixa não encontrada ou já encerrada.' }
      }

      const saleCents = toCents(params.total)
      const newTotalSalesCents = toCents(session.totalSales) + saleCents
      let newTotalMoneyCents = toCents(session.totalMoney)
      let newTotalPixCents = toCents(session.totalPix)
      let newTotalCreditCents = toCents(session.totalCreditCard)
      let newTotalDebitCents = toCents(session.totalDebitCard)

      if (params.paymentMethod === 'money') {
        newTotalMoneyCents += saleCents
      } else if (params.paymentMethod === 'pix') {
        newTotalPixCents += saleCents
      } else if (params.paymentMethod === 'credit_card') {
        newTotalCreditCents += saleCents
      } else if (params.paymentMethod === 'debit_card') {
        newTotalDebitCents += saleCents
      } else {
        // other / default fallback
        newTotalMoneyCents += saleCents
      }

      const expected = calculateExpectedMoney({
        openingBalance: session.openingBalance,
        totalMoney: toMoneyString(newTotalMoneyCents),
        totalAdditionalEntries: session.totalAdditionalEntries,
        totalWithdrawals: session.totalWithdrawals,
        totalCancellations: session.totalCancellations,
      })

      const updatedFields: Partial<CashSession> = {
        totalSales: toMoneyString(newTotalSalesCents),
        totalMoney: toMoneyString(newTotalMoneyCents),
        totalPix: toMoneyString(newTotalPixCents),
        totalCreditCard: toMoneyString(newTotalCreditCents),
        totalDebitCard: toMoneyString(newTotalDebitCents),
        expectedMoney: expected.formatted,
        salesCount: session.salesCount + 1,
        updatedAt: new Date().toISOString(),
      }

      const updatedSession: CashSession = {
        ...session,
        ...updatedFields,
      }

      // Tenta atualizar no Supabase se não for ID puramente local
      if (!sessionId.startsWith('local-')) {
        await supabase
          .from('cash_sessions')
          .update({
            total_sales: updatedSession.totalSales,
            total_money: updatedSession.totalMoney,
            total_pix: updatedSession.totalPix,
            total_credit_card: updatedSession.totalCreditCard,
            total_debit_card: updatedSession.totalDebitCard,
            expected_money: updatedSession.expectedMoney,
            sales_count: updatedSession.salesCount,
            updated_at: updatedSession.updatedAt,
          })
          .eq('id', sessionId)
      }

      // Atualiza no localStorage
      const local = getLocalStorageSessions(organizationId).map((s) =>
        s.id === sessionId ? updatedSession : s,
      )
      saveLocalStorageSessions(organizationId, local)

      return { success: true, data: updatedSession }
    } catch (err) {
      logger.error('Exceção ao registrar venda na sessão de caixa', err)
      return { success: false, error: 'Erro ao sincronizar venda com a sessão do caixa.' }
    }
  },

  /**
   * Registra uma movimentação manual de suprimento ou sangria na sessão
   */
  async recordMovement(
    organizationId: UUID,
    sessionId: string,
    params: RecordMovementParams,
  ): Promise<ServiceResult<CashSession>> {
    try {
      const currentRes = await this.getOpenSession(organizationId)
      const session: CashSession | null = currentRes.success ? currentRes.data : null
      if (!session || session.id !== sessionId || session.status !== 'open') {
        return { success: false, error: 'Sessão de caixa não encontrada ou já encerrada.' }
      }

      const movementCents = toCents(params.amount)
      if (movementCents <= 0) {
        return { success: false, error: 'O valor da movimentação deve ser maior que zero.' }
      }

      let newEntriesCents = toCents(session.totalAdditionalEntries)
      let newWithdrawalsCents = toCents(session.totalWithdrawals)

      if (params.type === 'supply') {
        newEntriesCents += movementCents
      } else {
        newWithdrawalsCents += movementCents
      }

      const expected = calculateExpectedMoney({
        openingBalance: session.openingBalance,
        totalMoney: session.totalMoney,
        totalAdditionalEntries: toMoneyString(newEntriesCents),
        totalWithdrawals: toMoneyString(newWithdrawalsCents),
        totalCancellations: session.totalCancellations,
      })

      const updatedSession: CashSession = {
        ...session,
        totalAdditionalEntries: toMoneyString(newEntriesCents),
        totalWithdrawals: toMoneyString(newWithdrawalsCents),
        expectedMoney: expected.formatted,
        updatedAt: new Date().toISOString(),
      }

      const movementItem: CashSessionMovement = {
        id: `mov-${Date.now()}`,
        sessionId,
        type: params.type,
        amount: toMoneyString(movementCents),
        reason: params.reason.trim(),
        createdBy: params.userId || null,
        createdAt: new Date().toISOString(),
      }

      // Persiste no Supabase se possível
      if (!sessionId.startsWith('local-')) {
        await supabase
          .from('cash_sessions')
          .update({
            total_additional_entries: updatedSession.totalAdditionalEntries,
            total_withdrawals: updatedSession.totalWithdrawals,
            expected_money: updatedSession.expectedMoney,
            updated_at: updatedSession.updatedAt,
          })
          .eq('id', sessionId)

        try {
          await supabase.from('cash_session_movements').insert({
            organization_id: organizationId,
            session_id: sessionId,
            type: params.type,
            amount: movementItem.amount,
            reason: movementItem.reason,
            created_by: params.userId || null,
          })
        } catch (e) {
          logger.warn('Falha ao gravar movimentação no banco remoto', e as Record<string, unknown>)
        }
      }

      // Salva localmente
      saveLocalStorageMovement(organizationId, sessionId, movementItem)
      const local = getLocalStorageSessions(organizationId).map((s) =>
        s.id === sessionId ? updatedSession : s,
      )
      saveLocalStorageSessions(organizationId, local)

      return { success: true, data: updatedSession }
    } catch (err) {
      logger.error('Exceção ao registrar movimentação de caixa', err)
      return { success: false, error: 'Erro inesperado ao registrar suprimento ou sangria.' }
    }
  },

  /**
   * Realiza a conferência e o fechamento oficial do caixa (Procedimento obrigatório da Tecla F12)
   */
  async closeSession(
    organizationId: UUID,
    sessionId: string,
    params: CloseSessionParams,
  ): Promise<ServiceResult<CashSession>> {
    try {
      const currentRes = await this.getOpenSession(organizationId)
      let session: CashSession | null = currentRes.success ? currentRes.data : null
      if (!session || session.id !== sessionId) {
        const local = getLocalStorageSessions(organizationId)
        session = local.find((s) => s.id === sessionId) || null
      }

      if (!session || session.status !== 'open') {
        return { success: false, error: 'Sessão de caixa não encontrada ou já encerrada.' }
      }

      // Validação de conferência
      const closureValidation = validateSessionClosure({
        countedMoney: params.countedMoney,
        expectedMoney: session.expectedMoney,
        justification: params.justification,
      })

      if (!closureValidation.valid) {
        return { success: false, error: closureValidation.error ?? 'Divergência não justificada.' }
      }

      const reconciliation = reconcileCash(params.countedMoney, session.expectedMoney)
      const nowIso = new Date().toISOString()
      const attempts = (session.conferenceAttempts || 0) + 1

      const closedSession: CashSession = {
        ...session,
        status: 'closed',
        closedBy: params.closedBy,
        closedAt: nowIso,
        countedMoney: toMoneyString(toCents(params.countedMoney)),
        difference: reconciliation.formattedDifference,
        conferenceAttempts: attempts,
        discrepancyJustification: params.justification?.trim() || null,
        supervisorAuthorizedBy: params.supervisorAuth?.trim() || null,
        updatedAt: nowIso,
      }

      // Atualiza no Supabase se possível
      if (!sessionId.startsWith('local-')) {
        const { error } = await supabase
          .from('cash_sessions')
          .update({
            status: 'closed',
            closed_by: params.closedBy,
            closed_at: nowIso,
            counted_money: closedSession.countedMoney,
            difference: closedSession.difference,
            conference_attempts: attempts,
            discrepancy_justification: closedSession.discrepancyJustification,
            supervisor_authorized_by: closedSession.supervisorAuthorizedBy,
            updated_at: nowIso,
          })
          .eq('id', sessionId)

        if (error) {
          logger.warn('Erro ao atualizar fechamento no banco, persistindo localmente', error as unknown as Record<string, unknown>)
        }
      }

      // Atualiza lista local
      const local = getLocalStorageSessions(organizationId).map((s) =>
        s.id === sessionId ? closedSession : s,
      )
      saveLocalStorageSessions(organizationId, local)

      return { success: true, data: closedSession }
    } catch (err) {
      logger.error('Exceção ao fechar sessão de caixa', err)
      return { success: false, error: 'Erro inesperado ao fechar a sessão de caixa.' }
    }
  },

  /**
   * Retorna o histórico de todas as sessões de caixa (abertas e fechadas)
   */
  async listHistory(organizationId: UUID): Promise<ServiceResult<CashSession[]>> {
    try {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('opened_at', { ascending: false })

      if (!error && data) {
        return { success: true, data: (data as CashSessionRow[]).map(mapSessionRow) }
      }

      const local = getLocalStorageSessions(organizationId)
      return {
        success: true,
        data: local.sort(
          (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
        ),
      }
    } catch (err) {
      logger.warn('Erro ao listar histórico de sessões do banco', err as Record<string, unknown>)
      const local = getLocalStorageSessions(organizationId)
      return { success: true, data: local }
    }
  },
}
