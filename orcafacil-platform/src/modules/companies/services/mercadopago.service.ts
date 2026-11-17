import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult } from '@shared/types/common'

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
        if (!current.success || !current.data?.accessToken) {
          return {
            connected: false,
            error: 'Nenhum Access Token informado ou configurado.',
          }
        }
        accessToken = current.data.accessToken
      }

      // Consulta a API oficial do Mercado Pago para obter os dados do usuário/aplicação
      const response = await fetch('https://api.mercadopago.com/v1/users/me', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          connected: false,
          error:
            errorData.message ||
            `Token inválido ou rejeitado pela API do Mercado Pago (HTTP ${response.status}).`,
        }
      }

      const user = await response.json()
      const isTestToken = accessToken.startsWith('TEST-') || user.site_id === 'MLB' && user.id?.toString().length > 12

      return {
        connected: true,
        accountName: user.nickname || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Conta Mercado Pago',
        email: user.email || 'Conta Verificada',
        siteId: user.site_id,
        userId: user.id,
        isSandbox: isTestToken,
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

      const idempotencyKey = crypto.randomUUID()
      const formattedAmount = Number(params.amount.toFixed(2))
      const description =
        params.description || `Licença JB Gestão - ${params.accessPlanName || 'Plano de Acesso'}`

      const nameParts = params.payerName.trim().split(/\s+/)
      const firstName = nameParts[0] || 'Cliente'
      const lastName = nameParts.slice(1).join(' ') || 'JB'
      const cleanDoc = (params.payerDocument || '').replace(/\D/g, '')

      // 2. Prepara o payload para a API oficial de pagamentos v1 do Mercado Pago
      const mpPayload: any = {
        transaction_amount: formattedAmount,
        description: description,
        payment_method_id: 'pix',
        payer: {
          email: params.payerEmail || 'cliente@jbsoftware.com.br',
          first_name: firstName,
          last_name: lastName,
          ...(cleanDoc
            ? {
                identification: {
                  type: cleanDoc.length > 11 ? 'CNPJ' : 'CPF',
                  number: cleanDoc,
                },
              }
            : {}),
        },
        external_reference: params.organizationId,
      }

      mpPayload.notification_url =
        settings.notificationUrl?.trim() || 'https://controlesoft.vercel.app/api/mercadopago/webhook'

      // 3. Chamada à API oficial do Mercado Pago
      const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.accessToken.trim()}`,
          'X-Idempotency-Key': idempotencyKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mpPayload),
      })

      const mpData = await response.json()

      if (!response.ok) {
        const errorMsg =
          mpData.message ||
          mpData.cause?.[0]?.description ||
          `Erro ao gerar PIX no Mercado Pago (HTTP ${response.status})`
        logger.error('Erro na API Mercado Pago:', mpData)
        return { success: false, error: errorMsg }
      }

      const txData = mpData.point_of_interaction?.transaction_data
      const qrCode = txData?.qr_code || ''
      const qrCodeBase64 = txData?.qr_code_base64 || ''
      const ticketUrl = txData?.ticket_url || ''

      // 4. Salva a transação no banco de dados para rastreamento e liberação
      const insertPayload: any = {
        organization_id: params.organizationId,
        contract_invoice_id: params.contractInvoiceId || null,
        access_plan_id: params.accessPlanId || null,
        access_plan_name: params.accessPlanName || 'Plano de Acesso',
        mp_payment_id: mpData.id,
        idempotency_key: idempotencyKey,
        status: mpData.status || 'pending',
        status_detail: mpData.status_detail || 'pending_waiting_transfer',
        amount: formattedAmount,
        description: description,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        ticket_url: ticketUrl,
        payer_name: params.payerName,
        payer_email: params.payerEmail,
        payer_document: params.payerDocument || null,
        expires_at: mpData.date_of_expiration || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        license_days_granted: params.licenseDaysGranted || settings.licenseDurationDays || 30,
        license_activated: false,
        raw_response: mpData,
      }

      const { data: dbData, error: dbError } = await supabase
        .from('mercadopago_pix_transactions')
        .insert(insertPayload)
        .select('*')
        .single()

      if (dbError) {
        logger.error('Erro ao salvar transação no banco local:', dbError)
      }

      const record: MercadoPagoPixTransaction = {
        id: dbData?.id || idempotencyKey,
        organizationId: params.organizationId,
        contractInvoiceId: params.contractInvoiceId,
        accessPlanId: params.accessPlanId,
        accessPlanName: params.accessPlanName,
        mpPaymentId: mpData.id,
        idempotencyKey: idempotencyKey,
        status: (mpData.status as any) || 'pending',
        statusDetail: mpData.status_detail,
        amount: formattedAmount,
        description: description,
        qrCode: qrCode,
        qrCodeBase64: qrCodeBase64,
        ticketUrl: ticketUrl,
        payerName: params.payerName,
        payerEmail: params.payerEmail,
        payerDocument: params.payerDocument,
        expiresAt: mpData.date_of_expiration,
        licenseDaysGranted: params.licenseDaysGranted || 30,
        licenseActivated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      return { success: true, data: record }
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
      if (!settingsRes.success) {
        return { success: false, error: settingsRes.error }
      }
      if (!settingsRes.data.accessToken) {
        return { success: false, error: 'Access Token não configurado.' }
      }
      const settings = settingsRes.data

      // Consulta direta à API oficial
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${settings.accessToken.trim()}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        return {
          success: false,
          error: `Erro ao consultar Mercado Pago (HTTP ${response.status})`,
        }
      }

      const mpData = await response.json()
      const status = mpData.status // 'approved', 'pending', 'rejected', 'cancelled'

      if (status === 'approved') {
        // Executa a liberação automática no banco de dados via RPC com proteção de idempotência
        await supabase.rpc('process_mercadopago_payment_approval', {
          p_mp_payment_id: mpPaymentId,
          p_raw_data: mpData,
          p_status_detail: mpData.status_detail || 'accredited',
        })

        return {
          success: true,
          data: { status: 'approved', isApproved: true },
        }
      }

      // Atualiza status se não aprovado
      await supabase
        .from('mercadopago_pix_transactions')
        .update({
          status: status,
          status_detail: mpData.status_detail,
          raw_response: mpData,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('mp_payment_id', mpPaymentId)

      return {
        success: true,
        data: { status, isApproved: false },
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha ao consultar status.' }
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
