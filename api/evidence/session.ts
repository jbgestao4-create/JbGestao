// api/evidence/session.ts
// Endpoint para captura e validação de evidências técnicas no servidor (IP, headers, geolocalização e data/hora UTC)

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

  const rawIpHeader =
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    '127.0.0.1'

  // O header x-forwarded-for pode conter múltiplos IPs: "cliente, proxy1, proxy2"
  const clientIp = String(rawIpHeader).split(',')[0].trim()
  const isIpv6 = clientIp.includes(':')

  const country = (req.headers['x-vercel-ip-country'] as string) || 'BR'
  const region = (req.headers['x-vercel-ip-country-region'] as string) || null
  const rawCity = req.headers['x-vercel-ip-city'] ? String(req.headers['x-vercel-ip-city']) : null
  let city: string | null = null
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity)
    } catch {
      city = rawCity
    }
  }

  const userAgent = (req.headers['user-agent'] as string) || 'Browser'
  const serverTimestampUtc = new Date().toISOString()

  return res.status(200).json({
    success: true,
    serverVerified: true,
    ip: clientIp,
    ipType: isIpv6 ? 'IPv6' : 'IPv4',
    serverTimestampUtc,
    serverTimestampLocal: new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'full',
      timeStyle: 'long',
    }),
    timezone: 'America/Sao_Paulo (UTC-03:00)',
    geo: {
      country,
      region,
      city,
      isApproximate: true,
      legalNote:
        'A geolocalização por endereço IP é aproximada e destina-se a fins cadastrais e de segurança nos termos do art. 7º, IX da Lei nº 13.709/2018 (LGPD).',
    },
    userAgent,
  })
}
