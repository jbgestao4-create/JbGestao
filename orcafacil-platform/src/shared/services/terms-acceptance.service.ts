import { supabase } from '@app/config/supabase'

export interface TermsAcceptanceRecord {
  version: string
  acceptedAt: string
  ip: string
  userAgent: string
  email?: string
  selectedPlanId?: string
  selectedPlanName?: string
  agreedToTrialAndAutoSuspension?: boolean
}

export interface RecordTermsAcceptanceOptions {
  selectedPlanId?: string
  selectedPlanName?: string
  agreedToTrialAndAutoSuspension?: boolean
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

  hasAccepted(email?: string | null, userMetadata?: any): boolean {
    if (!email) return false
    const cleanEmail = email.trim().toLowerCase()

    // 1. Verifica metadata do Supabase Auth (se o usuário já gravou o aceite na nuvem)
    const metaAccepted = userMetadata?.terms_accepted_v2
    if (metaAccepted?.acceptedAt && metaAccepted?.version === TERMS_VERSION) {
      return true
    }

    // 2. Verifica localStorage estritamente vinculado a este e-mail
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`${STORAGE_KEY}_${cleanEmail}`)
        if (raw) {
          const parsed = JSON.parse(raw) as TermsAcceptanceRecord
          if (parsed?.version === TERMS_VERSION && parsed?.acceptedAt) {
            return true
          }
        }
      } catch {
        // ignore
      }
    }

    return false
  },

  getLocalAcceptance(email?: string | null): TermsAcceptanceRecord | null {
    if (typeof window === 'undefined') return null
    try {
      if (email) {
        const key = `${STORAGE_KEY}_${email.trim().toLowerCase()}`
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw) as TermsAcceptanceRecord
          if (parsed?.version === TERMS_VERSION && parsed?.acceptedAt) {
            return parsed
          }
        }
        return null
      }
      const raw = localStorage.getItem(STORAGE_KEY)
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

  async recordAcceptance(
    email?: string | null,
    persistToAuthUser = true,
    options?: RecordTermsAcceptanceOptions,
  ): Promise<TermsAcceptanceRecord> {
    const ip = await resolvePublicIp()
    const cleanEmail = email?.trim().toLowerCase()
    const record: TermsAcceptanceRecord = {
      version: TERMS_VERSION,
      acceptedAt: new Date().toISOString(),
      ip,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser',
      email: cleanEmail || undefined,
      selectedPlanId: options?.selectedPlanId,
      selectedPlanName: options?.selectedPlanName,
      agreedToTrialAndAutoSuspension: options?.agreedToTrialAndAutoSuspension ?? true,
    }

    if (typeof window !== 'undefined') {
      try {
        if (cleanEmail) {
          localStorage.setItem(`${STORAGE_KEY}_${cleanEmail}`, JSON.stringify(record))
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
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
