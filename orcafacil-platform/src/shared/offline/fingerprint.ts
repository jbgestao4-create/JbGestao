/**
 * Gera uma assinatura única e determinística do dispositivo (Hardware + Canvas + Screen)
 * para vinculação de licença de uso único por usuário de organização.
 */
export async function getDeviceFingerprint(): Promise<string> {
  const parts: string[] = [
    navigator.userAgent || '',
    navigator.language || '',
    screen.colorDepth ? screen.colorDepth.toString() : '24',
    `${screen.width || 0}x${screen.height || 0}`,
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency ? navigator.hardwareConcurrency.toString() : '4',
  ]

  // Hash visual via Canvas para distinguir GPU e subpixel rendering
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 40
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = "14px 'Arial'"
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = '#f60'
      ctx.fillRect(125, 1, 62, 20)
      ctx.fillStyle = '#069'
      ctx.fillText('JB_GESTAO_OFFLINE_FINGERPRINT', 2, 15)
      parts.push(canvas.toDataURL())
    }
  } catch {
    // Fallback silencioso caso canvas esteja bloqueado por política de segurança
  }

  // Gera chave aleatória persistente de dispositivo se ainda não existir
  let hardwareUid = localStorage.getItem('jb_device_hardware_uid')
  if (!hardwareUid) {
    hardwareUid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    localStorage.setItem('jb_device_hardware_uid', hardwareUid)
  }
  parts.push(hardwareUid)

  const rawString = parts.join('###')

  if (window.crypto && window.crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(rawString)
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    } catch {
      // Fallback
    }
  }

  // Fallback simples para caso subtle crypto não esteja disponível
  let hash = 0
  for (let i = 0; i < rawString.length; i++) {
    const char = rawString.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash).toString(16) + hardwareUid
}
