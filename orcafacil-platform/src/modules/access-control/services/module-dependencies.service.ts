import type { DashboardModuleCode } from '@shared/types/database'

export interface ModuleDependencyRequirement {
  code: DashboardModuleCode
  name: string
  reason: string
  strict: boolean // true = estritamente obrigatório; false = recomendação operacional
}

export interface ModuleDependencyRule {
  targetModule: DashboardModuleCode
  targetName: string
  requires: ModuleDependencyRequirement[]
}

/**
 * Regras centralizadas de dependências operacionais entre módulos da plataforma.
 */
export const MODULE_DEPENDENCY_RULES: ModuleDependencyRule[] = [
  {
    targetModule: 'MOD-01',
    targetName: 'Vendas',
    requires: [
      {
        code: 'MOD-02',
        name: 'Estoque',
        reason: 'O módulo Vendas necessita de Estoque para consultar o saldo dos produtos e registrar a baixa automática de mercadorias vendidas.',
        strict: true,
      },
      {
        code: 'MOD-05',
        name: 'Gerenciamento do Caixa',
        reason: 'O módulo Vendas necessita de Gerenciamento do Caixa para abertura de turnos, liquidação financeira e faturamento no balcão/PDV.',
        strict: true,
      },
      {
        code: 'MOD-03',
        name: 'Clientes',
        reason: 'Recomendado para identificação de clientes nas vendas e notas fiscais.',
        strict: false,
      },
    ],
  },
  {
    targetModule: 'MOD-04',
    targetName: 'Orçamentos',
    requires: [
      {
        code: 'MOD-03',
        name: 'Clientes',
        reason: 'O módulo Orçamentos necessita do cadastro de Clientes para emissão, envio e titularidade das propostas comerciais.',
        strict: true,
      },
      {
        code: 'MOD-02',
        name: 'Estoque',
        reason: 'Recomendado para inclusão de materiais e produtos cadastrados no orçamento.',
        strict: false,
      },
    ],
  },
  {
    targetModule: 'MOD-10',
    targetName: 'Ordem de Serviço (O.S.)',
    requires: [
      {
        code: 'MOD-03',
        name: 'Clientes',
        reason: 'O módulo Ordem de Serviço necessita de Clientes para vincular o proprietário do aparelho ou equipamento em manutenção.',
        strict: true,
      },
      {
        code: 'MOD-09',
        name: 'Serviços',
        reason: 'O módulo Ordem de Serviço necessita do catálogo de Serviços para definição das tarefas técnicas e mão de obra executada.',
        strict: true,
      },
      {
        code: 'MOD-02',
        name: 'Estoque',
        reason: 'Recomendado para inclusão de peças de reposição na Ordem de Serviço.',
        strict: false,
      },
      {
        code: 'MOD-01',
        name: 'Vendas',
        reason: 'Recomendado para permitir o fechamento da O.S. com faturamento direto na Frente de Caixa.',
        strict: false,
      },
    ],
  },
  {
    targetModule: 'MOD-08',
    targetName: 'Relatórios',
    requires: [
      {
        code: 'MOD-01',
        name: 'Vendas',
        reason: 'O módulo de Relatórios consolida faturamento de Vendas, movimentações de Estoque e fechamentos de Caixa.',
        strict: false,
      },
    ],
  },
]

export interface DependencyValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  missingDependencies: Array<{
    targetModule: DashboardModuleCode
    targetName: string
    requiredModule: DashboardModuleCode
    requiredName: string
    reason: string
    strict: boolean
  }>
}

/**
 * Valida a integridade das dependências entre os módulos selecionados.
 */
export function validateModuleDependencies(
  selectedModules: DashboardModuleCode[],
  availableInOrg?: DashboardModuleCode[],
): DependencyValidationResult {
  const selectedSet = new Set(selectedModules)
  const availableSet = availableInOrg ? new Set(availableInOrg) : null
  const errors: string[] = []
  const warnings: string[] = []
  const missingDependencies: DependencyValidationResult['missingDependencies'] = []

  for (const rule of MODULE_DEPENDENCY_RULES) {
    if (!selectedSet.has(rule.targetModule)) continue

    for (const req of rule.requires) {
      // Se o módulo requerido não está na organização, ignoramos para evitar falso positivo do plano
      if (availableSet && !availableSet.has(req.code)) {
        continue
      }

      if (!selectedSet.has(req.code)) {
        missingDependencies.push({
          targetModule: rule.targetModule,
          targetName: rule.targetName,
          requiredModule: req.code,
          requiredName: req.name,
          reason: req.reason,
          strict: req.strict,
        })

        if (req.strict) {
          errors.push(
            `O módulo ${rule.targetName} (${rule.targetModule}) depende de ${req.name} (${req.code}). Motivo: ${req.reason}`,
          )
        } else {
          warnings.push(
            `Recomendação: Para melhor funcionamento de ${rule.targetName} (${rule.targetModule}), habilite também ${req.name} (${req.code}).`,
          )
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    missingDependencies,
  }
}

/**
 * Ao marcar um módulo, identifica dependências estritas que devem ser ativadas automaticamente.
 */
export function resolveDependenciesOnSelect(
  moduleToSelect: DashboardModuleCode,
  currentlySelected: DashboardModuleCode[],
  availableInOrg?: DashboardModuleCode[],
): {
  autoAddedModules: DashboardModuleCode[]
  message: string | null
} {
  const rule = MODULE_DEPENDENCY_RULES.find((r) => r.targetModule === moduleToSelect)
  if (!rule) {
    return { autoAddedModules: [], message: null }
  }

  const selectedSet = new Set(currentlySelected)
  const availableSet = availableInOrg ? new Set(availableInOrg) : null
  const toAdd: DashboardModuleCode[] = []
  const addedNames: string[] = []

  for (const req of rule.requires) {
    if (!req.strict) continue
    if (selectedSet.has(req.code)) continue
    // Só adiciona se o módulo estiver disponível para a empresa
    if (availableSet && !availableSet.has(req.code)) continue

    toAdd.push(req.code)
    addedNames.push(`${req.name} (${req.code})`)
  }

  if (toAdd.length === 0) {
    return { autoAddedModules: [], message: null }
  }

  const message = `Ao selecionar ${rule.targetName} (${rule.targetModule}), o sistema ativou automaticamente: ${addedNames.join(', ')} por dependência operacional.`
  return { autoAddedModules: toAdd, message }
}

/**
 * Ao desmarcar um módulo, identifica se outros módulos selecionados dependem dele.
 */
export function checkDependenciesOnDeselect(
  moduleToDeselect: DashboardModuleCode,
  currentlySelected: DashboardModuleCode[],
): {
  hasDependents: boolean
  dependents: Array<{ code: DashboardModuleCode; name: string }>
  warningMessage: string | null
} {
  const dependentList: Array<{ code: DashboardModuleCode; name: string }> = []

  for (const rule of MODULE_DEPENDENCY_RULES) {
    if (!currentlySelected.includes(rule.targetModule)) continue
    const depends = rule.requires.some((r) => r.code === moduleToDeselect && r.strict)
    if (depends) {
      dependentList.push({ code: rule.targetModule, name: rule.targetName })
    }
  }

  if (dependentList.length === 0) {
    return { hasDependents: false, dependents: [], warningMessage: null }
  }

  const names = dependentList.map((d) => `${d.name} (${d.code})`).join(', ')
  const warningMessage = `Atenção: Os módulos ${names} dependem deste recurso para operar corretamente.`

  return {
    hasDependents: true,
    dependents: dependentList,
    warningMessage,
  }
}
