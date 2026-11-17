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

    let accessToken =
      (req.query.token as string)?.trim() ||
      (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '').trim() : '') ||
      process.env.MERCADO_PAGO_ACCESS_TOKEN ||
      ''

    if (!accessToken && supabaseUrl && serviceRoleKey) {
      try {
        const settingsRes = await fetch(`${supabaseUrl}/rest/v1/mercadopago_settings?select=access_token&order=updated_at.desc&limit=1`, {
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

    let serverLicenseActivated = false
    let serverSettledInvoiceId: string | null = null

    // Se aprovado, garante a execução da RPC atômica de liberação e baixa direta no banco
    if (isApproved && supabaseUrl && serviceRoleKey) {
      let rpcSucceeded = false
      let rpcSettledInvoiceId: string | null = null
      try {
        const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/process_mercadopago_payment_approval`, {
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
        if (rpcRes.ok) {
          const rpcJson = await rpcRes.json().catch(() => null)
          if (rpcJson?.success) {
            rpcSucceeded = true
            rpcSettledInvoiceId = rpcJson?.invoice_settled_id || null
            serverLicenseActivated = true
            serverSettledInvoiceId = rpcSettledInvoiceId
          }
        }
      } catch (rpcErr) {
        console.error('Erro ao processar liberação via check-status:', rpcErr)
      }

      // Baixa direta resiliente de APENAS UMA fatura (somente se a RPC não tiver baixado ainda)
      try {
        const txRes = await fetch(
          `${supabaseUrl}/rest/v1/mercadopago_pix_transactions?mp_payment_id=eq.${mpPaymentId}&limit=1`,
          {
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
            },
          }
        )
        const txList = txRes.ok ? await txRes.json() : []
        const tx = txList?.[0]

        const today = new Date().toISOString().split('T')[0]
        const nowIso = new Date().toISOString()

        if (tx) {
          const alreadySettledByRpc = Boolean(rpcSettledInvoiceId)

          if (!alreadySettledByRpc) {
            // 1. Baixa por contract_invoice_id (exclusivo)
            if (tx.contract_invoice_id) {
              await fetch(
                `${supabaseUrl}/rest/v1/software_contract_invoices?id=eq.${tx.contract_invoice_id}&status=in.(pending,overdue)`,
                {
                  method: 'PATCH',
                  headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    status: 'paid',
                    payment_date: today,
                    payment_method: 'PIX',
                    updated_at: nowIso,
                  }),
                }
              )
            } else {
              // 2. Baixa por número de fatura na descrição (ex: FAT-2026-0001-01)
              const fatMatch = (tx.description || '').match(/FAT-[\w-]+/)
              if (fatMatch) {
                await fetch(
                  `${supabaseUrl}/rest/v1/software_contract_invoices?invoice_number=eq.${fatMatch[0]}&status=in.(pending,overdue)`,
                  {
                    method: 'PATCH',
                    headers: {
                      apikey: serviceRoleKey,
                      Authorization: `Bearer ${serviceRoleKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      status: 'paid',
                      payment_date: today,
                      payment_method: 'PIX',
                      updated_at: nowIso,
                    }),
                  }
                )
              } else if (tx.organization_id) {
                // 3. Baixa por organização (ou nome do cliente) - APENAS a fatura pendente/vencida mais antiga
                const unpaidRes = await fetch(
                  `${supabaseUrl}/rest/v1/software_contract_invoices?company_id=eq.${tx.organization_id}&status=in.(pending,overdue)&order=due_date.asc&limit=1`,
                  {
                    headers: {
                      apikey: serviceRoleKey,
                      Authorization: `Bearer ${serviceRoleKey}`,
                    },
                  }
                )
                let unpaidList = unpaidRes.ok ? await unpaidRes.json() : []
                if ((!unpaidList || unpaidList.length === 0) && tx.payer_name) {
                  const byNameRes = await fetch(
                    `${supabaseUrl}/rest/v1/software_contract_invoices?client_name=ilike.${encodeURIComponent(tx.payer_name.trim())}&status=in.(pending,overdue)&order=due_date.asc&limit=1`,
                    {
                      headers: {
                        apikey: serviceRoleKey,
                        Authorization: `Bearer ${serviceRoleKey}`,
                      },
                    }
                  )
                  unpaidList = byNameRes.ok ? await byNameRes.json() : []
                }
                if (unpaidList && unpaidList.length > 0) {
                  await fetch(
                    `${supabaseUrl}/rest/v1/software_contract_invoices?id=eq.${unpaidList[0].id}`,
                    {
                      method: 'PATCH',
                      headers: {
                        apikey: serviceRoleKey,
                        Authorization: `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        status: 'paid',
                        payment_date: today,
                        payment_method: 'PIX',
                        updated_at: nowIso,
                      }),
                    }
                  )
                }
              }
            }
          }

          if (tx.license_activated) {
            serverLicenseActivated = true
          }
          if (!serverSettledInvoiceId && tx.contract_invoice_id) {
            serverSettledInvoiceId = tx.contract_invoice_id
          }

          // 4. Apenas se a RPC não processou ainda, marca a transação como aprovada
          if (!rpcSucceeded) {
            await fetch(`${supabaseUrl}/rest/v1/mercadopago_pix_transactions?id=eq.${tx.id}`, {
              method: 'PATCH',
              headers: {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                status: 'approved',
                status_detail: mpData.status_detail || 'accredited',
                paid_at: nowIso,
                updated_at: nowIso,
              }),
            })
          }
        }
      } catch (directErr) {
        console.error('Erro na baixa direta via check-status:', directErr)
      }
    }

    return res.status(200).json({
      status: mpData.status,
      statusDetail: mpData.status_detail,
      isApproved,
      licenseActivated: serverLicenseActivated,
      settledInvoiceId: serverSettledInvoiceId,
      paidAt: mpData.date_approved,
      amount: mpData.transaction_amount,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao consultar pagamento.' })
  }
}
