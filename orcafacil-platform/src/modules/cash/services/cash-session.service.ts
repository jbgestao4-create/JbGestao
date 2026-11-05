import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UUID } from '@shared/types/common'
import type { PaymentMethod } from '@modules/sales/services/sales.service'
import {
  type CashRegister,
  type CashSession,
  type CashSessionMovement,
  calculateExpectedMoney,
  reconcileFullSession,
  validateSessionClosure,
  toCents,
  toMoneyString,
} from '../domain/cash-session'

const SESSIONS_STORAGE_KEY_PREFIX = 'orcafacil_cash_sessions_'
const MOVEMENTS_STORAGE_KEY_PREFIX = 'orcafacil_cash_movements_'
const REGISTERS_STORAGE_KEY_PREFIX = 'orcafacil_cash_registers_'
const SELECTED_REGISTER_KEY_PREFIX = 'orcafacil_selected_register_'

function getLocalStorageRegisters(orgId: string): CashRegister[] {
  try {
    const raw = localStorage.getItem(`${REGISTERS_STORAGE_KEY_PREFIX}${orgId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CashRegister[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLocalStorageRegisters(orgId: string, registers: CashRegister[]) {
  try {
    localStorage.setItem(`${REGISTERS_STORAGE_KEY_PREFIX}${orgId}`, JSON.stringify(registers))
  } catch {
    // ignorar falha de gravação local
  }
}

interface CashRegisterRow {
  id: string
  organization_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

function mapRegisterRow(row: CashRegisterRow): CashRegister {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

function getLocalStorageSessions(orgId: string): CashSession[] {
  try {
    const raw = localStorage.getItem(`${SESSIONS_STORAGE_KEY_PREFIX}${orgId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CashSession[]
    if (!Array.isArray(parsed)) return []

    // Garante que cada operador tenha no máximo 1 caixa aberto por vez no cache local
    const seenOpenByOperator = new Set<string>()
    let modified = false
    const sanitized = parsed.map((session) => {
      if (session.status === 'open') {
        if (seenOpenByOperator.has(session.openedBy)) {
          modified = true
          return {
            ...session,
            status: 'closed' as const,
            closedBy: session.openedBy,
            closedAt: new Date().toISOString(),
            countedMoney: session.expectedMoney,
            difference: '0.00',
          }
        }
        seenOpenByOperator.add(session.openedBy)
      }
      return session
    })

    if (modified) {
      saveLocalStorageSessions(orgId, sanitized)
    }

    return sanitized
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
  total_bill_payments?: string
  expected_money: string
  counted_money: string | null
  counted_pix?: string | null
  counted_credit_card?: string | null
  counted_debit_card?: string | null
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
    openingBalance: String(row.opening_balance ?? '0.00'),
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    totalSales: String(row.total_sales ?? '0.00'),
    totalMoney: String(row.total_money ?? '0.00'),
    totalPix: String(row.total_pix ?? '0.00'),
    totalCreditCard: String(row.total_credit_card ?? '0.00'),
    totalDebitCard: String(row.total_debit_card ?? '0.00'),
    totalAdditionalEntries: String(row.total_additional_entries ?? '0.00'),
    totalWithdrawals: String(row.total_withdrawals ?? '0.00'),
    totalCancellations: String(row.total_cancellations ?? '0.00'),
    totalBillPayments: String(row.total_bill_payments ?? '0.00'),
    expectedMoney: String(row.expected_money ?? '0.00'),
    countedMoney: row.counted_money !== null && row.counted_money !== undefined ? String(row.counted_money) : null,
    countedPix: row.counted_pix !== null && row.counted_pix !== undefined ? String(row.counted_pix) : null,
    countedCreditCard:
      row.counted_credit_card !== null && row.counted_credit_card !== undefined
        ? String(row.counted_credit_card)
        : null,
    countedDebitCard:
      row.counted_debit_card !== null && row.counted_debit_card !== undefined
        ? String(row.counted_debit_card)
        : null,
    difference: row.difference !== null && row.difference !== undefined ? String(row.difference) : null,
    conferenceAttempts: row.conference_attempts ?? 0,
    discrepancyJustification: row.discrepancy_justification,
    supervisorAuthorizedBy: row.supervisor_authorized_by,
    salesCount: row.sales_count ?? 0,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface OpenSessionParams {
  registerId?: string
  registerName?: string
  operatorId: string
  operatorName: string
  openingBalance: string | number
  notes?: string
}

export interface RecordSaleSessionParams {
  total: string
  paymentMethod: PaymentMethod
  amountReceived?: string
}

export interface RecordMovementParams {
  type: 'supply' | 'bleed'
  amount: string | number
  reason: string
  category?: string
  referenceId?: string
  operatorName?: string
  userId?: string
}

export interface CloseSessionParams {
  countedMoney: string | number
  countedPix?: string | number
  countedCreditCard?: string | number
  countedDebitCard?: string | number
  justification?: string
  discrepancyJustification?: string
  supervisorAuth?: string
  closedBy?: string
  operatorId?: string
  notes?: string
}

export const cashSessionService = {
  /**
   * Obtém o nome do Caixa PDV selecionado para este terminal/navegador (padrão: 'Caixa 01')
   */
  getSelectedRegisterName(organizationId: string): string {
    try {
      const saved = localStorage.getItem(`${SELECTED_REGISTER_KEY_PREFIX}${organizationId}`)
      return saved?.trim() || 'Caixa 01'
    } catch {
      return 'Caixa 01'
    }
  },

  /**
   * Define o Caixa PDV selecionado para este terminal/navegador
   */
  setSelectedRegisterName(organizationId: string, registerName: string): void {
    try {
      const clean = registerName.trim() || 'Caixa 01'
      localStorage.setItem(`${SELECTED_REGISTER_KEY_PREFIX}${organizationId}`, clean)
    } catch {
      // ignorar falha
    }
  },

  /**
   * Lista todos os Caixas PDV cadastrados na organização (garantindo 'Caixa 01' como padrão)
   */
  async listRegisters(organizationId: UUID): Promise<ServiceResult<CashRegister[]>> {
    const defaultRegister: CashRegister = {
      id: 'default-caixa-01',
      organizationId,
      name: 'Caixa 01',
      description: 'Terminal principal de frente de caixa',
      isActive: true,
      createdAt: new Date(0).toISOString(),
    }

    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name', { ascending: true })

      const localRegisters = getLocalStorageRegisters(organizationId).filter(
        (r) => r.id !== 'default-caixa-01',
      )
      const combinedMap = new Map<string, CashRegister>()

      if (!error && Array.isArray(data)) {
        for (const row of data as CashRegisterRow[]) {
          const mapped = mapRegisterRow(row)
          combinedMap.set(mapped.name.toLocaleLowerCase('pt-BR'), mapped)
        }
      } else {
        for (const loc of localRegisters) {
          if (loc.isActive !== false) {
            const key = loc.name.toLocaleLowerCase('pt-BR')
            if (!combinedMap.has(key)) {
              combinedMap.set(key, loc)
            }
          }
        }
      }

      if (combinedMap.size === 0) {
        combinedMap.set('caixa 01', defaultRegister)
      }

      const list = Array.from(combinedMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR', { numeric: true }),
      )
      saveLocalStorageRegisters(
        organizationId,
        list.filter((r) => r.id !== 'default-caixa-01'),
      )
      return { success: true, data: list }
    } catch {
      const localRegisters = getLocalStorageRegisters(organizationId).filter(
        (r) => r.id !== 'default-caixa-01',
      )
      const list = localRegisters.length > 0 ? localRegisters : [defaultRegister]
      return {
        success: true,
        data: list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })),
      }
    }
  },

  /**
   * Cadastra um novo Caixa PDV na organização
   */
  async createRegister(
    organizationId: UUID,
    params: string | { name: string; description?: string },
  ): Promise<ServiceResult<CashRegister>> {
    try {
      const payload = typeof params === 'string' ? { name: params } : params
      const cleanName = payload.name.trim()
      const cleanDesc = payload.description?.trim() || null

      if (!cleanName) {
        return { success: false, error: 'Informe o nome/identificação do Caixa PDV.' }
      }
      if (cleanName.length > 80) {
        return { success: false, error: 'O nome do Caixa PDV deve ter no máximo 80 caracteres.' }
      }

      const existingRes = await this.listRegisters(organizationId)
      const existingList = (existingRes.success ? existingRes.data : []).filter(
        (r) => r.id !== 'default-caixa-01',
      )
      if (
        existingList.some(
          (r) => r.name.toLocaleLowerCase('pt-BR') === cleanName.toLocaleLowerCase('pt-BR'),
        )
      ) {
        return { success: false, error: `Já existe um caixa cadastrado com o nome "${cleanName}".` }
      }

      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from('cash_registers')
        .insert({
          organization_id: organizationId,
          name: cleanName,
          description: cleanDesc,
          is_active: true,
        })
        .select('*')
        .single()

      let created: CashRegister
      if (!error && data) {
        created = mapRegisterRow(data as CashRegisterRow)
      } else {
        created = {
          id: `local-reg-${Date.now()}`,
          organizationId,
          name: cleanName,
          description: cleanDesc,
          isActive: true,
          createdAt: nowIso,
        }
      }

      const updatedLocal = [
        ...existingList.filter(
          (r) => r.name.toLocaleLowerCase('pt-BR') !== cleanName.toLocaleLowerCase('pt-BR'),
        ),
        created,
      ]
      saveLocalStorageRegisters(organizationId, updatedLocal)

      return { success: true, data: created }
    } catch (err) {
      logger.error('Erro ao cadastrar Caixa PDV', err)
      return { success: false, error: 'Erro inesperado ao cadastrar Caixa PDV.' }
    }
  },

  /**
   * Remove um Caixa PDV cadastrado (desde que não esteja com sessão aberta)
   */
  async deleteRegister(
    organizationId: UUID,
    registerId: string,
    registerName: string,
  ): Promise<ServiceResult<void>> {
    try {
      const openRes = await this.getOpenSession(organizationId, registerName)
      if (openRes.success && openRes.data) {
        return {
          success: false,
          error: `Não é possível excluir o "${registerName}" pois ele está com sessão aberta pelo operador "${openRes.data.operatorName}".`,
        }
      }

      if (!registerId.startsWith('local-') && registerId !== 'default-caixa-01') {
        await supabase
          .from('cash_registers')
          .delete()
          .eq('organization_id', organizationId)
          .eq('id', registerId)
      }

      const local = getLocalStorageRegisters(organizationId).filter(
        (r) =>
          r.id !== registerId &&
          r.name.toLocaleLowerCase('pt-BR') !== registerName.trim().toLocaleLowerCase('pt-BR'),
      )
      saveLocalStorageRegisters(organizationId, local)

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Erro ao remover Caixa PDV', err)
      return { success: false, error: 'Erro ao remover Caixa PDV.' }
    }
  },

  /**
   * Lista todas as sessões abertas no momento em qualquer caixa da organização
   */
  async listOpenSessions(organizationId: UUID): Promise<ServiceResult<CashSession[]>> {
    try {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'open')

      const localOpen = getLocalStorageSessions(organizationId).filter((s) => s.status === 'open')

      if (!error && Array.isArray(data)) {
        const remoteOpen = (data as CashSessionRow[]).map(mapSessionRow)
        const byRegister = new Map<string, CashSession>()
        const seenOperators = new Set<string>()

        for (const s of [...remoteOpen, ...localOpen]) {
          if (!byRegister.has(s.registerId) && !seenOperators.has(s.openedBy)) {
            byRegister.set(s.registerId, s)
            seenOperators.add(s.openedBy)
          }
        }
        return { success: true, data: Array.from(byRegister.values()) }
      }

      return { success: true, data: localOpen }
    } catch {
      const local = getLocalStorageSessions(organizationId).filter((s) => s.status === 'open')
      return { success: true, data: local }
    }
  },

  /**
   * Localiza a sessão aberta mais adequada para vincular vendas/OS automaticamente
   */
  async findBestOpenSession(
    organizationId: UUID,
    preferredOperatorId?: string,
  ): Promise<CashSession | null> {
    try {
      const selectedReg = this.getSelectedRegisterName(organizationId)
      const openListRes = await this.listOpenSessions(organizationId)
      if (openListRes.success && openListRes.data.length > 0) {
        if (preferredOperatorId) {
          const byOp = openListRes.data.find((s) => s.openedBy === preferredOperatorId)
          if (byOp) return byOp
        }
        const byReg = openListRes.data.find((s) => s.registerId === selectedReg)
        if (byReg) return byReg
        return openListRes.data[0]
      }
      const fallback = await this.getOpenSession(organizationId, selectedReg)
      return fallback.success ? fallback.data : null
    } catch {
      return null
    }
  },

  /**
   * Busca uma sessão de caixa específica pelo ID (independente do nome do caixa)
   */
  async getSessionById(organizationId: UUID, sessionId: string): Promise<CashSession | null> {
    try {
      if (!sessionId.startsWith('local-')) {
        const { data, error } = await supabase
          .from('cash_sessions')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('id', sessionId)
          .maybeSingle()

        if (!error && data) {
          return mapSessionRow(data as CashSessionRow)
        }
      }
    } catch {
      // fallback abaixo
    }

    const local = getLocalStorageSessions(organizationId)
    const foundLocal = local.find((s) => s.id === sessionId)
    if (foundLocal) return foundLocal

    const openRes = await this.getOpenSession(organizationId)
    if (openRes.success && openRes.data && openRes.data.id === sessionId) {
      return openRes.data
    }
    return null
  },

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

      // 2. Impede que o mesmo usuário abra dois caixas diferentes simultaneamente
      const openListRes = await this.listOpenSessions(organizationId)
      if (openListRes.success) {
        const otherOpenByUser = openListRes.data.find(
          (s) => s.openedBy === params.operatorId && s.registerId !== registerId && s.status === 'open',
        )
        if (otherOpenByUser) {
          return {
            success: false,
            error: `Você já possui o "${otherOpenByUser.registerId}" aberto. Cada usuário só pode ter um caixa aberto por vez. Feche primeiro o "${otherOpenByUser.registerId}" para abrir outro caixa.`,
          }
        }
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
          notes: params.notes?.trim() || null,
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
          totalBillPayments: '0.00',
          expectedMoney: initialBalanceStr,
          countedMoney: null,
          countedPix: null,
          countedCreditCard: null,
          countedDebitCard: null,
          difference: null,
          conferenceAttempts: 0,
          discrepancyJustification: null,
          supervisorAuthorizedBy: null,
          salesCount: 0,
          notes: params.notes?.trim() || null,
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
   * Acumula os valores de uma venda ou O.S. finalizada na sessão de caixa ativa
   */
  async recordSaleInSession(
    organizationId: UUID,
    sessionId: string,
    params: RecordSaleSessionParams,
  ): Promise<ServiceResult<CashSession>> {
    try {
      const session = await this.getSessionById(organizationId, sessionId)

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
      } else if (params.paymentMethod !== 'on_credit') {
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
   * Lista todas as movimentações manuais (suprimentos e sangrias) de uma sessão de caixa
   */
  async listMovements(
    organizationId: UUID,
    sessionId: string,
  ): Promise<ServiceResult<CashSessionMovement[]>> {
    try {
      const localMovements = getLocalStorageMovements(organizationId, sessionId)

      if (!sessionId.startsWith('local-')) {
        const { data, error } = await supabase
          .from('cash_session_movements')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })

        if (!error && Array.isArray(data)) {
          const remote: CashSessionMovement[] = data.map((row: Record<string, unknown>) => ({
            id: String(row.id),
            sessionId: String(row.session_id),
            type: (row.type === 'supply' ? 'supply' : 'bleed') as 'supply' | 'bleed',
            amount: String(row.amount ?? '0.00'),
            reason: String(row.reason ?? ''),
            createdBy: row.created_by ? String(row.created_by) : null,
            createdAt: String(row.created_at ?? new Date().toISOString()),
          }))

          const mergedMap = new Map<string, CashSessionMovement>()
          for (const item of [...remote, ...localMovements]) {
            const key = `${item.type}_${item.amount}_${item.reason}_${item.createdAt.slice(0, 16)}`
            if (!mergedMap.has(key)) {
              mergedMap.set(key, item)
            }
          }

          return {
            success: true,
            data: Array.from(mergedMap.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            ),
          }
        }
      }

      return {
        success: true,
        data: [...localMovements].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      }
    } catch {
      const localMovements = getLocalStorageMovements(organizationId, sessionId)
      return {
        success: true,
        data: [...localMovements].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      }
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
      const session = await this.getSessionById(organizationId, sessionId)
      if (!session || session.id !== sessionId || session.status !== 'open') {
        return { success: false, error: 'Sessão de caixa não encontrada ou já encerrada.' }
      }

      const movementCents = toCents(params.amount)
      if (movementCents <= 0) {
        return { success: false, error: 'O valor da movimentação deve ser maior que zero.' }
      }

      const cleanReason = params.reason?.trim()
      if (!cleanReason || cleanReason.length < 3) {
        return {
          success: false,
          error: 'Informe uma justificativa válida (mínimo de 3 caracteres) para a movimentação.',
        }
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
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sessionId,
        type: params.type,
        amount: toMoneyString(movementCents),
        reason: cleanReason,
        category: params.category || (params.type === 'supply' ? 'Suprimento' : 'Sangria'),
        referenceId: params.referenceId || null,
        operatorName: params.operatorName || session.operatorName,
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
   * Realiza a conferência e o fechamento oficial do caixa (com conferência de Espécie, Cartões e PIX)
   */
  async closeSession(
    organizationId: UUID,
    sessionId: string,
    params: CloseSessionParams,
  ): Promise<ServiceResult<CashSession>> {
    try {
      const session = await this.getSessionById(organizationId, sessionId)

      if (!session || session.status !== 'open') {
        return { success: false, error: 'Sessão de caixa não encontrada ou já encerrada.' }
      }

      // Validação de conferência (Espécie, PIX, Cartão de Crédito e Cartão de Débito)
      const closureValidation = validateSessionClosure({
        countedMoney: params.countedMoney,
        expectedMoney: session.expectedMoney,
        countedPix: params.countedPix,
        expectedPix: session.totalPix,
        countedCreditCard: params.countedCreditCard,
        expectedCreditCard: session.totalCreditCard,
        countedDebitCard: params.countedDebitCard,
        expectedDebitCard: session.totalDebitCard,
        justification: params.justification || params.discrepancyJustification,
      })

      if (!closureValidation.valid) {
        return { success: false, error: closureValidation.error ?? 'Divergência não justificada.' }
      }

      const fullReconciliation = reconcileFullSession({
        expectedMoney: session.expectedMoney,
        countedMoney: params.countedMoney,
        expectedPix: session.totalPix,
        countedPix: params.countedPix,
        expectedCreditCard: session.totalCreditCard,
        countedCreditCard: params.countedCreditCard,
        expectedDebitCard: session.totalDebitCard,
        countedDebitCard: params.countedDebitCard,
      })

      const nowIso = new Date().toISOString()
      const attempts = (session.conferenceAttempts || 0) + 1

      const closedSession: CashSession = {
        ...session,
        status: 'closed',
        closedBy: params.closedBy || params.operatorId || 'operator',
        closedAt: nowIso,
        countedMoney: toMoneyString(toCents(params.countedMoney)),
        countedPix:
          params.countedPix !== undefined && params.countedPix !== ''
            ? toMoneyString(toCents(params.countedPix))
            : session.totalPix,
        countedCreditCard:
          params.countedCreditCard !== undefined && params.countedCreditCard !== ''
            ? toMoneyString(toCents(params.countedCreditCard))
            : session.totalCreditCard,
        countedDebitCard:
          params.countedDebitCard !== undefined && params.countedDebitCard !== ''
            ? toMoneyString(toCents(params.countedDebitCard))
            : session.totalDebitCard,
        difference: fullReconciliation.money.formattedDifference,
        conferenceAttempts: attempts,
        discrepancyJustification: params.justification?.trim() || null,
        supervisorAuthorizedBy: params.supervisorAuth?.trim() || null,
        notes: params.notes?.trim() || session.notes || null,
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

      const local = getLocalStorageSessions(organizationId)

      if (!error && Array.isArray(data)) {
        const remote = (data as CashSessionRow[]).map(mapSessionRow)
        const byId = new Map<string, CashSession>()
        for (const s of [...remote, ...local]) {
          if (!byId.has(s.id)) {
            byId.set(s.id, s)
          }
        }
        return {
          success: true,
          data: Array.from(byId.values()).sort(
            (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
          ),
        }
      }

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
