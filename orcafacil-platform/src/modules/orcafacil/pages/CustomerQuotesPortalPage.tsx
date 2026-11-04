import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Lock,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  XCircle,
} from 'lucide-react'
import { formatCurrency } from '@shared/utils/monetary'
import { formatCustomerDocument } from '@modules/customers/utils/customer-document'
import {
  customerPortalService,
  type CustomerPortalData,
  type CustomerPortalPublicInfo,
  type PortalQuote,
} from '../services/customer-portal.service'
import type { QuoteDetail } from '../services/quote.service'
import { downloadQuotePdf } from '../utils/quote-pdf'
import type { QuoteStatus } from '@shared/types/database'

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  draft: {
    label: 'Rascunho',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  sent: {
    label: 'Em Aberto',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  approved: {
    label: 'Aprovado',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  rejected: {
    label: 'Recusado',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
  },
  completed: {
    label: 'Concluído',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
  },
}

function getPortalStatusConfig(q: PortalQuote) {
  if (q.status === 'approved') {
    if (q.approvedBy === 'client' || q.approvedBy === 'customer') {
      return {
        label: 'Aprovado pelo cliente',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-800',
      }
    }
    return {
      label: 'Aprovado pelo usuário',
      bg: 'bg-teal-50 dark:bg-teal-950/40',
      text: 'text-teal-700 dark:text-teal-300',
      border: 'border-teal-200 dark:border-teal-800',
    }
  }
  return STATUS_LABELS[q.status] || STATUS_LABELS.draft
}

export function CustomerQuotesPortalPage() {
  const { token } = useParams<{ token: string }>()

  const [loadingInfo, setLoadingInfo] = useState(true)
  const [publicInfo, setPublicInfo] = useState<CustomerPortalPublicInfo | null>(null)
  const [infoError, setInfoError] = useState<string | null>(null)

  // Validação do Documento
  const [docInput, setDocInput] = useState('')
  const [validatingDoc, setValidatingDoc] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Dados Desbloqueados
  const [portalData, setPortalData] = useState<CustomerPortalData | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedQuotes, setExpandedQuotes] = useState<Record<string, boolean>>({})

  // Aprovação de Orçamento pelo Cliente
  const [quoteToApprove, setQuoteToApprove] = useState<PortalQuote | null>(null)
  const [isApproving, setIsApproving] = useState(false)
  const [quoteToReject, setQuoteToReject] = useState<PortalQuote | null>(null)
  const [isRejecting, setIsRejecting] = useState(false)
  const [approvalFeedback, setApprovalFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // 1. Carrega informações preliminares do token público
  useEffect(() => {
    let isMounted = true

    async function loadTokenInfo() {
      if (!token) {
        setInfoError('Link de acesso inválido.')
        setLoadingInfo(false)
        return
      }

      setLoadingInfo(true)
      setInfoError(null)

      try {
        const res = await customerPortalService.getPublicInfo(token)
        if (!isMounted) return

        if (res.success) {
          setPublicInfo(res.data)
        } else {
          setInfoError(res.error || 'Link não encontrado ou expirado.')
        }
      } catch {
        if (isMounted) {
          setInfoError('Não foi possível verificar a autenticidade do link.')
        }
      } finally {
        if (isMounted) {
          setLoadingInfo(false)
        }
      }
    }

    void loadTokenInfo()

    return () => {
      isMounted = false
    }
  }, [token])

  // Quando os dados são carregados, expande o orçamento em destaque
  useEffect(() => {
    if (portalData?.highlightedQuoteId) {
      setExpandedQuotes({ [portalData.highlightedQuoteId]: true })
    }
  }, [portalData])

  // 2. Manipula envio de CPF/CNPJ
  const handleValidateDocument = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!token) return

    const clean = docInput.replace(/\D/g, '')
    if (clean.length !== 11 && clean.length !== 14) {
      setValidationError('Digite um CPF válido (11 dígitos) ou CNPJ (14 dígitos).')
      return
    }

    setValidationError(null)
    setValidatingDoc(true)

    try {
      const res = await customerPortalService.accessQuotes(token, clean)
      if (res.success) {
        setPortalData(res.data)
      } else {
        setValidationError(
          res.error || 'O CPF/CNPJ informado não coincide com os dados deste orçamento.',
        )
      }
    } catch {
      setValidationError('Erro de comunicação. Tente novamente em instantes.')
    } finally {
      setValidatingDoc(false)
    }
  }

  // 3. Download do PDF de um orçamento
  const handleDownloadPdf = (q: PortalQuote) => {
    if (!portalData) return

    const quoteDetailForPdf: QuoteDetail = {
      id: q.id,
      organizationId: portalData.organization.id,
      customerId: portalData.customer.id,
      customerName: portalData.customer.name,
      customerPhone: portalData.customer.phone || null,
      customerEmail: portalData.customer.email || null,
      customerAddress: portalData.customer.address || null,
      quoteNumber: q.quoteNumber,
      status: q.status,
      subtotal: q.subtotal,
      discount: q.discount,
      total: q.total,
      validUntil: q.validUntil,
      notes: q.notes,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
      creatorName: null,
      sellerName: q.sellerName || null,
      items: q.items,
    }

    try {
      downloadQuotePdf(quoteDetailForPdf, {
        organizationName: portalData.organization.name,
      })
    } catch {
      alert('Não foi possível gerar o arquivo PDF no momento.')
    }
  }

  // 4. Abertura do WhatsApp da empresa para tirar dúvidas ou aprovar
  const handleContactCompany = (quote?: PortalQuote, intent: 'doubt' | 'approve' = 'doubt') => {
    if (!portalData?.organization.phone) return

    const digits = portalData.organization.phone.replace(/\D/g, '')
    if (!digits) return

    const formattedPhone = digits.startsWith('55') ? digits : `55${digits}`

    let text = `Olá, ${portalData.organization.name}! Sou ${portalData.customer.name}.\n`
    if (quote) {
      if (intent === 'approve') {
        text += `Gostaria de confirmar a *aprovação do Orçamento nº ${quote.quoteNumber}* no valor total de *${formatCurrency(quote.total)}*. Como podemos prosseguir?`
      } else {
        text += `Estou visualizando o *Orçamento nº ${quote.quoteNumber}* (Valor: ${formatCurrency(quote.total)}) pelo portal e tenho algumas dúvidas.`
      }
    } else {
      text += `Acessei meu portal de orçamentos e gostaria de falar com a equipe de atendimento.`
    }

    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`, '_blank')
  }

  // 5. Confirmação direta da aprovação do orçamento pelo cliente
  const handleConfirmApproval = async () => {
    if (!token || !quoteToApprove) return
    setIsApproving(true)
    setApprovalFeedback(null)

    try {
      const res = await customerPortalService.approveQuote(token, quoteToApprove.id)
      if (res.success) {
        setPortalData((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            quotes: prev.quotes.map((q) =>
              q.id === quoteToApprove.id
                ? {
                    ...q,
                    status: 'approved' as QuoteStatus,
                    approvedBy: 'client',
                    approvedAt: new Date().toISOString(),
                  }
                : q,
            ),
          }
        })
        setApprovalFeedback({
          type: 'success',
          message: `Orçamento #${quoteToApprove.quoteNumber} aprovado com sucesso!`,
        })
        setQuoteToApprove(null)
      } else {
        setApprovalFeedback({
          type: 'error',
          message: res.error || 'Não foi possível aprovar o orçamento.',
        })
      }
    } catch {
      setApprovalFeedback({
        type: 'error',
        message: 'Erro inesperado ao aprovar o orçamento. Tente novamente.',
      })
    } finally {
      setIsApproving(false)
    }
  }

  // 6. Confirmação direta da recusa do orçamento pelo cliente
  const handleConfirmRejection = async () => {
    if (!token || !quoteToReject) return
    setIsRejecting(true)
    setApprovalFeedback(null)

    try {
      const res = await customerPortalService.rejectQuote(token, quoteToReject.id)
      if (res.success) {
        setPortalData((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            quotes: prev.quotes.map((q) =>
              q.id === quoteToReject.id
                ? {
                    ...q,
                    status: 'rejected' as QuoteStatus,
                    approvedBy: null,
                    approvedAt: null,
                  }
                : q,
            ),
          }
        })
        setApprovalFeedback({
          type: 'success',
          message: `Orçamento #${quoteToReject.quoteNumber} recusado.`,
        })
        setQuoteToReject(null)
      } else {
        setApprovalFeedback({
          type: 'error',
          message: res.error || 'Não foi possível recusar o orçamento.',
        })
      }
    } catch {
      setApprovalFeedback({
        type: 'error',
        message: 'Erro inesperado ao recusar o orçamento. Tente novamente.',
      })
    } finally {
      setIsRejecting(false)
    }
  }

  // Filtragem dos orçamentos
  const filteredQuotes = useMemo(() => {
    if (!portalData?.quotes) return []

    return portalData.quotes.filter((q) => {
      const matchesStatus = statusFilter === 'all' || q.status === statusFilter
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch =
        !term ||
        q.quoteNumber.toLowerCase().includes(term) ||
        (q.notes && q.notes.toLowerCase().includes(term)) ||
        q.items.some((item) => item.description.toLowerCase().includes(term))

      return matchesStatus && matchesSearch
    })
  }, [portalData, statusFilter, searchTerm])

  const toggleExpand = (id: string) => {
    setExpandedQuotes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // ESTADO DE CARREGAMENTO INICIAL
  if (loadingInfo) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-4">
          <RefreshCw className="h-10 w-10 text-emerald-600 animate-spin mx-auto" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Localizando seu Orçamento...
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Aguarde um instante enquanto verificamos a segurança do link de acesso.
          </p>
        </div>
      </div>
    )
  }

  // ESTADO DE LINK INVÁLIDO OU EXPIRADO
  if (infoError || !publicInfo) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-8 border border-rose-200 dark:border-rose-900/50 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Link Não Encontrado ou Expirado
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {infoError || 'Este link de orçamento não está mais disponível ou expirou.'}
          </p>
          <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl text-xs text-slate-500 dark:text-slate-400">
            Por motivos de segurança e sigilo de propostas comerciais, os links de consulta possuem prazo de validade. Entre em contato com a empresa para receber um novo link atualizado.
          </div>
        </div>
      </div>
    )
  }

  // ESTADO 1: TELA DE CONFIRMAÇÃO DO CPF/CNPJ
  if (!portalData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-emerald-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col justify-between p-4 sm:p-6">
        {/* Top Header */}
        <header className="max-w-md mx-auto w-full flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              JB
            </div>
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
              {publicInfo.organizationName}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
            <Lock className="h-3 w-3" /> Conexão Segura
          </div>
        </header>

        {/* Card Principal de Autenticação */}
        <main className="max-w-md mx-auto w-full my-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                Portal de Orçamentos
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Olá, <strong className="text-slate-800 dark:text-slate-200">{publicInfo.customerName}</strong>! 👋
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p className="leading-relaxed">
                Para sua privacidade e proteção de dados, confirme o seu <strong>CPF ou CNPJ</strong> para desbloquear a visualização completa dos seus orçamentos com a <strong>{publicInfo.organizationName}</strong>.
              </p>
              {publicInfo.maskedDocument && (
                <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700">
                  <span>Documento cadastrado:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {publicInfo.maskedDocument}
                  </span>
                </div>
              )}
            </div>

            {/* Formulário de Validação */}
            <form onSubmit={handleValidateDocument} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="portal-cpf-input"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Digite o seu CPF ou CNPJ:
                </label>
                <div className="relative">
                  <input
                    id="portal-cpf-input"
                    type="tel"
                    autoFocus
                    placeholder="000.000.000-00"
                    value={docInput}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '')
                      setDocInput(
                        formatCustomerDocument(digits, digits.length > 11 ? 'company' : 'individual'),
                      )
                      if (validationError) setValidationError(null)
                    }}
                    className="w-full h-12 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-base font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="absolute right-3.5 top-3.5 text-slate-400">
                    <User className="h-5 w-5" />
                  </div>
                </div>
              </div>

              {validationError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-200">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                  <span>{validationError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={validatingDoc || !docInput.trim()}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] font-bold text-sm text-white shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {validatingDoc ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Verificando dados...
                  </>
                ) : (
                  <>
                    Acessar Meus Orçamentos <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-2">
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                🔒 Acesso direto e criptografado exclusivo para o cliente destinatário.
              </p>
            </div>
          </div>
        </main>

        <footer className="text-center py-4 text-xs text-slate-400">
          © {new Date().getFullYear()} {publicInfo.organizationName} • Todos os direitos reservados
        </footer>
      </div>
    )
  }

  // ESTADO 2: PORTAL DESBLOQUEADO (TODOS OS ORÇAMENTOS DO CLIENTE)
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Bar Fixa */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
              JB
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {portalData.organization.name}
              </h1>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Portal de Orçamentos do Cliente
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 font-medium">
              <ShieldCheck className="h-3.5 w-3.5" /> Acesso Verificado
            </span>

            {portalData.organization.phone && (
              <button
                type="button"
                onClick={() => handleContactCompany()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Falar no</span> WhatsApp
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setPortalData(null)
                setDocInput('')
              }}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Encerrar visualização segura"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-6">
        {/* Banner de Boas-Vindas */}
        <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-900 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="relative z-10 space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-xs">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
              Histórico Completo de Propostas
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Olá, {portalData.customer.name}!
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
              Aqui você tem acesso transparente e seguro a todos os orçamentos emitidos para você pela <strong>{portalData.organization.name}</strong>. Baixe os PDFs oficiais e tire dúvidas diretamente com nossa equipe.
            </p>
          </div>

          <div className="absolute right-4 -bottom-6 opacity-10 pointer-events-none">
            <FileText className="w-56 h-56" />
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Busca */}
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por número do orçamento ou produto/serviço..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Filtros Rápidos */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Todos ({portalData.quotes.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('sent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'sent'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Em Aberto
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'approved'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Aprovados
            </button>
          </div>
        </div>

        {/* Mensagem de Feedback de Aprovação */}
        {approvalFeedback && (
          <div
            className={`rounded-2xl p-4 text-xs font-medium flex items-center justify-between border ${
              approvalFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {approvalFeedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <span>{approvalFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setApprovalFeedback(null)}
              className="text-xs underline font-semibold cursor-pointer ml-3 hover:opacity-80"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Lista de Orçamentos */}
        {filteredQuotes.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
            <FileText className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">
              Nenhum orçamento encontrado
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Nenhum orçamento corresponde aos filtros selecionados. Tente alterar o termo de busca.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredQuotes.map((q) => {
              const isHighlighted = portalData.highlightedQuoteId === q.id
              const isExpanded = Boolean(expandedQuotes[q.id])
              const statusCfg = getPortalStatusConfig(q)
              const isExpired = q.validUntil ? new Date(q.validUntil) < new Date() : false
              const canCustomerApprove = q.status === 'sent' || q.status === 'draft'

              return (
                <div
                  key={q.id}
                  className={`rounded-2xl border transition duration-200 bg-white dark:bg-slate-900 shadow-sm overflow-hidden ${
                    isHighlighted
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  {/* Badge de Orçamento Recente / Destacado */}
                  {isHighlighted && (
                    <div className="bg-emerald-600 text-white px-4 py-1 text-[11px] font-bold flex items-center gap-1.5 tracking-wide uppercase">
                      <Sparkles className="h-3 w-3" /> Proposta Recente Encaminhada
                    </div>
                  )}

                  {/* Header do Orçamento */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                          #{q.quoteNumber}
                        </span>

                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                        >
                          {statusCfg.label}
                        </span>

                        {q.validUntil && (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${
                              isExpired
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            <Calendar className="h-3 w-3" />
                            {isExpired
                              ? `Venceu em ${new Date(q.validUntil).toLocaleDateString('pt-BR')}`
                              : `Válido até ${new Date(q.validUntil).toLocaleDateString('pt-BR')}`}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span>Emissão: {new Date(q.createdAt).toLocaleDateString('pt-BR')}</span>
                        {q.sellerName && <span>• Atendido por: {q.sellerName}</span>}
                        <span>• {q.items.length} {q.items.length === 1 ? 'item' : 'itens'}</span>
                      </div>
                    </div>

                    {/* Preço e Botões Rápidos */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                      <div className="text-left sm:text-right">
                        <span className="text-[11px] text-slate-400 block font-medium">Valor Total</span>
                        <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                          {formatCurrency(q.total)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {canCustomerApprove && (
                          <>
                            <button
                              type="button"
                              onClick={() => setQuoteToApprove(q)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:shadow-sm transition cursor-pointer"
                              title="Aprovar este orçamento agora"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Aprovar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setQuoteToReject(q)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 active:scale-[0.98] px-3.5 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 shadow-xs hover:shadow-sm transition cursor-pointer"
                              title="Recusar este orçamento"
                            >
                              <XCircle className="h-4 w-4" />
                              <span>Recusar</span>
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(q)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs transition cursor-pointer"
                          title="Baixar arquivo PDF desta proposta"
                        >
                          <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          <span className="hidden sm:inline">Baixar</span> PDF
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleExpand(q.id)}
                          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                        >
                          {isExpanded ? 'Ocultar Itens' : 'Ver Detalhes'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Detalhes Expansíveis (Itens, Observações e Ações Comerciais) */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4 sm:p-6 space-y-4">
                      {/* Tabela de Itens */}
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                          <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                              <th className="py-2.5 px-3">Item / Descrição</th>
                              <th className="py-2.5 px-3 text-center">Qtd</th>
                              <th className="py-2.5 px-3 text-right">Valor Unit.</th>
                              <th className="py-2.5 px-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                            {q.items.map((item, idx) => (
                              <tr key={item.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                <td className="py-2.5 px-3">
                                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                                    {item.description}
                                  </span>
                                  {item.unit && (
                                    <span className="text-[10px] text-slate-400 ml-1.5 uppercase font-mono">
                                      ({item.unit})
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono">{item.quantity}</td>
                                <td className="py-2.5 px-3 text-right font-mono">
                                  {formatCurrency(item.unitPrice)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                  {formatCurrency(item.total)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Resumo Financeiro */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="space-y-1">
                          {q.notes && (
                            <p className="text-slate-600 dark:text-slate-400">
                              <strong className="text-slate-800 dark:text-slate-200">Observações:</strong> {q.notes}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1 text-right shrink-0">
                          {Number(q.discount) > 0 && (
                            <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                              Subtotal: {formatCurrency(q.subtotal)} | Desconto: -{formatCurrency(q.discount)}
                            </div>
                          )}
                          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            Total: {formatCurrency(q.total)}
                          </div>
                        </div>
                      </div>

                      {/* Botões de Decisão e Contato */}
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        {canCustomerApprove && (
                          <>
                            <button
                              type="button"
                              onClick={() => setQuoteToApprove(q)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition cursor-pointer"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Aprovar Orçamento
                            </button>
                            <button
                              type="button"
                              onClick={() => setQuoteToReject(q)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 active:scale-[0.98] px-4 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 shadow-xs transition cursor-pointer"
                            >
                              <XCircle className="h-4 w-4" />
                              Recusar Orçamento
                            </button>
                          </>
                        )}

                        {portalData.organization.phone && (
                          <button
                            type="button"
                            onClick={() => handleContactCompany(q, 'doubt')}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                          >
                            <MessageCircle className="h-3.5 w-3.5 text-slate-500" />
                            Tirar Dúvidas no WhatsApp
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-400">
        <p>
          Portal Oficial de Orçamentos de <strong>{portalData.organization.name}</strong> • Conexão Segura
        </p>
      </footer>

      {/* Modal de Confirmação de Aprovação pelo Cliente */}
      {quoteToApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Aprovar Orçamento
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  #{quoteToApprove.quoteNumber} • {formatCurrency(quoteToApprove.total)}
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Você deseja confirmar a aprovação deste orçamento? Ao aprovar, o status será atualizado para <strong className="text-emerald-600 dark:text-emerald-400">Aprovado pelo cliente</strong> e a equipe da <strong>{portalData.organization.name}</strong> dará andamento ao seu pedido.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isApproving}
                onClick={() => setQuoteToApprove(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isApproving}
                onClick={() => void handleConfirmApproval()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isApproving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Aprovando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Sim, Confirmar Aprovação
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Recusa pelo Cliente */}
      {quoteToReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <XCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Recusar Orçamento
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  #{quoteToReject.quoteNumber} • {formatCurrency(quoteToReject.total)}
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Você deseja recusar este orçamento? Ao confirmar, o status será atualizado para <strong className="text-rose-600 dark:text-rose-400">Recusado</strong> e a equipe da <strong>{portalData.organization.name}</strong> poderá entrar em contato caso deseje uma nova proposta ajustada.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isRejecting}
                onClick={() => setQuoteToReject(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isRejecting}
                onClick={() => void handleConfirmRejection()}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-xs font-bold text-white shadow-md shadow-rose-600/20 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isRejecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Recusando...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" /> Sim, Confirmar Recusa
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default CustomerQuotesPortalPage
