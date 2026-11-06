import { useEffect, useState, type FormEvent } from 'react'
import {
  companyManagementService,
  normalizeCompanyModules,
  type ManagedCompany,
} from '../services/company-management.service'
import { CompanyModulesSelector } from './CompanyModulesSelector'
import type { DashboardModuleCode } from '@shared/types/common'
import { Button } from '@shared/components/ui/Button'
import { Layers, ShieldCheck, X } from 'lucide-react'

interface ManageCompanyModulesModalProps {
  company: ManagedCompany | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ManageCompanyModulesModal({
  company,
  isOpen,
  onClose,
  onSuccess,
}: ManageCompanyModulesModalProps) {
  const [selectedModules, setSelectedModules] = useState<DashboardModuleCode[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (company) {
      setSelectedModules(normalizeCompanyModules(company.modules ?? []))
      setError(null)
    }
  }, [company])

  if (!isOpen || !company) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const res = await companyManagementService.updateCompanyModules(company.id, selectedModules)
    setIsLoading(false)

    if (res.success) {
      onSuccess()
      onClose()
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Gerenciar Acesso às Páginas
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Empresa: <strong className="text-gray-800 dark:text-slate-200">{company.name}</strong> • SLUG:{' '}
                <span className="font-mono bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] text-blue-600 dark:text-blue-400">
                  {company.slug}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="rounded-xl bg-blue-50/70 dark:bg-blue-950/40 p-4 border border-blue-200/60 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              <span>Controle por Identificador Único (SLUG)</span>
            </div>
            <p className="mt-1 leading-relaxed">
              Marque as páginas e opções específicas aos quais os usuários desta empresa terão acesso. Opções desmarcadas não ficarão visíveis nem acessíveis no painel e rotas desta organização.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          <CompanyModulesSelector
            selectedCodes={selectedModules}
            onChange={setSelectedModules}
            disabled={isLoading}
          />

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-5 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              {isLoading ? 'Salvando...' : 'Salvar Permissões'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
