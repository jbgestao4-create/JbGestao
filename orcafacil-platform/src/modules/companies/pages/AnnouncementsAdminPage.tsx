import { useState, useEffect, useRef } from 'react'
import {
  Upload,
  Trash2,
  MoveUp,
  MoveDown,
  Image as ImageIcon,
  ArrowLeft,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { announcementService, type SystemAnnouncement } from '@shared/services/announcement.service'

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (readerEvent) => {
      const image = new Image()
      image.onload = () => {
        const maxWidth = 1280
        const maxHeight = 720
        let width = image.width
        let height = image.height

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(readerEvent.target?.result as string)
          return
        }

        ctx.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      image.onerror = (err) => reject(err)
      image.src = readerEvent.target?.result as string
    }
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(file)
  })
}

export function AnnouncementsAdminPage() {
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const res = await announcementService.listAll()
      if (res.success && res.data) {
        setAnnouncements(res.data)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setError('')
    setMessage('')

    try {
      let count = 0
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!file.type.startsWith('image/')) continue

        const dataUrl = await compressImageFile(file)
        const currentCount = announcements.length + count
        await announcementService.create({
          imageUrl: dataUrl,
          title: file.name.replace(/\.[^/.]+$/, ''),
          orderIndex: currentCount,
        })
        count++
      }

      setMessage(`${count} imagem(ns) adicionada(s) com sucesso aos anúncios!`)
      await loadData()
    } catch {
      setError('Erro ao processar as imagens selecionadas.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await announcementService.delete(id)
      setAnnouncements((prev) => prev.filter((a) => a.id !== id))
      setMessage('Anúncio removido com sucesso.')
    } catch {
      setError('Erro ao remover anúncio.')
    }
  }

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= announcements.length) return

    const list = [...announcements]
    const [moved] = list.splice(index, 1)
    list.splice(targetIndex, 0, moved)

    const reordered = list.map((item, idx) => ({
      ...item,
      orderIndex: idx,
    }))

    setAnnouncements(reordered)
    await announcementService.updateOrder(
      reordered.map((it) => ({ id: it.id, orderIndex: it.orderIndex })),
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
            <Link to="/" className="hover:underline flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao Início
            </Link>
            <span>/</span>
            <span>Painel do Desenvolvedor</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-blue-600" />
            Anúncios e Banners da Tela Inicial
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Imagens configuradas aqui são exibidas no banner rotativo de 3 segundos na tela inicial
            (lado oposto da agenda).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => void handleFilesSelected(e)}
            className="hidden"
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-md transition disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {isUploading ? 'Importando Imagens...' : 'Importar Imagens de Anúncio'}
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {message}
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Regra de Comportamento Card */}
      <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/60 text-xs text-blue-950 dark:text-blue-200 space-y-1">
        <div className="font-bold flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Regra de Exibição na Tela Inicial:
        </div>
        <p>
          • As imagens passam automaticamente a cada <strong>3 segundos</strong>.
        </p>
        <p>
          • Se o usuário posicionar o mouse em cima da imagem, a rotação é <strong>pausada</strong>{' '}
          mantendo a imagem visível.
        </p>
        <p>
          • Ao retirar o cursor do mouse, a transição retoma o ciclo normal de{' '}
          <strong>3 segundos</strong>.
        </p>
      </div>

      {/* Lista de Imagens de Anúncio */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Banners Ativos ({announcements.length})
          </h2>
          <span className="text-xs text-slate-500">
            Você pode importar várias imagens de uma vez (ex: 6 imagens)
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-sm text-slate-500">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mr-2" />
            Carregando anúncios...
          </div>
        ) : announcements.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-10 text-center hover:border-blue-500 dark:hover:border-blue-500 transition bg-white dark:bg-slate-900/40"
          >
            <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Nenhuma imagem de anúncio importada ainda
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Clique aqui para selecionar e importar imagens (JPG, PNG, WebP)
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {announcements.map((ann, idx) => (
              <div
                key={ann.id}
                className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs flex flex-col"
              >
                {/* Image */}
                <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                  <img
                    src={ann.imageUrl}
                    alt={ann.title || `Anúncio ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-md">
                    #{idx + 1}
                  </span>
                </div>

                {/* Info & Controls */}
                <div className="p-3 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="truncate font-semibold text-slate-700 dark:text-slate-300">
                    {ann.title || `Banner ${idx + 1}`}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => void handleMove(idx, 'up')}
                      title="Mover para antes"
                      className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                    >
                      <MoveUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === announcements.length - 1}
                      onClick={() => void handleMove(idx, 'down')}
                      title="Mover para depois"
                      className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                    >
                      <MoveDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(ann.id)}
                      title="Excluir imagem"
                      className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
