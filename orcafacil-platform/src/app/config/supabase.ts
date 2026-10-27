import { createClient } from '@supabase/supabase-js'
import { env } from '@app/config/env'

/**
 * Cliente Supabase singleton compartilhado por toda a aplicação.
 *
 * Utiliza a chave anônima (anon key) — segura para o frontend quando
 * as políticas de Row Level Security estão corretamente configuradas.
 * Nunca utilize a service_role key no cliente frontend.
 */
export const supabase = createClient(env.supabase.url, env.supabase.anonKey, {
  auth: {
    // Persiste a sessão no localStorage (padrão do Supabase)
    persistSession: true,
    // Detecta automaticamente o token de confirmação na URL (e-mail, recuperação)
    detectSessionInUrl: true,
    // Atualiza o token automaticamente antes de expirar
    autoRefreshToken: true,
  },
})
