import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Check,
  CheckCheck,
  CheckCircle2,
  CreditCard,
  Package,
  Receipt,
  RefreshCw,
  X,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { inventoryService } from '@modules/inventory/services/inventory.service'
import { cashBillsService } from '@modules/cash/services/cash-bills.service'
import { organizationBillingService } from '@modules/organizations/services/organization-billing.service'
import { systemNotificationService } from '@shared/services/system-notification.service'

export interface HeaderNotificationItem {
  id: string
  readKey: string
  category: 'expiration' | 'system' | 'bill' | 'stock' | 'plan_invoice' | 'system_error'
  severity: 'critical' | 'warning' | 'info'
  title: string
  subtitle: string
  href?: string
  systemNotificationId?: string
}

const READ_STORAGE_PREFIX = 'orcafacil:read-notifications:'

function getReadStorageKey(userId: string, orgId?: string) {
  return `${READ_STORAGE_PREFIX}${userId}:${orgId || 'global'}`
}

function loadReadKeys(storageKey: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === 'string')) : new Set()
  } catch {
    return new Set()
  }
}

function saveReadKeys(storageKey: string, keys: Set<string>) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(Array.from(keys).slice(-300)))
  } catch {
    // ignore storage quota errors
  }
}

export function clearAllSessionReadKeys() {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith(READ_STORAGE_PREFIX)) {
        keysToRemove.push(k)
      }
    }
    for (const k of keysToRemove) {
      sessionStorage.removeItem(k)
    }
  } catch {
    // ignore
  }
}

interface CapturedSystemFailure {
  id: string
  message: string
}

const capturedSystemFailures: CapturedSystemFailure[] = []
let failureListenersAttached = false

function recordSystemFailure(message: string) {
  const normalized = message.trim()
  if (!normalized) return
  if (capturedSystemFailures.some((f) => f.message === normalized)) return
  capturedSystemFailures.push({
    id: `runtime-${capturedSystemFailures.length + 1}`,
    message: normalized.slice(0, 180),
  })
  if (capturedSystemFailures.length > 10) {
    capturedSystemFailures.shift()
  }
}

function ensureFailureListeners() {
  if (failureListenersAttached || typeof window === 'undefined') return
  failureListenersAttached = true
  window.addEventListener('error', (event) => {
    if (event.message) recordSystemFailure(event.message)
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const msg =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : 'Erro inesperado em segundo plano no sistema.'
    recordSystemFailure(msg)
  })
}

function getDiffDays(dateStr: string): number | null {
  if (!dateStr) return null
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function HeaderNotificationsButton() {
  const { user } = useAuth()
  const { currentOrganization } = useOrganization()
  const navigate = useNavigate()

  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [items, setItems] = useState<HeaderNotificationItem[]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)

  const readStorageKey = user ? getReadStorageKey(user.id, currentOrganization?.id) : ''

  const loadNotifications = useCallback(async () => {
    if (!user) {
      clearAllSessionReadKeys()
      setItems([])
      return
    }
    ensureFailureListeners()
    setIsLoading(true)
    try {
      const collected: HeaderNotificationItem[] = []
      const orgId = currentOrganization?.id
      const readKeys = readStorageKey ? loadReadKeys(readStorageKey) : new Set<string>()

      const [invRes, sysRes, billsRes, billingInfo] = await Promise.all([
        orgId ? inventoryService.list(orgId) : Promise.resolve({ success: true, data: [] as never[] }),
        systemNotificationService.getMyActiveNotifications(orgId || null),
        orgId ? cashBillsService.listBills(orgId) : Promise.resolve({ success: true, data: [] as never[] }),
        orgId && currentOrganization
          ? organizationBillingService
              .getBillingInfo({
                id: orgId,
                name: currentOrganization.name,
                trialEndsAt: currentOrganization.trialEndsAt,
              })
              .catch(() => null)
          : Promise.resolve(null),
      ])

      // 1. Produtos próximos do vencimento (5 dias antes ou já vencidos) e estoque zerado/baixo
      if (invRes.success && Array.isArray(invRes.data)) {
        for (const prod of invRes.data) {
          if (!prod.isActive) continue
          const attrs = (prod.attributes || {}) as Record<string, unknown>
          const hasNoExp =
            attrs.has_no_expiration === true || attrs.has_no_expiration === 'true'
          const expDate = typeof attrs.expiration_date === 'string' ? attrs.expiration_date : ''

          if (!hasNoExp && expDate) {
            const diff = getDiffDays(expDate)
            if (diff !== null && diff <= 5) {
              const readKey = `exp-${prod.id}-${expDate.slice(0, 10)}`
              if (!readKeys.has(readKey)) {
                const formattedDate = expDate.slice(0, 10).split('-').reverse().join('/')
                collected.push({
                  id: `exp-${prod.id}`,
                  readKey,
                  category: 'expiration',
                  severity: diff <= 0 ? 'critical' : 'warning',
                  title:
                    diff < 0
                      ? `Produto vencido: ${prod.name}`
                      : diff === 0
                        ? `Vence hoje: ${prod.name}`
                        : `Vence em ${diff} ${diff === 1 ? 'dia' : 'dias'}: ${prod.name}`,
                  subtitle: `Validade: ${formattedDate} • Estoque atual: ${prod.quantityOnHand} ${prod.unit}`,
                  href: `/orcafacil/inventory/${prod.id}/edit`,
                })
              }
            }
          }

          const qty = Number(prod.quantityOnHand || 0)
          const minQty = Number(prod.minimumQuantity || 0)
          if (qty <= 0 || (minQty > 0 && qty <= minQty)) {
            const readKey = `stock-${prod.id}-${prod.quantityOnHand}`
            if (!readKeys.has(readKey)) {
              collected.push({
                id: `stock-${prod.id}`,
                readKey,
                category: 'stock',
                severity: qty <= 0 ? 'critical' : 'warning',
                title:
                  qty <= 0
                    ? `Estoque zerado: ${prod.name}`
                    : `Estoque baixo: ${prod.name}`,
                subtitle:
                  qty <= 0
                    ? `Saldo atual: ${prod.quantityOnHand} ${prod.unit} • Produto sem estoque`
                    : `Atual: ${prod.quantityOnHand} ${prod.unit} (Mínimo: ${prod.minimumQuantity})`,
                href: `/orcafacil/inventory/${prod.id}/edit`,
              })
            }
          }
        }
      } else if (orgId && !invRes.success) {
        const readKey = 'err-inventory-load'
        if (!readKeys.has(readKey)) {
          collected.push({
            id: readKey,
            readKey,
            category: 'system_error',
            severity: 'critical',
            title: 'Falha ao verificar estoque de produtos',
            subtitle: ('error' in invRes && invRes.error) || 'Não foi possível consultar os produtos.',
            href: '/orcafacil/inventory/search',
          })
        }
      }

      // 2. Boletos / Contas a vencer em até 2 dias ou vencidos
      if (billsRes.success && Array.isArray(billsRes.data)) {
        for (const bill of billsRes.data) {
          if (bill.status === 'paid' || bill.status === 'cancelled') continue
          const diff = getDiffDays(bill.dueDate)
          if (diff !== null && diff <= 2) {
            const readKey = `bill-${bill.id}-${bill.dueDate.slice(0, 10)}`
            if (!readKeys.has(readKey)) {
              const formattedDue = bill.dueDate.slice(0, 10).split('-').reverse().join('/')
              collected.push({
                id: `bill-${bill.id}`,
                readKey,
                category: 'bill',
                severity: diff < 0 ? 'critical' : 'warning',
                title:
                  diff < 0
                    ? `Boleto/Conta vencida: ${bill.description}`
                    : diff === 0
                      ? `Boleto/Conta vence hoje: ${bill.description}`
                      : `Boleto/Conta vence em ${diff} ${diff === 1 ? 'dia' : 'dias'}: ${bill.description}`,
                subtitle: `Vencimento: ${formattedDue}`,
                href: '/cash?tab=bills',
              })
            }
          }
        }
      }

      // 3. Faturas geradas para pagamento do plano (5 dias antes ou vencidas)
      if (billingInfo && Array.isArray(billingInfo.unpaidInvoices)) {
        for (const inv of billingInfo.unpaidInvoices) {
          const diff = getDiffDays(inv.dueDate)
          if (diff !== null && diff <= 5) {
            const readKey = `plan-${inv.id}-${inv.dueDate.slice(0, 10)}`
            if (!readKeys.has(readKey)) {
              const formattedDue = inv.dueDate.slice(0, 10).split('-').reverse().join('/')
              const formattedAmount = Number(inv.amount || 0).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })
              collected.push({
                id: `plan-${inv.id}`,
                readKey,
                category: 'plan_invoice',
                severity: diff < 0 ? 'critical' : 'warning',
                title:
                  diff < 0
                    ? `Fatura do plano vencida`
                    : diff === 0
                      ? `Fatura do plano vence hoje`
                      : `Fatura do plano vence em ${diff} ${diff === 1 ? 'dia' : 'dias'}`,
                subtitle: `Valor: ${formattedAmount} • Vencimento: ${formattedDue}`,
                href: '/settings/organization?tab=invoices',
              })
            }
          }
        }
      }

      // 4. Notificações do sistema (comunicados e avisos administrativos)
      if (sysRes.success && Array.isArray(sysRes.data)) {
        for (const n of sysRes.data) {
          if (n.isRead) continue
          collected.push({
            id: `sys-${n.id}`,
            readKey: `sys-${n.id}`,
            category: 'system',
            severity: n.type === 'urgent' || n.type === 'warning' ? 'warning' : 'info',
            title: n.title,
            subtitle: n.message,
            href: '/dashboard',
            systemNotificationId: n.id,
          })
        }
      } else if (!sysRes.success) {
        const readKey = 'err-system-notifications-load'
        if (!readKeys.has(readKey)) {
          collected.push({
            id: readKey,
            readKey,
            category: 'system_error',
            severity: 'critical',
            title: 'Falha ao carregar avisos do sistema',
            subtitle: sysRes.error || 'Não foi possível consultar notificações administrativas.',
            href: '/dashboard',
          })
        }
      }

      if (orgId && !billsRes.success) {
        const readKey = 'err-bills-load'
        if (!readKeys.has(readKey)) {
          collected.push({
            id: readKey,
            readKey,
            category: 'system_error',
            severity: 'critical',
            title: 'Falha ao verificar boletos e contas',
            subtitle: ('error' in billsRes && billsRes.error) || 'Não foi possível consultar contas a pagar.',
            href: '/cash?tab=bills',
          })
        }
      }

      // 5. Falhas inesperadas capturadas no sistema durante a sessão
      for (const failure of capturedSystemFailures) {
        const readKey = `err-${failure.id}`
        if (!readKeys.has(readKey)) {
          collected.push({
            id: readKey,
            readKey,
            category: 'system_error',
            severity: 'critical',
            title: 'Falha detectada no sistema',
            subtitle: failure.message,
            href: '/dashboard',
          })
        }
      }

      // Ordena críticos primeiro
      const order: Record<HeaderNotificationItem['severity'], number> = {
        critical: 0,
        warning: 1,
        info: 2,
      }
      collected.sort((a, b) => order[a.severity] - order[b.severity])
      setItems(collected)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado ao carregar notificações.'
      setItems([
        {
          id: 'err-notifications-exception',
          readKey: 'err-notifications-exception',
          category: 'system_error',
          severity: 'critical',
          title: 'Falha no sistema de notificações',
          subtitle: msg,
          href: '/dashboard',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [user, currentOrganization, readStorageKey])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const markItemAsRead = async (item: HeaderNotificationItem) => {
    if (item.systemNotificationId) {
      await systemNotificationService.markAsRead(item.systemNotificationId)
    } else if (readStorageKey) {
      const currentKeys = loadReadKeys(readStorageKey)
      currentKeys.add(item.readKey)
      saveReadKeys(readStorageKey, currentKeys)
    }
    setItems((prev) => prev.filter((x) => x.id !== item.id))
  }

  const handleMarkReadClick = async (
    event: ReactMouseEvent<HTMLButtonElement>,
    item: HeaderNotificationItem,
  ) => {
    event.stopPropagation()
    await markItemAsRead(item)
  }

  const handleMarkAllAsRead = async () => {
    const sysIds = items
      .map((item) => item.systemNotificationId)
      .filter((id): id is string => Boolean(id))

    if (sysIds.length > 0) {
      await Promise.all(sysIds.map((id) => systemNotificationService.markAsRead(id)))
    }
    if (readStorageKey) {
      const currentKeys = loadReadKeys(readStorageKey)
      for (const item of items) {
        if (!item.systemNotificationId) {
          currentKeys.add(item.readKey)
        }
      }
      saveReadKeys(readStorageKey, currentKeys)
    }
    setItems([])
  }

  const handleItemClick = async (item: HeaderNotificationItem) => {
    if (item.systemNotificationId) {
      await systemNotificationService.markAsRead(item.systemNotificationId)
      setItems((prev) => prev.filter((x) => x.id !== item.id))
    }
    if (item.href) {
      setIsOpen(false)
      void navigate(item.href)
    }
  }

  const count = items.length

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => {
          const next = !isOpen
          setIsOpen(next)
          if (next) void loadNotifications()
        }}
        aria-label="Notificações"
        title="Notificações (Validade de produtos, contas e avisos)"
        className="relative inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-lg border border-sky-200/80 dark:border-slate-800 bg-white/80 dark:bg-[#111827] text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-white dark:hover:bg-slate-800 shadow-2xs cursor-pointer"
      >
        <Bell aria-hidden="true" className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                Notificações ({count})
              </span>
            </div>
            <div className="flex items-center gap-1">
              {count > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAllAsRead()}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Marcar todas</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => void loadNotifications()}
                disabled={isLoading}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                title="Atualizar notificações"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading && items.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Verificando notificações...
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nenhuma notificação pendente!
                </p>
                <p className="text-[11px] text-slate-400">
                  Nenhum vencimento ou pendência ativa no momento.
                </p>
              </div>
            ) : (
              items.map((item) => {
                const Icon =
                  item.category === 'expiration'
                    ? CalendarClock
                    : item.category === 'bill'
                      ? Receipt
                      : item.category === 'plan_invoice'
                        ? CreditCard
                        : item.category === 'stock'
                          ? Package
                          : AlertTriangle

                const iconClass =
                  item.severity === 'critical'
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                    : item.severity === 'warning'
                      ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                      : 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
                  >
                    <button
                      type="button"
                      onClick={() => void handleItemClick(item)}
                      className="flex flex-1 min-w-0 items-start gap-3 text-left cursor-pointer"
                    >
                      <div className={`mt-0.5 rounded-lg p-2 shrink-0 ${iconClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                          {item.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                          {item.subtitle}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => void handleMarkReadClick(event, item)}
                      title="Marcar como lida"
                      aria-label={`Marcar como lida: ${item.title}`}
                      className="mt-0.5 shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                    >
                      <Check className="h-3 w-3" />
                      <span>Lida</span>
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
