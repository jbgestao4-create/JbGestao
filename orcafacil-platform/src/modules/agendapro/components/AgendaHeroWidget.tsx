import { useEffect, useState, useRef } from 'react'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  Phone,
  ExternalLink,
  LockKeyhole,
  Database,
} from 'lucide-react'
import type { Appointment } from '../domain/appointment'
import {
  APPOINTMENT_STATUS_CONFIG,
  APPOINTMENT_TYPE_CONFIG,
  formatAppointmentTitle,
} from '../domain/appointment'
import { appointmentService } from '../services/appointment.service'
import { AppointmentDetailsModal } from './AppointmentDetailsModal'
import { AppointmentFormModal } from './AppointmentFormModal'

interface AgendaHeroWidgetProps {
  organizationId?: string
  userId?: string
  operatorName?: string
  connectionLabel?: string
  connectionStatus?: 'checking' | 'connected' | 'offline'
  onOpenFullAgenda?: () => void
}

export function AgendaHeroWidget({
  organizationId,
  userId,
  operatorName,
  connectionLabel = 'Online • Sincronizado',
  connectionStatus: _connectionStatus = 'connected',
  onOpenFullAgenda,
}: AgendaHeroWidgetProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hoveredAppointment, setHoveredAppointment] = useState<Appointment | null>(null)
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const todayStr = new Date().toISOString().split('T')[0]

  const loadAppointments = async (date: string) => {
    if (!organizationId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const res = await appointmentService.listByDate(organizationId, date)
      if (res.success && res.data) {
        setAppointments(res.data)
      } else {
        setAppointments([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (organizationId) {
      void loadAppointments(selectedDate)
    } else {
      setIsLoading(false)
    }
  }, [organizationId, selectedDate])

  const handlePrevDay = () => {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const handleNextDay = () => {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const handleToday = () => {
    setSelectedDate(todayStr)
  }

  const formatDateDisplay = (dateStr: string) => {
    if (dateStr === todayStr) return 'Hoje'
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Amanhã'

    try {
      const [year, month, day] = dateStr.split('-')
      const d = new Date(Number(year), Number(month) - 1, Number(day))
      return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    } catch {
      return dateStr
    }
  }

  const handleMouseEnterCard = (appt: Appointment, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoverPosition({
      x: Math.max(16, rect.left - 320),
      y: rect.top - 10,
    })
    setHoveredAppointment(appt)
  }

  const handleMouseLeaveCard = () => {
    setHoveredAppointment(null)
  }

  const handleClickCard = (appt: Appointment) => {
    setHoveredAppointment(null)
    setSelectedAppointment(appt)
    setIsDetailsModalOpen(true)
  }

  return (
    <>
      <div
        ref={containerRef}
        className="relative flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-slate-800 dark:text-white shadow-sm min-h-[310px] sm:min-h-[340px]"
      >
        {/* Top Header of Agenda */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
              <CalendarIcon className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Agenda
                </span>
                <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400/30 px-2 py-0.2 text-[10px] font-bold">
                  {appointments.length}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Date Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevDay}
              title="Dia anterior"
              className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className={`rounded px-2.5 py-1 text-xs font-bold transition ${
                selectedDate === todayStr
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
              }`}
            >
              {formatDateDisplay(selectedDate)}
            </button>
            <button
              type="button"
              onClick={handleNextDay}
              title="Próximo dia"
              className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingAppointment(null)
                setIsFormModalOpen(true)
              }}
              title="Novo Agendamento"
              className="ml-1 inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-500 px-2.5 py-1 text-xs font-bold text-white transition shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo
            </button>
          </div>
        </div>

        {/* Appointments List for Day */}
        <div className="my-3 flex-1 overflow-y-auto max-h-[195px] sm:max-h-[215px] space-y-2 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-xs text-slate-400">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mr-2" />
              Carregando agendamentos...
            </div>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-white/[0.02]">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 mb-2">
                <CalendarIcon className="h-4 w-4" />
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-white">Nenhum compromisso agendado</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Para {formatDateDisplay(selectedDate)} não há atendimentos marcados.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingAppointment(null)
                  setIsFormModalOpen(true)
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white transition shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Agendar Novo Compromisso
              </button>
            </div>
          ) : (
            appointments.map((appt) => {
              const statusCfg = APPOINTMENT_STATUS_CONFIG[appt.status] || {
                label: appt.status,
                badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30',
                dotClass: 'bg-slate-500 dark:bg-slate-400',
              }
              const typeCfg = APPOINTMENT_TYPE_CONFIG[appt.type] || {
                label: appt.type,
                colorClass: 'text-indigo-600 dark:text-indigo-400',
              }

              return (
                <div
                  key={appt.id}
                  onClick={() => handleClickCard(appt)}
                  onMouseEnter={(e) => handleMouseEnterCard(appt, e)}
                  onMouseLeave={handleMouseLeaveCard}
                  className="group relative flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100/90 hover:border-blue-400/50 dark:border-white/5 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:hover:border-blue-400/30 p-2.5 transition shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0 flex items-center gap-1 text-xs font-mono font-medium text-slate-700 dark:text-slate-300 bg-white border border-slate-200/90 dark:bg-black/30 dark:border-transparent px-2 py-0.5 rounded-md">
                      <Clock className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                      {appt.startTime || '—'}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`text-[10px] font-bold shrink-0 ${typeCfg.colorClass}`}>
                          {typeCfg.label} •
                        </span>
                        <p className="truncate text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-300 transition">
                          {formatAppointmentTitle(appt.title)}
                        </p>
                      </div>
                      {appt.customerName && (
                        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <User className="h-2.5 w-2.5" />
                          {appt.customerName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusCfg.badgeClass}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dotClass}`} />
                      {statusCfg.label}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Bottom Status strip */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <LockKeyhole className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              HTTPS
            </span>
            <span className="flex items-center gap-1">
              <Database className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              {connectionLabel}
            </span>
          </div>

          {onOpenFullAgenda && (
            <button
              type="button"
              onClick={onOpenFullAgenda}
              className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              Ver agenda completa →
            </button>
          )}
        </div>
      </div>

      {/* FLOATING HOVER SUMMARY TOOLTIP / CARD */}
      {hoveredAppointment && hoverPosition && (
        <div
          style={{
            position: 'fixed',
            left: `${hoverPosition.x}px`,
            top: `${hoverPosition.y}px`,
            zIndex: 9999,
          }}
          className="pointer-events-none w-80 rounded-2xl border border-slate-200 dark:border-blue-500/30 bg-white/95 dark:bg-slate-900/95 p-4 text-slate-800 dark:text-white shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-white/10 pb-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${
                APPOINTMENT_TYPE_CONFIG[hoveredAppointment.type]?.colorClass || 'text-blue-600 dark:text-blue-400'
              }`}
            >
              {APPOINTMENT_TYPE_CONFIG[hoveredAppointment.type]?.label || 'Compromisso'}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                APPOINTMENT_STATUS_CONFIG[hoveredAppointment.status]?.badgeClass
              }`}
            >
              {APPOINTMENT_STATUS_CONFIG[hoveredAppointment.status]?.label}
            </span>
          </div>

          <h4 className="mt-2 text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
            {hoveredAppointment.title}
          </h4>

          <div className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
              <span>
                {hoveredAppointment.appointmentDate}
                {hoveredAppointment.startTime ? ` às ${hoveredAppointment.startTime}` : ''}
              </span>
            </div>

            {hoveredAppointment.customerName && (
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span className="truncate">{hoveredAppointment.customerName}</span>
              </div>
            )}

            {hoveredAppointment.customerPhone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                <span>{hoveredAppointment.customerPhone}</span>
              </div>
            )}

            {(hoveredAppointment.description || hoveredAppointment.notes) && (
              <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-white/10 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                {hoveredAppointment.description || hoveredAppointment.notes}
              </div>
            )}
          </div>

          <p className="mt-3 text-[10px] text-blue-600 dark:text-blue-300 font-semibold flex items-center justify-between">
            <span>Clique para abrir detalhes completos</span>
            <ExternalLink className="h-3 w-3" />
          </p>
        </div>
      )}

      {/* Appointment Details Modal */}
      {selectedAppointment && (
        <AppointmentDetailsModal
          open={isDetailsModalOpen}
          appointment={selectedAppointment}
          organizationId={organizationId || ''}
          onClose={() => {
            setIsDetailsModalOpen(false)
            setSelectedAppointment(null)
          }}
          onUpdated={() => {
            void loadAppointments(selectedDate)
          }}
          onEdit={(appt) => {
            setIsDetailsModalOpen(false)
            setEditingAppointment(appt)
            setIsFormModalOpen(true)
          }}
        />
      )}

      {/* Appointment Form Modal (New / Edit) */}
      <AppointmentFormModal
        open={isFormModalOpen}
        appointment={editingAppointment}
        initialDate={selectedDate}
        organizationId={organizationId || ''}
        userId={userId}
        operatorName={operatorName}
        onClose={() => {
          setIsFormModalOpen(false)
          setEditingAppointment(null)
        }}
        onSaved={() => {
          void loadAppointments(selectedDate)
        }}
      />
    </>
  )
}
