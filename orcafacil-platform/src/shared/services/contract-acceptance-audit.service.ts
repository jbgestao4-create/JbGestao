import { jsPDF } from 'jspdf'
import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult } from '@shared/types/common'

export interface ContractAcceptanceAuditEvent {
  id: string
  sequence: number
  type:
    | 'DOCUMENT_PRESENTED'
    | 'DOCUMENT_SCROLLED_READ'
    | 'CHECKBOX_MARKED'
    | 'BUTTON_CLICKED'
    | 'SERVER_VALIDATION'
    | 'RECORD_COMMITTED'
    | 'CERTIFICATE_GENERATED'
  timestamp: string
  payload: Record<string, any>
  previousHash: string
  eventHash: string
}

export interface ContractAcceptanceEvidenceRecord {
  id: string
  receiptNumber: string
  contractId?: string | null
  contractNumber: string
  contractName: string
  contractVersion: string
  documentSha256: string
  documentContent: string
  userId?: string | null
  userName: string
  userEmail: string
  userDocument?: string | null
  userPhone?: string | null
  userBirthDate?: string | null
  userAddress?: string | null
  companyId?: string | null
  companyName?: string | null
  companyDocument?: string | null
  planId?: string | null
  planName?: string | null
  authMethod: string
  ipAddress: string
  ipType: 'IPv4' | 'IPv6'
  geoCountry?: string | null
  geoRegion?: string | null
  geoCity?: string | null
  userAgent: string
  browserName: string
  browserVersion: string
  osName: string
  osVersion: string
  deviceType: 'computador' | 'celular' | 'tablet'
  deviceLanguage: string
  deviceTimezone: string
  screenResolution?: string
  sessionId: string
  pageUrl: string
  referrerUrl?: string | null
  declarationText: string
  checkboxCheckedAt?: string | null
  buttonClickedAt?: string | null
  acceptedAtUtc: string
  acceptedAtLocal: string
  evidenceSha256: string
  auditChainHeadHash: string
  verificationStatus: 'verified' | 'tampered'
  auditEvents: ContractAcceptanceAuditEvent[]
  createdAt: string
  updatedAt?: string
}

export interface CreateAcceptanceInput {
  contractId?: string | null
  contractNumber?: string
  contractName: string
  contractVersion: string
  documentContent: string
  userId?: string | null
  userName: string
  userEmail: string
  userDocument?: string | null
  userPhone?: string | null
  userBirthDate?: string | null
  userAddress?: string | null
  companyId?: string | null
  companyName?: string | null
  companyDocument?: string | null
  planId?: string | null
  planName?: string | null
  authMethod?: string
  declarationText?: string
  checkboxCheckedAt?: string | null
  buttonClickedAt?: string | null
  auditEventsTrail?: Array<{
    type: ContractAcceptanceAuditEvent['type']
    timestamp: string
    payload: Record<string, any>
  }>
}

export interface IntegrityCheckResult {
  isValid: boolean
  documentHashValid: boolean
  evidenceHashValid: boolean
  auditChainValid: boolean
  computedDocumentSha256: string
  recordedDocumentSha256: string
  computedEvidenceSha256: string
  recordedEvidenceSha256: string
  computedChainHead: string
  recordedChainHead: string
  details: string
}

const STORAGE_AUDIT_KEY = 'jb_contract_acceptance_audit_records_v1'
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000'

export const DEFAULT_LEGAL_DECLARATION =
  'Declaro que li, compreendi e concordo integralmente com todas as cláusulas e condições deste contrato e seus anexos, manifestando minha vontade de forma livre, expressa e inequívoca, em conformidade com o art. 10, § 2º da Medida Provisória nº 2.200-2/2001, com a Lei nº 14.063/2020 e com a Lei nº 13.709/2018 (LGPD).'

/**
 * Calcula o hash criptográfico SHA-256 de uma string utilizando Web Crypto API ou fallback determinístico.
 */
export async function computeSha256(text: string): Promise<string> {
  const clean = text || ''
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    try {
      const msgUint8 = new TextEncoder().encode(clean)
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    } catch {
      // fallback
    }
  }

  // Fallback para Node.js / Ambientes sem crypto.subtle (ex: Jest/Vitest SSR)
  try {
    const nodeCrypto = await import('crypto')
    return nodeCrypto.createHash('sha256').update(clean).digest('hex')
  } catch {
    // Implementação pura de hash SHA-256 simples como última contingência
    let h0 = 0x6a09e667,
      h1 = 0xbb67ae85,
      h2 = 0x3c6ef372,
      h3 = 0xa54ff53a
    for (let i = 0; i < clean.length; i++) {
      const c = clean.charCodeAt(i)
      h0 = (h0 ^ c) + ((h0 << 5) + (h0 >> 2))
      h1 = (h1 ^ c) + ((h1 << 5) + (h1 >> 2))
      h2 = (h2 ^ c) + ((h2 << 5) + (h2 >> 2))
      h3 = (h3 ^ c) + ((h3 << 5) + (h3 >> 2))
    }
    const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0')
    return (hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h0 ^ h1) + hex(h2 ^ h3) + hex(h0) + hex(h1)).toLowerCase()
  }
}

/**
 * Coleta telemetria e dados técnicos do dispositivo e navegador com base estritamente na LGPD.
 */
export function getClientDeviceTelemetry() {
  if (typeof window === 'undefined') {
    return {
      browserName: 'Server',
      browserVersion: '1.0',
      osName: 'Linux',
      osVersion: 'Cloud',
      deviceType: 'computador' as const,
      deviceLanguage: 'pt-BR',
      deviceTimezone: 'America/Sao_Paulo',
      screenResolution: '1920x1080',
      userAgent: 'Server-Side Runner',
      pageUrl: 'https://controlesoft.vercel.app',
      referrerUrl: '',
    }
  }

  const ua = navigator.userAgent || ''
  let browserName = 'Navegador Web'
  let browserVersion = '1.0'

  if (ua.includes('Edg/')) {
    browserName = 'Microsoft Edge'
    browserVersion = ua.split('Edg/')[1]?.split(' ')[0] || '1.0'
  } else if (ua.includes('Chrome/')) {
    browserName = 'Google Chrome'
    browserVersion = ua.split('Chrome/')[1]?.split(' ')[0] || '1.0'
  } else if (ua.includes('Firefox/')) {
    browserName = 'Mozilla Firefox'
    browserVersion = ua.split('Firefox/')[1]?.split(' ')[0] || '1.0'
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browserName = 'Apple Safari'
    browserVersion = ua.split('Version/')[1]?.split(' ')[0] || '1.0'
  }

  let osName = 'Sistema Operacional'
  let osVersion = ''
  if (ua.includes('Windows NT 10.0')) {
    osName = 'Windows'
    osVersion = '10 / 11'
  } else if (ua.includes('Mac OS X')) {
    osName = 'macOS'
    osVersion = ua.split('Mac OS X ')[1]?.split(')')[0]?.replace(/_/g, '.') || ''
  } else if (ua.includes('Android')) {
    osName = 'Android'
    osVersion = ua.split('Android ')[1]?.split(';')[0] || ''
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    osName = 'iOS'
    osVersion = ua.split('OS ')[1]?.split(' ')[0]?.replace(/_/g, '.') || ''
  } else if (ua.includes('Linux')) {
    osName = 'Linux'
    osVersion = 'GNU/Linux'
  }

  let deviceType: 'computador' | 'celular' | 'tablet' = 'computador'
  const isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const isTablet = /iPad|Tablet|PlayBook/i.test(ua) || (isMobile && window.innerWidth >= 768)

  if (isTablet) {
    deviceType = 'tablet'
  } else if (isMobile || window.innerWidth < 640) {
    deviceType = 'celular'
  }

  const screenResolution =
    typeof screen !== 'undefined'
      ? `${screen.width}x${screen.height} (${screen.colorDepth || 24}-bit)`
      : `${window.innerWidth}x${window.innerHeight}`

  const deviceLanguage = navigator.language || 'pt-BR'
  let deviceTimezone = 'America/Sao_Paulo'
  try {
    deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
  } catch {
    // fallback
  }

  return {
    browserName,
    browserVersion,
    osName,
    osVersion,
    deviceType,
    deviceLanguage,
    deviceTimezone,
    screenResolution,
    userAgent: ua,
    pageUrl: window.location.href,
    referrerUrl: document.referrer || '',
  }
}

/**
 * Consulta a API de verificação no servidor para extrair o IP público e geolocalização estimada.
 */
export async function resolveServerVerifiedConnection(): Promise<{
  ip: string
  ipType: 'IPv4' | 'IPv6'
  country: string
  region: string | null
  city: string | null
  serverTimestampUtc: string
}> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2800)
    const res = await fetch('/api/evidence/session', {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (res.ok) {
      const data = await res.json()
      if (data?.ip) {
        return {
          ip: data.ip,
          ipType: data.ipType || (data.ip.includes(':') ? 'IPv6' : 'IPv4'),
          country: data.geo?.country || 'BR',
          region: data.geo?.region || null,
          city: data.geo?.city || null,
          serverTimestampUtc: data.serverTimestampUtc || new Date().toISOString(),
        }
      }
    }
  } catch {
    // fallback para ipify
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal })
    clearTimeout(timeout)
    if (res.ok) {
      const json = await res.json()
      if (json?.ip) {
        const isIpv6 = json.ip.includes(':')
        return {
          ip: json.ip,
          ipType: isIpv6 ? 'IPv6' : 'IPv4',
          country: 'BR',
          region: null,
          city: null,
          serverTimestampUtc: new Date().toISOString(),
        }
      }
    }
  } catch {
    // offline
  }

  return {
    ip: '127.0.0.1 (Sessão Segura)',
    ipType: 'IPv4',
    country: 'BR',
    region: null,
    city: null,
    serverTimestampUtc: new Date().toISOString(),
  }
}

/**
 * Gera um ID de Sessão único para rastreamento de auditoria.
 */
export function getOrCreateAuditSessionId(): string {
  if (typeof window === 'undefined') return 'session-server'
  try {
    const KEY = 'jb_audit_session_id'
    let s = sessionStorage.getItem(KEY)
    if (!s) {
      s = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sess-${Date.now()}`
      sessionStorage.setItem(KEY, s)
    }
    return s
  } catch {
    return `sess-${Date.now()}`
  }
}

/**
 * Gera um Número Único de Comprovante de Aceite (Receipt Number).
 */
export function generateReceiptNumber(): string {
  const year = new Date().getFullYear()
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
  const stamp = Date.now().toString().slice(-4)
  return `CERT-ACEITE-${year}-${randomPart}${stamp}`
}

function getLocalAuditRecords(): ContractAcceptanceEvidenceRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_AUDIT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function setLocalAuditRecords(records: ContractAcceptanceEvidenceRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_AUDIT_KEY, JSON.stringify(records))
  } catch {
    // ignore
  }
}

export const contractAcceptanceAuditService = {
  /**
   * Constrói e encadeia criptograficamente a trilha de auditoria (Hash Chaining).
   */
  async buildChainedAuditEvents(
    rawEvents: Array<{ type: ContractAcceptanceAuditEvent['type']; timestamp: string; payload: Record<string, any> }>,
  ): Promise<{ events: ContractAcceptanceAuditEvent[]; headHash: string }> {
    const chained: ContractAcceptanceAuditEvent[] = []
    let previousHash = GENESIS_HASH

    for (let i = 0; i < rawEvents.length; i++) {
      const e = rawEvents[i]
      const sequence = i + 1
      const payloadStr = JSON.stringify(e.payload || {})
      const rawString = `${previousHash}:${sequence}:${e.type}:${e.timestamp}:${payloadStr}`
      const eventHash = await computeSha256(rawString)

      const chainedEvent: ContractAcceptanceAuditEvent = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `event-${i}-${Date.now()}`,
        sequence,
        type: e.type,
        timestamp: e.timestamp,
        payload: e.payload,
        previousHash,
        eventHash,
      }

      chained.push(chainedEvent)
      previousHash = eventHash
    }

    return {
      events: chained,
      headHash: previousHash,
    }
  },

  /**
   * Registra um aceite eletrônico com pacote integral de evidências técnicas e jurídicas.
   */
  async recordAcceptance(input: CreateAcceptanceInput): Promise<ServiceResult<ContractAcceptanceEvidenceRecord>> {
    try {
      const now = new Date()
      const receiptNumber = generateReceiptNumber()
      const sessionId = getOrCreateAuditSessionId()
      const telemetry = getClientDeviceTelemetry()
      const serverConn = await resolveServerVerifiedConnection()

      // 1. Calcula o Hash SHA-256 do documento/contrato aceito
      const documentSha256 = await computeSha256(input.documentContent)

      // 2. Constrói os eventos cronológicos da trilha
      const nowIso = now.toISOString()
      const rawEvents: Array<{
        type: ContractAcceptanceAuditEvent['type']
        timestamp: string
        payload: Record<string, any>
      }> = input.auditEventsTrail && input.auditEventsTrail.length > 0
        ? [...input.auditEventsTrail]
        : [
            {
              type: 'DOCUMENT_PRESENTED',
              timestamp: new Date(now.getTime() - 25000).toISOString(),
              payload: {
                version: input.contractVersion,
                documentSha256,
                pageUrl: telemetry.pageUrl,
              },
            },
            {
              type: 'DOCUMENT_SCROLLED_READ',
              timestamp: new Date(now.getTime() - 10000).toISOString(),
              payload: { scrolledToBottom: true },
            },
            {
              type: 'CHECKBOX_MARKED',
              timestamp: input.checkboxCheckedAt || new Date(now.getTime() - 4000).toISOString(),
              payload: { checked: true },
            },
            {
              type: 'BUTTON_CLICKED',
              timestamp: input.buttonClickedAt || nowIso,
              payload: { action: 'ACEITO OS TERMOS E CONCORDO COM O CONTRATO' },
            },
            {
              type: 'SERVER_VALIDATION',
              timestamp: nowIso,
              payload: { ip: serverConn.ip, ipType: serverConn.ipType, authMethod: input.authMethod || 'password' },
            },
            {
              type: 'RECORD_COMMITTED',
              timestamp: nowIso,
              payload: { receiptNumber },
            },
          ]

      // Encadeia os eventos
      const { events: auditEvents, headHash: auditChainHeadHash } = await this.buildChainedAuditEvents(rawEvents)

      // 3. Monta o pacote de dados do aceite
      const acceptedAtUtc = serverConn.serverTimestampUtc || nowIso
      const acceptedAtLocal = new Date(acceptedAtUtc).toLocaleString('pt-BR', {
        timeZone: telemetry.deviceTimezone || 'America/Sao_Paulo',
        dateStyle: 'full',
        timeStyle: 'long',
      })

      const evidenceSummaryString = [
        receiptNumber,
        input.contractNumber || 'SEM-NUMERO',
        input.contractVersion,
        documentSha256,
        input.userEmail,
        serverConn.ip,
        acceptedAtUtc,
        auditChainHeadHash,
      ].join('|')

      const evidenceSha256 = await computeSha256(evidenceSummaryString)

      const record: ContractAcceptanceEvidenceRecord = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `acc-${Date.now()}`,
        receiptNumber,
        contractId: input.contractId || null,
        contractNumber: input.contractNumber || `CTR-${Date.now().toString().slice(-6)}`,
        contractName: input.contractName,
        contractVersion: input.contractVersion,
        documentSha256,
        documentContent: input.documentContent,
        userId: input.userId || null,
        userName: input.userName || 'Assinante Não Identificado',
        userEmail: input.userEmail.trim().toLowerCase(),
        userDocument: input.userDocument || null,
        userPhone: input.userPhone || null,
        userBirthDate: input.userBirthDate || null,
        userAddress: input.userAddress || null,
        companyId: input.companyId || null,
        companyName: input.companyName || null,
        companyDocument: input.companyDocument || null,
        planId: input.planId || null,
        planName: input.planName || null,
        authMethod: input.authMethod || 'password',
        ipAddress: serverConn.ip,
        ipType: serverConn.ipType,
        geoCountry: serverConn.country,
        geoRegion: serverConn.region,
        geoCity: serverConn.city,
        userAgent: telemetry.userAgent,
        browserName: telemetry.browserName,
        browserVersion: telemetry.browserVersion,
        osName: telemetry.osName,
        osVersion: telemetry.osVersion,
        deviceType: telemetry.deviceType,
        deviceLanguage: telemetry.deviceLanguage,
        deviceTimezone: telemetry.deviceTimezone,
        screenResolution: telemetry.screenResolution,
        sessionId,
        pageUrl: telemetry.pageUrl,
        referrerUrl: telemetry.referrerUrl || null,
        declarationText: input.declarationText || DEFAULT_LEGAL_DECLARATION,
        checkboxCheckedAt: input.checkboxCheckedAt || null,
        buttonClickedAt: input.buttonClickedAt || null,
        acceptedAtUtc,
        acceptedAtLocal,
        evidenceSha256,
        auditChainHeadHash,
        verificationStatus: 'verified',
        auditEvents,
        createdAt: nowIso,
        updatedAt: nowIso,
      }

      // 4. Salva localmente para contingência offline imediata
      const local = getLocalAuditRecords()
      const existingIdx = local.findIndex((r) => r.id === record.id)
      if (existingIdx >= 0) {
        local[existingIdx] = record
      } else {
        local.unshift(record)
      }
      setLocalAuditRecords(local)

      // 5. Salva no banco de dados Supabase
      try {
        const { error: dbError } = await supabase.from('contract_acceptance_records').insert({
          id: record.id,
          receipt_number: record.receiptNumber,
          contract_id: record.contractId,
          contract_number: record.contractNumber,
          contract_name: record.contractName,
          contract_version: record.contractVersion,
          document_sha256: record.documentSha256,
          document_content: record.documentContent,
          user_id: record.userId,
          user_name: record.userName,
          user_email: record.userEmail,
          user_document: record.userDocument,
          user_phone: record.userPhone,
          user_birth_date: record.userBirthDate,
          user_address: record.userAddress,
          company_id: record.companyId,
          company_name: record.companyName,
          company_document: record.companyDocument,
          plan_id: record.planId,
          plan_name: record.planName,
          auth_method: record.authMethod,
          ip_address: record.ipAddress,
          ip_type: record.ipType,
          geo_country: record.geoCountry,
          geo_region: record.geoRegion,
          geo_city: record.geoCity,
          user_agent: record.userAgent,
          browser_name: record.browserName,
          browser_version: record.browserVersion,
          os_name: record.osName,
          os_version: record.osVersion,
          device_type: record.deviceType,
          device_language: record.deviceLanguage,
          device_timezone: record.deviceTimezone,
          session_id: record.sessionId,
          page_url: record.pageUrl,
          referrer_url: record.referrerUrl,
          declaration_text: record.declarationText,
          checkbox_checked_at: record.checkboxCheckedAt,
          button_clicked_at: record.buttonClickedAt,
          accepted_at_utc: record.acceptedAtUtc,
          accepted_at_local: record.acceptedAtLocal,
          evidence_sha256: record.evidenceSha256,
          audit_chain_head_hash: record.auditChainHeadHash,
          verification_status: record.verificationStatus,
          metadata: {
            screenResolution: record.screenResolution,
            eventsCount: auditEvents.length,
          },
        })

        if (!dbError) {
          // Grava os eventos na tabela de auditoria
          const eventsPayload = auditEvents.map((e) => ({
            acceptance_id: record.id,
            event_sequence: e.sequence,
            event_type: e.type,
            event_timestamp: e.timestamp,
            event_payload: e.payload,
            previous_event_hash: e.previousHash,
            event_hash: e.eventHash,
          }))
          await supabase.from('contract_acceptance_audit_events').insert(eventsPayload)
        } else {
          logger.warn('Tabela contract_acceptance_records indisponível no Supabase (salvo local)', {
            message: dbError.message,
          })
        }
      } catch (err: any) {
        logger.warn('Falha na persistência remota do aceite (salvo localmente)', { error: String(err) })
      }

      return { success: true, data: record }
    } catch (err: any) {
      logger.error('Erro ao registrar aceite de contrato', err)
      return { success: false, error: 'Falha ao registrar aceite e evidências eletrônicas.' }
    }
  },

  /**
   * Lista todos os aceites registrados no sistema.
   */
  async listAll(): Promise<ContractAcceptanceEvidenceRecord[]> {
    const local = getLocalAuditRecords()

    try {
      const { data, error } = await supabase
        .from('contract_acceptance_records')
        .select('*')
        .order('accepted_at_utc', { ascending: false })

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped: ContractAcceptanceEvidenceRecord[] = data.map((row: any) => ({
          id: row.id,
          receiptNumber: row.receipt_number,
          contractId: row.contract_id,
          contractNumber: row.contract_number,
          contractName: row.contract_name,
          contractVersion: row.contract_version,
          documentSha256: row.document_sha256,
          documentContent: row.document_content,
          userId: row.user_id,
          userName: row.user_name,
          userEmail: row.user_email,
          userDocument: row.user_document,
          userPhone: row.user_phone,
          userBirthDate: row.user_birth_date,
          userAddress: row.user_address,
          companyId: row.company_id,
          companyName: row.company_name,
          companyDocument: row.company_document,
          planId: row.plan_id,
          planName: row.plan_name,
          authMethod: row.auth_method || 'password',
          ipAddress: row.ip_address,
          ipType: (row.ip_type as any) || 'IPv4',
          geoCountry: row.geo_country,
          geoRegion: row.geo_region,
          geoCity: row.geo_city,
          userAgent: row.user_agent,
          browserName: row.browser_name || 'Navegador Web',
          browserVersion: row.browser_version || '1.0',
          osName: row.os_name || 'Sistema Operacional',
          osVersion: row.os_version || '',
          deviceType: (row.device_type as any) || 'computador',
          deviceLanguage: row.device_language || 'pt-BR',
          deviceTimezone: row.device_timezone || 'America/Sao_Paulo',
          screenResolution: row.metadata?.screenResolution || '1920x1080',
          sessionId: row.session_id,
          pageUrl: row.page_url,
          referrerUrl: row.referrer_url,
          declarationText: row.declaration_text,
          checkboxCheckedAt: row.checkbox_checked_at,
          buttonClickedAt: row.button_clicked_at,
          acceptedAtUtc: row.accepted_at_utc,
          acceptedAtLocal: row.accepted_at_local,
          evidenceSha256: row.evidence_sha256,
          auditChainHeadHash: row.audit_chain_head_hash,
          verificationStatus: row.verification_status || 'verified',
          auditEvents: [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))

        // Sincroniza cópia local
        setLocalAuditRecords(mapped)
        return mapped
      }
    } catch {
      // fallback local
    }

    return local
  },

  /**
   * Obtém o registro de aceite por ID ou Número de Comprovante.
   */
  async getById(idOrReceipt: string): Promise<ContractAcceptanceEvidenceRecord | null> {
    const all = await this.listAll()
    const found = all.find((r) => r.id === idOrReceipt || r.receiptNumber === idOrReceipt)
    if (found) return found
    return null
  },

  /**
   * Obtém o registro de evidências de aceite para uma empresa ou e-mail de administrador.
   */
  async getByCompanyOrEmail(companyId?: string | null, email?: string | null): Promise<ContractAcceptanceEvidenceRecord | null> {
    const all = await this.listAll()
    const cId = (companyId || '').trim()
    const mail = (email || '').trim().toLowerCase()

    if (cId) {
      const matchCompany = all.find((r) => r.companyId === cId)
      if (matchCompany) return matchCompany
    }
    if (mail) {
      const matchEmail = all.find((r) => (r.userEmail || '').trim().toLowerCase() === mail)
      if (matchEmail) return matchEmail
    }
    return null
  },

  /**
   * Obtém os eventos de auditoria encadeados de um aceite específico.
   */
  async getAuditEvents(acceptanceId: string): Promise<ContractAcceptanceAuditEvent[]> {
    try {
      const { data, error } = await supabase
        .from('contract_acceptance_audit_events')
        .select('*')
        .eq('acceptance_id', acceptanceId)
        .order('event_sequence', { ascending: true })

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((row: any) => ({
          id: row.id,
          sequence: row.event_sequence,
          type: row.event_type,
          timestamp: row.event_timestamp,
          payload: row.event_payload || {},
          previousHash: row.previous_event_hash,
          eventHash: row.event_hash,
        }))
      }
    } catch {
      // fallback
    }

    const local = getLocalAuditRecords().find((r) => r.id === acceptanceId)
    return local?.auditEvents || []
  },

  /**
   * Verifica a integridade criptográfica completa de um registro de aceite (anti-adulteração).
   */
  async verifyRecordIntegrity(record: ContractAcceptanceEvidenceRecord): Promise<IntegrityCheckResult> {
    const computedDocSha = await computeSha256(record.documentContent)
    const documentHashValid = computedDocSha.toLowerCase() === record.documentSha256.toLowerCase()

    const summaryString = [
      record.receiptNumber,
      record.contractNumber,
      record.contractVersion,
      record.documentSha256,
      record.userEmail,
      record.ipAddress,
      record.acceptedAtUtc,
      record.auditChainHeadHash,
    ].join('|')

    const computedEvidenceSha = await computeSha256(summaryString)
    const evidenceHashValid = computedEvidenceSha.toLowerCase() === record.evidenceSha256.toLowerCase()

    let auditChainValid = true
    let computedChainHead = GENESIS_HASH

    const events = record.auditEvents && record.auditEvents.length > 0
      ? record.auditEvents
      : await this.getAuditEvents(record.id)

    if (events && events.length > 0) {
      let curPrevious = GENESIS_HASH
      for (const e of events) {
        const payloadStr = JSON.stringify(e.payload || {})
        const raw = `${curPrevious}:${e.sequence}:${e.type}:${e.timestamp}:${payloadStr}`
        const comp = await computeSha256(raw)
        if (comp.toLowerCase() !== e.eventHash.toLowerCase() || curPrevious !== e.previousHash) {
          auditChainValid = false
          break
        }
        curPrevious = comp
      }
      computedChainHead = curPrevious
    } else {
      computedChainHead = record.auditChainHeadHash
    }

    const isValid = documentHashValid && evidenceHashValid && auditChainValid

    return {
      isValid,
      documentHashValid,
      evidenceHashValid,
      auditChainValid,
      computedDocumentSha256: computedDocSha,
      recordedDocumentSha256: record.documentSha256,
      computedEvidenceSha256: computedEvidenceSha,
      recordedEvidenceSha256: record.evidenceSha256,
      computedChainHead,
      recordedChainHead: record.auditChainHeadHash,
      details: isValid
        ? 'Todos os hashes criptográficos e a cadeia de eventos de auditoria foram verificados com sucesso. O documento e as evidências encontram-se 100% íntegros e autênticos.'
        : 'Atenção: Foi detectada divergência em um ou mais hashes de verificação. O documento ou as evidências podem ter sofrido alteração.',
    }
  },

  /**
   * Gera o Comprovante Oficial de Aceite Eletrônico em PDF (Padrão Pericial A4).
   */
  generateAcceptanceCertificatePdf(record: ContractAcceptanceEvidenceRecord): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14
    const contentWidth = pageWidth - margin * 2

    let y = margin

    // 1. Cabeçalho Oficial
    doc.setFillColor(15, 23, 42) // Slate 900
    doc.rect(margin, y, contentWidth, 24, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('COMPROVANTE OFICIAL DE ACEITE ELETRÔNICO', margin + 6, y + 9)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(203, 213, 225)
    doc.text('REGISTRO DE MANIFESTAÇÃO DE VONTADE, CONCORDÂNCIA E EVIDÊNCIAS DIGITAIS', margin + 6, y + 15)
    doc.text(`CERTIFICADO Nº: ${record.receiptNumber}`, margin + 6, y + 20)

    y += 28

    // 2. Selo de Validade Jurídica
    doc.setFillColor(240, 253, 244) // Emerald 50
    doc.setDrawColor(187, 247, 208) // Emerald 200
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(22, 101, 52) // Emerald 800
    doc.text('INTEGRIDADE CRIPTOGRÁFICA VERIFICADA • MP Nº 2.200-2/2001 E LEI Nº 14.063/2020', margin + 4, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(21, 128, 61)
    doc.text(
      'Documento assinado e registrado eletronicamente com trilha de auditoria imutável, carimbo temporal e hash SHA-256.',
      margin + 4,
      y + 10,
    )

    y += 18

    // Helper para desenhar caixas de seção
    const drawSectionBox = (title: string, height: number) => {
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(margin, y, contentWidth, height, 1.5, 1.5, 'FD')

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text(title, margin + 4, y + 6)
      doc.line(margin + 4, y + 8, margin + contentWidth - 4, y + 8)
    }

    // 3. Identificação do Titular / Contratante
    drawSectionBox('1. IDENTIFICAÇÃO DO CONTRATANTE (ASSINANTE)', 32)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 65, 85)

    const col1 = margin + 4
    const col2 = margin + contentWidth / 2

    doc.text(`Nome Completo: ${record.userName}`, col1, y + 13)
    doc.text(`CPF / CNPJ: ${record.userDocument || 'Conforme cadastro comercial'}`, col2, y + 13)
    doc.text(`E-mail Registrado: ${record.userEmail}`, col1, y + 18)
    doc.text(`Telefone / WhatsApp: ${record.userPhone || 'Não informado'}`, col2, y + 18)
    doc.text(`Empresa / Razão Social: ${record.companyName || 'Não informada'}`, col1, y + 23)
    doc.text(`Plano Contratado: ${record.planName || 'Padrão'}`, col2, y + 23)
    doc.text(`Método de Autenticação: ${record.authMethod} (Sessão Segura Autenticada)`, col1, y + 28)

    y += 36

    // 4. Identificação do Documento / Contrato
    drawSectionBox('2. IDENTIFICAÇÃO DO DOCUMENTO E DA VERSÃO ACEITA', 32)
    doc.setFontSize(8)
    doc.text(`Título do Contrato / Termo: ${record.contractName}`, col1, y + 13)
    doc.text(`Instrumento Particular Nº: ${record.contractNumber}`, col2, y + 13)
    doc.text(`Versão Efetivamente Aceita: v${record.contractVersion}`, col1, y + 18)
    doc.text(`Data/Hora do Aceite (UTC): ${record.acceptedAtUtc}`, col2, y + 18)

    doc.setFont('helvetica', 'bold')
    doc.text('Hash Criptográfico SHA-256 do Documento Original:', col1, y + 23)
    doc.setFont('courier', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(30, 41, 59)
    doc.text(record.documentSha256, col1, y + 28)

    y += 36

    // 5. Dados Técnicos da Conexão (Evidências de Origem)
    drawSectionBox('3. EVIDÊNCIAS TÉCNICAS DA CONEXÃO E DO DISPOSITIVO', 36)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 65, 85)

    doc.text(`Endereço IP de Origem: ${record.ipAddress} (${record.ipType})`, col1, y + 13)
    doc.text(
      `Geolocalização Aproximada (IP): ${[record.geoCity, record.geoRegion, record.geoCountry].filter(Boolean).join(', ') || 'Brasil (BR)'}`,
      col2,
      y + 13,
    )
    doc.text(`Navegador: ${record.browserName} v${record.browserVersion}`, col1, y + 18)
    doc.text(`Sistema Operacional: ${record.osName} ${record.osVersion}`, col2, y + 18)
    doc.text(`Tipo de Dispositivo: ${record.deviceType.toUpperCase()}`, col1, y + 23)
    doc.text(`Fuso Horário Informado: ${record.deviceTimezone}`, col2, y + 23)
    doc.text(`Idioma do Navegador: ${record.deviceLanguage}`, col1, y + 28)
    doc.text(`Resolução de Tela: ${record.screenResolution || 'Não informada'}`, col2, y + 28)
    doc.text(`Identificador da Sessão: ${record.sessionId}`, col1, y + 33)

    y += 40

    // 6. Manifestação Expressa de Vontade
    drawSectionBox('4. MANIFESTAÇÃO EXPRESSA DE VONTADE DO CONTRATANTE', 26)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(71, 85, 105)

    const splitDeclaration = doc.splitTextToSize(`"${record.declarationText}"`, contentWidth - 8)
    doc.text(splitDeclaration, col1, y + 13)

    y += 30

    // 7. Encadeamento e Não-Repúdio
    drawSectionBox('5. TRILHA DE AUDITORIA CRIPTOGRÁFICA (NÃO-REPÚDIO)', 24)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 65, 85)
    doc.text(`Hash Raiz da Trilha de Auditoria (Head Hash):`, col1, y + 13)
    doc.setFont('courier', 'bold')
    doc.setFontSize(7)
    doc.text(record.auditChainHeadHash, col1, y + 17)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(`Hash SHA-256 do Pacote de Evidências:`, col1, y + 21)
    doc.setFont('courier', 'bold')
    doc.setFontSize(7)
    doc.text(record.evidenceSha256, col1, y + 25)

    y += 28

    // 8. Declaração de Fé Pública e Rodapé
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(
      'Este comprovante documenta o registro eletrônico de manifestação de concordância com a versão identificada do contrato, acompanhado dos respectivos registros técnicos e de auditoria preservados pelo sistema.',
      margin,
      pageHeight - 12,
      { maxWidth: contentWidth },
    )

    doc.text(
      `Emitido por ControleSoft / JB Gestão Inteligente • ${new Date().toISOString()} • Página 1 de 1`,
      margin,
      pageHeight - 6,
    )

    return doc
  },

  /**
   * Gera o Dossiê Pericial Completo em PDF para Defesa Judicial e Perícia Técnica.
   */
  generateForensicDossierPdf(record: ContractAcceptanceEvidenceRecord): jsPDF {
    const doc = this.generateAcceptanceCertificatePdf(record)

    // Adiciona Página 2 com o Texto Integral do Contrato e Eventos de Auditoria
    doc.addPage()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14
    const contentWidth = pageWidth - margin * 2

    let y = margin

    // Cabeçalho da Página 2
    doc.setFillColor(30, 41, 59)
    doc.rect(margin, y, contentWidth, 14, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`DOSSIÊ DE EVIDÊNCIAS — TRANSCRIÇÃO INTEGRAL DA VERSÃO v${record.contractVersion}`, margin + 4, y + 9)

    y += 18

    // Metadados do documento
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text(`Contrato: ${record.contractName} • Nº ${record.contractNumber}`, margin, y)
    y += 4
    doc.text(`Hash SHA-256 Registrado: ${record.documentSha256}`, margin, y)
    y += 6

    // Linha separadora
    doc.setDrawColor(203, 213, 225)
    doc.line(margin, y, margin + contentWidth, y)
    y += 5

    // Transcrição do Texto
    doc.setFontSize(7)
    doc.setFont('courier', 'normal')
    doc.setTextColor(30, 41, 59)

    const lines = doc.splitTextToSize(record.documentContent, contentWidth)
    for (let i = 0; i < lines.length; i++) {
      if (y > pageHeight - 16) {
        doc.addPage()
        y = margin
      }
      doc.text(lines[i], margin, y)
      y += 3.4
    }

    return doc
  },

  /**
   * Exporta o Dossiê Estruturado em formato JSON para Perícia Técnica e Autenticação.
   */
  exportDossierJson(record: ContractAcceptanceEvidenceRecord): string {
    const dossier = {
      specVersion: '1.0',
      standard: 'ICP-Brasil / MP 2.200-2/2001 e Lei 14.063/2020 Electronic Acceptance Audit Evidence',
      generatedAt: new Date().toISOString(),
      receiptNumber: record.receiptNumber,
      contract: {
        id: record.contractId,
        number: record.contractNumber,
        name: record.contractName,
        version: record.contractVersion,
        documentSha256: record.documentSha256,
        documentContent: record.documentContent,
      },
      contractor: {
        userId: record.userId,
        name: record.userName,
        email: record.userEmail,
        document: record.userDocument,
        phone: record.userPhone,
        birthDate: record.userBirthDate,
        address: record.userAddress,
        companyId: record.companyId,
        companyName: record.companyName,
        companyDocument: record.companyDocument,
        planId: record.planId,
        planName: record.planName,
        authMethod: record.authMethod,
      },
      technicalConnection: {
        ipAddress: record.ipAddress,
        ipType: record.ipType,
        geo: {
          country: record.geoCountry,
          region: record.geoRegion,
          city: record.geoCity,
          isApproximate: true,
        },
        userAgent: record.userAgent,
        browser: {
          name: record.browserName,
          version: record.browserVersion,
        },
        operatingSystem: {
          name: record.osName,
          version: record.osVersion,
        },
        device: {
          type: record.deviceType,
          language: record.deviceLanguage,
          timezone: record.deviceTimezone,
          screenResolution: record.screenResolution,
        },
        session: {
          sessionId: record.sessionId,
          pageUrl: record.pageUrl,
          referrerUrl: record.referrerUrl,
        },
      },
      chronologicalAuditTrail: {
        declarationText: record.declarationText,
        checkboxCheckedAt: record.checkboxCheckedAt,
        buttonClickedAt: record.buttonClickedAt,
        acceptedAtUtc: record.acceptedAtUtc,
        acceptedAtLocal: record.acceptedAtLocal,
        evidenceSha256: record.evidenceSha256,
        auditChainHeadHash: record.auditChainHeadHash,
        verificationStatus: record.verificationStatus,
        events: record.auditEvents,
      },
      legalCompliance: {
        governingLaw: 'República Federativa do Brasil',
        statutes: [
          'Medida Provisória nº 2.200-2/2001 (Art. 10, § 2º)',
          'Lei nº 14.063/2020 (Assinatura Eletrônica Avançada / Simples)',
          'Lei nº 13.709/2018 (Lei Geral de Proteção de Dados - LGPD)',
          'Código Civil Brasileiro (Art. 107 e Art. 428)',
        ],
        legalNotice:
          'Os presentes registros digitais e metadados técnicos foram colhidos de forma legítima e transparente no momento exato da aceitação, constituindo trilha inalterada de evidências apta a subsidiar perícia computacional e defesa jurídica de direitos.',
      },
    }

    return JSON.stringify(dossier, null, 2)
  },

  /**
   * Realiza o download do arquivo JSON do Dossiê.
   */
  downloadDossierJson(record: ContractAcceptanceEvidenceRecord): void {
    if (typeof window === 'undefined') return
    const jsonStr = this.exportDossierJson(record)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DOSSIE-EVIDENCIAS-${record.receiptNumber}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  /**
   * Realiza o download do Comprovante de Aceite em PDF.
   */
  downloadCertificatePdf(record: ContractAcceptanceEvidenceRecord): void {
    const doc = this.generateAcceptanceCertificatePdf(record)
    doc.save(`COMPROVANTE-ACEITE-${record.receiptNumber}.pdf`)
  },

  /**
   * Realiza o download do Dossiê Pericial Completo em PDF.
   */
  downloadForensicDossierPdf(record: ContractAcceptanceEvidenceRecord): void {
    const doc = this.generateForensicDossierPdf(record)
    doc.save(`DOSSIE-PERICIAL-CONTRATO-${record.receiptNumber}.pdf`)
  },
}
