import { useState, useEffect } from 'react'
import { Calendar, X, Save } from 'lucide-react'
import type { Appointment, AppointmentPriority, AppointmentType } from '../domain/appointment'
import { appointmentService } from '../services/appointment.service'

interface AppointmentFormModalProps {
  open: boolean
  appointment?: Appointment | null
  initialDate?: string
  organizationId: string
  userId?: string
  operatorName?: string
  onClose: () => void
  onSaved: () => void
}

export function AppointmentFormModal({
  open,
  appointment,
  initialDate,
  organizationId,
  userId,
  operatorName,
  onClose,
  onSaved,
}: AppointmentFormModalProps) {
  const [title, setTitle] = useState('')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [type, setType] = useState<AppointmentType>('general')
  const [priority, setPriority] = useState<AppointmentPriority>('normal')
  const [assignedTo, setAssignedTo] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (appointment) {
      setTitle(appointment.title)
      setAppointmentDate(appointment.appointmentDate)
      setStartTime(appointment.startTime || '')
      setCustomerName(appointment.customerName || '')
      setCustomerPhone(appointment.customerPhone || '')
      setType(appointment.type)
      setPriority(appointment.priority)
      setAssignedTo(appointment.assignedTo || '')
      setLocation(appointment.location || '')
      setDescription(appointment.description || appointment.notes || '')
    } else {
      const today = new Date().toISOString().split('T')[0]
      setTitle('')
      setAppointmentDate(initialDate || today)
      setStartTime('09:00')
      setCustomerName('')
      setCustomerPhone('')
      setType('general')
      setPriority('normal')
      setAssignedTo('')
      setLocation('')
      setDescription('')
    }
    setError('')
  }, [appointment, initialDate, open])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Informe um título para o agendamento.')
      return
    }
    if (!appointmentDate) {
      setError('Selecione a data do agendamento.')
      return
    }

    try {
      setIsSubmitting(true)
      setError('')

      if (appointment) {
        const res = await appointmentService.update(organizationId, appointment.id, {
          title,
          appointmentDate,
          startTime: startTime || null,
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          type,
          priority,
          assignedTo: assignedTo || null,
          location: location || null,
          description: description || null,
        })
        if (!res.success) {
          setError(res.error || 'Erro ao atualizar agendamento')
          return
        }
      } else {
        const res = await appointmentService.create(organizationId, {
          title,
          appointmentDate,
          startTime: startTime || null,
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          type,
          priority,
          assignedTo: assignedTo || null,
          location: location || null,
          description: description || null,
          createdBy: userId,
          creatorName: operatorName,
        })
        if (!res.success) {
          setError(res.error || 'Erro ao criar agendamento')
          return
        }
      }

      onSaved()
      onClose()
    } catch {
      setError('Erro inesperado ao salvar agendamento')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {appointment ? 'Editar Agendamento' : 'Novo Agendamento'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Preencha os dados do compromisso ou atendimento
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Título / Motivo <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Visita Técnica - Instalação de Equipamento"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Data <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Horário
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Tipo de Agendamento
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as AppointmentType)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="general">Geral / Reunião</option>
                  <option value="quote">Orçamento / Proposta</option>
                  <option value="service_order">Ordem de Serviço</option>
                  <option value="technical_visit">Visita Técnica</option>
                  <option value="sale">Venda / Entrega</option>
                  <option value="delivery">Entrega de Pedido</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Prioridade
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as AppointmentPriority)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="low">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  placeholder="Nome do cliente (opcional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="(00) 00000-0000"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Atribuir a (Responsável)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Carlos / Técnico 1"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Local / Endereço
                </label>
                <input
                  type="text"
                  placeholder="Ex: Na empresa / Rua X, 123"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Observações / Detalhes
              </label>
              <textarea
                rows={3}
                placeholder="Detalhes adicionais, pendências ou orientações..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/40">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {isSubmitting ? 'Salvando...' : appointment ? 'Salvar Alterações' : 'Criar Agendamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
