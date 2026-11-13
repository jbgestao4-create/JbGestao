import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  QrCode,
  Copy,
  Check,
  X,
  AlertCircle,
  Printer,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import type { ContractInvoice, SoftwareContract } from '@modules/companies/services/contract.service'

interface InvoicePixModalProps {
  isOpen: boolean
  invoice: ContractInvoice | null
  contract?: SoftwareContract | null
  onClose: () => void
  onOpenInvoicePrint?: () => void
}

export function InvoicePixModal({
  isOpen,
  invoice,
  contract,
  onClose,
  onOpenInvoicePrint,
}: InvoicePixModalProps) {
  const [copiedKey, setCopiedKey] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !invoice) return null

  // Chave PIX da fatura ou da empresa licenciante
  const pixKey =
    invoice.pixKey ||
    contract?.licensorEmail ||
    'contato@jbsoftware.com.br'

  const receiverName =
    contract?.licensorName || 'JB SOFTWARE & TECNOLOGIA LTDA'
  const receiverDocument =
    contract?.licensorDocument || '00.000.000/0001-00'

  const handleCopy = () => {
    void navigator.clipboard.writeText(pixKey)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2500)
  }

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 bg-emerald-600 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20">
              <QrCode className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                Pagamento via PIX • Fatura #{invoice.invoiceNumber}
              </h3>
              <p className="text-xs text-emerald-100">
                Mês Ref: {invoice.referenceMonth} • Vencimento: {invoice.dueDate.split('-').reverse().join('/')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-emerald-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-5 text-gray-800 dark:text-slate-200">
          
          {/* Card de Valor */}
          <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-emerald-800 dark:text-emerald-400 block">
                Valor a Pagar
              </span>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                {formatCurrency(invoice.amount.toFixed(2))}
              </div>
            </div>

            <div className="text-right text-xs">
              <span className="text-gray-500 dark:text-slate-400 block font-medium">Favorecido:</span>
              <span className="font-bold text-gray-900 dark:text-white block">{receiverName}</span>
              <span className="font-mono text-[11px] text-gray-500">{receiverDocument}</span>
            </div>
          </div>

          {/* Box da Chave PIX com botão Copiar */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-400">
              Chave PIX Oficial (E-mail / Chave Cadastrada):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={pixKey}
                className="w-full font-mono text-sm font-bold bg-gray-50 dark:bg-slate-800 px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 select-all"
              />
              <Button
                type="button"
                onClick={handleCopy}
                className={`gap-1.5 font-bold shrink-0 shadow-xs transition-all ${
                  copiedKey
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {copiedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedKey ? 'Copiada!' : 'Copiar Chave'}
              </Button>
            </div>
          </div>

          {/* Instruções de Pagamento */}
          <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40 p-4 space-y-2 text-xs">
            <h4 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-emerald-600" />
              Como realizar o pagamento:
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-slate-300 leading-relaxed">
              <li>Abra o aplicativo do seu banco ou instituição financeira.</li>
              <li>Acesse a área <strong>PIX</strong> e escolha <strong>Transferir / Pagar com Chave</strong>.</li>
              <li>Cole a chave <strong>{pixKey}</strong> e confirme o valor de <strong>{formatCurrency(invoice.amount.toFixed(2))}</strong>.</li>
              <li>Confira o nome do favorecido (<strong>{receiverName}</strong>) e conclua a transferência.</li>
            </ol>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 pt-1">
              💡 Após o pagamento, a baixa é realizada pelo sistema. Caso deseje agilizar a liberação imediata, você pode enviar o comprovante pelo chat de suporte.
            </p>
          </div>

        </div>

        {/* Rodapé de Ações */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/60 flex items-center justify-between">
          {onOpenInvoicePrint ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onClose()
                onOpenInvoicePrint()
              }}
              className="gap-1.5 text-xs text-blue-700 border-blue-300 hover:bg-blue-50 dark:text-blue-300 dark:border-blue-800"
            >
              <Printer className="h-3.5 w-3.5" />
              Ver Boleto / Fatura Impressa
            </Button>
          ) : (
            <div />
          )}

          <Button type="button" onClick={onClose} className="text-xs">
            Concluir
          </Button>
        </div>

      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null
}
