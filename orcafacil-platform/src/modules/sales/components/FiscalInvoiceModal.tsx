import { useState } from 'react'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import { Check, Download, FileText, Printer, QrCode, ShieldCheck, X } from 'lucide-react'
import { salesService, type FiscalInvoiceData, type SaleDetail } from '../services/sales.service'

interface FiscalInvoiceModalProps {
  open: boolean
  sale: SaleDetail | null
  organizationId: string
  onClose: () => void
  onEmitted?: (invoice: FiscalInvoiceData) => void
}

export function FiscalInvoiceModal({
  open,
  sale,
  organizationId,
  onClose,
  onEmitted,
}: FiscalInvoiceModalProps) {
  const [isEmitting, setIsEmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<'nfce' | 'nfe'>('nfce')
  const [currentInvoice, setCurrentInvoice] = useState<FiscalInvoiceData | null>(
    sale?.fiscalInvoice || null,
  )

  if (!open || !sale) return null

  const handleEmit = async () => {
    setIsEmitting(true)
    setError(null)
    const res = await salesService.emitFiscalInvoice(organizationId, sale.id, selectedType)
    setIsEmitting(false)
    if (res.success) {
      setCurrentInvoice(res.data)
      onEmitted?.(res.data)
    } else {
      setError(res.error)
    }
  }

  const handlePrintDanfe = () => {
    window.print()
  }

  const invoice = currentInvoice || sale.fiscalInvoice

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {invoice ? 'Nota Fiscal Emitida' : 'Emissão de Nota Fiscal'}
              </h3>
              <p className="text-xs text-gray-500">Venda: {sale.saleNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {invoice ? (
            /* Nota já emitida */
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <span>
                    {invoice.type === 'nfce' ? 'NFC-e (Nota de Consumidor)' : 'NF-e (Nota Fiscal Eletrônica)'} AUTORIZADA
                  </span>
                </div>
                <p className="text-xs text-emerald-700 mt-1">
                  Documento fiscal autorizado com sucesso pela SEFAZ.
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 space-y-3 bg-gray-50/50 text-xs">
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-gray-200">
                  <div>
                    <span className="text-gray-500 block">Número / Série:</span>
                    <span className="font-semibold text-gray-900">
                      Nº {invoice.number} · Série {invoice.series}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Protocolo SEFAZ:</span>
                    <span className="font-semibold text-gray-900">{invoice.protocol}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Data de Emissão:</span>
                    <span className="font-semibold text-gray-900">
                      {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
                        new Date(invoice.emittedAt),
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Valor Total:</span>
                    <span className="font-bold text-blue-700 text-sm">
                      {formatCurrency(sale.total)}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-gray-500 block mb-1">Chave de Acesso (44 dígitos):</span>
                  <div className="rounded-lg border border-gray-200 bg-white p-2.5 font-mono text-[11px] text-gray-800 break-all select-all">
                    {invoice.accessKey}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-gray-600">
                    <QrCode className="h-6 w-6 text-gray-700" />
                    <div>
                      <p className="text-[11px] font-semibold text-gray-800">QR Code da SEFAZ</p>
                      <p className="text-[10px] text-gray-400">Consulta via celular disponível</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    STATUS 100 - AUTORIZADO
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Formulário de Emissão */
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/70 space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-200">
                  <span className="text-gray-500">Destinatário:</span>
                  <span className="font-semibold text-gray-900">{sale.customerName}</span>
                </div>
                <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-200">
                  <span className="text-gray-500">Total dos Produtos:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(sale.total)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Qtd de Itens:</span>
                  <span className="font-semibold text-gray-900">{sale.items.length} item(ns)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Tipo de Documento Fiscal:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedType('nfce')}
                    className={`flex flex-col p-3 rounded-xl border text-left transition ${
                      selectedType === 'nfce'
                        ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xs font-bold text-gray-900">NFC-e (Mod. 65)</span>
                    <span className="text-[11px] text-gray-500 mt-0.5">
                      Cupom Fiscal Eletrônico ao Consumidor Final
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedType('nfe')}
                    className={`flex flex-col p-3 rounded-xl border text-left transition ${
                      selectedType === 'nfe'
                        ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xs font-bold text-gray-900">NF-e (Mod. 55)</span>
                    <span className="text-[11px] text-gray-500 mt-0.5">
                      Nota Fiscal Eletrônica Padrão Nacional
                    </span>
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3.5 text-xs text-blue-900 space-y-1">
                <p className="font-semibold">Informações Tributárias Automáticas:</p>
                <p className="text-[11px] text-blue-700">
                  CFOP 5.102 · Tributação Simples Nacional · Chave de acesso e protocolo gerados instantaneamente.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-4 bg-gray-50 flex items-center justify-between gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>

          {invoice ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  alert('Download do arquivo XML da nota fiscal simulado com sucesso.')
                }}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" />
                Baixar XML
              </Button>
              <Button type="button" size="sm" onClick={handlePrintDanfe} className="gap-1.5">
                <Printer className="h-4 w-4" />
                Imprimir DANFE
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              isLoading={isEmitting}
              onClick={() => void handleEmit()}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Check className="h-4 w-4" />
              Transmitir e Emitir Nota
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

