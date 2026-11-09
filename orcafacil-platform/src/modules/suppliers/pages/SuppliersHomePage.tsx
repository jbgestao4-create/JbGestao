import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
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
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {canCreateSupplier && (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="flex h-full flex-col p-6 sm:p-8">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-blue-50 p-3 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                    <Truck className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                    NOVO REGISTRO
                  </span>
                </div>
                <h2 className="mt-5 text-lg font-bold tracking-wide text-gray-900 dark:text-white">
                  CADASTRAR
                </h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-gray-600 dark:text-slate-300">
                  Cadastre um fornecedor com CNPJ, contato, telefone, e-mail e endereço.
                </p>
                <Button
                  size="lg"
                  onClick={() => {
                    void navigate('/orcafacil/suppliers/new')
                  }}
                  className="mt-6 w-full justify-between rounded-xl bg-blue-600 hover:bg-blue-700"
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Cadastrar Fornecedor
                  </span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </CardContent>
            </Card>
          )}

          {canSearchSupplier && (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="flex h-full flex-col p-6 sm:p-8">
                <div className="flex items-start justify-between gap-3">
                  <div className="relative rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-3 text-emerald-700 dark:text-emerald-300">
                    <Search className="h-6 w-6" aria-hidden="true" />
                    <span className="absolute -right-1 -top-1 rounded-full bg-white dark:bg-slate-900 p-0.5">
                      <Plus className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </div>
                  <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-800 dark:text-emerald-300">
                    PESQUISA &amp; FICHA
                  </span>
                </div>
                <h2 className="mt-5 text-lg font-bold tracking-wide text-gray-900 dark:text-white">
                  CONSULTAR FORNECEDOR
                </h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-gray-600 dark:text-slate-300">
                  Pesquise fornecedores, consulte seus dados e gerencie as notas recebidas de cada um.
                </p>
                <Button
                  size="lg"
                  onClick={() => {
                    void navigate('/orcafacil/suppliers/search')
                  }}
                  className="mt-6 w-full justify-between rounded-xl bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600"
                >
                  <span className="inline-flex items-center gap-2">
                    <Search className="h-4 w-4" aria-hidden="true" />
                    Consultar Fornecedores
                  </span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
