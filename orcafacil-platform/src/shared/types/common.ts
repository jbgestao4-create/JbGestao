/**
 * Tipos de domínio compartilhados entre módulos.
 * Estes tipos representam contratos públicos — evite detalhes de implementação aqui.
 */

/** Identificador único (UUID) */
export type UUID = string

/** Papel do usuário dentro de uma organização */
export type OrganizationRole = 'owner' | 'admin' | 'member'

/** Tipo de pessoa de um cliente cadastrado */
export type CustomerType = 'individual' | 'company'

/** Código único e estável de um módulo da plataforma */
export type ModuleCode = 'orcafacil' | 'agendapro' | 'estoqueleve'

/** Cartões da página inicial que podem ser liberados individualmente para operadores */
export type DashboardModuleCode =
  'MOD-01' | 'MOD-02' | 'MOD-03' | 'MOD-04' | 'MOD-05' | 'MOD-06' | 'MOD-07'

/** Perfil do usuário autenticado */
export interface UserProfile {
  id: UUID
  displayName: string | null
  avatarUrl: string | null
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
  jobTitle: string | null
  modules: ModuleCode[]
  dashboardModules: DashboardModuleCode[]
  createdAt: string
}

export interface Supplier {
  id: UUID
  organizationId: UUID
  name: string
  document: string | null
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** Resultado genérico de uma operação de serviço */
export type ServiceResult<T> =
  { success: true; data: T } | { success: false; error: string; code?: string }
