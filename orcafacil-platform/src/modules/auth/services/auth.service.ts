import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UserProfile, UUID } from '@shared/types/common'
import type { Session, User } from '@supabase/supabase-js'

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
        return { success: false, error: 'E-mail ou senha incorretos.' }
      }

      if (!data.user || !data.session) {
        return { success: false, error: 'Sessão inválida após autenticação.' }
      }

      return { success: true, data: { user: data.user, session: data.session } }
    } catch (err) {
      logger.error('Erro inesperado no login', err)
      return { success: false, error: 'Ocorreu um erro inesperado ao realizar login.' }
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
        email: '',
        createdAt: data.created_at,
      }
    } catch {
      return null
    }
  },

  /**
   * Inscreve ouvinte de alterações no estado de autenticação.
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback)
  },
}
