interface BrandLoadingScreenProps {
  message?: string
  fullScreen?: boolean
}

export function BrandLoadingScreen({
  message = 'Carregando...',
  fullScreen = true,
}: BrandLoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center bg-slate-900 dark:bg-[#0b0f19] text-white select-none transition-opacity duration-200 ${
        fullScreen ? 'fixed inset-0 z-50 min-h-screen w-screen' : 'w-full min-h-[360px] py-12'
      }`}
    >
      {/* Contêiner da Logo com Anel de Carregamento Suave */}
      <div className="relative flex items-center justify-center w-24 h-24 mb-5">
        {/* Anel giratório externo */}
        <div className="absolute inset-0 rounded-full border-[3px] border-blue-500/20 border-t-blue-500 animate-spin" />

        {/* Glow de fundo */}
        <div className="absolute inset-2 rounded-full bg-blue-500/10 blur-md animate-pulse" />

        {/* Ícone oficial da marca ControleSoft */}
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-1.5 shadow-lg ring-1 ring-white/20">
          <img
            src="/controlesoft-mark.png"
            alt="ControleSoft"
            className="h-full w-full object-contain"
            loading="eager"
            decoding="async"
          />
        </div>
      </div>

      {/* Identidade e Mensagem de Carregamento */}
      <div className="text-center space-y-1">
        <h2 className="text-sm font-bold tracking-wider text-slate-100 uppercase">
          ControleSoft
        </h2>
        <p className="text-xs font-medium text-slate-400 animate-pulse">
          {message}
        </p>
      </div>

      {/* Barra de progresso indeterminada ultra-leve */}
      <div className="mt-5 h-1 w-36 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full w-full bg-gradient-to-r from-blue-600 via-indigo-400 to-blue-600 animate-[shimmer_1.5s_infinite_linear] rounded-full" />
      </div>
    </div>
  )
}
