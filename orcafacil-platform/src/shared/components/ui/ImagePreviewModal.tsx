import { useEffect, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { X, ZoomIn } from 'lucide-react'

export interface ImagePreviewModalProps {
  open: boolean
  src: string | null | undefined
  alt?: string
  title?: string
  onClose: () => void
}

export function ImagePreviewModal({
  open,
  src,
  alt = 'Visualização da imagem',
  title,
  onClose,
}: ImagePreviewModalProps) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [open, onClose])

  if (!open || !src) return null

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || alt}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative flex max-h-[92vh] max-w-4xl flex-col items-center justify-center">
        {/* Barra superior de controle */}
        <div className="mb-2 flex w-full items-center justify-between text-white">
          <div className="flex items-center gap-2 truncate pr-4">
            <ZoomIn className="h-4 w-4 shrink-0 text-gray-300" aria-hidden="true" />
            {title && <span className="truncate text-sm font-semibold">{title}</span>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Fechar visualização da imagem"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Imagem ampliada */}
        <div className="relative overflow-hidden rounded-2xl bg-black/40 shadow-2xl ring-1 ring-white/10">
          <img
            src={src}
            alt={alt}
            className="max-h-[82vh] w-auto max-w-full select-none object-contain"
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}

