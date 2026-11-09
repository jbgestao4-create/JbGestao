import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UUID } from '@shared/types/common'
import type { PaymentMethod } from '@modules/sales/services/sales.service'
import {
  type CashRegister,
  type CashSession,
  type CashSessionType,
  type CashSessionMovement,
  calculateExpectedMoney,
  reconcileFullSession,
  validateSessionClosure,
  toCents,
  toMoneyString,
} from '../domain/cash-session'

const SELECTED_REGISTER_KEY_PREFIX = 'orcafacil_selected_register_'

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

interface CashSessionRow {
  id: string
  organization_id: string
  register_id: string
  session_type?: 'pdv' | 'cash_management' | null
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
    sessionType: row.session_type || 'pdv',
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
  sessionType?: 'pdv' | 'cash_management'
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
  attachmentUrl?: string | null
  attachmentName?: string | null
  moveToAccount?: boolean
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

      if (error) {
        logger.error('Erro ao listar caixas no Supabase', error)
        return { success: false, error: 'Não foi possível carregar os caixas cadastrados.' }
      }

      const list = ((data ?? []) as CashRegisterRow[]).map(mapRegisterRow).sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR', { numeric: true }),
      )
      return { success: true, data: list.length > 0 ? list : [defaultRegister] }
    } catch {
      return { success: false, error: 'Não foi possível carregar os caixas cadastrados.' }
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
      if (!existingRes.success) {
        return { success: false, error: existingRes.error }
      }
      const existingList = existingRes.data.filter((r) => r.id !== 'default-caixa-01')
      if (
        existingList.some(
          (r) => r.name.toLocaleLowerCase('pt-BR') === cleanName.toLocaleLowerCase('pt-BR'),
        )
      ) {
        return { success: false, error: `Já existe um caixa cadastrado com o nome "${cleanName}".` }
      }

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

      if (error || !data) {
        logger.error('Erro ao cadastrar Caixa PDV no Supabase', error)
        return { success: false, error: 'Não foi possível cadastrar o Caixa PDV.' }
      }

      return { success: true, data: mapRegisterRow(data as CashRegisterRow) }
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
      if (!openRes.success) {
        return { success: false, error: openRes.error }
      }
      if (openRes.data) {
        return {
          success: false,
          error: `Não é possível excluir o "${registerName}" pois ele está com sessão aberta pelo operador "${openRes.data.operatorName}".`,
        }
      }

      if (registerId !== 'default-caixa-01') {
        const { error } = await supabase
          .from('cash_registers')
          .delete()
          .eq('organization_id', organizationId)
          .eq('id', registerId)

        if (error) {
          logger.error('Erro ao remover Caixa PDV no Supabase', error)
          return { success: false, error: 'Erro ao remover Caixa PDV.' }
        }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Erro ao remover Caixa PDV', err)
      return { success: false, error: 'Erro ao remover Caixa PDV.' }
    }
  },

  /**
   * Lista sessões abertas no momento na organização (opcionalmente filtrando por tipo: 'pdv' ou 'cash_management')
   */
  async listOpenSessions(
    organizationId: UUID,
    sessionType?: 'pdv' | 'cash_management',
  ): Promise<ServiceResult<CashSession[]>> {
    try {
      let query = supabase
        .from('cash_sessions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'open')

      if (sessionType) {
        query = query.eq('session_type', sessionType)
      }

      const { data, error } = await query

      if (error) {
        logger.error('Erro ao listar sessões abertas no Supabase', error)
        return { success: false, error: 'Não foi possível consultar os caixas abertos.' }
      }

      return { success: true, data: ((data ?? []) as CashSessionRow[]).map(mapSessionRow) }
    } catch {
      return { success: false, error: 'Não foi possível consultar os caixas abertos.' }
    }
  },

  /**
   * Lista apenas as sessões abertas dos terminais de PDV (/orcafacil/sales)
   */
  async listOpenPdvSessions(organizationId: UUID): Promise<ServiceResult<CashSession[]>> {
    return this.listOpenSessions(organizationId, 'pdv')
  },

  /**
   * Localiza a sessão aberta mais adequada para vincular vendas/OS no PDV
   */
  async findBestOpenSession(
    organizationId: UUID,
    preferredOperatorId?: string,
    sessionType: 'pdv' | 'cash_management' = 'pdv',
  ): Promise<CashSession | null> {
    try {
      const selectedReg = this.getSelectedRegisterName(organizationId)
      const openListRes = await this.listOpenSessions(organizationId, sessionType)
      if (openListRes.success && openListRes.data.length > 0) {
        if (preferredOperatorId) {
          const byOp = openListRes.data.find((s) => s.openedBy === preferredOperatorId)
          if (byOp) return byOp
        }
        const byReg = openListRes.data.find((s) => s.registerId === selectedReg)
        if (byReg) return byReg
        return openListRes.data[0]
      }
      return null
    } catch {
      return null
    }
  },

  /**
   * Busca uma sessão de caixa específica pelo ID (independente do nome do caixa)
   */
  async getSessionById(organizationId: UUID, sessionId: string): Promise<CashSession | null> {
    try {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('id', sessionId)
        .maybeSingle()

      if (error) {
        logger.error('Erro ao consultar sessão de caixa no Supabase', error)
        return null
      }

      return data ? mapSessionRow(data as CashSessionRow) : null
    } catch (error) {
      logger.error('Exceção ao consultar sessão de caixa no Supabase', error)
      return null
    }
  },

  /**
   * Obtém a sessão de caixa atualmente aberta para um terminal e escopo
   */
  async getOpenSession(
    organizationId: UUID,
    registerId = 'Caixa 01',
    sessionType: 'pdv' | 'cash_management' = 'pdv',
  ): Promise<ServiceResult<CashSession | null>> {
    try {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('register_id', registerId)
        .eq('status', 'open')
        .eq('session_type', sessionType)
        .maybeSingle()

      if (error) {
        logger.error('Erro ao consultar sessão aberta no Supabase', error)
        return { success: false, error: 'Não foi possível consultar a sessão de caixa.' }
      }

      return { success: true, data: data ? mapSessionRow(data as CashSessionRow) : null }
    } catch (err) {
      logger.error('Erro ao consultar sessão aberta no Supabase', err)
      return { success: false, error: 'Não foi possível consultar a sessão de caixa.' }
    }
  },

  /**
   * Obtém a sessão de caixa atualmente aberta para um terminal de PDV
   */
  async getOpenPdvSession(
    organizationId: UUID,
    registerId = 'Caixa 01',
  ): Promise<ServiceResult<CashSession | null>> {
    const normalizedReg = registerId === 'default-caixa-01' ? 'Caixa 01' : registerId
    return this.getOpenSession(organizationId, normalizedReg, 'pdv')
  },

  /**
   * Obtém a sessão aberta do Caixa Geral da empresa (/cash)
   */
  async getOpenCashManagementSession(
    organizationId: UUID,
  ): Promise<ServiceResult<CashSession | null>> {
    try {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'open')
        .eq('session_type', 'cash_management')
        .maybeSingle()

      if (error) {
        logger.error('Erro ao consultar Caixa Geral aberto no Supabase', error)
        return { success: false, error: 'Não foi possível consultar o Caixa Geral.' }
      }

      return { success: true, data: data ? mapSessionRow(data as CashSessionRow) : null }
    } catch (err) {
      logger.error('Erro ao consultar Caixa Geral aberto no Supabase', err)
      return { success: false, error: 'Não foi possível consultar o Caixa Geral.' }
    }
  },

  /**
   * Obtém a última sessão de caixa fechada (ex: Caixa Geral ou PDV).
   * Utilizado para herdar obrigatoriamente o saldo final com o qual o caixa anterior encerrou.
   */
  async getLastClosedSession(
    organizationId: UUID,
    sessionType: CashSessionType = 'cash_management',
  ): Promise<ServiceResult<CashSession | null>> {
    try {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('session_type', sessionType)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        logger.error('Erro ao consultar última sessão de caixa fechada no Supabase', error)
        return { success: false, error: 'Não foi possível consultar a última sessão fechada.' }
      }

      if (data) {
        return { success: true, data: mapSessionRow(data as CashSessionRow) }
      }

      // Fallback para sessões anteriores que possam não ter session_type gravado
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (fallbackError) {
        return { success: false, error: 'Não foi possível consultar a última sessão fechada.' }
      }

      return {
        success: true,
        data: fallbackData ? mapSessionRow(fallbackData as CashSessionRow) : null,
      }
    } catch (err) {
      logger.error('Exceção ao consultar última sessão de caixa fechada', err)
      return { success: false, error: 'Erro inesperado ao consultar a última sessão fechada.' }
    }
  },

  /**
   * Abre um novo turno/sessão de caixa (com separação total entre PDV e Caixa Geral)
   */
  async openSession(
    organizationId: UUID,
    params: OpenSessionParams,
  ): Promise<ServiceResult<CashSession>> {
    try {
      const sessionType = params.sessionType || 'pdv'
      let registerId =
        params.registerId ||
        (sessionType === 'cash_management' ? 'Caixa Geral' : 'Caixa 01')

      if (registerId === 'default-caixa-01') {
        registerId = 'Caixa 01'
      }

      if (sessionType === 'cash_management') {
        // 1. Gestão de Caixa (/cash): verifica se o Caixa Geral já está aberto
        const checkResult = await this.getOpenCashManagementSession(organizationId)
        if (!checkResult.success) {
          return { success: false, error: checkResult.error }
        }
        if (checkResult.data) {
          return { success: true, data: checkResult.data }
        }

        // Se o saldo inicial não tiver sido fornecido, busca o valor do último caixa fechado
        if (params.openingBalance === undefined || params.openingBalance === null) {
          const lastClosedRes = await this.getLastClosedSession(organizationId, 'cash_management')
          if (lastClosedRes.success && lastClosedRes.data) {
            const closed = lastClosedRes.data
            const closingVal =
              closed.countedMoney !== null &&
              closed.countedMoney !== undefined &&
              closed.countedMoney !== ''
                ? parseFloat(closed.countedMoney)
                : parseFloat(closed.expectedMoney) || 0
            params.openingBalance = closingVal
          }
        }
      } else {
        // 2. PDV (/orcafacil/sales):
        // 2.0 O caixa PDV só pode ser aberto quando o Caixa Geral estiver aberto
        const generalSessionRes = await this.getOpenCashManagementSession(organizationId)
        if (!generalSessionRes.success) {
          return { success: false, error: generalSessionRes.error }
        }
        if (!generalSessionRes.data) {
          return {
            success: false,
            error: 'Caixa Geral ainda não aberto, procure o seu administrador',
          }
        }

        // 2.1 Verifica se já existe um caixa de PDV aberto para este terminal específico
        const checkResult = await this.getOpenPdvSession(organizationId, registerId)
        if (!checkResult.success) {
          return { success: false, error: checkResult.error }
        }
        if (checkResult.data) {
          const existing = checkResult.data
          if (existing.openedBy !== params.operatorId) {
            return {
              success: false,
              error: `O ${registerId} já está aberto pelo operador "${existing.operatorName}". É obrigatório realizar o fechamento do caixa anterior (Tecla F12) antes de abrir uma nova sessão.`,
            }
          }
          return { success: true, data: existing }
        }

        // 2.2 Impede que o mesmo usuário abra dois caixas de PDV simultaneamente (Caixa Geral não bloqueia o PDV)
        const openListRes = await this.listOpenPdvSessions(organizationId)
        if (!openListRes.success) {
          return { success: false, error: openListRes.error }
        }
        const otherOpenByUser = openListRes.data.find(
          (s) =>
            s.sessionType === 'pdv' &&
            s.registerId !== 'Caixa Geral' &&
            s.openedBy === params.operatorId &&
            s.registerId !== registerId &&
            !(s.registerId === 'default-caixa-01' && registerId === 'Caixa 01') &&
            s.status === 'open',
        )
        if (otherOpenByUser) {
          return {
            success: false,
            error: `Você já possui o "${otherOpenByUser.registerId}" aberto. Cada operador só pode ter um caixa de PDV aberto por vez. Feche primeiro o "${otherOpenByUser.registerId}" para abrir outro caixa.`,
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
          session_type: sessionType,
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

      if (error || !data) {
        logger.error('Erro ao abrir sessão de caixa no Supabase', error)
        return { success: false, error: 'Não foi possível abrir a sessão de caixa no Supabase.' }
      }

      return { success: true, data: mapSessionRow(data as CashSessionRow) }
    } catch (err) {
      logger.error('Exceção ao abrir sessão de caixa', err)
      return { success: false, error: 'Erro inesperado ao realizar abertura de caixa.' }
    }
  },

  /**
   * Sincroniza uma venda realizada (no PDV ou avulsa/Nova Venda) com a sessão de Caixa Geral (/cash) se ela estiver aberta.
   * Acumula os valores no Caixa Geral e adiciona uma movimentação no extrato.
   */
  async syncSaleWithCashManagement(
    organizationId: UUID,
    params: {
      total: string
      paymentMethod: PaymentMethod
      amountReceived?: string
      saleNumber?: string
      registerName?: string
      operatorName?: string
      operatorId?: string
      excludeSessionId?: string
    },
  ): Promise<void> {
    try {
      const openMgmtRes = await this.getOpenCashManagementSession(organizationId)
      if (!openMgmtRes.success || !openMgmtRes.data) {
        // Se o Caixa Geral não estiver aberto no momento, não há o que sincronizar
        return
      }

      const mgmtSession = openMgmtRes.data

      // Acumula os totais no Caixa Geral somente se a venda já não tiver sido registrada diretamente nele
      if (!params.excludeSessionId || params.excludeSessionId !== mgmtSession.id) {
        await this.recordSaleInSession(organizationId, mgmtSession.id, {
          total: params.total,
          paymentMethod: params.paymentMethod,
          amountReceived: params.amountReceived,
        })
      }

      // Registra a movimentação no extrato do Caixa Geral
      const methodLabels: Record<PaymentMethod, string> = {
        money: 'Dinheiro',
        pix: 'PIX',
        credit_card: 'Cartão de Crédito',
        debit_card: 'Cartão de Débito',
        on_credit: 'A Prazo / Crediário',
        other: 'Outro',
      }
      const paymentLabel = methodLabels[params.paymentMethod] || 'Outro'
      const saleLabel = params.saleNumber ? `Venda ${params.saleNumber}` : 'Venda'
      const pdvLabel = params.registerName ? ` [${params.registerName}]` : ' [Nova Venda]'
      const reasonText = `${saleLabel}${pdvLabel} • ${paymentLabel}`

      await supabase.from('cash_session_movements').insert({
        organization_id: organizationId,
        session_id: mgmtSession.id,
        type: 'supply',
        amount: toMoneyString(toCents(params.total)),
        reason: reasonText,
        created_by: params.operatorId || null,
      })
    } catch (err) {
      logger.warn('Erro ao sincronizar venda do PDV com o Caixa Geral (/cash)', { error: err })
    }
  },

  /**
   * Sincroniza uma movimentação manual do PDV (sangria ou suprimento) com o Caixa Geral se estiver aberto
   */
  async syncMovementWithCashManagement(
    organizationId: UUID,
    params: {
      type: 'supply' | 'bleed'
      amount: string | number
      reason: string
      registerName?: string
      operatorId?: string
    },
  ): Promise<void> {
    try {
      const openMgmtRes = await this.getOpenCashManagementSession(organizationId)
      if (!openMgmtRes.success || !openMgmtRes.data) return

      const mgmtSession = openMgmtRes.data
      const pdvTag = params.registerName ? `[${params.registerName}] ` : '[PDV] '

      await this.recordMovement(organizationId, mgmtSession.id, {
        type: params.type,
        amount: params.amount,
        reason: `${pdvTag}${params.reason}`.trim(),
        userId: params.operatorId,
      })
    } catch (err) {
      logger.warn('Erro ao sincronizar movimentação manual do PDV com o Caixa Geral', { error: err })
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

      const { error } = await supabase
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

      if (error) {
        logger.error('Erro ao atualizar venda na sessão de caixa no Supabase', error)
        return { success: false, error: 'Erro ao sincronizar venda com a sessão do caixa.' }
      }

      return { success: true, data: updatedSession }
    } catch (err) {
      logger.error('Exceção ao registrar venda na sessão de caixa', err)
      return { success: false, error: 'Erro ao sincronizar venda com a sessão do caixa.' }
    }
  },

  /**
   * Faz upload de nota de compra ou comprovante para uma movimentação manual de caixa
   */
  async uploadMovementAttachment(
    organizationId: UUID,
    file: File,
  ): Promise<ServiceResult<{ url: string; fileName: string }>> {
    try {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `${organizationId}/${Date.now()}_${sanitizedName}`

      const { error: uploadError } = await supabase.storage
        .from('cash-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        logger.error('Erro ao fazer upload do comprovante no Supabase Storage', uploadError)
        return { success: false, error: 'Falha ao enviar comprovante/nota. Tente novamente.' }
      }

      const { data: publicData } = supabase.storage
        .from('cash-attachments')
        .getPublicUrl(filePath)

      return {
        success: true,
        data: {
          url: publicData.publicUrl,
          fileName: file.name,
        },
      }
    } catch (err) {
      logger.error('Exceção ao fazer upload de anexo do caixa', err)
      return { success: false, error: 'Erro inesperado ao anexar o comprovante.' }
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
      const { data, error } = await supabase
          .from('cash_session_movements')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })

      if (error) {
        logger.error('Erro ao listar movimentações no Supabase', error)
        return { success: false, error: 'Não foi possível carregar as movimentações do caixa.' }
      }

      return {
        success: true,
        data: (data ?? []).map((row: Record<string, unknown>) => ({
          id: String(row.id),
          sessionId: String(row.session_id),
          type: (row.type === 'supply' ? 'supply' : 'bleed') as 'supply' | 'bleed',
          amount: String(row.amount ?? '0.00'),
          reason: String(row.reason ?? ''),
          category: row.category ? String(row.category) : null,
          referenceId: row.reference_id ? String(row.reference_id) : null,
          attachmentUrl: row.attachment_url ? String(row.attachment_url) : null,
          attachmentName: row.attachment_name ? String(row.attachment_name) : null,
          moveToAccount: Boolean(
            row.move_to_account ||
            String(row.category || '').includes('Conta') ||
            String(row.reason || '').includes('[Transferido para Conta]') ||
            String(row.reason || '').includes('Mover para Conta')
          ),
          createdBy: row.created_by ? String(row.created_by) : null,
          createdAt: String(row.created_at ?? new Date().toISOString()),
        })),
      }
    } catch (error) {
      logger.error('Exceção ao listar movimentações no Supabase', error)
      return { success: false, error: 'Não foi possível carregar as movimentações do caixa.' }
    }
  },

  /**
   * Lista todas as movimentações manuais de caixa da organização (todas as sessões)
   */
  async listAllMovements(organizationId: UUID): Promise<ServiceResult<CashSessionMovement[]>> {
    try {
      const { data, error } = await supabase
        .from('cash_session_movements')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Erro ao listar todas as movimentações no Supabase', error)
        return { success: false, error: 'Não foi possível carregar as movimentações do caixa.' }
      }

      return {
        success: true,
        data: (data ?? []).map((row: Record<string, unknown>) => ({
          id: String(row.id),
          sessionId: String(row.session_id),
          type: (row.type === 'supply' ? 'supply' : 'bleed') as 'supply' | 'bleed',
          amount: String(row.amount ?? '0.00'),
          reason: String(row.reason ?? ''),
          category: row.category ? String(row.category) : null,
          referenceId: row.reference_id ? String(row.reference_id) : null,
          attachmentUrl: row.attachment_url ? String(row.attachment_url) : null,
          attachmentName: row.attachment_name ? String(row.attachment_name) : null,
          moveToAccount: Boolean(
            row.move_to_account ||
            String(row.category || '').includes('Conta') ||
            String(row.reason || '').includes('[Transferido para Conta]') ||
            String(row.reason || '').includes('Mover para Conta')
          ),
          createdBy: row.created_by ? String(row.created_by) : null,
          createdAt: String(row.created_at ?? new Date().toISOString()),
        })),
      }
    } catch (error) {
      logger.error('Exceção ao listar todas as movimentações no Supabase', error)
      return { success: false, error: 'Não foi possível carregar as movimentações do caixa.' }
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

      let finalCategory = params.category || (params.type === 'supply' ? 'Suprimento' : 'Sangria')
      if (params.moveToAccount && !finalCategory.includes('Conta')) {
        finalCategory = `${finalCategory} (Mover para Conta)`
      }

      const movementItem: CashSessionMovement = {
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sessionId,
        type: params.type,
        amount: toMoneyString(movementCents),
        reason: cleanReason,
        category: finalCategory,
        referenceId: params.referenceId || null,
        moveToAccount: Boolean(params.moveToAccount),
        operatorName: params.operatorName || session.operatorName,
        createdBy: params.userId || null,
        createdAt: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
          .from('cash_sessions')
          .update({
            total_additional_entries: updatedSession.totalAdditionalEntries,
            total_withdrawals: updatedSession.totalWithdrawals,
            expected_money: updatedSession.expectedMoney,
            updated_at: updatedSession.updatedAt,
          })
          .eq('id', sessionId)

      if (updateError) {
        logger.error('Erro ao atualizar sessão do caixa no Supabase', updateError)
        return { success: false, error: 'Não foi possível atualizar a sessão do caixa.' }
      }

      const insertPayload: Record<string, unknown> = {
        organization_id: organizationId,
        session_id: sessionId,
        type: params.type,
        amount: movementItem.amount,
        reason: movementItem.reason,
        category: movementItem.category || null,
        attachment_url: params.attachmentUrl || null,
        attachment_name: params.attachmentName || null,
        created_by: params.userId || null,
        move_to_account: Boolean(params.moveToAccount),
      }

      let { error: movementError } = await supabase.from('cash_session_movements').insert(insertPayload)

      if (movementError && (movementError.message?.includes('move_to_account') || movementError.code === '42703')) {
        delete insertPayload.move_to_account
        const retryRes = await supabase.from('cash_session_movements').insert(insertPayload)
        movementError = retryRes.error
      }

      if (movementError) {
        logger.error('Erro ao salvar movimentação no Supabase', movementError)
        return { success: false, error: 'Não foi possível salvar a movimentação do caixa.' }
      }

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

      const { error } = await supabase
          .from('cash_sessions')
          .update({
            status: 'closed',
            closed_by: params.closedBy,
            closed_at: nowIso,
            counted_money: closedSession.countedMoney,
            counted_pix: closedSession.countedPix,
            counted_credit_card: closedSession.countedCreditCard,
            counted_debit_card: closedSession.countedDebitCard,
            difference: closedSession.difference,
            conference_attempts: attempts,
            discrepancy_justification: closedSession.discrepancyJustification,
            supervisor_authorized_by: closedSession.supervisorAuthorizedBy,
            updated_at: nowIso,
          })
          .eq('id', sessionId)

      if (error) {
        logger.error('Erro ao fechar sessão de caixa no Supabase', error)
        return { success: false, error: 'Não foi possível salvar o fechamento da sessão no Supabase.' }
      }

      return { success: true, data: closedSession }
    } catch (err) {
      logger.error('Exceção ao fechar sessão de caixa', err)
      return { success: false, error: 'Erro inesperado ao fechar a sessão de caixa.' }
    }
  },

  /**
   * Retorna o histórico de todas as sessões de caixa (abertas e fechadas)
   */
  async listHistory(
    organizationId: UUID,
    sessionType?: CashSessionType,
  ): Promise<ServiceResult<CashSession[]>> {
    try {
      let query = supabase
        .from('cash_sessions')
        .select('*')
        .eq('organization_id', organizationId)

      if (sessionType) {
        query = query.eq('session_type', sessionType)
      }

      const { data, error } = await query.order('opened_at', { ascending: false })

      if (error) {
        logger.error('Erro ao listar histórico de sessões no Supabase', error)
        return { success: false, error: 'Não foi possível carregar o histórico de sessões.' }
      }

      return {
        success: true,
        data: ((data ?? []) as CashSessionRow[]).map(mapSessionRow),
      }
    } catch (err) {
      logger.error('Erro ao listar histórico de sessões no Supabase', err)
      return { success: false, error: 'Não foi possível carregar o histórico de sessões.' }
    }
  },
}
