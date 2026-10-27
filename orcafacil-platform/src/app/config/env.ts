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
  )

  return {
    isValid: missing.length === 0,
    missing,
  }
}

const rawUrl = (import.meta.env['VITE_SUPABASE_URL'] as string) || ''
const rawKey = (import.meta.env['VITE_SUPABASE_ANON_KEY'] as string) || ''

/** Configurações de ambiente validadas e tipadas com fallback seguro para não quebrar a inicialização */
export const env = {
  supabase: {
    url: rawUrl ? normalizeSupabaseUrl(rawUrl) : 'https://placeholder.supabase.co',
    anonKey: rawKey || 'placeholder-anon-key',
  },
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const
