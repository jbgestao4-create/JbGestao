import { useState, useEffect, useMemo } from 'react'
import {
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  QrCode,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import type { Organization, OrganizationRole } from '@shared/types/common'
import {
  organizationBillingService,
  type OrganizationBillingInfo,
  getDiffDaysFromToday,
} from '../services/organization-billing.service'
import type { ContractInvoice } from '@modules/companies/services/contract.service'
import { InvoicePixModal } from './InvoicePixModal'
import { ContractInvoicePrintModal } from '@modules/companies/components/ContractInvoicePrintModal'

interface OrganizationSystemInvoicesSectionProps {
  organization: Organization | null
  userRole: OrganizationRole | null
  isAdmin: boolean
}

export function OrganizationSystemInvoicesSection({
  organization,
  userRole: _userRole,
  isAdmin,
}: OrganizationSystemInvoicesSectionProps) {
  const [billingInfo, setBillingInfo] = useState<OrganizationBillingInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all')

  // Modais de ação do administrador
  const [selectedPixInvoice, setSelectedPixInvoice] = useState<ContractInvoice | null>(null)
  const [selectedPrintInvoice, setSelectedPrintInvoice] = useState<ContractInvoice | null>(null)

  const loadBilling = async () => {
    if (!organization) return
    setIsLoading(true)
    const info = await organizationBillingService.getBillingInfo({
      id: organization.id,
      name: organization.name,
      trialEndsAt: organization.trialEndsAt,
    })
    setBillingInfo(info)
    setIsLoading(false)
  }

  useEffect(() => {
    void loadBilling()
  }, [organization?.id, organization?.trialEndsAt])

  const filteredInvoices = useMemo(() => {
    if (!billingInfo) return []
    if (statusFilter === 'unpaid') return billingInfo.unpaidInvoices
    if (statusFilter === 'paid') return billingInfo.paidInvoices
    return billingInfo.invoices
  }, [billingInfo, statusFilter])

  if (!organization) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
        Nenhuma organização selecionada.
      </div>
    )
  }

  const isTrial = billingInfo?.isTrial || false

  return (
    <div className="space-y-6">
      {/* Banner Superior / Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            <Receipt className="h-4 w-4" />
            <span>Faturas do Sistema & Controle de Assinatura</span>
          </div>
          <h2 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            Faturas e Pagamentos da Plataforma
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Acompanhe suas faturas mensais, consulte o status de quitação, emita boletos e pague via PIX com liberação ágil.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => void loadBilling()}
          disabled={isLoading}
          className="gap-2 self-start sm:self-auto text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar Faturas
        </Button>
      </div>

      {/* 1. SE ESTIVER EM PERÍODO DE TESTE GRATUITO (SEM CUSTO) */}
      {isTrial && (
        <div className="rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-blue-950/30 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-500/20 shrink-0">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wide bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border border-emerald-300">
                    Período de Testes Ativo
                  </span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    • 100% Gratuito (Sem Cobrança)
                  </span>
                </div>
                <h3 className="mt-1.5 text-lg font-bold text-gray-900 dark:text-white">
                  Sua empresa está em período de avaliação gratuita
                </h3>
                <p className="text-xs text-gray-600 dark:text-slate-300 mt-1 leading-relaxed max-w-2xl">
                  Durante o período de testes, <strong>nenhuma fatura ou custo mensal é gerado</strong>. Todos os recursos e módulos contratados do sistema estão liberados para uso.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-white dark:bg-slate-800 px-5 py-3 border border-emerald-200 dark:border-emerald-900/60 text-center shrink-0 shadow-xs self-stretch sm:self-auto">
              <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">
                Dias de Teste Restantes
              </span>
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 block">
                {billingInfo?.trialDaysRemaining || 0} dias
              </span>
              {billingInfo?.trialEndsAt && (
                <span className="text-[11px] text-gray-500 dark:text-slate-400 block mt-0.5">
                  Válido até {new Date(billingInfo.trialEndsAt).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. CONDIÇÕES DO CONTRATO / PLANO (SE NÃO ESTIVER EM TESTE) */}
      {!isTrial && billingInfo?.contract && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block">
              Plano de Acesso Ativo
            </span>
            <p className="mt-1 text-xl font-bold text-purple-700 dark:text-purple-400">
              {billingInfo.contract.planName}
            </p>
            <span className="text-xs text-gray-400">Contrato #{billingInfo.contract.contractNumber}</span>
          </div>

          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 shadow-xs">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 block">
              Mensalidade Contratada
            </span>
            <p className="mt-1 text-xl font-bold text-emerald-800 dark:text-emerald-200">
              {formatCurrency(billingInfo.contract.monthlyAmount.toFixed(2))}
              <span className="text-xs font-normal text-emerald-600 ml-1">/mês</span>
            </p>
            <span className="text-xs text-emerald-700">Licença de software SaaS</span>
          </div>

          <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 p-5 shadow-xs">
            <span className="text-xs font-semibold text-blue-800 dark:text-blue-300 block">
              Dia Base de Vencimento
            </span>
            <p className="mt-1 text-xl font-bold text-blue-800 dark:text-blue-200">
              Todo dia {String(billingInfo.contract.billingDay).padStart(2, '0')}
            </p>
            <span className="text-xs text-blue-700">Vencimento mensal recorrente</span>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block">
              Forma de Pagamento
            </span>
            <p className="mt-1 text-base font-bold text-gray-900 dark:text-white">
              {billingInfo.contract.paymentMethod || 'PIX / Boleto Bancário'}
            </p>
            <span className="text-xs text-gray-400">Opções disponíveis online</span>
          </div>
        </div>
      )}

      {/* 3. ALERTA DE FATURA A VENCER OU VENCIDA */}
      {!isTrial && billingInfo?.hasUpcomingWarning && billingInfo.upcomingInvoice && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Lembrete de Vencimento: Fatura #{billingInfo.upcomingInvoice.invoiceNumber}
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                {billingInfo.daysUntilDue === 0
                  ? `Sua fatura de assinatura vence hoje (${formatCurrency(billingInfo.upcomingInvoice.amount.toFixed(2))}).`
                  : `Faltam ${billingInfo.daysUntilDue} ${billingInfo.daysUntilDue === 1 ? 'dia' : 'dias'} para o vencimento da sua fatura (${formatCurrency(billingInfo.upcomingInvoice.amount.toFixed(2))}).`}
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 self-start sm:self-center">
              <Button
                size="sm"
                onClick={() => setSelectedPixInvoice(billingInfo.upcomingInvoice)}
                className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <QrCode className="h-3.5 w-3.5" />
                Pagar com PIX
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedPrintInvoice(billingInfo.upcomingInvoice)}
                className="gap-1.5 text-xs text-blue-700 border-blue-300"
              >
                <Printer className="h-3.5 w-3.5" />
                Boleto / Fatura
              </Button>
            </div>
          )}
        </div>
      )}

      {!isTrial && billingInfo?.hasOverdueWarning && billingInfo.overdueInvoice && (
        <div className="rounded-2xl border border-rose-300 dark:border-rose-900/80 bg-rose-50/80 dark:bg-rose-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-rose-900 dark:text-rose-200">
                Fatura Vencida em Atraso (#{billingInfo.overdueInvoice.invoiceNumber})
              </div>
              <p className="text-xs text-rose-800 dark:text-rose-300 mt-0.5">
                Vencida há {billingInfo.daysOverdue} {billingInfo.daysOverdue === 1 ? 'dia' : 'dias'} ({formatCurrency(billingInfo.overdueInvoice.amount.toFixed(2))}). Regularize para evitar suspensão após 7 dias de atraso.
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 self-start sm:self-center">
              <Button
                size="sm"
                onClick={() => setSelectedPixInvoice(billingInfo.overdueInvoice)}
                className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <QrCode className="h-3.5 w-3.5" />
                Pagar com PIX
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedPrintInvoice(billingInfo.overdueInvoice)}
                className="gap-1.5 text-xs text-blue-700 border-blue-300"
              >
                <Printer className="h-3.5 w-3.5" />
                Boleto / Fatura
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 4. BARRA DE FILTROS DAS FATURAS */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'all'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            Todas as Faturas ({billingInfo?.invoices.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('unpaid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'unpaid'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100'
            }`}
          >
            A Vencer / Não Pagas ({billingInfo?.unpaidInvoices.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('paid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'paid'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100'
            }`}
          >
            ✓ Pagas / Histórico ({billingInfo?.paidInvoices.length || 0})
          </button>
        </div>

        <span className="text-xs text-gray-400 dark:text-slate-500">
          Visualização para Administradores
        </span>
      </div>

      {/* 5. TABELA DE FATURAS */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-500">
            <RefreshCw className="mx-auto h-7 w-7 animate-spin text-purple-600 mb-2" />
            Carregando histórico financeiro...
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Receipt className="mx-auto h-12 w-12 text-gray-300 dark:text-slate-600" />
            <p className="text-sm font-bold text-gray-700 dark:text-slate-300">
              Nenhuma fatura encontrada.
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 max-w-sm mx-auto">
              {isTrial
                ? 'Sua empresa está em período de testes gratuito, nenhuma cobrança é gerada.'
                : 'As faturas emitidas para a sua empresa aparecerão listadas aqui para consulta, emissão de boleto e pagamento via PIX.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-slate-300">
              <thead className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/60 text-xs font-semibold uppercase text-gray-400 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">Fatura Nº & Mês</th>
                  <th className="px-4 py-3.5">Vencimento</th>
                  <th className="px-4 py-3.5">Valor (R$)</th>
                  <th className="px-4 py-3.5">Situação</th>
                  <th className="px-4 py-3.5 text-right">Opções de Pagamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredInvoices.map((inv) => {
                  const isPaid = inv.status === 'paid'
                  const diff = getDiffDaysFromToday(inv.dueDate)
                  const isOverdue = !isPaid && diff < 0
                  const daysLate = Math.abs(diff)

                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                        isOverdue ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                      }`}
                    >
                      {/* Nº e Mês */}
                      <td className="px-4 py-4">
                        <div className="font-mono font-bold text-gray-900 dark:text-white">
                          #{inv.invoiceNumber}
                        </div>
                        <div className="text-xs text-purple-700 dark:text-purple-400 font-semibold">
                          Ref: {inv.referenceMonth}
                        </div>
                      </td>

                      {/* Vencimento */}
                      <td className="px-4 py-4">
                        <div className={`font-semibold ${isOverdue ? 'text-rose-600 font-bold' : 'text-gray-900 dark:text-white'}`}>
                          {inv.dueDate.split('-').reverse().join('/')}
                        </div>
                        {!isPaid && (
                          <div className={`text-[11px] ${isOverdue ? 'text-rose-600 font-bold' : 'text-gray-400'}`}>
                            {diff === 0
                              ? 'Vence hoje'
                              : diff === 1
                                ? 'Vence amanhã'
                                : diff > 1
                                  ? `Vence em ${diff} dias`
                                  : `Vencida há ${daysLate} dias`}
                          </div>
                        )}
                      </td>

                      {/* Valor */}
                      <td className="px-4 py-4">
                        <div className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                          {formatCurrency(inv.amount.toFixed(2))}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {inv.paymentMethod || 'PIX / Boleto'}
                        </div>
                      </td>

                      {/* Situação */}
                      <td className="px-4 py-4">
                        {isPaid ? (
                          <div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              PAGA
                            </span>
                            {inv.paymentDate && (
                              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                                Pago em {inv.paymentDate.split('-').reverse().join('/')}
                              </div>
                            )}
                          </div>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 dark:bg-rose-950/80 px-2.5 py-1 text-xs font-extrabold text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                            VENCIDA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Clock className="h-3.5 w-3.5 text-amber-600" />
                            A VENCER
                          </span>
                        )}
                      </td>

                      {/* Opções de Pagamento */}
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isPaid && (
                            <Button
                              size="sm"
                              onClick={() => setSelectedPixInvoice(inv)}
                              className="gap-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                              title="Pagar via Chave PIX"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                              Pagar PIX
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedPrintInvoice(inv)}
                            className="gap-1 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-900/60"
                            title="Visualizar e Imprimir Fatura / Boleto em PDF"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            {isPaid ? 'Ver Comprovante' : 'Boleto / Fatura'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Pagamento via PIX */}
      <InvoicePixModal
        isOpen={Boolean(selectedPixInvoice)}
        invoice={selectedPixInvoice}
        contract={billingInfo?.contract}
        onClose={() => setSelectedPixInvoice(null)}
        onOpenInvoicePrint={() => {
          if (selectedPixInvoice) {
            setSelectedPrintInvoice(selectedPixInvoice)
          }
        }}
      />

      {/* Modal de Impressão / Boleto / PDF */}
      <ContractInvoicePrintModal
        isOpen={Boolean(selectedPrintInvoice)}
        invoice={selectedPrintInvoice}
        contract={billingInfo?.contract}
        onClose={() => setSelectedPrintInvoice(null)}
      />
    </div>
  )
}
