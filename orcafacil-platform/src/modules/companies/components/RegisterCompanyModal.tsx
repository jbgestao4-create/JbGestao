import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Building2,
  Calendar,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  ShieldAlert,
  Check,
  UserCheck,
  X,
  Layers,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { formatCurrency } from '@shared/utils/monetary'
import { formatPhoneNumber } from '@shared/utils/phone'
import {
  validateCnpj,
  validateCpf,
  formatCustomerDocument,
  sanitizeCustomerDocument,
  CNPJ_INVALID_ERROR,
  CPF_INVALID_ERROR,
} from '@modules/customers/utils/customer-document'
import {
  formatPostalAddress,
  formatPostalCode,
  lookupPostalAddress,
} from '@modules/customers/utils/postal-code'
import { companyManagementService } from '../services/company-management.service'
import { accessPlanService, type AccessPlan } from '../services/access-plan.service'
import { contractService } from '../services/contract.service'
import { planTermsService } from '@shared/services/plan-terms.service'

interface RegisterCompanyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function RegisterCompanyModal({ isOpen, onClose, onSuccess }: RegisterCompanyModalProps) {
  // 1. Dados da Empresa
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [cnpjError, setCnpjError] = useState('')
  const [cnpjSuccess, setCnpjSuccess] = useState('')
  const [responsible, setResponsible] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [skipPostalCode, setSkipPostalCode] = useState(false)
  const [postalCodeError, setPostalCodeError] = useState('')
  const [isLookingUpPostalCode, setIsLookingUpPostalCode] = useState(false)
  const postalLookupController = useRef<AbortController | null>(null)
  const [address, setAddress] = useState('')
  const [addressNumber, setAddressNumber] = useState('')
  const [notes, setNotes] = useState('')

  // 2. Administrador
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPhone, setAdminPhone] = useState('')
  const [isAdminNameManuallyEdited, setIsAdminNameManuallyEdited] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // 3. Planos Cadastrados
  const [accessPlans, setAccessPlans] = useState<AccessPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [isLoadingPlans, setIsLoadingPlans] = useState(false)

  // 4. Responsável pelo Contrato & Mensalidade
  const [contractResponsibleName, setContractResponsibleName] = useState('')
  const [contractResponsibleCpf, setContractResponsibleCpf] = useState('')
  const [contractResponsibleCpfError, setContractResponsibleCpfError] = useState('')
  const [contractResponsibleRole, setContractResponsibleRole] = useState('Sócio / Administrador')
  const [billingDay, setBillingDay] = useState<number>(10)
  const [setupFee, setSetupFee] = useState<string>('0.00')
  const [paymentMethod, setPaymentMethod] = useState<string>('PIX / Boleto Bancário')
  const [hasTrialPeriod, setHasTrialPeriod] = useState<boolean>(true)
  const [contractNotes, setContractNotes] = useState<string>('')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Garante que todos os campos venham completamente limpos e resetados ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      setName('')
      setSlug('')
      setCnpj('')
      setCnpjError('')
      setCnpjSuccess('')
      setResponsible('')
      setPostalCode('')
      setSkipPostalCode(false)
      setPostalCodeError('')
      setIsLookingUpPostalCode(false)
      postalLookupController.current?.abort()
      setAddress('')
      setAddressNumber('')
      setNotes('')
      setAdminName('')
      setAdminEmail('')
      setAdminPhone('')
      setIsAdminNameManuallyEdited(false)
      setAdminPassword('')
      setShowPassword(false)
      setSelectedPlanId('')
      setContractResponsibleName('')
      setContractResponsibleCpf('')
      setContractResponsibleCpfError('')
      setContractResponsibleRole('Sócio / Administrador')
      setBillingDay(10)
      setSetupFee('0.00')
      setPaymentMethod('PIX / Boleto Bancário')
      setHasTrialPeriod(true)
      setContractNotes('')
      setError(null)
      setIsLoading(false)

      setIsLoadingPlans(true)
      void accessPlanService.list().then((res) => {
        if (res.success && res.data.length > 0) {
          setAccessPlans(res.data)
          setSelectedPlanId(res.data[0].id)
        } else {
          setAccessPlans([])
        }
        setIsLoadingPlans(false)
      })
    }
  }, [isOpen])

  if (!isOpen) return null

  const generateSlugFromName = (val: string) => {
    return val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleNameChange = (val: string) => {
    setName(val)
    const generatedSlug = generateSlugFromName(val)
    setSlug(generatedSlug)
  }

  const handleSlugChange = (val: string) => {
    const cleanSlug = val.toLowerCase().replace(/\s+/g, '-')
    setSlug(cleanSlug)
  }

  const handleResponsibleChange = (val: string) => {
    setResponsible(val)
    // Se o usuário ainda não editou manualmente o nome do administrador, preenche com o responsável
    if (!isAdminNameManuallyEdited) {
      setAdminName(val)
    }
  }

  const handleCnpjChange = (val: string) => {
    const formatted = formatCustomerDocument(val, 'company')
    setCnpj(formatted)
    const clean = sanitizeCustomerDocument(formatted, 'company')

    if (clean.length === 0) {
      setCnpjError('')
      setCnpjSuccess('')
      return
    }

    if (clean.length === 14) {
      const result = validateCnpj(clean)
      if (result.isValid) {
        setCnpjError('')
        setCnpjSuccess('✓ CNPJ válido')
      } else {
        setCnpjError(result.error ?? CNPJ_INVALID_ERROR)
        setCnpjSuccess('')
      }
    } else {
      setCnpjError('')
      setCnpjSuccess('')
    }
  }

  const handleCnpjBlur = () => {
    const clean = sanitizeCustomerDocument(cnpj, 'company')
    if (!clean) {
      setCnpjError('')
      setCnpjSuccess('')
      return
    }

    if (clean.length < 14) {
      setCnpjError('Informe o CNPJ completo com 14 caracteres.')
      setCnpjSuccess('')
      return
    }

    const result = validateCnpj(clean)
    if (!result.isValid) {
      setCnpjError(result.error ?? CNPJ_INVALID_ERROR)
      setCnpjSuccess('')
    } else {
      setCnpjError('')
      setCnpjSuccess('✓ CNPJ válido')
    }
  }

  const handlePostalCodeChange = (value: string) => {
    const formattedPostalCode = formatPostalCode(value)
    const digits = formattedPostalCode.replace(/\D/g, '')
    setPostalCode(formattedPostalCode)
    setPostalCodeError('')
    postalLookupController.current?.abort()

    if (digits.length !== 8) {
      setIsLookingUpPostalCode(false)
      return
    }

    const controller = new AbortController()
    postalLookupController.current = controller
    setIsLookingUpPostalCode(true)
    void lookupPostalAddress(digits, controller.signal)
      .then((result) => {
        setAddress(formatPostalAddress(result))
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setPostalCodeError(
          err instanceof Error
            ? err.message
            : 'Não foi possível consultar o CEP. Preencha o endereço manualmente.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLookingUpPostalCode(false)
      })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (name.trim().length < 2) {
      setError('O nome da empresa deve ter pelo menos 2 caracteres.')
      return
    }

    if (!slug.trim()) {
      setError('O identificador único (slug) é obrigatório.')
      return
    }

    const cleanCnpj = sanitizeCustomerDocument(cnpj, 'company')
    if (cleanCnpj) {
      if (cleanCnpj.length !== 14) {
        setError('Informe o CNPJ completo com 14 caracteres ou deixe em branco.')
        return
      }
      const val = validateCnpj(cleanCnpj)
      if (!val.isValid) {
        setError(val.error ?? CNPJ_INVALID_ERROR)
        return
      }
    }

    if (adminName.trim().length < 2) {
      setError('Informe o nome completo do administrador.')
      return
    }

    if (!adminEmail.trim()) {
      setError('Informe o e-mail do administrador.')
      return
    }

    if (adminPassword.trim().length < 6) {
      setError('A senha deve conter no mínimo 6 caracteres.')
      return
    }

    const selectedPlan = accessPlans.find((p) => p.id === selectedPlanId)
    if (accessPlans.length > 0 && !selectedPlan) {
      setError('Selecione um plano cadastrado para esta empresa.')
      return
    }

    if (contractResponsibleCpf.trim()) {
      const cpfValidation = validateCpf(contractResponsibleCpf)
      if (!cpfValidation.isValid) {
        const msg = cpfValidation.error ?? CPF_INVALID_ERROR
        setContractResponsibleCpfError(msg)
        setError(`CPF do responsável pelo contrato inválido: ${msg}`)
        return
      }
    }

    const parsedBillingDay = Math.min(Math.max(Number(billingDay) || 10, 1), 28)
    const parsedSetupFee = Math.max(parseFloat(setupFee) || 0, 0)

    setIsLoading(true)
    const res = await companyManagementService.registerCompanyWithAdmin({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      cnpj: cleanCnpj,
      address: address.trim(),
      postalCode: postalCode.trim(),
      addressNumber: addressNumber.trim(),
      responsible: responsible.trim(),
      notes: notes.trim(),
      adminName: adminName.trim(),
      adminEmail: adminEmail.trim(),
      adminPhone: adminPhone.trim(),
      adminPassword: adminPassword.trim(),
      modules: selectedPlan ? selectedPlan.modules : [],
    })

    if (res.success && res.data?.organizationId) {
      const trialEndDate = new Date()
      trialEndDate.setDate(trialEndDate.getDate() + 30)
      const trialEndsAtIso = hasTrialPeriod ? trialEndDate.toISOString() : null

      try {
        await companyManagementService.setTrialPeriod(res.data.organizationId, trialEndsAtIso)
      } catch {
        // non-blocking
      }

      if (selectedPlan) {
        await accessPlanService.assignToCompany(res.data.organizationId, selectedPlan)
        try {
          const planTerm = await planTermsService.getTermForPlan(selectedPlan.id)
          const combinedTerms = contractNotes.trim()
            ? `${planTerm.content ? planTerm.content + '\n\n' : ''}OBSERVAÇÕES DO CONTRATO:\n${contractNotes.trim()}`
            : planTerm.content

          const contractRes = await contractService.saveContract({
            companyId: res.data.organizationId,
            contractNumber: contractService.generateContractNumber(),
            clientName: name.trim(),
            clientTradeName: name.trim(),
            clientDocument: cnpj.trim() || 'Documento em cadastro',
            clientResponsibleName:
              contractResponsibleName.trim() || responsible.trim() || adminName.trim(),
            clientResponsibleDocument: contractResponsibleCpf.trim() || null,
            clientResponsibleRole:
              contractResponsibleRole.trim() || 'Administrador / Responsável',
            clientEmail: adminEmail.trim(),
            clientPhone: adminPhone.trim() || null,
            planName: selectedPlan.name,
            monthlyAmount: selectedPlan.monthlyPrice || 0,
            setupFee: parsedSetupFee,
            billingDay: parsedBillingDay,
            paymentMethod: paymentMethod || 'PIX / Boleto Bancário',
            startDate: new Date().toISOString().split('T')[0],
            durationMonths: 12,
            hasTrialPeriod,
            trialDurationMonths: hasTrialPeriod ? 1 : 0,
            trialEndsAt: trialEndsAtIso ? trialEndsAtIso.split('T')[0] : null,
            isSigned: false, // Será assinado eletronicamente no primeiro acesso/aceite do cliente
            status: 'active',
            customTerms: combinedTerms,
          })

          if (contractRes.success && contractRes.data) {
            await contractService.ensureInitialInvoice(contractRes.data)
          }
        } catch {
          // non-blocking
        }
      }
    }

    setIsLoading(false)

    if (res.success) {
      onSuccess()
      onClose()
    } else {
      setError(res.error)
    }
  }

  const handleContractCpfChange = (val: string) => {
    const formatted = formatCustomerDocument(val, 'individual')
    setContractResponsibleCpf(formatted)
    setContractResponsibleCpfError('')
    const digits = sanitizeCustomerDocument(formatted, 'individual')
    if (digits.length === 11) {
      const validation = validateCpf(formatted)
      if (!validation.isValid) {
        setContractResponsibleCpfError(validation.error ?? CPF_INVALID_ERROR)
      }
    }
  }

  const currentSelectedPlan = accessPlans.find((p) => p.id === selectedPlanId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Cadastrar Nova Empresa
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Criação da empresa e do usuário inicial com permissões de administrador.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} autoComplete="off" className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 dark:border-rose-800/80 dark:bg-rose-950/50 dark:text-rose-300">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Dados da Empresa */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
              1. Dados da Empresa
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nome da Empresa / Razão Social"
                placeholder="Ex: Auto Peças & Serviços Estrela"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                autoComplete="off"
                required
              />
              <Input
                label="Identificador Único (SLUG)"
                placeholder="ex: auto-pecas-estrela"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                helperText="Chave única de acesso da empresa no sistema."
                autoComplete="off"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <Input
                label="CNPJ"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => handleCnpjChange(e.target.value)}
                onBlur={handleCnpjBlur}
                maxLength={18}
                autoComplete="off"
                error={cnpjError}
                success={cnpjSuccess}
              />
              <Input
                label="Responsável Legal"
                placeholder="Ex: Carlos Eduardo Silva"
                value={responsible}
                onChange={(e) => handleResponsibleChange(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <Input
                  label="CEP"
                  placeholder="00000-000"
                  value={postalCode}
                  onChange={(e) => handlePostalCodeChange(e.target.value)}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={9}
                  disabled={skipPostalCode}
                  helperText={isLookingUpPostalCode ? 'Consultando CEP...' : undefined}
                />
                <label className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipPostalCode}
                    onChange={(e) => {
                      const shouldSkip = e.target.checked
                      setSkipPostalCode(shouldSkip)
                      setPostalCodeError('')
                      if (shouldSkip) {
                        postalLookupController.current?.abort()
                        setIsLookingUpPostalCode(false)
                        setPostalCode('')
                      }
                    }}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                  />
                  Sem CEP
                </label>
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Endereço Completo"
                  placeholder="Rua / Av, Bairro, Cidade - UF"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoComplete="street-address"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
              <div>
                <Input
                  label="Número"
                  placeholder="Nº ou S/N"
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value)}
                  autoComplete="address-line2"
                />
              </div>
              {postalCodeError && (
                <div className="sm:col-span-2 flex items-center text-xs text-rose-600 dark:text-rose-400">
                  {postalCodeError}
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-gray-400" />
                Observações
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotações internas, particularidades do plano, etc."
                rows={2}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 2. Usuário Administrador */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                2. Usuário Administrador
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                <UserCheck className="h-3 w-3" /> Perfil Administrador
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Nome do Administrador"
                placeholder="Ex: Carlos Eduardo Silva"
                value={adminName}
                onChange={(e) => {
                  setIsAdminNameManuallyEdited(true)
                  setAdminName(e.target.value)
                }}
                autoComplete="off"
                required
              />

              <Input
                label="Telefone / WhatsApp"
                placeholder="(00) 00000-0000"
                type="tel"
                value={adminPhone}
                onChange={(e) => setAdminPhone(formatPhoneNumber(e.target.value))}
                inputMode="numeric"
                maxLength={15}
                autoComplete="tel"
              />

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  E-mail de Login
                </label>
                <Input
                  type="email"
                  placeholder="admin@empresa.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Senha Inicial de Acesso
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 pr-10 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">
                  O administrador usará este e-mail e senha para acessar a plataforma.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Seleção Exclusiva de Planos Cadastrados */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-blue-500" />
                3. Plano de Acesso (Planos Cadastrados)
              </h3>
              <span className="text-[11px] font-semibold text-gray-500 dark:text-slate-400">
                {accessPlans.length} {accessPlans.length === 1 ? 'plano disponível' : 'planos disponíveis'}
              </span>
            </div>

            {isLoadingPlans ? (
              <div className="rounded-xl border border-gray-200 dark:border-slate-800 p-4 text-center text-xs text-gray-500 dark:text-slate-400">
                Carregando planos cadastrados...
              </div>
            ) : accessPlans.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                Nenhum plano cadastrado encontrado. Cadastre um plano em Gerenciar Planos primeiro.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {accessPlans.map((plan) => {
                  const isSelected = selectedPlanId === plan.id
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      disabled={isLoading}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`text-left rounded-xl border p-3.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/25 dark:border-blue-500 dark:bg-blue-950/40'
                          : 'border-gray-200 bg-white hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-sm text-gray-900 dark:text-white leading-snug">
                          {plan.name}
                        </div>
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-gray-300 dark:border-slate-600'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </span>
                      </div>
                      {plan.description && (
                        <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400 line-clamp-2">
                          {plan.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-blue-700 dark:text-blue-300">
                          {typeof plan.monthlyPrice === 'number' && plan.monthlyPrice > 0
                            ? `${formatCurrency(plan.monthlyPrice.toFixed(2))}/mês`
                            : 'Sob consulta'}
                        </span>
                        <span className="text-gray-400 dark:text-slate-500">
                          {plan.modules.length} {plan.modules.length === 1 ? 'permissão' : 'permissões'}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Seção 4: Responsável pelo Contrato */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> 4. Responsável pelo Contrato
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
                  Nome do Responsável
                </label>
                <Input
                  value={contractResponsibleName}
                  onChange={(e) => setContractResponsibleName(e.target.value)}
                  placeholder={responsible || adminName || 'Nome completo'}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
                  CPF do Responsável
                </label>
                <Input
                  value={contractResponsibleCpf}
                  onChange={(e) => handleContractCpfChange(e.target.value)}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
                {contractResponsibleCpfError && (
                  <p className="mt-1 text-[11px] font-medium text-red-600 dark:text-red-400">
                    {contractResponsibleCpfError}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
                  Cargo
                </label>
                <Input
                  value={contractResponsibleRole}
                  onChange={(e) => setContractResponsibleRole(e.target.value)}
                  placeholder="Ex: Sócio / Administrador"
                />
              </div>
            </div>
          </div>

          {/* Seção 5: Informações da Mensalidade e Aluguel do Sistema */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> 5. Informações da Mensalidade e Aluguel do Sistema
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
                  Valor da Mensalidade (Plano Selecionado)
                </label>
                <Input
                  value={
                    currentSelectedPlan
                      ? formatCurrency(currentSelectedPlan.monthlyPrice || 0)
                      : 'Selecione um plano'
                  }
                  readOnly
                  disabled
                  className="bg-gray-100 font-semibold text-gray-700 cursor-not-allowed dark:bg-slate-800 dark:text-slate-200"
                />
                <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                  Puxado automaticamente do plano escolhido (sem opção de alteração).
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
                  <Calendar className="mr-1 inline h-3.5 w-3.5" />
                  Data de Vencimento Mensal
                </label>
                <select
                  value={billingDay}
                  onChange={(e) => setBillingDay(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      Todo dia {String(day).padStart(2, '0')} de cada mês
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
                  Taxa de Adesão (R$)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={setupFee}
                  onChange={(e) => setSetupFee(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
                  Forma de Pagamento
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  <option value="PIX / Boleto Bancário">PIX / Boleto Bancário</option>
                  <option value="PIX">PIX</option>
                  <option value="Boleto Bancário">Boleto Bancário</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Transferência Bancária">Transferência Bancária</option>
                </select>
              </div>
            </div>

            {/* Opção 30 dias de teste */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 transition-colors hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <input
                type="checkbox"
                checked={hasTrialPeriod}
                onChange={(e) => setHasTrialPeriod(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="block text-sm font-semibold text-emerald-900 dark:text-emerald-300">
                  Liberar 30 dias de teste gratuito
                </span>
                <span className="mt-0.5 block text-xs text-emerald-700 dark:text-emerald-400">
                  Quando marcado, a empresa terá 30 dias de acesso gratuito e o boleto/fatura será gerado automaticamente 7 dias antes da data de vencimento selecionada.
                </span>
              </div>
            </label>

            {/* Campo de Observação */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
                Observações do Contrato / Cobrança
              </label>
              <textarea
                rows={3}
                value={contractNotes}
                onChange={(e) => setContractNotes(e.target.value)}
                placeholder="Condições especiais, observações de faturamento ou detalhes acordados com o cliente..."
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading} className="bg-blue-600 hover:bg-blue-700">
              Cadastrar Empresa
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
