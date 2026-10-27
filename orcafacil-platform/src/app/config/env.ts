/**
 * Validação e acesso às variáveis de ambiente da aplicação.
 */

const REQUIRED_ENV_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const

export interface EnvironmentValidationResult {
  isValid: boolean
  missing: string[]
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

/** Configurações de ambiente validadas e tipadas com fallback seguro para não quebrar a inicialização */
export const env = {
  supabase: {
    url: (import.meta.env['VITE_SUPABASE_URL'] as string) || 'https://placeholder.supabase.co',
    anonKey: (import.meta.env['VITE_SUPABASE_ANON_KEY'] as string) || 'placeholder-anon-key',
  },
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const
