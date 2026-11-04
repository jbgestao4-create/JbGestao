import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import { FileSpreadsheet, X, FileDown, User, ShoppingCart } from 'lucide-react'
import type { QuoteDetail } from '@modules/orcafacil/services/quote.service'
import { downloadQuotePdf } from '@modules/orcafacil/utils/quote-pdf'
import { getStatusBadgeClasses, getStatusLabel } from '@modules/orcafacil/domain/quote-status'

interface LinkedQuoteModalProps {
  open: boolean
  quote: QuoteDetail | null
  organizationName?: string
  onClose: () => void
}

export function LinkedQuoteModal({ open, quote, organizationName, onClose }: LinkedQuoteModalProps) {
  if (!open || !quote) return null

  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(quote.createdAt))

  const validUntilFormatted = quote.validUntil
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(quote.validUntil))
    : '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900">
                  Orçamento {quote.quoteNumber}
                </h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClasses(
                    quote.status,
                    quote.approvedBy || (quote.status === 'approved' ? 'user' : undefined),
                  )}`}
                >
                  {getStatusLabel(
                    quote.status,
                    quote.approvedBy || (quote.status === 'approved' ? 'user' : undefined),
                  )}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Emitido em {formattedDate} · Válido até {validUntilFormatted}
              </p>
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

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Informações Comerciais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 text-xs">
            <div>
              <p className="font-semibold text-gray-700">Cliente</p>
              <p className="text-gray-900 text-sm font-bold mt-0.5">{quote.customerName}</p>
              {quote.customerEmail && <p className="text-gray-500">{quote.customerEmail}</p>}
              {quote.customerPhone && <p className="text-gray-500">{quote.customerPhone}</p>}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-gray-700">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-medium">Orçado por:</span>
                <span className="font-bold text-gray-900">{quote.creatorName || 'Sistema'}</span>
              </div>
              {quote.sellerName && (
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <ShoppingCart className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-medium">Vendido por:</span>
                  <span className="font-bold">{quote.sellerName}</span>
                </div>
              )}
              {quote.saleNumber && (
                <div className="text-blue-700 font-semibold">
                  Venda gerada: {quote.saleNumber}
                </div>
              )}
            </div>
          </div>

          {/* Tabela de Itens */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Itens do Orçamento
            </h4>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase font-semibold">
                  <tr>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-center">Qtd</th>
                    <th className="px-3 py-2 text-right">Unitário</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {quote.items.map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2">
                        {item.itemType === 'service' || item.serviceId ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-700/20">
                            Serviço
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-inset ring-blue-700/20">
                            Material
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900">{item.description}</td>
                      <td className="px-3 py-2 text-center text-gray-600">
                        {item.quantity} {item.unit || ''}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900">
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totais */}
          <div className="ml-auto w-full sm:w-64 space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span>{formatCurrency(quote.subtotal)}</span>
            </div>
            {Number(quote.discount) > 0 && (
              <div className="flex justify-between text-red-600 font-medium">
                <span>Desconto:</span>
                <span>- {formatCurrency(quote.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200 pt-1.5">
              <span>Total:</span>
              <span className="text-base text-emerald-600">{formatCurrency(quote.total)}</span>
            </div>
          </div>

          {/* Observações */}
          {quote.notes && (
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 text-xs">
              <p className="font-semibold text-gray-700 mb-1">Observações:</p>
              <p className="text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-4 bg-gray-50 flex items-center justify-between">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => downloadQuotePdf(quote, { organizationName })}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <FileDown className="h-4 w-4" />
            Baixar PDF do Orçamento
          </Button>
        </div>
      </div>
    </div>
  )
}
