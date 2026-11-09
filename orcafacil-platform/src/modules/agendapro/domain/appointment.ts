export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type AppointmentPriority = 'low' | 'normal' | 'high' | 'urgent'

export type AppointmentType =
  | 'general'
  | 'quote'
  | 'service_order'
  | 'sale'
  | 'technical_visit'
  | 'delivery'

export interface Appointment {
  id: string
  organizationId: string
  title: string
  description?: string | null
  customerId?: string | null
  customerName?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
  appointmentDate: string // YYYY-MM-DD
  startTime?: string | null // HH:mm
  endTime?: string | null // HH:mm
  status: AppointmentStatus
  priority: AppointmentPriority
  type: AppointmentType
  referenceId?: string | null
  referenceType?: string | null
  assignedTo?: string | null
  location?: string | null
  notes?: string | null
  createdBy?: string | null
  creatorName?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateAppointmentInput {
  title: string
  description?: string | null
  customerId?: string | null
  customerName?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
  appointmentDate: string
  startTime?: string | null
  endTime?: string | null
  status?: AppointmentStatus
  priority?: AppointmentPriority
  type?: AppointmentType
  referenceId?: string | null
  referenceType?: string | null
  assignedTo?: string | null
  location?: string | null
  notes?: string | null
  createdBy?: string | null
  creatorName?: string | null
}

export interface UpdateAppointmentInput {
  title?: string
  description?: string | null
  customerId?: string | null
  customerName?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
  appointmentDate?: string
  startTime?: string | null
  endTime?: string | null
  status?: AppointmentStatus
  priority?: AppointmentPriority
  type?: AppointmentType
  referenceId?: string | null
  referenceType?: string | null
  assignedTo?: string | null
  location?: string | null
  notes?: string | null
}

export const APPOINTMENT_STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  scheduled: {
    label: 'Agendado',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
    dotClass: 'bg-blue-500 dark:bg-blue-400',
  },
  confirmed: {
    label: 'Confirmado',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    dotClass: 'bg-emerald-500 dark:bg-emerald-400',
  },
  in_progress: {
    label: 'Em Andamento',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    dotClass: 'bg-amber-500 dark:bg-amber-400',
  },
  completed: {
    label: 'Concluído',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30',
    dotClass: 'bg-slate-500 dark:bg-slate-400',
  },
  cancelled: {
    label: 'Cancelado',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
    dotClass: 'bg-rose-500 dark:bg-rose-400',
  },
}

export const APPOINTMENT_TYPE_CONFIG: Record<
  AppointmentType,
  { label: string; colorClass: string }
> = {
  general: { label: 'Compromisso', colorClass: 'text-indigo-600 dark:text-indigo-400' },
  quote: { label: 'Orçamento', colorClass: 'text-purple-600 dark:text-purple-400' },
  service_order: { label: 'Ordem de Serviço', colorClass: 'text-sky-600 dark:text-sky-400' },
  sale: { label: 'Venda / Entrega', colorClass: 'text-emerald-600 dark:text-emerald-400' },
  technical_visit: { label: 'Visita Técnica', colorClass: 'text-amber-600 dark:text-amber-400' },
  delivery: { label: 'Entrega', colorClass: 'text-teal-600 dark:text-teal-400' },
}

export const APPOINTMENT_PRIORITY_CONFIG: Record<
  AppointmentPriority,
  { label: string; badgeClass: string }
> = {
  low: { label: 'Baixa', badgeClass: 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-500/10' },
  normal: { label: 'Normal', badgeClass: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10' },
  high: { label: 'Alta', badgeClass: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10' },
  urgent: { label: 'Urgente', badgeClass: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10' },
}

/**
 * Remove o número/código do orçamento da frente do título na agenda
 * Ex: "Orçamento #a1b2c3d4 - Bryan" -> "Orçamento - Bryan"
 */
export function formatAppointmentTitle(title: string): string {
  if (!title) return ''
  return title
    .replace(/^Orçamento\s*(?:#|n[º°]\s*)?[a-zA-Z0-9_-]+\s*[-–]\s*/i, 'Orçamento - ')
    .replace(/^Orçamento\s*(?:#|n[º°]\s*)?[a-zA-Z0-9_-]+$/i, 'Orçamento')
}
