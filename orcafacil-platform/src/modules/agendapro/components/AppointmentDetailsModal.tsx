import { useState } from 'react'
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit3,
  X,
  MessageCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Appointment, AppointmentStatus } from '../domain/appointment'
import {
  APPOINTMENT_PRIORITY_CONFIG,
  APPOINTMENT_STATUS_CONFIG,
  APPOINTMENT_TYPE_CONFIG,
} from '../domain/appointment'
import { appointmentService } from '../services/appointment.service'

interface AppointmentDetailsModalProps {
  open: boolean
  appointment: Appointment | null
  organizationId: string
  onClose: () => void
  onUpdated?: () => void
  onEdit?: (appointment: Appointment) => void
}

export function AppointmentDetailsModal({
  open,
  appointment,
  organizationId,
  onClose,
  onUpdated,
  onEdit,
}: AppointmentDetailsModalProps) {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!open || !appointment) return null

  const statusConfig = APPOINTMENT_STATUS_CONFIG[appointment.status] || {
    label: appointment.status,
    badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    dotClass: 'bg-slate-400',
  }

  const typeConfig = APPOINTMENT_TYPE_CONFIG[appointment.type] || {
    label: appointment.type,
    colorClass: 'text-indigo-400',
  }

  const priorityConfig = APPOINTMENT_PRIORITY_CONFIG[appointment.priority] || {
    label: appointment.priority,
    badgeClass: 'text-blue-400 bg-blue-500/10',
  }

  const formattedDate = (() => {
    try {
      const [year, month, day] = appointment.appointmentDate.split('-')
      if (year && month && day) {
        return `${day}/${month}/${year}`
      }
      return appointment.appointmentDate
    } catch {
      return appointment.appointmentDate
    }
  })()

  const handleStatusChange = async (newStatus: AppointmentStatus) => {
    try {
      setIsUpdatingStatus(true)
      const res = await appointmentService.updateStatus(organizationId, appointment.id, newStatus)
      if (res.success) {
        appointment.status = newStatus
        onUpdated?.()
      }
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      const res = await appointmentService.delete(organizationId, appointment.id)
      if (res.success) {
        onUpdated?.()
        onClose()
      }
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  const cleanPhone = appointment.customerPhone?.replace(/\D/g, '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 p-5 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs font-semibold ${typeConfig.colorClass}`}>
                {typeConfig.label}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig.badgeClass}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotClass}`} />
                {statusConfig.label}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${priorityConfig.badgeClass}`}
              >
                Prioridade {priorityConfig.label}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
              {appointment.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Data e Horário */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                  Data
                </p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {formattedDate}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                  Horário
                </p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {appointment.startTime
                    ? `${appointment.startTime}${appointment.endTime ? ` às ${appointment.endTime}` : ''}`
                    : 'Não especificado'}
                </p>
              </div>
            </div>
          </div>

          {/* Dados do Cliente */}
          {(appointment.customerName || appointment.customerPhone || appointment.customerEmail) && (
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cliente / Contato
              </p>
              <div className="space-y-1.5 text-sm">
                {appointment.customerName && (
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <User className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="font-semibold">{appointment.customerName}</span>
                  </div>
                )}
                {appointment.customerPhone && (
                  <div className="flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>{appointment.customerPhone}</span>
                    </div>
                    {cleanPhone && (
                      <a
                        href={`https://wa.me/55${cleanPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </a>
                    )}
                  </div>
                )}
                {appointment.customerEmail && (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>{appointment.customerEmail}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Local / Atribuído */}
          {(appointment.location || appointment.assignedTo) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {appointment.location && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/20 border border-slate-200/60 dark:border-slate-800">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-slate-400 block">
                      Local
                    </span>
                    <span className="text-slate-700 dark:text-slate-200">
                      {appointment.location}
                    </span>
                  </div>
                </div>
              )}
              {appointment.assignedTo && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/20 border border-slate-200/60 dark:border-slate-800">
                  <User className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-slate-400 block">
                      Responsável / Atribuído
                    </span>
                    <span className="text-slate-700 dark:text-slate-200">
                      {appointment.assignedTo}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Descrição / Observações */}
          {(appointment.description || appointment.notes) && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Observações / Descrição
              </p>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {appointment.description || appointment.notes}
              </div>
            </div>
          )}

          {/* Vínculo com Módulo (Origem) */}
          {appointment.referenceId && appointment.referenceType && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/50">
              <div className="text-xs text-blue-900 dark:text-blue-200">
                <span className="font-semibold">Vínculo: </span>
                {appointment.referenceType === 'quote' && 'Orçamento do sistema'}
                {appointment.referenceType === 'service_order' && 'Ordem de Serviço (O.S.)'}
                {appointment.referenceType === 'sale' && 'Venda / Pedido'}
              </div>
              {appointment.referenceType === 'quote' && (
                <Link
                  to="/orcafacil/quotes"
                  onClick={onClose}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Abrir Orçamentos
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
              {appointment.referenceType === 'service_order' && (
                <Link
                  to="/service-orders"
                  onClick={onClose}
                  className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
                >
                  Abrir Ordens de Serviço
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
              {appointment.referenceType === 'sale' && (
                <Link
                  to="/orcafacil/sales/search"
                  onClick={onClose}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Abrir Vendas
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          )}

          {/* Ações rápidas de status */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Alterar Situação
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isUpdatingStatus || appointment.status === 'confirmed'}
                onClick={() => void handleStatusChange('confirmed')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  appointment.status === 'confirmed'
                    ? 'bg-emerald-500 text-white border-emerald-600'
                    : 'border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirmar
              </button>

              <button
                type="button"
                disabled={isUpdatingStatus || appointment.status === 'in_progress'}
                onClick={() => void handleStatusChange('in_progress')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  appointment.status === 'in_progress'
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'border-amber-200 dark:border-amber-800/80 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                Em Andamento
              </button>

              <button
                type="button"
                disabled={isUpdatingStatus || appointment.status === 'completed'}
                onClick={() => void handleStatusChange('completed')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  appointment.status === 'completed'
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Concluir
              </button>

              <button
                type="button"
                disabled={isUpdatingStatus || appointment.status === 'cancelled'}
                onClick={() => void handleStatusChange('cancelled')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  appointment.status === 'cancelled'
                    ? 'bg-rose-600 text-white border-rose-700'
                    : 'border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                }`}
              >
                <XCircle className="h-3.5 w-3.5" />
                Cancelar
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-600 font-medium">Tem certeza?</span>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => void handleDelete()}
                  className="px-2 py-1 text-xs font-bold text-white bg-rose-600 rounded hover:bg-rose-700 disabled:opacity-50"
                >
                  Sim, excluir
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:underline"
                >
                  Não
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(appointment)
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Editar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
