import { Calendar } from 'lucide-react'

interface ForwardToScheduleCardProps {
  enabled: boolean
  onChangeEnabled: (enabled: boolean) => void
  date: string
  onChangeDate: (date: string) => void
  time?: string
  onChangeTime?: (time: string) => void
  assignedTo?: string
  onChangeAssignedTo?: (val: string) => void
  notes?: string
  onChangeNotes?: (val: string) => void
  title?: string
  description?: string
  dateLabel?: string
  hideAssignedTo?: boolean
}

export function ForwardToScheduleCard({
  enabled,
  onChangeEnabled,
  date,
  onChangeDate,
  time = '09:00',
  onChangeTime,
  assignedTo = '',
  onChangeAssignedTo,
  notes = '',
  onChangeNotes,
  title = 'Encaminhar para agenda',
  description = 'Agendar atendimento, visita técnica ou retorno diretamente na Agenda do sistema.',
  dateLabel = 'Dia do agendamento para atribuição',
  hideAssignedTo = false,
}: ForwardToScheduleCardProps) {
  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        enabled
          ? 'border-blue-400 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-700 shadow-xs'
          : 'border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900/50 hover:border-gray-300'
      }`}
    >
      <div className="p-4 sm:p-5">
        {/* Toggle switch header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-lg shrink-0 transition ${
                enabled
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <label
                htmlFor="forward-to-schedule-toggle"
                className="text-sm font-bold text-gray-900 dark:text-white cursor-pointer select-none flex items-center gap-2"
              >
                {title}
                {enabled && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                    Ativo
                  </span>
                )}
              </label>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{description}</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
            <input
              id="forward-to-schedule-toggle"
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                const isChecked = e.target.checked
                onChangeEnabled(isChecked)
                if (isChecked && !date) {
                  // Default to today or tomorrow
                  const today = new Date().toISOString().split('T')[0]
                  onChangeDate(today)
                }
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600" />
          </label>
        </div>

        {/* Extended Inputs when enabled */}
        {enabled && (
          <div className="mt-4 pt-4 border-t border-blue-200/60 dark:border-blue-900/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                {dateLabel} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required={enabled}
                  value={date}
                  onChange={(e) => onChangeDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {onChangeTime && (
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Horário do Agendamento
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => onChangeTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {!hideAssignedTo && onChangeAssignedTo && (
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Atribuir a (Responsável)
                </label>
                <input
                  type="text"
                  placeholder="Nome do operador ou técnico"
                  value={assignedTo}
                  onChange={(e) => onChangeAssignedTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {onChangeNotes && (
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Observações do Agendamento (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Levar amostras de material / cliente disponível apenas à tarde"
                  value={notes}
                  onChange={(e) => onChangeNotes(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
