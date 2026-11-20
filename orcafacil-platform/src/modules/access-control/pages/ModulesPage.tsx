import { useModuleAccess } from '../context/ModuleAccessContext'
import { Link } from 'react-router-dom'
import { FileSpreadsheet, Calendar, Package, CheckCircle2, Clock, ArrowRight } from 'lucide-react'

export function ModulesPage() {
  const { allModules, canAccess } = useModuleAccess()

  const getModuleIcon = (code: string) => {
    switch (code) {
      case 'orcafacil':
        return <FileSpreadsheet className="w-5 h-5 text-blue-600" />
      case 'agendapro':
        return <Calendar className="w-5 h-5 text-amber-600" />
      case 'estoqueleve':
        return <Package className="w-5 h-5 text-emerald-600" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Catálogo de Módulos</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Ferramentas modulares independentes integradas à sua organização
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        {allModules.map((mod) => {
          const isActivated = canAccess(mod.code)

          return (
            <div key={mod.code} className="flex w-full">
              <article className="group relative flex w-full min-h-[240px] sm:min-h-[260px] flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:border-blue-300 dark:hover:border-slate-700 hover:shadow-sm">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                      {getModuleIcon(mod.code)}
                    </span>
                    <div>
                      {isActivated ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> Ativo
                        </span>
                      ) : mod.status === 'coming_soon' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/50 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                          <Clock className="w-3 h-3" /> Em Breve
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          Planejado
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">{mod.name}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{mod.description}</p>
                  </div>
                </div>

                <div className="mt-auto pt-5">
                  {isActivated ? (
                    <Link
                      to="/orcafacil/quotes"
                      className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg bg-slate-50 text-slate-700 hover:bg-blue-100 hover:text-blue-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300 px-3 py-2 text-xs font-semibold transition-colors"
                    >
                      <span>Abrir Módulo</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="flex min-h-10 w-full cursor-not-allowed items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 px-3 py-2 text-left text-xs font-semibold text-slate-400 dark:text-slate-500 transition-colors"
                    >
                      <span>Indisponível nesta versão</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </button>
                  )}
                </div>
              </article>
            </div>
          )
        })}
      </div>
    </div>
  )
}
