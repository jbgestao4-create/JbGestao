interface BrandLoadingScreenProps {
  message?: string
  fullScreen?: boolean
}

export function BrandLoadingScreen({
  message = 'Carregando...',
}: BrandLoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center p-8 min-h-[220px] w-full select-none"
    >
      <div className="relative flex items-center justify-center w-14 h-14 mb-2.5">
        <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white p-1 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700">
          <img
            src="/controlesoft-mark.png"
            alt="ControleSoft"
            className="h-full w-full object-contain"
            loading="eager"
          />
        </div>
      </div>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
        {message}
      </p>
    </div>
  )
}
