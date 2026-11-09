import { useState, useEffect, useRef } from 'react'
import { Sparkles, ChevronLeft, ChevronRight, Image as ImageIcon, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { announcementService, type SystemAnnouncement } from '../services/announcement.service'
import { useAuth } from '@modules/auth/context/AuthContext'
import { isSystemOwner } from '@shared/utils/system-owner'

interface AnnouncementCarouselProps {
  firstName: string
  onManageAnnouncements?: () => void
}

export function AnnouncementCarousel({
  firstName,
  onManageAnnouncements,
}: AnnouncementCarouselProps) {
  const { user } = useAuth()
  const isDev = isSystemOwner(user)

  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const loadAnnouncements = async () => {
    setIsLoading(true)
    try {
      const res = await announcementService.listActive()
      if (res.success && res.data) {
        setAnnouncements(res.data)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadAnnouncements()
  }, [])

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

  // If there are uploaded announcement images, render the interactive 3-second carousel!
  if (!isLoading && announcements.length > 0) {
    const current = announcements[currentIndex]

    return (
      <div
        className="group relative h-full w-full min-h-[310px] sm:min-h-[340px] rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 bg-slate-950 flex flex-col justify-end shadow-sm select-none"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Current Image */}
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
          <img
            key={current.id}
            src={current.imageUrl}
            alt={current.title || `Anúncio ${currentIndex + 1}`}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
          {/* Subtle dark gradient overlay at bottom for readability and indicators */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
        </div>

        {/* Developer shortcut button */}
        {isDev && (
          <div className="absolute top-3 right-3 z-20">
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

        {/* Title if present */}
        {current.title && (
          <div className="relative z-10 p-4">
            <h3 className="text-sm font-bold text-white drop-shadow-md">{current.title}</h3>
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
          <div className="relative z-10 flex items-center justify-center gap-1.5 pb-3">
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
        {isPaused && announcements.length > 1 && (
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
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
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
        <span>JB Gestão Comercial • Solução Empresarial Completa</span>
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
