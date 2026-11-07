/**
 * Validação e acesso às variáveis de ambiente da aplicação.
 */

const REQUIRED_ENV_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const

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

/**
 * Valida a presença das variáveis de ambiente obrigatórias.
 */
export function checkEnvironment(): EnvironmentValidationResult {
  const missing = REQUIRED_ENV_VARS.filter(
    (key) => !import.meta.env[key] || import.meta.env[key].trim() === '',
  ).map((key) => key as string)

  const configuredUrl = import.meta.env['VITE_SUPABASE_URL'].trim()
  if (configuredUrl) {
    try {
      const url = new URL(normalizeSupabaseUrl(configuredUrl))
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

const rawUrl = import.meta.env['VITE_SUPABASE_URL'].trim()
const rawKey = import.meta.env['VITE_SUPABASE_ANON_KEY'].trim()

/** Configurações do Supabase remoto; a aplicação não usa endpoints locais ou valores fictícios. */
export const env = {
  supabase: {
    url: rawUrl ? normalizeSupabaseUrl(rawUrl) : '',
    anonKey: rawKey,
  },
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const
