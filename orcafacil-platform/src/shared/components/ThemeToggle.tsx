import { useTheme } from '@shared/context/ThemeContext'
import { Moon, Sun } from 'lucide-react'

interface ThemeToggleProps {
  variant?: 'icon' | 'badge' | 'full'
  className?: string
}

export function ThemeToggle({ variant = 'icon', className = '' }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme()

  if (variant === 'badge') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
          isDark
            ? 'bg-amber-900/30 text-amber-300 border border-amber-700/40 hover:bg-amber-900/50'
            : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
        } ${className}`}
      >
        {isDark ? (
          <>
            <Sun className="h-3.5 w-3.5 text-amber-400" />
            <span>Modo Claro</span>
          </>
        ) : (
          <>
            <Moon className="h-3.5 w-3.5 text-indigo-600" />
            <span>Modo Escuro</span>
          </>
        )}
      </button>
    )
  }

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
          isDark
            ? 'text-gray-300 hover:bg-slate-800 hover:text-white'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
        } ${className}`}
      >
        <div className="flex items-center gap-2.5">
          {isDark ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-indigo-600" />
          )}
          <span>{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-indigo-50 text-indigo-700'
          }`}
        >
          {isDark ? 'Ativo' : 'Inativo'}
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
      title={isDark ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        isDark
          ? 'border-slate-700 bg-slate-800 text-amber-400 hover:bg-slate-700 hover:border-slate-600 shadow-sm'
          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 shadow-sm'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="h-4 w-4 transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 transition-transform duration-200 hover:-rotate-12" />
      )}
    </button>
  )
}

