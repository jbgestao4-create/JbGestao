import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UUID } from '@shared/types/common'
import type {
  CashAccount,
  CashDirection,
  CashEntry,
  CashPayment,
} from '../domain/cash-management'

interface CashAccountRow {
  id: string
  name: string
  account_type: CashAccount['accountType']
  opening_balance: string
  is_active: boolean
}

interface CashPaymentRow {
  id: string
  entry_id: string
  account_id: string
  amount: string
  payment_method: string
  paid_at: string
  available_at: string
}

interface CashEntryRow {
  id: string
  organization_id: string
  direction: CashDirection
  description: string
  amount: string
  category: string
  due_date: string | null
  customer_id: string | null
  supplier_id: string | null
  quote_id: string | null
  inventory_movement_id: string | null
  notes: string | null
  canceled_at: string | null
  created_at: string
  customers: { name: string } | { name: string }[] | null
  suppliers: { name: string } | { name: string }[] | null
  quotes: { quote_number: string } | { quote_number: string }[] | null
}

export interface CreateCashEntryParams {
  direction: CashDirection
  description: string
  amount: string
  category: string
  dueDate?: string
  customerId?: string
  supplierId?: string
  notes?: string
}

export interface RegisterCashPaymentParams {
  entryId: UUID
  accountId: UUID
  amount: string
  paymentMethod: string
  paidAt: string
  availableAt: string
  notes?: string
}

export interface CreateCashAccountParams {
  name: string
  accountType: CashAccount['accountType']
  openingBalance: string
}

function normalizeRelation<T>(relation: T | T[] | null): T | null {
  return Array.isArray(relation) ? (relation[0] ?? null) : relation
}

function mapAccount(row: CashAccountRow): CashAccount {
  return {
    id: row.id,
    name: row.name,
    accountType: row.account_type,
    openingBalance: row.opening_balance,
    isActive: row.is_active,
  }
}

function mapPayment(row: CashPaymentRow): CashPayment {
  return {
    id: row.id,
    accountId: row.account_id,
    amount: row.amount,
    paymentMethod: row.payment_method,
    paidAt: row.paid_at,
    availableAt: row.available_at,
  }
}

function getCashError(error: { code?: string; message?: string } | null): string {
  if (error?.code === '42501') return 'Seu usuário não tem acesso ao gerenciamento do caixa.'
  if (error?.code === '23503') return 'Confira a conta, cliente ou fornecedor selecionado.'
  if (error?.code === '23514') {
    if (error.message?.includes('excede o valor pendente')) {
      return 'O valor informado é maior que o saldo pendente.'
    }
    return 'Confira os valores e os dados informados no lançamento.'
  }
  if (error?.code === '23505') {
    return 'Já existe um lançamento financeiro para essa origem.'
  }
  if (error?.code === 'P0002') return 'O lançamento não foi encontrado ou não está mais disponível.'
  if (error?.code === 'PGRST204' || error?.code === 'PGRST205' || error?.code === '42P01') {
    return 'O módulo de caixa ainda não está disponível no banco. Aplique as migrações do Supabase.'
  }
  return 'Não foi possível concluir a operação financeira. Verifique a conexão e tente novamente.'
}

export const cashService = {
  async listAccounts(organizationId: UUID): Promise<ServiceResult<CashAccount[]>> {
    try {
      const { data, error } = await supabase
        .from('cash_accounts')
        .select('id, name, account_type, opening_balance, is_active')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true })
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<CashAccountRow[]>()
      if (error) {
        logger.error('Erro ao carregar contas do caixa', error)
        return { success: false, error: getCashError(error) }
      }
      return { success: true, data: data.map(mapAccount) }
    } catch (error) {
      logger.error('Exceção ao carregar contas do caixa', error)
      return { success: false, error: 'Erro inesperado ao consultar as contas do caixa.' }
    }
  },

  async createAccount(
    organizationId: UUID,
    params: CreateCashAccountParams,
  ): Promise<ServiceResult<CashAccount>> {
    try {
      const { data, error } = await supabase
        .from('cash_accounts')
        .insert({
          organization_id: organizationId,
          name: params.name.trim(),
          account_type: params.accountType,
          opening_balance: params.openingBalance,
        })
        .select('id, name, account_type, opening_balance, is_active')
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<CashAccountRow[]>()
        .single()
      if (error) {
        logger.error('Erro ao criar conta do caixa', error)
        return {
          success: false,
          error:
            error.code === '23505'
              ? 'Já existe uma conta com esse nome.'
              : getCashError(error),
        }
      }
      return { success: true, data: mapAccount(data) }
    } catch (error) {
      logger.error('Exceção ao criar conta do caixa', error)
      return { success: false, error: 'Erro inesperado ao criar a conta.' }
    }
  },

  async listEntries(organizationId: UUID): Promise<ServiceResult<CashEntry[]>> {
    try {
      const [entriesResult, paymentsResult] = await Promise.all([
        supabase
          .from('cash_entries')
          .select(
            'id, organization_id, direction, description, amount, category, due_date, customer_id, supplier_id, quote_id, inventory_movement_id, notes, canceled_at, created_at, customers(name), suppliers(name), quotes(quote_number)',
          )
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          // The shared Supabase client is untyped; this keeps the response typed locally.
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          .returns<CashEntryRow[]>(),
        supabase
          .from('cash_payments')
          .select('id, entry_id, account_id, amount, payment_method, paid_at, available_at')
          .eq('organization_id', organizationId)
          .order('paid_at', { ascending: false })
          // The shared Supabase client is untyped; this keeps the response typed locally.
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          .returns<CashPaymentRow[]>(),
      ])

      if (entriesResult.error || paymentsResult.error) {
        const error = entriesResult.error ?? paymentsResult.error
        logger.error('Erro ao listar lançamentos do caixa', error)
        return { success: false, error: getCashError(error) }
      }

      const paymentsByEntry = new Map<string, CashPayment[]>()
      for (const payment of paymentsResult.data) {
        const list = paymentsByEntry.get(payment.entry_id) ?? []
        list.push(mapPayment(payment))
        paymentsByEntry.set(payment.entry_id, list)
      }

      return {
        success: true,
        data: entriesResult.data.map((row) => ({
          id: row.id,
          organizationId: row.organization_id,
          direction: row.direction,
          description: row.description,
          amount: row.amount,
          category: row.category,
          dueDate: row.due_date,
          customerId: row.customer_id,
          customerName: normalizeRelation(row.customers)?.name ?? null,
          supplierId: row.supplier_id,
          supplierName: normalizeRelation(row.suppliers)?.name ?? null,
          quoteId: row.quote_id,
          quoteNumber: normalizeRelation(row.quotes)?.quote_number ?? null,
          inventoryMovementId: row.inventory_movement_id,
          notes: row.notes,
          canceledAt: row.canceled_at,
          createdAt: row.created_at,
          payments: paymentsByEntry.get(row.id) ?? [],
        })),
      }
    } catch (error) {
      logger.error('Exceção ao listar lançamentos do caixa', error)
      return { success: false, error: 'Erro inesperado ao consultar o caixa.' }
    }
  },

  async createEntry(
    organizationId: UUID,
    params: CreateCashEntryParams,
  ): Promise<ServiceResult<UUID>> {
    try {
      const { data, error } = await supabase
        .from('cash_entries')
        .insert({
          organization_id: organizationId,
          direction: params.direction,
          description: params.description.trim(),
          amount: params.amount,
          category: params.category.trim(),
          due_date: params.dueDate || null,
          customer_id: params.customerId || null,
          supplier_id: params.supplierId || null,
          notes: params.notes?.trim() || null,
          created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
        })
        .select('id')
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<{ id: UUID }[]>()
        .single()
      if (error) {
        logger.error('Erro ao criar lançamento no caixa', error)
        return { success: false, error: getCashError(error) }
      }
      return { success: true, data: data.id }
    } catch (error) {
      logger.error('Exceção ao criar lançamento no caixa', error)
      return { success: false, error: 'Erro inesperado ao criar o lançamento.' }
    }
  },

  async registerPayment(
    organizationId: UUID,
    params: RegisterCashPaymentParams,
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.rpc('record_cash_payment', {
        p_organization_id: organizationId,
        p_entry_id: params.entryId,
        p_account_id: params.accountId,
        p_amount: params.amount,
        p_payment_method: params.paymentMethod,
        p_paid_at: params.paidAt,
        p_available_at: params.availableAt,
        p_notes: params.notes?.trim() || null,
      })
      if (error) {
        logger.error('Erro ao registrar pagamento no caixa', error)
        return { success: false, error: getCashError(error) }
      }
      return { success: true, data: undefined }
    } catch (error) {
      logger.error('Exceção ao registrar pagamento no caixa', error)
      return { success: false, error: 'Erro inesperado ao registrar o pagamento.' }
    }
  },

  async cancelEntry(organizationId: UUID, entryId: UUID): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.rpc('cancel_cash_entry', {
        p_organization_id: organizationId,
        p_entry_id: entryId,
      })
      if (error) {
        logger.error('Erro ao cancelar lançamento do caixa', error)
        return { success: false, error: getCashError(error) }
      }
      return { success: true, data: undefined }
    } catch (error) {
      logger.error('Exceção ao cancelar lançamento do caixa', error)
      return { success: false, error: 'Erro inesperado ao cancelar o lançamento.' }
    }
  },

  async createQuoteReceivable(
    organizationId: UUID,
    quoteId: UUID,
  ): Promise<ServiceResult<UUID>> {
    try {
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('id, customer_id, quote_number, total, status')
        .eq('organization_id', organizationId)
        .eq('id', quoteId)
        .maybeSingle()
      if (quoteError || !quote) {
        logger.error('Erro ao consultar orçamento para gerar conta a receber', quoteError)
        return { success: false, error: 'Não foi possível localizar o orçamento selecionado.' }
      }
      if (quote.status !== 'approved') {
        return {
          success: false,
          error: 'Somente orçamentos aprovados podem ser convertidos em contas a receber.',
        }
      }

      const { data: existing, error: existingError } = await supabase
        .from('cash_entries')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('quote_id', quoteId)
        .maybeSingle()
      if (existingError) {
        logger.error('Erro ao verificar conta a receber do orçamento', existingError)
        return { success: false, error: getCashError(existingError) }
      }
      if (existing) return { success: true, data: existing.id }

      const { data, error } = await supabase
        .from('cash_entries')
        .insert({
          organization_id: organizationId,
          direction: 'income',
          description: `Orçamento ${quote.quote_number}`,
          amount: quote.total,
          category: 'Recebimento de orçamento',
          customer_id: quote.customer_id,
          quote_id: quote.id,
          created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
        })
        .select('id')
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<{ id: UUID }[]>()
        .single()
      if (error) {
        if (error.code === '23505') {
          const { data: created } = await supabase
            .from('cash_entries')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('quote_id', quoteId)
            .maybeSingle()
          if (created) return { success: true, data: created.id }
        }
        logger.error('Erro ao criar conta a receber do orçamento', error)
        return { success: false, error: getCashError(error) }
      }
      return { success: true, data: data.id }
    } catch (error) {
      logger.error('Exceção ao criar conta a receber do orçamento', error)
      return { success: false, error: 'Erro inesperado ao integrar o orçamento ao caixa.' }
    }
  },

  async createInventoryPayable(
    organizationId: UUID,
    movementId: UUID,
  ): Promise<ServiceResult<UUID>> {
    try {
      const { data: movement, error: movementError } = await supabase
        .from('inventory_movements')
        .select(
          'id, inventory_item_id, movement_type, quantity, unit_price, supplier_id, document_reference, reason, moved_at, inventory_items(name)',
        )
        .eq('organization_id', organizationId)
        .eq('id', movementId)
        .maybeSingle()
      if (movementError || !movement) {
        logger.error('Erro ao consultar compra de estoque para o caixa', movementError)
        return { success: false, error: 'Não foi possível localizar a movimentação do estoque.' }
      }
      if (movement.movement_type !== 'purchase' || !movement.unit_price || !movement.supplier_id) {
        return {
          success: false,
          error:
            'Para gerar uma conta a pagar, a movimentação precisa ser uma compra com fornecedor e preço unitário informados.',
        }
      }

      const { data: existing, error: existingError } = await supabase
        .from('cash_entries')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('inventory_movement_id', movementId)
        .maybeSingle()
      if (existingError) {
        logger.error('Erro ao verificar conta a pagar da compra', existingError)
        return { success: false, error: getCashError(existingError) }
      }
      if (existing) return { success: true, data: existing.id }

      const productRelation = normalizeRelation(movement.inventory_items)
      const description = `Compra de ${productRelation?.name ?? 'material'}`
      const total = (Number(movement.quantity) * Number(movement.unit_price)).toFixed(2)
      const { data, error } = await supabase
        .from('cash_entries')
        .insert({
          organization_id: organizationId,
          direction: 'expense',
          description,
          amount: total,
          category: 'Compra de produtos',
          supplier_id: movement.supplier_id,
          inventory_movement_id: movement.id,
          due_date: movement.moved_at.slice(0, 10),
          notes: movement.document_reference
            ? `Documento: ${movement.document_reference}. ${movement.reason}`
            : movement.reason,
          created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
        })
        .select('id')
        // The shared Supabase client is untyped; this keeps the response typed locally.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        .returns<{ id: UUID }[]>()
        .single()
      if (error) {
        if (error.code === '23505') {
          const { data: created } = await supabase
            .from('cash_entries')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('inventory_movement_id', movementId)
            .maybeSingle()
          if (created) return { success: true, data: created.id }
        }
        logger.error('Erro ao criar conta a pagar da compra de estoque', error)
        return { success: false, error: getCashError(error) }
      }
      return { success: true, data: data.id }
    } catch (error) {
      logger.error('Exceção ao criar conta a pagar da compra de estoque', error)
      return { success: false, error: 'Erro inesperado ao integrar a compra ao caixa.' }
    }
  },
}
