import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  Layers,
  Lock,
  Scale,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { organizationService } from '@modules/organizations/services/organization.service'
import {
  ALL_PLATFORM_DASHBOARD_MODULES,
  companyManagementService,
} from '@modules/companies/services/company-management.service'
import { contractService } from '@modules/companies/services/contract.service'
import type { AccessPlan } from '@modules/companies/services/access-plan.service'
import { termsAcceptanceService } from '@shared/services/terms-acceptance.service'
import { planTermsService, type PlanTermConfig } from '@shared/services/plan-terms.service'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import { formatPhoneNumber } from '@shared/utils/phone'
import { supabase } from '@app/config/supabase'
import {
  validateCpf,
  validateCnpj,
  formatCustomerDocument,
  CPF_INVALID_ERROR,
  CNPJ_INVALID_ERROR,
} from '@modules/customers/utils/customer-document'

interface PlanTrialSignupModalProps {
  isOpen: boolean
  onClose: () => void
  selectedPlan: AccessPlan | null
  availablePlans: AccessPlan[]
  onSelectPlan: (plan: AccessPlan) => void
}

function formatCpfOrCnpj(value: string): string {
  const cleanAlnum = value.toUpperCase().replace(/[^0-9A-Z]/g, '')
  const onlyDigits = value.replace(/\D/g, '')

  if (cleanAlnum === onlyDigits && onlyDigits.length <= 11) {
    return formatCustomerDocument(onlyDigits, 'individual')
  }
  return formatCustomerDocument(cleanAlnum, 'company')
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function PlanTrialSignupModal({
  isOpen,
  onClose,
  selectedPlan,
  availablePlans,
  onSelectPlan,
}: PlanTrialSignupModalProps) {
  const { user, signUp, signIn } = useAuth()
  const { reloadOrganizations } = useOrganization()
  const navigate = useNavigate()

  const activePlans = useMemo(
    () => availablePlans.filter((p) => p.isActive && !p.isLocked),
    [availablePlans],
  )

  const currentPlan = useMemo(() => {
    if (selectedPlan && selectedPlan.isActive && !selectedPlan.isLocked) {
      return selectedPlan
    }
    return (
      activePlans.find((p) => p.name.toLowerCase().includes('completo')) ||
      activePlans[0] ||
      selectedPlan
    )
  }, [selectedPlan, activePlans])

  // Estado do formulário
  const [useFreeTrial, setUseFreeTrial] = useState(true)
  const [companyName, setCompanyName] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [documentError, setDocumentError] = useState('')
  const [documentSuccess, setDocumentSuccess] = useState('')
  const [adminName, setAdminName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [billingDay, setBillingDay] = useState<number>(10)
  const [paymentMethod, setPaymentMethod] = useState('PIX / Boleto Bancário')

  // Aceites obrigatórios
  const [acceptedTermsAndPrivacy, setAcceptedTermsAndPrivacy] = useState(false)
  const [acceptedAutoSuspensionRule, setAcceptedAutoSuspensionRule] = useState(false)
  const [showTermsPreview, setShowTermsPreview] = useState(false)
  const [planTerm, setPlanTerm] = useState<PlanTermConfig | null>(null)

  useEffect(() => {
    let isMounted = true
    if (currentPlan?.id || currentPlan?.name) {
      void planTermsService.getTermForPlan(currentPlan.id || currentPlan.name).then((res) => {
        if (isMounted) {
          setPlanTerm(res)
        }
      })
    }
    return () => {
      isMounted = false
    }
  }, [currentPlan?.id, currentPlan?.name])

  // Controle de submissão e sucesso
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedData, setCompletedData] = useState<{
    companyName: string
    planName: string
    monthlyPrice: number
    hasTrial: boolean
    trialEndsAtFormatted: string
    nextBillingDateFormatted: string
    contractNumber: string
    termsAcceptedAt: string
    termsIp: string
    requiresEmailConfirmation: boolean
  } | null>(null)

  useEffect(() => {
    if (isOpen) {
      setError(null)
      setCompletedData(null)
      setUseFreeTrial(true)
      setDocumentError('')
      setDocumentSuccess('')
      if (user?.email && !email) {
        setEmail(user.email)
      }
      if (user?.user_metadata?.display_name && !adminName) {
        setAdminName(String(user.user_metadata.display_name))
      }
    }
  }, [isOpen, user])

  if (!isOpen || !currentPlan) return null

  const planPrice = currentPlan.monthlyPrice ?? 149.9

  const trialEndDate = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return d
  }, [])

  const todayFormatted = new Date().toLocaleDateString('pt-BR')
  const trialEndFormatted = trialEndDate.toLocaleDateString('pt-BR')

  const includedMainModules = useMemo(() => {
    const codeSet = new Set(currentPlan.modules)
    return ALL_PLATFORM_DASHBOARD_MODULES.filter(
      (mod) => codeSet.has(mod.code) || mod.subFeatures.some((s) => codeSet.has(s.code)),
    )
  }, [currentPlan])

  const handleDocumentChange = (raw: string) => {
    const formatted = formatCpfOrCnpj(raw)
    setDocumentNumber(formatted)

    const cleanAlnum = formatted.toUpperCase().replace(/[^0-9A-Z]/g, '')
    const onlyDigits = formatted.replace(/\D/g, '')
    const isCpf = cleanAlnum === onlyDigits && onlyDigits.length <= 11

    if (cleanAlnum.length === 0) {
      setDocumentError('')
      setDocumentSuccess('')
      return
    }

    if (isCpf && cleanAlnum.length === 11) {
      const val = validateCpf(cleanAlnum)
      if (val.isValid) {
        setDocumentError('')
        setDocumentSuccess('✓ CPF válido')
      } else {
        setDocumentError(val.error ?? CPF_INVALID_ERROR)
        setDocumentSuccess('')
      }
    } else if (!isCpf && cleanAlnum.length === 14) {
      const val = validateCnpj(cleanAlnum)
      if (val.isValid) {
        setDocumentError('')
        setDocumentSuccess('✓ CNPJ válido')
      } else {
        setDocumentError(val.error ?? CNPJ_INVALID_ERROR)
        setDocumentSuccess('')
      }
    } else {
      setDocumentError('')
      setDocumentSuccess('')
    }
  }

  const handleDocumentBlur = () => {
    const cleanAlnum = documentNumber.toUpperCase().replace(/[^0-9A-Z]/g, '')
    const onlyDigits = documentNumber.replace(/\D/g, '')
    if (!cleanAlnum) {
      setDocumentError('')
      setDocumentSuccess('')
      return
    }
    const isCpf = cleanAlnum === onlyDigits && onlyDigits.length <= 11
    if (isCpf) {
      if (cleanAlnum.length < 11) {
        setDocumentError('Informe o CPF completo com 11 dígitos.')
        setDocumentSuccess('')
        return
      }
      const val = validateCpf(cleanAlnum)
      if (!val.isValid) {
        setDocumentError(val.error ?? CPF_INVALID_ERROR)
        setDocumentSuccess('')
      } else {
        setDocumentError('')
        setDocumentSuccess('✓ CPF válido')
      }
    } else {
      if (cleanAlnum.length < 14) {
        setDocumentError('Informe o CNPJ completo com 14 caracteres.')
        setDocumentSuccess('')
        return
      }
      const val = validateCnpj(cleanAlnum)
      if (!val.isValid) {
        setDocumentError(val.error ?? CNPJ_INVALID_ERROR)
        setDocumentSuccess('')
      } else {
        setDocumentError('')
        setDocumentSuccess('✓ CNPJ válido')
      }
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (companyName.trim().length < 2) {
      setError('Informe o nome da sua empresa ou negócio.')
      return
    }

    const cleanDocAlnum = documentNumber.toUpperCase().replace(/[^0-9A-Z]/g, '')
    const onlyDocDigits = documentNumber.replace(/\D/g, '')
    if (cleanDocAlnum) {
      const isCpf = cleanDocAlnum === onlyDocDigits && onlyDocDigits.length <= 11
      if (isCpf) {
        if (cleanDocAlnum.length !== 11) {
          setError('Informe o CPF completo com 11 dígitos ou deixe em branco.')
          return
        }
        const val = validateCpf(cleanDocAlnum)
        if (!val.isValid) {
          setError(val.error ?? CPF_INVALID_ERROR)
          return
        }
      } else {
        if (cleanDocAlnum.length !== 14) {
          setError('Informe o CNPJ completo com 14 caracteres ou deixe em branco.')
          return
        }
        const val = validateCnpj(cleanDocAlnum)
        if (!val.isValid) {
          setError(val.error ?? CNPJ_INVALID_ERROR)
          return
        }
      }
    }

    if (adminName.trim().length < 2) {
      setError('Informe o nome completo do responsável pela conta.')
      return
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Informe um endereço de e-mail válido.')
      return
    }

    if (!user && password.length < 8) {
      setError('A senha de acesso deve conter no mínimo 8 caracteres.')
      return
    }

    if (!acceptedTermsAndPrivacy) {
      setError(
        'Você deve ler e aprovar os Termos de Uso e a Política de Privacidade para prosseguir.',
      )
      return
    }

    if (!acceptedAutoSuspensionRule) {
      setError(
        'Você deve confirmar ciência sobre a regra do período de teste de 1 mês e suspensão automática em caso de não pagamento no próximo mês.',
      )
      return
    }

    setIsSubmitting(true)

    try {
      const cleanEmail = email.trim().toLowerCase()
      const cleanCompanyName = companyName.trim()
      const cleanAdminName = adminName.trim()
      const baseSlug =
        generateSlug(cleanCompanyName) || `empresa-${Date.now().toString().slice(-5)}`
      const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`
      const trialIso = useFreeTrial ? trialEndDate.toISOString() : null

      // 1. Registra o aceite jurídico com IP, data/hora e plano escolhido
      const acceptanceRecord = await termsAcceptanceService.recordAcceptance(cleanEmail, false, {
        selectedPlanId: currentPlan.id,
        selectedPlanName: currentPlan.name,
        version: planTerm?.version || '2.0',
        termTitle: planTerm?.title,
        termSnapshot: planTerm?.content,
        agreedToTrialAndAutoSuspension: true,
      })

      let requiresEmailConfirmation = false
      let hasActiveSession = Boolean(user)

      // 2. Se não estiver autenticado, cria a conta no Supabase Auth
      if (!user) {
        const signUpRes = await signUp({
          email: cleanEmail,
          password,
          displayName: cleanAdminName,
        })

        if (!signUpRes.success) {
          // Caso o e-mail já tenha sido cadastrado antes, tenta autenticar com a senha informada
          const signInRes = await signIn({ email: cleanEmail, password })
          if (!signInRes.success) {
            setError(signUpRes.error || 'Não foi possível criar sua conta. Verifique os dados.')
            setIsSubmitting(false)
            return
          }
          hasActiveSession = true
        } else {
          hasActiveSession = Boolean(signUpRes.data.session)
          requiresEmailConfirmation = !signUpRes.data.session
        }
      }

      // Persiste o registro de aceite no metadata do usuário autenticado
      if (hasActiveSession) {
        void termsAcceptanceService.recordAcceptance(cleanEmail, true, {
          selectedPlanId: currentPlan.id,
          selectedPlanName: currentPlan.name,
          version: planTerm?.version || '2.0',
          termTitle: planTerm?.title,
          termSnapshot: planTerm?.content,
          agreedToTrialAndAutoSuspension: true,
        })
      }

      let generatedContractNumber = contractService.generateContractNumber(
        Math.floor(Math.random() * 900),
      )
      let createdOrgId: string | null = null

      // 3. Tenta a RPC atômica de auto-cadastro com plano e trial de 1 mês
      if (hasActiveSession) {
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc(
            'public_register_company_trial_plan',
            {
              p_org_name: cleanCompanyName,
              p_org_slug: baseSlug,
              p_cnpj: documentNumber.trim() || null,
              p_responsible_name: cleanAdminName,
              p_whatsapp: whatsapp.trim() || null,
              p_admin_email: cleanEmail,
              p_plan_id: currentPlan.id,
              p_has_trial: useFreeTrial,
              p_billing_day: billingDay,
              p_payment_method: paymentMethod,
              p_terms_version: acceptanceRecord.version,
              p_terms_ip: acceptanceRecord.ip,
            },
          )

          if (!rpcError && rpcData) {
            createdOrgId = (rpcData as any).organizationId || null
            if ((rpcData as any).contractNumber) {
              generatedContractNumber = String((rpcData as any).contractNumber)
            }
          }
        } catch {
          // Fallback abaixo caso a RPC ainda não esteja aplicada no banco remoto
        }
      }

      // 4. Fallback resiliente via serviços da aplicação + armazenamento local sincronizado
      if (!createdOrgId && hasActiveSession) {
        try {
          const { data: authUser } = await supabase.auth.getUser()
          const uid = authUser?.user?.id
          if (uid) {
            const createOrgRes = await organizationService.createOrganization(
              cleanCompanyName,
              uniqueSlug,
              uid,
            )
            if (createOrgRes.success) {
              createdOrgId = createOrgRes.data
              await supabase
                .from('organizations')
                .update({
                  trial_ends_at: trialIso,
                  access_plan_id: currentPlan.id,
                  cnpj: documentNumber.trim() || null,
                  responsible_name: cleanAdminName,
                  whatsapp: whatsapp.trim() || null,
                  admin_email: cleanEmail,
                  admin_name: cleanAdminName,
                } as any)
                .eq('id', createdOrgId)

              await companyManagementService.updateCompanyModules(createdOrgId, currentPlan.modules)
            }
          }
        } catch {
          // Segue para registro local do contrato e faturas
        }
      }

      // 5. Garante que o contrato e as 2 primeiras faturas (1º mês grátis R$ 0 + 2º mês a vencer) estejam salvos no contractService
      const savedContractRes = await contractService.saveContract({
        companyId: createdOrgId,
        contractNumber: generatedContractNumber,
        clientName: cleanCompanyName,
        clientDocument: documentNumber.trim() || 'Não informado',
        clientResponsibleName: cleanAdminName,
        clientResponsibleRole: 'Administrador / Titular',
        clientEmail: cleanEmail,
        clientPhone: whatsapp.trim() || null,
        planName: currentPlan.name,
        monthlyAmount: planPrice,
        setupFee: 0,
        billingDay,
        paymentMethod,
        startDate: new Date().toISOString().split('T')[0],
        durationMonths: 12,
        hasTrialPeriod: useFreeTrial,
        trialDurationMonths: useFreeTrial ? 1 : undefined,
        trialEndsAt: trialIso,
        isSigned: true,
        signedAt: acceptanceRecord.acceptedAt,
        status: 'active',
        includedModules: includedMainModules.map((m) => m.name),
        customTerms: planTerm?.content
          ? `${planTerm.title} (v${acceptanceRecord.version}) — Aceito digitalmente por ${cleanEmail} (IP: ${acceptanceRecord.ip}) aos ${new Date(acceptanceRecord.acceptedAt).toLocaleString('pt-BR')}\n\n${planTerm.content}`
          : `Adesão digital na apresentação do site com aprovação dos Termos de Uso v${acceptanceRecord.version} e Política de Privacidade (IP: ${acceptanceRecord.ip}). ${
              useFreeTrial
                ? `1º mês gratuito (30 dias até ${trialEndFormatted}). A partir do próximo mês, o pagamento de ${formatCurrency(planPrice.toFixed(2))} é obrigatório para manter o acesso, ocorrendo retirada/suspensão automática do acesso em caso de não pagamento.`
                : 'Assinatura mensal ativa com suspensão automática em caso de inadimplência.'
            }`,
      })

      if (savedContractRes.success && savedContractRes.data) {
        await contractService.generateInvoicesBatch(savedContractRes.data, 2)
      }

      if (hasActiveSession) {
        await reloadOrganizations()
      }

      setCompletedData({
        companyName: cleanCompanyName,
        planName: currentPlan.name,
        monthlyPrice: planPrice,
        hasTrial: useFreeTrial,
        trialEndsAtFormatted: trialEndFormatted,
        nextBillingDateFormatted: trialEndFormatted,
        contractNumber: generatedContractNumber,
        termsAcceptedAt: new Date(acceptanceRecord.acceptedAt).toLocaleString('pt-BR'),
        termsIp: acceptanceRecord.ip,
        requiresEmailConfirmation,
      })
    } catch (err: any) {
      setError(err?.message || 'Ocorreu um erro inesperado ao processar seu cadastro.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-signup-modal-title"
        className="relative flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
      >
        {/* Header do Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/30">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-widest text-blue-300">
                Ativação de Plano & Período de Avaliação
              </span>
              <h2 id="plan-signup-modal-title" className="text-base sm:text-lg font-bold">
                {completedData
                  ? 'Plano Ativado com Sucesso!'
                  : `Começar com o Plano ${currentPlan.name}`}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {completedData ? (
            /* TELA DE CONFIRMAÇÃO DE CADASTRO E ATIVAÇÃO DO TESTE DE 1 MÊS */
            <div className="space-y-6 py-2">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 border border-emerald-200 shadow-xs">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                  <Clock className="h-3.5 w-3.5" />
                  {completedData.hasTrial
                    ? '1º Mês Grátis Liberado (30 Dias Sem Custo)'
                    : 'Assinatura Registrada'}
                </span>
                <h3 className="text-2xl font-bold text-slate-900">
                  Tudo pronto para a empresa {completedData.companyName}!
                </h3>
                <p className="max-w-xl text-sm text-slate-600 leading-relaxed">
                  Seu acesso ao plano <strong>{completedData.planName}</strong> foi configurado com
                  todos os módulos correspondentes e seu termo de adesão foi registrado.
                </p>
              </div>

              {/* Resumo Contratual e Cronograma de Cobrança */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                    1º Mês (Teste Grátis)
                  </span>
                  <p className="mt-1 text-xl font-black text-emerald-700">R$ 0,00</p>
                  <span className="mt-1 block text-xs text-emerald-800">
                    Grátis até <strong>{completedData.trialEndsAtFormatted}</strong>
                  </span>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900 block">
                    Próximo Mês (2º Mês)
                  </span>
                  <p className="mt-1 text-xl font-black text-blue-700">
                    {formatCurrency(completedData.monthlyPrice.toFixed(2))}
                    <span className="text-xs font-normal text-blue-600">/mês</span>
                  </p>
                  <span className="mt-1 block text-xs text-blue-800">
                    1º vencimento em <strong>{completedData.nextBillingDateFormatted}</strong>
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    Contrato & Aceite Legal
                  </span>
                  <p className="mt-1 text-sm font-mono font-bold text-slate-900">
                    #{completedData.contractNumber}
                  </p>
                  <span className="mt-1 block text-[11px] text-slate-500">
                    Aceito em {completedData.termsAcceptedAt}
                  </span>
                </div>
              </div>

              {/* Aviso de Regra de Continuidade Aprovada */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 space-y-1.5">
                <div className="font-bold flex items-center gap-2 text-amber-950">
                  <Scale className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Compromisso de Continuidade e Política de Acesso (Aprovado no Cadastro)</span>
                </div>
                <p className="leading-relaxed">
                  Durante os primeiros 30 dias (até{' '}
                  <strong>{completedData.trialEndsAtFormatted}</strong>), você utiliza todos os
                  recursos do plano gratuitamente. Para continuar utilizando no próximo mês, basta
                  quitar a fatura mensal em{' '}
                  <strong>Configurações da Empresa → Faturas do Sistema</strong>. Caso o pagamento
                  não seja realizado no próximo mês, o sistema retirará automaticamente o acesso da
                  conta conforme os Termos de Uso aprovados (IP registrado:{' '}
                  <span className="font-mono">{completedData.termsIp}</span>).
                </p>
              </div>

              {completedData.requiresEmailConfirmation && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
                  <strong>Confirmação de E-mail:</strong> Enviamos um link de ativação para{' '}
                  <strong>{email}</strong>. Confirme seu e-mail e, em seguida, faça login para
                  acessar seu painel.
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    onClose()
                    if (completedData.requiresEmailConfirmation) {
                      navigate('/login')
                    } else {
                      navigate('/')
                    }
                  }}
                  className="w-full sm:w-auto gap-2 bg-[#2563EB] hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold"
                >
                  <span>
                    {completedData.requiresEmailConfirmation
                      ? 'Ir para a Tela de Login'
                      : 'Acessar Meu Painel Agora'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800"
                >
                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* 1. Seletor Rápido do Plano Escolhido */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-blue-600" />
                    1. Plano Selecionado
                  </label>
                  <span className="text-xs font-semibold text-blue-600">
                    {includedMainModules.length} módulos liberados neste plano
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {activePlans.map((plan) => {
                    const isSelected = plan.id === currentPlan.id
                    const price = plan.monthlyPrice ?? 149.9
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => onSelectPlan(plan)}
                        className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 line-clamp-1">
                              {plan.name}
                            </span>
                            {isSelected && (
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                                <Check className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                            {plan.description}
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-200/70 flex items-baseline justify-between">
                          <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            1º Mês Grátis
                          </span>
                          <span className="text-xs font-extrabold text-slate-900">
                            {formatCurrency(price.toFixed(2))}
                            <span className="text-[10px] font-normal text-slate-500">/mês</span>
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 2. Opção de Teste Grátis de 1 Mês & Regra do Próximo Mês */}
              <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50/90 via-white to-blue-50/50 p-4 sm:p-5 space-y-3.5 shadow-xs">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useFreeTrial}
                    onChange={(e) => setUseFreeTrial(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-emerald-400 text-emerald-600 accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-emerald-600" />
                        Ativar Teste Grátis de 1 Mês (30 Dias Sem Custo)
                      </span>
                      <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                        Hoje: R$ 0,00
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      Teste o plano <strong>{currentPlan.name}</strong> gratuitamente por{' '}
                      <strong>1 mês completo</strong> ({todayFormatted} a {trialEndFormatted}).
                      Nenhuma cobrança é realizada agora.
                    </p>
                  </div>
                </label>

                {/* Linha do Tempo Hoje vs Próximo Mês vs Regra de Suspensão */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-emerald-200/70 text-xs">
                  <div className="rounded-xl bg-white/90 border border-emerald-200 p-3">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>1º Mês (Hoje até {trialEndFormatted})</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">
                      <strong>100% Gratuito (R$ 0,00)</strong>. Acesso total aos módulos do plano
                      escolhido.
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/90 border border-blue-200 p-3">
                    <div className="flex items-center gap-1.5 font-bold text-blue-900">
                      <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span>Próximo Mês ({trialEndFormatted})</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Para continuar utilizando, pague a mensalidade de{' '}
                      <strong>{formatCurrency(planPrice.toFixed(2))}</strong> via PIX ou Boleto.
                    </p>
                  </div>

                  <div className="rounded-xl bg-amber-50/90 border border-amber-200 p-3">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span>Caso Não Haja Pagamento</span>
                    </div>
                    <p className="mt-1 text-[11px] text-amber-900/90">
                      O sistema <strong>retira o acesso automaticamente</strong> conforme os Termos
                      de Uso aprovados no cadastro.
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Dados da Empresa e Administrador */}
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  2. Dados da Sua Empresa e Conta de Acesso
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome da Empresa / Negócio *
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Ex: Auto Center & Peças Silva"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      CNPJ ou CPF
                    </label>
                    <input
                      type="text"
                      value={documentNumber}
                      onChange={(e) => handleDocumentChange(e.target.value)}
                      onBlur={handleDocumentBlur}
                      placeholder="00.000.000/0001-00 ou CPF"
                      maxLength={18}
                      className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none ${
                        documentError
                          ? 'border-rose-500 focus:border-rose-600'
                          : documentSuccess
                            ? 'border-emerald-500 focus:border-emerald-600'
                            : 'border-slate-300 focus:border-blue-600'
                      }`}
                    />
                    {documentSuccess && (
                      <p className="mt-1 text-xs font-medium text-emerald-600">{documentSuccess}</p>
                    )}
                    {documentError && (
                      <p className="mt-1 text-xs font-medium text-rose-600">{documentError}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Seu Nome Completo (Responsável) *
                    </label>
                    <input
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="Ex: Carlos Eduardo Silva"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      WhatsApp / Telefone *
                    </label>
                    <input
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(formatPhoneNumber(e.target.value))}
                      placeholder="(31) 99999-9999"
                      maxLength={15}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      E-mail Profissional (Login) *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@suaempresa.com.br"
                      autoComplete="email"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                      required
                    />
                  </div>

                  {!user && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Crie sua Senha de Acesso *
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Mínimo de 8 caracteres"
                          autoComplete="new-password"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Forma de Pagamento (Próximo Mês)
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="PIX / Boleto Bancário">PIX ou Boleto Bancário</option>
                      <option value="Chave PIX Mensal">PIX Mensal com QR Code</option>
                      <option value="Boleto Bancário">Boleto Bancário Mensal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Dia Preferencial de Vencimento (Pós-Teste)
                    </label>
                    <select
                      value={billingDay}
                      onChange={(e) => setBillingDay(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    >
                      <option value={5}>Todo dia 05</option>
                      <option value={10}>Todo dia 10 (Recomendado)</option>
                      <option value={15}>Todo dia 15</option>
                      <option value={20}>Todo dia 20</option>
                      <option value={25}>Todo dia 25</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 4. Termos de Uso, Política de Privacidade e Cláusula de Retirada de Acesso */}
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    <Scale className="h-4 w-4 text-blue-600" />
                    <span>3. Termo do Plano {currentPlan.name} (v{planTerm?.version || '2.0'})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTermsPreview(!showTermsPreview)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    <span>{showTermsPreview ? 'Ocultar cláusulas' : 'Ler cláusulas do plano'}</span>
                    {showTermsPreview ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {showTermsPreview && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-600 space-y-2 max-h-56 overflow-y-auto leading-relaxed whitespace-pre-line select-text">
                    <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 mb-2">
                      {planTerm?.title || `Termos de Uso e Licença de Software — ${currentPlan.name}`} (v{planTerm?.version || '2.0'})
                    </div>
                    {planTerm?.content || (
                      <p>
                        Adesão aos termos do plano {currentPlan.name} com 30 dias de teste gratuito e suspensão automática após 10 dias de atraso.
                      </p>
                    )}
                  </div>
                )}

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 cursor-pointer hover:border-blue-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={acceptedTermsAndPrivacy}
                    onChange={(e) => setAcceptedTermsAndPrivacy(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600 cursor-pointer"
                    required
                  />
                  <span className="leading-relaxed">
                    Li e aprovo integralmente o <strong>Termo de Adesão do {currentPlan.name} (v{planTerm?.version || '2.0'})</strong> e a{' '}
                    <Link
                      to="/politica-de-privacidade"
                      target="_blank"
                      className="font-bold text-blue-600 hover:underline"
                    >
                      Política de Privacidade e Proteção de Dados (LGPD)
                    </Link>{' '}
                    da plataforma ControleSoft / JB Gestão.
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-slate-800 cursor-pointer hover:border-amber-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={acceptedAutoSuspensionRule}
                    onChange={(e) => setAcceptedAutoSuspensionRule(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-400 accent-blue-600 cursor-pointer"
                    required
                  />
                  <span className="leading-relaxed">
                    <strong>Ciência de Cobrança Futura e Retirada de Acesso:</strong> Estou ciente
                    de que o <strong>1º mês é gratuito</strong> para teste e que, no{' '}
                    <strong>próximo mês</strong>, terei que pagar a mensalidade do plano (
                    <strong>{formatCurrency(planPrice.toFixed(2))}/mês</strong>) para continuar
                    utilizando. Concordo que, <strong>caso eu não pague</strong>, o sistema{' '}
                    <strong>retirará automaticamente o meu acesso</strong> de acordo com as
                    políticas e termos de uso aprovados neste cadastro.
                  </span>
                </label>
              </div>

              {/* Rodapé do Formulário */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Registro seguro com data, hora e IP (LGPD)</span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-initial"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    isLoading={isSubmitting}
                    className="flex-1 sm:flex-initial gap-2 bg-[#2563EB] hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md shadow-blue-600/20"
                  >
                    <span>
                      {useFreeTrial
                        ? 'Iniciar 1 Mês de Teste Grátis'
                        : 'Contratar Plano Agora'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
