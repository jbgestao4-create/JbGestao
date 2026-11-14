import { useState, useEffect } from 'react'
import {
  Building2,
  DollarSign,
  FileSignature,
  Layers,
  Save,
  UserCheck,
  X,
  FileText,
  Clock,
  CheckCircle2,
  Package,
  Receipt,
  AlertTriangle,
  Printer,
  Trash2,
  Plus,
  Zap,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import { ALL_PLATFORM_DASHBOARD_MODULES, companyManagementService } from '../services/company-management.service'
import {
  contractService,
  type SoftwareContract,
  type ContractInvoice,
  getInvoiceEffectiveStatus,
} from '../services/contract.service'
import { accessPlanService, type AccessPlan } from '../services/access-plan.service'
import type { ManagedCompany } from '../services/company-management.service'
import { ContractInvoicePrintModal } from './ContractInvoicePrintModal'

/**
 * Converte códigos de módulos/subfeatures do plano (ex: 'MOD-01', 'MOD-02')
 * para os nomes amigáveis exibidos no contrato (ex: 'Vendas', 'Estoque').
 */
function getModuleNamesFromCodes(codes: string[]): string[] {
  if (!codes || codes.length === 0) return []
  const codeSet = new Set(codes)
  return ALL_PLATFORM_DASHBOARD_MODULES.filter((m) => {
    if (codeSet.has(m.code)) return true
    return m.subFeatures.some((sub) => codeSet.has(sub.code))
  }).map((m) => m.name)
}

const DEFAULT_ACCESS_PLANS: AccessPlan[] = [
  {
    id: 'default-completo',
    name: 'Plano Completo',
    description: 'Todos os módulos disponíveis na plataforma JB Gestão',
    modules: ALL_PLATFORM_DASHBOARD_MODULES.map((m) => m.code),
    isActive: true,
    isSystem: true,
    isLocked: false,
  },
  {
    id: 'default-padrao',
    name: 'Plano Padrão',
    description: 'Vendas, Estoque, Clientes, Caixa, Fornecedores e Relatórios',
    modules: ['MOD-01', 'MOD-02', 'MOD-03', 'MOD-05', 'MOD-06', 'MOD-07', 'MOD-08'],
    isActive: true,
    isSystem: true,
    isLocked: false,
  },
  {
    id: 'default-basico',
    name: 'Plano Básico',
    description: 'Recursos essenciais de Vendas, Estoque, Clientes e Caixa',
    modules: ['MOD-01', 'MOD-02', 'MOD-03', 'MOD-05'],
    isActive: true,
    isSystem: true,
    isLocked: false,
  },
]

interface ContractFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (savedContract: SoftwareContract, printImmediately?: boolean) => void
  initialContract?: SoftwareContract | null
  prefillCompany?: ManagedCompany | null
  existingCompanies?: ManagedCompany[]
}

export function ContractFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialContract,
  prefillCompany,
  existingCompanies = [],
}: ContractFormModalProps) {
  if (!isOpen) return null

  const isEditing = Boolean(initialContract?.id)

  // Seleção rápida de empresa cadastrada
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    initialContract?.companyId || prefillCompany?.id || '',
  )

  // Dados do Contratante (Cliente)
  const [clientName, setClientName] = useState(
    initialContract?.clientName || prefillCompany?.name || '',
  )
  const [clientTradeName, setClientTradeName] = useState(
    initialContract?.clientTradeName || '',
  )
  const [clientDocument, setClientDocument] = useState(
    initialContract?.clientDocument || prefillCompany?.cnpj || '',
  )
  const [clientResponsibleName, setClientResponsibleName] = useState(
    initialContract?.clientResponsibleName || prefillCompany?.responsible || prefillCompany?.adminName || '',
  )
  const [clientResponsibleDocument, setClientResponsibleDocument] = useState(
    initialContract?.clientResponsibleDocument || '',
  )
  const [clientResponsibleRole, setClientResponsibleRole] = useState(
    initialContract?.clientResponsibleRole || 'Sócio / Administrador',
  )
  const [clientEmail, setClientEmail] = useState(
    initialContract?.clientEmail || prefillCompany?.adminEmail || '',
  )
  const [clientPhone, setClientPhone] = useState(
    initialContract?.clientPhone || '',
  )
  const [clientAddress, setClientAddress] = useState(
    initialContract?.clientAddress || prefillCompany?.address || '',
  )

  // Condições do Contrato e Aluguel Mensal
  const [contractNumber, setContractNumber] = useState(
    initialContract?.contractNumber || contractService.generateContractNumber(),
  )
  const [planName, setPlanName] = useState(
    initialContract?.planName || prefillCompany?.accessPlanName || 'Plano Completo',
  )
  const [monthlyAmount, setMonthlyAmount] = useState<string>(
    initialContract ? String(initialContract.monthlyAmount) : '150.00',
  )
  const [setupFee, setSetupFee] = useState<string>(
    initialContract?.setupFee ? String(initialContract.setupFee) : '0.00',
  )
  const [billingDay, setBillingDay] = useState<number>(
    initialContract?.billingDay || 10,
  )
  const [paymentMethod, setPaymentMethod] = useState(
    initialContract?.paymentMethod || 'PIX / Boleto Bancário',
  )
  const [startDate, setStartDate] = useState(
    initialContract?.startDate || new Date().toISOString().split('T')[0],
  )
  const [durationMonths, setDurationMonths] = useState<number>(
    initialContract ? initialContract.durationMonths : 12,
  )
  const [hasTrialPeriod, setHasTrialPeriod] = useState<boolean>(
    initialContract?.hasTrialPeriod ?? false,
  )
  const [isSigned, setIsSigned] = useState<boolean>(
    initialContract?.isSigned ?? false,
  )
  const [status, setStatus] = useState<SoftwareContract['status']>(
    initialContract?.status || 'active',
  )

  // Módulos Inclusos
  const [includedModules, setIncludedModules] = useState<string[]>(() => {
    if (initialContract?.includedModules && initialContract.includedModules.length > 0) {
      return initialContract.includedModules
    }
    if (prefillCompany?.modules && prefillCompany.modules.length > 0) {
      const mapped = getModuleNamesFromCodes(prefillCompany.modules)
      if (mapped.length > 0) return mapped
    }
    return ALL_PLATFORM_DASHBOARD_MODULES.map((m) => m.name)
  })

  // Planos cadastrados em Empresas Cadastradas
  const [availablePlans, setAvailablePlans] = useState<AccessPlan[]>(DEFAULT_ACCESS_PLANS)

  // Carrega os planos cadastrados via accessPlanService
  useEffect(() => {
    let isMounted = true
    async function loadPlans() {
      try {
        const res = await accessPlanService.list()
        if (isMounted && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setAvailablePlans(res.data)
        }
      } catch {
        // Mantém planos padrão caso offline
      }
    }
    void loadPlans()
    return () => {
      isMounted = false
    }
  }, [])

  // Observações e Cláusulas personalizadas
  const [customTerms, setCustomTerms] = useState(
    initialContract?.customTerms || '',
  )

  // Gerador de Faturas do Contrato
  const [contractInvoices, setContractInvoices] = useState<ContractInvoice[]>([])
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false)
  const [invRefMonth, setInvRefMonth] = useState(() => {
    const d = new Date()
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  })
  const [invAmount, setInvAmount] = useState(monthlyAmount)
  const [invDueDate, setInvDueDate] = useState(() => {
    const d = new Date()
    const day = String(Math.min(billingDay || 10, 28)).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${d.getFullYear()}-${mm}-${day}`
  })
  const [viewingInvoice, setViewingInvoice] = useState<ContractInvoice | null>(null)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const [invoiceFeedback, setInvoiceFeedback] = useState<string | null>(null)

  const loadContractInvoices = async () => {
    if (!initialContract?.id) return
    setIsLoadingInvoices(true)
    const res = await contractService.listInvoices(initialContract.id)
    if (res.success && res.data) {
      setContractInvoices(res.data)
    }
    setIsLoadingInvoices(false)
  }

  useEffect(() => {
    if (initialContract?.id) {
      void loadContractInvoices()
    }
  }, [initialContract?.id])

  // Mantém os campos da nova fatura sincronizados com a mensalidade e vencimento do contrato
  useEffect(() => {
    setInvAmount(monthlyAmount)
  }, [monthlyAmount])

  useEffect(() => {
    const parts = invRefMonth.split('/')
    if (parts.length === 2) {
      const mm = parts[0].padStart(2, '0')
      const yyyy = parts[1]
      const day = String(Math.min(billingDay || 10, 28)).padStart(2, '0')
      setInvDueDate(`${yyyy}-${mm}-${day}`)
    }
  }, [billingDay, invRefMonth])

  const handleCreateSingleInvoice = async () => {
    if (!initialContract?.id) return
    const num = parseFloat(invAmount.replace(',', '.'))
    if (isNaN(num) || num <= 0) {
      setInvoiceFeedback('Informe um valor de mensalidade válido para a fatura.')
      return
    }

    const seq = contractInvoices.length + 1
    const invNumber = contractService.generateInvoiceNumber(contractNumber, seq)

    const res = await contractService.saveInvoice({
      contractId: initialContract.id,
      companyId: selectedCompanyId || null,
      invoiceNumber: invNumber,
      clientName: clientName.trim(),
      clientDocument: clientDocument.trim() || undefined,
      referenceMonth: invRefMonth.trim(),
      amount: num,
      dueDate: invDueDate,
      paymentMethod,
      status: 'pending',
      notes: `Mensalidade referente ao aluguel de software - ${planName}`,
    })

    if (res.success) {
      setInvoiceFeedback(`Fatura #${invNumber} gerada com sucesso!`)
      setTimeout(() => setInvoiceFeedback(null), 3000)
      void loadContractInvoices()
    }
  }

  const handleGenerateCarnet = async (months = 6) => {
    if (!initialContract?.id) return
    const targetContract: SoftwareContract = {
      ...initialContract,
      id: initialContract.id,
      contractNumber,
      clientName,
      clientDocument,
      monthlyAmount: parseFloat(monthlyAmount.replace(',', '.')) || 0,
      billingDay,
      paymentMethod,
      planName,
    }
    const res = await contractService.generateInvoicesBatch(targetContract, months)
    if (res.success && res.data) {
      setInvoiceFeedback(`${res.data.length} faturas geradas com sucesso!`)
      setTimeout(() => setInvoiceFeedback(null), 3500)
      void loadContractInvoices()
    }
  }

  const handleToggleInvoicePaid = async (inv: ContractInvoice) => {
    if (inv.status === 'paid') {
      await contractService.undoInvoicePayment(inv.id)
    } else {
      await contractService.markInvoiceAsPaid(inv.id, inv.paymentMethod || 'PIX')
    }
    void loadContractInvoices()
  }

  const handleDeleteInvoice = async (invId: string) => {
    if (!window.confirm('Deseja realmente excluir esta fatura?')) return
    await contractService.deleteInvoice(invId)
    void loadContractInvoices()
  }

  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Efeito ao trocar a empresa no select rápido
  const handleSelectCompany = (compSlugOrId: string) => {
    setSelectedCompanyId(compSlugOrId)
    const found = existingCompanies.find((c) => c.id === compSlugOrId)
    if (found) {
      setClientName(found.name)
      if (found.cnpj) setClientDocument(found.cnpj)
      if (found.responsible || found.adminName) {
        setClientResponsibleName(found.responsible || found.adminName)
      }
      if (found.adminEmail) setClientEmail(found.adminEmail)
      if (found.address) setClientAddress(found.address)
      if (found.accessPlanName) setPlanName(found.accessPlanName)
      if (found.modules && found.modules.length > 0) {
        const mapped = getModuleNamesFromCodes(found.modules)
        if (mapped.length > 0) {
          setIncludedModules(mapped)
        }
      }
    }
  }

  const handleSubmit = async (printImmediately = false) => {
    setErrorMsg('')
    if (!clientName.trim()) {
      setErrorMsg('Informe a Razão Social ou Nome do Cliente / Contratante.')
      return
    }
    if (!clientResponsibleName.trim()) {
      setErrorMsg('Informe o Nome do Responsável pelo contrato.')
      return
    }

    const numMonthly = parseFloat(monthlyAmount.replace(',', '.'))
    if (isNaN(numMonthly) || numMonthly < 0) {
      setErrorMsg('Informe um valor de mensalidade válido.')
      return
    }

    setIsSaving(true)

    try {
      let trialEndsAt: string | null = null
      if (hasTrialPeriod) {
        const start = startDate ? new Date(startDate) : new Date()
        const end = new Date(start)
        end.setMonth(end.getMonth() + 1)
        trialEndsAt = end.toISOString()
      }

      const payload: Partial<SoftwareContract> = {
        id: initialContract?.id,
        companyId: selectedCompanyId || null,
        contractNumber: contractNumber.trim() || contractService.generateContractNumber(),
        clientName: clientName.trim(),
        clientTradeName: clientTradeName.trim() || null,
        clientDocument: clientDocument.trim() || 'Não informado',
        clientResponsibleName: clientResponsibleName.trim(),
        clientResponsibleDocument: clientResponsibleDocument.trim() || null,
        clientResponsibleRole: clientResponsibleRole.trim() || null,
        clientEmail: clientEmail.trim() || null,
        clientPhone: clientPhone.trim() || null,
        clientAddress: clientAddress.trim() || null,
        planName: planName.trim(),
        monthlyAmount: numMonthly,
        setupFee: parseFloat(setupFee.replace(',', '.')) || 0,
        billingDay: Number(billingDay) || 10,
        paymentMethod: paymentMethod.trim(),
        startDate,
        durationMonths: Number(durationMonths) || 12,
        hasTrialPeriod,
        trialDurationMonths: hasTrialPeriod ? 1 : undefined,
        trialEndsAt,
        isSigned,
        signedAt: isSigned ? (initialContract?.signedAt || new Date().toISOString()) : null,
        status,
        includedModules,
        customTerms: customTerms.trim() || null,
      }

      const res = await contractService.saveContract(payload)
      if (res.success && res.data) {
        if (selectedCompanyId) {
          try {
            await companyManagementService.setTrialPeriod(selectedCompanyId, hasTrialPeriod ? trialEndsAt : null)
          } catch {
            // non-blocking
          }
        }

        if (!isEditing) {
          try {
            await contractService.ensureInitialInvoice(res.data)
          } catch {
            // non-blocking
          }
        }
        onSuccess(res.data, printImmediately)
        onClose()
      } else {
        setErrorMsg('Erro ao salvar o contrato. Tente novamente.')
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro inesperado ao salvar contrato.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
        
        {/* Topo do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/60 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {isEditing ? `Editar Contrato #${contractNumber}` : 'Gerar Novo Contrato de Aluguel de Software'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Preencha os dados do cliente, responsável, mensalidade e vigência para gerar o contrato
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formulário com Scroll */}
        <div className="overflow-y-auto p-6 space-y-6 text-sm">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Vínculo ou Seleção de Empresa */}
          {existingCompanies.length > 0 && (
            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 space-y-2">
              <label className="text-xs font-bold text-blue-950 dark:text-blue-200 uppercase tracking-wide flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-blue-600" />
                Vincular a uma Empresa Cadastrada (Opcional)
              </label>
              <select
                value={selectedCompanyId}
                onChange={(e) => handleSelectCompany(e.target.value)}
                className="w-full rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Contrato Avulso / Futuro Cliente Não Cadastrado --</option>
                {existingCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.cnpj ? `(${c.cnpj})` : ''} - Resp: {c.responsible || c.adminName}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-blue-800/80 dark:text-blue-300">
                Ao selecionar uma empresa, os campos do contratante abaixo serão preenchidos automaticamente. Você também pode digitar manualmente para qualquer futuro cliente.
              </p>
            </div>
          )}

          {/* Seção 1: Dados do Cliente / Contratante */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 dark:text-slate-400 flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-blue-600" />
              1. Dados do Cliente / Contratante (Licenciatária)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Razão Social ou Nome do Cliente *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Auto Peças & Mecânica Silva Ltda"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Nome Fantasia (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mecânica Silva"
                  value={clientTradeName}
                  onChange={(e) => setClientTradeName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  CNPJ ou CPF do Cliente
                </label>
                <input
                  type="text"
                  placeholder="Ex: 00.000.000/0001-00 ou CPF"
                  value={clientDocument}
                  onChange={(e) => setClientDocument(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Endereço Completo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Av. Principal, 1000 - Centro, Cidade - UF"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  E-mail de Contato
                </label>
                <input
                  type="email"
                  placeholder="Ex: contato@empresa.com.br"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="Ex: (11) 99999-9999"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Responsável pelo Contrato */}
          <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-slate-800">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 dark:text-slate-400 flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-emerald-600" />
              2. Responsável pelo Contrato
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Nome do Responsável *
                </label>
                <input
                  type="text"
                  placeholder="Ex: João da Silva"
                  value={clientResponsibleName}
                  onChange={(e) => setClientResponsibleName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  CPF do Responsável (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 000.000.000-00"
                  value={clientResponsibleDocument}
                  onChange={(e) => setClientResponsibleDocument(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Cargo / Função
                </label>
                <input
                  type="text"
                  placeholder="Ex: Diretor / Proprietário"
                  value={clientResponsibleRole}
                  onChange={(e) => setClientResponsibleRole(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Informações do Aluguel Mensal e Condições Financeiras */}
          <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-slate-800">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 dark:text-slate-400 flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              3. Informações da Mensalidade e Aluguel do Sistema
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Valor da Mensalidade (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400">R$</span>
                  <input
                    type="text"
                    placeholder="150,00"
                    value={monthlyAmount}
                    onChange={(e) => setMonthlyAmount(e.target.value)}
                    className="w-full rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 pl-9 pr-3 py-2 text-sm font-bold text-emerald-900 dark:text-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Dia de Vencimento Mensal
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400">Dia</span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={billingDay}
                    onChange={(e) => setBillingDay(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-11 pr-3 py-2 text-sm font-bold text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Taxa de Adesão / Implantação
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400">R$</span>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={setupFee}
                    onChange={(e) => setSetupFee(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Forma de Pagamento
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="PIX / Boleto Bancário">PIX / Boleto Bancário</option>
                  <option value="Chave PIX Mensal">Chave PIX Mensal</option>
                  <option value="Boleto Bancário">Boleto Bancário</option>
                  <option value="Cartão de Crédito">Cartão de Crédito Recorrente</option>
                  <option value="Transferência Bancária">Transferência Bancária</option>
                </select>
              </div>
            </div>

            {/* Opção de Período de Teste Gratuito de 1 Mês */}
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/40 dark:from-emerald-950/30 dark:via-slate-800 dark:to-emerald-950/20 p-3.5 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasTrialPeriod}
                  onChange={(e) => setHasTrialPeriod(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-emerald-300 dark:border-emerald-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Período de Teste Gratuito de 1 Mês
                    </span>
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                      1º Mês Isento de Mensalidade
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
                    O sistema <strong>não cobrará a mensalidade</strong> durante o 1º mês. O cliente usufruirá de 30 dias de uso completo gratuito sem geração de custos.
                  </p>
                </div>
              </label>

              {hasTrialPeriod && (
                <div className="ml-7 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/50 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Gratuidade ativada para o 1º mês:</strong> A mensalidade normal ({monthlyAmount ? `R$ ${monthlyAmount}` : 'R$ 0,00'}/mês) não será cobrada no primeiro mês. A primeira cobrança financeira só começará após o encerramento dos 30 dias de teste.
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Nº do Contrato
                </label>
                <input
                  type="text"
                  placeholder="Ex: CTR-2026-0001"
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono font-bold text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Data do Contrato (Início)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Vigência / Duração
                </label>
                <select
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value={12}>12 meses (1 ano)</option>
                  <option value={6}>6 meses</option>
                  <option value={24}>24 meses (2 anos)</option>
                  <option value={0}>Indeterminado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Nome do Plano
                </label>
                <input
                  type="text"
                  list="contract-plan-options"
                  placeholder="Ex: Plano Padrão / Completo"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
                <datalist id="contract-plan-options">
                  {availablePlans.map((p) => {
                    const count = getModuleNamesFromCodes(p.modules).length || ALL_PLATFORM_DASHBOARD_MODULES.length
                    return (
                      <option key={p.id} value={p.name}>
                        {p.name} ({count} {count === 1 ? 'módulo' : 'módulos'})
                      </option>
                    )
                  })}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Status do Contrato
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white font-semibold"
                >
                  <option value="active">Ativo (Em vigor)</option>
                  <option value="draft">Rascunho (Proposta)</option>
                  <option value="suspended">Suspenso</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            </div>

            {/* Opção de Assinatura do Contrato */}
            <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40 p-3.5">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isSigned}
                  onChange={(e) => setIsSigned(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <FileSignature className="h-4 w-4 text-purple-600" />
                      Contrato Já Assinado pelo Cliente
                    </span>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      Indica que o cliente contratante já assinou formalmente o termo contratual (físico ou eletrônico).
                    </p>
                  </div>
                  {isSigned && (
                    <span className="self-start sm:self-center rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Assinado
                    </span>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Seção 4: Plano de Acesso do Software Contratado */}
          <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-slate-800">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              4. Plano de Acesso do Software Contratado
            </h3>

            {/* Apenas mostra qual plano foi adicionado ao usuário */}
            <div className="p-4 rounded-xl bg-purple-50/60 dark:bg-purple-950/25 border border-purple-200/80 dark:border-purple-900/50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 block uppercase tracking-wider">
                      Plano Vinculado à Empresa / Usuário
                    </span>
                    <h4 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                      {planName || 'Plano Completo'}
                    </h4>
                  </div>
                </div>

                <span className="self-start sm:self-center inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/70 px-3 py-1 text-xs font-bold text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800">
                  {includedModules.length} {includedModules.length === 1 ? 'módulo ativo' : 'módulos ativos'}
                </span>
              </div>

              {/* Módulos do Plano Selecionado (Exibição Informativa) */}
              <div className="pt-2.5 border-t border-purple-200/60 dark:border-purple-900/40">
                <span className="text-xs font-bold text-purple-950 dark:text-purple-200 block mb-2">
                  Módulos incluídos neste plano:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {includedModules.length > 0 ? (
                    includedModules.map((modName) => (
                      <span
                        key={modName}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-2xs"
                      >
                        ✓ {modName}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 italic">
                      Todos os módulos da plataforma habilitados.
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80 mt-2.5">
                  💡 Os módulos e configurações de cada plano são gerenciados centralmente em <strong>Cadastro de Planos</strong> em Empresas Cadastradas.
                </p>
              </div>
            </div>
          </div>

          {/* Seção 5: Observações e Cláusulas Especiais */}
          <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-800">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 dark:text-slate-400 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-amber-600" />
              5. Observações Especiais ou Cláusulas Adicionais (Opcional)
            </h3>
            <textarea
              rows={3}
              placeholder="Ex: Treinamento presencial incluso; Desconto de 10% nos primeiros 3 meses; Backup em nuvem com retenção de 1 ano; etc."
              value={customTerms}
              onChange={(e) => setCustomTerms(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-gray-900 dark:text-white"
            />
          </div>

          {/* Seção 6: Gerador de Faturas e Mensalidades do Contrato */}
          <div className="space-y-4 pt-3 border-t border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Receipt className="h-4 w-4" />
                6. Gerador de Faturas & Mensalidades do Contrato
              </h3>
              {isEditing && (
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                  {contractInvoices.length} {contractInvoices.length === 1 ? 'fatura gerada' : 'faturas geradas'}
                </span>
              )}
            </div>

            {invoiceFeedback && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{invoiceFeedback}</span>
              </div>
            )}

            {isEditing ? (
              <div className="space-y-4">
                {/* Painel do Gerador Rápido */}
                <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-emerald-600" />
                      Emitir Nova Mensalidade / Cobrança:
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleGenerateCarnet(6)}
                      className="gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:text-emerald-300 dark:border-emerald-800 font-bold"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      Gerar Carnê (Próximos 6 Meses)
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-400 mb-1">
                        Mês Ref. (MM/AAAA)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 12/2026"
                        value={invRefMonth}
                        onChange={(e) => setInvRefMonth(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-400 mb-1">
                        Data de Vencimento
                      </label>
                      <input
                        type="date"
                        value={invDueDate}
                        onChange={(e) => setInvDueDate(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-400 mb-1">
                        Valor da Fatura (R$)
                      </label>
                      <input
                        type="text"
                        value={invAmount}
                        onChange={(e) => setInvAmount(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400"
                      />
                    </div>

                    <div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleCreateSingleInvoice()}
                        className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Gerar Fatura Deste Mês
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Tabela de Faturas do Contrato */}
                {isLoadingInvoices ? (
                  <div className="py-6 text-center text-xs text-gray-400">Carregando faturas...</div>
                ) : contractInvoices.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-slate-800 text-center text-xs text-gray-400">
                    Nenhuma fatura gerada para este contrato ainda. Utilize o gerador acima para criar a primeira fatura ou gerar o carnê dos próximos meses.
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 dark:bg-slate-800/80 font-semibold text-gray-500 dark:text-slate-400 uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5">Fatura Nº</th>
                          <th className="p-2.5">Mês Ref.</th>
                          <th className="p-2.5">Vencimento</th>
                          <th className="p-2.5">Valor</th>
                          <th className="p-2.5">Situação</th>
                          <th className="p-2.5 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {contractInvoices.map((inv) => {
                          const effStatus = getInvoiceEffectiveStatus(inv)
                          const isPaid = effStatus === 'paid'
                          const isOverdue = effStatus === 'overdue'

                          return (
                            <tr key={inv.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40">
                              <td className="p-2.5 font-mono font-bold text-gray-900 dark:text-white">
                                #{inv.invoiceNumber}
                              </td>
                              <td className="p-2.5 font-medium">{inv.referenceMonth}</td>
                              <td className="p-2.5">
                                <span className={isOverdue ? 'font-bold text-rose-600 dark:text-rose-400' : ''}>
                                  {inv.dueDate.split('-').reverse().join('/')}
                                </span>
                              </td>
                              <td className="p-2.5 font-bold text-emerald-700 dark:text-emerald-400">
                                {formatCurrency(inv.amount.toFixed(2))}
                              </td>
                              <td className="p-2.5">
                                {isPaid ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Pago ({inv.paymentDate?.split('-').reverse().slice(0, 2).join('/') || 'OK'})
                                  </span>
                                ) : isOverdue ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 animate-pulse border border-rose-300">
                                    <AlertTriangle className="h-3 w-3" />
                                    Vencida
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                                    Pendente
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void handleToggleInvoicePaid(inv)}
                                    className={`px-2 py-1 h-auto text-[11px] font-bold ${
                                      isPaid
                                        ? 'text-gray-600 hover:text-gray-800 border-gray-200'
                                        : 'text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-300'
                                    }`}
                                    title={isPaid ? 'Desfazer baixa de pagamento' : 'Registrar pagamento recebido'}
                                  >
                                    {isPaid ? 'Desfazer' : 'Dar Baixa / Pago'}
                                  </Button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewingInvoice(inv)
                                      setIsInvoiceModalOpen(true)
                                    }}
                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg"
                                    title="Visualizar e Imprimir Fatura"
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteInvoice(inv.id)}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg"
                                    title="Excluir Fatura"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
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
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 flex items-start gap-3">
                <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-gray-700 dark:text-slate-300">
                  <span className="font-bold block text-emerald-950 dark:text-emerald-200 mb-0.5">
                    Renovação Automática de Faturas (3 dias antes do vencimento)
                  </span>
                  Ao salvar o contrato, a primeira fatura será criada automaticamente. Sempre que faltarem 3 dias para o vencimento da fatura ativa, o sistema gerará a fatura do próximo ciclo no mesmo valor da anterior de forma 100% automatizada.
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Rodapé com Ações */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/60 rounded-b-2xl">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSubmit(true)}
              isLoading={isSaving}
              className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-400"
            >
              <FileSignature className="h-4 w-4" />
              Salvar e Visualizar/Imprimir
            </Button>

            <Button
              type="button"
              onClick={() => void handleSubmit(false)}
              isLoading={isSaving}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Save className="h-4 w-4" />
              Salvar Contrato
            </Button>
          </div>
        </div>

      </div>

      {/* Modal de Impressão da Fatura */}
      <ContractInvoicePrintModal
        invoice={viewingInvoice}
        contract={initialContract}
        isOpen={isInvoiceModalOpen}
        onClose={() => {
          setIsInvoiceModalOpen(false)
          setViewingInvoice(null)
        }}
      />
    </div>
  )
}
