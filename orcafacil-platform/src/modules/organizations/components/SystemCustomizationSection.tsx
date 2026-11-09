import { useState, useId, useRef } from 'react'
import { useThemeColor } from '@shared/context/ThemeColorContext'
import { useTheme } from '@shared/context/ThemeContext'
import { useOrganization } from '../context/OrganizationContext'
import { organizationService } from '../services/organization.service'
import { Card, CardContent, CardHeader } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { Badge } from '@shared/components/ui/Badge'
import { normalizeHexColor, generateThemeShades } from '@shared/utils/theme-color'
import {
  Palette,
  Check,
  RotateCcw,
  X,
  Pipette,
  Save,
  CheckCircle2,
  AlertCircle,
  Info,
  LayoutDashboard,
  ShoppingCart,
  TrendingUp,
  Moon,
  Sun,
  Image as ImageIcon,
  Upload,
  Trash2,
  Store,
  Eye,
} from 'lucide-react'

export function SystemCustomizationSection() {
  // -------------------------------------------------------------------------
  // 1. TEMA DE CORES PRIMÁRIAS DO SISTEMA
  // -------------------------------------------------------------------------
  const {
    themeColor,
    previewColor,
    currentColor,
    isDefaultColor,
    isSaving: isSavingColor,
    presetColors,
    setPreviewColor,
    saveThemeColor,
    restoreDefaultColor,
    cancelPreview,
  } = useThemeColor()

  // -------------------------------------------------------------------------
  // 2. MODO NOTURNO / CLARO (THEME CONTEXT)
  // -------------------------------------------------------------------------
  const { theme, isDark, setTheme } = useTheme()

  // -------------------------------------------------------------------------
  // 3. IMAGEM DE FUNDO DO PDV (ORGANIZATION)
  // -------------------------------------------------------------------------
  const { currentOrganization, updatePdvBackground } = useOrganization()
  const [selectedPdvFile, setSelectedPdvFile] = useState<File | null>(null)
  const [pdvPreviewUrl, setPdvPreviewUrl] = useState<string | null>(
    currentOrganization?.pdvBackgroundUrl || null,
  )
  const [isUploadingPdv, setIsUploadingPdv] = useState(false)
  const [pdvFeedback, setPdvFeedback] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // -------------------------------------------------------------------------
  // ESTADO LOCAL DE CORES E FEEDBACK
  // -------------------------------------------------------------------------
  const [customHexInput, setCustomHexInput] = useState(currentColor)
  const [colorFeedbackMessage, setColorFeedbackMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const colorInputId = useId()
  const hasUnsavedColorChanges =
    previewColor !== null && previewColor.toLowerCase() !== themeColor.toLowerCase()

  // Calcula os tons para exibição na prévia
  const previewShades = generateThemeShades(currentColor)

  const handleSelectPreset = (hex: string) => {
    setCustomHexInput(hex)
    setPreviewColor(hex)
    setColorFeedbackMessage(null)
  }

  const handleCustomColorChange = (value: string) => {
    setCustomHexInput(value)
    const normalized = normalizeHexColor(value)
    if (normalized) {
      setPreviewColor(normalized)
      setColorFeedbackMessage(null)
    }
  }

  const handleSaveColor = async () => {
    setColorFeedbackMessage(null)
    const result = await saveThemeColor(currentColor)
    if (result.success) {
      setColorFeedbackMessage({
        type: 'success',
        text: 'Personalização de cores salva com sucesso! Aplicada em todo o sistema.',
      })
    } else {
      setColorFeedbackMessage({
        type: 'error',
        text: result.error || 'Não foi possível salvar a cor do sistema.',
      })
    }
  }

  const handleRestoreDefaultColor = async () => {
    setColorFeedbackMessage(null)
    const result = await restoreDefaultColor()
    if (result.success) {
      setCustomHexInput('#0284c7')
      setColorFeedbackMessage({
        type: 'success',
        text: 'Cor original azul padrão restaurada com sucesso!',
      })
    } else {
      setColorFeedbackMessage({
        type: 'error',
        text: result.error || 'Não foi possível restaurar a cor padrão.',
      })
    }
  }

  const handleCancelColor = () => {
    cancelPreview()
    setCustomHexInput(themeColor)
    setColorFeedbackMessage(null)
  }

  // -------------------------------------------------------------------------
  // HANDLERS DA IMAGEM DE FUNDO DO PDV
  // -------------------------------------------------------------------------
  const savePdvImageProcess = async (file: File | null, base64Fallback: string | null) => {
    if (!currentOrganization) {
      setPdvFeedback({
        type: 'error',
        text: 'Nenhuma organização selecionada.',
      })
      return
    }

    setIsUploadingPdv(true)
    setPdvFeedback({
      type: 'success',
      text: 'Salvando e aplicando imagem de fundo no PDV...',
    })

    try {
      let finalUrl: string | null = base64Fallback || pdvPreviewUrl

      // Se há um arquivo selecionado, faz o upload para o storage (com fallback automático para Base64)
      if (file) {
        const uploadRes = await organizationService.uploadPdvBackground(
          currentOrganization.id,
          file,
        )

        if (uploadRes.success && uploadRes.data?.url) {
          finalUrl = uploadRes.data.url
        }
      }

      // Salva no localStorage para disponibilidade instantânea
      if (typeof window !== 'undefined') {
        if (finalUrl) {
          localStorage.setItem(`pdv_bg_${currentOrganization.id}`, finalUrl)
          localStorage.setItem('pdv_bg_last', finalUrl)
          localStorage.setItem('pdv_background_url', finalUrl)
        } else {
          localStorage.removeItem(`pdv_bg_${currentOrganization.id}`)
          localStorage.removeItem('pdv_bg_last')
          localStorage.removeItem('pdv_background_url')
        }
        window.dispatchEvent(new Event('storage'))
      }

      // Atualiza o estado da organização
      const updateRes = await updatePdvBackground(finalUrl)
      if (updateRes.success) {
        setSelectedPdvFile(null)
        setPdvPreviewUrl(finalUrl)
        setPdvFeedback({
          type: 'success',
          text: finalUrl
            ? 'Imagem de fundo do PDV aplicada com sucesso! Já está ativa no terminal de vendas.'
            : 'Imagem de fundo do PDV removida com sucesso.',
        })
      } else {
        setPdvFeedback({
          type: 'error',
          text: updateRes.error || 'Não foi possível salvar a imagem no banco de dados.',
        })
      }
    } catch {
      setPdvFeedback({
        type: 'error',
        text: 'Ocorreu um erro inesperado ao salvar a imagem.',
      })
    } finally {
      setIsUploadingPdv(false)
    }
  }

  const handlePdvFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPdvFeedback(null)
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setPdvFeedback({
        type: 'error',
        text: 'Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP, SVG).',
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setPdvFeedback({
        type: 'error',
        text: 'A imagem deve ter no máximo 5MB.',
      })
      return
    }

    setSelectedPdvFile(file)

    // Converte imediatamente para Data URL Base64 para exibição e cache local imediato
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      setPdvPreviewUrl(dataUrl)

      if (currentOrganization?.id) {
        localStorage.setItem(`pdv_bg_${currentOrganization.id}`, dataUrl)
      }
      localStorage.setItem('pdv_bg_last', dataUrl)
      localStorage.setItem('pdv_background_url', dataUrl)

      // Salva e aplica automaticamente no PDV
      await savePdvImageProcess(file, dataUrl)
    } catch {
      // Se falhar a leitura rápida, ainda tenta o processo convencional
      await savePdvImageProcess(file, null)
    }
  }

  const handleSavePdvBackground = async () => {
    await savePdvImageProcess(selectedPdvFile, null)
  }

  const handleRemovePdvBackground = async () => {
    setSelectedPdvFile(null)
    setPdvPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    if (typeof window !== 'undefined') {
      if (currentOrganization?.id) {
        localStorage.removeItem(`pdv_bg_${currentOrganization.id}`)
      }
      localStorage.removeItem('pdv_bg_last')
      localStorage.removeItem('pdv_background_url')
      window.dispatchEvent(new Event('storage'))
    }

    setIsUploadingPdv(true)
    const res = await updatePdvBackground(null)
    setIsUploadingPdv(false)
    if (res.success) {
      setPdvFeedback({
        type: 'success',
        text: 'Imagem de fundo do PDV removida com sucesso.',
      })
    } else {
      setPdvFeedback({
        type: 'error',
        text: res.error || 'Erro ao remover imagem.',
      })
    }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* ==================================================================== */}
      {/* 1. MODO NOTURNO / CLARO DO SISTEMA                                  */}
      {/* ==================================================================== */}
      <Card className="border-gray-200/80 dark:border-slate-800 shadow-xs">
        <CardHeader className="pb-4 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 dark:bg-amber-400/10 dark:text-amber-400 ring-1 ring-amber-500/20">
              {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Modo de Exibição (Aparência)
                </h3>
                <Badge variant={isDark ? 'warning' : 'info'} className="font-semibold">
                  {isDark ? 'Modo Noturno Ativo' : 'Modo Claro Ativo'}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Escolha entre o Modo Claro e o Modo Noturno para a interface de trabalho do ControleSoft.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Opção Modo Claro */}
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-4 rounded-xl border-2 text-left transition-all flex items-start gap-4 cursor-pointer ${
                theme === 'light'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-xs'
                  : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
              }`}
            >
              <div className="p-3 rounded-lg bg-amber-100 text-amber-600 shrink-0">
                <Sun className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-gray-900 dark:text-white">Modo Claro</span>
                  {theme === 'light' && (
                    <span className="inline-flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      <Check className="w-4 h-4 mr-1" />
                      Ativado
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Ideal para ambientes iluminados e uso padrão durante o dia com alto contraste.
                </p>
              </div>
            </button>

            {/* Opção Modo Noturno */}
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-4 rounded-xl border-2 text-left transition-all flex items-start gap-4 cursor-pointer ${
                theme === 'dark'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-xs'
                  : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
              }`}
            >
              <div className="p-3 rounded-lg bg-slate-800 text-amber-400 shrink-0">
                <Moon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-gray-900 dark:text-white">Modo Noturno (Escuro)</span>
                  {theme === 'dark' && (
                    <span className="inline-flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      <Check className="w-4 h-4 mr-1" />
                      Ativado
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Reduz a fadiga visual em ambientes com pouca luz e economiza energia na tela.
                </p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ==================================================================== */}
      {/* 2. IMAGEM DE FUNDO / MARCA D'ÁGUA DO PDV                             */}
      {/* ==================================================================== */}
      <Card className="border-gray-200/80 dark:border-slate-800 shadow-xs">
        <CardHeader className="pb-4 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400 ring-1 ring-emerald-500/20">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Fundo do Terminal PDV (Logomarca da Empresa)
                </h3>
                <Badge
                  variant={pdvPreviewUrl ? 'success' : 'default'}
                  className="font-semibold"
                >
                  {pdvPreviewUrl ? 'Marca d\'água Ativa' : 'Padrão sem Imagem'}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Faça upload da logomarca da sua empresa para ser exibida repetida como marca d'água elegante no fundo do PDV.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Feedback */}
          {pdvFeedback && (
            <div
              className={`p-3.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2.5 transition-all ${
                pdvFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60'
              }`}
            >
              {pdvFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>{pdvFeedback.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Coluna 1: Upload e Ações (6/12) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300">
                  Importar Logotipo / Imagem
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handlePdvFileSelect}
                  className="hidden"
                  id="pdv-bg-upload"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer transition-all bg-gray-50/50 dark:bg-slate-900/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 group"
                >
                  <div className="w-12 h-12 mx-auto rounded-xl bg-white dark:bg-slate-800 shadow-xs flex items-center justify-center text-gray-400 group-hover:text-emerald-500 group-hover:scale-105 transition-all mb-3 border border-gray-200 dark:border-slate-700">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">
                    Clique para selecionar uma imagem
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-400 mt-1">
                    PNG, JPG, WEBP ou SVG (Máx. 5MB). Preferência por fundo transparente.
                  </p>
                  {selectedPdvFile && (
                    <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-semibold">
                      <ImageIcon className="w-3.5 h-3.5" />
                      {selectedPdvFile.name} ({(selectedPdvFile.size / 1024).toFixed(0)} KB)
                    </div>
                  )}
                </div>
              </div>

              {/* Informações de Usabilidade */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3.5 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-500" />
                  Como a imagem é exibida no PDV:
                </p>
                <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px]">
                  <li>Aplicada em tela cheia como imagem de fundo (wallpaper) do PDV.</li>
                  <li>Overlay suave de contraste para não atrapalhar leitura de códigos e valores.</li>
                  <li>Destaque central com a logomarca da sua loja quando o caixa estiver livre.</li>
                  <li>Sincronização imediata em tempo real no terminal de vendas.</li>
                </ul>
              </div>

              {/* Botões de Ação do PDV */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleSavePdvBackground}
                  isLoading={isUploadingPdv}
                  disabled={!selectedPdvFile && pdvPreviewUrl === (currentOrganization?.pdvBackgroundUrl || null)}
                  className="gap-2 text-xs font-semibold shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  Salvar Imagem do PDV
                </Button>

                {(pdvPreviewUrl || currentOrganization?.pdvBackgroundUrl) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={handleRemovePdvBackground}
                    disabled={isUploadingPdv}
                    className="gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remover Imagem de Fundo
                  </Button>
                )}
              </div>
            </div>

            {/* Coluna 2: Pré-visualização da Simulação do PDV (6/12) */}
            <div className="lg:col-span-6 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-emerald-500" />
                Pré-visualização do Terminal PDV
              </label>

              {/* Mockup do Terminal PDV com Imagem de Fundo */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-4 shadow-xl select-none min-h-[260px] flex flex-col justify-between">
                {/* Camada de imagem de fundo com overlay de contraste */}
                {pdvPreviewUrl ? (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
                    <div
                      className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-300"
                      style={{
                        backgroundImage: `url("${pdvPreviewUrl}")`,
                      }}
                    />
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px]" />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-800 font-mono text-xs z-0 pointer-events-none">
                    [Fundo Padrão Escuro do PDV]
                  </div>
                )}

                {/* Header Mockup */}
                <div className="relative z-10 flex items-center justify-between border-b border-slate-800/80 pb-2 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-white tracking-wide">PDV ONLINE</span>
                    <span className="text-[10px] text-slate-500">Caixa 01</span>
                  </div>
                  <div className="font-mono text-[10px] text-emerald-400">F10 Suporte</div>
                </div>

                {/* Barcode Search Bar Mockup */}
                <div className="relative z-10 my-2">
                  <div className="rounded-xl border border-emerald-500/40 bg-slate-900/90 px-3 py-2 text-xs flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Leitor de Código de Barras / Produto...</span>
                    <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded">F2 Bipar</span>
                  </div>
                </div>

                {/* Centro: Caixa Livre / Carrinho */}
                <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-4 border border-slate-800/80 rounded-xl bg-slate-900/60 backdrop-blur-md my-1">
                  {pdvPreviewUrl ? (
                    <div className="mb-2 p-2 rounded-xl bg-slate-900/80 border border-slate-700/60 shadow-lg flex items-center justify-center">
                      <img
                        src={pdvPreviewUrl}
                        alt="Logomarca da Loja"
                        className="max-h-12 max-w-[130px] object-contain drop-shadow-sm"
                      />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-slate-800/60 flex items-center justify-center text-slate-500 mb-1">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                  )}
                  <span className="text-xs font-semibold text-slate-200">Caixa Livre • Aguardando Leitura</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Imagem de fundo ativa no terminal</span>
                </div>

                {/* Footer Mockup */}
                <div className="relative z-10 flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px]">
                  <span className="text-slate-400">Total a Pagar:</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">R$ 0,00</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ==================================================================== */}
      {/* 3. COR DO SISTEMA (PERSONALIZAÇÃO VISUAL)                            */}
      {/* ==================================================================== */}
      <Card className="border-gray-200/80 dark:border-slate-800 shadow-xs">
        <CardHeader className="pb-4 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl text-white shadow-xs transition-colors"
              style={{ backgroundColor: currentColor }}
            >
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Cor do Sistema
                </h3>
                {isDefaultColor && (
                  <Badge variant="default" className="font-semibold">
                    Padrão Atual
                  </Badge>
                )}
                {hasUnsavedColorChanges && (
                  <Badge variant="warning" className="animate-pulse font-semibold">
                    Alteração pendente de salvamento
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Escolha a cor principal que deseja utilizar na interface do ControleSoft. A alteração será aplicada em todos os módulos.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Mensagem de Feedback */}
          {colorFeedbackMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2.5 transition-all ${
                colorFeedbackMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60'
              }`}
            >
              {colorFeedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>{colorFeedbackMessage.text}</span>
            </div>
          )}

          {/* 3.1: SELETOR DE CORES PRÉ-DEFINIDAS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" style={{ color: currentColor }} />
                Cores Pré-definidas
              </label>
              <span className="text-[11px] text-gray-500 dark:text-slate-400">
                11 tonalidades otimizadas para alto contraste
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {presetColors.map((preset) => {
                const isSelected =
                  currentColor.toLowerCase() === preset.hex.toLowerCase()
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.hex)}
                    className={`group relative flex items-center gap-2.5 p-2 rounded-xl border transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'border-gray-900 dark:border-white shadow-md ring-2 ring-offset-2 ring-gray-900 dark:ring-white dark:ring-offset-slate-900 bg-gray-50 dark:bg-slate-800/80'
                        : 'border-gray-200 dark:border-slate-800 hover:border-gray-400 dark:hover:border-slate-600 hover:bg-gray-50/60 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <span
                      className="w-7 h-7 rounded-lg shrink-0 shadow-xs flex items-center justify-center transition-transform group-hover:scale-105"
                      style={{ backgroundColor: preset.hex }}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white drop-shadow-sm" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-800 dark:text-slate-200 truncate">
                        {preset.name}
                      </p>
                      <p className="text-[10px] font-mono text-gray-500 dark:text-slate-400 uppercase">
                        {preset.hex}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3.2: SELETOR PERSONALIZADO (COLOR PICKER) */}
          <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <label
                  htmlFor={colorInputId}
                  className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300 flex items-center gap-1.5"
                >
                  <Pipette className="w-3.5 h-3.5 text-gray-500" />
                  Cor Personalizada (Color Picker)
                </label>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Escolha qualquer tonalidade com o seletor visual ou informe o código HEX.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Input nativo de cor */}
                <div className="relative">
                  <input
                    id={colorInputId}
                    type="color"
                    value={currentColor}
                    onChange={(e) => handleCustomColorChange(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border-2 border-gray-300 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-800 shadow-xs"
                    title="Abrir seletor visual de cor"
                  />
                </div>

                {/* Input de texto HEX */}
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-gray-400">
                    #
                  </span>
                  <input
                    type="text"
                    value={customHexInput.replace('#', '')}
                    onChange={(e) => handleCustomColorChange('#' + e.target.value)}
                    maxLength={7}
                    placeholder="0284c7"
                    className="w-28 pl-6 pr-2.5 py-2 text-xs font-mono uppercase rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3.3: PRÉ-VISUALIZAÇÃO EM TEMPO REAL */}
          <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300 flex items-center gap-1.5">
                <LayoutDashboard className="w-3.5 h-3.5 text-gray-500" />
                Pré-visualização em Elementos do Sistema
              </label>
              <span className="text-[11px] text-gray-500 dark:text-slate-400">
                Como os botões, menus e indicadores serão visualizados
              </span>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/60 p-4 space-y-4">
              {/* Tons gerados dinamicamente */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                <span className="text-[10px] font-mono text-gray-500 mr-2 shrink-0">
                  Escala de tons:
                </span>
                {Object.entries(previewShades).map(([shade, hex]) => (
                  <div
                    key={shade}
                    className="flex-1 min-w-[28px] h-6 rounded-md shadow-2xs flex items-center justify-center text-[9px] font-mono text-white/90"
                    style={{ backgroundColor: hex }}
                    title={`${shade}: ${hex}`}
                  >
                    {shade}
                  </div>
                ))}
              </div>

              {/* Botões e Ações Primárias */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-xs transition-all flex items-center gap-1.5 cursor-default"
                  style={{ backgroundColor: currentColor }}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Botão Principal
                </button>

                <button
                  type="button"
                  className="px-4 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 cursor-default"
                  style={{
                    borderColor: currentColor,
                    color: currentColor,
                    backgroundColor: `${currentColor}15`,
                  }}
                >
                  Botão Secundário
                </button>

                {/* Badge com tom suave */}
                <span
                  className="px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1"
                  style={{
                    backgroundColor: `${currentColor}20`,
                    color: currentColor,
                  }}
                >
                  <Check className="w-3 h-3" />
                  Destaque Ativo
                </span>

                {/* Link Interativo */}
                <span
                  className="text-xs font-bold underline cursor-pointer hover:opacity-80"
                  style={{ color: currentColor }}
                >
                  Link Interativo
                </span>
              </div>

              {/* Simulação de Item do Menu Lateral e Card de Métrica */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Menu lateral selecionado */}
                <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-1.5 h-6 rounded-full"
                      style={{ backgroundColor: currentColor }}
                    />
                    <div
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: currentColor }}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-gray-800 dark:text-white">
                      Item Selecionado no Menu
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                    style={{
                      backgroundColor: `${currentColor}15`,
                      color: currentColor,
                    }}
                  >
                    Ativo
                  </span>
                </div>

                {/* Card de Métrica */}
                <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-500 dark:text-slate-400">
                      Vendas do Mês
                    </p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                      R$ 48.750,00
                    </p>
                  </div>
                  <div
                    className="p-2 rounded-xl text-white shadow-xs"
                    style={{ backgroundColor: currentColor }}
                  >
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3.4: BOTÕES E AÇÕES DE CORES */}
          <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Botão Restaurar Padrão */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRestoreDefaultColor}
                disabled={isSavingColor || isDefaultColor}
                className="gap-1.5 text-xs text-slate-700 dark:text-slate-300"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar padrão original
              </Button>

              {/* Botão Cancelar */}
              {hasUnsavedColorChanges && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelColor}
                  disabled={isSavingColor}
                  className="gap-1.5 text-xs text-gray-500 hover:text-gray-700"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancelar
                </Button>
              )}
            </div>

            {/* Botão Salvar Personalização */}
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleSaveColor}
              isLoading={isSavingColor}
              className="gap-2 text-sm font-semibold px-5 shadow-xs"
            >
              <Save className="w-4 h-4" />
              Salvar personalização de cores
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
