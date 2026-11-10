/**
 * Validação e acesso às variáveis de ambiente da aplicação.
 */

export interface EnvironmentValidationResult {
  isValid: boolean
  missing: string[]
}

/**
 * Remove barras finais ou prefixos acidentais (/rest/v1) da URL do Supabase.
 */
function normalizeSupabaseUrl(rawUrl: string): string {
  let cleaned = rawUrl.trim().replace(/\/+$/, '')
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, '')
  cleaned = cleaned.replace(/\/auth\/v1\/?$/, '')
  return cleaned
}

const rawUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

/**
 * Valida a presença das variáveis de ambiente obrigatórias sem acesso dinâmico
 * a import.meta.env[key], evitando que o bundler serialize todo o objeto import.meta.env.
 */
export function checkEnvironment(): EnvironmentValidationResult {
  const missing: string[] = []

  if (!rawUrl) {
    missing.push('VITE_SUPABASE_URL')
  }
  if (!rawKey) {
    missing.push('VITE_SUPABASE_ANON_KEY')
  }

  if (rawUrl) {
    try {
      const url = new URL(normalizeSupabaseUrl(rawUrl))
      if (
        url.protocol !== 'https:' ||
        !/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)
      ) {
        missing.push('VITE_SUPABASE_URL (deve apontar para um projeto Supabase online)')
      }
    } catch {
      missing.push('VITE_SUPABASE_URL (URL inválida)')
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
  }
}

/** Configurações do Supabase remoto; a aplicação não usa endpoints locais ou valores fictícios. */
export const env = {
  supabase: {
    url: rawUrl ? normalizeSupabaseUrl(rawUrl) : '',
    anonKey: rawKey,
  },
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const
