import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { ChevronRight, Plus, Search, Truck } from 'lucide-react'

export function SuppliersHomePage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Fornecedores</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cadastre e consulte fornecedores e notas fiscais da organização.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex h-full flex-col p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
                <Truck className="h-6 w-6" aria-hidden="true" />
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-blue-800">
                NOVO REGISTRO
              </span>
            </div>
            <h2 className="mt-5 text-lg font-bold tracking-wide text-gray-900">CADASTRAR</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-gray-600">
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

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex h-full flex-col p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div className="relative rounded-xl bg-emerald-50 p-3 text-emerald-700">
                <Search className="h-6 w-6" aria-hidden="true" />
                <span className="absolute -right-1 -top-1 rounded-full bg-white p-0.5">
                  <Plus className="h-3 w-3" aria-hidden="true" />
                </span>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-800">
                PESQUISA &amp; FICHA
              </span>
            </div>
            <h2 className="mt-5 text-lg font-bold tracking-wide text-gray-900">
              CONSULTAR FORNECEDOR
            </h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-gray-600">
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
      </div>
    </div>
  )
}
