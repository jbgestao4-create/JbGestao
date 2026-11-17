import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  QrCode,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Zap,
} from 'lucide-react'
import { formatCurrency } from '@shared/utils/monetary'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import {
  mercadopagoService,
  type MercadoPagoPixTransaction,
} from '../services/mercadopago.service'
import {
  accessPlanService,
  SYSTEM_DEFAULT_ACCESS_PLANS,
  type AccessPlan,
} from '../services/access-plan.service'

interface PixPaymentCheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  initialPlanId?: string | null
  contractInvoiceId?: string | null
  invoiceAmount?: number | null
  invoiceNumber?: string | null
  customTitle?: string | null
  organizationId?: string | null
  prefillClientName?: string | null
  prefillDocument?: string | null
  onPaymentSuccess?: () => void
}

export function PixPaymentCheckoutModal({
  isOpen,
  onClose,
  initialPlanId,
  contractInvoiceId,
  invoiceAmount,
  invoiceNumber,
  customTitle,
  organizationId,
  prefillClientName,
  prefillDocument,
  onPaymentSuccess,
}: PixPaymentCheckoutModalProps) {
  const { user } = useAuth()
  const { currentOrganization, reloadOrganizations } = useOrganization()

  const [step, setStep] = useState<'select_plan' | 'pix_generated' | 'approved'>('select_plan')
  const [plans, setPlans] = useState<AccessPlan[]>(SYSTEM_DEFAULT_ACCESS_PLANS)
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    initialPlanId || SYSTEM_DEFAULT_ACCESS_PLANS[0]?.id || '',
  )

  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [transaction, setTransaction] = useState<MercadoPagoPixTransaction | null>(null)
  const [copiedPix, setCopiedPix] = useState(false)
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(1800) // 30 minutos

  const unsubscribeRef = useRef<(() => void) | null>(null)
  const pollIntervalRef = useRef<any>(null)

  // Carrega planos disponíveis do banco
  useEffect(() => {
    if (!isOpen) return
    let isMounted = true

    void accessPlanService.listPublic().then((planList) => {
      if (isMounted && planList && planList.length > 0) {
        setPlans(planList)
        if (!initialPlanId && !selectedPlanId) {
          setSelectedPlanId(planList[0].id)
        }
      }
    })

    return () => {
      isMounted = false
    }
  }, [isOpen, initialPlanId])

  // Se já veio com fatura predefinida, pula direto para a geração do PIX
  useEffect(() => {
    if (isOpen && contractInvoiceId && invoiceAmount) {
      setStep('select_plan')
    }
  }, [isOpen, contractInvoiceId, invoiceAmount])

  // Timer regressivo para expiração do PIX
  useEffect(() => {
    if (step !== 'pix_generated' || timeLeftSeconds <= 0) return

    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [step, timeLeftSeconds])

  // Escuta confirmação do pagamento em Realtime e realiza polling preventivo
  useEffect(() => {
    if (step !== 'pix_generated' || !transaction) return

    // 1. Inscrição Supabase Realtime
    unsubscribeRef.current = mercadopagoService.subscribeToTransaction(
      transaction.id,
      (updated) => {
        if (updated.status === 'approved' || updated.licenseActivated) {
          handlePaymentApproved()
        }
      },
    )

    // 2. Polling de verificação a cada 4 segundos caso o websocket oscile
    if (transaction.mpPaymentId) {
      const mpId = transaction.mpPaymentId
      pollIntervalRef.current = setInterval(async () => {
        const check = await mercadopagoService.checkPaymentStatus(mpId)
        if (check.success && check.data?.isApproved) {
          handlePaymentApproved()
        }
      }, 4000)
    }

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current()
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [step, transaction?.id, transaction?.mpPaymentId])

  const handlePaymentApproved = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    if (unsubscribeRef.current) unsubscribeRef.current()
    setStep('approved')
    void reloadOrganizations()
    if (onPaymentSuccess) {
      onPaymentSuccess()
    }
  }

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0]
  const finalAmount = invoiceAmount || selectedPlan?.monthlyPrice || 99.9

  const handleGeneratePix = async () => {
    const targetOrgId = organizationId || currentOrganization?.id || user?.id || '00000000-0000-0000-0000-000000000000'

    setIsGenerating(true)
    setErrorMessage(null)

    const payerName =
      prefillClientName ||
      (user?.user_metadata?.name as string | undefined) ||
      (user?.user_metadata?.full_name as string | undefined) ||
      currentOrganization?.name ||
      'Cliente JB'
    const payerEmail = user?.email || 'contato@jbsoftware.com.br'

    const res = await mercadopagoService.createPixPayment({
      organizationId: targetOrgId,
      accessPlanId: selectedPlan?.id,
      accessPlanName: invoiceNumber
        ? `Fatura #${invoiceNumber}`
        : selectedPlan?.name || 'Licença JB Gestão',
      contractInvoiceId: contractInvoiceId || undefined,
      amount: finalAmount,
      description: invoiceNumber
        ? `Pagamento de Fatura #${invoiceNumber} - ${prefillClientName || currentOrganization?.name || 'Cliente'}`
        : `Licença Mensal: ${selectedPlan?.name || 'JB Gestão'} - ${currentOrganization?.name || 'Cliente'}`,
      payerName,
      payerEmail,
      payerDocument: prefillDocument || undefined,
    })

    setIsGenerating(false)

    if (res.success) {
      setTransaction(res.data)
      setTimeLeftSeconds(1800)
      setStep('pix_generated')
    } else {
      setErrorMessage(
        res.error ||
          'Não foi possível gerar a cobrança PIX no Mercado Pago. Verifique as credenciais nas Configurações do Sistema.',
      )
    }
  }

  const handleCopyPix = () => {
    if (!transaction?.qrCode) return
    void navigator.clipboard.writeText(transaction.qrCode)
    setCopiedPix(true)
    setTimeout(() => setCopiedPix(false), 2500)
  }

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in-50 zoom-in-95">
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-xs">
              <QrCode className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base leading-tight">
                  {step === 'approved'
                    ? 'Pagamento Confirmado'
                    : customTitle || (invoiceNumber ? `Pagamento da Fatura #${invoiceNumber}` : 'Pagamento de Licença via PIX')}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/25 text-white">
                  <Zap className="w-3 h-3" /> Mercado Pago Oficial
                </span>
              </div>
              <p className="text-xs text-emerald-100">
                {prefillClientName || currentOrganization?.name || 'Sua Empresa'} • Liberação Instantânea
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-emerald-100 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* CONTEÚDO */}
        <div className="p-6 space-y-6">
          {/* ETAPA 1: ESCOLHA DO PLANO OU CONFIRMAÇÃO DO VALOR */}
          {step === 'select_plan' && (
            <div className="space-y-5">
              {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 space-y-2">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-bold block mb-0.5">Atenção ao gerar PIX:</span>
                      <p className="leading-relaxed">{errorMessage}</p>
                    </div>
                  </div>
                  {errorMessage.includes('Credencial') && (
                    <div className="pt-2 border-t border-rose-200 dark:border-rose-800/60 flex items-center justify-between">
                      <span className="text-[11px] text-rose-700 dark:text-rose-400">
                        Configure o Access Token oficial da sua conta em Configurações do Desenvolvedor.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          window.location.href = '/developer-settings'
                        }}
                        className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition cursor-pointer"
                      >
                        Abrir Configurações
                      </button>
                    </div>
                  )}
                </div>
              )}

              {invoiceNumber ? (
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400">
                    Fatura Selecionada
                  </span>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-base font-bold text-gray-900 dark:text-white">
                        Fatura #{invoiceNumber}
                      </div>
                      <div className="text-xs text-slate-500">
                        Renovação de acesso ao sistema
                      </div>
                    </div>
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(finalAmount.toFixed(2))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                    Escolha a Licença / Plano Desejado:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {plans.map((p) => {
                      const isSelected = selectedPlanId === p.id
                      const price = p.monthlyPrice ?? 99.9
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPlanId(p.id)}
                          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/40 shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-gray-900 dark:text-white">
                                {p.name}
                              </span>
                              {isSelected && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                              {p.description}
                            </p>
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-baseline justify-between">
                            <span className="text-[10px] uppercase font-bold text-slate-400">
                              Mensalidade
                            </span>
                            <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(price.toFixed(2))}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Card de Resumo & Benefícios */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Garantia de Liberação Automática
                </div>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  Ao realizar o pagamento via PIX, o Mercado Pago identifica a transferência em segundos e nosso sistema desbloqueia ou estende seu plano imediatamente, sem necessidade de enviar comprovante.
                </p>
              </div>

              {/* Botão de Ação */}
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => void handleGeneratePix()}
                className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Gerando QR Code PIX no Mercado Pago...
                  </>
                ) : (
                  <>
                    <span>Gerar PIX • {formatCurrency(finalAmount.toFixed(2))}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* ETAPA 2: QR CODE DINÂMICO & ESPERA AUTOMÁTICA */}
          {step === 'pix_generated' && transaction && (
            <div className="space-y-6 text-center">
              {/* Valor e Timer */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="text-left">
                  <span className="text-[11px] uppercase font-bold text-slate-400 block">
                    Valor a Pagar
                  </span>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(transaction.amount.toFixed(2))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100/80 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  Expira em: {formatTimer(timeLeftSeconds)}
                </div>
              </div>

              {/* QR Code Oficial em Alta Resolução */}
              <div className="flex flex-col items-center justify-center p-4 rounded-3xl bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-800 shadow-inner">
                {transaction.qrCodeBase64 ? (
                  <img
                    src={`data:image/png;base64,${transaction.qrCodeBase64}`}
                    alt="QR Code PIX Mercado Pago"
                    className="w-56 h-56 object-contain rounded-xl p-2 bg-white"
                  />
                ) : transaction.qrCode ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                      transaction.qrCode,
                    )}`}
                    alt="QR Code PIX"
                    className="w-56 h-56 object-contain rounded-xl p-2 bg-white"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-slate-400">
                    Carregando QR Code...
                  </div>
                )}
                <span className="text-[11px] text-slate-400 mt-2">
                  Abra o aplicativo do seu banco e escaneie o código
                </span>
              </div>

              {/* Código PIX Copia e Cola */}
              <div className="space-y-2 text-left">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Ou pague via PIX Copia e Cola:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={transaction.qrCode || ''}
                    className="flex-1 h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className={`h-11 px-5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                      copiedPix
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800'
                    }`}
                  >
                    {copiedPix ? (
                      <>
                        <Check className="w-4 h-4" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> Copiar Código
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* MENSAGEM OBRIGATÓRIA DE AGUARDO */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-center gap-3 text-left">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-5 h-5 animate-spin text-amber-600 dark:text-amber-400" />
                </div>
                <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                  <span className="font-bold block mb-0.5">Aguardando confirmação do pagamento:</span>
                  Assim que o PIX for identificado, seu sistema será liberado automaticamente.
                </div>
              </div>

              {/* Botões de Ação Auxiliares */}
              <div className="pt-2 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setStep('select_plan')}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer font-medium"
                >
                  ← Trocar plano / licença
                </button>

                {transaction.ticketUrl && (
                  <a
                    href={transaction.ticketUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                  >
                    Comprovante no Mercado Pago <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ETAPA 3: APROVADO COM SUCESSO & LIBERAÇÃO IMEDIATA */}
          {step === 'approved' && (
            <div className="py-8 text-center space-y-6 animate-in fade-in-50 zoom-in-95">
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-10 h-10 animate-bounce" />
              </div>

              <div className="space-y-2">
                <h4 className="text-2xl font-black text-gray-900 dark:text-white">
                  Pagamento aprovado! Seu acesso foi liberado com sucesso.
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  A confirmação foi recebida pelo Mercado Pago. A licença da sua empresa está ativa e todas as funcionalidades foram desbloqueadas.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-xs text-emerald-900 dark:text-emerald-200 max-w-sm mx-auto flex items-center justify-between">
                <span className="font-bold">Status do Sistema:</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black uppercase">
                  <Sparkles className="w-3.5 h-3.5" /> Acesso 100% Liberado
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
              >
                <span>Acessar o Sistema Agora</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
