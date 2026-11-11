import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import {
  announcementService,
  type SystemAnnouncement,
} from '../services/announcement.service'
import { BrandLogo } from './BrandLogo'

export interface LoginAnnouncementCarouselProps {
  /**
   * Callback opcional invocado quando os anúncios terminam de carregar.
   * Informa se há anúncios de login cadastrados e ativos.
   */
  onStatusChange?: (hasAnnouncements: boolean) => void

  /**
   * Callback invocado quando todo o anúncio e sua imagem estiverem 100% carregados e decodificados em memória.
   * Usado para sincronizar a liberação da abertura da página do site.
   */
  onReady?: () => void

  /**
   * Modo de renderização:
   * - 'fullscreen' (padrão): ocupa a lateral inteira da tela de login, sem margens ou textos indesejados.
   * - 'contained': modo contido com cantos arredondados, usado para pré-visualização em painéis administrativos.
   */
  variant?: 'fullscreen' | 'contained'
}

function preloadImage(src: string, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    if (!src) {
      resolve()
      return
    }
    const img = new Image()
    let resolved = false
    const finish = () => {
      if (!resolved) {
        resolved = true
        resolve()
      }
    }
    const timer = setTimeout(finish, timeoutMs)

    img.onload = () => {
      clearTimeout(timer)
      if ('decode' in img && typeof img.decode === 'function') {
        img.decode().then(finish).catch(finish)
      } else {
        finish()
      }
    }

    img.onerror = () => {
      clearTimeout(timer)
      finish()
    }

    img.src = src
  })
}

export function LoginAnnouncementCarousel({
  onStatusChange,
  onReady,
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

        // Pré-carrega e decodifica a imagem antes de sinalizar prontidão
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
          onReady?.()
        }
      }
    }

    void loadLoginAnnouncements()

    return () => {
      isMounted = false
    }
  }, [onStatusChange, onReady])

  // Transição automática a cada 8 segundos
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

  const isFullscreen = variant === 'fullscreen'

  // Quando for abrir a página e carregar a foto: exibe a bolinha rodando para que carregue
  if (isLoading) {
    if (isFullscreen) {
      return (
        <div className="relative flex h-full min-h-screen w-full flex-col justify-between overflow-hidden bg-slate-950 p-8 xl:p-10 select-none">
          <div className="relative z-30">
            <BrandLogo dark />
          </div>
          <div className="my-auto flex flex-col items-center justify-center gap-4">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-sky-400"
              role="status"
              aria-label="Carregando"
            />
            <span className="text-xs font-medium tracking-wide text-slate-400">Carregando novidades...</span>
          </div>
          <div className="h-6" />
        </div>
      )
    }

    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div
          className="h-8 w-8 animate-spin rounded-full border-3 border-slate-700 border-t-sky-400"
          role="status"
          aria-label="Carregando"
        />
      </div>
    )
  }

  // Se não houver fotos cadastradas, mantém a tela limpa com apenas o logo
  if (announcements.length === 0) {
    if (isFullscreen) {
      return (
        <div className="relative flex h-full min-h-screen w-full flex-col justify-between overflow-hidden bg-[#0F172A] p-8 xl:p-10 select-none">
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />
          <div className="relative z-30">
            <BrandLogo dark />
          </div>
          <div className="my-auto text-center max-w-sm mx-auto">
            <p className="text-sm font-semibold text-blue-300">ControleSoft</p>
            <p className="mt-2 text-xs text-slate-400">Potencialize a administração da sua empresa</p>
          </div>
          <div className="h-6" />
        </div>
      )
    }

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

        {/* Gradiente superior suave para proteger o logo */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-slate-950/80 via-slate-950/30 to-transparent z-10" />

        {/* Gradiente inferior suave (apenas se houver mais de 1 anúncio para as bolinhas) */}
        {announcements.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent z-10" />
        )}
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

      {/* Rodapé: Apenas bolinhas e contador de tempo (quando houver mais de 1 anúncio, sem textos nem títulos sobrepostos) */}
      {announcements.length > 1 ? (
        <div
          className={`relative z-30 flex items-center justify-between ${
            isFullscreen ? 'p-8 xl:p-10' : 'p-6'
          }`}
        >
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
      ) : (
        <div className="h-4" />
      )}
    </div>
  )
}
