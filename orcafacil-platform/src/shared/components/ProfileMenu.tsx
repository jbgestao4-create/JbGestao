import { useEffect, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { ConfirmActionDialog } from '@shared/components/ConfirmActionDialog'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import {
  organizationBillingService,
  type OrganizationBillingInfo,
} from '@modules/organizations/services/organization-billing.service'
import type { ServiceResult } from '@shared/types/common'

type ProfileMenuProps = {
  displayName: string
  email?: string
  avatarUrl?: string | null
  variant?: 'dashboard' | 'header' | 'sidebar'
  onSignOut?: () => Promise<ServiceResult<void>>
}

function formatDatePtBr(dateStr: string): string {
  const clean = dateStr.trim()
  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(clean)
  if (ymdMatch) {
    return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`
  }
  const d = new Date(clean)
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  }
  return clean
}

export function ProfileMenu({
  displayName,
  email,
  avatarUrl,
  variant = 'header',
  onSignOut,
}: ProfileMenuProps) {
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false)
  const [billingInfo, setBillingInfo] = useState<OrganizationBillingInfo | null>(null)
  const { currentOrganization } = useOrganization()
  const navigate = useNavigate()

  useEffect(() => {
    if (!currentOrganization?.id) {
      setBillingInfo(null)
      return
    }
    let isCurrent = true
    void organizationBillingService
      .getBillingInfo({
        id: currentOrganization.id,
        name: currentOrganization.name,
        trialEndsAt: currentOrganization.trialEndsAt,
      })
      .then((info) => {
        if (isCurrent) {
          setBillingInfo(info)
        }
      })
      .catch(() => {
        // non-blocking
      })

    return () => {
      isCurrent = false
    }
  }, [currentOrganization?.id, currentOrganization?.name, currentOrganization?.trialEndsAt])

  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'U'

  const storeName = currentOrganization?.name || displayName || 'Minha Loja'

  const rawPlanName =
    currentOrganization?.accessPlanName ||
    billingInfo?.contract?.planName ||
    'Fiscal'
  const planName = rawPlanName.replace(/^Plano\s+/i, '').trim() || 'Fiscal'

  const { expirationLabel, expirationDate } = (() => {
    if (billingInfo?.isTrial && billingInfo.trialEndsAt) {
      return {
        expirationLabel: 'Teste até',
        expirationDate: formatDatePtBr(billingInfo.trialEndsAt),
      }
    }

    if (currentOrganization?.trialEndsAt) {
      const endMs = new Date(currentOrganization.trialEndsAt).getTime()
      const isFuture = !isNaN(endMs) && endMs >= Date.now()
      return {
        expirationLabel: isFuture ? 'Teste até' : 'Encerra em',
        expirationDate: formatDatePtBr(currentOrganization.trialEndsAt),
      }
    }

    if (billingInfo?.unpaidInvoices && billingInfo.unpaidInvoices.length > 0) {
      const sorted = [...billingInfo.unpaidInvoices].sort((a, b) =>
        a.dueDate.localeCompare(b.dueDate),
      )
      return {
        expirationLabel: 'Encerra em',
        expirationDate: formatDatePtBr(sorted[0].dueDate),
      }
    }

    if (billingInfo?.contract) {
      if (billingInfo.contract.trialEndsAt) {
        return {
          expirationLabel: 'Teste até',
          expirationDate: formatDatePtBr(billingInfo.contract.trialEndsAt),
        }
      }
      if (billingInfo.contract.billingDay) {
        const now = new Date()
        const targetDay = Math.min(Math.max(billingInfo.contract.billingDay, 1), 28)
        let targetDate = new Date(now.getFullYear(), now.getMonth(), targetDay)
        if (targetDate.getTime() < now.getTime()) {
          targetDate = new Date(now.getFullYear(), now.getMonth() + 1, targetDay)
        }
        return {
          expirationLabel: 'Encerra em',
          expirationDate: formatDatePtBr(targetDate.toISOString()),
        }
      }
    }

    const fallbackDate = new Date()
    fallbackDate.setDate(fallbackDate.getDate() + 14)
    return {
      expirationLabel: 'Teste até',
      expirationDate: formatDatePtBr(fallbackDate.toISOString()),
    }
  })()

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
          sideOffset={8}
          className="z-50 w-76 sm:w-80 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-0 shadow-xl shadow-slate-900/15 dark:shadow-black/60"
        >
          {/* TOPO CENTRALIZADO: ÍCONE DA LOJA, NOME, EMAIL, PLANO E DATA */}
          <div className="flex flex-col items-center px-6 pt-6 pb-5 text-center">
            {currentOrganization?.logoUrl ? (
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-1 shadow-2xs">
                <img
                  src={currentOrganization.logoUrl}
                  alt={storeName}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <svg
                viewBox="0 0 64 64"
                className="h-14 w-14 shrink-0"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                {/* Corpo da loja */}
                <path
                  d="M14 28V52C14 54.2091 15.7909 56 18 56H46C48.2091 56 50 54.2091 50 52V28"
                  fill="#ffffff"
                  stroke="#0f172a"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Porta */}
                <path
                  d="M30 56V30"
                  stroke="#0f172a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Maçaneta da porta */}
                <circle cx="24" cy="43" r="1.8" fill="#0f172a" />
                {/* Toldo superior verde claro */}
                <path
                  d="M15.5 11H48.5C50.1 11 51.5 12 52 13.5L55 22H9L12 13.5C12.5 12 13.9 11 15.5 11Z"
                  fill="#bbf7d0"
                  stroke="#0f172a"
                  strokeWidth="2.75"
                  strokeLinejoin="round"
                />
                {/* Ondas do toldo */}
                <path
                  d="M9 22C9 25.866 12.134 29 16 29C19.866 29 23 25.866 23 22C23 25.866 26.134 29 30 29C32 29 33.8 28.1 35 26.8C36.2 28.1 38 29 40 29C43.866 29 47 25.866 47 22C47 25.866 49.5 29 52.5 29C54.5 29 55 25.866 55 22H9Z"
                  fill="#dcfce7"
                  stroke="#0f172a"
                  strokeWidth="2.75"
                  strokeLinejoin="round"
                />
              </svg>
            )}

            <DropdownMenu.Item asChild>
              <Link
                to="/settings/organization"
                className="mt-3 block max-w-full text-base sm:text-lg font-bold leading-snug text-slate-900 dark:text-white underline underline-offset-4 decoration-slate-900 dark:decoration-white hover:text-blue-600 dark:hover:text-blue-400 hover:decoration-blue-600 outline-none cursor-pointer"
              >
                {storeName}
              </Link>
            </DropdownMenu.Item>

            {email && (
              <span className="mt-1 block max-w-full truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                {email}
              </span>
            )}

            {/* PLANO E DATA DE ENCERRAMENTO */}
            <div className="mt-5 grid w-full grid-cols-2 items-center">
              <div className="pr-3 text-center">
                <span className="block text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  Plano
                </span>
                <span className="mt-0.5 block truncate text-sm font-bold text-slate-900 dark:text-white">
                  {planName}
                </span>
              </div>
              <div className="border-l border-slate-200 dark:border-slate-700 pl-3 text-center">
                <span className="block text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  {expirationLabel}
                </span>
                <span className="mt-0.5 block text-sm font-bold text-slate-900 dark:text-white">
                  {expirationDate}
                </span>
              </div>
            </div>

            {/* BOTÃO ASSINAR AGORA */}
            <DropdownMenu.Item
              onSelect={() => {
                void navigate('/settings/organization?tab=system-invoices')
              }}
              className="mt-5 flex w-full cursor-pointer items-center justify-center rounded-full bg-[#0088ff] hover:bg-[#0077e6] active:bg-[#0066cc] px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition-colors outline-none"
            >
              ASSINAR AGORA!
            </DropdownMenu.Item>
          </div>

          {/* LISTA DE OPÇÕES INFERIOR */}
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200">
            <DropdownMenu.Item asChild>
              <Link
                to="/settings/organization?tab=system-invoices&plan=pro"
                className="flex w-full cursor-pointer items-center px-6 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70 outline-none"
              >
                Migrar para o plano PRO
              </Link>
            </DropdownMenu.Item>

            <DropdownMenu.Item asChild>
              <Link
                to="/settings/organization?tab=system-invoices&plan=fiscal"
                className="flex w-full cursor-pointer items-center px-6 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70 outline-none"
              >
                Migrar para o plano Fiscal
              </Link>
            </DropdownMenu.Item>

            <DropdownMenu.Item asChild>
              <Link
                to="/profile"
                className="flex w-full cursor-pointer items-center gap-2.5 px-6 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70 outline-none"
              >
                <svg
                  viewBox="0 0 20 14"
                  className="h-3.5 w-4 shrink-0 rounded-[2px] shadow-2xs"
                  aria-hidden="true"
                >
                  <rect width="20" height="14" fill="#16a34a" />
                  <polygon points="10,1.8 18,7 10,12.2 2,7" fill="#facc15" />
                  <circle cx="10" cy="7" r="2.6" fill="#1d4ed8" />
                </svg>
                <span>Configurações Regionais</span>
              </Link>
            </DropdownMenu.Item>

            <DropdownMenu.Item asChild>
              <Link
                to="/settings/organization"
                className="flex w-full cursor-pointer items-center justify-between px-6 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70 outline-none"
              >
                <span>Conta da Loja</span>
                <span aria-hidden="true" className="text-[10px] text-slate-700 dark:text-slate-400">
                  ▶
                </span>
              </Link>
            </DropdownMenu.Item>

            {onSignOut && (
              <DropdownMenu.Item
                onSelect={() => {
                  setIsSignOutDialogOpen(true)
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-6 py-3 text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40 outline-none"
              >
                <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Sair da Conta</span>
              </DropdownMenu.Item>
            )}
          </div>
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
