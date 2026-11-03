import { useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  MessageCircle,
  Paperclip,
  Phone,
  Share2,
  X,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import type { QuoteDetail, QuoteListItem } from '../services/quote.service'
import { buildQuoteWhatsAppMessage, openQuoteWhatsApp } from '../utils/quote-whatsapp'
import { createQuotePdfFile, downloadQuotePdf } from '../utils/quote-pdf'

interface SendQuoteWhatsAppModalProps {
  open: boolean
  quote: QuoteListItem | QuoteDetail | null
  quoteDetail: QuoteDetail | null
  organizationName?: string
  onClose: () => void
  onSent?: () => void
}

interface DialogContentProps {
  quote: QuoteListItem | QuoteDetail
  quoteDetail: QuoteDetail | null
  organizationName?: string
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
  onClose,
  onSent,
}: DialogContentProps) {
  const initialPhone =
    quoteDetail?.customerPhone ??
    quote.customerPhone ??
    ''

  const [phone, setPhone] = useState(initialPhone || '')
  const [phoneError, setPhoneError] = useState('')
  const [copied, setCopied] = useState(false)
  const [pdfDownloaded, setPdfDownloaded] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [canNativeShare] = useState(() => checkCanNativeShare())
  const [sendSuccessStep, setSendSuccessStep] = useState(false)

  const dataToUse: QuoteDetail = quoteDetail ?? {
    ...quote,
    creatorName: null,
    customerEmail: null,
    customerAddress: null,
    customerPhone: phone || quote.customerPhone || null,
    items: [],
    notes: null,
  }

  const message = buildQuoteWhatsAppMessage(dataToUse, organizationName)

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

    // 1. Se o dispositivo suporta envio direto de arquivo (Mobile / sistemas com Share nativo):
    if (canNativeShare) {
      try {
        const file = createQuotePdfFile(dataToUse, { organizationName })
        await navigator.share({
          files: [file],
          title: `Orçamento nº ${dataToUse.quoteNumber}`,
          text: message,
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

    // Abre a conversa no WhatsApp Web com o texto do orçamento
    const opened = openQuoteWhatsApp(cleanDigits, message)
    if (opened) {
      setSendSuccessStep(true)
      onSent?.()
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
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
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Botão fechar */}
        <button
          type="button"
          onClick={() => {
            onClose()
          }}
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200 transition"
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
                  O arquivo <strong>Orcamento_{quote.quoteNumber}.pdf</strong> foi baixado no seu computador e a conversa com o cliente foi aberta.
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
                  Enviar Orçamento em PDF via WhatsApp
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  O orçamento foi marcado como <strong>Enviado</strong>. Deseja enviar a proposta em formato PDF para o WhatsApp do cliente?
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
                  {quote.quoteNumber}
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

            {/* Aviso sobre o PDF anexado */}
            <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 p-2.5 text-xs text-blue-800 dark:text-blue-300">
              <FileText className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Proposta em arquivo PDF</p>
                <p className="text-[11px] mt-0.5 opacity-90">
                  {canNativeShare
                    ? 'O PDF da proposta será anexado diretamente ao WhatsApp através do compartilhamento do seu dispositivo.'
                    : 'Ao confirmar, o PDF é baixado imediatamente e a conversa do WhatsApp abre para você anexá-lo (arrastando ou clicando em 📎 Anexar).'}
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
                {showPreview ? 'Ocultar prévia da mensagem' : 'Ver prévia do texto da mensagem'}
              </button>

              {showPreview && (
                <div className="mt-2 relative">
                  <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/70 p-3 text-[11px] font-sans text-gray-700 dark:text-slate-300">
                    {message}
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      void handleCopy()
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
                        <Copy className="h-3 w-3" /> Copiar
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
                  Não, apenas salvar
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
                    Enviar PDF no WhatsApp
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    Enviar PDF e Abrir WhatsApp
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
      onClose={onClose}
      onSent={onSent}
    />
  )
}
