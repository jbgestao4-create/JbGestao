import { useEffect } from 'react'
import { useRouteError, useNavigate } from 'react-router-dom'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { BrandLogo } from '@shared/components/BrandLogo'

export function RouteErrorBoundary() {
  const error = useRouteError()
  const navigate = useNavigate()

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : 'Ocorreu um erro inesperado ao carregar esta página.'

  // Se o erro for um desalinhamento transitório de hooks provocado por Hot Module Replacement (HMR) em desenvolvimento,
  // recarrega automaticamente uma única vez para auto-recuperar a tela de imediato sem travar o usuário
  useEffect(() => {
    const isHooksMismatch =
      typeof errorMessage === 'string' &&
      (errorMessage.includes('Rendered more hooks') ||
        errorMessage.includes('Rendered fewer hooks') ||
        errorMessage.includes('rendered more hooks') ||
        errorMessage.includes('rendered fewer hooks'))

    if (isHooksMismatch) {
      const reloadKey = 'cs_hmr_hook_autoreload'
      const lastReload = sessionStorage.getItem(reloadKey)
      const now = Date.now()

      // Evita loop caso não seja HMR transitório (limite de 1 reload automático a cada 10 segundos)
      if (!lastReload || now - Number(lastReload) > 10000) {
        sessionStorage.setItem(reloadKey, String(now))
        window.location.reload()
      }
    }
  }, [errorMessage])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
        <BrandLogo size="lg" className="mx-auto mb-6" />

        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>

        <h1 className="text-xl font-bold text-slate-900 mb-2">
          Ops! Ocorreu uma oscilação temporária
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Não se preocupe, seus dados estão seguros. Você pode recarregar a página para continuar.
        </p>

        {import.meta.env.DEV && (
          <div className="mb-6 p-3 bg-slate-100 rounded-lg text-left text-xs text-slate-700 font-mono overflow-auto max-h-32">
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="primary"
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Recarregar Página
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/login')}
            className="flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Voltar ao Início
          </Button>
        </div>
      </div>
    </div>
  )
}
