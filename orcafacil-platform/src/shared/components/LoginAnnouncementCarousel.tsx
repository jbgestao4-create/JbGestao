import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import {
  announcementService,
  type SystemAnnouncement,
} from '../services/announcement.service'
import { BrandLogo } from './BrandLogo'

export interface LoginAnnouncementCarouselProps {
  /**
   * Callback invocado quando os anúncios terminam de carregar.
   * Informa se há anúncios de login cadastrados e ativos.
   */
  onStatusChange?: (hasAnnouncements: boolean) => void

  /**
   * Modo de renderização:
   * - 'fullscreen' (padrão): ocupa a tela inteira (100% largura e altura da lateral da tela de login, sem margens).
   * - 'contained': modo contido com cantos arredondados, usado para pré-visualização em painéis administrativos.
   */
  variant?: 'fullscreen' | 'contained'
}

function preloadImage(src: string, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    if (!src) {
      resolve()
      return
    }
    const img = new Image()
    const timer = setTimeout(resolve, timeoutMs)
    img.onload = () => {
      clearTimeout(timer)
      resolve()
    }
    img.onerror = () => {
      clearTimeout(timer)
      resolve()
    }
    img.src = src
  })
}

export function LoginAnnouncementCarousel({
  onStatusChange,
  variant = 'fullscreen',
}: LoginAnnouncementCarouselProps) {
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadLoginAnnouncements = async () => {
      try {
        const res = await announcementService.listActive('login')
        const activeList = res.success && res.data ? res.data : []

        if (!isMounted) return

        if (activeList.length > 0 && activeList[0].imageUrl) {
          await preloadImage(activeList[0].imageUrl)
          activeList.slice(1).forEach((item) => {
            if (item.imageUrl) void preloadImage(item.imageUrl)
          })
        }

        if (isMounted) {
          setAnnouncements(activeList)
          onStatusChange?.(activeList.length > 0)
        }
      } catch {
        if (isMounted) {
          setAnnouncements([])
          onStatusChange?.(false)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadLoginAnnouncements()

    return () => {
      isMounted = false
    }
  }, [onStatusChange])

  // Transição automática a cada 8 segundos (conforme solicitado pelo usuário)
  useEffect(() => {
    if (announcements.length <= 1 || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length)
    }, 8000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [announcements.length, isPaused])

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length)
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev + 1) % announcements.length)
  }

  if (isLoading || announcements.length === 0) {
    return null
  }

  const current = announcements[currentIndex]

  const handleBannerClick = () => {
    if (current.linkUrl && current.linkUrl.trim()) {
      window.open(current.linkUrl.trim(), '_blank', 'noopener,noreferrer')
    }
  }

  const isFullscreen = variant === 'fullscreen'

  return (
    <div
      className={`group relative flex w-full flex-col justify-between overflow-hidden bg-slate-950 select-none transition-all ${
        isFullscreen
          ? 'h-full min-h-screen rounded-none'
          : 'h-full rounded-2xl shadow-2xl'
      }`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Carrossel de novidades e anúncios da tela de login"
    >
      {/* Imagem do anúncio em tela inteira */}
      <div
        className={`absolute inset-0 h-full w-full overflow-hidden ${
          current.linkUrl ? 'cursor-pointer' : 'cursor-default'
        }`}
        onClick={handleBannerClick}
      >
        <img
          key={current.id}
          src={current.imageUrl}
          alt={current.title || 'Anúncio de Login'}
          className="h-full w-full object-cover object-center transition-all duration-700 ease-out group-hover:scale-[1.02]"
        />

        {/* Gradiente superior para proteger logo e badges */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-slate-950/90 via-slate-950/40 to-transparent z-10" />

        {/* Gradiente inferior para proteger textos, paginação e rodapé */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent z-10" />
      </div>

      {/* Topo: Logo ControleSoft e Link externo */}
      {isFullscreen && (
        <div className="relative z-30 flex items-center justify-between p-8 xl:p-10 pointer-events-auto">
          <BrandLogo dark />

          {current.linkUrl && (
            <button
              type="button"
              onClick={handleBannerClick}
              className="flex items-center gap-2 rounded-full bg-slate-900/80 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md transition-all hover:bg-slate-800 hover:scale-105 border border-white/10 cursor-pointer"
            >
              <span>Abrir novidade</span>
              <ExternalLink className="h-3.5 w-3.5 text-sky-400" />
            </button>
          )}
        </div>
      )}

      {/* Indicador de link em modo contained (preview) */}
      {!isFullscreen && current.linkUrl && (
        <div className="relative z-30 flex justify-end p-4">
          <div className="flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-bold text-white shadow-md backdrop-blur-md border border-white/10">
            <span>Abrir novidade</span>
            <ExternalLink className="h-3 w-3 text-sky-400" />
          </div>
        </div>
      )}

      {/* Botões de navegação lateral (exibidos no hover quando há mais de 1 imagem) */}
      {announcements.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-4 top-1/2 z-30 -translate-y-1/2 rounded-full bg-slate-900/70 p-3 text-white shadow-2xl backdrop-blur-md opacity-0 transition-all hover:bg-slate-900 hover:scale-110 group-hover:opacity-100 cursor-pointer border border-white/10"
            title="Anúncio anterior"
            aria-label="Anúncio anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-4 top-1/2 z-30 -translate-y-1/2 rounded-full bg-slate-900/70 p-3 text-white shadow-2xl backdrop-blur-md opacity-0 transition-all hover:bg-slate-900 hover:scale-110 group-hover:opacity-100 cursor-pointer border border-white/10"
            title="Próximo anúncio"
            aria-label="Próximo anúncio"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Rodapé: Legenda, resumo, barra de tempo e bolinhas indicadoras */}
      <div
        className={`relative z-30 flex flex-col gap-3.5 ${
          isFullscreen ? 'p-8 xl:p-10' : 'p-6'
        }`}
      >
        {(current.title || current.summary) && (
          <div
            className={`max-w-xl space-y-1.5 ${
              current.linkUrl ? 'cursor-pointer hover:opacity-95' : ''
            }`}
            onClick={handleBannerClick}
          >
            {current.title && (
              <h2 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg">
                {current.title}
              </h2>
            )}
            {current.summary && (
              <p className="text-sm text-slate-200 line-clamp-2 leading-relaxed drop-shadow-md font-medium">
                {current.summary}
              </p>
            )}
          </div>
        )}

        {/* Indicadores de slides e progresso de 8 segundos */}
        {announcements.length > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-white/15">
            {/* Bolinhas / Barras de paginação */}
            <div className="flex items-center gap-2">
              {announcements.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-2.5 rounded-full transition-all cursor-pointer ${
                    idx === currentIndex
                      ? 'w-8 bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.7)]'
                      : 'w-2.5 bg-white/40 hover:bg-white/70'
                  }`}
                  aria-label={`Ir para anúncio ${idx + 1}`}
                />
              ))}
            </div>

            {/* Marcador de tempo (8s) */}
            <span className="text-xs font-semibold text-slate-300 tracking-wider">
              {isPaused ? 'Pausado' : 'Passa a cada 8s'}
            </span>
          </div>
        )}

        {isFullscreen && (
          <p className="text-xs text-slate-400">ControleSoft — Potencialize a administração da sua empresa</p>
        )}
      </div>
    </div>
  )
}
