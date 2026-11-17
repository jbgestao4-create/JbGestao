// Webhook Oficial do Mercado Pago para Confirmação Automática de Pagamentos PIX
// URL de Produção Vercel: https://controlesoft.vercel.app/api/mercadopago/webhook

export default async function handler(req: any, res: any) {
  // CORS & Métodos permitidos
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-signature, x-request-id'
  )

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://atxuclkplpqlczulfhpy.supabase.co'
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0eHVjbGtwbHBxbGN6dWxmaHB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMjk1NDYsImV4cCI6MjEwODgwNTU0Nn0.vThlCc_jfp45ovGopVH-RlKZ3eimC_FIyzKPcorLJlU'

    // Extrai o ID do pagamento enviado pelo Mercado Pago (body ou query string)
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const query = req.query || {}

    const action = body.action || query.topic || query.type || 'payment.updated'
    const mpPaymentId = 
      body.data?.id || 
      query['data.id'] || 
      query.id || 
      (body.type === 'payment' ? body.id : null)

    if (!mpPaymentId) {
      return res.status(200).json({ received: true, message: 'Nenhum ID de pagamento recebido na notificação.' })
    }

    // 1. Obtém o Access Token do Mercado Pago (via ambiente ou tabela mercadopago_settings)
    let accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || ''

    if (!accessToken && supabaseUrl && serviceRoleKey) {
      try {
        const settingsRes = await fetch(`${supabaseUrl}/rest/v1/mercadopago_settings?select=access_token&limit=1`, {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        })
        if (settingsRes.ok) {
          const rows = await settingsRes.json()
          if (rows?.[0]?.access_token) {
            accessToken = rows[0].access_token
          }
        }
      } catch (err) {
        console.error('Erro ao buscar token no Supabase:', err)
      }
    }

    if (!accessToken) {
      console.warn('Access Token do Mercado Pago não configurado para validar transação:', mpPaymentId)
      return res.status(200).json({ received: true, warning: 'Token do Mercado Pago não configurado no servidor.' })
    }

    // 2. Consulta a API oficial do Mercado Pago para verificar autenticidade e status real
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        'Content-Type': 'application/json',
      },
    })

    if (!mpRes.ok) {
      console.error(`Falha ao consultar Mercado Pago para pagamento ${mpPaymentId}: HTTP ${mpRes.status}`)
      return res.status(200).json({ received: true, error: 'Falha ao consultar transação no Mercado Pago.' })
    }

    const mpPayment = await mpRes.json()
    const paymentStatus = mpPayment.status // 'approved', 'pending', 'rejected', 'cancelled'

    // 3. Registra log do webhook no banco de dados para auditoria
    if (supabaseUrl && serviceRoleKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/mercadopago_webhook_logs`, {
          method: 'POST',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            mp_payment_id: mpPaymentId,
            event_type: mpPayment.payment_type_id || 'pix',
            action: action,
            payload: mpPayment,
            processed: paymentStatus === 'approved',
            result_message: `Status Mercado Pago: ${paymentStatus} (${mpPayment.status_detail || ''})`,
          }),
        })
      } catch (logErr) {
        console.error('Erro ao gravar log de webhook:', logErr)
      }

      // 4. Se o status for APROVADO, executa a RPC de liberação automática e instantânea da licença
      if (paymentStatus === 'approved') {
        const approvalRes = await fetch(`${supabaseUrl}/rest/v1/rpc/process_mercadopago_payment_approval`, {
          method: 'POST',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_mp_payment_id: Number(mpPaymentId),
            p_raw_data: mpPayment,
            p_status_detail: mpPayment.status_detail || 'accredited',
          }),
        })

        if (!approvalRes.ok) {
          const approvalErr = await approvalRes.text()
          console.error('Erro na RPC de aprovação de pagamento:', approvalErr)
        } else {
          console.log(`[ControleSoft] Pagamento PIX #${mpPaymentId} aprovado e sistema liberado com sucesso.`)
        }
      }
    }

    return res.status(200).json({
      success: true,
      server: 'https://controlesoft.vercel.app',
      mp_payment_id: mpPaymentId,
      status: paymentStatus,
      liberado: paymentStatus === 'approved',
    })
  } catch (err: any) {
    console.error('Erro geral no webhook:', err)
    return res.status(200).json({ received: true, error: err.message })
  }
}
