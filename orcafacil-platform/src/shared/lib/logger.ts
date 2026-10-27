/**
 * Utilitário de logging seguro para a aplicação.
 *
 * Centraliza o controle de logs para:
 * - Evitar exposição de dados sensíveis em produção
 * - Permitir futura integração com serviços externos (ex: Sentry)
 * - Manter consistência de formato
 *
 * IMPORTANTE: Nunca registre senhas, tokens, chaves ou dados pessoais.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  timestamp: string
}

function createEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
): LogEntry {
  return {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
  }
}

function shouldLog(level: LogLevel): boolean {
  // Em produção, suprime logs de debug
  if (import.meta.env.PROD && level === 'debug') return false
  return true
}

function output(entry: LogEntry): void {
  if (!shouldLog(entry.level)) return

  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`

  switch (entry.level) {
    case 'debug':
      console.debug(prefix, entry.message, entry.context ?? '')
      break
    case 'info':
      console.info(prefix, entry.message, entry.context ?? '')
      break
    case 'warn':
      console.warn(prefix, entry.message, entry.context ?? '')
      break
    case 'error':
      console.error(prefix, entry.message, entry.context ?? '')
      break
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    output(createEntry('debug', message, context)),

  info: (message: string, context?: Record<string, unknown>) =>
    output(createEntry('info', message, context)),

  warn: (message: string, context?: Record<string, unknown>) =>
    output(createEntry('warn', message, context)),

  /**
   * Registra um erro. Remove detalhes de stack trace em produção
   * para evitar exposição de informações internas.
   */
  error: (message: string, error?: unknown, context?: Record<string, unknown>) => {
    const errorContext: Record<string, unknown> = { ...context }

    if (error instanceof Error) {
      errorContext['errorMessage'] = error.message
      // Stack trace apenas em desenvolvimento
      if (import.meta.env.DEV) {
        errorContext['stack'] = error.stack
      }
    }

    output(createEntry('error', message, errorContext))
  },
}
