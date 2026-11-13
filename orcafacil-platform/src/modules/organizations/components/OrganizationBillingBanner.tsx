import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AlertTriangle, Clock, QrCode, Printer, X, Receipt } from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { isSystemOwner } from '@shared/utils/system-owner'
import {
  organizationBillingService,
  type OrganizationBillingInfo,
} from '../services/organization-billing.service'
import type { ContractInvoice } from '@modules/companies/services/contract.service'
import { InvoicePixModal } from './InvoicePixModal'
import { ContractInvoicePrintModal } from '@modules/companies/components/ContractInvoicePrintModal'

export function OrganizationBillingBanner() {
  const { user } = useAuth()
  const { currentOrganization, userRole } = useOrganization()
  const navigate = useNavigate()
  const location = useLocation()

  const [billingInfo, setBillingInfo] = useState<OrganizationBillingInfo | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)
  const [selectedPixInvoice, setSelectedPixInvoice] = useState<ContractInvoice | null>(null)
  const [selectedPrintInvoice, setSelectedPrintInvoice] = useState<ContractInvoice | null>(null)

  // Apenas o Administrador / Dono da organização vê esta notificação
  const isAdmin = userRole === 'owner' || userRole === 'admin' || isSystemOwner(user)

  useEffect(() => {
    if (!currentOrganization || !isAdmin) {
      setBillingInfo(null)
      return
    }

    let isCurrent = true
    void organizationBillingService
      .getBillingInfo({
        id: currentOrganization.id,
        name: currentOrganization.name,
        trialEndsAt: currentOrganization.trialEndsAt,
      })
      .then((info) => {
        if (isCurrent) {
          setBillingInfo(info)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [currentOrganization?.id, currentOrganization?.trialEndsAt, isAdmin, location.pathname])

  // Não exibe se o usuário não for administrador
  if (!isAdmin || !billingInfo) return null

  // Quando o Plano estiver em período de teste, não gera custo nem notificação de cobrança
  if (billingInfo.isTrial) return null

  // Se já estiver suspenso por 7+ dias de atraso, o OrganizationSuspensionGuard assume
  if (billingInfo.isSuspended) return null

  // Se o banner foi dispensado nesta sessão do navegador
  if (isDismissed) return null

  // Caso 1: Fatura vencida com menos de 7 dias (Notificação diária após o vencimento)
  if (billingInfo.hasOverdueWarning && billingInfo.overdueInvoice) {
    const inv = billingInfo.overdueInvoice
    const days = billingInfo.daysOverdue

    return (
      <>
        <div className="bg-rose-600 text-white px-4 py-2.5 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-3 z-40 shrink-0 print:hidden animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1 rounded-md bg-white/20">
              <AlertTriangle className="h-4 w-4 text-white animate-bounce" />
            </div>
            <div className="text-xs sm:text-sm">
              <span className="font-extrabold uppercase tracking-wide mr-1.5">
                Aviso Financeiro:
              </span>
              <span>
                A fatura de assinatura mensal (#{inv.invoiceNumber}) está vencida há <strong>{days} {days === 1 ? 'dia' : 'dias'}</strong> ({formatCurrency(inv.amount.toFixed(2))}). Regularize para evitar a <strong>suspensão dos serviços após 7 dias de atraso</strong>.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
            <Button
              size="sm"
              onClick={() => setSelectedPixInvoice(inv)}
              className="gap-1.5 text-xs font-bold bg-white text-rose-700 hover:bg-rose-50 border-0 shadow-xs"
            >
              <QrCode className="h-3.5 w-3.5" />
              Pagar com PIX
            </Button>

            <Button
              size="sm"
              onClick={() => setSelectedPrintInvoice(inv)}
              className="gap-1.5 text-xs font-bold bg-white/20 hover:bg-white/30 text-white border-0"
            >
              <Printer className="h-3.5 w-3.5" />
              Boleto / Fatura
            </Button>

            <Button
              size="sm"
              onClick={() => navigate('/settings/organization?tab=system-invoices')}
              className="gap-1 text-xs font-medium bg-transparent hover:bg-white/10 text-white border border-white/40"
            >
              <Receipt className="h-3.5 w-3.5" />
              Ver Faturas
            </Button>

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1 text-white/80 hover:text-white rounded-md hover:bg-white/10"
              title="Dispensar aviso por hoje"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modais de Pagamento */}
        <InvoicePixModal
          isOpen={Boolean(selectedPixInvoice)}
          invoice={selectedPixInvoice}
          contract={billingInfo.contract}
          onClose={() => setSelectedPixInvoice(null)}
          onOpenInvoicePrint={() => {
            if (selectedPixInvoice) setSelectedPrintInvoice(selectedPixInvoice)
          }}
        />

        <ContractInvoicePrintModal
          isOpen={Boolean(selectedPrintInvoice)}
          invoice={selectedPrintInvoice}
          contract={billingInfo.contract}
          onClose={() => setSelectedPrintInvoice(null)}
        />
      </>
    )
  }

  // Caso 2: Faltam 3 dias ou menos para o vencimento (Lembrete pré-vencimento)
  if (billingInfo.hasUpcomingWarning && billingInfo.upcomingInvoice) {
    const inv = billingInfo.upcomingInvoice
    const days = billingInfo.daysUntilDue

    return (
      <>
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-4 py-2.5 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-3 z-40 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-1 rounded-md bg-white/20">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <div className="text-xs sm:text-sm">
              <span className="font-extrabold uppercase tracking-wide mr-1.5">
                Lembrete de Vencimento:
              </span>
              <span>
                {days === 0
                  ? `Sua fatura de assinatura mensal (#{${inv.invoiceNumber}}) vence hoje (${formatCurrency(inv.amount.toFixed(2))}).`
                  : `Faltam ${days} ${days === 1 ? 'dia' : 'dias'} para o vencimento da assinatura mensal (${formatCurrency(inv.amount.toFixed(2))}).`}
                {' '}Efetue o pagamento via PIX ou Boleto para manter o sistema ativo.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
            <Button
              size="sm"
              onClick={() => setSelectedPixInvoice(inv)}
              className="gap-1.5 text-xs font-bold bg-white text-amber-800 hover:bg-amber-50 border-0 shadow-xs"
            >
              <QrCode className="h-3.5 w-3.5" />
              Pagar com PIX
            </Button>

            <Button
              size="sm"
              onClick={() => setSelectedPrintInvoice(inv)}
              className="gap-1.5 text-xs font-bold bg-white/20 hover:bg-white/30 text-white border-0"
            >
              <Printer className="h-3.5 w-3.5" />
              Boleto / Fatura
            </Button>

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1 text-white/80 hover:text-white rounded-md hover:bg-white/10"
              title="Fechar lembrete"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modais de Pagamento */}
        <InvoicePixModal
          isOpen={Boolean(selectedPixInvoice)}
          invoice={selectedPixInvoice}
          contract={billingInfo.contract}
          onClose={() => setSelectedPixInvoice(null)}
          onOpenInvoicePrint={() => {
            if (selectedPixInvoice) setSelectedPrintInvoice(selectedPixInvoice)
          }}
        />

        <ContractInvoicePrintModal
          isOpen={Boolean(selectedPrintInvoice)}
          invoice={selectedPrintInvoice}
          contract={billingInfo.contract}
          onClose={() => setSelectedPrintInvoice(null)}
        />
      </>
    )
  }

  return null
}
