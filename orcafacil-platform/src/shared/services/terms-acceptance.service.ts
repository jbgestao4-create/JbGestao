import { supabase } from '@app/config/supabase'
import {
  contractAcceptanceAuditService,
  DEFAULT_LEGAL_DECLARATION,
  resolveServerVerifiedConnection,
  type ContractAcceptanceEvidenceRecord,
} from './contract-acceptance-audit.service'

export interface TermsAcceptanceRecord {
  version: string
  acceptedAt: string
  ip: string
  userAgent: string
  email?: string
  receiptNumber?: string
  documentSha256?: string
  evidenceSha256?: string
  auditChainHeadHash?: string
  companyId?: string
  companyName?: string
  userName?: string
  userDocument?: string
  userPhone?: string
  selectedPlanId?: string
  selectedPlanName?: string
  agreedToTrialAndAutoSuspension?: boolean
  termTitle?: string
  termSnapshot?: string
  authMethod?: string
}

export interface RecordTermsAcceptanceOptions {
  companyId?: string
  companyName?: string
  companyDocument?: string
  contractNumber?: string
  userName?: string
  userDocument?: string
  userPhone?: string
  userBirthDate?: string
  userAddress?: string
  selectedPlanId?: string
  selectedPlanName?: string
  agreedToTrialAndAutoSuspension?: boolean
  termTitle?: string
  termSnapshot?: string
  version?: string
  authMethod?: string
  declarationText?: string
  checkboxCheckedAt?: string | null
  buttonClickedAt?: string | null
}

const TERMS_VERSION = '2.0'
const STORAGE_KEY = 'jb_terms_acceptance_v2'
const COMPANY_STORAGE_PREFIX = 'jb_terms_acceptance_company_'

async function resolvePublicIp(): Promise<string> {
  try {
    const conn = await resolveServerVerifiedConnection()
    if (conn?.ip) return conn.ip
  } catch {
    // fallback
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

    // 1. Verifica metadata do Supabase Auth
    const metaAccepted = userMetadata?.terms_accepted_v2 as TermsAcceptanceRecord | undefined
    if (metaAccepted?.acceptedAt) {
      return true
    }

    // 2. Verifica localStorage vinculado ao e-mail
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`${STORAGE_KEY}_${cleanEmail}`)
        if (raw) {
          const parsed = JSON.parse(raw) as TermsAcceptanceRecord
          if (parsed?.acceptedAt) {
            return true
          }
        }
      } catch {
        // ignore
      }
    }

    return false
  },

  hasAcceptedForPlan(
    email?: string | null,
    userMetadata?: any,
    currentPlanId?: string | null,
    requiredVersion?: string,
  ): boolean {
    if (!email) return false
    const cleanEmail = email.trim().toLowerCase()

    let record: TermsAcceptanceRecord | null = null

    // 1. Verifica no userMetadata
    const metaAccepted = userMetadata?.terms_accepted_v2 as TermsAcceptanceRecord | undefined
    if (metaAccepted?.acceptedAt) {
      record = metaAccepted
    }

    // 2. Verifica no LocalStorage
    if (!record && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`${STORAGE_KEY}_${cleanEmail}`)
        if (raw) {
          record = JSON.parse(raw) as TermsAcceptanceRecord
        }
      } catch {
        // ignore
      }
    }

    if (!record || !record.acceptedAt) {
      return false
    }

    // Se uma versão específica foi exigida e for diferente da aceita
    if (requiredVersion && record.version && record.version !== requiredVersion) {
      return false
    }

    // Se a organização tem um plano específico configurado e o aceite anterior foi para outro plano
    if (currentPlanId && record.selectedPlanId && record.selectedPlanId !== currentPlanId) {
      return false
    }

    return true
  },

  getLocalAcceptance(email?: string | null): TermsAcceptanceRecord | null {
    if (typeof window === 'undefined') return null
    try {
      if (email) {
        const key = `${STORAGE_KEY}_${email.trim().toLowerCase()}`
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw) as TermsAcceptanceRecord
          if (parsed?.acceptedAt) {
            return parsed
          }
        }
      }
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as TermsAcceptanceRecord
      if (parsed?.acceptedAt) {
        return parsed
      }
      return null
    } catch {
      return null
    }
  },

  getAcceptanceForCompany(companyId?: string | null, adminEmail?: string | null): TermsAcceptanceRecord | null {
    if (typeof window === 'undefined') return null

    try {
      if (companyId) {
        const compKey = `${COMPANY_STORAGE_PREFIX}${companyId}`
        const compRaw = localStorage.getItem(compKey)
        if (compRaw) {
          const parsed = JSON.parse(compRaw) as TermsAcceptanceRecord
          if (parsed?.acceptedAt) {
            return parsed
          }
        }
      }

      if (adminEmail) {
        const userAcceptance = this.getLocalAcceptance(adminEmail)
        if (userAcceptance) {
          return userAcceptance
        }
      }
    } catch {
      // ignore
    }

    return null
  },

  async recordAcceptance(
    email?: string | null,
    persistToAuthUser = true,
    options?: RecordTermsAcceptanceOptions,
  ): Promise<TermsAcceptanceRecord> {
    const ip = await resolvePublicIp()
    const cleanEmail = email?.trim().toLowerCase() || 'usuario@sistema'
    const nowIso = new Date().toISOString()

    // 1. Registra no serviço oficial de Auditoria e Evidências Criptográficas
    let auditRecord: ContractAcceptanceEvidenceRecord | null = null
    try {
      const documentContent =
        options?.termSnapshot ||
        `Termos de Uso e Condições de Licença de Software (SaaS)\nPlano: ${options?.selectedPlanName || 'Padrão'}\nVersão: ${options?.version || TERMS_VERSION}`

      const auditRes = await contractAcceptanceAuditService.recordAcceptance({
        contractNumber: options?.contractNumber,
        contractName: options?.termTitle || `Termos de Uso — ${options?.selectedPlanName || 'Plano Padrão'}`,
        contractVersion: options?.version || TERMS_VERSION,
        documentContent,
        userName: options?.userName || cleanEmail.split('@')[0],
        userEmail: cleanEmail,
        userDocument: options?.userDocument,
        userPhone: options?.userPhone,
        userBirthDate: options?.userBirthDate,
        userAddress: options?.userAddress,
        companyId: options?.companyId,
        companyName: options?.companyName,
        companyDocument: options?.companyDocument,
        planId: options?.selectedPlanId,
        planName: options?.selectedPlanName,
        authMethod: options?.authMethod || 'password',
        declarationText: options?.declarationText || DEFAULT_LEGAL_DECLARATION,
        checkboxCheckedAt: options?.checkboxCheckedAt || nowIso,
        buttonClickedAt: options?.buttonClickedAt || nowIso,
      })

      if (auditRes.success && auditRes.data) {
        auditRecord = auditRes.data
      }
    } catch {
      // fallback
    }

    const record: TermsAcceptanceRecord = {
      version: options?.version || TERMS_VERSION,
      acceptedAt: auditRecord?.acceptedAtUtc || nowIso,
      ip: auditRecord?.ipAddress || ip,
      userAgent: auditRecord?.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser'),
      email: cleanEmail,
      receiptNumber: auditRecord?.receiptNumber,
      documentSha256: auditRecord?.documentSha256,
      evidenceSha256: auditRecord?.evidenceSha256,
      auditChainHeadHash: auditRecord?.auditChainHeadHash,
      companyId: options?.companyId,
      companyName: options?.companyName,
      userName: options?.userName,
      userDocument: options?.userDocument,
      userPhone: options?.userPhone,
      selectedPlanId: options?.selectedPlanId,
      selectedPlanName: options?.selectedPlanName,
      agreedToTrialAndAutoSuspension: options?.agreedToTrialAndAutoSuspension ?? true,
      termTitle: options?.termTitle,
      termSnapshot: options?.termSnapshot,
      authMethod: options?.authMethod || 'password',
    }

    if (typeof window !== 'undefined') {
      try {
        if (cleanEmail) {
          localStorage.setItem(`${STORAGE_KEY}_${cleanEmail}`, JSON.stringify(record))
        }
        if (options?.companyId) {
          localStorage.setItem(`${COMPANY_STORAGE_PREFIX}${options.companyId}`, JSON.stringify(record))
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
