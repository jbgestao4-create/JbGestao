import { useMemo } from 'react'
import { Layers } from 'lucide-react'
import {
  ALL_PLATFORM_DASHBOARD_MODULES,
  type DashboardSubFeature,
  type PlatformDashboardModule,
} from '../services/company-management.service'
import type { DashboardModuleCode } from '@shared/types/common'

export interface CompanyModulesSelectorProps {
  selectedCodes: DashboardModuleCode[]
  onChange: (codes: DashboardModuleCode[]) => void
  disabled?: boolean
  availableModules?: PlatformDashboardModule[]
  title?: string
  description?: string
}

export function CompanyModulesSelector({
  selectedCodes,
  onChange,
  disabled = false,
  availableModules = ALL_PLATFORM_DASHBOARD_MODULES,
  title = 'Plano de Acesso',
  description = 'Defina quais módulos e quais opções internas aparecerão habilitadas para a empresa.',
}: CompanyModulesSelectorProps) {
  const currentSet = useMemo(() => new Set<string>(selectedCodes), [selectedCodes])

  // Conta módulos principais selecionados
  const selectedModulesCount = useMemo(() => {
    return availableModules.filter((mod) => currentSet.has(mod.code)).length
  }, [availableModules, currentSet])

  // Conta sub-recursos selecionados
  const totalSubFeaturesCount = useMemo(() => {
    return availableModules.reduce((acc, mod) => acc + mod.subFeatures.length, 0)
  }, [availableModules])

  const selectedSubFeaturesCount = useMemo(() => {
    return availableModules.reduce((acc, mod) => {
      const activeInMod = mod.subFeatures.filter((sub) => currentSet.has(sub.code)).length
      return acc + activeInMod
    }, 0)
  }, [availableModules, currentSet])

  // Alterna o módulo pai (ao marcar, marca todos os seus sub-recursos; ao desmarcar, remove todos)
  const handleToggleModule = (mod: PlatformDashboardModule) => {
    if (disabled) return
    const next = new Set<string>(currentSet)
    const isCurrentlyChecked = next.has(mod.code)

    if (isCurrentlyChecked) {
      // Desmarca o módulo pai e todos os seus sub-recursos
      next.delete(mod.code)
      for (const sub of mod.subFeatures) {
        next.delete(sub.code)
      }
    } else {
      // Marca o módulo pai e todos os seus sub-recursos
      next.add(mod.code)
      for (const sub of mod.subFeatures) {
        next.add(sub.code)
      }
    }

    onChange(Array.from(next) as DashboardModuleCode[])
  }

  // Alterna um sub-recurso específico
  const handleToggleSubFeature = (mod: PlatformDashboardModule, sub: DashboardSubFeature) => {
    if (disabled) return
    const next = new Set<string>(currentSet)
    const isSubChecked = next.has(sub.code)

    if (isSubChecked) {
      next.delete(sub.code)
    } else {
      next.add(sub.code)
      // Se marcou o sub-recurso, garante que o módulo pai também está marcado
      next.add(mod.code)
    }

    onChange(Array.from(next) as DashboardModuleCode[])
  }

  // Marca todos os sub-recursos de um módulo específico
  const handleSelectAllSubFeaturesOfMod = (mod: PlatformDashboardModule) => {
    if (disabled) return
    const next = new Set<string>(currentSet)
    next.add(mod.code)
    for (const sub of mod.subFeatures) {
      next.add(sub.code)
    }
    onChange(Array.from(next) as DashboardModuleCode[])
  }

  // Desmarca todos os sub-recursos de um módulo específico
  const handleDeselectAllSubFeaturesOfMod = (mod: PlatformDashboardModule) => {
    if (disabled) return
    const next = new Set<string>(currentSet)
    for (const sub of mod.subFeatures) {
      next.delete(sub.code)
    }
    onChange(Array.from(next) as DashboardModuleCode[])
  }

  // Marca todas as páginas e sub-recursos da plataforma
  const handleSelectAll = () => {
    if (disabled) return
    const allCodes = availableModules.flatMap((mod) => [
      mod.code,
      ...mod.subFeatures.map((s) => s.code),
    ])
    onChange(allCodes as DashboardModuleCode[])
  }

  // Desmarca tudo
  const handleDeselectAll = () => {
    if (disabled) return
    onChange([])
  }

  return (
    <div className="space-y-3">
      {/* Barra de controle superior */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-2.5 dark:border-slate-800">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
            {title}
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={disabled}
            className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 disabled:opacity-50"
          >
            Marcar Todos
          </button>
          <span className="text-gray-300 dark:text-slate-600">•</span>
          <button
            type="button"
            onClick={handleDeselectAll}
            disabled={disabled}
            className="text-xs font-semibold text-gray-500 hover:underline dark:text-slate-400 disabled:opacity-50"
          >
            Desmarcar Todos
          </button>
        </div>
      </div>

      {/* Grade de módulos com opções granulares */}
      <div className="grid grid-cols-1 gap-3">
        {availableModules.map((mod) => {
          const isModChecked = currentSet.has(mod.code)
          const activeSubsCount = mod.subFeatures.filter((s) => currentSet.has(s.code)).length

          return (
            <div
              key={mod.code}
              className={`rounded-xl border transition-all ${
                isModChecked
                  ? 'border-blue-300/80 bg-blue-50/30 dark:border-blue-900/60 dark:bg-blue-950/20'
                  : 'border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 opacity-80'
              }`}
            >
              {/* Cabeçalho do Módulo */}
              <div className="p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <label className="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isModChecked}
                      onChange={() => handleToggleModule(mod)}
                      disabled={disabled}
                      className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {mod.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400">
                          {mod.code}
                        </span>
                        {isModChecked && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              activeSubsCount === mod.subFeatures.length
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : activeSubsCount > 0
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}
                          >
                            {activeSubsCount === mod.subFeatures.length
                              ? 'Todos os recursos ativos'
                              : `${activeSubsCount} de ${mod.subFeatures.length} opções ativas`}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                        {mod.description}
                      </p>
                    </div>
                  </label>
                </div>

                {/* Sub-opções específicas quando o módulo está habilitado */}
                {isModChecked && mod.subFeatures.length > 0 && (
                  <div className="mt-3.5 pt-3 border-t border-blue-200/60 dark:border-blue-900/40 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-gray-600 dark:text-slate-300 px-1">
                      <span className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        Opções e Telas Liberadas deste Módulo:
                      </span>
                      <div className="flex items-center gap-2 text-[10px]">
                        <button
                          type="button"
                          onClick={() => handleSelectAllSubFeaturesOfMod(mod)}
                          disabled={disabled}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Marcar todas
                        </button>
                        <span className="text-gray-300 dark:text-slate-600">•</span>
                        <button
                          type="button"
                          onClick={() => handleDeselectAllSubFeaturesOfMod(mod)}
                          disabled={disabled}
                          className="text-gray-500 hover:underline dark:text-slate-400"
                        >
                          Desmarcar todas
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {mod.subFeatures.map((sub) => {
                        const isSubChecked = currentSet.has(sub.code)
                        return (
                          <label
                            key={sub.code}
                            className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-all ${
                              isSubChecked
                                ? 'border-blue-400/80 bg-white shadow-xs text-gray-900 dark:border-blue-800 dark:bg-slate-900 dark:text-white'
                                : 'border-dashed border-gray-200 bg-gray-50/70 text-gray-400 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-500'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSubChecked}
                              onChange={() => handleToggleSubFeature(mod, sub)}
                              disabled={disabled}
                              className="mt-0.5 h-3.5 w-3.5 rounded text-blue-600 focus:ring-blue-500"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold leading-tight">
                                {sub.name}
                              </div>
                              <div className="text-[11px] text-gray-500 dark:text-slate-400 leading-tight mt-0.5">
                                {sub.description}
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Resumo inferior */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 pt-2 px-1">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Layers className="h-4 w-4 text-blue-600" />
          {selectedModulesCount} de {availableModules.length} módulos liberados
        </span>
        <span className="text-[11px] font-semibold text-gray-600 dark:text-slate-300">
          {selectedSubFeaturesCount} de {totalSubFeaturesCount} opções ativas
        </span>
      </div>
    </div>
  )
}
