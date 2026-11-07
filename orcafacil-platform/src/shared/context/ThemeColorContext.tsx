import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { authService } from '@modules/auth/services/auth.service'
import {
  DEFAULT_THEME_COLOR,
  PRESET_THEME_COLORS,
  normalizeHexColor,
  applyThemeToDOM,
  getStoredThemeColor,
  setStoredThemeColor,
  type ThemeColorPreset,
} from '@shared/utils/theme-color'
import type { ServiceResult } from '@shared/types/common'

export interface ThemeColorContextType {
  themeColor: string
  previewColor: string | null
  currentColor: string
  isDefaultColor: boolean
  isSaving: boolean
  presetColors: ThemeColorPreset[]
  setPreviewColor: (color: string | null) => void
  saveThemeColor: (color: string) => Promise<ServiceResult<void>>
  restoreDefaultColor: () => Promise<ServiceResult<void>>
  cancelPreview: () => void
}

const ThemeColorContext = createContext<ThemeColorContextType | undefined>(undefined)

export function ThemeColorProvider({ children }: { children: ReactNode }) {
  const { user, profile, refreshProfile } = useAuth()

  // Inicializa a partir do localStorage para evitar flash de estilo no carregamento
  const [themeColor, setThemeColor] = useState<string>(() => {
    return getStoredThemeColor(null)
  })

  const [previewColor, setPreviewColorState] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Sincroniza quando o perfil do usuário ou sessão é carregada
  useEffect(() => {
    if (!user) {
      const globalColor = getStoredThemeColor(null)
      setThemeColor(globalColor)
      applyThemeToDOM(globalColor)
      return
    }

    const preferredColor = profile?.themeColor
      ? normalizeHexColor(profile.themeColor)
      : getStoredThemeColor(user.id)

    setThemeColor(preferredColor)
    setStoredThemeColor(preferredColor, user.id)
    if (!previewColor) {
      applyThemeToDOM(preferredColor)
    }
  }, [user?.id, profile?.themeColor])

  // Gerencia a pré-visualização em tempo real
  const setPreviewColor = useCallback((color: string | null) => {
    if (!color) {
      setPreviewColorState(null)
      applyThemeToDOM(themeColor)
      return
    }
    const normalized = normalizeHexColor(color)
    setPreviewColorState(normalized)
    applyThemeToDOM(normalized)
  }, [themeColor])

  // Descarta a prévia e retorna à cor gravada
  const cancelPreview = useCallback(() => {
    setPreviewColorState(null)
    applyThemeToDOM(themeColor)
  }, [themeColor])

  // Salva no banco de dados e no localStorage
  const saveThemeColor = useCallback(
    async (color: string): Promise<ServiceResult<void>> => {
      const normalized = normalizeHexColor(color)
      setIsSaving(true)
      try {
        setStoredThemeColor(normalized, user?.id)
        setThemeColor(normalized)
        setPreviewColorState(null)
        applyThemeToDOM(normalized)

        if (user?.id) {
          const result = await authService.updateThemeColor(user.id, normalized)
          if (!result.success) {
            return result
          }
          await refreshProfile()
        }

        return { success: true, data: undefined }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Falha ao salvar preferência de cor.',
        }
      } finally {
        setIsSaving(false)
      }
    },
    [user?.id, refreshProfile],
  )

  // Restaura para a cor original padrão azul
  const restoreDefaultColor = useCallback(async (): Promise<ServiceResult<void>> => {
    return saveThemeColor(DEFAULT_THEME_COLOR)
  }, [saveThemeColor])

  const currentColor = previewColor ?? themeColor
  const isDefaultColor = currentColor.toLowerCase() === DEFAULT_THEME_COLOR.toLowerCase()

  return (
    <ThemeColorContext.Provider
      value={{
        themeColor,
        previewColor,
        currentColor,
        isDefaultColor,
        isSaving,
        presetColors: PRESET_THEME_COLORS,
        setPreviewColor,
        saveThemeColor,
        restoreDefaultColor,
        cancelPreview,
      }}
    >
      {children}
    </ThemeColorContext.Provider>
  )
}

export function useThemeColor(): ThemeColorContextType {
  const context = useContext(ThemeColorContext)
  if (!context) {
    throw new Error('useThemeColor must be used within a ThemeColorProvider')
  }
  return context
}

