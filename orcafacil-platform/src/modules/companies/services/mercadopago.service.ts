import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult } from '@shared/types/common'

function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'https://controlesoft.vercel.app'
  }
  return ''
}

export interface MercadoPagoSettings {
  id?: string
  accessToken: string
  publicKey: string
  webhookSecret: string
  isSandbox: boolean
  notificationUrl: string
  pixKey: string
  autoActivateLicense: boolean
  licenseDurationDays: number
  isActive: boolean
  updatedAt?: string
}

export interface MercadoPagoPixTransaction {
  id: string
  organizationId: string
  organizationName?: string
  organizationSlug?: string
  contractInvoiceId?: string | null
  accessPlanId?: string | null
  accessPlanName?: string | null
  mpPaymentId?: number | null
  idempotencyKey: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded'
  statusDetail?: string | null
  amount: number
  description?: string | null
  qrCode?: string | null
  qrCodeBase64?: string | null
  ticketUrl?: string | null
  payerName?: string | null
  payerEmail?: string | null
  payerDocument?: string | null
  expiresAt?: string | null
  paidAt?: string | null
  licenseDaysGranted: number
  licenseActivated: boolean
  createdAt: string
  updatedAt: string
}

export interface MercadoPagoMetrics {
  totalApprovedAmount: number
  countApproved: number
  countPending: number
  countRejected: number
  countCancelled: number
  totalCount: number
}

export interface CreatePixPaymentParams {
  organizationId: string
  accessPlanId?: string
  accessPlanName?: string
  contractInvoiceId?: string
  amount: number
  description?: string
  payerName: string
  payerEmail: string
  payerDocument?: string
  licenseDaysGranted?: number
}

export interface MercadoPagoTestResult {
  connected: boolean
  accountName?: string
  email?: string
  siteId?: string
  userId?: number
  isSandbox?: boolean
  error?: string
}

const MP_LOCAL_STORAGE_SETTINGS_KEY = 'jb_mp_settings_local_cache'

export const mercadopagoService = {
  /**
   * Obtém as configurações administrativas do Mercado Pago.
   */
  async getSettings(): Promise<ServiceResult<MercadoPagoSettings>> {
    try {
      const { data, error } = await supabase.rpc('admin_get_mercadopago_settings')

      if (error) {
        // Fallback direto via SELECT caso a migration esteja recente
        const fallback = await supabase
          .from('mercadopago_settings')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!fallback.error && fallback.data) {
          const row = fallback.data as any
          return {
            success: true,
            data: {
              id: row.id,
              accessToken: row.access_token || '',
              publicKey: row.public_key || '',
              webhookSecret: row.webhook_secret || '',
              isSandbox: row.is_sandbox ?? true,
              notificationUrl: row.notification_url || '',
              pixKey: row.pix_key || '',
              autoActivateLicense: row.auto_activate_license ?? true,
              licenseDurationDays: row.license_duration_days ?? 30,
              isActive: row.is_active ?? true,
              updatedAt: row.updated_at,
            },
          }
        }

        // Tenta cache local seguro como último recurso de fallback
        try {
          const cached = localStorage.getItem(MP_LOCAL_STORAGE_SETTINGS_KEY)
          if (cached) {
            return { success: true, data: JSON.parse(cached) }
          }
        } catch {
          // ignore
        }

        return {
          success: true,
          data: {
            accessToken: '',
            publicKey: '',
            webhookSecret: '',
            isSandbox: true,
            notificationUrl: 'https://controlesoft.vercel.app/api/mercadopago/webhook',
            pixKey: '',
            autoActivateLicense: true,
            licenseDurationDays: 30,
            isActive: true,
          },
        }
      }

      const res = data as any
      const settings: MercadoPagoSettings = {
        id: res.id,
        accessToken: res.access_token || '',
        publicKey: res.public_key || '',
        webhookSecret: res.webhook_secret || '',
        isSandbox: res.is_sandbox ?? true,
        notificationUrl: res.notification_url || 'https://controlesoft.vercel.app/api/mercadopago/webhook',
        pixKey: res.pix_key || '',
        autoActivateLicense: res.auto_activate_license ?? true,
        licenseDurationDays: res.license_duration_days ?? 30,
        isActive: res.is_active ?? true,
        updatedAt: res.updated_at,
      }

      try {
        localStorage.setItem(MP_LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings))
      } catch {
        // ignore
      }

      return { success: true, data: settings }
    } catch (err: any) {
      logger.error('Erro ao obter configurações do Mercado Pago:', err)
      return {
        success: false,
        error: err.message || 'Falha ao carregar configurações do Mercado Pago.',
      }
    }
  },

  /**
   * Salva as configurações de credenciais e parâmetros do Mercado Pago.
   */
  async saveSettings(settings: MercadoPagoSettings): Promise<ServiceResult<{ success: boolean }>> {
    try {
      const { error } = await supabase.rpc('admin_save_mercadopago_settings', {
        p_access_token: settings.accessToken.trim(),
        p_public_key: settings.publicKey.trim(),
        p_webhook_secret: settings.webhookSecret.trim(),
        p_is_sandbox: settings.isSandbox,
        p_notification_url: settings.notificationUrl.trim(),
        p_pix_key: settings.pixKey.trim(),
        p_auto_activate_license: settings.autoActivateLicense,
        p_license_duration_days: settings.licenseDurationDays || 30,
        p_is_active: settings.isActive,
      })

      if (error) {
        // Fallback direto via upsert na tabela
        const existing = await supabase.from('mercadopago_settings').select('id').limit(1).maybeSingle()
        if (existing.data?.id) {
          await supabase
            .from('mercadopago_settings')
            .update({
              access_token: settings.accessToken.trim(),
              public_key: settings.publicKey.trim(),
              webhook_secret: settings.webhookSecret.trim(),
              is_sandbox: settings.isSandbox,
              notification_url: settings.notificationUrl.trim(),
              pix_key: settings.pixKey.trim(),
              auto_activate_license: settings.autoActivateLicense,
              license_duration_days: settings.licenseDurationDays || 30,
              is_active: settings.isActive,
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', existing.data.id)
        } else {
          await supabase.from('mercadopago_settings').insert({
            access_token: settings.accessToken.trim(),
            public_key: settings.publicKey.trim(),
            webhook_secret: settings.webhookSecret.trim(),
            is_sandbox: settings.isSandbox,
            notification_url: settings.notificationUrl.trim(),
            pix_key: settings.pixKey.trim(),
            auto_activate_license: settings.autoActivateLicense,
            license_duration_days: settings.licenseDurationDays || 30,
            is_active: settings.isActive,
          } as any)
        }
      }

      try {
        localStorage.setItem(MP_LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings))
      } catch {
        // ignore
      }

      return { success: true, data: { success: true } }
    } catch (err: any) {
      logger.error('Erro ao salvar configurações do Mercado Pago:', err)
      return { success: false, error: err.message || 'Falha ao salvar configurações.' }
    }
  },

  /**
   * Testa a validade do Access Token do Mercado Pago consultando a API oficial.
   */
  async testConnection(token?: string): Promise<MercadoPagoTestResult> {
    try {
      let accessToken = token?.trim()

      if (!accessToken) {
        const current = await this.getSettings()
        if (current.success && current.data?.accessToken) {
          accessToken = current.data.accessToken
        }
      }

      if (!accessToken) {
        return {
          connected: false,
          error: 'Nenhum Access Token informado ou configurado.',
        }
      }

      // Consulta através do backend serverless para evitar bloqueio de CORS no navegador
      const apiBase = getApiBaseUrl()
      const response = await fetch(`${apiBase}/api/mercadopago/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken }),
      })

      if (response.ok) {
        const data = await response.json()
        return data
      }

      const errData = await response.json().catch(() => ({}))
      return {
        connected: false,
        error: errData.error || `Erro ao testar conexão (HTTP ${response.status})`,
      }
    } catch (err: any) {
      return {
        connected: false,
        error: `Falha na conexão com Mercado Pago: ${err.message || 'Verifique sua conexão.'}`,
      }
    }
  },

  /**
   * Gera uma nova cobrança PIX com QR Code dinâmico e código Copia e Cola.
   */
  async createPixPayment(params: CreatePixPaymentParams): Promise<ServiceResult<MercadoPagoPixTransaction>> {
    try {
      // 1. Busca configurações ativas
      const settingsRes = await this.getSettings()
      if (!settingsRes.success) {
        return {
          success: false,
          error: settingsRes.error,
        }
      }

      if (!settingsRes.data.accessToken) {
        return {
          success: false,
          error:
            'O gateway do Mercado Pago não possui um Access Token configurado nas Configurações do Sistema.',
        }
      }
      const settings = settingsRes.data

      const formattedAmount = Number(params.amount.toFixed(2))
      const description =
        params.description || `Licença JB Gestão - ${params.accessPlanName || 'Plano de Acesso'}`

      // 2. Chama a API serverless na Vercel (eliminando bloqueio de CORS do navegador)
      const apiBase = getApiBaseUrl()
      const response = await fetch(`${apiBase}/api/mercadopago/create-pix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: params.organizationId,
          accessPlanId: params.accessPlanId,
          accessPlanName: params.accessPlanName,
          contractInvoiceId: params.contractInvoiceId,
          amount: formattedAmount,
          description: description,
          payerName: params.payerName,
          payerEmail: params.payerEmail,
          payerDocument: params.payerDocument,
          licenseDaysGranted: params.licenseDaysGranted || settings.licenseDurationDays || 30,
          accessToken: settings.accessToken.trim(),
          notificationUrl: settings.notificationUrl?.trim() || 'https://controlesoft.vercel.app/api/mercadopago/webhook',
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const errorMsg =
          data.error ||
          data.message ||
          `Erro ao gerar cobrança PIX no Mercado Pago (HTTP ${response.status})`
        logger.error('Erro na API Mercado Pago:', data)
        return { success: false, error: errorMsg }
      }

      const txRecord: MercadoPagoPixTransaction = {
        id: data.transactionId || crypto.randomUUID(),
        organizationId: params.organizationId,
        contractInvoiceId: params.contractInvoiceId,
        accessPlanId: params.accessPlanId,
        accessPlanName: params.accessPlanName,
        mpPaymentId: data.mpPaymentId,
        idempotencyKey: data.transactionId,
        status: data.status || 'pending',
        statusDetail: data.statusDetail || 'pending_waiting_transfer',
        amount: data.amount || formattedAmount,
        description: description,
        qrCode: data.qrCode,
        qrCodeBase64: data.qrCodeBase64,
        ticketUrl: data.ticketUrl,
        payerName: params.payerName,
        payerEmail: params.payerEmail,
        payerDocument: params.payerDocument,
        expiresAt: data.expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        licenseDaysGranted: params.licenseDaysGranted || 30,
        licenseActivated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Sincroniza localmente com o Supabase para que a inscrição Realtime funcione
      try {
        await supabase.from('mercadopago_pix_transactions').upsert(
          {
            organization_id: params.organizationId,
            contract_invoice_id: params.contractInvoiceId || null,
            access_plan_id: params.accessPlanId || null,
            access_plan_name: params.accessPlanName || 'Plano de Acesso',
            mp_payment_id: data.mpPaymentId,
            idempotency_key: data.transactionId,
            status: data.status || 'pending',
            status_detail: data.statusDetail || 'pending_waiting_transfer',
            amount: data.amount || formattedAmount,
            description: description,
            qr_code: data.qrCode,
            qr_code_base64: data.qrCodeBase64,
            ticket_url: data.ticketUrl,
            payer_name: params.payerName,
            payer_email: params.payerEmail,
            payer_document: params.payerDocument || null,
            expires_at: data.expiresAt,
            license_days_granted: params.licenseDaysGranted || 30,
            license_activated: false,
          } as any,
          { onConflict: 'mp_payment_id' },
        )
      } catch (upsertErr) {
        logger.warn('Aviso ao sincronizar PIX no Supabase:', { error: String(upsertErr) })
      }

      return { success: true, data: txRecord }
    } catch (err: any) {
      logger.error('Erro geral ao criar PIX Mercado Pago:', err)
      return {
        success: false,
        error: err.message || 'Falha ao comunicar com o servidor de pagamentos.',
      }
    }
  },

  /**
   * Consulta o status atualizado de uma transação diretamente na API oficial do Mercado Pago
   * e, se estiver aprovada, ativa o acesso instantaneamente.
   */
  async checkPaymentStatus(mpPaymentId: number): Promise<ServiceResult<{ status: string; isApproved: boolean }>> {
    try {
      const settingsRes = await this.getSettings()
      const token = settingsRes.success ? settingsRes.data?.accessToken : ''

      const apiBase = getApiBaseUrl()
      const queryParam = token ? `?paymentId=${mpPaymentId}&token=${encodeURIComponent(token)}` : `?paymentId=${mpPaymentId}`
      const response = await fetch(`${apiBase}/api/mercadopago/check-status${queryParam}`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        return {
          success: false,
          error: errData.error || `Erro ao consultar Mercado Pago (HTTP ${response.status})`,
        }
      }

      const data = await response.json()
      return {
        success: true,
        data: {
          status: data.status,
          isApproved: data.isApproved,
        },
      }
    } catch (err: any) {
      logger.error('Erro ao consultar status:', err)
      return { success: false, error: err.message || 'Erro ao consultar status.' }
    }
  },

  /**
   * Lista transações e métricas para a tela administrativa de controle de pagamentos.
   */
  async listTransactions(filters?: {
    status?: string
    search?: string
    limit?: number
    offset?: number
  }): Promise<
    ServiceResult<{
      metrics: MercadoPagoMetrics
      transactions: MercadoPagoPixTransaction[]
    }>
  > {
    try {
      const { data, error } = await supabase.rpc('admin_list_pix_transactions', {
        p_status: filters?.status || 'all',
        p_search: filters?.search || '',
        p_limit: filters?.limit || 50,
        p_offset: filters?.offset || 0,
      })

      if (error) {
        // Fallback direto via select
        const query = supabase
          .from('mercadopago_pix_transactions')
          .select('*')
          .order('created_at', { ascending: false })

        if (filters?.status && filters.status !== 'all') {
          query.eq('status', filters.status)
        }

        const { data: rows } = await query.limit(filters?.limit || 50)
        const items = (rows || []).map((r: any) => ({
          id: r.id,
          organizationId: r.organization_id,
          contractInvoiceId: r.contract_invoice_id,
          accessPlanId: r.access_plan_id,
          accessPlanName: r.access_plan_name,
          mpPaymentId: r.mp_payment_id,
          idempotencyKey: r.idempotency_key,
          status: r.status,
          statusDetail: r.status_detail,
          amount: Number(r.amount),
          description: r.description,
          qrCode: r.qr_code,
          qrCodeBase64: r.qr_code_base64,
          ticketUrl: r.ticket_url,
          payerName: r.payer_name,
          payerEmail: r.payer_email,
          payerDocument: r.payer_document,
          expiresAt: r.expires_at,
          paidAt: r.paid_at,
          licenseDaysGranted: r.license_days_granted,
          licenseActivated: r.license_activated,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }))

        const approved = items.filter((x: any) => x.status === 'approved')
        return {
          success: true,
          data: {
            metrics: {
              totalApprovedAmount: approved.reduce((acc: number, cur: any) => acc + cur.amount, 0),
              countApproved: approved.length,
              countPending: items.filter((x: any) => x.status === 'pending').length,
              countRejected: items.filter((x: any) => x.status === 'rejected').length,
              countCancelled: items.filter((x: any) => ['cancelled', 'refunded'].includes(x.status)).length,
              totalCount: items.length,
            },
            transactions: items,
          },
        }
      }

      const res = data as any
      const metrics: MercadoPagoMetrics = {
        totalApprovedAmount: Number(res.metrics?.total_approved_amount || 0),
        countApproved: Number(res.metrics?.count_approved || 0),
        countPending: Number(res.metrics?.count_pending || 0),
        countRejected: Number(res.metrics?.count_rejected || 0),
        countCancelled: Number(res.metrics?.count_cancelled || 0),
        totalCount: Number(res.metrics?.total_count || 0),
      }

      const transactions: MercadoPagoPixTransaction[] = (res.transactions || []).map((t: any) => ({
        id: t.id,
        organizationId: t.organization_id,
        organizationName: t.organization_name,
        organizationSlug: t.organization_slug,
        contractInvoiceId: t.contract_invoice_id,
        accessPlanId: t.access_plan_id,
        accessPlanName: t.access_plan_name,
        mpPaymentId: t.mp_payment_id,
        idempotencyKey: t.idempotency_key,
        status: t.status,
        statusDetail: t.status_detail,
        amount: Number(t.amount),
        description: t.description,
        qrCode: t.qr_code,
        qrCodeBase64: t.qr_code_base64,
        ticketUrl: t.ticket_url,
        payerName: t.payer_name,
        payerEmail: t.payer_email,
        payerDocument: t.payer_document,
        expiresAt: t.expires_at,
        paidAt: t.paid_at,
        licenseDaysGranted: t.license_days_granted,
        licenseActivated: t.license_activated,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }))

      return { success: true, data: { metrics, transactions } }
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha ao listar transações.' }
    }
  },

  /**
   * Simula a aprovação de uma cobrança PIX para testes rápidos do administrador em Sandbox.
   */
  async simulateApproval(transactionId: string): Promise<ServiceResult<{ success: boolean; message: string }>> {
    try {
      const { data, error } = await supabase.rpc('admin_simulate_pix_payment_approval', {
        p_transaction_id: transactionId,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      const res = data as any
      return {
        success: true,
        data: {
          success: res.success,
          message: res.message || 'Pagamento simulado com sucesso!',
        },
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  },

  /**
   * Inscreve-se nas atualizações em tempo real (Supabase Realtime) de uma transação.
   * Quando o Webhook aprova o pagamento, essa função dispara o callback imediatamente.
   */
  subscribeToTransaction(
    transactionId: string,
    onStatusChange: (updatedTx: Partial<MercadoPagoPixTransaction>) => void,
  ) {
    const channel = supabase
      .channel(`mp_pix_${transactionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mercadopago_pix_transactions',
          filter: `id=eq.${transactionId}`,
        },
        (payload) => {
          const newRow = payload.new as any
          onStatusChange({
            id: newRow.id,
            status: newRow.status,
            statusDetail: newRow.status_detail,
            paidAt: newRow.paid_at,
            licenseActivated: newRow.license_activated,
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  },
}
