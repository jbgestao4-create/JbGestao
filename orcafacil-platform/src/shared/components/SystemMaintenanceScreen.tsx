import { useState } from 'react'
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react'
import { WhatsAppIcon } from './WhatsAppIcon'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { systemMaintenanceService } from '@shared/services/system-maintenance.service'

interface SystemMaintenanceScreenProps {
  message?: string
  onRecheck?: () => void
}

export function SystemMaintenanceScreen({
  message,
  onRecheck,
}: SystemMaintenanceScreenProps) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [isChecking, setIsChecking] = useState(false)

  const defaultMsg =
    'O sistema encontra-se em manutenção de emergência temporária. Solicitamos que aguardem retorno.'
  const displayMsg = message?.trim() || defaultMsg

  const handleCheckAgain = async () => {
    setIsChecking(true)
    try {
      const res = await systemMaintenanceService.getStatus()
      if (res.success && !res.data?.enabled) {
        window.location.reload()
      } else {
        if (onRecheck) onRecheck()
      }
    } finally {
      setTimeout(() => {
        setIsChecking(false)
      }, 500)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 select-none relative overflow-hidden">
      {/* Luz ambiente de fundo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-lg w-full bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md text-center relative z-10 space-y-6">
        {/* Ícone Pulsante */}
        <div className="w-20 h-20 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
          <AlertTriangle className="w-10 h-10 animate-bounce" />
        </div>

        {/* Tag de Alerta */}
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Aviso Operacional
          </span>
          <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Sistema em Manutenção de Emergência Temporária
          </h1>
        </div>

        {/* Mensagem Principal */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 text-sm sm:text-base text-slate-300 leading-relaxed font-medium">
          {displayMsg}
        </div>

        <p className="text-xs sm:text-sm text-slate-400">
          Nossa equipe técnica já está realizando os procedimentos necessários. Solicitamos gentilmente que aguarde alguns instantes até a conclusão das operações.
        </p>

        {/* Ações */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={() => void handleCheckAgain()}
            disabled={isChecking}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-900/40 transition-colors disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Verificando...' : 'Verificar se o Sistema Voltou'}</span>
          </button>

          <a
            href="https://wa.me/5531986848490?text=Ol%C3%A1%21%20Gostaria%20de%20informa%C3%A7%C3%B5es%20sobre%20a%20manuten%C3%A7%C3%A3o%20tempor%C3%A1ria%20do%20sistema."
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold text-sm transition-colors cursor-pointer"
          >
            <WhatsAppIcon className="w-4 h-4" />
            <span>Falar com o Suporte (WhatsApp)</span>
          </a>

          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </div>

      <div className="mt-8 text-xs text-slate-400 text-center relative z-10">
        ControleSoft Platform &bull; Todos os direitos reservados.
      </div>
    </div>
  )
}
