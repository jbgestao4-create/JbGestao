import { useEffect, useState, useMemo } from 'react'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  User,
  Phone,
  Search,
  MapPin,
  CalendarDays,
} from 'lucide-react'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useAuth } from '@modules/auth/context/AuthContext'
import type { Appointment, AppointmentStatus } from '../domain/appointment'
import {
  APPOINTMENT_PRIORITY_CONFIG,
  APPOINTMENT_STATUS_CONFIG,
  APPOINTMENT_TYPE_CONFIG,
  formatAppointmentTitle,
} from '../domain/appointment'
import { appointmentService } from '../services/appointment.service'
import { AppointmentDetailsModal } from '../components/AppointmentDetailsModal'
import { AppointmentFormModal } from '../components/AppointmentFormModal'

function getStatusTheme(status: AppointmentStatus | string) {
  switch (status) {
    case 'confirmed':
      return {
        pill: 'bg-emerald-50 dark:bg-emerald-950/70 border-l-4 border-l-emerald-500 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60',
        dot: 'bg-emerald-500',
      }
    case 'in_progress':
      return {
        pill: 'bg-amber-50 dark:bg-amber-950/70 border-l-4 border-l-amber-500 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60',
        dot: 'bg-amber-500',
      }
    case 'completed':
      return {
        pill: 'bg-indigo-50 dark:bg-indigo-950/70 border-l-4 border-l-indigo-500 text-indigo-900 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/60',
        dot: 'bg-indigo-500',
      }
    case 'cancelled':
      return {
        pill: 'bg-rose-50/60 dark:bg-rose-950/60 border-l-4 border-l-rose-400 text-rose-800 dark:text-rose-300 line-through hover:bg-rose-100 dark:hover:bg-rose-900/60',
        dot: 'bg-rose-400',
      }
    case 'scheduled':
    default:
      return {
        pill: 'bg-blue-50 dark:bg-blue-950/70 border-l-4 border-l-blue-500 text-blue-900 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/60',
        dot: 'bg-blue-500',
      }
  }
}

export function AgendaPage() {
  const { currentOrganization } = useOrganization()
  const { user, profile } = useAuth()

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [viewMode, setViewMode] = useState<'day' | 'month' | 'upcoming'>('day')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)

  const todayStr = new Date().toISOString().split('T')[0]

  // Cálculos do Mês
  const monthDate = useMemo(() => new Date(selectedDate + 'T12:00:00'), [selectedDate])
  const currentYear = monthDate.getFullYear()
  const currentMonth = monthDate.getMonth()

  const monthLabel = useMemo(() => {
    const str = monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return str.charAt(0).toUpperCase() + str.slice(1)
  }, [monthDate])

  // Grade de 42 dias para o calendário mensal (Estilo Microsoft Teams)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
    const startingDayOfWeek = firstDayOfMonth.getDay() // 0 = Domingo

    const days: Array<{
      dateStr: string
      dayNumber: number
      isCurrentMonth: boolean
      isToday: boolean
      isSelected: boolean
    }> = []

    const startDate = new Date(currentYear, currentMonth, 1 - startingDayOfWeek)

    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      days.push({
        dateStr,
        dayNumber: d.getDate(),
        isCurrentMonth: d.getMonth() === currentMonth,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
      })
    }

    return days
  }, [currentYear, currentMonth, todayStr, selectedDate])

  const loadData = async () => {
    if (!currentOrganization) return
    setIsLoading(true)
    try {
      if (viewMode === 'day') {
        const res = await appointmentService.listByDate(currentOrganization.id, selectedDate)
        if (res.success && res.data) setAppointments(res.data)
      } else if (viewMode === 'month') {
        if (calendarDays.length > 0) {
          const startDate = calendarDays[0].dateStr
          const endDate = calendarDays[calendarDays.length - 1].dateStr
          const res = await appointmentService.listByDateRange(currentOrganization.id, startDate, endDate)
          if (res.success && res.data) setAppointments(res.data)
        }
      } else {
        const res = await appointmentService.listRecentOrUpcoming(currentOrganization.id, 50)
        if (res.success && res.data) setAppointments(res.data)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [currentOrganization?.id, selectedDate, viewMode, currentYear, currentMonth])

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

  const handlePrevMonth = () => {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setMonth(d.getMonth() - 1)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const handleNextMonth = () => {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setMonth(d.getMonth() + 1)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const handleToday = () => {
    setSelectedDate(todayStr)
  }

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      if (filterType !== 'all' && appt.type !== filterType) return false
      if (filterStatus !== 'all' && appt.status !== filterStatus) return false
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const matchTitle = appt.title.toLowerCase().includes(term)
        const matchCustomer = appt.customerName?.toLowerCase().includes(term) || false
        const matchPhone = appt.customerPhone?.includes(term) || false
        const matchDesc = appt.description?.toLowerCase().includes(term) || false
        if (!matchTitle && !matchCustomer && !matchPhone && !matchDesc) return false
      }
      return true
    })
  }, [appointments, filterType, filterStatus, searchTerm])

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const appt of filteredAppointments) {
      const list = map.get(appt.appointmentDate) || []
      list.push(appt)
      map.set(appt.appointmentDate, list)
    }
    return map
  }, [filteredAppointments])

  const operatorName = profile?.displayName || user?.email?.split('@')[0] || 'Usuário'

  return (
    <div className="space-y-6 max-w-full">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <CalendarIcon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            Agenda &amp; Atendimentos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gerencie visitas, orçamentos, ordens de serviço e entregas agendadas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingAppointment(null)
              setIsFormModalOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-md transition"
          >
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </button>
        </div>
      </div>

      {/* Control bar: Tabs, Date Navigation, and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
        {/* Toggle DIA / MÊS / PRÓXIMOS */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode('day')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'day'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Por Dia
          </button>
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'month'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Por Mês
          </button>
          <button
            type="button"
            onClick={() => setViewMode('upcoming')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'upcoming'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Próximos
          </button>
        </div>

        {/* Date Navigator */}
        {viewMode === 'day' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Dia anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleNextDay}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Próximo dia"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              Hoje
            </button>
          </div>
        )}

        {viewMode === 'month' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 min-w-[150px] text-center">
              {monthLabel}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              Hoje
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar título, cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-44 sm:w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Filter Type */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Todos os tipos</option>
            <option value="general">Compromisso Geral</option>
            <option value="quote">Orçamento</option>
            <option value="service_order">Ordem de Serviço</option>
            <option value="technical_visit">Visita Técnica</option>
            <option value="sale">Venda / Entrega</option>
          </select>

          {/* Filter Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Todos os status</option>
            <option value="scheduled">Agendados</option>
            <option value="confirmed">Confirmados</option>
            <option value="in_progress">Em Andamento</option>
            <option value="completed">Concluídos</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISUALIZAÇÃO POR MÊS (ESTILO MICROSOFT TEAMS) */}
      {/* ========================================================================= */}
      {viewMode === 'month' ? (
        isLoading ? (
          <div className="flex items-center justify-center p-16 text-sm text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mr-2" />
            Carregando calendário de {monthLabel}...
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            {/* Header de Dias da Semana */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-center text-xs font-bold text-slate-700 dark:text-slate-300">
              {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((dayName, idx) => (
                <div key={dayName} className="py-3 border-r border-slate-200 dark:border-slate-800 last:border-r-0">
                  <span className="hidden sm:inline">{dayName}</span>
                  <span className="sm:hidden">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][idx]}</span>
                </div>
              ))}
            </div>

            {/* Grade de 42 Dias (6 semanas estilo Teams) */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-200 dark:divide-slate-800">
              {calendarDays.map((day) => {
                const dayAppointments = appointmentsByDate.get(day.dateStr) || []
                return (
                  <div
                    key={day.dateStr}
                    onClick={() => setSelectedDate(day.dateStr)}
                    onDoubleClick={() => {
                      setSelectedDate(day.dateStr)
                      setEditingAppointment(null)
                      setIsFormModalOpen(true)
                    }}
                    className={`group relative min-h-[115px] sm:min-h-[135px] p-1.5 sm:p-2 transition-colors flex flex-col justify-between ${
                      !day.isCurrentMonth
                        ? 'bg-slate-50/60 dark:bg-slate-950/40 text-slate-400'
                        : day.isToday
                          ? 'bg-blue-50/20 dark:bg-blue-950/20'
                          : 'bg-white dark:bg-slate-900 hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                    } ${day.isSelected ? 'ring-2 ring-blue-500/40 inset-0' : ''}`}
                  >
                    {/* Topo do dia */}
                    <div className="flex items-center justify-between mb-1">
                      {day.isToday ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs shadow-xs">
                          {day.dayNumber}
                        </span>
                      ) : (
                        <span
                          className={`text-xs font-bold ${
                            day.isCurrentMonth
                              ? 'text-slate-800 dark:text-slate-200'
                              : 'text-slate-400 dark:text-slate-600'
                          }`}
                        >
                          {day.dayNumber}
                        </span>
                      )}

                      {/* Botão de adicionar compromisso no dia */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedDate(day.dateStr)
                          setEditingAppointment(null)
                          setIsFormModalOpen(true)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-400 hover:text-blue-600 transition"
                        title={`Novo compromisso para dia ${day.dayNumber}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Lista de compromissos no dia (Cards estilo Teams) */}
                    <div className="flex-1 space-y-1 overflow-y-auto max-h-[85px] sm:max-h-[95px] scrollbar-none">
                      {dayAppointments.slice(0, 3).map((appt) => {
                        const theme = getStatusTheme(appt.status)
                        return (
                          <div
                            key={appt.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedAppointment(appt)
                              setIsDetailsModalOpen(true)
                            }}
                            className={`group/item flex items-center justify-between gap-1 px-1.5 py-0.5 sm:py-1 rounded text-[11px] font-medium shadow-2xs cursor-pointer transition-all hover:scale-[1.01] ${theme.pill}`}
                            title={`${appt.startTime ? `${appt.startTime} - ` : ''}${appt.title}${appt.customerName ? ` (${appt.customerName})` : ''}`}
                          >
                            <div className="flex items-center gap-1 truncate">
                              {appt.startTime && (
                                <span className="font-mono font-bold text-[9px] sm:text-[10px] shrink-0 opacity-80">
                                  {appt.startTime}
                                </span>
                              )}
                              <span className="truncate font-semibold text-[10px] sm:text-[11px]">
                                {appt.title}
                              </span>
                            </div>
                            {appt.customerName && (
                              <span className="text-[9px] opacity-75 truncate max-w-[60px] hidden md:inline">
                                {appt.customerName.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        )
                      })}

                      {dayAppointments.length > 3 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedDate(day.dateStr)
                            setViewMode('day')
                          }}
                          className="w-full text-left px-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          +{dayAppointments.length - 3} mais
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      ) : (
        /* VISUALIZAÇÃO POR DIA OU PRÓXIMOS (CARDS DETALHADOS) */
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-sm text-slate-500">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mr-2" />
              Carregando agenda...
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center bg-white dark:bg-slate-900/40">
              <CalendarDays className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Nenhum agendamento encontrado
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Não há compromissos correspondentes aos filtros selecionados. Crie um novo agendamento
                ou selecione outra data.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingAppointment(null)
                  setIsFormModalOpen(true)
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition"
              >
                <Plus className="h-4 w-4" />
                Criar Agendamento Agora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAppointments.map((appt) => {
                const statusCfg = APPOINTMENT_STATUS_CONFIG[appt.status] || {
                  label: appt.status,
                  badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                  dotClass: 'bg-slate-400',
                }
                const typeCfg = APPOINTMENT_TYPE_CONFIG[appt.type] || {
                  label: appt.type,
                  colorClass: 'text-indigo-600 dark:text-indigo-400',
                }
                const priorityCfg = APPOINTMENT_PRIORITY_CONFIG[appt.priority] || {
                  label: appt.priority,
                  badgeClass: 'text-blue-600 bg-blue-50',
                }

                return (
                  <div
                    key={appt.id}
                    onClick={() => {
                      setSelectedAppointment(appt)
                      setIsDetailsModalOpen(true)
                    }}
                    className="group relative cursor-pointer rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:shadow-md hover:border-blue-400/60 dark:hover:border-blue-600/60 transition-all flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-xs font-bold uppercase tracking-wider ${typeCfg.colorClass}`}>
                          {typeCfg.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg.badgeClass}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dotClass}`} />
                          {statusCfg.label}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition leading-snug">
                        {formatAppointmentTitle(appt.title)}
                      </h3>

                      <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>
                            {appt.appointmentDate}
                            {appt.startTime ? ` às ${appt.startTime}` : ''}
                          </span>
                        </div>

                        {appt.customerName && (
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {appt.customerName}
                            </span>
                          </div>
                        )}

                        {appt.customerPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{appt.customerPhone}</span>
                          </div>
                        )}

                        {appt.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{appt.location}</span>
                          </div>
                        )}
                      </div>

                      {(appt.description || appt.notes) && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          {appt.description || appt.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                      <span className={`px-2 py-0.5 rounded font-medium ${priorityCfg.badgeClass}`}>
                        {priorityCfg.label}
                      </span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
                        Ver detalhes →
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Appointment Details Modal */}
      {selectedAppointment && (
        <AppointmentDetailsModal
          open={isDetailsModalOpen}
          appointment={selectedAppointment}
          organizationId={currentOrganization?.id || ''}
          onClose={() => {
            setIsDetailsModalOpen(false)
            setSelectedAppointment(null)
          }}
          onUpdated={() => {
            void loadData()
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
        organizationId={currentOrganization?.id || ''}
        userId={user?.id}
        operatorName={operatorName}
        onClose={() => {
          setIsFormModalOpen(false)
          setEditingAppointment(null)
        }}
        onSaved={() => {
          void loadData()
        }}
      />
    </div>
  )
}
