/**
 * Tipos de domínio compartilhados entre módulos.
 * Estes tipos representam contratos públicos — evite detalhes de implementação aqui.
 */

/** Identificador único (UUID) */
export type UUID = string

/** Papel do usuário dentro de uma organização */
export type OrganizationRole = 'owner' | 'admin' | 'member'

/** Código único e estável de um módulo da plataforma */
export type ModuleCode = 'orcafacil' | 'agendapro' | 'estoqueleve'

/** Perfil do usuário autenticado */
export interface UserProfile {
  id: UUID
  displayName: string | null
  email: string
  createdAt: string
}

/** Organização da qual o usuário é membro */
export interface Organization {
  id: UUID
  name: string
  slug: string
  createdAt: string
}

/** Associação do usuário a uma organização */
export interface OrganizationMembership {
  organizationId: UUID
  userId: UUID
  role: OrganizationRole
}

/** Detalhes completos do membro da organização para gestão de equipe */
export interface OrganizationMemberDetail {
  userId: UUID
  organizationId: UUID
  role: OrganizationRole
  displayName: string
  email: string
  modules: ModuleCode[]
  createdAt: string
}

/** Resultado genérico de uma operação de serviço */
export type ServiceResult<T> =
  { success: true; data: T } | { success: false; error: string; code?: string }
