import { useState } from 'react'
import { Printer, X, Receipt, CheckCircle2, AlertTriangle, Clock, Copy, Check } from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import {
  type ContractInvoice,
  type SoftwareContract,
  getInvoiceEffectiveStatus,
} from '../services/contract.service'

interface ContractInvoicePrintModalProps {
  invoice: ContractInvoice | null
  contract?: SoftwareContract | null
  isOpen: boolean
  onClose: () => void
}

export function ContractInvoicePrintModal({
  invoice,
  contract,
  isOpen,
  onClose,
}: ContractInvoicePrintModalProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen || !invoice) return null

  const effectiveStatus = getInvoiceEffectiveStatus(invoice)
  const isPaid = effectiveStatus === 'paid'
  const isOverdue = effectiveStatus === 'overdue'

  const handlePrint = () => {
    window.print()
  }

  const formatIsoDate = (isoStr?: string | null) => {
    if (!isoStr) return '-'
    const parts = isoStr.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return isoStr
  }

  const handleCopyWhatsApp = () => {
    const text = `*Fatura de Licença de Software - JB Software*\n\n` +
      `Olá *${invoice.clientName}*,\n` +
      `Segue a cobrança da sua assinatura do sistema JB Gestão:\n\n` +
      `📄 *Fatura Nº:* ${invoice.invoiceNumber}\n` +
      `📅 *Mês de Referência:* ${invoice.referenceMonth}\n` +
      `⏰ *Vencimento:* ${formatIsoDate(invoice.dueDate)}\n` +
      `💰 *Valor:* R$ ${invoice.amount.toFixed(2).replace('.', ',')}\n` +
      `💳 *Forma de Pagamento:* ${invoice.paymentMethod || 'PIX'}\n` +
      (isPaid
        ? `\n✅ *Status:* QUITADO em ${formatIsoDate(invoice.paymentDate)}`
        : `\nFavor confirmar o pagamento após a realização. Qualquer dúvida estamos à disposição!`)

    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:fixed-none">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col max-h-[94vh] print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none">
        
        {/* Cabeçalho da Modal (oculto na impressão) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/50 rounded-t-2xl print:hidden">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isPaid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300' : isOverdue ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300'}`}>
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Fatura #{invoice.invoiceNumber}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {isPaid ? 'Fatura quitada / Recibo de pagamento' : isOverdue ? 'Aviso de fatura vencida' : 'Cobrança mensal em aberto'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyWhatsApp}
              className="gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado!' : 'Copiar p/ WhatsApp'}
            </Button>

            <Button
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir / PDF
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Documento Imprimível */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-6 text-gray-800 dark:text-slate-200 print:text-black print:p-4 text-sm">
          
          {/* Cabeçalho da Fatura */}
          <div className="flex justify-between items-start border-b border-gray-200 dark:border-slate-800 pb-5">
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                JB SOFTWARE & TECNOLOGIA
              </span>
              <h1 className="text-xl font-extrabold text-gray-900 dark:text-white mt-0.5">
                FATURA DE LOCAÇÃO DE SOFTWARE
              </h1>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Licenciamento e Manutenção de Sistema ERP Web
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs text-gray-400 font-semibold uppercase">Fatura Nº</div>
              <div className="font-mono font-bold text-lg text-gray-900 dark:text-white">
                #{invoice.invoiceNumber}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Ref: <strong className="text-gray-900 dark:text-white">{invoice.referenceMonth}</strong>
              </div>
            </div>
          </div>

          {/* Status Box */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            isPaid
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : isOverdue
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
          }`}>
            <div className="flex items-center gap-2.5">
              {isPaid ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : isOverdue ? (
                <AlertTriangle className="h-6 w-6 text-rose-600 dark:text-rose-400 shrink-0" />
              ) : (
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {isPaid ? 'FATURA QUITADA / PAGO' : isOverdue ? 'FATURA VENCIDA' : 'AGUARDANDO PAGAMENTO'}
                </div>
                <div className="text-xs mt-0.5">
                  {isPaid
                    ? `Pagamento confirmado em ${formatIsoDate(invoice.paymentDate)} via ${invoice.paymentMethod || 'PIX'}`
                    : `Vencimento programado para ${formatIsoDate(invoice.dueDate)}`}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs uppercase font-medium opacity-80">Valor Total</div>
              <div className="text-xl font-extrabold">
                {formatCurrency(invoice.amount.toFixed(2))}
              </div>
            </div>
          </div>

          {/* Dados do Contratante / Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 text-xs">
            <div>
              <span className="font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Dados do Cliente / Sacado
              </span>
              <p className="font-bold text-gray-900 dark:text-white text-sm">
                {invoice.clientName}
              </p>
              {invoice.clientDocument && (
                <p className="text-gray-600 dark:text-slate-300 mt-0.5">
                  CNPJ/CPF: {invoice.clientDocument}
                </p>
              )}
              {contract?.clientResponsibleName && (
                <p className="text-gray-600 dark:text-slate-300">
                  Responsável: {contract.clientResponsibleName}
                </p>
              )}
            </div>

            <div>
              <span className="font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Dados do Contrato
              </span>
              {contract ? (
                <>
                  <p className="text-gray-700 dark:text-slate-300">
                    Contrato Nº: <strong>#{contract.contractNumber}</strong>
                  </p>
                  <p className="text-gray-700 dark:text-slate-300 mt-0.5">
                    Plano: <strong>{contract.planName}</strong>
                  </p>
                  <p className="text-gray-700 dark:text-slate-300">
                    Dia Base de Vencimento: <strong>Todo dia {contract.billingDay}</strong>
                  </p>
                </>
              ) : (
                <p className="text-gray-500">Contrato vinculado registrado</p>
              )}
            </div>
          </div>

          {/* Discriminação da Fatura */}
          <div className="border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100/75 dark:bg-slate-800 font-bold text-gray-600 dark:text-slate-300">
                <tr>
                  <th className="p-3">Descrição do Serviço / Licença</th>
                  <th className="p-3 text-center">Referência</th>
                  <th className="p-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                <tr>
                  <td className="p-3">
                    <div className="font-bold text-gray-900 dark:text-white">
                      Licença de Uso e Locação Mensal - Software ERP JB Gestão
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                      Direito de acesso, suporte técnico, atualizações e armazenamento seguro em nuvem.
                    </div>
                  </td>
                  <td className="p-3 text-center font-mono font-medium">
                    {invoice.referenceMonth}
                  </td>
                  <td className="p-3 text-right font-bold text-gray-900 dark:text-white">
                    {formatCurrency(invoice.amount.toFixed(2))}
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-slate-800/60 font-bold border-t border-gray-200 dark:border-slate-800">
                <tr>
                  <td colSpan={2} className="p-3 text-right text-gray-700 dark:text-slate-300">
                    Total a Pagar:
                  </td>
                  <td className="p-3 text-right text-base text-gray-900 dark:text-white font-extrabold">
                    {formatCurrency(invoice.amount.toFixed(2))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Dados para Pagamento */}
          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-1.5 text-xs text-blue-950 dark:text-blue-200">
            <h4 className="font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
              Instruções para Pagamento:
            </h4>
            <p>
              • <strong>Forma de Cobrança:</strong> {invoice.paymentMethod || 'PIX / Transferência Bancária'}
            </p>
            {invoice.pixKey && (
              <p>
                • <strong>Chave PIX:</strong> <span className="font-mono font-bold">{invoice.pixKey}</span>
              </p>
            )}
            <p>
              • Após efetuar o pagamento, o comprovante pode ser enviado ao suporte para baixa automática.
            </p>
            {invoice.notes && (
              <p className="mt-2 text-[11px] text-gray-600 dark:text-slate-400 italic">
                Obs: {invoice.notes}
              </p>
            )}
          </div>

          {/* Rodapé e Carimbo */}
          <div className="pt-4 border-t border-gray-200 dark:border-slate-800 text-center text-[11px] text-gray-400 space-y-1">
            <p>JB Software & Tecnologia • CNPJ: 00.000.000/0001-00 • contato@jbsoftware.com.br</p>
            <p>Documento gerado eletronicamente pela Plataforma JB Gestão em {new Date().toLocaleDateString('pt-BR')}</p>
          </div>

        </div>

      </div>
    </div>
  )
}
