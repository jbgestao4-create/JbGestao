import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult } from '@shared/types/common'
import type {
  Appointment,
  AppointmentPriority,
  AppointmentStatus,
  AppointmentType,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from '../domain/appointment'

interface AppointmentRow {
  id: string
  organization_id: string
  title: string
  description: string | null
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  appointment_date: string
  start_time: string | null
  end_time: string | null
  status: string
  priority: string
  type: string
  reference_id: string | null
  reference_type: string | null
  assigned_to: string | null
  location: string | null
  notes: string | null
  created_by: string | null
  creator_name: string | null
  created_at: string
  updated_at: string
}

function mapRowToAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    description: row.description,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    appointmentDate: row.appointment_date,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status as AppointmentStatus,
    priority: row.priority as AppointmentPriority,
    type: row.type as AppointmentType,
    referenceId: row.reference_id,
    referenceType: row.reference_type,
    assignedTo: row.assigned_to,
    location: row.location,
    notes: row.notes,
    createdBy: row.created_by,
    creatorName: row.creator_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const appointmentService = {
  async listByDate(
    organizationId: string,
    date: string,
  ): Promise<ServiceResult<Appointment[]>> {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('appointment_date', date)
        .order('start_time', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })

      if (error) {
        logger.error('Erro ao listar agendamentos do dia:', error)
        return { success: false, error: 'Erro ao carregar agendamentos do dia' }
      }

      return {
        success: true,
        data: ((data as unknown as AppointmentRow[]) || []).map(mapRowToAppointment),
      }
    } catch (err) {
      logger.error('Exceção ao listar agendamentos do dia:', err)
      return { success: false, error: 'Erro inesperado ao listar agendamentos' }
    }
  },

  async listByDateRange(
    organizationId: string,
    startDate: string,
    endDate: string,
  ): Promise<ServiceResult<Appointment[]>> {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate)
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: false })

      if (error) {
        logger.error('Erro ao listar agendamentos por intervalo:', error)
        return { success: false, error: 'Erro ao carregar agendamentos do período' }
      }

      return {
        success: true,
        data: ((data as unknown as AppointmentRow[]) || []).map(mapRowToAppointment),
      }
    } catch (err) {
      logger.error('Exceção ao listar agendamentos por intervalo:', err)
      return { success: false, error: 'Erro inesperado ao listar agendamentos' }
    }
  },

  async listRecentOrUpcoming(
    organizationId: string,
    limit: number = 20,
  ): Promise<ServiceResult<Appointment[]>> {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('appointment_date', today)
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: false })
        .limit(limit)

      if (error) {
        logger.error('Erro ao listar agendamentos futuros:', error)
        return { success: false, error: 'Erro ao carregar agendamentos' }
      }

      return {
        success: true,
        data: ((data as unknown as AppointmentRow[]) || []).map(mapRowToAppointment),
      }
    } catch (err) {
      logger.error('Exceção ao listar agendamentos futuros:', err)
      return { success: false, error: 'Erro inesperado ao buscar agendamentos' }
    }
  },

  async getById(
    organizationId: string,
    id: string,
  ): Promise<ServiceResult<Appointment>> {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('id', id)
        .single()

      if (error || !data) {
        logger.error('Erro ao buscar agendamento:', error)
        return { success: false, error: 'Agendamento não encontrado' }
      }

      return {
        success: true,
        data: mapRowToAppointment(data as unknown as AppointmentRow),
      }
    } catch (err) {
      logger.error('Exceção ao obter agendamento:', err)
      return { success: false, error: 'Erro inesperado ao obter agendamento' }
    }
  },

  async getByReference(
    organizationId: string,
    referenceType: string,
    referenceId: string,
  ): Promise<ServiceResult<Appointment | null>> {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('reference_type', referenceType)
        .eq('reference_id', referenceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        logger.error('Erro ao buscar agendamento de referência:', error)
        return { success: false, error: 'Erro ao buscar agendamento vinculado' }
      }

      return {
        success: true,
        data: data ? mapRowToAppointment(data as unknown as AppointmentRow) : null,
      }
    } catch (err) {
      logger.error('Exceção ao obter agendamento de referência:', err)
      return { success: false, error: 'Erro inesperado ao obter agendamento vinculado' }
    }
  },

  async create(
    organizationId: string,
    input: CreateAppointmentInput,
  ): Promise<ServiceResult<Appointment>> {
    try {
      const payload = {
        organization_id: organizationId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        customer_id: input.customerId || null,
        customer_name: input.customerName?.trim() || null,
        customer_phone: input.customerPhone?.trim() || null,
        customer_email: input.customerEmail?.trim() || null,
        appointment_date: input.appointmentDate,
        start_time: input.startTime || null,
        end_time: input.endTime || null,
        status: input.status || 'scheduled',
        priority: input.priority || 'normal',
        type: input.type || 'general',
        reference_id: input.referenceId || null,
        reference_type: input.referenceType || null,
        assigned_to: input.assignedTo?.trim() || null,
        location: input.location?.trim() || null,
        notes: input.notes?.trim() || null,
        created_by: input.createdBy || null,
        creator_name: input.creatorName?.trim() || null,
      }

      const { data, error } = await supabase
        .from('appointments')
        .insert(payload)
        .select('*')
        .single()

      if (error || !data) {
        logger.error('Erro ao criar agendamento:', error)
        return { success: false, error: 'Erro ao salvar agendamento' }
      }

      return {
        success: true,
        data: mapRowToAppointment(data as unknown as AppointmentRow),
      }
    } catch (err) {
      logger.error('Exceção ao criar agendamento:', err)
      return { success: false, error: 'Erro inesperado ao salvar agendamento' }
    }
  },

  async update(
    organizationId: string,
    id: string,
    input: UpdateAppointmentInput,
  ): Promise<ServiceResult<Appointment>> {
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }

      if (input.title !== undefined) updateData.title = input.title.trim()
      if (input.description !== undefined) updateData.description = input.description?.trim() || null
      if (input.customerId !== undefined) updateData.customer_id = input.customerId || null
      if (input.customerName !== undefined) updateData.customer_name = input.customerName?.trim() || null
      if (input.customerPhone !== undefined) updateData.customer_phone = input.customerPhone?.trim() || null
      if (input.customerEmail !== undefined) updateData.customer_email = input.customerEmail?.trim() || null
      if (input.appointmentDate !== undefined) updateData.appointment_date = input.appointmentDate
      if (input.startTime !== undefined) updateData.start_time = input.startTime || null
      if (input.endTime !== undefined) updateData.end_time = input.endTime || null
      if (input.status !== undefined) updateData.status = input.status
      if (input.priority !== undefined) updateData.priority = input.priority
      if (input.type !== undefined) updateData.type = input.type
      if (input.referenceId !== undefined) updateData.reference_id = input.referenceId || null
      if (input.referenceType !== undefined) updateData.reference_type = input.referenceType || null
      if (input.assignedTo !== undefined) updateData.assigned_to = input.assignedTo?.trim() || null
      if (input.location !== undefined) updateData.location = input.location?.trim() || null
      if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null

      const { data, error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('organization_id', organizationId)
        .eq('id', id)
        .select('*')
        .single()

      if (error || !data) {
        logger.error('Erro ao atualizar agendamento:', error)
        return { success: false, error: 'Erro ao atualizar agendamento' }
      }

      return {
        success: true,
        data: mapRowToAppointment(data as unknown as AppointmentRow),
      }
    } catch (err) {
      logger.error('Exceção ao atualizar agendamento:', err)
      return { success: false, error: 'Erro inesperado ao atualizar agendamento' }
    }
  },

  async updateStatus(
    organizationId: string,
    id: string,
    status: AppointmentStatus,
  ): Promise<ServiceResult<Appointment>> {
    return this.update(organizationId, id, { status })
  },

  async delete(organizationId: string, id: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', id)

      if (error) {
        logger.error('Erro ao excluir agendamento:', error)
        return { success: false, error: 'Erro ao remover agendamento' }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao remover agendamento:', err)
      return { success: false, error: 'Erro inesperado ao remover agendamento' }
    }
  },

  async syncFromEntity(
    organizationId: string,
    params: {
      referenceType: 'quote' | 'service_order' | 'sale'
      referenceId: string
      forwardToSchedule: boolean
      appointmentDate: string
      startTime?: string
      customerName?: string
      customerPhone?: string
      customerId?: string
      title: string
      description?: string
      assignedTo?: string
      operatorName?: string
      userId?: string
    },
  ): Promise<ServiceResult<Appointment | null>> {
    try {
      const existingRes = await this.getByReference(
        organizationId,
        params.referenceType,
        params.referenceId,
      )
      const existing = existingRes.success ? existingRes.data : null

      if (!params.forwardToSchedule) {
        // Se foi desmarcado mas já existia, podemos remover ou manter cancelado
        if (existing) {
          await this.delete(organizationId, existing.id)
        }
        return { success: true, data: null }
      }

      if (existing) {
        // Atualiza existente
        return await this.update(organizationId, existing.id, {
          title: params.title,
          appointmentDate: params.appointmentDate,
          startTime: params.startTime || null,
          customerName: params.customerName,
          customerPhone: params.customerPhone,
          customerId: params.customerId,
          description: params.description,
          assignedTo: params.assignedTo,
        })
      }

      // Cria novo
      return await this.create(organizationId, {
        title: params.title,
        appointmentDate: params.appointmentDate,
        startTime: params.startTime || null,
        customerId: params.customerId,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        type:
          params.referenceType === 'quote'
            ? 'quote'
            : params.referenceType === 'service_order'
              ? 'service_order'
              : 'sale',
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        description: params.description,
        assignedTo: params.assignedTo,
        creatorName: params.operatorName,
        createdBy: params.userId,
      })
    } catch (err) {
      logger.error('Exceção em syncFromEntity:', err)
      return { success: false, error: 'Erro ao sincronizar agendamento' }
    }
  },
}
