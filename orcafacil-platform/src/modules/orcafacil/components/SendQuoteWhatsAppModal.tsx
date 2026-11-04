import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  Link2,
  Lock,
  MessageCircle,
  Paperclip,
  Phone,
  RefreshCw,
  Share2,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import { customerService } from '@modules/customers/services/customer.service'
import { formatCustomerDocument } from '@modules/customers/utils/customer-document'
import type { QuoteDetail, QuoteListItem } from '../services/quote.service'
import { customerPortalService } from '../services/customer-portal.service'
import { buildQuoteWhatsAppMessage, openQuoteWhatsApp } from '../utils/quote-whatsapp'
import { createQuotePdfFile, downloadQuotePdf } from '../utils/quote-pdf'

interface SendQuoteWhatsAppModalProps {
  open: boolean
  quote: QuoteListItem | QuoteDetail | null
  quoteDetail: QuoteDetail | null
  organizationName?: string
  organizationId?: string
  onClose: () => void
  onSent?: () => void
}

interface DialogContentProps {
  quote: QuoteListItem | QuoteDetail
  quoteDetail: QuoteDetail | null
  organizationName?: string
  organizationId?: string
  onClose: () => void
  onSent?: () => void
}

function checkCanNativeShare(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
    try {
      const testFile = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      return navigator.canShare({ files: [testFile] })
    } catch {
      return false
    }
  }
  return false
}

function SendQuoteWhatsAppDialog({
  quote,
  quoteDetail,
  organizationName,
  organizationId,
  onClose,
  onSent,
}: DialogContentProps) {
  const effectiveOrgId = organizationId || quoteDetail?.organizationId || quote.organizationId
  const effectiveCustId = quoteDetail?.customerId || quote.customerId

  const initialPhone =
    quoteDetail?.customerPhone ??
    quote.customerPhone ??
    ''

  const [phone, setPhone] = useState(initialPhone || '')
  const [phoneError, setPhoneError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [pdfDownloaded, setPdfDownloaded] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [canNativeShare] = useState(() => checkCanNativeShare())
  const [sendSuccessStep, setSendSuccessStep] = useState(false)

  // Estados do Link Seguro do Portal
  const [portalUrl, setPortalUrl] = useState('')
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [hasDocument, setHasDocument] = useState<boolean | null>(null)
  const [docInput, setDocInput] = useState('')
  const [docError, setDocError] = useState('')
  const [isSavingDoc, setIsSavingDoc] = useState(false)
  const [docSavedSuccess, setDocSavedSuccess] = useState(false)

  // Função para resolver ou garantir a URL do portal antes de qualquer envio
  const resolvePortalUrl = async (): Promise<string> => {
    if (portalUrl) return portalUrl
    if (!effectiveOrgId || !effectiveCustId) return ''

    setIsGeneratingLink(true)
    try {
      const tokenRes = await customerPortalService.generateToken(
        effectiveOrgId,
        effectiveCustId,
        quote.id,
      )

      if (tokenRes.success && tokenRes.data.token) {
        const url = customerPortalService.buildPortalUrl(tokenRes.data.token)
        setPortalUrl(url)
        return url
      }
    } catch {
      // Falha
    } finally {
      setIsGeneratingLink(false)
    }
    return ''
  }

  // Carrega informações do cliente e gera o token do portal na abertura do modal
  useEffect(() => {
    let isMounted = true

    async function loadPortalLink() {
      if (!effectiveOrgId || !effectiveCustId) return

      setIsGeneratingLink(true)
      try {
        // 1. Busca dados do cliente para verificar documento
        const custRes = await customerService.getById(effectiveOrgId, effectiveCustId)
        const doc = custRes.success && custRes.data.document ? custRes.data.document.trim() : ''

        if (isMounted) {
          if (doc) {
            setHasDocument(true)
            setDocInput(doc)
          } else {
            setHasDocument(false)
          }
        }

        // 2. Gera o token do portal
        const tokenRes = await customerPortalService.generateToken(
          effectiveOrgId,
          effectiveCustId,
          quote.id,
        )

        if (isMounted && tokenRes.success && tokenRes.data.token) {
          const url = customerPortalService.buildPortalUrl(tokenRes.data.token)
          setPortalUrl(url)
        }
      } catch {
        // Falha silenciosa na geração automática
      } finally {
        if (isMounted) {
          setIsGeneratingLink(false)
        }
      }
    }

    void loadPortalLink()

    return () => {
      isMounted = false
    }
  }, [effectiveOrgId, effectiveCustId, quote.id])

  const dataToUse: QuoteDetail = quoteDetail ?? {
    ...quote,
    creatorName: null,
    customerEmail: null,
    customerAddress: null,
    customerPhone: phone || quote.customerPhone || null,
    items: [],
    notes: null,
  }

  // Mensagem calculada reativamente para preview
  const currentMessage = buildQuoteWhatsAppMessage(
    dataToUse,
    organizationName,
    portalUrl || undefined,
  )

  const handleSaveDocument = async () => {
    const cleanDigits = docInput.replace(/\D/g, '')
    if (cleanDigits.length !== 11 && cleanDigits.length !== 14) {
      setDocError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.')
      return
    }

    if (!effectiveOrgId || !effectiveCustId) return

    setDocError('')
    setIsSavingDoc(true)

    try {
      const formattedDoc = formatCustomerDocument(
        cleanDigits,
        cleanDigits.length === 11 ? 'individual' : 'company',
      )

      const updateRes = await customerService.update(effectiveOrgId, effectiveCustId, {
        document: formattedDoc,
      })

      if (updateRes.success) {
        setHasDocument(true)
        setDocSavedSuccess(true)
        setTimeout(() => setDocSavedSuccess(false), 3000)

        // Se ainda não tiver portalUrl, gera agora
        if (!portalUrl) {
          void resolvePortalUrl()
        }
      } else {
        setDocError(updateRes.error || 'Erro ao salvar documento do cliente.')
      }
    } catch {
      setDocError('Erro ao atualizar documento.')
    } finally {
      setIsSavingDoc(false)
    }
  }

  const handleDownloadPdf = () => {
    try {
      downloadQuotePdf(dataToUse, { organizationName })
      setPdfDownloaded(true)
      setTimeout(() => {
        setPdfDownloaded(false)
      }, 3000)
    } catch {
      // Falha silenciosa
    }
  }

  const handleSend = async () => {
    const cleanDigits = phone.replace(/\D/g, '')
    if (cleanDigits.length < 10) {
      setPhoneError('Informe um número de WhatsApp válido com DDD (mínimo 10 dígitos).')
      return
    }

    setPhoneError('')

    // Garante que o link do portal foi obtido antes de montar a mensagem final
    const activeUrl = await resolvePortalUrl()
    const finalMessage = buildQuoteWhatsAppMessage(
      dataToUse,
      organizationName,
      activeUrl || undefined,
    )

    // 1. Se o dispositivo suporta envio direto de arquivo (Mobile / sistemas com Share nativo):
    if (canNativeShare) {
      try {
        const file = createQuotePdfFile(dataToUse, { organizationName })
        await navigator.share({
          files: [file],
          title: `Orçamento nº ${dataToUse.quoteNumber}`,
          text: finalMessage,
        })
        onSent?.()
        onClose()
        return
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
      }
    }

    // 2. No Desktop / WhatsApp Web:
    // Baixa o arquivo PDF da proposta comercial
    try {
      downloadQuotePdf(dataToUse, { organizationName })
    } catch {
      // Prossegue mesmo se o download automático falhar
    }

    // Abre a conversa no WhatsApp Web com o texto do orçamento contendo o link exclusivo
    const opened = openQuoteWhatsApp(cleanDigits, finalMessage)
    if (opened) {
      setSendSuccessStep(true)
      onSent?.()
    }
  }

  const handleCopyMessage = async () => {
    try {
      const activeUrl = await resolvePortalUrl()
      const finalMessage = buildQuoteWhatsAppMessage(
        dataToUse,
        organizationName,
        activeUrl || undefined,
      )
      await navigator.clipboard.writeText(finalMessage)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch {
      // Falha silenciosa
    }
  }

  const handleCopyLink = async () => {
    const activeUrl = await resolvePortalUrl()
    if (!activeUrl) return
    try {
      await navigator.clipboard.writeText(activeUrl)
      setCopiedLink(true)
      setTimeout(() => {
        setCopiedLink(false)
      }, 2000)
    } catch {
      // Falha silenciosa
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Botão fechar */}
        <button
          type="button"
          onClick={() => {
            onClose()
          }}
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200 transition cursor-pointer"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {sendSuccessStep ? (
          /* Tela de Instrução pós-abertura do WhatsApp Web */
          <div className="space-y-4 py-1">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  WhatsApp Aberto e PDF Baixado!
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  O arquivo <strong>Orcamento_{quote.quoteNumber}.pdf</strong> foi baixado no seu computador e a conversa com o cliente foi aberta com o link do portal incluso.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 p-3.5 text-xs text-blue-900 dark:text-blue-200 space-y-2">
              <p className="font-semibold flex items-center gap-1.5">
                <Paperclip className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Como anexar o PDF na conversa:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-blue-800 dark:text-blue-300 text-[11.5px]">
                <li>
                  <strong>Arraste o arquivo PDF baixado</strong> diretamente para dentro da janela do WhatsApp Web, <em>ou</em>
                </li>
                <li>
                  Na janela do WhatsApp, clique no ícone de clips (<strong>📎 Anexar</strong>), selecione <strong>Documento</strong> e escolha o PDF baixado.
                </li>
              </ol>
            </div>

            {portalUrl && (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-900 dark:text-emerald-200">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Link2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Link do Portal de Orçamentos do Cliente:
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <span className="truncate text-[11px] font-mono text-gray-700 dark:text-slate-300">
                    {portalUrl}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="shrink-0 p-1 text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 cursor-pointer"
                    title="Copiar link"
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                <FileDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Baixar PDF novamente
              </button>
              <Button
                type="button"
                onClick={() => {
                  onClose()
                }}
              >
                Concluir
              </Button>
            </div>
          </div>
        ) : (
          /* Formulário Principal */
          <>
            {/* Cabeçalho */}
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <MessageCircle className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2
                  id="whatsapp-modal-title"
                  className="text-lg font-bold text-gray-900 dark:text-white"
                >
                  Enviar Orçamento via WhatsApp
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  O cliente receberá o PDF e um <strong>link seguro com validação por CPF</strong> para consultar todos os orçamentos já gerados.
                </p>
              </div>
            </div>

            {/* Resumo do Orçamento */}
            <div className="mt-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60 p-3.5 text-xs text-gray-700 dark:text-slate-300 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {quote.customerName}
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  #{quote.quoteNumber}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-500 dark:text-slate-400">
                <span>Data: {new Date(quote.createdAt).toLocaleDateString('pt-BR')}</span>
                <span className="font-bold text-sm text-gray-900 dark:text-white">
                  Total: {formatCurrency(quote.total)}
                </span>
              </div>
              {quoteDetail && quoteDetail.items.length > 0 && (
                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  {String(quoteDetail.items.length)} {quoteDetail.items.length === 1 ? 'item detalhado no PDF' : 'itens detalhados no PDF'}.
                </p>
              )}
            </div>

            {/* BLOCO DO LINK SEGURO DO PORTAL */}
            <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Link Exclusivo do Portal do Cliente
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                  <Lock className="h-2.5 w-2.5" /> Protegido por CPF
                </span>
              </div>

              {isGeneratingLink && !portalUrl ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 py-1">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                  <span>Gerando link seguro de visualização...</span>
                </div>
              ) : portalUrl ? (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      readOnly
                      value={portalUrl}
                      className="w-full rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-gray-700 dark:text-slate-300 font-mono select-all focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyLink()}
                    className="inline-flex items-center gap-1 shrink-0 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700 transition cursor-pointer"
                    title="Copiar Link"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copiar Link
                      </>
                    )}
                  </button>
                  <a
                    href={portalUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center p-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700 transition cursor-pointer"
                    title="Abrir página do cliente em nova aba para testar"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ) : null}

              {/* Aviso caso cliente não tenha CPF cadastrado */}
              {hasDocument === false && (
                <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <span>
                      <strong>Atenção:</strong> Este cliente não possui CPF/CNPJ cadastrado. Para que ele consiga desbloquear os orçamentos pelo link com segurança, informe o CPF/CNPJ:
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      value={docInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '')
                        setDocInput(
                          formatCustomerDocument(val, val.length > 11 ? 'company' : 'individual'),
                        )
                        if (docError) setDocError('')
                      }}
                      className="flex-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-gray-900 dark:text-slate-100 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      disabled={isSavingDoc}
                      onClick={() => void handleSaveDocument()}
                      className="shrink-0 rounded-lg bg-amber-600 dark:bg-amber-700 hover:bg-amber-500 px-3 py-1 text-xs font-semibold text-white transition cursor-pointer disabled:opacity-50"
                    >
                      {isSavingDoc ? 'Salvando...' : 'Salvar Documento'}
                    </button>
                  </div>
                  {docError && <p className="text-[11px] text-red-600 dark:text-red-400">{docError}</p>}
                </div>
              )}

              {docSavedSuccess && (
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="h-3 w-3" /> CPF/CNPJ salvo com sucesso! O cliente poderá acessar pelo link.
                </p>
              )}
            </div>

            {/* Aviso sobre o PDF anexado */}
            <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 p-2.5 text-xs text-blue-800 dark:text-blue-300">
              <FileText className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Proposta em arquivo PDF + Link Seguro</p>
                <p className="text-[11px] mt-0.5 opacity-90">
                  {canNativeShare
                    ? 'O PDF será compartilhado diretamente no WhatsApp junto com o texto contendo o link exclusivo.'
                    : 'Ao clicar em enviar, o PDF é baixado e a conversa do WhatsApp abre com o link para você colar/anexar o arquivo.'}
                </p>
              </div>
            </div>

            {/* Campo do WhatsApp */}
            <div className="mt-4 space-y-2">
              <label
                htmlFor="whatsapp-phone-input"
                className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-slate-300"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  Número do WhatsApp com DDD:
                </span>
                {quoteDetail?.customerPhone && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    (Cadastrado no cliente)
                  </span>
                )}
              </label>

              <input
                id="whatsapp-phone-input"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value)
                  if (phoneError) setPhoneError('')
                }}
                placeholder="(11) 98888-7777"
                className="h-10 w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              {!phone && (
                <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-2 text-[11px] text-amber-800 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <span>
                    Este cliente não possui telefone cadastrado. Digite o número com DDD para encaminhar o orçamento.
                  </span>
                </div>
              )}

              {phoneError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{phoneError}</p>
              )}
            </div>

            {/* Pré-visualização da mensagem */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  setShowPreview((prev) => !prev)
                }}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {showPreview ? 'Ocultar prévia da mensagem' : 'Ver prévia do texto da mensagem (com link)'}
              </button>

              {showPreview && (
                <div className="mt-2 relative">
                  <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/70 p-3 text-[11px] font-sans text-gray-700 dark:text-slate-300">
                    {currentMessage}
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      void handleCopyMessage()
                    }}
                    className="absolute top-2 right-2 inline-flex items-center gap-1 rounded bg-white dark:bg-slate-800 px-2 py-1 text-[10px] font-medium text-gray-600 dark:text-slate-300 shadow-xs border border-gray-200 dark:border-slate-700 hover:bg-gray-50 cursor-pointer"
                    title="Copiar mensagem"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copiar Texto
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Botões de Ação */}
            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2.5">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onClose()
                  }}
                >
                  Fechar
                </Button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition cursor-pointer"
                  title="Baixar apenas o arquivo PDF"
                >
                  {pdfDownloaded ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" /> PDF Baixado
                    </>
                  ) : (
                    <>
                      <FileDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Baixar PDF
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleSend()
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 active:scale-[0.99] transition cursor-pointer"
              >
                {canNativeShare ? (
                  <>
                    <Share2 className="h-4 w-4" aria-hidden="true" />
                    Enviar no WhatsApp
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    Enviar e Abrir WhatsApp
                    <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function SendQuoteWhatsAppModal({
  open,
  quote,
  quoteDetail,
  organizationName,
  organizationId,
  onClose,
  onSent,
}: SendQuoteWhatsAppModalProps) {
  if (!open || !quote) return null

  return (
    <SendQuoteWhatsAppDialog
      key={quote.id}
      quote={quote}
      quoteDetail={quoteDetail}
      organizationName={organizationName}
      organizationId={organizationId}
      onClose={onClose}
      onSent={onSent}
    />
  )
}
