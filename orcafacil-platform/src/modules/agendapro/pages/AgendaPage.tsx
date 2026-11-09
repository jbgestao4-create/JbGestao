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
import type { Appointment } from '../domain/appointment'
import {
  APPOINTMENT_PRIORITY_CONFIG,
  APPOINTMENT_STATUS_CONFIG,
  APPOINTMENT_TYPE_CONFIG,
} from '../domain/appointment'
import { appointmentService } from '../services/appointment.service'
import { AppointmentDetailsModal } from '../components/AppointmentDetailsModal'
import { AppointmentFormModal } from '../components/AppointmentFormModal'

export function AgendaPage() {
  const { currentOrganization } = useOrganization()
  const { user, profile } = useAuth()

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [viewMode, setViewMode] = useState<'day' | 'upcoming'>('day')
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

  const loadData = async () => {
    if (!currentOrganization) return
    setIsLoading(true)
    try {
      if (viewMode === 'day') {
        const res = await appointmentService.listByDate(currentOrganization.id, selectedDate)
        if (res.success && res.data) setAppointments(res.data)
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
  }, [currentOrganization?.id, selectedDate, viewMode])

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
    setViewMode('day')
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

  const operatorName = profile?.displayName || user?.email?.split('@')[0] || 'Usuário'

  return (
    <div className="space-y-6 max-w-full">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <CalendarIcon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            Agenda & Atendimentos
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('day')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === 'day'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Por Dia
          </button>
          <button
            type="button"
            onClick={() => setViewMode('upcoming')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === 'upcoming'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Próximos Compromissos
          </button>
        </div>

        {viewMode === 'day' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
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

      {/* Grid of Appointments */}
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
                      {appt.title}
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
