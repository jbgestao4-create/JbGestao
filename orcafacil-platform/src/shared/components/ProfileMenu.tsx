import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, Settings2, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'

type ProfileMenuProps = {
  displayName: string
  email?: string
  variant?: 'dashboard' | 'header' | 'sidebar'
}

export function ProfileMenu({ displayName, email, variant = 'header' }: ProfileMenuProps) {
  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'U'

  const triggerClassName = {
    dashboard:
      'flex items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-slate-50',
    header:
      'inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-blue-600',
    sidebar: 'flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden rounded-lg text-left group',
  }[variant]

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" aria-label="Meu Perfil" className={triggerClassName}>
          {variant === 'header' ? (
            <>
              <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
              Meu Perfil
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800 ${
                  variant === 'sidebar' ? 'h-8 w-8 text-blue-700' : ''
                }`}
              >
                {initials}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-xs font-semibold text-slate-800 ${
                    variant === 'sidebar' ? 'text-gray-900 group-hover:text-blue-600' : ''
                  }`}
                >
                  {variant === 'dashboard' ? 'Meu Perfil' : displayName}
                </span>
                <span
                  className={`block truncate text-[10px] text-slate-500 ${
                    variant === 'sidebar' ? 'text-[11px] text-gray-400' : ''
                  }`}
                >
                  {variant === 'dashboard' ? displayName : email || 'Acesso Autorizado'}
                </span>
              </span>
              {variant === 'dashboard' && (
                <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
              )}
            </>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          side={variant === 'sidebar' ? 'right' : 'bottom'}
          sideOffset={6}
          className="z-50 min-w-56 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10"
        >
          <DropdownMenu.Label className="px-2.5 py-2">
            <span className="block truncate text-xs font-semibold text-slate-800">
              {displayName}
            </span>
            {email && (
              <span className="mt-0.5 block truncate text-[11px] text-slate-500">{email}</span>
            )}
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
          <DropdownMenu.Item asChild>
            <Link
              to="/profile"
              className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-slate-700 outline-none transition-colors hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-50 focus:text-blue-700"
            >
              <Settings2 aria-hidden="true" className="h-4 w-4" />
              Configurações do Perfil
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
