import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UserProfile, UUID } from '@shared/types/common'
import type { Session, User } from '@supabase/supabase-js'
import { registerSystemOwnerEmail } from '@shared/utils/system-owner'

const PROFILE_AVATARS_BUCKET = 'profile-avatars'
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const AUTH_CONNECTION_ERROR =
  'Não foi possível conectar ao serviço de autenticação. Verifique a URL do Supabase e sua conexão com a internet.'

function getSignInErrorMessage(error: Pick<Error, 'name' | 'message'>): string {
  if (error.name === 'AuthRetryableFetchError') {
    return AUTH_CONNECTION_ERROR
  }

  if (error.message.toLowerCase().includes('invalid api key')) {
    return 'A configuração do Supabase está inválida. Confira a URL do projeto e a chave pública nas variáveis de ambiente.'
  }

  return 'E-mail ou senha incorretos.'
}

export interface SignUpParams {
  email: string
  password: string
  displayName: string
}

export interface SignInParams {
  email: string
  password: string
}

export const authService = {
  /**
   * Realiza o cadastro de um novo usuário.
   */
  async signUp({
    email,
    password,
    displayName,
  }: SignUpParams): Promise<ServiceResult<{ user: User | null; session: Session | null }>> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      })

      if (error) {
        logger.warn('Falha no cadastro de usuário', { error: error.message })
        return {
          success: false,
          error: 'Não foi possível concluir o cadastro. Verifique os dados informados.',
        }
      }

      return { success: true, data: { user: data.user, session: data.session } }
    } catch (err) {
      logger.error('Erro inesperado no cadastro', err)
      return { success: false, error: 'Ocorreu um erro interno ao processar seu cadastro.' }
    }
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        logger.warn('Não foi possível atualizar os dados do usuário autenticado', {
          message: error.message,
        })
        return null
      }
      return data.user
    } catch (err) {
      logger.error('Erro ao atualizar os dados do usuário autenticado', err)
      return null
    }
  },

  /**
   * Realiza login com e-mail e senha.
   * Mensagens genéricas para evitar enumeração de contas.
   */
  async signIn({
    email,
    password,
  }: SignInParams): Promise<ServiceResult<{ user: User; session: Session }>> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        logger.warn('Falha no login', { message: error.message })
        return { success: false, error: getSignInErrorMessage(error) }
      }

      if (!data.user || !data.session) {
        return { success: false, error: 'Sessão inválida após autenticação.' }
      }

      return { success: true, data: { user: data.user, session: data.session } }
    } catch (err) {
      logger.error('Erro inesperado no login', err)
      if (err instanceof TypeError) {
        return { success: false, error: AUTH_CONNECTION_ERROR }
      }
      return { success: false, error: 'Ocorreu um erro inesperado ao realizar login.' }
    }
  },

  async completeForcedPasswordChange(newPassword: string): Promise<ServiceResult<void>> {
    if (newPassword.length < 8) {
      return { success: false, error: 'A senha deve ter pelo menos 8 caracteres.' }
    }
    if (newPassword === '12345678') {
      return {
        success: false,
        error: 'A nova senha não pode ser igual à senha temporária 12345678.',
      }
    }

    try {
      const { error } = await supabase.rpc('complete_forced_password_change', {
        p_new_password: newPassword,
      })

      if (error) {
        logger.error('Erro ao concluir a troca obrigatória de senha', error)
        return { success: false, error: 'Não foi possível atualizar a senha.' }
      }

      const { error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) {
        logger.error('Senha alterada, mas não foi possível atualizar a sessão', refreshError)
        return {
          success: false,
          error: 'A senha foi alterada, mas não foi possível atualizar a sessão. Entre novamente.',
        }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Erro ao concluir a troca obrigatória de senha', err)
      return { success: false, error: 'Erro interno ao atualizar a senha.' }
    }
  },

  /**
   * Encerra a sessão atual.
   */
  async signOut(): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        return { success: false, error: 'Erro ao encerrar a sessão.' }
      }
      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Erro no logout', err)
      return { success: false, error: 'Erro ao encerrar a sessão.' }
    }
  },

  /**
   * Solicita e-mail de recuperação de senha.
   */
  async requestPasswordReset(email: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        logger.warn('Erro na recuperação de senha', { message: error.message })
      }
      // Sempre retorna sucesso para não expor se o e-mail existe
      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Erro na solicitação de reset de senha', err)
      return { success: true, data: undefined }
    }
  },

  /**
   * Atualiza a senha do usuário autenticado.
   */
  async updatePassword(newPassword: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        return { success: false, error: 'Não foi possível atualizar a senha.' }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Erro na atualização de senha', err)
      return { success: false, error: 'Erro interno ao atualizar a senha.' }
    }
  },

  /**
   * Salva a foto do perfil do usuário autenticado.
   */
  async updateAvatar(userId: UUID, file: File): Promise<ServiceResult<void>> {
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      return { success: false, error: 'Escolha uma imagem JPG, PNG ou WEBP.' }
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      return { success: false, error: 'A imagem deve ter no máximo 5 MB.' }
    }

    try {
      const avatarPath = `${userId}/avatar`
      const { error: uploadError } = await supabase.storage
        .from(PROFILE_AVATARS_BUCKET)
        .upload(avatarPath, file, {
          cacheControl: '0',
          contentType: file.type,
          upsert: true,
        })

      if (uploadError) {
        logger.warn('Falha ao enviar foto do perfil', {
          message: uploadError.message,
          statusCode: uploadError.statusCode,
        })

        const message = uploadError.message.toLowerCase()
        if (message.includes('bucket not found')) {
          return {
            success: false,
            error:
              'O armazenamento de fotos ainda não foi configurado. Aplique a migração 00006_profile_avatars.sql no Supabase.',
          }
        }

        if (
          message.includes('row-level security') ||
          message.includes('permission denied') ||
          message.includes('unauthorized')
        ) {
          return {
            success: false,
            error:
              'O Supabase bloqueou o envio por falta de permissão. Confira se a migração 00006_profile_avatars.sql foi aplicada e tente novamente.',
          }
        }

        if (message.includes('mime type') || message.includes('content-type')) {
          return {
            success: false,
            error: 'Formato de imagem não permitido. Escolha um arquivo JPG, PNG ou WEBP.',
          }
        }

        if (message.includes('exceeded the maximum allowed size') || message.includes('too large')) {
          return { success: false, error: 'A imagem excede o limite de 5 MB.' }
        }

        return {
          success: false,
          error: `Não foi possível enviar a foto: ${uploadError.message}`,
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_path: avatarPath })
        .eq('id', userId)
        .select('id')
        .maybeSingle()

      if (error || !data) {
        logger.error('Falha ao salvar foto no perfil', error ?? 'Perfil não encontrado')
        return { success: false, error: 'Não foi possível salvar a foto no perfil.' }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Erro inesperado ao atualizar foto do perfil', err)
      return { success: false, error: 'Ocorreu um erro ao atualizar a foto do perfil.' }
    }
  },

  /**
   * Obtém a sessão atual.
   */
  async getSession(): Promise<Session | null> {
    try {
      const { data } = await supabase.auth.getSession()
      return data.session
    } catch {
      return null
    }
  },

  /**
   * Obtém o perfil do usuário na tabela pública.
   */
  async getProfile(userId: UUID): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error || !data) return null

      return {
        id: data.id,
        displayName: data.display_name,
        avatarUrl: data.avatar_path
          ? `${supabase.storage.from(PROFILE_AVATARS_BUCKET).getPublicUrl(data.avatar_path).data.publicUrl}?v=${encodeURIComponent(data.updated_at)}`
          : null,
        email: data.email || '',
        phone: data.phone ?? null,
        createdAt: data.created_at,
        themeColor: data.theme_color ?? null,
      }
    } catch {
      return null
    }
  },

  /**
   * Atualiza a preferência de cor principal do tema do usuário no banco de dados.
   */
  async updateThemeColor(userId: UUID, themeColor: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ theme_color: themeColor })
        .eq('id', userId)

      if (error) {
        logger.error('Falha ao salvar cor do tema no perfil', error)
        return { success: false, error: 'Não foi possível salvar a cor do sistema no perfil.' }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Erro inesperado ao salvar tema', err)
      return { success: false, error: 'Ocorreu um erro ao salvar o tema.' }
    }
  },

  /**
   * Atualiza as informações básicas da conta (Nome, E-mail e Telefone),
   * preservando automaticamente permissões de superadmin/proprietário e renovando a sessão.
   */
  async updateAccountData(params: {
    userId: UUID
    displayName: string
    email: string
    phone?: string | null
  }): Promise<ServiceResult<{ email: string; displayName: string }>> {
    const cleanName = params.displayName.trim()
    const cleanEmail = params.email.trim().toLowerCase()
    const cleanPhone = params.phone ? params.phone.replace(/\D/g, '') : null

    if (!cleanName) {
      return { success: false, error: 'O nome é obrigatório.' }
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Informe um e-mail válido.' }
    }

    try {
      // 1. Tenta a RPC centralizada de auto-atualização de perfil
      const { data: rpcData, error: rpcError } = await supabase.rpc('self_update_profile', {
        p_name: cleanName,
        p_email: cleanEmail,
        p_phone: cleanPhone,
      })

      if (!rpcError && rpcData && rpcData.success) {
        registerSystemOwnerEmail(cleanEmail)
        await supabase.auth.refreshSession().catch(() => {})
        return {
          success: true,
          data: { email: cleanEmail, displayName: cleanName },
        }
      }

      // 2. Se a RPC não estiver disponível ou falhar, realiza atualização padrão via auth.updateUser e profiles
      const { data: authData, error: authError } = await supabase.auth.updateUser({
        email: cleanEmail,
        data: {
          display_name: cleanName,
          phone: cleanPhone,
        },
      })

      if (authError) {
        logger.error('Erro ao atualizar usuário no auth', authError)
        return { success: false, error: authError.message || 'Não foi possível atualizar o e-mail.' }
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          display_name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', params.userId)

      if (profileError) {
        logger.warn('Erro ao atualizar perfil na tabela profiles', { message: profileError.message })
      }

      registerSystemOwnerEmail(cleanEmail)
      await supabase.auth.refreshSession().catch(() => {})

      return {
        success: true,
        data: {
          email: authData.user?.email || cleanEmail,
          displayName: cleanName,
        },
      }
    } catch (err: any) {
      logger.error('Exceção ao atualizar dados da conta', err)
      return { success: false, error: err?.message || 'Erro inesperado ao atualizar dados da conta.' }
    }
  },

  /**
   * Inscreve ouvinte de alterações no estado de autenticação.
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback)
  },
}
