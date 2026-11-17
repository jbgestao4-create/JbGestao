import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  ShieldAlert,
  QrCode,
  LogOut,
  Building2,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { isSystemOwner } from '@shared/utils/system-owner'
import {
  organizationBillingService,
  type OrganizationBillingInfo,
} from '../services/organization-billing.service'
import { PixPaymentCheckoutModal } from '@modules/companies/components/PixPaymentCheckoutModal'

export function OrganizationSuspensionGuard() {
  const { user, signOut } = useAuth()
  const { currentOrganization, userRole, reloadOrganizations } = useOrganization()

  const [billingInfo, setBillingInfo] = useState<OrganizationBillingInfo | null>(null)
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)

  const isDeveloper = isSystemOwner(user)
  const isAdmin = userRole === 'owner' || userRole === 'admin' || isDeveloper

  const refreshBilling = useCallback(async () => {
    if (!currentOrganization || isDeveloper) {
      setBillingInfo(null)
      return
    }
    const info = await organizationBillingService.getBillingInfo({
      id: currentOrganization.id,
      name: currentOrganization.name,
      trialEndsAt: currentOrganization.trialEndsAt,
    })
    setBillingInfo(info)
  }, [currentOrganization, isDeveloper])

  useEffect(() => {
    void refreshBilling()
    const handleUpdate = () => {
      void refreshBilling()
    }
    window.addEventListener('organization-billing-updated', handleUpdate)
    return () => {
      window.removeEventListener('organization-billing-updated', handleUpdate)
    }
  }, [refreshBilling])

  // Desenvolvedor e operadores não veem esta tela (apenas administradores da empresa)
  if (isDeveloper || !isAdmin) return null

  // Se não estiver suspenso (ultrapassou 5 dias de carência) ou estiver em período de teste gratuito
  if (!billingInfo?.isSuspended || billingInfo.isTrial) return null

  const overdueInvoice = billingInfo.oldestOverdueInvoice
  const daysLate = billingInfo.maxDaysOverdue

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-rose-500 overflow-hidden animate-in fade-in-50 zoom-in-95">
        
        {/* Faixa Vermelha de Alerta */}
        <div className="bg-rose-600 px-6 py-5 text-white flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-white/20 shrink-0">
            <ShieldAlert className="h-7 w-7 text-white" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-rose-200 block">
              Bloqueio de Segurança Financeira
            </span>
            <h2 className="text-lg sm:text-xl font-black leading-tight">
              Acesso Suspenso por Inadimplência
            </h2>
          </div>
        </div>

        {/* Corpo do Bloqueio */}
        <div className="p-6 sm:p-8 space-y-6 text-gray-800 dark:text-slate-200">
          
          <div className="space-y-2">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-rose-600" />
              <span>{currentOrganization?.name}</span>
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
              O acesso aos módulos do sistema foi temporariamente bloqueado porque a fatura mensal de assinatura está vencida há <strong>{daysLate} dias</strong> (ultrapassou o prazo limite de 5 dias de tolerância).
            </p>
          </div>

          {/* VISUALIZAÇÃO PARA ADMINISTRADOR */}
          {isAdmin ? (
            <div className="space-y-4">
              {overdueInvoice && (
                <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-rose-800 dark:text-rose-300 block">
                      Fatura #{overdueInvoice.invoiceNumber} • Mês {overdueInvoice.referenceMonth}
                    </span>
                    <div className="text-xl font-black text-rose-700 dark:text-rose-300">
                      {formatCurrency(overdueInvoice.amount.toFixed(2))}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-gray-500 block">Vencimento:</span>
                    <span className="font-bold text-rose-700 dark:text-rose-400">
                      {overdueInvoice.dueDate.split('-').reverse().join('/')}
                    </span>
                    <span className="text-[11px] text-rose-600 block font-semibold">
                      ({daysLate} dias em atraso)
                    </span>
                  </div>
                </div>
              )}

              {/* Botão para Gerar QR Code de Pagamento PIX */}
              <div className="p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 space-y-3">
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(true)}
                  className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 transition cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  Gerar QR Code para Pagamento
                </button>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 text-center">
                  O sistema identifica o PIX automaticamente em segundos e libera o acesso na hora.
                </p>
              </div>
            </div>
          ) : (
            /* VISUALIZAÇÃO PARA COLABORADOR / MEMBRO COMUM */
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
              <p className="font-bold">
                Aviso aos Colaboradores:
              </p>
              <p>
                Por determinação administrativa, o sistema encontra-se indisponível no momento para regularização financeira.
              </p>
              <p>
                Por favor, solicite ao <strong>proprietário ou administrador</strong> da sua empresa a quitação da fatura de assinatura para que o acesso seja restabelecido.
              </p>
            </div>
          )}

          {/* Rodapé com botão de Sair */}
          <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Suporte: controlesoft@outlook.com
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => void signOut()}
              className="gap-2 text-xs text-gray-600 hover:text-gray-900"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair do Sistema
            </Button>
          </div>

        </div>

      </div>

      {/* Modal de Pagamento Automático PIX Mercado Pago */}
      <PixPaymentCheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => {
          setIsCheckoutModalOpen(false)
          void refreshBilling()
          void reloadOrganizations()
        }}
        organizationId={currentOrganization?.id}
        prefillClientName={currentOrganization?.name}
        contractInvoiceId={overdueInvoice?.id}
        invoiceAmount={overdueInvoice?.amount}
        invoiceNumber={overdueInvoice?.invoiceNumber}
        onPaymentSuccess={() => {
          void refreshBilling()
          void reloadOrganizations()
        }}
      />
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null
}
