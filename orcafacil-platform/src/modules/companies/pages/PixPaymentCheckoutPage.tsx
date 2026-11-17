import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PixPaymentCheckoutModal } from '../components/PixPaymentCheckoutModal'
import { QrCode } from 'lucide-react'

export function PixPaymentCheckoutPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const planId = searchParams.get('planId')
  const invoiceId = searchParams.get('invoiceId')
  const [isOpen, setIsOpen] = useState(true)

  const handleClose = () => {
    setIsOpen(false)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <QrCode className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">
          Pagamento de Licença • PIX Mercado Pago
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Gere sua cobrança PIX com confirmação automática e liberação imediata do sistema.
        </p>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition cursor-pointer"
        >
          Abrir Tela de Pagamento
        </button>
      </div>

      <PixPaymentCheckoutModal
        isOpen={isOpen}
        onClose={handleClose}
        initialPlanId={planId}
        contractInvoiceId={invoiceId}
        onPaymentSuccess={() => {
          setTimeout(() => {
            navigate('/dashboard')
          }, 1500)
        }}
      />
    </div>
  )
}
