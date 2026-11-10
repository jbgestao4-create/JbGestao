import { useEffect, useState } from 'react'
import {
  Bell,
  AlertTriangle,
  Info,
  PhoneCall,
  CheckCircle2,
  X,
} from 'lucide-react'
import { WhatsAppIcon } from './WhatsAppIcon'
import {
  systemNotificationService,
  type SystemNotification,
} from '@shared/services/system-notification.service'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { supabase } from '@app/config/supabase'

export function SystemNotificationModal() {
  const { user } = useAuth()
  const { currentOrganization } = useOrganization()

  const [notifications, setNotifications] = useState<SystemNotification[]>([])
  const [currentModalIndex, setCurrentModalIndex] = useState<number>(0)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!user) {
      setNotifications([])
      setIsOpen(false)
      return
    }

    let isMounted = true

    const loadNotifications = async () => {
      const res = await systemNotificationService.getMyActiveNotifications(
        currentOrganization?.id || null,
      )
      if (isMounted && res.success && res.data) {
        // Apenas notificações não lidas
        const unread = res.data.filter((n) => !n.isRead)
        setNotifications(unread)
        if (unread.length > 0) {
          setCurrentModalIndex(0)
          setIsOpen(true)
        } else {
          setIsOpen(false)
        }
      }
    }

    void loadNotifications()

    // Realtime listener para novas notificações direcionadas
    const channelName = `sys-notif-${Math.random().toString(36).substring(2, 9)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_notifications',
        },
        () => {
          void loadNotifications()
        },
      )
      .subscribe()

    return () => {
      isMounted = false
      void supabase.removeChannel(channel)
    }
  }, [user, currentOrganization?.id])

  if (!isOpen || notifications.length === 0) {
    return null
  }

  const notification = notifications[currentModalIndex]
  if (!notification) return null

  const handleDismiss = async () => {
    await systemNotificationService.markAsRead(notification.id)

    if (currentModalIndex + 1 < notifications.length) {
      setCurrentModalIndex((prev) => prev + 1)
    } else {
      setIsOpen(false)
      setNotifications([])
    }
  }

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'urgent':
        return {
          icon: AlertTriangle,
          iconColor: 'text-rose-600 dark:text-rose-400',
          iconBg: 'bg-rose-100 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900',
          badgeText: '🚨 Urgente',
          badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300',
          border: 'border-rose-300 dark:border-rose-800',
        }
      case 'warning':
        return {
          icon: AlertTriangle,
          iconColor: 'text-amber-600 dark:text-amber-400',
          iconBg: 'bg-amber-100 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900',
          badgeText: '⚠️ Aviso Importante',
          badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300',
          border: 'border-amber-300 dark:border-amber-800',
        }
      case 'contact':
        return {
          icon: PhoneCall,
          iconColor: 'text-emerald-600 dark:text-emerald-400',
          iconBg: 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900',
          badgeText: '📞 Contato Solicitado',
          badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300',
          border: 'border-emerald-300 dark:border-emerald-800',
        }
      case 'info':
      default:
        return {
          icon: Info,
          iconColor: 'text-blue-600 dark:text-blue-400',
          iconBg: 'bg-blue-100 dark:bg-blue-950/60 border-blue-200 dark:border-blue-900',
          badgeText: 'ℹ️ Notificação do Sistema',
          badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300',
          border: 'border-blue-300 dark:border-blue-800',
        }
    }
  }

  const styles = getTypeStyles(notification.type)
  const IconComponent = styles.icon

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className={`w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border ${styles.border} overflow-hidden`}>
        {/* Header do Modal */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${styles.iconBg} ${styles.iconColor}`}>
              <IconComponent className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${styles.badgeClass}`}>
                  {styles.badgeText}
                </span>
                {notifications.length > 1 && (
                  <span className="text-xs text-slate-400">
                    ({currentModalIndex + 1} de {notifications.length})
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
                {notification.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleDismiss()}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition"
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo da Notificação */}
        <div className="p-6 space-y-4">
          <div className="text-sm sm:text-base text-gray-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            {notification.message}
          </div>

          {/* Dados de Contato Direto (se houver) */}
          {(notification.contactWhatsapp || notification.contactEmail) && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Canal de Contato Direto com a Administração:
              </span>
              <div className="flex flex-wrap gap-2.5">
                {notification.contactWhatsapp && (
                  <a
                    href={`https://wa.me/${notification.contactWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Olá! Recebi a notificação "${notification.title}" e gostaria de falar a respeito.`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition shadow-xs"
                  >
                    <WhatsAppIcon className="w-4 h-4" />
                    <span>Falar no WhatsApp ({notification.contactWhatsapp})</span>
                  </a>
                )}
                {notification.contactEmail && (
                  <a
                    href={`mailto:${notification.contactEmail}?subject=${encodeURIComponent(
                      `Retorno sobre Notificação: ${notification.title}`,
                    )}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-300 dark:border-slate-700"
                  >
                    <Bell className="w-4 h-4" />
                    <span>{notification.contactEmail}</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer com botão de confirmação */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => void handleDismiss()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Entendido / Marcar como Lida</span>
          </button>
        </div>
      </div>
    </div>
  )
}
