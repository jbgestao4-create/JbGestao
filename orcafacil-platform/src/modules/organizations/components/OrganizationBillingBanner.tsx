import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertTriangle, QrCode, X } from 'lucide-react'
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
import { PixPaymentCheckoutModal } from '@modules/companies/components/PixPaymentCheckoutModal'

export function OrganizationBillingBanner() {
  const { user } = useAuth()
  const { currentOrganization, userRole, reloadOrganizations } = useOrganization()
  const location = useLocation()

  const [billingInfo, setBillingInfo] = useState<OrganizationBillingInfo | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)
  const [selectedPixInvoice, setSelectedPixInvoice] = useState<ContractInvoice | null>(null)

  // Apenas o Administrador / Dono da empresa contratante vê esta notificação (nunca o desenvolvedor)
  const isClientAdmin = !isSystemOwner(user) && (userRole === 'owner' || userRole === 'admin')

  useEffect(() => {
    if (!currentOrganization || !isClientAdmin) {
      setBillingInfo(null)
      return
    }

    let isCurrent = true
    const loadBilling = () => {
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
    }

    loadBilling()
    window.addEventListener('organization-billing-updated', loadBilling)

    return () => {
      isCurrent = false
      window.removeEventListener('organization-billing-updated', loadBilling)
    }
  }, [currentOrganization?.id, currentOrganization?.trialEndsAt, isClientAdmin, location.pathname])

  // Não exibe se não for administrador da empresa contratante
  if (!isClientAdmin || !billingInfo) return null

  const activeOverdueInvoice = billingInfo.overdueInvoice || billingInfo.oldestOverdueInvoice
  const hasAnyOverdue = Boolean(activeOverdueInvoice)

  // O aviso financeiro é exibido APENAS aos contratantes que constam com boleto/fatura vencida
  if (!hasAnyOverdue || !activeOverdueInvoice) return null

  // Se o banner foi dispensado nesta sessão do navegador
  if (isDismissed) return null

  const inv = activeOverdueInvoice
  const days = billingInfo.daysOverdue || billingInfo.maxDaysOverdue

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
              A fatura de assinatura mensal (#{inv.invoiceNumber}) está vencida há <strong>{days} {days === 1 ? 'dia' : 'dias'}</strong> ({formatCurrency(inv.amount.toFixed(2))}).{' '}
              {days > 5
                ? <strong>Regularize o pagamento via PIX imediatamente para evitar ou reverter a suspensão dos serviços.</strong>
                : <>Regularize via PIX para evitar a <strong>suspensão dos serviços após 5 dias de atraso</strong>.</>}
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

      {/* Modal de Pagamento Exclusivo via PIX QR Code */}
      <PixPaymentCheckoutModal
        isOpen={Boolean(selectedPixInvoice)}
        onClose={() => {
          setSelectedPixInvoice(null)
          void reloadOrganizations()
        }}
        organizationId={currentOrganization?.id}
        prefillClientName={currentOrganization?.name}
        contractInvoiceId={selectedPixInvoice?.id}
        invoiceAmount={selectedPixInvoice?.amount}
        invoiceNumber={selectedPixInvoice?.invoiceNumber}
        onPaymentSuccess={() => {
          void reloadOrganizations()
          window.dispatchEvent(new CustomEvent('organization-billing-updated'))
        }}
      />
    </>
  )
}
