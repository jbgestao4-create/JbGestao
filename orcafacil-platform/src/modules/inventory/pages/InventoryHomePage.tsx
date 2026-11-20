import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const {
    canCreateInventoryProduct,
    canMoveInventory,
    inventoryAccessLevel,
    canAccessSubFeature,
  } = useModuleAccess()

  const canAccessCreateProduct = canAccessSubFeature('MOD-02_CREATE')
  const canAccessSearchInventory = canAccessSubFeature('MOD-02_SEARCH')
  const canAccessImportNfe = canAccessSubFeature('MOD-02_IMPORT_NFE')
  const canAccessMovements = canAccessSubFeature('MOD-02_MOVEMENTS')

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

      {!canAccessCreateProduct &&
      !canAccessSearchInventory &&
      !canAccessImportNfe &&
      !canAccessMovements ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="font-semibold text-sm">
            Nenhuma funcionalidade de Estoque está liberada para a sua empresa.
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-400 mt-1">
            Entre em contato com o suporte da ControleSoft para liberação de páginas e recursos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {/* CARD 1: CADASTRAR PRODUTO */}
          {canAccessCreateProduct && (
            <div className="flex w-full">
              <article
                className={`group relative flex w-full min-h-[240px] sm:min-h-[260px] flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:border-blue-300 dark:hover:border-slate-700 hover:shadow-sm ${
                  !canCreateInventoryProduct ? 'opacity-85' : ''
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-lg ${
                        canCreateInventoryProduct
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
                      }`}
                    >
                      <PackagePlus className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide ${
                        canCreateInventoryProduct
                          ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                      }`}
                    >
                      {canCreateInventoryProduct ? 'NOVO PRODUTO' : 'BLOQUEADO'}
                    </span>
                  </div>
                  <div className="mt-5">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      CADASTRAR PRODUTO
                    </h2>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {canCreateInventoryProduct
                        ? 'Informe dados do produto, foto, unidade de medida, saldo, valores e fornecedor.'
                        : 'Seu nível de acesso (Nível 1 - Apenas Consulta) não permite cadastrar novos produtos.'}
                    </p>
                  </div>
                </div>

                <div className="mt-auto pt-5">
                  {canCreateInventoryProduct ? (
                    <button
                      type="button"
                      onClick={() => {
                        void navigate('/orcafacil/inventory/new')
                      }}
                      className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Cadastrar Produto
                      </span>
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg bg-gray-100 text-gray-400 dark:bg-slate-800/40 dark:text-slate-500 px-3 py-2 text-xs font-semibold cursor-not-allowed"
                      title="Disponível a partir do Nível 2"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Lock className="h-4 w-4" aria-hidden="true" />
                        Requer Nível 2 ou 3
                      </span>
                      <span className="text-[10px]">Bloqueado</span>
                    </button>
                  )}
                </div>
              </article>
            </div>
          )}

          {/* CARD 2: CONSULTAR ESTOQUE */}
          {canAccessSearchInventory && (
            <div className="flex w-full">
              <article className="group relative flex w-full min-h-[240px] sm:min-h-[260px] flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:border-emerald-300 dark:hover:border-slate-700 hover:shadow-sm">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <ClipboardList className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 text-[10px] font-semibold tracking-wide text-emerald-800 dark:text-emerald-300">
                      CONSULTA
                    </span>
                  </div>
                  <div className="mt-5">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      CONSULTAR ESTOQUE
                    </h2>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Consulte saldos, valores, unidades e os fornecedores dos materiais cadastrados.
                    </p>
                  </div>
                </div>

                <div className="mt-auto pt-5">
                  <button
                    type="button"
                    onClick={() => {
                      void navigate('/orcafacil/inventory/search')
                    }}
                    className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Search className="h-4 w-4" aria-hidden="true" />
                      Consultar materiais
                    </span>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            </div>
          )}

          {/* CARD 3: IMPORTAR NOTA FISCAL */}
          {canAccessImportNfe && (
            <div className="flex w-full">
              <article
                className={`group relative flex w-full min-h-[240px] sm:min-h-[260px] flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:border-indigo-300 dark:hover:border-slate-700 hover:shadow-sm ${
                  !canCreateInventoryProduct ? 'opacity-85' : ''
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-lg ${
                        canCreateInventoryProduct
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
                      }`}
                    >
                      <FileUp className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide ${
                        canCreateInventoryProduct
                          ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                      }`}
                    >
                      {canCreateInventoryProduct ? 'IMPORTAÇÃO' : 'BLOQUEADO'}
                    </span>
                  </div>
                  <div className="mt-5">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      IMPORTAR NOTA FISCAL
                    </h2>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {canCreateInventoryProduct
                        ? 'Lê todos os dados da NF-e (PDF/XML), cadastra o fornecedor, anexa a nota e lança os materiais no estoque com status automático.'
                        : 'Seu nível de acesso não permite importar materiais no estoque.'}
                    </p>
                  </div>
                </div>

                <div className="mt-auto pt-5">
                  {canCreateInventoryProduct ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsImportModalOpen(true)
                      }}
                      className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2">
                        <FileUp className="h-4 w-4" aria-hidden="true" />
                        Importar Nota Fiscal
                      </span>
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg bg-gray-100 text-gray-400 dark:bg-slate-800/40 dark:text-slate-500 px-3 py-2 text-xs font-semibold cursor-not-allowed"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Lock className="h-4 w-4" aria-hidden="true" />
                        Requer Nível 2 ou 3
                      </span>
                      <span className="text-[10px]">Bloqueado</span>
                    </button>
                  )}
                </div>
              </article>
            </div>
          )}

          {/* CARD 4: MOVIMENTAÇÃO DE ESTOQUE */}
          {canAccessMovements && (
            <div className="flex w-full">
              <article
                className={`group relative flex w-full min-h-[240px] sm:min-h-[260px] flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:border-purple-300 dark:hover:border-slate-700 hover:shadow-sm ${
                  !canMoveInventory ? 'opacity-85' : ''
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-lg ${
                        canMoveInventory
                          ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
                      }`}
                    >
                      <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide ${
                        canMoveInventory
                          ? 'bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                      }`}
                    >
                      {canMoveInventory ? 'MOVIMENTAÇÃO' : 'BLOQUEADO'}
                    </span>
                  </div>
                  <div className="mt-5">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      MOVIMENTAÇÃO DE ESTOQUE
                    </h2>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {canMoveInventory
                        ? 'Entradas, saídas e histórico do produto.'
                        : `Seu nível de acesso (Nível ${String(inventoryAccessLevel)}) não permite registrar movimentações.`}
                    </p>
                  </div>
                </div>

                <div className="mt-auto pt-5">
                  {canMoveInventory ? (
                    <button
                      type="button"
                      onClick={() => {
                        void navigate('/orcafacil/inventory/movements')
                      }}
                      className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2">
                        <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                        Movimentar estoque
                      </span>
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg bg-gray-100 text-gray-400 dark:bg-slate-800/40 dark:text-slate-500 px-3 py-2 text-xs font-semibold cursor-not-allowed"
                      title="Exclusivo Nível 3 (Acesso Geral)"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Lock className="h-4 w-4" aria-hidden="true" />
                        Requer Nível 3 (Acesso Geral)
                      </span>
                      <span className="text-[10px]">Bloqueado</span>
                    </button>
                  )}
                </div>
              </article>
            </div>
          )}
        </div>
      )}

      <ImportInvoiceModal
        open={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false)
        }}
      />
    </div>
  )
}
