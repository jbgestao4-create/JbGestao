import { useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageCircle,
  Phone,
  Wrench,
  X,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import { openQuoteWhatsApp } from '@modules/orcafacil/utils/quote-whatsapp'
import type { ServiceOrderDetail, ServiceOrderListItem } from '../domain/service-order'

interface SendServiceOrderWhatsAppModalProps {
  open: boolean
  order: ServiceOrderListItem | ServiceOrderDetail | null
  organizationName?: string
  onClose: () => void
  onSent?: () => void
}

export function buildServiceOrderReadyWhatsAppMessage(
  order: ServiceOrderListItem | ServiceOrderDetail,
  organizationName?: string,
): string {
  const brandModel = [order.equipmentBrand, order.equipmentModel].filter(Boolean).join(' ')
  const equipFull = brandModel ? `${order.equipmentName} (${brandModel})` : order.equipmentName

  let msg = `Olá, *${order.customerName}*!\n\n`
  msg += `Informamos que o seu equipamento referente à *Ordem de Serviço nº ${order.orderNumber}* já se encontra *PRONTO* para retirada! ✅\n\n`
  msg += `🔧 *RESUMO DA ORDEM DE SERVIÇO:*\n`
  msg += `• *Número da O.S.:* #${order.orderNumber}\n`
  msg += `• *Equipamento:* ${equipFull}\n`
  if (order.serialNumber) {
    msg += `• *Nº de Série / IMEI:* ${order.serialNumber}\n`
  }
  if (order.solutionApplied?.trim()) {
    msg += `• *Serviço / Solução Realizada:* ${order.solutionApplied.trim()}\n`
  }
  msg += `• *Status:* Pronto para retirada\n`
  if (Number(order.total) > 0) {
    msg += `• *Valor Total:* *${formatCurrency(order.total)}*\n`
  }
  msg += `\nVocê já pode comparecer ao nosso estabelecimento para retirar o seu equipamento.\n\n`
  msg += `_Nota: Os testes técnicos, termos de garantia e o sigilo de eventuais credenciais/dados de diagnóstico são de responsabilidade exclusiva de ${organizationName || 'nossa assistência técnica'}, conforme autorizado na abertura da O.S._\n\n`
  msg += `Qualquer dúvida, estamos à inteira disposição!\n`
  msg += `*${organizationName || 'ControleSoft'}*`

  return msg
}

function SendServiceOrderWhatsAppDialog({
  order,
  organizationName,
  onClose,
  onSent,
}: {
  order: ServiceOrderListItem | ServiceOrderDetail
  organizationName?: string
  onClose: () => void
  onSent?: () => void
}) {
  const [phone, setPhone] = useState(order.customerPhone || '')
  const [phoneError, setPhoneError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const [sendSuccessStep, setSendSuccessStep] = useState(false)

  const currentMessage = buildServiceOrderReadyWhatsAppMessage(order, organizationName)

  const handleSend = () => {
    const cleanDigits = phone.replace(/\D/g, '')
    if (cleanDigits.length < 10) {
      setPhoneError('Informe um número de WhatsApp válido com DDD (mínimo 10 dígitos).')
      return
    }

    setPhoneError('')
    const opened = openQuoteWhatsApp(cleanDigits, currentMessage)
    if (opened) {
      setSendSuccessStep(true)
      onSent?.()
    }
  }

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(currentMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="os-whatsapp-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200 transition cursor-pointer"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {sendSuccessStep ? (
          <div className="space-y-4 py-1">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  WhatsApp Aberto para o Cliente!
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  A conversa com <strong>{order.customerName}</strong> foi aberta em uma nova aba informando que o equipamento da O.S. <strong>{order.orderNumber}</strong> já se encontra pronto.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button type="button" onClick={onClose}>
                Concluir
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Cabeçalho */}
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <MessageCircle className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2
                  id="os-whatsapp-modal-title"
                  className="text-lg font-bold text-gray-900 dark:text-white"
                >
                  Avisar Cliente via WhatsApp — Equipamento Pronto
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  Envie uma mensagem automática informando ao cliente que o equipamento da O.S. já se encontra pronto para retirada.
                </p>
              </div>
            </div>

            {/* Resumo da O.S. */}
            <div className="mt-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60 p-3.5 text-xs text-gray-700 dark:text-slate-300 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {order.customerName}
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  #{order.orderNumber}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-slate-300">
                <Wrench className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>
                  Equipamento: <strong>{order.equipmentName}</strong>
                  {[order.equipmentBrand, order.equipmentModel].filter(Boolean).length > 0 &&
                    ` (${[order.equipmentBrand, order.equipmentModel].filter(Boolean).join(' ')})`}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-500 dark:text-slate-400 pt-0.5">
                <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  Status: Pronto
                </span>
                <span className="font-bold text-sm text-gray-900 dark:text-white">
                  Total: {formatCurrency(order.total)}
                </span>
              </div>
            </div>

            {/* Campo do WhatsApp */}
            <div className="mt-4 space-y-2">
              <label
                htmlFor="os-whatsapp-phone-input"
                className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-slate-300"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  Número do WhatsApp do Cliente com DDD:
                </span>
                {order.customerPhone && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    (Cadastrado na O.S.)
                  </span>
                )}
              </label>

              <input
                id="os-whatsapp-phone-input"
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
                    Informe o número de telefone com DDD para enviar o aviso pelo WhatsApp.
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
                onClick={() => setShowPreview((prev) => !prev)}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {showPreview ? 'Ocultar prévia da mensagem' : 'Ver prévia do texto da mensagem'}
              </button>

              {showPreview && (
                <div className="mt-2 relative">
                  <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/70 p-3 text-[11px] font-sans text-gray-700 dark:text-slate-300">
                    {currentMessage}
                  </pre>
                  <button
                    type="button"
                    onClick={() => void handleCopyMessage()}
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
              <Button type="button" variant="outline" onClick={onClose}>
                Fechar
              </Button>

              <button
                type="button"
                onClick={handleSend}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 active:scale-[0.99] transition cursor-pointer"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Enviar e Abrir WhatsApp
                <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function SendServiceOrderWhatsAppModal({
  open,
  order,
  organizationName,
  onClose,
  onSent,
}: SendServiceOrderWhatsAppModalProps) {
  if (!open || !order) return null

  return (
    <SendServiceOrderWhatsAppDialog
      key={order.id}
      order={order}
      organizationName={organizationName}
      onClose={onClose}
      onSent={onSent}
    />
  )
}

