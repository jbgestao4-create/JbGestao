import { useState } from 'react'
import {
  Building2,
  DollarSign,
  FileSignature,
  Layers,
  Save,
  UserCheck,
  X,
  FileText,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { ALL_PLATFORM_DASHBOARD_MODULES } from '../services/company-management.service'
import { contractService, type SoftwareContract } from '../services/contract.service'
import type { ManagedCompany } from '../services/company-management.service'

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
    initialContract?.planName || 'Plano Completo JB Gestão',
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
  const [status, setStatus] = useState<SoftwareContract['status']>(
    initialContract?.status || 'active',
  )

  // Módulos Inclusos
  const [includedModules, setIncludedModules] = useState<string[]>(
    initialContract?.includedModules || ALL_PLATFORM_DASHBOARD_MODULES.map((m) => m.name),
  )

  // Observações e Cláusulas personalizadas
  const [customTerms, setCustomTerms] = useState(
    initialContract?.customTerms || '',
  )

  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Efeito ao trocar a empresa no select rápido
  const handleSelectCompany = (compSlugOrId: string) => {
    setSelectedCompanyId(compSlugOrId)
    const found = existingCompanies.find((c) => c.id === compSlugOrId)
    if (found) {
      setClientName(found.name)
      if (found.cnpj) setClientDocument(found.cnpj)
      if (found.adminName) setClientResponsibleName(found.responsible || found.adminName)
      if (found.adminEmail) setClientEmail(found.adminEmail)
      if (found.address) setClientAddress(found.address)
      if (found.accessPlanName) setPlanName(found.accessPlanName)
    }
  }

  const toggleModule = (modLabel: string) => {
    setIncludedModules((prev) =>
      prev.includes(modLabel) ? prev.filter((m) => m !== modLabel) : [...prev, modLabel],
    )
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
        status,
        includedModules,
        customTerms: customTerms.trim() || null,
      }

      const res = await contractService.saveContract(payload)
      if (res.success && res.data) {
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
                  placeholder="Ex: Plano Padrão / Completo"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
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
          </div>

          {/* Seção 4: Módulos Inclusos na Licença */}
          <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 dark:text-slate-400 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-purple-600" />
                4. Módulos Inclusos no Pacote de Software
              </h3>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIncludedModules(ALL_PLATFORM_DASHBOARD_MODULES.map((m) => m.name))}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Marcar Todos
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setIncludedModules([])}
                  className="text-gray-500 hover:underline dark:text-slate-400"
                >
                  Desmarcar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_PLATFORM_DASHBOARD_MODULES.map((mod) => {
                const isChecked = includedModules.includes(mod.name)
                return (
                  <button
                    key={mod.code}
                    type="button"
                    onClick={() => toggleModule(mod.name)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs transition-all ${
                      isChecked
                        ? 'border-blue-500 bg-blue-50/70 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200 font-semibold'
                        : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="rounded border-gray-300 text-blue-600 pointer-events-none"
                    />
                    <span className="truncate">{mod.name}</span>
                  </button>
                )
              })}
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
    </div>
  )
}
