import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult } from '@shared/types/common'
import { validatePasswordStrength } from '@shared/utils/password-validator'

export interface RequestEmailResetResult {
  email: string
  maskedEmail: string
}

export function maskEmail(email: string): string {
  const parts = email.split('@')
  if (parts.length !== 2) return email
  const [user, domain] = parts
  if (user.length <= 2) {
    return `${user[0] || '*'}***@${domain}`
  }
  const visibleStart = user.slice(0, 2)
  const visibleEnd = user.slice(-1)
  return `${visibleStart}***${visibleEnd}@${domain}`
}

export const emailPasswordResetService = {
  /**
   * Solicita o envio do código de recuperação para o e-mail cadastrado
   */
  async requestResetCode(email: string): Promise<ServiceResult<RequestEmailResetResult>> {
    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Informe um endereço de e-mail válido.' }
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail)

      if (error) {
        logger.warn('Aviso ao solicitar redefinição por e-mail:', {
          code: error.status,
          message: error.message,
        })

        if (error.message?.includes('rate_limit') || error.status === 429) {
          return {
            success: false,
            error: 'Muitas solicitações recentes. Por segurança, aguarde 60 segundos antes de tentar novamente.',
          }
        }

        return {
          success: false,
          error: error.message || 'Falha ao enviar código para o e-mail informado.',
        }
      }

      return {
        success: true,
        data: {
          email: cleanEmail,
          maskedEmail: maskEmail(cleanEmail),
        },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao solicitar código.'
      logger.error('Exceção ao solicitar código por e-mail:', { error: String(err) })
      return { success: false, error: msg }
    }
  },

  /**
   * Valida o código recebido no e-mail do funcionário
   */
  async verifyResetCode(email: string, code: string): Promise<ServiceResult<boolean>> {
    const cleanEmail = email.trim().toLowerCase()
    const cleanCode = code.trim().replace(/\s/g, '')

    if (!cleanCode) {
      return { success: false, error: 'Digite o código de verificação recebido no seu e-mail.' }
    }

    try {
      // 1. Tenta validar via OTP recovery (padrão de recuperação de senha do Supabase)
      let { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'recovery',
      })

      // 2. Se falhar, tenta como OTP de e-mail
      if (error) {
        const emailAttempt = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanCode,
          type: 'email',
        })
        if (!emailAttempt.error && emailAttempt.data.session) {
          data = emailAttempt.data
          error = null
        }
      }

      if (error) {
        logger.warn('Erro ao validar código OTP de e-mail:', { error: error.message })
        if (error.message?.includes('expired') || error.status === 403) {
          return {
            success: false,
            error: 'O código informado expirou ou é inválido. Solicite um novo código.',
          }
        }
        return {
          success: false,
          error: 'Código inválido. Verifique os dígitos recebidos em seu e-mail e tente novamente.',
        }
      }

      if (!data?.session && !data?.user) {
        return {
          success: false,
          error: 'Não foi possível autenticar a sessão do código. Tente novamente.',
        }
      }

      return { success: true, data: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao validar código.'
      logger.error('Exceção ao verificar código de e-mail:', { error: String(err) })
      return { success: false, error: msg }
    }
  },

  /**
   * Conclui a redefinição salvando a nova senha após validação de força
   */
  async completePasswordReset(newPassword: string): Promise<ServiceResult<string>> {
    const validation = validatePasswordStrength(newPassword)
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors[0] || 'A nova senha não atende aos requisitos mínimos de segurança.',
      }
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        logger.error('Erro ao atualizar senha no Supabase Auth:', { error: error.message })
        return {
          success: false,
          error: error.message || 'Falha ao salvar a nova senha.',
        }
      }

      // Encerra a sessão temporária para que o usuário efetue login limpo com a nova senha
      try {
        await supabase.auth.signOut()
      } catch {
        // ignore
      }

      return {
        success: true,
        data: 'Senha redefinida com sucesso! Você já pode acessar o sistema com sua nova senha.',
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar senha.'
      logger.error('Exceção ao redefinir senha:', { error: String(err) })
      return { success: false, error: msg }
    }
  },
}
