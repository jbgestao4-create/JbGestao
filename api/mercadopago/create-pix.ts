// Endpoint para geração segura de cobrança PIX via API Oficial do Mercado Pago

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' })
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const {
      organizationId,
      accessPlanId,
      accessPlanName,
      contractInvoiceId,
      amount,
      description,
      payerName,
      payerEmail,
      payerDocument,
      licenseDaysGranted,
    } = body

    if (!organizationId || !amount) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes: organizationId e amount.' })
    }

    // 1. Busca Access Token do Mercado Pago
    let accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || ''
    let notificationUrl = process.env.MERCADO_PAGO_WEBHOOK_URL || ''

    if ((!accessToken || !notificationUrl) && supabaseUrl && serviceRoleKey) {
      try {
        const settingsRes = await fetch(
          `${supabaseUrl}/rest/v1/mercadopago_settings?select=access_token,notification_url&limit=1`,
          {
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
            },
          }
        )
        if (settingsRes.ok) {
          const rows = await settingsRes.json()
          if (rows?.[0]) {
            if (!accessToken && rows[0].access_token) accessToken = rows[0].access_token
            if (!notificationUrl && rows[0].notification_url) notificationUrl = rows[0].notification_url
          }
        }
      } catch (err) {
        console.error('Erro ao buscar credenciais do banco:', err)
      }
    }

    if (!accessToken) {
      return res.status(500).json({
        error: 'Nenhum Access Token do Mercado Pago configurado no sistema.',
      })
    }

    const idempotencyKey = crypto.randomUUID()
    const formattedAmount = Number(Number(amount).toFixed(2))
    const nameParts = (payerName || 'Cliente').trim().split(/\s+/)
    const firstName = nameParts[0] || 'Cliente'
    const lastName = nameParts.slice(1).join(' ') || 'JB'
    const cleanDoc = (payerDocument || '').replace(/\D/g, '')

    const mpPayload: any = {
      transaction_amount: formattedAmount,
      description: description || `Licença JB Gestão - ${accessPlanName || 'Plano de Acesso'}`,
      payment_method_id: 'pix',
      payer: {
        email: payerEmail || 'cliente@jbsoftware.com.br',
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
      external_reference: organizationId,
    }

    if (notificationUrl) {
      mpPayload.notification_url = notificationUrl
    }

    // 2. Chamada à API oficial do Mercado Pago
    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        'X-Idempotency-Key': idempotencyKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mpPayload),
    })

    const mpData = await mpRes.json()

    if (!mpRes.ok) {
      return res.status(mpRes.status).json({
        error: mpData.message || mpData.cause?.[0]?.description || 'Erro ao gerar cobrança PIX no Mercado Pago.',
        details: mpData,
      })
    }

    const txData = mpData.point_of_interaction?.transaction_data
    const qrCode = txData?.qr_code || ''
    const qrCodeBase64 = txData?.qr_code_base64 || ''
    const ticketUrl = txData?.ticket_url || ''

    // 3. Salva no banco de dados Supabase
    if (supabaseUrl && serviceRoleKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/mercadopago_pix_transactions`, {
          method: 'POST',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            organization_id: organizationId,
            contract_invoice_id: contractInvoiceId || null,
            access_plan_id: accessPlanId || null,
            access_plan_name: accessPlanName || 'Plano de Acesso',
            mp_payment_id: mpData.id,
            idempotency_key: idempotencyKey,
            status: mpData.status || 'pending',
            status_detail: mpData.status_detail || 'pending_waiting_transfer',
            amount: formattedAmount,
            description: mpPayload.description,
            qr_code: qrCode,
            qr_code_base64: qrCodeBase64,
            ticket_url: ticketUrl,
            payer_name: payerName,
            payer_email: payerEmail,
            payer_document: payerDocument || null,
            expires_at: mpData.date_of_expiration,
            license_days_granted: licenseDaysGranted || 30,
            license_activated: false,
            raw_response: mpData,
          }),
        })
      } catch (dbErr) {
        console.error('Erro ao salvar no banco via serverless:', dbErr)
      }
    }

    return res.status(200).json({
      success: true,
      transactionId: idempotencyKey,
      mpPaymentId: mpData.id,
      amount: formattedAmount,
      status: mpData.status,
      qrCode,
      qrCodeBase64,
      ticketUrl,
      expiresAt: mpData.date_of_expiration,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro interno ao processar PIX.' })
  }
}
