import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Layers,
  UserCheck,
  X,
  Zap,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { formatCurrency } from '@shared/utils/monetary'
import { formatPhoneNumber } from '@shared/utils/phone'
import {
  validateCnpj,
  formatCustomerDocument,
  sanitizeCustomerDocument,
  CNPJ_INVALID_ERROR,
} from '@modules/customers/utils/customer-document'
import {
  formatPostalAddress,
  formatPostalCode,
  lookupPostalAddress,
} from '@modules/customers/utils/postal-code'
import {
  companyManagementService,
  ALL_PLATFORM_DASHBOARD_MODULES,
} from '@modules/companies/services/company-management.service'
import {
  accessPlanService,
  SYSTEM_DEFAULT_ACCESS_PLANS,
  getPlanSlug,
  resolvePlanFromSlugOrId,
  type AccessPlan,
} from '@modules/companies/services/access-plan.service'
import { validatePasswordStrength } from '@shared/utils/password-validator'

function PasswordRequirementsChecklist({ password }: { password: string }) {
  const result = validatePasswordStrength(password)
  const items = [
    { label: 'Mínimo de 8 caracteres', ok: result.hasMinLength },
    { label: 'Pelo menos uma letra maiúscula (A-Z)', ok: result.hasUpperCase },
    { label: 'Pelo menos uma letra minúscula (a-z)', ok: result.hasLowerCase },
    { label: 'Pelo menos um número (0-9)', ok: result.hasNumber },
    { label: 'Pelo menos um caractere especial (!@#$%...)', ok: result.hasSpecialChar },
  ]

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs space-y-1.5 mt-1">
      <p className="font-semibold text-slate-700">A senha deve conter:</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
        {items.map((it, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-1.5 ${
              it.ok ? 'text-emerald-600 font-medium' : 'text-slate-500'
            }`}
          >
            {it.ok ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            )}
            <span>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RegisterCompanyPublicPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { signIn } = useAuth()

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
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // 3. Plano que está sendo adquirido
  const [plans, setPlans] = useState<AccessPlan[]>(SYSTEM_DEFAULT_ACCESS_PLANS)
  const [selectedPlan, setSelectedPlan] = useState<AccessPlan | null>(null)
  const [isLoadingPlans, setIsLoadingPlans] = useState(true)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Garante que o e-mail e senha comecem rigorosamente em branco e desativa autofill indesejado
  useEffect(() => {
    setAdminEmail('')
    setAdminPassword('')
    setAdminConfirmPassword('')

    const timer = setTimeout(() => {
      setAdminEmail('')
      setAdminPassword('')
      setAdminConfirmPassword('')
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  // Carrega planos disponíveis e resolve slug curto/alias amigável na URL
  useEffect(() => {
    let isMounted = true
    setIsLoadingPlans(true)
    void accessPlanService.listPublic().then((loadedPlans) => {
      if (!isMounted) return
      const validPlans = loadedPlans.length > 0 ? loadedPlans : SYSTEM_DEFAULT_ACCESS_PLANS
      setPlans(validPlans)

      const requestedParam = searchParams.get('plano') || searchParams.get('plan')
      let targetPlan: AccessPlan | null = null

      if (requestedParam) {
        targetPlan = resolvePlanFromSlugOrId(requestedParam, validPlans)
      }

      if (!targetPlan) {
        // Plano padrão: Completo sem emissão ou primeiro plano ativo disponível
        targetPlan =
          validPlans.find(
            (p) =>
              p.isActive &&
              !p.isLocked &&
              p.name.toLowerCase().includes('completo') &&
              !p.name.toLowerCase().includes('com emissão'),
          ) ||
          validPlans.find((p) => p.isActive && !p.isLocked) ||
          validPlans[0] ||
          null
      }

      if (targetPlan) {
        setSelectedPlan(targetPlan)
        const shortSlug = getPlanSlug(targetPlan)
        // Se a URL estiver usando UUID ou formato longo, encurta automaticamente a URL exibida no navegador
        if (requestedParam !== shortSlug) {
          setSearchParams({ plano: shortSlug }, { replace: true })
        }
      }

      setIsLoadingPlans(false)
    })

    return () => {
      isMounted = false
    }
  }, [searchParams, setSearchParams])

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

    if (!adminPassword || !adminConfirmPassword) {
      setError('Por favor, informe e confirme a senha de acesso do administrador.')
      return
    }

    const passwordStrength = validatePasswordStrength(adminPassword)
    if (!passwordStrength.isValid) {
      setError(
        'A senha deve ter no mínimo 8 caracteres, contendo pelo menos uma letra maiúscula, uma minúscula, um número e um caractere especial.'
      )
      return
    }

    if (adminPassword !== adminConfirmPassword) {
      setError('As senhas digitadas não coincidem. Por favor, confirme a mesma senha.')
      return
    }

    if (!selectedPlan) {
      setError('Selecione o plano desejado para iniciar seu teste.')
      return
    }

    setIsLoading(true)

    // 1. Cadastra a empresa e o usuário administrador com 30 dias de trial via endpoint público
    const res = await companyManagementService.publicRegisterCompanyWithAdmin({
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
      modules: selectedPlan.modules,
      planId: selectedPlan.id,
    })

    if (!res.success) {
      setIsLoading(false)
      setError(res.error || 'Não foi possível cadastrar a empresa. Tente novamente.')
      return
    }

    if (!res.data?.organizationId) {
      setIsLoading(false)
      setError('Não foi possível identificar a organização criada. Tente novamente.')
      return
    }

    // 2. Vincula o plano de acesso à empresa criada
    try {
      await accessPlanService.assignToCompany(res.data.organizationId, selectedPlan)
    } catch {
      // ignore
    }

    // 3. Efetua login automático do novo administrador para direcionar ao Dashboard
    const loginRes = await signIn({
      email: adminEmail.trim().toLowerCase(),
      password: adminPassword.trim(),
    })

    setIsLoading(false)

    if (loginRes.success) {
      // Redireciona para o Dashboard (o modal de Termos de Uso será aberto automaticamente no primeiro acesso)
      navigate('/dashboard', { replace: true })
    } else {
      // Fallback: redireciona para a tela de login com aviso
      navigate('/login', {
        replace: true,
        state: {
          signupSuccess: true,
          email: adminEmail.trim(),
        },
      })
    }
  }

  // Lista dos módulos inclusos no plano selecionado
  const planModuleCodeSet = new Set(selectedPlan?.modules || [])
  const includedModulesList = ALL_PLATFORM_DASHBOARD_MODULES.filter(
    (m) => planModuleCodeSet.has(m.code) || m.subFeatures.some((s) => planModuleCodeSet.has(s.code)),
  )

  return (
    <main className="relative min-h-screen w-full flex flex-col justify-between items-center bg-gradient-to-br from-[#0B132B] via-[#0F172A] to-[#1E293B] text-slate-100 px-4 py-8 sm:px-6 lg:px-8 overflow-x-hidden selection:bg-blue-600 selection:text-white">
      {/* Botão de Fechar / Voltar para a Apresentação */}
      <Link
        to="/#como-funciona"
        title="Voltar para a página de planos"
        aria-label="Voltar para a página de planos"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-slate-800/80 text-slate-300 backdrop-blur-md transition-all hover:bg-slate-700 hover:text-white hover:scale-105 active:scale-95 border border-slate-700/80 shadow-lg cursor-pointer group"
      >
        <X className="h-5 w-5 sm:h-6 sm:w-6 transition-transform group-hover:rotate-90 duration-200" />
      </Link>

      {/* Elementos visuais de fundo combinando com a identidade visual da ControleSoft */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[34rem] w-[56rem] rounded-full bg-gradient-to-tr from-blue-600/25 via-sky-500/20 to-emerald-500/15 blur-3xl opacity-80" />
        <div className="absolute top-1/2 -left-32 h-80 w-80 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
      </div>

      <div className="w-full flex-1 flex flex-col items-center justify-center py-6 sm:py-10">
        <div className="w-full max-w-3xl">
          {/* Header */}
          <header className="mb-7 text-center flex flex-col items-center">
            <Link
              to="/#como-funciona"
              title="Voltar para a apresentação do sistema"
              className="group mb-5 inline-block transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
              <img
                src="/controlesoft-logo-full.jpg"
                alt="ControleSoft"
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-3xl object-cover bg-[#FAF9F6] shadow-xl shadow-black/30 ring-1 ring-white/20 mx-auto"
              />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Cadastrar Nova Empresa
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-md">
              ControleSoft — Comece agora seu período de 30 dias de teste grátis com liberação imediata
            </p>
          </header>

          {/* Card Principal de Cadastro */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-9 shadow-2xl shadow-black/40 text-slate-900">
            {/* Banner de 30 dias grátis */}
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-emerald-950">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs">
                <Clock className="h-5 w-5" />
              </div>
              <div className="flex-1 text-xs">
                <p className="font-extrabold text-emerald-900">
                  Período de testes de 30 dias grátis ativado automaticamente
                </p>
                <p className="mt-0.5 text-emerald-800 leading-relaxed">
                  Sua empresa terá acesso integral às ferramentas do plano contratado durante 30 dias sem cobrança inicial.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} autoComplete="off" className="space-y-6">
              {/* Campos decoy para prevenir autofill indesejado de credenciais pelo navegador */}
              <div
                aria-hidden="true"
                style={{ position: 'absolute', opacity: 0, height: 0, width: 0, overflow: 'hidden', zIndex: -1 }}
              >
                <input type="text" name="decoy_username" tabIndex={-1} autoComplete="off" />
                <input type="password" name="decoy_password" tabIndex={-1} autoComplete="off" />
              </div>
              {/* 1. DADOS DA EMPRESA */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    1. Dados da Empresa
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Nome Fantasia / Razão Social <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="text"
                      required
                      placeholder="Ex: Minha Empresa LTDA"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Identificador Único (Slug do Sistema) <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="text"
                      required
                      placeholder="minha-empresa"
                      value={slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      className="text-xs font-mono lowercase"
                    />
                    <span className="text-[10px] text-gray-400 mt-0.5 block">
                      Usado para identificação segura no sistema.
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-gray-700">
                        CNPJ (Opcional)
                      </label>
                      {cnpjSuccess && (
                        <span className="text-[11px] font-bold text-emerald-600">
                          {cnpjSuccess}
                        </span>
                      )}
                    </div>
                    <Input
                      type="text"
                      placeholder="00.000.000/0000-00"
                      value={cnpj}
                      onChange={(e) => handleCnpjChange(e.target.value)}
                      onBlur={handleCnpjBlur}
                      maxLength={18}
                      className={`text-xs font-mono ${
                        cnpjError
                          ? 'border-rose-400 focus:ring-rose-400'
                          : cnpjSuccess
                            ? 'border-emerald-400 focus:ring-emerald-400'
                            : ''
                      }`}
                    />
                    {cnpjError && (
                      <span className="text-[11px] font-semibold text-rose-600 mt-1 block">
                        {cnpjError}
                      </span>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Responsável Principal da Empresa
                    </label>
                    <Input
                      type="text"
                      placeholder="Ex: João Silva"
                      value={responsible}
                      onChange={(e) => handleResponsibleChange(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  {/* Bloco de Endereço com Busca Automática por CEP */}
                  <div className="sm:col-span-2 space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-gray-700">
                        CEP (Busca Automática de Endereço)
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skipPostalCode}
                          onChange={(e) => {
                            setSkipPostalCode(e.target.checked)
                            if (e.target.checked) {
                              setPostalCode('')
                              setPostalCodeError('')
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                        />
                        Sem CEP / Preenchimento Manual
                      </label>
                    </div>

                    {!skipPostalCode && (
                      <div>
                        <div className="relative">
                          <Input
                            type="text"
                            placeholder="00000-000"
                            value={postalCode}
                            onChange={(e) => handlePostalCodeChange(e.target.value)}
                            maxLength={9}
                            className="text-xs font-mono"
                          />
                          {isLookingUpPostalCode && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-blue-600 font-medium animate-pulse">
                              Consultando CEP...
                            </span>
                          )}
                        </div>
                        {postalCodeError && (
                          <span className="text-[11px] text-rose-600 mt-1 block">
                            {postalCodeError}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                          Logradouro / Endereço Completo
                        </label>
                        <Input
                          type="text"
                          placeholder="Rua, Av, Bairro, Cidade - UF"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                          Número
                        </label>
                        <Input
                          type="text"
                          placeholder="Ex: 123 ou S/N"
                          value={addressNumber}
                          onChange={(e) => setAddressNumber(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Observações Cadastrais (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Informações adicionais sobre o negócio..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2. USUÁRIO ADMINISTRADOR */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    2. Usuário Administrador
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Nome Completo do Administrador <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="text"
                      required
                      placeholder="Ex: Carlos Oliveira"
                      value={adminName}
                      onChange={(e) => {
                        setAdminName(e.target.value)
                        setIsAdminNameManuallyEdited(true)
                      }}
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Telefone / WhatsApp (Com DDD) <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="text"
                      required
                      placeholder="(00) 00000-0000"
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(formatPhoneNumber(e.target.value))}
                      className="text-xs"
                      maxLength={15}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      E-mail de Login do Administrador <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="email"
                      name="company_admin_registration_email"
                      id="company_admin_registration_email"
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      required
                      placeholder="seu.email@exemplo.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Senha de Acesso Inicial <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        name="company_admin_registration_password"
                        id="company_admin_registration_password"
                        autoComplete="new-password"
                        required
                        placeholder="Ex: SenhaForte@2026"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="pr-10 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Confirmar Senha <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="company_admin_registration_confirm_password"
                        id="company_admin_registration_confirm_password"
                        autoComplete="new-password"
                        required
                        placeholder="Confirme sua senha"
                        value={adminConfirmPassword}
                        onChange={(e) => setAdminConfirmPassword(e.target.value)}
                        className="pr-10 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Checklist visual de força de senha igual ao /profile */}
                  <div className="sm:col-span-2">
                    <PasswordRequirementsChecklist password={adminPassword} />
                  </div>
                </div>
              </div>

              {/* 3. PLANO DE ACESSO ADQUIRIDO (Card do Plano) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      3. Plano de Acesso Adquirido
                    </h3>
                  </div>
                  {plans.length > 1 && (
                    <span className="text-[11px] font-medium text-slate-500">
                      Você pode trocar o plano abaixo se preferir
                    </span>
                  )}
                </div>

                {isLoadingPlans ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500 animate-pulse">
                    Carregando detalhes do plano...
                  </div>
                ) : selectedPlan ? (
                  <div className="rounded-2xl border-2 border-blue-500/80 bg-gradient-to-br from-blue-50/50 via-white to-slate-50/50 p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-blue-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-extrabold text-slate-900">
                            {selectedPlan.name}
                          </h4>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300">
                            <Clock className="h-3 w-3" />
                            30 Dias Grátis
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{selectedPlan.description}</p>
                      </div>

                      <div className="text-left sm:text-right">
                        <div className="text-xl font-black text-emerald-600">
                          R$ 0,00 <span className="text-xs font-bold text-emerald-700">no 1º mês</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          A partir do 2º mês:{' '}
                          <span className="font-bold text-slate-800">
                            {formatCurrency((selectedPlan.monthlyPrice ?? 149.9).toFixed(2))}
                          </span>
                          /mês
                        </div>
                      </div>
                    </div>

                    {/* Módulos inclusos no plano */}
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                        Módulos Liberados para sua Empresa ({includedModulesList.length}):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {includedModulesList.map((m) => (
                          <div
                            key={m.code}
                            className="flex items-center gap-2 rounded-lg bg-white p-2 border border-slate-200/80 text-xs text-slate-700 shadow-2xs"
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="font-semibold text-slate-900 truncate">{m.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Opção para trocar de plano se houver outros disponíveis */}
                    {plans.length > 1 && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Mudar para outro plano:</span>
                        <select
                          value={selectedPlan.id}
                          onChange={(e) => {
                            const found = plans.find((p) => p.id === e.target.value)
                            if (found) {
                              setSelectedPlan(found)
                              setSearchParams({ plano: getPlanSlug(found) }, { replace: true })
                            }
                          }}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs focus:border-blue-500 focus:outline-hidden"
                        >
                          {plans.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {formatCurrency((p.monthlyPrice ?? 149.9).toFixed(2))}/mês
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-rose-600">Nenhum plano selecionado.</div>
                )}
              </div>

              {/* Botão de Finalização */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Criando sua empresa e liberando acesso...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      <span>Finalizar Cadastro e Iniciar Teste de 30 Dias</span>
                    </>
                  )}
                </Button>
                <p className="text-center text-[11px] text-slate-500 mt-2">
                  Ao criar a conta, você poderá ler e concordar com o Termo de Adesão e Política de Privacidade no primeiro login.
                </p>
              </div>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <span className="text-xs text-slate-500">Já possui uma empresa cadastrada? </span>
              <Link
                to="/login"
                className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Acesse sua conta
              </Link>
            </div>
          </div>
        </div>
      </div>

      <footer className="w-full max-w-5xl py-6 text-center text-xs text-slate-400">
        © 2026 ControleSoft — Gestão Empresarial Inteligente. Todos os direitos reservados.
      </footer>
    </main>
  )
}
