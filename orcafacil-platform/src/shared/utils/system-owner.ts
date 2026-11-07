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

  if (typeof userOrEmail === 'string') {
    const clean = userOrEmail.trim().toLowerCase()
    return SYSTEM_OWNER_EMAILS.includes(clean)
  }

  const email = userOrEmail.email?.trim().toLowerCase()
  if (email && SYSTEM_OWNER_EMAILS.includes(email)) {
    return true
  }

  if (
    userOrEmail.user_metadata?.is_platform_owner === true ||
    userOrEmail.app_metadata?.is_platform_owner === true
  ) {
    return true
  }

  return false
}
