import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import { isSystemOwner } from '@shared/utils/system-owner'
import type { ServiceResult, UUID } from '@shared/types/common'
import type {
  FeedbackAttachment,
  FeedbackHistory,
  FeedbackInternalNote,
  FeedbackMessage,
  FeedbackSuggestion,
  SuggestionStatus,
  SuggestionType,
} from '../types/suggestion.types'
import { validateSuggestionImage } from '../utils/suggestion.utils'

const ATTACHMENTS_BUCKET = 'feedback-attachments'

export interface SubmitSuggestionInput {
  organizationId: UUID
  type: SuggestionType
  title: string
  description: string
  additionalInfo: string
  moduleOrigin: string
  originRoute: string
  attachment?: File
}

export interface SuggestionDetails {
  attachments: FeedbackAttachment[]
  history: FeedbackHistory[]
  notes: FeedbackInternalNote[]
  messages: FeedbackMessage[]
}

export interface FeedbackAttachmentWithUrl extends FeedbackAttachment {
  url: string
}

export const suggestionService = {
  async isOrganizationOwner(organizationId: UUID, userId: UUID, userEmail?: string | null): Promise<boolean> {
    if (userEmail && isSystemOwner(userEmail)) {
      return true
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && isSystemOwner(user)) {
        return true
      }

      const { data, error } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        logger.error('Falha ao verificar proprietário da organização para sugestões', error)
        return false
      }
      return data?.role === 'owner'
    } catch (error) {
      logger.error('Erro ao verificar proprietário da organização para sugestões', error)
      return false
    }
  },

  async submit(input: SubmitSuggestionInput): Promise<ServiceResult<{ id: UUID; warning?: string }>> {
    if (input.attachment) {
      const imageError = validateSuggestionImage(input.attachment)
      if (imageError) return { success: false, error: imageError }
    }

    try {
      const suggestionId = crypto.randomUUID()
      const { error } = await supabase
        .from('feedback_suggestions')
        .insert({
          id: suggestionId,
          organization_id: input.organizationId,
          type: input.type,
          title: input.title.trim(),
          description: input.description.trim(),
          additional_info: input.additionalInfo.trim() || null,
          module_origin: input.moduleOrigin.slice(0, 120),
          origin_route: input.originRoute.slice(0, 500),
        })

      if (error) {
        logger.error('Falha ao registrar sugestão', error)
        return { success: false, error: 'Não foi possível registrar sua sugestão. Tente novamente.' }
      }

      if (!input.attachment) return { success: true, data: { id: suggestionId } }

      const storagePath = `${input.organizationId}/${suggestionId}/${crypto.randomUUID()}`
      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(storagePath, input.attachment, {
          contentType: input.attachment.type,
          upsert: false,
        })

      if (uploadError) {
        logger.error('Sugestão registrada, mas falha ao enviar imagem', uploadError)
        return {
          success: true,
          data: { id: suggestionId, warning: 'A sugestão foi registrada, mas a imagem não foi enviada.' },
        }
      }

      const { error: attachmentError } = await supabase.from('feedback_attachments').insert({
        organization_id: input.organizationId,
        suggestion_id: suggestionId,
        storage_path: storagePath,
        original_name: input.attachment.name.slice(0, 255),
        mime_type: input.attachment.type,
        size_bytes: input.attachment.size,
      })

      if (attachmentError) {
        logger.error('Sugestão registrada, mas falha ao salvar metadados da imagem', attachmentError)
        return {
          success: true,
          data: { id: suggestionId, warning: 'A sugestão foi registrada, mas a imagem não foi vinculada.' },
        }
      }

      return { success: true, data: { id: suggestionId } }
    } catch (error) {
      logger.error('Erro inesperado ao registrar sugestão', error)
      return { success: false, error: 'Ocorreu um erro ao enviar sua sugestão.' }
    }
  },

  async list(organizationId: UUID): Promise<ServiceResult<FeedbackSuggestion[]>> {
    try {
      const suggestions: FeedbackSuggestion[] = []
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from('feedback_suggestions')
          .select('*')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .range(offset, offset + 999)
        if (error) {
          logger.error('Falha ao listar sugestões da organização', error)
          return { success: false, error: 'Não foi possível carregar as sugestões.' }
        }
        suggestions.push(...(data as FeedbackSuggestion[]))
        if (data.length < 1000) break
      }
      return { success: true, data: suggestions }
    } catch (error) {
      logger.error('Erro inesperado ao listar sugestões', error)
      return { success: false, error: 'Ocorreu um erro ao carregar as sugestões.' }
    }
  },

  async getUnreadCount(organizationId: UUID): Promise<ServiceResult<number>> {
    try {
      const result = await supabase.rpc('get_unread_feedback_suggestion_count', {
        p_organization_id: organizationId,
      })
      if (result.error) {
        logger.error('Falha ao consultar sugestões não visualizadas', result.error)
        return { success: false, error: 'Não foi possível consultar novas sugestões.' }
      }
      return { success: true, data: Number(result.data) }
    } catch (error) {
      logger.error('Erro ao consultar sugestões não visualizadas', error)
      return { success: false, error: 'Não foi possível consultar novas sugestões.' }
    }
  },

  async markAsRead(
    organizationId: UUID,
    suggestionId: UUID,
  ): Promise<ServiceResult<number>> {
    try {
      const result = await supabase.rpc('mark_feedback_suggestion_read', {
        p_organization_id: organizationId,
        p_suggestion_id: suggestionId,
      })
      if (result.error) {
        logger.error('Falha ao marcar sugestão como visualizada', result.error)
        return { success: false, error: 'Não foi possível atualizar a contagem de novas sugestões.' }
      }
      return { success: true, data: Number(result.data) }
    } catch (error) {
      logger.error('Erro ao marcar sugestão como visualizada', error)
      return { success: false, error: 'Não foi possível atualizar a contagem de novas sugestões.' }
    }
  },

  async getDetails(
    organizationId: UUID,
    suggestionId: UUID,
  ): Promise<ServiceResult<SuggestionDetails>> {
    try {
      const [attachmentResult, historyResult, noteResult, messageResult] = await Promise.all([
        supabase
          .from('feedback_attachments')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('suggestion_id', suggestionId)
          .order('created_at', { ascending: true }),
        supabase
          .from('feedback_history')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('suggestion_id', suggestionId)
          .order('created_at', { ascending: true }),
        supabase
          .from('feedback_internal_notes')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('suggestion_id', suggestionId)
          .order('created_at', { ascending: true }),
        supabase
          .from('feedback_messages')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('suggestion_id', suggestionId)
          .order('created_at', { ascending: true }),
      ])

      const error = attachmentResult.error ?? historyResult.error ?? noteResult.error ?? messageResult.error
      if (error) {
        logger.error('Falha ao carregar detalhes da sugestão', error)
        return { success: false, error: 'Não foi possível carregar os detalhes.' }
      }

      return {
        success: true,
        data: {
          attachments: (attachmentResult.data ?? []) as FeedbackAttachment[],
          history: (historyResult.data ?? []) as FeedbackHistory[],
          notes: (noteResult.data ?? []) as FeedbackInternalNote[],
          messages: (messageResult.data ?? []) as FeedbackMessage[],
        },
      }
    } catch (error) {
      logger.error('Erro inesperado ao carregar detalhes da sugestão', error)
      return { success: false, error: 'Ocorreu um erro ao carregar os detalhes.' }
    }
  },

  async getAttachmentUrl(path: string): Promise<ServiceResult<string>> {
    try {
      const { data, error } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .createSignedUrl(path, 300)
      if (error) {
        logger.error('Falha ao gerar link privado do anexo', error)
        return { success: false, error: 'Não foi possível abrir o anexo.' }
      }
      return { success: true, data: data.signedUrl }
    } catch (error) {
      logger.error('Erro inesperado ao gerar link privado do anexo', error)
      return { success: false, error: 'Não foi possível abrir o anexo.' }
    }
  },

  async updateStatus(
    organizationId: UUID,
    suggestionId: UUID,
    status: SuggestionStatus,
  ): Promise<ServiceResult<void>> {
    try {
      const { data, error } = await supabase
        .from('feedback_suggestions')
        .update({ status })
        .eq('organization_id', organizationId)
        .eq('id', suggestionId)
        .select('id')
        .maybeSingle()
      if (error) {
        logger.error('Falha ao atualizar status da sugestão', error)
        return { success: false, error: 'Não foi possível atualizar o status.' }
      }
      if (!data) return { success: false, error: 'Sugestão não encontrada ou sem permissão para alterá-la.' }
      return { success: true, data: undefined }
    } catch (error) {
      logger.error('Erro inesperado ao atualizar status da sugestão', error)
      return { success: false, error: 'Não foi possível atualizar o status.' }
    }
  },

  async addInternalNote(
    organizationId: UUID,
    suggestionId: UUID,
    ownerId: UUID,
    content: string,
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.from('feedback_internal_notes').insert({
        organization_id: organizationId,
        suggestion_id: suggestionId,
        owner_id: ownerId,
        content: content.trim(),
      })
      if (error) {
        logger.error('Falha ao registrar observação interna da sugestão', error)
        return { success: false, error: 'Não foi possível salvar a observação.' }
      }
      return { success: true, data: undefined }
    } catch (error) {
      logger.error('Erro inesperado ao registrar observação interna da sugestão', error)
      return { success: false, error: 'Não foi possível salvar a observação.' }
    }
  },

  async listUserSuggestions(organizationId: UUID): Promise<ServiceResult<FeedbackSuggestion[]>> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return { success: true, data: [] }

      // Lista apenas chamados/sugestões ativas (exclui concluídos)
      const { data, error } = await supabase
        .from('feedback_suggestions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('submitted_by', user.id)
        .neq('status', 'completed')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Falha ao listar chamados do usuário', error)
        return { success: false, error: 'Não foi possível carregar suas solicitações.' }
      }

      // Busca mensagens enviadas pelo proprietário para mapear respostas
      const { data: ownerMsgs } = await supabase
        .from('feedback_messages')
        .select('suggestion_id, read_by_user')
        .eq('organization_id', organizationId)
        .eq('sender_role', 'owner')

      const unreadMap = new Map<string, number>()
      const totalOwnerReplies = new Map<string, number>()

      for (const msg of ownerMsgs || []) {
        totalOwnerReplies.set(msg.suggestion_id, (totalOwnerReplies.get(msg.suggestion_id) || 0) + 1)
        if (!msg.read_by_user) {
          unreadMap.set(msg.suggestion_id, (unreadMap.get(msg.suggestion_id) || 0) + 1)
        }
      }

      const mapped: FeedbackSuggestion[] = (data ?? []).map((row) => ({
        ...row,
        has_unread_reply: (unreadMap.get(row.id) || 0) > 0,
        has_owner_reply: (totalOwnerReplies.get(row.id) || 0) > 0,
        owner_replies_count: totalOwnerReplies.get(row.id) || 0,
      }))

      return { success: true, data: mapped }
    } catch (err) {
      logger.error('Erro inesperado ao listar chamados do usuário', err)
      return { success: false, error: 'Erro ao carregar solicitações.' }
    }
  },

  async listMessages(organizationId: UUID, suggestionId: UUID): Promise<ServiceResult<FeedbackMessage[]>> {
    try {
      const { data, error } = await supabase
        .from('feedback_messages')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('suggestion_id', suggestionId)
        .order('created_at', { ascending: true })

      if (error) {
        logger.error('Falha ao listar mensagens da sugestão', error)
        return { success: false, error: 'Não foi possível carregar as respostas.' }
      }

      return { success: true, data: (data ?? []) as FeedbackMessage[] }
    } catch (err) {
      logger.error('Erro inesperado ao carregar mensagens da sugestão', err)
      return { success: false, error: 'Erro ao carregar respostas.' }
    }
  },

  async sendMessage(
    organizationId: UUID,
    suggestionId: UUID,
    senderName: string,
    message: string,
    senderRole: 'owner' | 'user',
  ): Promise<ServiceResult<FeedbackMessage>> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return { success: false, error: 'Usuário não autenticado' }

      const cleanMsg = message.trim()
      if (!cleanMsg) return { success: false, error: 'A mensagem não pode ser vazia.' }

      const payload = {
        organization_id: organizationId,
        suggestion_id: suggestionId,
        sender_id: user.id,
        sender_name: senderName.trim(),
        sender_role: senderRole,
        message: cleanMsg,
        read_by_user: senderRole === 'user',
        read_by_owner: senderRole === 'owner',
      }

      const { data, error } = await supabase
        .from('feedback_messages')
        .insert(payload)
        .select('*')
        .single()

      if (error) {
        logger.error('Falha ao enviar resposta de sugestão', error)
        return { success: false, error: 'Não foi possível enviar a resposta.' }
      }

      return { success: true, data: data as FeedbackMessage }
    } catch (err) {
      logger.error('Erro inesperado ao enviar resposta de sugestão', err)
      return { success: false, error: 'Erro ao enviar resposta.' }
    }
  },

  async getUnreadUserCount(organizationId: UUID): Promise<ServiceResult<number>> {
    try {
      const { data, error } = await supabase.rpc('get_unread_user_feedback_count', {
        p_organization_id: organizationId,
      })

      if (error) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return { success: true, data: 0 }

        const { count, error: countErr } = await supabase
          .from('feedback_messages')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('sender_role', 'owner')
          .eq('read_by_user', false)

        if (countErr) {
          return { success: true, data: 0 }
        }
        return { success: true, data: count || 0 }
      }

      return { success: true, data: Number(data || 0) }
    } catch {
      return { success: true, data: 0 }
    }
  },

  async markMessagesReadByUser(organizationId: UUID, suggestionId: UUID): Promise<ServiceResult<void>> {
    try {
      // Atualização direta das mensagens do proprietário para lidas pelo usuário
      try {
        await supabase
          .from('feedback_messages')
          .update({ read_by_user: true })
          .eq('suggestion_id', suggestionId)
          .eq('sender_role', 'owner')
      } catch {
        // ignora se houver política RLS restritiva
      }

      await supabase.rpc('mark_feedback_messages_read_by_user', {
        p_organization_id: organizationId,
        p_suggestion_id: suggestionId,
      })
      return { success: true, data: undefined }
    } catch {
      return { success: true, data: undefined }
    }
  },
}
