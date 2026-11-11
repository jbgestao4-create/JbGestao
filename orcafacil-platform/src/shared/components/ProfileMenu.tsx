import { useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, LogOut, Settings2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ConfirmActionDialog } from '@shared/components/ConfirmActionDialog'
import type { ServiceResult } from '@shared/types/common'

type ProfileMenuProps = {
  displayName: string
  email?: string
  avatarUrl?: string | null
  variant?: 'dashboard' | 'header' | 'sidebar'
  onSignOut?: () => Promise<ServiceResult<void>>
}

export function ProfileMenu({
  displayName,
  email,
  avatarUrl,
  variant = 'header',
  onSignOut,
}: ProfileMenuProps) {
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false)
  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'U'

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Meu Perfil"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/80 cursor-pointer"
        >
          <span className="relative flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-xs font-bold text-blue-800 dark:text-blue-300 ring-2 ring-white dark:ring-slate-800 shadow-2xs overflow-hidden">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`Foto de ${displayName}`}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </span>
          <span className="hidden sm:flex flex-col min-w-0 text-left">
            <span className="block truncate text-xs font-bold text-slate-800 dark:text-white max-w-[130px]">
              {displayName}
            </span>
            <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400 max-w-[130px]">
              {email || 'Acesso Autorizado'}
            </span>
          </span>
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          side={variant === 'sidebar' ? 'right' : 'bottom'}
          sideOffset={6}
          className="z-50 min-w-56 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-1.5 shadow-lg shadow-slate-900/10 dark:shadow-black/60"
        >
          <DropdownMenu.Label className="px-2.5 py-2">
            <span className="block truncate text-xs font-semibold text-slate-800 dark:text-white">
              {displayName}
            </span>
            {email && (
              <span className="mt-0.5 block truncate text-[11px] text-slate-500 dark:text-slate-400">{email}</span>
            )}
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          <DropdownMenu.Item asChild>
            <Link
              to="/profile"
              className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 focus:bg-blue-50 dark:focus:bg-blue-950/60 focus:text-blue-700 dark:focus:text-blue-300"
            >
              <Settings2 aria-hidden="true" className="h-4 w-4" />
              Configurações do Perfil
            </Link>
          </DropdownMenu.Item>
          {onSignOut && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
              <DropdownMenu.Item
                onSelect={() => {
                  setIsSignOutDialogOpen(true)
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-red-600 dark:text-red-400 outline-none transition-colors hover:bg-red-50 dark:hover:bg-red-950/40 focus:bg-red-50 dark:focus:bg-red-950/40"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                Sair
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
      {onSignOut && (
        <ConfirmActionDialog
          open={isSignOutDialogOpen}
          title="Sair do sistema?"
          description="Tem certeza de que deseja encerrar sua sessão?"
          confirmLabel="Sim, sair"
          onCancel={() => {
            setIsSignOutDialogOpen(false)
          }}
          onConfirm={onSignOut}
        />
      )}
    </DropdownMenu.Root>
  )
}
