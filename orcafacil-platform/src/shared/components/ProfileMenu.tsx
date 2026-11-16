import { useEffect, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, LogOut, UserCog } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@app/config/supabase'
import { ConfirmActionDialog } from '@shared/components/ConfirmActionDialog'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { SYSTEM_ACCESS_PLAN_NAMES } from '@modules/organizations/services/organization.service'
import {
  isOrganizationInTrial,
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
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null)
  const [fetchedOrgMeta, setFetchedOrgMeta] = useState<{
    pdvBackgroundUrl?: string | null
    accessPlanId?: string | null
    trialEndsAt?: string | null
  } | null>(null)
  const { currentOrganization } = useOrganization()
  const navigate = useNavigate()

  useEffect(() => {
    const syncLocalPhoto = () => {
      if (typeof window === 'undefined') return
      try {
        const stored =
          (currentOrganization?.id ? localStorage.getItem(`pdv_bg_${currentOrganization.id}`) : null) ||
          localStorage.getItem('pdv_bg_last') ||
          localStorage.getItem('pdv_background_url') ||
          null
        setLocalPhotoUrl(stored)
      } catch {
        setLocalPhotoUrl(null)
      }
    }

    syncLocalPhoto()
    window.addEventListener('storage', syncLocalPhoto)
    return () => {
      window.removeEventListener('storage', syncLocalPhoto)
    }
  }, [currentOrganization?.id])

  useEffect(() => {
    if (!currentOrganization?.id) {
      setBillingInfo(null)
      setFetchedOrgMeta(null)
      return
    }
    let isCurrent = true

    void Promise.resolve(
      supabase
        .from('organizations')
        .select('pdv_background_url, access_plan_id, trial_ends_at')
        .eq('id', currentOrganization.id)
        .maybeSingle(),
    )
      .then(({ data }) => {
        if (isCurrent && data) {
          setFetchedOrgMeta({
            pdvBackgroundUrl: (data as any).pdv_background_url ?? null,
            accessPlanId: (data as any).access_plan_id ?? null,
            trialEndsAt: (data as any).trial_ends_at ?? null,
          })
        }
      })
      .catch(() => {
        // non-blocking
      })

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

  const companyPhotoUrl =
    currentOrganization?.logoUrl ||
    currentOrganization?.pdvBackgroundUrl ||
    fetchedOrgMeta?.pdvBackgroundUrl ||
    localPhotoUrl ||
    avatarUrl ||
    '/controlesoft-mark.png'

  const effectiveAccessPlanId =
    currentOrganization?.accessPlanId || fetchedOrgMeta?.accessPlanId || null
  const effectiveAccessPlanName =
    currentOrganization?.accessPlanName ||
    (effectiveAccessPlanId ? SYSTEM_ACCESS_PLAN_NAMES[effectiveAccessPlanId] : null) ||
    null
  const effectiveTrialEndsAt =
    currentOrganization?.trialEndsAt ?? fetchedOrgMeta?.trialEndsAt ?? billingInfo?.trialEndsAt ?? null

  const hasActiveContractPlan = Boolean(
    billingInfo?.contract &&
      billingInfo.contract.status !== 'cancelled' &&
      !billingInfo.isTrial &&
      !isOrganizationInTrial(billingInfo.contract.trialEndsAt),
  )
  const hasPaidInvoices = Boolean(
    billingInfo?.paidInvoices && billingInfo.paidInvoices.some((inv) => inv.amount > 0),
  )
  const hasPlan = Boolean(
    effectiveAccessPlanId ||
      effectiveAccessPlanName ||
      hasActiveContractPlan ||
      hasPaidInvoices,
  )
  const isTrialPeriod = Boolean(
    isOrganizationInTrial(effectiveTrialEndsAt) || billingInfo?.isTrial,
  )
  const shouldShowSubscribeButton = isTrialPeriod && !hasPlan

  const rawPlanName =
    effectiveAccessPlanName ||
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

    if (effectiveTrialEndsAt) {
      const endMs = new Date(effectiveTrialEndsAt).getTime()
      const isFuture = !isNaN(endMs) && endMs >= Date.now()
      return {
        expirationLabel: isFuture ? 'Teste até' : 'Encerra em',
        expirationDate: formatDatePtBr(effectiveTrialEndsAt),
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

    if (hasPlan) {
      return {
        expirationLabel: 'Situação',
        expirationDate: 'Ativo',
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
          {/* TOPO CENTRALIZADO: FOTO DA EMPRESA, NOME, EMAIL, PLANO E DATA */}
          <div className="flex flex-col items-center px-6 pt-6 pb-5 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-2xs">
              <img
                src={companyPhotoUrl}
                alt={`Foto da empresa ${storeName}`}
                className="h-full w-full rounded-lg object-contain"
              />
            </div>

            <DropdownMenu.Item asChild>
              <Link
                to="/settings/organization"
                className="block max-w-full text-base sm:text-lg font-bold leading-snug text-slate-900 dark:text-white underline underline-offset-4 decoration-slate-900 dark:decoration-white hover:text-blue-600 dark:hover:text-blue-400 hover:decoration-blue-600 outline-none cursor-pointer"
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

            {/* BOTÃO ASSINE AGORA (SOMENTE EM PERÍODO DE TESTE E SEM PLANO ATIVO) */}
            {shouldShowSubscribeButton && (
              <DropdownMenu.Item
                onSelect={() => {
                  void navigate('/settings/organization?tab=system-invoices')
                }}
                className="mt-5 flex w-full cursor-pointer items-center justify-center rounded-full bg-[#0088ff] hover:bg-[#0077e6] active:bg-[#0066cc] px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition-colors outline-none"
              >
                Assine Agora
              </DropdownMenu.Item>
            )}
          </div>

          {/* LISTA DE OPÇÕES INFERIOR */}
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200">
            <DropdownMenu.Item asChild>
              <Link
                to="/profile"
                className="flex w-full cursor-pointer items-center gap-2.5 px-6 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70 outline-none"
              >
                <UserCog aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
                <span>Configuração de Perfil</span>
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
