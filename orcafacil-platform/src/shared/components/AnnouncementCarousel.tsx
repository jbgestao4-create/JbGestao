import { useState, useEffect, useRef } from 'react'
import { LayoutDashboard, ChevronLeft, ChevronRight, Image as ImageIcon, Settings, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { announcementService, type SystemAnnouncement } from '../services/announcement.service'
import { useAuth } from '@modules/auth/context/AuthContext'
import { isSystemOwner } from '@shared/utils/system-owner'

interface AnnouncementCarouselProps {
  firstName: string
  onManageAnnouncements?: () => void
  initialAnnouncements?: SystemAnnouncement[]
  onReady?: () => void
}

function preloadImage(src: string, timeoutMs = 6000): Promise<void> {
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

export function AnnouncementCarousel({
  firstName,
  onManageAnnouncements,
  initialAnnouncements,
  onReady,
}: AnnouncementCarouselProps) {
  const { user } = useAuth()
  const isDev = isSystemOwner(user)

  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>(
    initialAnnouncements ?? [],
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let isMounted = true

    const syncAnnouncements = async () => {
      // Caso a lista venha por prop
      if (initialAnnouncements !== undefined) {
        if (initialAnnouncements.length > 0 && initialAnnouncements[0].imageUrl) {
          setIsLoading(true)
          await preloadImage(initialAnnouncements[0].imageUrl)
          if (isMounted) {
            setAnnouncements(initialAnnouncements)
            setIsLoading(false)
            onReady?.()
          }
          // Pré-carrega demais imagens em segundo plano
          initialAnnouncements.slice(1).forEach((item) => {
            if (item.imageUrl) void preloadImage(item.imageUrl)
          })
        } else {
          if (isMounted) {
            setAnnouncements(initialAnnouncements)
            setIsLoading(false)
            onReady?.()
          }
        }
        return
      }

      // Caso precise buscar diretamente do serviço
      setIsLoading(true)
      try {
        const res = await announcementService.listActive()
        const activeList = res.success && res.data ? res.data : []
        if (activeList.length > 0 && activeList[0].imageUrl) {
          await preloadImage(activeList[0].imageUrl)
          if (isMounted) {
            setAnnouncements(activeList)
            setIsLoading(false)
            onReady?.()
          }
          activeList.slice(1).forEach((item) => {
            if (item.imageUrl) void preloadImage(item.imageUrl)
          })
        } else {
          if (isMounted) {
            setAnnouncements(activeList)
            setIsLoading(false)
            onReady?.()
          }
        }
      } catch {
        if (isMounted) {
          setAnnouncements([])
          setIsLoading(false)
          onReady?.()
        }
      }
    }

    void syncAnnouncements()

    return () => {
      isMounted = false
    }
  }, [initialAnnouncements])

  // Cycle every 3 seconds unless hovered/paused
  useEffect(() => {
    if (announcements.length <= 1 || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length)
    }, 3000)

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

  // Enquanto o anúncio/gif está carregando, exibe a barra e spinner para não ficar vazio em baixo
  if (isLoading) {
    return (
      <div className="relative flex flex-col items-center justify-center h-full min-h-[260px] sm:min-h-[340px] rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs select-none">
        {/* Spinner giratório com a marca ControleSoft */}
        <div className="relative flex items-center justify-center w-14 h-14 mb-3">
          <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 p-1 shadow-2xs ring-1 ring-slate-200 dark:ring-slate-700">
            <img
              src="/controlesoft-mark.png"
              alt="ControleSoft"
              className="h-full w-full object-contain"
            />
          </div>
        </div>

        {/* Barra de carregamento animada */}
        <div className="w-36 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 mb-2">
          <div className="h-full w-full bg-gradient-to-r from-blue-600 via-sky-400 to-blue-600 animate-[shimmer_1.5s_infinite_linear] rounded-full" />
        </div>

        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
          Carregando...
        </p>
      </div>
    )
  }

  // If there are uploaded announcement images, render the interactive 3-second carousel!
  if (announcements.length > 0) {
    const current = announcements[currentIndex]

    const handleBannerClick = () => {
      if (current.linkUrl && current.linkUrl.trim()) {
        let target = current.linkUrl.trim()
        if (!/^https?:\/\//i.test(target)) {
          target = `https://${target}`
        }
        window.open(target, '_blank', 'noopener,noreferrer')
      }
    }

    return (
      <div
        className={`group relative h-full w-full min-h-[310px] sm:min-h-[340px] rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 bg-slate-950 flex flex-col justify-end shadow-sm select-none ${
          current.linkUrl ? 'cursor-pointer' : ''
        }`}
        onClick={handleBannerClick}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Current Image */}
        <div className="absolute inset-0 bg-slate-950 flex items-center justify-center overflow-hidden">
          {/* Fundo com leve desfoque para preenchimento de bordas sem cortes */}
          <img
            src={current.imageUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover blur-xl opacity-25 scale-110 pointer-events-none"
          />
          {/* Imagem do anúncio ajustada automaticamente ao tamanho do card sem cortar a foto */}
          <img
            key={current.id}
            src={current.imageUrl}
            alt={current.title || `Anúncio ${currentIndex + 1}`}
            className="relative z-10 max-h-full max-w-full w-auto h-auto object-contain transition-opacity duration-300"
          />
          {/* Sombra no rodapé para visibilidade do resumo e indicadores */}
          <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none z-10" />
        </div>

        {/* Link indicator */}
        {current.linkUrl && (
          <div
            title={`Clique no banner para acessar: ${current.linkUrl}`}
            className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-black/60 hover:bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md transition shadow-md border border-white/20"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="hidden sm:inline">Acessar link</span>
          </div>
        )}

        {/* Developer shortcut button */}
        {isDev && (
          <div
            className="absolute top-3 right-3 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            {onManageAnnouncements ? (
              <button
                type="button"
                onClick={onManageAnnouncements}
                title="Configurar Anúncios (Perfil do Desenvolvedor)"
                className="flex items-center gap-1.5 rounded-lg bg-black/60 hover:bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md transition shadow-md border border-white/20"
              >
                <Settings className="h-3 w-3" />
                <span>Editar Anúncios</span>
              </button>
            ) : (
              <Link
                to="/admin/announcements"
                title="Configurar Anúncios (Perfil do Desenvolvedor)"
                className="flex items-center gap-1.5 rounded-lg bg-black/60 hover:bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md transition shadow-md border border-white/20"
              >
                <Settings className="h-3 w-3" />
                <span>Editar Anúncios</span>
              </Link>
            )}
          </div>
        )}

        {/* Resumo no rodapé do anúncio */}
        {current.summary && (
          <div className="relative z-10 mx-3 mb-2 rounded-xl bg-black/70 backdrop-blur-md px-3.5 py-2 text-xs text-slate-100 shadow-md border border-white/15">
            <p className="line-clamp-2 leading-relaxed font-medium">{current.summary}</p>
          </div>
        )}

        {/* Navigation Arrows on hover */}
        {announcements.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              title="Anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/50 hover:bg-black/80 p-1.5 text-white opacity-0 group-hover:opacity-100 transition shadow-md border border-white/10"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              title="Próximo"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/50 hover:bg-black/80 p-1.5 text-white opacity-0 group-hover:opacity-100 transition shadow-md border border-white/10"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Indicators at bottom */}
        {announcements.length > 1 && (
          <div
            className="relative z-10 flex items-center justify-center gap-1.5 pb-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            {announcements.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                title={`Ir para imagem ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentIndex ? 'w-6 bg-blue-500 shadow-xs' : 'w-2 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        )}

        {/* Paused indicator tag */}
        {isPaused && !current.linkUrl && announcements.length > 1 && (
          <div className="absolute top-3 left-3 z-20 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium text-slate-300 backdrop-blur-md">
            Pausado
          </div>
        )}
      </div>
    )
  }

  // Default state when no announcement images are uploaded yet
  return (
    <div className="relative flex flex-col justify-between h-full min-h-[310px] sm:min-h-[340px] rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 text-slate-800 dark:text-white shadow-sm">
      <div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-md border border-blue-200 dark:border-blue-300/20 bg-blue-50 dark:bg-blue-300/10 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-100">
            <LayoutDashboard aria-hidden="true" className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
            Painel Principal do Sistema
          </span>

          {isDev && (
            <Link
              to="/admin/announcements"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-300 hover:underline transition"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              + Inserir Anúncios
            </Link>
          )}
        </div>

        <h2 className="mt-5 text-2xl font-bold leading-tight sm:text-3xl text-slate-900 dark:text-white">
          Bem-vindo ao Sistema JB, <span className="text-blue-600 dark:text-blue-400">{firstName}</span>!
        </h2>
        <p className="mt-3 text-xs sm:text-sm leading-6 text-slate-600 dark:text-slate-300 max-w-xl">
          Selecione uma das opções abaixo para gerenciar as rotinas comerciais, operacionais e
          cadastrais da sua empresa.
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-slate-100 dark:border-white/10 pt-3 text-xs text-slate-500 dark:text-slate-400">
        <span>ControleSoft • Solução Empresarial Completa</span>
        {isDev && (
          <Link
            to="/admin/announcements"
            className="text-blue-600 dark:text-blue-400 hover:underline font-bold"
          >
            Configurar Banners do Desenvolvedor →
          </Link>
        )}
      </div>
    </div>
  )
}
