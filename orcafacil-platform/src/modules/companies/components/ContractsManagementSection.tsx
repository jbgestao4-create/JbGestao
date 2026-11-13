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
  CreditCard,
  Receipt,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import {
  contractService,
  type SoftwareContract,
  type ContractInvoice,
  getInvoiceEffectiveStatus,
  getContractOverdueInfo,
} from '../services/contract.service'
import type { ManagedCompany } from '../services/company-management.service'
import { ContractFormModal } from './ContractFormModal'
import { ContractPrintModal } from './ContractPrintModal'
import { ContractInvoicePrintModal } from './ContractInvoicePrintModal'

interface ContractsManagementSectionProps {
  existingCompanies: ManagedCompany[]
  prefillCompanyForNewContract?: ManagedCompany | null
  onClearPrefillCompany?: () => void
  initialTab?: 'contracts' | 'payments'
  initialCompanyId?: string
}

export function ContractsManagementSection({
  existingCompanies,
  prefillCompanyForNewContract,
  onClearPrefillCompany,
  initialTab = 'contracts',
  initialCompanyId,
}: ContractsManagementSectionProps) {
  // Controle de Abas: 'contracts' (Contratos) ou 'payments' (Faturas & Pagamentos)
  const [activeTab, setActiveTab] = useState<'contracts' | 'payments'>(initialTab)

  const [contracts, setContracts] = useState<SoftwareContract[]>([])
  const [invoices, setInvoices] = useState<ContractInvoice[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros de Contratos
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Filtros de Faturas / Pagamentos
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('')
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('')
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'overdue'>('all')

  // Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<SoftwareContract | null>(null)
  const [printingContract, setPrintingContract] = useState<SoftwareContract | null>(null)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [viewingInvoice, setViewingInvoice] = useState<ContractInvoice | null>(null)
  const [isInvoicePrintModalOpen, setIsInvoicePrintModalOpen] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  const loadData = async () => {
    setIsLoading(true)
    const [cRes, iRes] = await Promise.all([
      contractService.listContracts(),
      contractService.listInvoices(),
    ])
    if (cRes.success && cRes.data) {
      setContracts(cRes.data)
    }
    if (iRes.success && iRes.data) {
      setInvoices(iRes.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  // Sincroniza aba inicial caso mude via URL
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  // Se houver uma empresa pré-selecionada via URL para visualizar faturas ou contrato
  useEffect(() => {
    if (initialCompanyId && existingCompanies.length > 0) {
      const found = existingCompanies.find((c) => c.id === initialCompanyId)
      if (found) {
        setSelectedClientFilter(found.name)
      }
    }
  }, [initialCompanyId, existingCompanies])

  // Se houver uma empresa pré-selecionada para gerar contrato
  useEffect(() => {
    if (prefillCompanyForNewContract) {
      setActiveTab('contracts')
      setEditingContract(null)
      setIsFormModalOpen(true)
    }
  }, [prefillCompanyForNewContract])

  // Lista única de clientes para o seletor da aba de faturas
  const clientOptions = useMemo(() => {
    const map = new Map<string, { total: number; paid: number; unpaid: number }>()
    for (const inv of invoices) {
      const name = inv.clientName || 'Cliente'
      const stat = map.get(name) || { total: 0, paid: 0, unpaid: 0 }
      stat.total++
      if (getInvoiceEffectiveStatus(inv) === 'paid') {
        stat.paid++
      } else {
        stat.unpaid++
      }
      map.set(name, stat)
    }
    for (const c of contracts) {
      if (!map.has(c.clientName)) {
        map.set(c.clientName, { total: 0, paid: 0, unpaid: 0 })
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [invoices, contracts])

  // Dados do cliente selecionado no filtro de faturas
  const selectedClientContract = useMemo(() => {
    if (!selectedClientFilter) return null
    return contracts.find((c) => c.clientName.trim().toLowerCase() === selectedClientFilter.trim().toLowerCase()) || null
  }, [contracts, selectedClientFilter])

  const selectedClientStats = useMemo(() => {
    if (!selectedClientFilter) return null
    const list = invoices.filter((i) => i.clientName.trim().toLowerCase() === selectedClientFilter.trim().toLowerCase())
    let paid = 0
    let unpaid = 0
    let paidAmount = 0
    let unpaidAmount = 0
    let overdueCount = 0

    for (const inv of list) {
      const eff = getInvoiceEffectiveStatus(inv)
      if (eff === 'paid') {
        paid++
        paidAmount += inv.amount || 0
      } else if (eff !== 'cancelled') {
        unpaid++
        unpaidAmount += inv.amount || 0
        if (eff === 'overdue') overdueCount++
      }
    }
    return { paid, unpaid, paidAmount, unpaidAmount, overdueCount, total: list.length }
  }, [invoices, selectedClientFilter])

  // Métricas de Contratos
  const metrics = useMemo(() => {
    const total = contracts.length
    const activeContracts = contracts.filter((c) => c.status === 'active')
    const activeCount = activeContracts.length
    const draftCount = contracts.filter((c) => c.status === 'draft').length
    const totalMRR = activeContracts.reduce((acc, c) => acc + (c.monthlyAmount || 0), 0)

    return { total, activeCount, draftCount, totalMRR }
  }, [contracts])

  // Métricas Financeiras de Pagamentos / Faturas
  const invoiceMetrics = useMemo(() => {
    let totalPaid = 0
    let totalPending = 0
    let totalOverdue = 0
    let paidCount = 0
    let pendingCount = 0
    let overdueCount = 0

    for (const inv of invoices) {
      const eff = getInvoiceEffectiveStatus(inv)
      if (eff === 'paid') {
        totalPaid += inv.amount || 0
        paidCount++
      } else if (eff === 'overdue') {
        totalOverdue += inv.amount || 0
        overdueCount++
      } else if (eff === 'pending') {
        totalPending += inv.amount || 0
        pendingCount++
      }
    }

    return {
      totalPaid,
      totalPending,
      totalOverdue,
      paidCount,
      pendingCount,
      overdueCount,
      totalCount: invoices.length,
    }
  }, [invoices])

  // Contagens contextuais para os botões de filtro da aba de faturas (baseadas no cliente selecionado se houver)
  const currentTabCounts = useMemo(() => {
    const list = selectedClientFilter
      ? invoices.filter((i) => i.clientName.trim().toLowerCase() === selectedClientFilter.trim().toLowerCase())
      : invoices

    let paid = 0
    let unpaid = 0
    let overdue = 0
    let pending = 0

    for (const inv of list) {
      const eff = getInvoiceEffectiveStatus(inv)
      if (eff === 'paid') {
        paid++
      } else if (eff !== 'cancelled') {
        unpaid++
        if (eff === 'overdue') overdue++
        if (eff === 'pending') pending++
      }
    }

    return { total: list.length, paid, unpaid, overdue, pending }
  }, [invoices, selectedClientFilter])

  // Contagem de contratos com alguma fatura vencida
  const overdueContractsCount = useMemo(() => {
    return contracts.filter((c) => getContractOverdueInfo(c.id, invoices).hasOverdue).length
  }, [contracts, invoices])

  // Filtro de Contratos
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
              : statusFilter === 'overdue'
                ? getContractOverdueInfo(c.id, invoices).hasOverdue
                : c.status === 'cancelled' || c.status === 'suspended'

      return matchSearch && matchStatus
    })
  }, [contracts, searchTerm, statusFilter, invoices])

  // Filtro de Faturas
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchClient = !selectedClientFilter
        ? true
        : inv.clientName.trim().toLowerCase() === selectedClientFilter.trim().toLowerCase()

      const matchSearch =
        inv.clientName.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
        inv.invoiceNumber.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
        inv.referenceMonth.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
        (inv.clientDocument && inv.clientDocument.toLowerCase().includes(invoiceSearchTerm.toLowerCase()))

      const eff = getInvoiceEffectiveStatus(inv)
      const matchStatus =
        invoiceStatusFilter === 'all'
          ? true
          : invoiceStatusFilter === 'paid'
            ? eff === 'paid'
            : invoiceStatusFilter === 'unpaid'
              ? eff !== 'paid' && eff !== 'cancelled'
              : invoiceStatusFilter === 'overdue'
                ? eff === 'overdue'
                : eff === 'pending'

      return matchClient && matchSearch && matchStatus
    })
  }, [invoices, selectedClientFilter, invoiceSearchTerm, invoiceStatusFilter])

  const handleDelete = async (contract: SoftwareContract) => {
    if (!window.confirm(`Deseja realmente excluir o Contrato #${contract.contractNumber} (${contract.clientName})?`)) {
      return
    }
    await contractService.deleteContract(contract.id)
    setFeedbackMsg(`Contrato #${contract.contractNumber} excluído com sucesso.`)
    setTimeout(() => setFeedbackMsg(null), 3000)
    void loadData()
  }

  const handleFormSuccess = (savedContract: SoftwareContract, printImmediately = false) => {
    setFeedbackMsg(`Contrato #${savedContract.contractNumber} salvo com sucesso!`)
    setTimeout(() => setFeedbackMsg(null), 4000)
    void loadData()
    if (printImmediately) {
      setPrintingContract(savedContract)
      setIsPrintModalOpen(true)
    }
  }

  const handleToggleInvoicePaid = async (inv: ContractInvoice) => {
    if (inv.status === 'paid') {
      await contractService.undoInvoicePayment(inv.id)
      setFeedbackMsg(`Pagamento da fatura #${inv.invoiceNumber} desfeito.`)
    } else {
      await contractService.markInvoiceAsPaid(inv.id, inv.paymentMethod || 'PIX')
      setFeedbackMsg(`Pagamento da fatura #${inv.invoiceNumber} confirmado com sucesso!`)
    }
    setTimeout(() => setFeedbackMsg(null), 3000)
    void loadData()
  }

  const handleDeleteInvoice = async (inv: ContractInvoice) => {
    if (!window.confirm(`Deseja excluir a Fatura #${inv.invoiceNumber} (${inv.clientName})?`)) return
    await contractService.deleteInvoice(inv.id)
    setFeedbackMsg(`Fatura #${inv.invoiceNumber} excluída.`)
    setTimeout(() => setFeedbackMsg(null), 3000)
    void loadData()
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
            onClick={() => void loadData()}
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

      {/* Navegação por Abas: Contratos x Pagamentos & Faturas */}
      <div className="flex border-b border-gray-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('contracts')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-bold transition-all ${
            activeTab === 'contracts'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-50/30 dark:bg-purple-950/20'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <FileSignature className="h-4 w-4" />
          <span>Contratos de Licença ({contracts.length})</span>
          {overdueContractsCount > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 animate-pulse">
              {overdueContractsCount} {overdueContractsCount === 1 ? 'cliente com fatura vencida' : 'clientes com faturas vencidas'}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-bold transition-all ${
            activeTab === 'payments'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Pagamentos Realizados & Financeiro ({invoices.length})</span>
          {invoiceMetrics.overdueCount > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 animate-pulse">
              {invoiceMetrics.overdueCount} {invoiceMetrics.overdueCount === 1 ? 'vencida' : 'vencidas'}
            </span>
          )}
        </button>
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

      {/* CONTEÚDO DA ABA 1: CONTRATOS DE LICENÇA */}
      {activeTab === 'contracts' && (
        <div className="space-y-6">
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

            <div className={`rounded-2xl border p-5 shadow-xs transition-all ${
              overdueContractsCount > 0
                ? 'border-rose-300 dark:border-rose-900/80 bg-rose-50/60 dark:bg-rose-950/30'
                : 'border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${overdueContractsCount > 0 ? 'text-rose-800 dark:text-rose-300' : 'text-amber-800 dark:text-amber-300'}`}>
                  {overdueContractsCount > 0 ? 'Clientes com Fatura Vencida' : 'Propostas / Rascunhos'}
                </span>
                <div className={`rounded-lg p-2 ${overdueContractsCount > 0 ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300' : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'}`}>
                  {overdueContractsCount > 0 ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                </div>
              </div>
              <p className={`mt-2 text-2xl font-bold ${overdueContractsCount > 0 ? 'text-rose-800 dark:text-rose-200' : 'text-amber-800 dark:text-amber-200'}`}>
                {overdueContractsCount > 0 ? overdueContractsCount : metrics.draftCount}
              </p>
              <span className={`text-xs ${overdueContractsCount > 0 ? 'text-rose-700/80 dark:text-rose-400 font-semibold' : 'text-amber-700/80 dark:text-amber-400'}`}>
                {overdueContractsCount > 0 ? 'Requer cobrança imediata' : 'Aguardando assinatura'}
              </span>
            </div>
          </div>

          {/* Barra de Filtro e Busca de Contratos */}
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

            <div className="flex items-center gap-1.5 self-start sm:self-center flex-wrap">
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
              {overdueContractsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('overdue')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    statusFilter === 'overdue'
                      ? 'bg-rose-600 text-white'
                      : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100'
                  }`}
                >
                  ⚠️ Com Faturas Vencidas ({overdueContractsCount})
                </button>
              )}
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
                      const overdueInfo = getContractOverdueInfo(c.id, invoices)

                      return (
                        <tr
                          key={c.id}
                          className={`hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                            overdueInfo.hasOverdue ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                          }`}
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

                          {/* Cliente / Contratante com Observação de Fatura Vencida em frente */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {c.clientName}
                              </span>
                              {overdueInfo.hasOverdue && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 text-[11px] font-extrabold text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-xs animate-pulse">
                                  <AlertTriangle className="h-3 w-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                  FATURA VENCIDA ({overdueInfo.overdueCount} {overdueInfo.overdueCount === 1 ? 'parcela' : 'parcelas'})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                              {c.clientDocument || 'CNPJ/CPF não informado'}
                            </div>
                            {overdueInfo.hasOverdue ? (
                              <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                                Vencida desde {overdueInfo.oldestDueDate?.split('-').reverse().join('/')} • Total em aberto: {formatCurrency(overdueInfo.totalOverdueAmount.toFixed(2))}
                              </div>
                            ) : c.clientEmail ? (
                              <div className="text-[11px] text-gray-400 dark:text-slate-500 truncate max-w-[200px]">
                                {c.clientEmail}
                              </div>
                            ) : null}
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
                                  setSelectedClientFilter(c.clientName)
                                  setInvoiceStatusFilter('all')
                                  setActiveTab('payments')
                                }}
                                className="gap-1.5 text-xs font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800"
                                title="Abrir aba de faturas deste cliente (ver todas pagas e não pagas)"
                              >
                                <Receipt className="h-3.5 w-3.5" />
                                Faturas
                              </Button>

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
                                Contrato
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
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: PAGAMENTOS & FATURAS (CONTROLE FINANCEIRO) */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Seletor de Cliente para Visualização de Faturas */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 mb-1.5 flex items-center gap-1.5">
                <Receipt className="h-4 w-4 text-emerald-600" />
                <span>Selecionar Cliente para Visualizar Faturas (Pagas e Não Pagas)</span>
              </label>
              <select
                value={selectedClientFilter}
                onChange={(e) => {
                  setSelectedClientFilter(e.target.value)
                  setInvoiceStatusFilter('all')
                }}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="">🏢 Todos os Clientes (Visão Geral da Carteira - {invoices.length} faturas)</option>
                {clientOptions.map(([clientName, stat]) => (
                  <option key={clientName} value={clientName}>
                    {clientName} — {stat.total} {stat.total === 1 ? 'fatura' : 'faturas'} ({stat.paid} pagas / {stat.unpaid} não pagas)
                  </option>
                ))}
              </select>
            </div>

            {selectedClientFilter ? (
              <div className="flex items-center gap-2 self-start md:self-end">
                {selectedClientContract && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingContract(selectedClientContract)
                      setIsFormModalOpen(true)
                    }}
                    className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    title="Emitir novas faturas / carnê para este cliente"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Gerar Faturas / Carnê
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedClientFilter('')
                    setInvoiceStatusFilter('all')
                  }}
                  className="text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-slate-300"
                >
                  Ver Todos os Clientes
                </Button>
              </div>
            ) : null}
          </div>

          {/* Banner em Destaque do Cliente Selecionado */}
          {selectedClientFilter && selectedClientStats && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/25 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                    Cliente Selecionado:
                  </span>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedClientFilter}
                  </h3>
                  {selectedClientContract && (
                    <span className="rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs font-bold px-2 py-0.5 border border-purple-200 dark:border-purple-800">
                      Contrato #{selectedClientContract.contractNumber} ({selectedClientContract.planName})
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                  {selectedClientContract ? (
                    <>
                      Mensalidade: <strong>{formatCurrency(selectedClientContract.monthlyAmount.toFixed(2))}</strong> • Vencimento: Todo dia {String(selectedClientContract.billingDay).padStart(2, '0')} • Responsável: <strong>{selectedClientContract.clientResponsibleName}</strong>
                    </>
                  ) : (
                    'Faturas emitidas para este cliente na plataforma.'
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="rounded-xl bg-white dark:bg-slate-800 px-3.5 py-2 border border-emerald-200 dark:border-emerald-900/40 text-center shadow-xs">
                  <div className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Faturas Pagas</div>
                  <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                    {selectedClientStats.paid} ({formatCurrency(selectedClientStats.paidAmount.toFixed(2))})
                  </div>
                </div>

                <div className="rounded-xl bg-white dark:bg-slate-800 px-3.5 py-2 border border-amber-200 dark:border-amber-900/40 text-center shadow-xs">
                  <div className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">Não Pagas</div>
                  <div className="text-sm font-extrabold text-amber-700 dark:text-amber-300">
                    {selectedClientStats.unpaid} ({formatCurrency(selectedClientStats.unpaidAmount.toFixed(2))})
                  </div>
                </div>

                {selectedClientStats.overdueCount > 0 && (
                  <div className="rounded-xl bg-rose-100 dark:bg-rose-950/80 px-3.5 py-2 border border-rose-300 dark:border-rose-800 text-center shadow-xs animate-pulse">
                    <div className="text-[10px] uppercase font-extrabold text-rose-800 dark:text-rose-300">⚠️ Vencidas em Atraso</div>
                    <div className="text-sm font-extrabold text-rose-800 dark:text-rose-200">
                      {selectedClientStats.overdueCount} {selectedClientStats.overdueCount === 1 ? 'fatura' : 'faturas'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cards Financeiros de Faturas e Pagamentos */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Total Recebido (Pagamentos Realizados)</span>
                <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/60 p-2 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                {formatCurrency(invoiceMetrics.totalPaid.toFixed(2))}
              </p>
              <span className="text-xs text-emerald-700/80 dark:text-emerald-400 font-medium">
                {invoiceMetrics.paidCount} {invoiceMetrics.paidCount === 1 ? 'fatura quitada' : 'faturas quitadas'}
              </span>
            </div>

            <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">Total a Vencer (No Prazo)</span>
                <div className="rounded-lg bg-blue-100 dark:bg-blue-900/60 p-2 text-blue-700 dark:text-blue-300">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold text-blue-800 dark:text-blue-200">
                {formatCurrency(invoiceMetrics.totalPending.toFixed(2))}
              </p>
              <span className="text-xs text-blue-700/80 dark:text-blue-400 font-medium">
                {invoiceMetrics.pendingCount} {invoiceMetrics.pendingCount === 1 ? 'fatura aguardando' : 'faturas aguardando'}
              </span>
            </div>

            <div className={`rounded-2xl border p-5 shadow-xs transition-all ${
              invoiceMetrics.overdueCount > 0
                ? 'border-rose-300 dark:border-rose-900/80 bg-rose-50/60 dark:bg-rose-950/30'
                : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${invoiceMetrics.overdueCount > 0 ? 'text-rose-800 dark:text-rose-300' : 'text-gray-500 dark:text-slate-400'}`}>
                  Total em Atraso (Vencidas)
                </span>
                <div className={`rounded-lg p-2 ${invoiceMetrics.overdueCount > 0 ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'}`}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <p className={`mt-2 text-2xl font-bold ${invoiceMetrics.overdueCount > 0 ? 'text-rose-800 dark:text-rose-200' : 'text-gray-900 dark:text-white'}`}>
                {formatCurrency(invoiceMetrics.totalOverdue.toFixed(2))}
              </p>
              <span className={`text-xs ${invoiceMetrics.overdueCount > 0 ? 'text-rose-700 font-bold' : 'text-gray-400 dark:text-slate-500'}`}>
                {invoiceMetrics.overdueCount} {invoiceMetrics.overdueCount === 1 ? 'fatura vencida' : 'faturas vencidas'}
              </span>
            </div>

            <div className="rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-800 dark:text-purple-300">Total Faturado Geral</span>
                <div className="rounded-lg bg-purple-100 dark:bg-purple-900/60 p-2 text-purple-700 dark:text-purple-300">
                  <Receipt className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold text-purple-800 dark:text-purple-200">
                {formatCurrency((invoiceMetrics.totalPaid + invoiceMetrics.totalPending + invoiceMetrics.totalOverdue).toFixed(2))}
              </p>
              <span className="text-xs text-purple-700/80 dark:text-purple-400 font-medium">
                {invoices.length} faturas emitidas no total
              </span>
            </div>
          </div>

          {/* Barra de Filtro e Busca de Faturas */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar fatura por cliente, número da fatura, mês ref. ou CNPJ..."
                value={invoiceSearchTerm}
                onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/60 pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-center flex-wrap">
              <button
                type="button"
                onClick={() => setInvoiceStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  invoiceStatusFilter === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                Todas ({currentTabCounts.total})
              </button>
              <button
                type="button"
                onClick={() => setInvoiceStatusFilter('paid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  invoiceStatusFilter === 'paid'
                    ? 'bg-emerald-600 text-white'
                    : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100'
                }`}
              >
                ✓ Pagas ({currentTabCounts.paid})
              </button>
              <button
                type="button"
                onClick={() => setInvoiceStatusFilter('unpaid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  invoiceStatusFilter === 'unpaid'
                    ? 'bg-amber-600 text-white'
                    : 'text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100'
                }`}
              >
                ⏳ Não Pagas ({currentTabCounts.unpaid})
              </button>
              <button
                type="button"
                onClick={() => setInvoiceStatusFilter('overdue')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  invoiceStatusFilter === 'overdue'
                    ? 'bg-rose-600 text-white'
                    : 'text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100'
                }`}
              >
                ⚠️ Vencidas em Atraso ({currentTabCounts.overdue})
              </button>
            </div>
          </div>

          {/* Tabela de Faturas / Cobranças */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            {isLoading ? (
              <div className="py-20 text-center">
                <RefreshCw className="mx-auto h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400" />
                <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">Carregando faturas e pagamentos...</p>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <Receipt className="mx-auto h-12 w-12 text-gray-300 dark:text-slate-600" />
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                  {selectedClientFilter
                    ? `Nenhuma fatura encontrada para ${selectedClientFilter}.`
                    : 'Nenhuma fatura encontrada.'}
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500 max-w-sm mx-auto">
                  {selectedClientFilter && selectedClientContract
                    ? 'Clique no botão abaixo para gerar faturas mensais ou carnê de pagamento para este cliente.'
                    : 'As faturas podem ser geradas dentro de cada contrato na aba "Contratos de Licença".'}
                </p>
                {selectedClientFilter && selectedClientContract && (
                  <Button
                    onClick={() => {
                      setEditingContract(selectedClientContract)
                      setIsFormModalOpen(true)
                    }}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white mt-2 shadow-xs"
                  >
                    <Plus className="h-4 w-4" />
                    Gerar Faturas para {selectedClientFilter}
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600 dark:text-slate-300">
                  <thead className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/60 text-xs font-semibold uppercase text-gray-400 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3.5">Fatura Nº & Mês Ref.</th>
                      <th className="px-4 py-3.5">Cliente / Contratante</th>
                      <th className="px-4 py-3.5">Vencimento</th>
                      <th className="px-4 py-3.5">Valor (R$)</th>
                      <th className="px-4 py-3.5">Situação</th>
                      <th className="px-4 py-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {filteredInvoices.map((inv) => {
                      const eff = getInvoiceEffectiveStatus(inv)
                      const isPaid = eff === 'paid'
                      const isOverdue = eff === 'overdue'

                      return (
                        <tr
                          key={inv.id}
                          className={`hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                            isOverdue ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                          }`}
                        >
                          {/* Fatura Nº & Mês Ref */}
                          <td className="px-4 py-4">
                            <div className="font-mono font-bold text-gray-900 dark:text-white">
                              #{inv.invoiceNumber}
                            </div>
                            <div className="text-xs font-semibold text-purple-700 dark:text-purple-400">
                              Ref: {inv.referenceMonth}
                            </div>
                          </td>

                          {/* Cliente / Contratante */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {inv.clientName}
                              </span>
                              {isOverdue && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 text-[10px] font-extrabold text-rose-800 dark:text-rose-300 border border-rose-300 animate-pulse">
                                  <AlertTriangle className="h-3 w-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                  VENCIDA
                                </span>
                              )}
                            </div>
                            {inv.clientDocument && (
                              <div className="text-xs text-gray-400 dark:text-slate-500">
                                CNPJ/CPF: {inv.clientDocument}
                              </div>
                            )}
                          </td>

                          {/* Vencimento */}
                          <td className="px-4 py-4">
                            <div className={`font-medium ${isOverdue ? 'font-bold text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'}`}>
                              {inv.dueDate.split('-').reverse().join('/')}
                            </div>
                            {isOverdue && (
                              <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                Cobrança em atraso
                              </div>
                            )}
                          </td>

                          {/* Valor */}
                          <td className="px-4 py-4">
                            <div className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                              {formatCurrency(inv.amount.toFixed(2))}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {inv.paymentMethod || 'PIX'}
                            </div>
                          </td>

                          {/* Situação */}
                          <td className="px-4 py-4">
                            {isPaid ? (
                              <div>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                  PAGA
                                </span>
                                {inv.paymentDate && (
                                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 font-medium">
                                    Pago em {inv.paymentDate.split('-').reverse().join('/')}
                                  </div>
                                )}
                              </div>
                            ) : isOverdue ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 dark:bg-rose-950/80 px-2.5 py-1 text-xs font-extrabold text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
                                <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                                NÃO PAGA (Vencida)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Clock className="h-3.5 w-3.5 text-amber-600" />
                                NÃO PAGA (Pendente)
                              </span>
                            )}
                          </td>

                          {/* Ações da Fatura */}
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isPaid ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleToggleInvoicePaid(inv)}
                                  className="gap-1 text-xs text-gray-600 hover:text-gray-900 border-gray-200"
                                  title="Desfazer recebimento / retornar fatura para pendente"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Desfazer
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => void handleToggleInvoicePaid(inv)}
                                  className="gap-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                  title="Registrar recebimento desta mensalidade"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Dar Baixa / Recebido
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setViewingInvoice(inv)
                                  setIsInvoicePrintModalOpen(true)
                                }}
                                className="gap-1 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-900/60"
                                title="Visualizar Fatura / Cobrança para Impressão ou Envio"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                Fatura / Recibo
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleDeleteInvoice(inv)}
                                className="p-2 h-auto text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 dark:border-rose-900/40"
                                title="Excluir Fatura"
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
        </div>
      )}

      {/* Modal de Criação / Edição do Contrato */}
      <ContractFormModal
        isOpen={isFormModalOpen}
        onClose={handleCloseFormModal}
        onSuccess={handleFormSuccess}
        initialContract={editingContract}
        prefillCompany={prefillCompanyForNewContract}
        existingCompanies={existingCompanies}
      />

      {/* Modal de Impressão do Contrato Oficial */}
      <ContractPrintModal
        contract={printingContract}
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false)
          setPrintingContract(null)
        }}
      />

      {/* Modal de Impressão de Fatura Individual */}
      <ContractInvoicePrintModal
        invoice={viewingInvoice}
        contract={contracts.find((c) => c.id === viewingInvoice?.contractId) || null}
        isOpen={isInvoicePrintModalOpen}
        onClose={() => {
          setIsInvoicePrintModalOpen(false)
          setViewingInvoice(null)
        }}
      />
    </div>
  )
}
