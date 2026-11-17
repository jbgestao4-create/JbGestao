// Endpoint para checagem imediata de status do pagamento PIX na API Oficial do Mercado Pago

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const mpPaymentId = req.query.paymentId || req.query.id

  if (!mpPaymentId) {
    return res.status(400).json({ error: 'Parâmetro paymentId é obrigatório.' })
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

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
        console.error('Erro ao buscar token:', err)
      }
    }

    if (!accessToken) {
      return res.status(500).json({ error: 'Access Token do Mercado Pago não configurado.' })
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        'Content-Type': 'application/json',
      },
    })

    if (!mpRes.ok) {
      return res.status(mpRes.status).json({ error: 'Pagamento não encontrado no Mercado Pago.' })
    }

    const mpData = await mpRes.json()
    const isApproved = mpData.status === 'approved'

    // Se aprovado, garante a execução da RPC de liberação
    if (isApproved && supabaseUrl && serviceRoleKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/rpc/process_mercadopago_payment_approval`, {
          method: 'POST',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_mp_payment_id: Number(mpPaymentId),
            p_raw_data: mpData,
            p_status_detail: mpData.status_detail || 'accredited',
          }),
        })
      } catch (rpcErr) {
        console.error('Erro ao processar liberação via check-status:', rpcErr)
      }
    }

    return res.status(200).json({
      status: mpData.status,
      statusDetail: mpData.status_detail,
      isApproved,
      paidAt: mpData.date_approved,
      amount: mpData.transaction_amount,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao consultar pagamento.' })
  }
}
