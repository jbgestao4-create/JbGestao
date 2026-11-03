import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  isDark: boolean
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  setInsideSystem: (inside: boolean) => void
}

const THEME_STORAGE_KEY = 'jb_theme'

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY)
      if (stored === 'dark' || stored === 'light') return stored
    } catch {
      // Fallback
    }
    return 'light'
  })

  const [isInsideSystem, setIsInsideSystem] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    // O modo escuro só se aplica quando o usuário está dentro da área autenticada do sistema
    if (isInsideSystem && theme === 'dark') {
      root.classList.add('dark')
      root.setAttribute('data-theme', 'dark')
    } else {
      root.classList.remove('dark')
      root.removeAttribute('data-theme')
    }
  }, [theme, isInsideSystem])

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        // ignore
      }
      return next
    })
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    } catch {
      // ignore
    }
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: isInsideSystem && theme === 'dark',
        toggleTheme,
        setTheme,
        setInsideSystem: setIsInsideSystem,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme deve ser utilizado dentro de um ThemeProvider')
  }
  return context
}

