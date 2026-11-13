import { useState, useMemo, useEffect } from 'react'
import {
  DollarSign,
  FileSignature,
  FileText,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import {
  contractService,
  type SoftwareContract,
} from '../services/contract.service'
import type { ManagedCompany } from '../services/company-management.service'
import { ContractFormModal } from './ContractFormModal'
import { ContractPrintModal } from './ContractPrintModal'

interface ContractsManagementSectionProps {
  existingCompanies: ManagedCompany[]
  prefillCompanyForNewContract?: ManagedCompany | null
  onClearPrefillCompany?: () => void
}

export function ContractsManagementSection({
  existingCompanies,
  prefillCompanyForNewContract,
  onClearPrefillCompany,
}: ContractsManagementSectionProps) {
  const [contracts, setContracts] = useState<SoftwareContract[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<SoftwareContract | null>(null)
  const [printingContract, setPrintingContract] = useState<SoftwareContract | null>(null)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  const loadContracts = async () => {
    setIsLoading(true)
    const res = await contractService.listContracts()
    if (res.success && res.data) {
      setContracts(res.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    void loadContracts()
  }, [])

  // Se houver uma empresa pré-selecionada para gerar contrato (acionado a partir da tabela de empresas)
  useEffect(() => {
    if (prefillCompanyForNewContract) {
      setEditingContract(null)
      setIsFormModalOpen(true)
    }
  }, [prefillCompanyForNewContract])

  // Métricas
  const metrics = useMemo(() => {
    const total = contracts.length
    const activeContracts = contracts.filter((c) => c.status === 'active')
    const activeCount = activeContracts.length
    const draftCount = contracts.filter((c) => c.status === 'draft').length
    const totalMRR = activeContracts.reduce((acc, c) => acc + (c.monthlyAmount || 0), 0)

    return { total, activeCount, draftCount, totalMRR }
  }, [contracts])

  // Filtro
  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      const matchSearch =
        c.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.contractNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.clientResponsibleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.clientDocument && c.clientDocument.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? c.status === 'active'
            : statusFilter === 'draft'
              ? c.status === 'draft'
              : c.status === 'cancelled' || c.status === 'suspended'

      return matchSearch && matchStatus
    })
  }, [contracts, searchTerm, statusFilter])

  const handleDelete = async (contract: SoftwareContract) => {
    if (!window.confirm(`Deseja realmente excluir o Contrato #${contract.contractNumber} (${contract.clientName})?`)) {
      return
    }
    await contractService.deleteContract(contract.id)
    setFeedbackMsg(`Contrato #${contract.contractNumber} excluído com sucesso.`)
    setTimeout(() => setFeedbackMsg(null), 3000)
    void loadContracts()
  }

  const handleFormSuccess = (savedContract: SoftwareContract, printImmediately = false) => {
    setFeedbackMsg(`Contrato #${savedContract.contractNumber} salvo com sucesso!`)
    setTimeout(() => setFeedbackMsg(null), 4000)
    void loadContracts()
    if (printImmediately) {
      setPrintingContract(savedContract)
      setIsPrintModalOpen(true)
    }
  }

  const handleCloseFormModal = () => {
    setIsFormModalOpen(false)
    setEditingContract(null)
    if (onClearPrefillCompany) {
      onClearPrefillCompany()
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner de Contratos */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            <FileSignature className="h-4 w-4" />
            <span>Módulo de Emissão & Gestão de Contratos de Software</span>
          </div>
          <h2 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            Gerar e Administrar Contratos de Licença / Aluguel
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Gere instrumentos contratuais para locação mensal do sistema, definindo o valor da mensalidade, responsável legal, data do contrato e condições para futuros clientes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => void loadContracts()}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            onClick={() => {
              setEditingContract(null)
              setIsFormModalOpen(true)
            }}
            className="gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Novo Contrato de Aluguel
          </Button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-xs text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Cards de Métricas de Contratos */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Total de Contratos</span>
            <div className="rounded-lg bg-purple-50 dark:bg-purple-950/60 p-2 text-purple-600 dark:text-purple-400">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{metrics.total}</p>
          <span className="text-xs text-gray-400 dark:text-slate-500">Emitidos na plataforma</span>
        </div>

        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Receita Mensal Recorrente (MRR)</span>
            <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/60 p-2 text-emerald-700 dark:text-emerald-300">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-800 dark:text-emerald-200">
            {formatCurrency(metrics.totalMRR.toFixed(2))}
          </p>
          <span className="text-xs text-emerald-700/80 dark:text-emerald-400">Contratos ativos vigentes</span>
        </div>

        <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">Contratos Ativos</span>
            <div className="rounded-lg bg-blue-100 dark:bg-blue-900/60 p-2 text-blue-700 dark:text-blue-300">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-800 dark:text-blue-200">{metrics.activeCount}</p>
          <span className="text-xs text-blue-700/80 dark:text-blue-400">Em vigor regular</span>
        </div>

        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Propostas / Rascunhos</span>
            <div className="rounded-lg bg-amber-100 dark:bg-amber-900/60 p-2 text-amber-700 dark:text-amber-300">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-800 dark:text-amber-200">{metrics.draftCount}</p>
          <span className="text-xs text-amber-700/80 dark:text-amber-400">Aguardando assinatura</span>
        </div>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, número do contrato, responsável ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/60 pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === 'all'
                ? 'bg-purple-600 text-white'
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            Todos ({metrics.total})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white'
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            Ativos ({metrics.activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('draft')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === 'draft'
                ? 'bg-amber-600 text-white'
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            Rascunhos ({metrics.draftCount})
          </button>
        </div>
      </div>

      {/* Tabela de Contratos */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        {isLoading ? (
          <div className="py-20 text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-purple-600 dark:text-purple-400" />
            <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">Carregando contratos de aluguel...</p>
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <FileSignature className="mx-auto h-12 w-12 text-gray-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">
              Nenhum contrato encontrado.
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 max-w-sm mx-auto">
              Clique em "Novo Contrato de Aluguel" para gerar um contrato com valor de mensalidade, responsável e dados do cliente.
            </p>
            <Button
              onClick={() => {
                setEditingContract(null)
                setIsFormModalOpen(true)
              }}
              className="gap-2 bg-purple-600 hover:bg-purple-700 text-white mt-2"
            >
              <Plus className="h-4 w-4" />
              Gerar Primeiro Contrato
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-slate-300">
              <thead className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/60 text-xs font-semibold uppercase text-gray-400 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">Contrato & Data</th>
                  <th className="px-4 py-3.5">Cliente / Contratante</th>
                  <th className="px-4 py-3.5">Responsável Legal</th>
                  <th className="px-4 py-3.5">Mensalidade & Vencimento</th>
                  <th className="px-4 py-3.5">Vigência</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredContracts.map((c) => {
                  const isDraft = c.status === 'draft'

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Contrato Nº & Data */}
                      <td className="px-4 py-4">
                        <div className="font-mono font-bold text-gray-900 dark:text-white">
                          #{c.contractNumber}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-slate-500">
                          {c.startDate.split('-').reverse().join('/')}
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="px-4 py-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {c.clientName}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-slate-400">
                          {c.clientDocument || 'CNPJ/CPF não informado'}
                        </div>
                        {c.clientEmail && (
                          <div className="text-[11px] text-gray-400 dark:text-slate-500 truncate max-w-[200px]">
                            {c.clientEmail}
                          </div>
                        )}
                      </td>

                      {/* Responsável */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 font-medium text-gray-800 dark:text-slate-200 text-xs">
                          <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{c.clientResponsibleName}</span>
                        </div>
                        {c.clientResponsibleRole && (
                          <div className="text-[11px] text-gray-400 dark:text-slate-500">
                            {c.clientResponsibleRole}
                          </div>
                        )}
                        {c.clientPhone && (
                          <div className="text-[11px] text-gray-400 dark:text-slate-500">
                            {c.clientPhone}
                          </div>
                        )}
                      </td>

                      {/* Mensalidade & Vencimento */}
                      <td className="px-4 py-4">
                        <div className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                          {formatCurrency(c.monthlyAmount.toFixed(2))}
                          <span className="text-[10px] font-normal text-gray-400 ml-1">/mês</span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          Vencimento: Todo dia {String(c.billingDay).padStart(2, '0')}
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-slate-500">
                          {c.paymentMethod}
                        </div>
                      </td>

                      {/* Vigência */}
                      <td className="px-4 py-4 text-xs">
                        <span className="inline-flex items-center gap-1 font-semibold text-gray-800 dark:text-slate-200">
                          <Clock className="h-3.5 w-3.5 text-blue-500" />
                          {c.durationMonths > 0 ? `${c.durationMonths} meses` : 'Indeterminado'}
                        </span>
                        <div className="text-[11px] text-gray-400 dark:text-slate-500">
                          {c.planName}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                            c.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : isDraft
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          {c.status === 'active'
                            ? 'Ativo'
                            : isDraft
                              ? 'Rascunho'
                              : c.status === 'suspended'
                                ? 'Suspenso'
                                : 'Cancelado'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPrintingContract(c)
                              setIsPrintModalOpen(true)
                            }}
                            className="gap-1.5 text-xs font-bold text-purple-600 border-purple-200 hover:bg-purple-50 dark:border-purple-900/60 dark:text-purple-400 dark:hover:bg-purple-950/50"
                            title="Visualizar e Imprimir Contrato Oficial"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Imprimir / PDF
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingContract(c)
                              setIsFormModalOpen(true)
                            }}
                            className="p-2 h-auto text-gray-600 hover:text-gray-900 dark:text-slate-300"
                            title="Editar Contrato"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleDelete(c)}
                            className="p-2 h-auto text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 dark:border-rose-900/40 dark:hover:bg-rose-950/40"
                            title="Excluir Contrato"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Criação / Edição */}
      <ContractFormModal
        isOpen={isFormModalOpen}
        onClose={handleCloseFormModal}
        onSuccess={handleFormSuccess}
        initialContract={editingContract}
        prefillCompany={prefillCompanyForNewContract}
        existingCompanies={existingCompanies}
      />

      {/* Modal de Impressão Oficial */}
      <ContractPrintModal
        contract={printingContract}
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false)
          setPrintingContract(null)
        }}
      />
    </div>
  )
}
