import { useNavigate } from 'react-router-dom'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { ChevronRight, Plus, Search, Truck } from 'lucide-react'

export function SuppliersHomePage() {
  const navigate = useNavigate()
  const { canAccessSubFeature } = useModuleAccess()

  const canCreateSupplier = canAccessSubFeature('MOD-06_CREATE')
  const canSearchSupplier = canAccessSubFeature('MOD-06_SEARCH')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Fornecedores</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Cadastre e consulte fornecedores e notas fiscais da organização.
        </p>
      </div>

      {!canCreateSupplier && !canSearchSupplier ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="font-semibold text-sm">
            Nenhuma funcionalidade de Fornecedores está liberada para a sua empresa.
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-400 mt-1">
            Entre em contato com o suporte da ControleSoft para liberação de páginas e recursos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {canCreateSupplier && (
            <div className="flex w-full">
              <article className="group relative flex w-full min-h-[240px] sm:min-h-[260px] flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:border-blue-300 dark:hover:border-slate-700 hover:shadow-sm">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      <Truck className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                      NOVO REGISTRO
                    </span>
                  </div>
                  <div className="mt-5">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      CADASTRAR
                    </h2>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Cadastre um fornecedor com CNPJ, contato, telefone, e-mail e endereço.
                    </p>
                  </div>
                </div>

                <div className="mt-auto pt-5">
                  <button
                    type="button"
                    onClick={() => {
                      void navigate('/orcafacil/suppliers/new')
                    }}
                    className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Cadastrar Fornecedor
                    </span>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            </div>
          )}

          {canSearchSupplier && (
            <div className="flex w-full">
              <article className="group relative flex w-full min-h-[240px] sm:min-h-[260px] flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:border-emerald-300 dark:hover:border-slate-700 hover:shadow-sm">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <Search className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      PESQUISA &amp; FICHA
                    </span>
                  </div>
                  <div className="mt-5">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      CONSULTAR FORNECEDOR
                    </h2>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Pesquise fornecedores, consulte seus dados e gerencie as notas recebidas de cada um.
                    </p>
                  </div>
                </div>

                <div className="mt-auto pt-5">
                  <button
                    type="button"
                    onClick={() => {
                      void navigate('/orcafacil/suppliers/search')
                    }}
                    className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Search className="h-4 w-4" aria-hidden="true" />
                      Consultar Fornecedores
                    </span>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
