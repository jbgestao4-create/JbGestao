import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import { Printer, X } from 'lucide-react'
import {
  SERVICE_ORDER_PRIORITY_LABELS,
  SERVICE_ORDER_STATUS_LABELS,
  type ServiceOrderDetail,
} from '../domain/service-order'

interface ServiceOrderPrintModalProps {
  open: boolean
  order: ServiceOrderDetail | null
  organizationName?: string
  onClose: () => void
}

export function ServiceOrderPrintModal({
  open,
  order,
  organizationName,
  onClose,
}: ServiceOrderPrintModalProps) {
  if (!open || !order) return null

  const productItems = order.items.filter((i) => i.itemType === 'product')
  const serviceItems = order.items.filter((i) => i.itemType === 'service')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto print:bg-white print:p-0">
      <div className="w-full max-w-4xl rounded-2xl bg-white text-gray-900 shadow-2xl border border-gray-200 max-h-[92vh] flex flex-col print:max-h-none print:shadow-none print:border-none">
        {/* Barra Superior (oculta na impressão) */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 print:hidden">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Visualização da Ordem de Serviço — {order.orderNumber}
            </h3>
            <p className="text-xs text-gray-500">
              Imprima o comprovante de entrada/saída com fotos, avarias, peças e serviços
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              <Printer className="h-4 w-4" />
              Imprimir O.S.
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo da O.S. */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs leading-relaxed print:overflow-visible print:p-2">
          {/* Cabeçalho */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b-2 border-gray-900 pb-4 gap-2">
            <div>
              <h1 className="text-lg font-extrabold uppercase tracking-wide text-gray-900">
                {organizationName || 'Assistência Técnica & Serviços'}
              </h1>
              <p className="text-xs text-gray-600 font-medium">
                Comprovante Oficial de Ordem de Serviço (O.S.)
              </p>
            </div>
            <div className="sm:text-right">
              <div className="text-base font-extrabold text-blue-700">{order.orderNumber}</div>
              <div className="text-[11px] text-gray-600">
                Abertura: {new Date(order.createdAt).toLocaleString('pt-BR')}
              </div>
              <div className="mt-0.5 inline-block rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-[11px] font-bold uppercase">
                Status: {SERVICE_ORDER_STATUS_LABELS[order.status]} • Prioridade:{' '}
                {SERVICE_ORDER_PRIORITY_LABELS[order.priority]}
              </div>
            </div>
          </div>

          {/* 1. Dados do Cliente e Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-gray-200 p-3.5 bg-gray-50/60">
            <div>
              <h4 className="text-[11px] font-bold uppercase text-gray-500 mb-1">
                Dados do Cliente
              </h4>
              <p className="font-bold text-sm text-gray-900">{order.customerName}</p>
              {order.customerDocument && <p>CPF/CNPJ: {order.customerDocument}</p>}
              {order.customerPhone && <p>Telefone / WhatsApp: {order.customerPhone}</p>}
            </div>
            <div>
              <h4 className="text-[11px] font-bold uppercase text-gray-500 mb-1">
                Atendimento Técnico
              </h4>
              <p>
                <strong>Técnico Responsável:</strong> {order.technicianName || 'Não informado'}
              </p>
              <p>
                <strong>Prioridade:</strong> {SERVICE_ORDER_PRIORITY_LABELS[order.priority]}
              </p>
              <p>
                <strong>Status:</strong> {SERVICE_ORDER_STATUS_LABELS[order.status]}
              </p>
            </div>
          </div>

          {/* 2. Identificação do Equipamento e Avarias */}
          <div className="rounded-xl border border-gray-200 p-3.5 space-y-2.5">
            <h4 className="text-[11px] font-bold uppercase text-gray-500 border-b border-gray-100 pb-1">
              Equipamento / Aparelho e Estado de Entrada (Avarias)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-gray-500 block text-[10px] uppercase">Equipamento</span>
                <span className="font-bold text-gray-900">{order.equipmentName}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase">Marca / Modelo</span>
                <span className="font-semibold text-gray-800">
                  {[order.equipmentBrand, order.equipmentModel].filter(Boolean).join(' / ') || '—'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase">Nº Série / IMEI / Placa</span>
                <span className="font-semibold text-gray-800">{order.serialNumber || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase">Cor</span>
                <span className="font-semibold text-gray-800">{order.equipmentColor || '—'}</span>
              </div>
            </div>

            {order.accessories && (
              <div>
                <span className="text-gray-500 font-semibold">Acessórios Deixados: </span>
                <span className="text-gray-800">{order.accessories}</span>
              </div>
            )}

            {order.damageChecklist.length > 0 && (
              <div>
                <span className="text-gray-500 font-semibold block mb-1">
                  Checklist de Vistoria / Avarias na Entrada:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {order.damageChecklist.map((item) => (
                    <span
                      key={item}
                      className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900"
                    >
                      • {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {order.damageNotes && (
              <div>
                <span className="text-gray-500 font-semibold">Observações de Avarias: </span>
                <span className="text-gray-800 whitespace-pre-wrap">{order.damageNotes}</span>
              </div>
            )}
          </div>

          {/* 3. Fotos do Equipamento / Avarias */}
          {order.photos.length > 0 && (
            <div className="rounded-xl border border-gray-200 p-3.5 space-y-2">
              <h4 className="text-[11px] font-bold uppercase text-gray-500 border-b border-gray-100 pb-1">
                Registro Fotográfico do Equipamento / Avarias ({order.photos.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {order.photos.map((photo, idx) => (
                  <div key={photo.id} className="rounded-lg border border-gray-200 p-1.5 bg-gray-50">
                    <img
                      src={photo.dataUrl}
                      alt={photo.caption || `Foto ${idx + 1}`}
                      className="h-28 w-full object-cover rounded"
                    />
                    {photo.caption && (
                      <p className="mt-1 text-[10px] text-center text-gray-600 truncate">
                        {photo.caption}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Problema Relatado, Diagnóstico e Solução */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-200 p-3 bg-rose-50/30">
                <h4 className="text-[11px] font-bold uppercase text-rose-700 mb-1">
                  Problema Relatado (Defeito)
                </h4>
                <p className="text-gray-800 whitespace-pre-wrap">{order.reportedProblem}</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-3 bg-blue-50/30">
                <h4 className="text-[11px] font-bold uppercase text-blue-700 mb-1">
                  Diagnóstico / Laudo Técnico
                </h4>
                <p className="text-gray-800 whitespace-pre-wrap">
                  {order.technicalDiagnosis || 'Em análise técnica.'}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 p-3 bg-emerald-50/30">
                <h4 className="text-[11px] font-bold uppercase text-emerald-700 mb-1">
                  Solução Aplicada / Serviço
                </h4>
                <p className="text-gray-800 whitespace-pre-wrap">
                  {order.solutionApplied || 'Aguardando conclusão.'}
                </p>
              </div>
            </div>
            {order.status === 'pending' && order.pendingReason && (
              <div className="rounded-xl border border-amber-300 p-3 bg-amber-50/60">
                <h4 className="text-[11px] font-bold uppercase text-amber-800 mb-1">
                  Motivo da Pendência
                </h4>
                <p className="text-gray-800 whitespace-pre-wrap">{order.pendingReason}</p>
              </div>
            )}
          </div>

          {/* 5. Produtos / Peças e Serviços */}
          {order.items.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-100 text-[10px] uppercase text-gray-600 font-bold border-b border-gray-200">
                  <tr>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3">Descrição do Produto / Peça ou Serviço</th>
                    <th className="py-2 px-3 text-right">Qtd</th>
                    <th className="py-2 px-3 text-right">Vlr. Unit.</th>
                    <th className="py-2 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {order.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 px-3 font-semibold">
                        {it.itemType === 'service' ? 'Serviço' : 'Peça / Produto'}
                      </td>
                      <td className="py-2 px-3">{it.description}</td>
                      <td className="py-2 px-3 text-right">
                        {it.quantity} {it.unit}
                      </td>
                      <td className="py-2 px-3 text-right">{formatCurrency(it.unitPrice)}</td>
                      <td className="py-2 px-3 text-right font-bold">{formatCurrency(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-gray-50 p-3 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="text-[11px] text-gray-600 space-x-4">
                  <span>
                    Peças/Produtos ({productItems.length}):{' '}
                    <strong>{formatCurrency(order.productsSubtotal)}</strong>
                  </span>
                  <span>
                    Serviços ({serviceItems.length}):{' '}
                    <strong>{formatCurrency(order.servicesSubtotal)}</strong>
                  </span>
                  {Number(order.discount) > 0 && (
                    <span className="text-red-600">
                      Desconto: <strong>-{formatCurrency(order.discount)}</strong>
                    </span>
                  )}
                </div>
                <div className="text-sm font-extrabold text-gray-900">
                  TOTAL DA O.S.: {formatCurrency(order.total)}
                </div>
              </div>
            </div>
          )}

          {/* Termos de Garantia e Assinaturas */}
          <div className="text-[11px] text-gray-600 border border-gray-200 rounded-lg p-2.5">
            <strong>Termos de Garantia:</strong>{' '}
            {order.warrantyTerms ||
              'Garantia legal referente exclusivamente aos serviços executados e peças substituídas descritas nesta Ordem de Serviço.'}
          </div>

          <div className="pt-8 grid grid-cols-2 gap-8 text-center text-[11px] text-gray-600">
            <div className="border-t border-gray-400 pt-1.5">
              Assinatura do Cliente ({order.customerName})
            </div>
            <div className="border-t border-gray-400 pt-1.5">
              Responsável Técnico ({organizationName || 'Empresa'})
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

