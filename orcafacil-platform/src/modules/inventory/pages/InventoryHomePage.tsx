import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { ImportInvoiceModal } from '../components/ImportInvoiceModal'
import {
  ArrowLeftRight,
  ChevronRight,
  ClipboardList,
  FileUp,
  Lock,
  PackagePlus,
  Plus,
  Search,
} from 'lucide-react'

export function InventoryHomePage() {
  const navigate = useNavigate()
  const { canCreateInventoryProduct, canMoveInventory, inventoryAccessLevel } = useModuleAccess()
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Estoque</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Cadastre materiais com unidades flexíveis, fornecedores e saldo disponível para os
          orçamentos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-2">
        {/* CARD 1: CADASTRAR PRODUTO */}
        <Card className={`rounded-2xl shadow-sm hover:shadow-md transition-shadow ${!canCreateInventoryProduct ? 'opacity-85' : ''}`}>
          <CardContent className="flex h-full flex-col p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div
                className={`rounded-xl p-3 ${
                  canCreateInventoryProduct ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
                }`}
              >
                <PackagePlus className="h-6 w-6" aria-hidden="true" />
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${
                  canCreateInventoryProduct ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                }`}
              >
                {canCreateInventoryProduct ? 'NOVO PRODUTO' : 'BLOQUEADO'}
              </span>
            </div>
            <h2 className="mt-5 text-lg font-bold tracking-wide text-gray-900 dark:text-white">CADASTRAR PRODUTO</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-gray-600 dark:text-slate-300">
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

        {/* CARD 2: CONSULTAR ESTOQUE */}
        <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex h-full flex-col p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-3 text-emerald-700 dark:text-emerald-300">
                <ClipboardList className="h-6 w-6" aria-hidden="true" />
              </div>
              <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-800 dark:text-emerald-300">
                CONSULTA
              </span>
            </div>
            <h2 className="mt-5 text-lg font-bold tracking-wide text-gray-900 dark:text-white">
              CONSULTAR ESTOQUE
            </h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-gray-600 dark:text-slate-300">
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

        {/* CARD 3: IMPORTAR NOTA FISCAL */}
        <Card className={`rounded-2xl shadow-sm hover:shadow-md transition-shadow ${!canCreateInventoryProduct ? 'opacity-85' : ''}`}>
          <CardContent className="flex h-full flex-col p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div
                className={`rounded-xl p-3 ${
                  canCreateInventoryProduct ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
                }`}
              >
                <FileUp className="h-6 w-6" aria-hidden="true" />
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${
                  canCreateInventoryProduct ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                }`}
              >
                {canCreateInventoryProduct ? 'IMPORTAÇÃO' : 'BLOQUEADO'}
              </span>
            </div>
            <h2 className="mt-5 text-lg font-bold tracking-wide text-gray-900 dark:text-white">IMPORTAR NOTA FISCAL</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-gray-600 dark:text-slate-300">
              {canCreateInventoryProduct
                ? 'Lê todos os dados da NF-e (PDF/XML), cadastra o fornecedor, anexa a nota e lança os materiais no estoque com status automático.'
                : 'Seu nível de acesso não permite importar materiais no estoque.'}
            </p>
            {canCreateInventoryProduct ? (
              <Button
                size="lg"
                onClick={() => {
                  setIsImportModalOpen(true)
                }}
                className="mt-6 w-full justify-between rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <span className="inline-flex items-center gap-2">
                  <FileUp className="h-4 w-4" aria-hidden="true" />
                  Importar Nota Fiscal
                </span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                size="lg"
                disabled
                className="mt-6 w-full justify-between rounded-xl bg-gray-100 text-gray-400 cursor-not-allowed"
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

        {/* CARD 4: MOVIMENTAÇÃO DE ESTOQUE */}
        <Card className={`rounded-2xl shadow-sm hover:shadow-md transition-shadow ${!canMoveInventory ? 'opacity-85' : ''}`}>
          <CardContent className="flex h-full flex-col p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div
                className={`rounded-xl p-3 ${
                  canMoveInventory ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
                }`}
              >
                <ArrowLeftRight className="h-6 w-6" aria-hidden="true" />
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${
                  canMoveInventory ? 'bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                }`}
              >
                {canMoveInventory ? 'MOVIMENTAÇÃO' : 'BLOQUEADO'}
              </span>
            </div>
            <h2 className="mt-5 text-lg font-bold tracking-wide text-gray-900 dark:text-white">
              MOVIMENTAÇÃO DE ESTOQUE
            </h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-gray-600 dark:text-slate-300">
              {canMoveInventory
                ? 'Entradas, saídas e histórico do produto.'
                : `Seu nível de acesso (Nível ${String(inventoryAccessLevel)}) não permite registrar movimentações.`}
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

      <ImportInvoiceModal
        open={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false)
        }}
      />
    </div>
  )
}
