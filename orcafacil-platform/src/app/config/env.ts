/**
 * Validação e acesso às variáveis de ambiente da aplicação.
 *
 * Apenas variáveis VITE_* são seguras para o frontend — são incorporadas
 * no bundle em tempo de build. Nunca coloque segredos aqui.
 */

/** Variáveis obrigatórias para o funcionamento da aplicação */
const REQUIRED_ENV_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const

/**
 * Valida a presença das variáveis de ambiente obrigatórias.
 * Deve ser chamada antes de montar a aplicação React.
 * Lança erro descritivo sem revelar os valores das variáveis.
 */
export function validateEnvironment(): void {
  const missing = REQUIRED_ENV_VARS.filter(
    (key) => !import.meta.env[key] || import.meta.env[key] === '',
  )

  if (missing.length > 0) {
    throw new Error(
      `Configuração incompleta. As seguintes variáveis de ambiente estão ausentes: ${missing.join(', ')}.\n` +
        'Copie o arquivo .env.example para .env.local e preencha os valores do seu projeto Supabase.',
    )
  }
}

/** Configurações de ambiente validadas e tipadas */
export const env = {
  supabase: {
    url: import.meta.env['VITE_SUPABASE_URL'] as string,
    anonKey: import.meta.env['VITE_SUPABASE_ANON_KEY'] as string,
  },
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const
