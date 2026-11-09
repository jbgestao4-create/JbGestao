import { useEffect, useRef } from 'react'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import { CheckCircle2, Printer, QrCode, X } from 'lucide-react'
import type { SaleDetail } from '../services/sales.service'
import { PAYMENT_METHOD_LABELS } from '../services/sales.service'

interface SaleReceiptModalProps {
  open: boolean
  sale: SaleDetail | null
  onClose: () => void
}

export function SaleReceiptModal({ open, sale, onClose }: SaleReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' || e.key.toLowerCase() === 'p') {
        e.preventDefault()
        window.print()
      }
    }
    if (open) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open || !sale) return null

  const handlePrint = () => {
    window.print()
  }

  const fullYearDate = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(sale.createdAt))

  return (
    <div className="sale-receipt-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs print:bg-white print:p-0">
      <style>{`
        @media print {
          @page { margin: 4mm; }
          body * { visibility: hidden !important; }
          .sale-receipt-print, .sale-receipt-print * { visibility: visible !important; }
          .sale-receipt-print {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl print:max-h-none print:max-w-none print:rounded-none print:shadow-none">
        {/* Header do Modal */}
        <div className="flex items-center justify-between border-b border-gray-100 p-4 print:hidden">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Comprovante de Venda</h3>
              <p className="text-xs text-gray-500">{sale.saleNumber}</p>
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

        {/* Conteúdo do Comprovante (Formato Térmico / Cupom) */}
        <div className="flex-1 overflow-y-auto p-6 print:overflow-visible print:p-0">
          <div
            ref={receiptRef}
            className="sale-receipt-print mx-auto space-y-4 rounded-xl border border-dashed border-gray-300 bg-white p-5 font-mono text-xs text-gray-800 print:space-y-3 print:border-none print:bg-white print:p-0 print:text-black"
          >
            {/* Cabeçalho do Cupom */}
            <div className="text-center border-b border-gray-200 pb-3">
              <img src="/controlesoft-logo.png" alt="ControleSoft" className="mx-auto mb-2 h-14 object-contain" />
              <p className="font-bold text-sm tracking-wider uppercase">CONTROLESOFT</p>
              <p className="text-[11px] text-gray-500 mt-0.5">COMPROVANTE DE VENDA NÃO FISCAL</p>
              <p className="text-[10px] text-gray-400 mt-1">{fullYearDate}</p>
              <p className="text-xs font-semibold text-gray-900 mt-1">Pedido: {sale.saleNumber}</p>
              {(sale.sellerName || sale.operatorName) && (
                <p className="text-[10px] text-gray-600 mt-0.5">
                  Vendedor: {sale.sellerName || sale.operatorName}
                </p>
              )}
              {sale.originQuoteNumber && (
                <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                  Origem: Orçamento {sale.originQuoteNumber}
                  {sale.originQuoteCreatorName && ` (Orçado por ${sale.originQuoteCreatorName})`}
                </p>
              )}
            </div>

            {/* Dados do Cliente */}
            <div className="border-b border-gray-200 pb-3 text-[11px] space-y-0.5">
              <p>
                <span className="font-semibold">Cliente:</span> {sale.customerName}
              </p>
              {sale.customerDocument && (
                <p>
                  <span className="font-semibold">CPF/CNPJ:</span> {sale.customerDocument}
                </p>
              )}
              {sale.customerAddress && (
                <p className="truncate">
                  <span className="font-semibold">End:</span> {sale.customerAddress}
                </p>
              )}
            </div>

            {/* Tabela de Itens */}
            <div className="border-b border-gray-200 pb-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 font-bold text-[10px] border-b border-gray-200 pb-1 mb-1">
                <span>ITEM</span>
                <span className="text-right">QTD X VL</span>
                <span className="min-w-[4.5rem] text-right">TOTAL</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                {sale.items.map((it, idx) => (
                  <div key={it.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-2">
                    <div className="min-w-0 truncate">
                      <span className="text-gray-400 mr-1">{idx + 1}.</span>
                      <span className="font-medium text-gray-900">{it.description}</span>
                      {it.itemType === 'service' && (
                        <span className="ml-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded">
                          (Serviço)
                        </span>
                      )}
                    </div>
                    <div className="whitespace-nowrap text-right text-gray-600">
                      {it.quantity} {it.unit} x {formatCurrency(it.unitPrice)}
                    </div>
                    <div className="min-w-[4.5rem] whitespace-nowrap text-right font-semibold text-gray-900">
                      {formatCurrency(it.total)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totais & Pagamento */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(sale.subtotal)}</span>
              </div>
              {Number(sale.productsSubtotal) > 0 && Number(sale.servicesSubtotal) > 0 && (
                <>
                  <div className="flex justify-between text-gray-500 text-[10px] pl-2">
                    <span>• Materiais:</span>
                    <span>{formatCurrency(sale.productsSubtotal || '0.00')}</span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-[10px] pl-2">
                    <span>• Serviços:</span>
                    <span>{formatCurrency(sale.servicesSubtotal || '0.00')}</span>
                  </div>
                </>
              )}
              {Number(sale.discount) > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Desconto:</span>
                  <span>- {formatCurrency(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-1.5 text-sm font-bold text-gray-900">
                <span>TOTAL PAGO:</span>
                <span className="text-base text-blue-700">{formatCurrency(sale.total)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-gray-500 pt-1">
                <span>Forma de Pagamento:</span>
                <span className="font-semibold text-gray-800">
                  {PAYMENT_METHOD_LABELS[sale.paymentMethod]}
                </span>
              </div>
            </div>

            {/* Seção Fiscal NFC-e (Se emitida) */}
            {sale.fiscalInvoice && (
              <div className="border-t-2 border-dashed border-gray-300 pt-3 text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                  <QrCode className="h-4 w-4" />
                  <span>NFC-e EMITIDA E AUTORIZADA</span>
                </div>
                <p className="text-[10px] text-gray-500">
                  Protocolo: {sale.fiscalInvoice.protocol} · Série: {sale.fiscalInvoice.series} · Nº: {sale.fiscalInvoice.number}
                </p>
                <div className="rounded bg-gray-100 p-2 break-all text-[9px] text-gray-600">
                  <p className="font-semibold text-gray-700 mb-0.5">Chave de Acesso:</p>
                  {sale.fiscalInvoice.accessKey}
                </div>
                <p className="text-[10px] text-gray-400">Consulte pela Chave de Acesso no portal da SEFAZ</p>
              </div>
            )}

            {/* Rodapé */}
            <div className="text-center pt-2 text-[10px] text-gray-400">
              <p>Obrigado pela preferência!</p>
              <p className="mt-0.5">Volte sempre!</p>
            </div>
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 p-4 print:hidden">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            [Esc] Fechar
          </Button>
          <Button type="button" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            [Enter] Imprimir Comprovante
          </Button>
        </div>
      </div>
    </div>
  )
}
