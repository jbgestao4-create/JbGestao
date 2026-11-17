// Supabase Edge Function: mercadopago-webhook
// Deno TypeScript runtime

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const url = new URL(req.url)
    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const action = body.action || url.searchParams.get('topic') || url.searchParams.get('type') || 'payment.updated'
    const mpPaymentId =
      body.data?.id ||
      url.searchParams.get('data.id') ||
      url.searchParams.get('id') ||
      (body.type === 'payment' ? body.id : null)

    if (!mpPaymentId) {
      return new Response(JSON.stringify({ received: true, note: 'Nenhum paymentId informado.' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Busca token
    let accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN') || ''
    if (!accessToken) {
      const { data: cfg } = await supabase
        .from('mercadopago_settings')
        .select('access_token')
        .limit(1)
        .maybeSingle()
      if (cfg?.access_token) accessToken = cfg.access_token
    }

    if (!accessToken) {
      return new Response(JSON.stringify({ received: true, error: 'Token não configurado.' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Valida com Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!mpRes.ok) {
      return new Response(JSON.stringify({ received: true, error: 'Falha ao consultar MP.' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const mpPayment = await mpRes.json()
    const paymentStatus = mpPayment.status

    // Grava log
    await supabase.from('mercadopago_webhook_logs').insert({
      mp_payment_id: mpPaymentId,
      event_type: mpPayment.payment_type_id || 'pix',
      action: action,
      payload: mpPayment,
      processed: paymentStatus === 'approved',
      result_message: `Status: ${paymentStatus} (${mpPayment.status_detail || ''})`,
    })

    // Libera se aprovado
    if (paymentStatus === 'approved') {
      await supabase.rpc('process_mercadopago_payment_approval', {
        p_mp_payment_id: Number(mpPaymentId),
        p_raw_data: mpPayment,
        p_status_detail: mpPayment.status_detail || 'accredited',
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        mp_payment_id: mpPaymentId,
        status: paymentStatus,
        liberado: paymentStatus === 'approved',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
