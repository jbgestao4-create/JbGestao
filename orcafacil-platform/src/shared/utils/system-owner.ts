/**
 * Utilitário central para validação estrita do Proprietário do Sistema (Superadmin).
 * 
 * Regra do Sistema:
 * - O Módulo de Gerenciamento de Empresas Cadastradas (/admin/companies)
 *   pertence EXCLUSIVAMENTE ao Proprietário do Sistema (sem exceção).
 * - Usuários de empresas clientes (mesmo administradores da empresa) não são proprietários do sistema
 *   e nunca podem visualizar nem acessar o módulo de empresas.
 * - Isenção de bloqueios por desativação de empresa ou expiração de período de teste
 *   aplica-se unicamente ao Proprietário do Sistema.
 */

export const SYSTEM_OWNER_EMAILS = [
  'adm@adm.com',
  'admin@adm.com',
  'proprietario@jbsoftware.com.br',
  'owner@jbsoftware.com.br',
  'bryan@administrador.com',
  'bryanmendes968@gmail.com',
]

export const SYSTEM_OWNER_TEST_ORGANIZATION_SLUG = 'ambiente-testes-proprietario'

const DYNAMIC_OWNER_EMAILS_KEY = 'jb_system_owner_custom_emails'

function getStoredOwnerEmails(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(DYNAMIC_OWNER_EMAILS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((e: string) => String(e).trim().toLowerCase()) : []
  } catch {
    return []
  }
}

/**
 * Registra dinamicamente um novo e-mail de proprietário caso o adm@adm.com ou superadmin
 * altere seu endereço para um e-mail personalizado.
 */
export function registerSystemOwnerEmail(email?: string | null): void {
  if (!email || typeof window === 'undefined') return
  const clean = email.trim().toLowerCase()
  if (!clean || SYSTEM_OWNER_EMAILS.includes(clean)) return
  try {
    const current = getStoredOwnerEmails()
    if (!current.includes(clean)) {
      current.push(clean)
      localStorage.setItem(DYNAMIC_OWNER_EMAILS_KEY, JSON.stringify(current))
    }
  } catch {
    // ignore
  }
}

export function isSystemOwner(
  userOrEmail?:
    | {
        email?: string | null
        user_metadata?: Record<string, any>
        app_metadata?: Record<string, any>
      }
    | string
    | null,
): boolean {
  if (!userOrEmail) return false

  const storedEmails = getStoredOwnerEmails()

  if (typeof userOrEmail === 'string') {
    const clean = userOrEmail.trim().toLowerCase()
    return SYSTEM_OWNER_EMAILS.includes(clean) || storedEmails.includes(clean)
  }

  const email = userOrEmail.email?.trim().toLowerCase()
  if (email && (SYSTEM_OWNER_EMAILS.includes(email) || storedEmails.includes(email))) {
    return true
  }

  if (
    userOrEmail.user_metadata?.is_platform_owner === true ||
    userOrEmail.app_metadata?.is_platform_owner === true
  ) {
    if (email) {
      registerSystemOwnerEmail(email)
    }
    return true
  }

  return false
}
