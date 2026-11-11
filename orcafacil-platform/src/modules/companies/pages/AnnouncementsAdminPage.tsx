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
  Link as LinkIcon,
  FileText,
  Save,
  ExternalLink,
  LayoutDashboard,
  LogIn,
  Eye,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  announcementService,
  type SystemAnnouncement,
  type AnnouncementTargetPage,
} from '@shared/services/announcement.service'
import { LoginAnnouncementCarousel } from '@shared/components/LoginAnnouncementCarousel'

async function compressImageFile(file: File): Promise<string> {
  // Suporte a GIF: não passa pelo canvas para preservar a animação dos quadros
  if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = (err) => reject(err)
      reader.readAsDataURL(file)
    })
  }

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
  const [activeTab, setActiveTab] = useState<AnnouncementTargetPage>('dashboard')
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([])
  const [dashboardCount, setDashboardCount] = useState<number>(0)
  const [loginCount, setLoginCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedBannerId, setSavedBannerId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showLivePreview, setShowLivePreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = async (target: AnnouncementTargetPage = activeTab) => {
    setIsLoading(true)
    try {
      const [targetRes, allRes] = await Promise.all([
        announcementService.listAll(target),
        announcementService.listAll(),
      ])

      if (targetRes.success && targetRes.data) {
        setAnnouncements(targetRes.data)
      }

      if (allRes.success && allRes.data) {
        setDashboardCount(allRes.data.filter((a) => (a.targetPage || 'dashboard') === 'dashboard').length)
        setLoginCount(allRes.data.filter((a) => a.targetPage === 'login').length)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData(activeTab)
  }, [activeTab])

  const handleTabChange = (tab: AnnouncementTargetPage) => {
    setActiveTab(tab)
    setError('')
    setMessage('')
  }

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
          targetPage: activeTab,
        })
        count++
      }

      const destLabel = activeTab === 'login' ? 'na tela de login' : 'na tela inicial'
      setMessage(`${count} imagem(ns) adicionada(s) com sucesso aos anúncios ${destLabel}!`)
      await loadData(activeTab)
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
      if (activeTab === 'dashboard') {
        setDashboardCount((c) => Math.max(0, c - 1))
      } else {
        setLoginCount((c) => Math.max(0, c - 1))
      }
    } catch {
      setError('Erro ao excluir anúncio.')
    }
  }

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= announcements.length) return

    const list = [...announcements]
    const temp = list[index]
    list[index] = list[targetIndex]
    list[targetIndex] = temp

    const reordered = list.map((item, idx) => ({
      ...item,
      orderIndex: idx,
    }))

    setAnnouncements(reordered)
    await announcementService.updateOrder(
      reordered.map((it) => ({ id: it.id, orderIndex: it.orderIndex })),
    )
  }

  const handleFieldChange = (id: string, field: 'linkUrl' | 'summary' | 'title', value: string) => {
    setAnnouncements((prev) =>
      prev.map((ann) => (ann.id === id ? { ...ann, [field]: value } : ann)),
    )
  }

  const handleSaveBanner = async (ann: SystemAnnouncement) => {
    setSavingId(ann.id)
    setError('')
    try {
      const res = await announcementService.update(ann.id, {
        title: ann.title,
        linkUrl: ann.linkUrl,
        summary: ann.summary,
        targetPage: ann.targetPage || activeTab,
      })
      if (res.success) {
        setSavedBannerId(ann.id)
        setTimeout(() => setSavedBannerId(null), 3000)
      } else {
        setError(res.error || 'Erro ao salvar alterações do banner.')
      }
    } catch {
      setError('Erro ao salvar anúncio.')
    } finally {
      setSavingId(null)
    }
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
            <Link to="/admin/developer-settings" className="hover:underline">
              Configurações de Desenvolvedor
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-blue-600" />
            Anúncios e Banners do Sistema
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gerencie os comunicados e novidades da Tela Inicial e da Página de Login.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.gif,.png,.jpg,.jpeg,.webp"
            multiple
            onChange={(e) => void handleFilesSelected(e)}
            className="hidden"
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            {isUploading
              ? 'Importando Imagens/GIFs...'
              : `Importar Imagens (${activeTab === 'login' ? 'Tela de Login' : 'Tela Inicial'})`}
          </button>
        </div>
      </div>

      {/* SELETOR DE ABAS: TELA INICIAL vs TELA DE LOGIN */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => handleTabChange('dashboard')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/40'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-blue-400'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Tela Inicial</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
              activeTab === 'dashboard'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {dashboardCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('login')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'login'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25 ring-2 ring-purple-400/40'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-purple-400'
          }`}
        >
          <LogIn className="h-4 w-4" />
          <span>Tela de Login</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
              activeTab === 'login'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {loginCount}
          </span>
        </button>

        {activeTab === 'login' && announcements.length > 0 && (
          <button
            type="button"
            onClick={() => setShowLivePreview((prev) => !prev)}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>{showLivePreview ? 'Ocultar Pré-visualização' : 'Pré-visualizar na Tela de Login'}</span>
          </button>
        )}
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
      {activeTab === 'dashboard' ? (
        <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/60 text-xs text-blue-950 dark:text-blue-200 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Regra de Exibição na Tela Inicial:
          </div>
          <p>
            • As imagens passam automaticamente a cada <strong>3 segundos</strong>.
          </p>
          <p>
            • Se o usuário posicionar o mouse em cima da imagem, a rotação é <strong>pausada</strong> mantendo a imagem visível.
          </p>
          <p>
            • Ao retirar o cursor do mouse, a transição retoma o ciclo de 3 segundos.
          </p>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-900/60 text-xs text-purple-950 dark:text-purple-200 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            Regra de Exibição na Tela de Login:
          </div>
          <p>
            • As imagens passam automaticamente a cada <strong>8 segundos</strong> (conforme configurado).
          </p>
          <p>
            • Ficam em destaque no painel lateral esquerdo da página de login para todos os visitantes e operadores.
          </p>
          <p>
            • Se o usuário posicionar o cursor sobre a imagem, a rotação é <strong>pausada</strong>.
          </p>
        </div>
      )}

      {/* PRÉ-VISUALIZAÇÃO AO VIVO (TELA DE LOGIN) */}
      {activeTab === 'login' && showLivePreview && announcements.length > 0 && (
        <div className="rounded-2xl border-2 border-purple-300 dark:border-purple-800 bg-slate-900 p-6 space-y-3">
          <div className="flex items-center justify-between text-xs text-purple-300 font-bold">
            <span>Pré-visualização da Tela de Login (Rotação a cada 8 segundos):</span>
            <span className="text-[11px] font-normal text-slate-400">Dimensões reais de exibição</span>
          </div>
          <div className="h-[360px] w-full max-w-2xl mx-auto">
            <LoginAnnouncementCarousel variant="contained" />
          </div>
        </div>
      )}

      {/* Lista de Imagens de Anúncio */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {activeTab === 'login' ? 'Banners da Tela de Login' : 'Banners da Tela Inicial'} ({announcements.length})
          </h2>
          <span className="text-xs text-slate-500">
            Você pode importar várias imagens de uma vez (JPG, PNG, GIF, WebP)
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
              {activeTab === 'login'
                ? 'Nenhuma imagem cadastrada para a Tela de Login ainda'
                : 'Nenhuma imagem de anúncio importada para a Tela Inicial ainda'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Clique aqui para selecionar e importar imagens para {activeTab === 'login' ? 'a Tela de Login' : 'a Tela Inicial'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {announcements.map((ann, idx) => {
              const isGif =
                ann.imageUrl.startsWith('data:image/gif') ||
                ann.imageUrl.toLowerCase().includes('.gif') ||
                ann.title?.toLowerCase().endsWith('.gif')

              const isSaving = savingId === ann.id
              const isSaved = savedBannerId === ann.id

              return (
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
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <span className="rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-md">
                        #{idx + 1}
                      </span>
                      {isGif && (
                        <span className="rounded-md bg-purple-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white tracking-wider">
                          GIF
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Header & Reorder Controls */}
                  <div className="p-3 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                    <input
                      type="text"
                      value={ann.title || ''}
                      onChange={(e) => handleFieldChange(ann.id, 'title', e.target.value)}
                      placeholder={`Banner ${idx + 1}`}
                      className="font-semibold text-slate-700 dark:text-slate-300 bg-transparent border-none p-0 focus:ring-0 truncate w-full"
                    />

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => void handleMove(idx, 'up')}
                        title="Mover para antes"
                        className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                      >
                        <MoveUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === announcements.length - 1}
                        onClick={() => void handleMove(idx, 'down')}
                        title="Mover para depois"
                        className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                      >
                        <MoveDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(ann.id)}
                        title="Excluir banner"
                        className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Edit Form: Link & Resumo */}
                  <div className="p-3 space-y-2.5 text-xs flex-1 flex flex-col justify-between bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="space-y-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1 mb-1">
                          <LinkIcon className="h-3 w-3 text-blue-600" />
                          Link de Destino (ao clicar no banner):
                        </label>
                        <div className="relative">
                          <input
                            type="url"
                            value={ann.linkUrl || ''}
                            onChange={(e) => handleFieldChange(ann.id, 'linkUrl', e.target.value)}
                            placeholder="https://exemplo.com.br"
                            className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 pr-7"
                          />
                          {ann.linkUrl && (
                            <a
                              href={ann.linkUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              title="Testar link"
                              className="absolute right-2 top-2 text-slate-400 hover:text-blue-600"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1 mb-1">
                          <FileText className="h-3 w-3 text-blue-600" />
                          Resumo no Rodapé da Imagem:
                        </label>
                        <textarea
                          rows={2}
                          value={ann.summary || ''}
                          onChange={(e) => handleFieldChange(ann.id, 'summary', e.target.value)}
                          placeholder="Texto que será exibido no rodapé do banner..."
                          className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                        />
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[11px] text-emerald-600 font-semibold">
                        {isSaved && '✓ Alterações salvas!'}
                      </span>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void handleSaveBanner(ann)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-bold text-white transition shadow-2xs disabled:opacity-50 ml-auto cursor-pointer"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
