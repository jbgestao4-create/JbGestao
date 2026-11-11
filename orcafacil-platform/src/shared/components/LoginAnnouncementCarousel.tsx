import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import {
  announcementService,
  type SystemAnnouncement,
} from '../services/announcement.service'

interface LoginAnnouncementCarouselProps {
  /**
   * Callback invocado quando os anúncios terminam de carregar.
   * Informa se há anúncios de login cadastrados e ativos.
   */
  onStatusChange?: (hasAnnouncements: boolean) => void
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

export function LoginAnnouncementCarousel({ onStatusChange }: LoginAnnouncementCarouselProps) {
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

  return (
    <div
      className="group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl bg-slate-950/80 shadow-2xl transition-all"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Carrossel de novidades e anúncios da tela de login"
    >
      {/* Imagem do anúncio */}
      <div
        className={`relative flex h-full w-full items-center justify-center overflow-hidden ${
          current.linkUrl ? 'cursor-pointer' : 'cursor-default'
        }`}
        onClick={handleBannerClick}
      >
        <img
          key={current.id}
          src={current.imageUrl}
          alt={current.title || 'Anúncio'}
          className="h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-[1.02]"
        />

        {/* Gradiente de proteção para texto e navegação */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/40" />

        {/* Indicador de link externo no topo quando aplicável */}
        {current.linkUrl && (
          <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-bold text-white shadow-md backdrop-blur-md transition-transform group-hover:scale-105 border border-white/10">
            <span>Abrir novidade</span>
            <ExternalLink className="h-3 w-3 text-sky-400" />
          </div>
        )}
      </div>

      {/* Botões de navegação lateral (exibidos no hover quando há mais de 1 imagem) */}
      {announcements.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-slate-900/70 p-2 text-white shadow-lg backdrop-blur-md opacity-0 transition-opacity hover:bg-slate-900 group-hover:opacity-100 cursor-pointer border border-white/10"
            title="Anúncio anterior"
            aria-label="Anúncio anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-slate-900/70 p-2 text-white shadow-lg backdrop-blur-md opacity-0 transition-opacity hover:bg-slate-900 group-hover:opacity-100 cursor-pointer border border-white/10"
            title="Próximo anúncio"
            aria-label="Próximo anúncio"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Conteúdo inferior: Legenda, resumo, barra de tempo e bolinhas indicadoras */}
      <div className="absolute bottom-0 inset-x-0 z-20 p-6 flex flex-col gap-3">
        {(current.title || current.summary) && (
          <div
            className={`max-w-xl space-y-1 ${
              current.linkUrl ? 'cursor-pointer hover:opacity-95' : ''
            }`}
            onClick={handleBannerClick}
          >
            {current.title && (
              <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-md">
                {current.title}
              </h2>
            )}
            {current.summary && (
              <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed drop-shadow-sm font-medium">
                {current.summary}
              </p>
            )}
          </div>
        )}

        {/* Indicadores de slides e progresso de 8 segundos */}
        {announcements.length > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            {/* Bolinhas / Barras de paginação */}
            <div className="flex items-center gap-1.5">
              {announcements.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === currentIndex
                      ? 'w-7 bg-sky-400'
                      : 'w-2 bg-white/40 hover:bg-white/70'
                  }`}
                  aria-label={`Ir para anúncio ${idx + 1}`}
                />
              ))}
            </div>

            {/* Marcador de tempo (8s) */}
            <span className="text-[11px] font-semibold text-slate-300 tracking-wider">
              {isPaused ? 'Pausado' : 'Passa a cada 8s'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
