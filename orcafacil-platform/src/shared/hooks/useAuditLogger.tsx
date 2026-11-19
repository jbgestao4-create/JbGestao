import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { supabase } from '@app/config/supabase'
import { env } from '@app/config/env'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { logger } from '@shared/lib/logger'

export type AuditModulo =
  | 'PDV'
  | 'ESTOQUE'
  | 'FINANCEIRO'
  | 'OS'
  | 'CLIENTES'
  | 'CAIXA'
  | 'VENDAS'
  | 'CONFIGURACOES'
  | 'SISTEMA'

export type AuditAcao = 'CRIACAO' | 'EDICAO' | 'EXCLUSAO' | 'CANCELAMENTO'

export interface AuditLogInput {
  modulo: AuditModulo | string
  acao: AuditAcao | string
  descricao: string
  entidade?: string | null
  entidadeId?: string | null
  dadosAnteriores?: Record<string, unknown> | null
  dadosNovos?: Record<string, unknown> | null
  empresaId?: string | null
  imediato?: boolean
}

export interface AuditLogInsertPayload {
  empresa_id: string
  usuario_id: string | null
  usuario_nome: string
  modulo: string
  acao: string
  descricao: string
  entidade: string | null
  entidade_id: string | null
  dados_anteriores: Record<string, unknown> | null
  dados_novos: Record<string, unknown> | null
}

export interface AuditLogRecord extends AuditLogInsertPayload {
  id: string
  created_at: string
}

export interface AuditDiffResult {
  mudou: boolean
  dadosAnteriores: Record<string, unknown> | null
  dadosNovos: Record<string, unknown> | null
}

const IGNORED_DIFF_KEYS = new Set([
  'updated_at',
  'updatedAt',
  'created_at',
  'createdAt',
])

const SENSITIVE_KEY_PATTERNS = [
  'senha',
  'password',
  'token',
  'secret',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
]

const BATCH_INTERVAL_MS = 30_000
const BATCH_MAX_SIZE = 20

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern))
}

function maskSensitiveValue(key: string, value: unknown): unknown {
  if (value === undefined || value === null) return value
  if (isSensitiveKey(key)) return '***PROTEGIDO***'
  return value
}

function areValuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a === null || a === undefined || b === null || b === undefined) return false
  if (typeof a !== typeof b) return false
  if (typeof a === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b)
    } catch {
      return false
    }
  }
  return false
}

/**
 * Compara dois objetos e retorna apenas os campos que realmente mudaram,
 * ignorando `updated_at`/`created_at` e mascarando campos sensíveis (senha, token, etc.).
 */
export function calcularAlteracoes<T extends Record<string, unknown>>(
  antes: Partial<T> | null | undefined,
  depois: Partial<T> | null | undefined,
): AuditDiffResult {
  const objAntes = (antes ?? {}) as Record<string, unknown>
  const objDepois = (depois ?? {}) as Record<string, unknown>
  const allKeys = new Set([...Object.keys(objAntes), ...Object.keys(objDepois)])

  const dadosAnteriores: Record<string, unknown> = {}
  const dadosNovos: Record<string, unknown> = {}
  let mudou = false

  for (const key of allKeys) {
    if (IGNORED_DIFF_KEYS.has(key)) continue
    const valAntes = objAntes[key]
    const valDepois = objDepois[key]

    if (!areValuesEqual(valAntes, valDepois)) {
      mudou = true
      dadosAnteriores[key] = maskSensitiveValue(key, valAntes ?? null)
      dadosNovos[key] = maskSensitiveValue(key, valDepois ?? null)
    }
  }

  return {
    mudou,
    dadosAnteriores: mudou ? dadosAnteriores : null,
    dadosNovos: mudou ? dadosNovos : null,
  }
}

interface AuditLoggerContextValue {
  registrarLog: (input: AuditLogInput) => Promise<void>
  registrarAlteracao: <T extends Record<string, unknown>>(params: {
    modulo: AuditModulo | string
    acao?: AuditAcao
    descricao: string
    entidade?: string | null
    entidadeId?: string | null
    antes?: Partial<T> | null
    depois?: Partial<T> | null
  }) => Promise<void>
  flushLogs: () => Promise<void>
}

const AuditLoggerContext = createContext<AuditLoggerContextValue | null>(null)

const CRITICAL_ACTIONS = new Set<string>(['CRIACAO', 'EDICAO', 'EXCLUSAO', 'CANCELAMENTO'])

export function AuditLoggerProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const { currentOrganization } = useOrganization()
  const queueRef = useRef<AuditLogInsertPayload[]>([])
  const isFlushingRef = useRef(false)
  const accessTokenRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        accessTokenRef.current = data.session?.access_token ?? null
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      accessTokenRef.current = session?.access_token ?? null
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const flushLogs = useCallback(async () => {
    if (isFlushingRef.current || queueRef.current.length === 0) return
    isFlushingRef.current = true
    const rawBatch = queueRef.current.splice(0, queueRef.current.length)

    // Consolida múltiplos cliques do mesmo usuário/empresa/módulo em 1 único registro resumido
    const grouped = new Map<string, { payload: AuditLogInsertPayload; actions: string[]; count: number }>()
    for (const item of rawBatch) {
      const key = `${item.empresa_id}:${item.usuario_id || 'anon'}:${item.modulo}:${item.acao}`
      const existing = grouped.get(key)
      if (!existing) {
        grouped.set(key, {
          payload: { ...item },
          actions: [item.descricao],
          count: 1,
        })
      } else {
        existing.count += 1
        if (!existing.actions.includes(item.descricao)) {
          existing.actions.push(item.descricao)
        }
      }
    }

    const consolidatedBatch: AuditLogInsertPayload[] = Array.from(grouped.values()).map((entry) => {
      if (entry.count === 1) return entry.payload
      const summary = entry.actions.slice(0, 5).join(' • ')
      const extra = entry.actions.length > 5 ? ` (+${entry.actions.length - 5})` : ''
      return {
        ...entry.payload,
        descricao: `${summary}${extra} (${entry.count} ações)`,
      }
    })

    try {
      const { error } = await supabase.from('audit_logs').insert(consolidatedBatch)
      if (error) {
        logger.warn('Falha ao gravar lote de audit_logs', { message: error.message })
      }
    } catch (err) {
      logger.warn('Erro inesperado no flush de audit_logs', { err })
    } finally {
      isFlushingRef.current = false
    }
  }, [])

  const flushOnUnload = useCallback(() => {
    if (queueRef.current.length === 0) return
    const batch = queueRef.current.splice(0, queueRef.current.length)
    const token = accessTokenRef.current
    if (!token || !env.supabase.url || !env.supabase.anonKey) return

    try {
      void fetch(`${env.supabase.url}/rest/v1/audit_logs`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          apikey: env.supabase.anonKey,
          Authorization: `Bearer ${token}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(batch),
      })
    } catch {
      // ignore unload network errors
    }
  }, [])

  const buildPayload = useCallback(
    (input: AuditLogInput): AuditLogInsertPayload | null => {
      const empresaId = input.empresaId || currentOrganization?.id
      if (!empresaId || !user?.id) return null

      const usuarioNome =
        profile?.displayName?.trim() ||
        (user.user_metadata?.full_name as string | undefined)?.trim() ||
        user.email ||
        'Usuário'

      return {
        empresa_id: empresaId,
        usuario_id: user.id,
        usuario_nome: usuarioNome,
        modulo: String(input.modulo || 'SISTEMA').toUpperCase(),
        acao: String(input.acao || 'EDICAO').toUpperCase(),
        descricao: input.descricao.trim(),
        entidade: input.entidade ?? null,
        entidade_id: input.entidadeId ?? null,
        dados_anteriores: input.dadosAnteriores ?? null,
        dados_novos: input.dadosNovos ?? null,
      }
    },
    [currentOrganization?.id, profile?.displayName, user],
  )

  const registrarLog = useCallback(
    async (input: AuditLogInput) => {
      const payload = buildPayload(input)
      if (!payload || payload.acao === 'CLIQUE') return

      const isImmediate =
        Boolean(input.imediato) || CRITICAL_ACTIONS.has(payload.acao.toUpperCase())

      if (isImmediate) {
        try {
          const { error } = await supabase.from('audit_logs').insert(payload)
          if (error) {
            logger.warn('Falha ao gravar audit_log imediato', { message: error.message })
          }
        } catch (err) {
          logger.warn('Erro ao gravar audit_log imediato', { err })
        }
        return
      }

      queueRef.current.push(payload)
      if (queueRef.current.length >= BATCH_MAX_SIZE) {
        await flushLogs()
      }
    },
    [buildPayload, flushLogs],
  )

  const registrarAlteracao = useCallback(
    async <T extends Record<string, unknown>>(params: {
      modulo: AuditModulo | string
      acao?: 'EDICAO' | 'CRIACAO' | 'EXCLUSAO' | 'CANCELAMENTO'
      descricao: string
      entidade?: string | null
      entidadeId?: string | null
      antes?: Partial<T> | null
      depois?: Partial<T> | null
    }) => {
      const acao = params.acao ?? 'EDICAO'
      const diff =
        acao === 'EDICAO'
          ? calcularAlteracoes(params.antes, params.depois)
          : {
              mudou: true,
              dadosAnteriores: params.antes
                ? calcularAlteracoes(params.antes, {}).dadosAnteriores
                : null,
              dadosNovos: params.depois
                ? calcularAlteracoes({}, params.depois).dadosNovos
                : null,
            }

      if (acao === 'EDICAO' && !diff.mudou) return

      await registrarLog({
        modulo: params.modulo,
        acao,
        descricao: params.descricao,
        entidade: params.entidade ?? null,
        entidadeId: params.entidadeId ?? null,
        dadosAnteriores: diff.dadosAnteriores,
        dadosNovos: diff.dadosNovos,
        imediato: true,
      })
    },
    [registrarLog],
  )

  // Intervalo de envio em lote a cada 10s + flush no beforeunload/visibilitychange
  useEffect(() => {
    const timer = window.setInterval(() => {
      void flushLogs()
    }, BATCH_INTERVAL_MS)

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushOnUnload()
      }
    }

    window.addEventListener('beforeunload', flushOnUnload)
    window.addEventListener('pagehide', flushOnUnload)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('beforeunload', flushOnUnload)
      window.removeEventListener('pagehide', flushOnUnload)
      document.removeEventListener('visibilitychange', handleVisibility)
      void flushLogs()
    }
  }, [flushLogs, flushOnUnload])

  return (
    <AuditLoggerContext.Provider
      value={{ registrarLog, registrarAlteracao, flushLogs }}
    >
      {children}
    </AuditLoggerContext.Provider>
  )
}

export function useAuditLogger(): AuditLoggerContextValue {
  const ctx = useContext(AuditLoggerContext)
  if (!ctx) {
    return {
      registrarLog: async () => undefined,
      registrarAlteracao: async () => undefined,
      flushLogs: async () => undefined,
    }
  }
  return ctx
}
