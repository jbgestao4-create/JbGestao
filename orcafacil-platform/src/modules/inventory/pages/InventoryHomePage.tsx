import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import {
  ArrowLeftRight,
  ChevronRight,
  ClipboardList,
  Lock,
  PackagePlus,
  Plus,
  Search,
} from 'lucide-react'

export function InventoryHomePage() {
  const navigate = useNavigate()
  const { canCreateInventoryProduct, canMoveInventory, inventoryAccessLevel } = useModuleAccess()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Estoque</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cadastre materiais com unidades flexíveis, fornecedores e saldo disponível para os
          orçamentos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {/* CARD CADASTRAR PRODUTO */}
        <Card className={`rounded-2xl shadow-sm ${!canCreateInventoryProduct ? 'opacity-85' : ''}`}>
          <CardContent className="flex h-full flex-col p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div
                className={`rounded-xl p-3 ${
                  canCreateInventoryProduct ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <PackagePlus className="h-6 w-6" aria-hidden="true" />
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${
                  canCreateInventoryProduct
                    ? 'bg-blue-50 text-blue-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {canCreateInventoryProduct ? 'NOVO PRODUTO' : 'BLOQUEADO'}
              </span>
            </div>
            <h2 className="mt-5 text-lg font-bold tracking-wide text-gray-900">CADASTRAR PRODUTO</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-gray-600">
              {canCreateInventoryProduct
                ? 'Informe dados do produto, foto, unidade de medida, saldo, valores e fornecedor.'
                : 'Seu nível de acesso (Nível 1 - Apenas Consulta) não permite cadastrar novos produtos.'}
            </p>
            {canCreateInventoryProduct ? (
              <Button
                size="lg"
                onClick={() => {
                  void navigate('/orcafacil/inventory/new')
                }}
                className="mt-6 w-full justify-between rounded-xl bg-blue-600 hover:bg-blue-700"
              >
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Cadastrar Produto
                </span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                size="lg"
                disabled
                className="mt-6 w-full justify-between rounded-xl bg-gray-100 text-gray-400 cursor-not-allowed"
                title="Disponível a partir do Nível 2"
              >
                <span className="inline-flex items-center gap-2">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  Requer Nível 2 ou 3
                </span>
                <span className="text-xs">Bloqueado</span>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* CARD CONSULTAR ESTOQUE */}
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex h-full flex-col p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                <ClipboardList className="h-6 w-6" aria-hidden="true" />
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-800">
                CONSULTA
              </span>
            </div>
            <h2 className="mt-5 text-lg font-bold tracking-wide text-gray-900">
              CONSULTAR ESTOQUE
            </h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-gray-600">
              Consulte saldos, valores, unidades e os fornecedores dos materiais cadastrados.
            </p>
            <Button
              size="lg"
              onClick={() => {
                void navigate('/orcafacil/inventory/search')
              }}
              className="mt-6 w-full justify-between rounded-xl bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600"
            >
              <span className="inline-flex items-center gap-2">
                <Search className="h-4 w-4" aria-hidden="true" />
                Consultar materiais
              </span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>

        {/* CARD MOVIMENTAÇÃO DE ESTOQUE */}
        <Card className={`rounded-2xl shadow-sm ${!canMoveInventory ? 'opacity-85' : ''}`}>
          <CardContent className="flex h-full flex-col p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div
                className={`rounded-xl p-3 ${
                  canMoveInventory ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <ArrowLeftRight className="h-6 w-6" aria-hidden="true" />
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${
                  canMoveInventory ? 'bg-purple-50 text-purple-800' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {canMoveInventory ? 'MOVIMENTAÇÃO' : 'BLOQUEADO'}
              </span>
            </div>
            <h2 className="mt-5 text-lg font-bold tracking-wide text-gray-900">
              MOVIMENTAÇÃO DE ESTOQUE
            </h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-gray-600">
              {canMoveInventory
                ? 'Entradas, saídas e histórico do produto.'
                : `Seu nível de acesso (Nível ${inventoryAccessLevel}) não permite registrar movimentações.`}
            </p>
            {canMoveInventory ? (
              <Button
                size="lg"
                onClick={() => {
                  void navigate('/orcafacil/inventory/movements')
                }}
                className="mt-6 w-full justify-between rounded-xl bg-purple-600 hover:bg-purple-700 focus-visible:outline-purple-600"
              >
                <span className="inline-flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                  Movimentar estoque
                </span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                size="lg"
                disabled
                className="mt-6 w-full justify-between rounded-xl bg-gray-100 text-gray-400 cursor-not-allowed"
                title="Exclusivo Nível 3 (Acesso Geral)"
              >
                <span className="inline-flex items-center gap-2">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  Requer Nível 3 (Acesso Geral)
                </span>
                <span className="text-xs">Bloqueado</span>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
