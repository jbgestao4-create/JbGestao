import type { ReactNode } from 'react'
import type { ModuleCode } from './database'
import type { OrganizationRole } from './common'

/**
 * Contrato formal para registro estático de módulos na OrçaFácil Platform.
 * Garante que novos módulos (ex: AgendaPro, EstoqueLeve) possam ser adicionados
 * de maneira desacoplada, extensível e com verificação de tipo em tempo de compilação.
 */
export interface PlatformModuleDescriptor {
  /** Código único e estável do módulo */
  code: ModuleCode

  /** Nome amigável exibido na interface */
  name: string

  /** Descrição sucinta do propósito do módulo */
  description: string

  /** Prefixo base de rota (ex: '/orcafacil') */
  baseRoute: string

  /** Se o módulo já está funcionalmente disponível para contratação */
  isAvailable: boolean

  /** Papel mínimo na organização para acessar o módulo */
  requiredRole?: OrganizationRole

  /** Itens de navegação que o módulo adiciona à barra lateral */
  navigationItems: {
    label: string
    path: string
    iconName: string
    badge?: string
  }[]

  /** Componente de entrada do módulo */
  entryComponent?: () => ReactNode
}

