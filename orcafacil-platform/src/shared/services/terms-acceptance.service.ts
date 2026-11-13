import { supabase } from '@app/config/supabase'

export interface TermsAcceptanceRecord {
  version: string
  acceptedAt: string
  ip: string
  userAgent: string
  email?: string
}

const TERMS_VERSION = '2.0'
const STORAGE_KEY = 'jb_terms_acceptance_v2'

async function resolvePublicIp(): Promise<string> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (res.ok) {
      const json = (await res.json()) as { ip?: string }
      if (json?.ip) return json.ip
    }
  } catch {
    // Fallback caso o navegador bloqueie ou esteja offline
  }
  return 'IP registrado na sessão do servidor'
}

export const termsAcceptanceService = {
  getVersion(): string {
    return TERMS_VERSION
  },

  getLocalAcceptance(email?: string | null): TermsAcceptanceRecord | null {
    if (typeof window === 'undefined') return null
    try {
      const key = email ? `${STORAGE_KEY}_${email.trim().toLowerCase()}` : STORAGE_KEY
      const raw = localStorage.getItem(key) || localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as TermsAcceptanceRecord
      if (parsed?.version === TERMS_VERSION && parsed?.acceptedAt) {
        return parsed
      }
      return null
    } catch {
      return null
    }
  },

  async recordAcceptance(email?: string | null, persistToAuthUser = true): Promise<TermsAcceptanceRecord> {
    const ip = await resolvePublicIp()
    const record: TermsAcceptanceRecord = {
      version: TERMS_VERSION,
      acceptedAt: new Date().toISOString(),
      ip,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser',
      email: email?.trim().toLowerCase() || undefined,
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
        if (record.email) {
          localStorage.setItem(`${STORAGE_KEY}_${record.email}`, JSON.stringify(record))
        }
      } catch {
        // ignore storage quota errors
      }
    }

    if (persistToAuthUser) {
      try {
        await supabase.auth.updateUser({
          data: {
            terms_accepted_v2: record,
          },
        })
      } catch {
        // ignore if unauthenticated
      }
    }

    return record
  },
}
