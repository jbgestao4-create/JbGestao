// Endpoint para teste de conexão seguro com a API Oficial do Mercado Pago
// Executado no servidor para evitar bloqueios de CORS no navegador

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    let token =
      (body.accessToken as string)?.trim() ||
      (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '').trim() : '') ||
      (req.query?.token as string)?.trim() ||
      process.env.MERCADO_PAGO_ACCESS_TOKEN ||
      ''

    if (!token) {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
      if (supabaseUrl && serviceRoleKey) {
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
              token = rows[0].access_token
            }
          }
        } catch (dbErr) {
          console.error('Erro ao ler token no banco:', dbErr)
        }
      }
    }

    if (!token) {
      return res.status(400).json({
        connected: false,
        error: 'Nenhum Access Token informado ou configurado.',
      })
    }

    const response = await fetch('https://api.mercadopago.com/users/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return res.status(200).json({
        connected: false,
        error:
          errorData.message ||
          `Token inválido ou rejeitado pela API do Mercado Pago (HTTP ${response.status}).`,
      })
    }

    const user = await response.json()
    const isTestUser = user.tags?.includes('test_user') || user.test_data?.test_user === true
    const isTestToken = token.startsWith('TEST-')

    if (isTestUser && token.startsWith('APP_USR-')) {
      return res.status(200).json({
        connected: false,
        accountName: user.nickname || 'Usuário de Teste',
        email: user.email,
        userId: user.id,
        error:
          'Identificamos que este token pertence a um Usuário de Teste (' +
          user.nickname +
          ') gerado com prefixo APP_USR. O Mercado Pago não autoriza pagamentos PIX com credencial de produção para usuários de teste. ' +
          'COMO RESOLVER: ' +
          '1) Para testar em Sandbox: Acesse a aba "Credenciais de teste" da sua aplicação e copie o Access Token iniciado por "TEST-". ' +
          '2) Para cobranças reais: Use as Credenciais de Produção da sua conta titular do Mercado Pago (e confirme se clicou em "Ativar credenciais de produção" no painel).',
      })
    }

    return res.status(200).json({
      connected: true,
      accountName: user.nickname || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Conta Mercado Pago',
      email: user.email || 'Conta Verificada',
      siteId: user.site_id,
      userId: user.id,
      isSandbox: isTestToken || isTestUser,
    })
  } catch (err: any) {
    return res.status(500).json({
      connected: false,
      error: `Falha na conexão com Mercado Pago: ${err.message || 'Verifique sua conexão.'}`,
    })
  }
}
