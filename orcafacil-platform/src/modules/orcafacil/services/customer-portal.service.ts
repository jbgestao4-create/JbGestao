import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UUID } from '@shared/types/common'
import type { QuoteStatus } from '@shared/types/database'
import type { QuoteDetailItem } from './quote.service'

export interface CustomerPortalPublicInfo {
  found: boolean
  organizationName: string
  organizationPhone?: string | null
  customerName: string
  customerFirstName: string
  hasDocument: boolean
  maskedDocument?: string | null
  quoteNumber?: string | null
  error?: string
  message?: string
}

export interface PortalQuote {
  id: UUID
  quoteNumber: string
  status: QuoteStatus
  approvedBy?: 'client' | 'user' | string | null
  approvedAt?: string | null
  subtotal: string
  discount: string
  total: string
  validUntil: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  sellerName?: string | null
  items: QuoteDetailItem[]
}

export interface CustomerPortalData {
  customer: {
    id: UUID
    name: string
    email?: string | null
    phone?: string | null
    address?: string | null
    addressNumber?: string | null
  }
  organization: {
    id: UUID
    name: string
    phone?: string | null
    email?: string | null
  }
  highlightedQuoteId?: UUID | null
  quotes: PortalQuote[]
}

export interface GeneratePortalTokenResult {
  token: string
  hasDocument: boolean
}

export const customerPortalService = {
  /**
   * Constrói a URL pública completa do portal para o cliente
   */
  buildPortalUrl(token: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/portal/orcamentos/${token}`
  },

  /**
   * Gera ou recupera um token de acesso seguro ao portal do cliente (requer autenticação do vendedor/membro)
   */
  async generateToken(
    organizationId: UUID,
    customerId: UUID,
    quoteId?: UUID,
  ): Promise<ServiceResult<GeneratePortalTokenResult>> {
    try {
      const { data, error } = await supabase.rpc('generate_customer_portal_token', {
        p_organization_id: organizationId,
        p_customer_id: customerId,
        p_quote_id: quoteId ?? null,
      })

      if (error) {
        logger.error('Erro ao gerar token do portal do cliente', error)
        return { success: false, error: 'Não foi possível gerar o link de acesso do cliente.' }
      }

      if (!data || !data.success) {
        return {
          success: false,
          error: data?.message || 'Falha ao gerar link seguro.',
        }
      }

      return {
        success: true,
        data: {
          token: data.token,
          hasDocument: Boolean(data.has_document),
        },
      }
    } catch (err) {
      logger.error('Exceção ao gerar token do portal', err)
      return { success: false, error: 'Erro inesperado ao gerar link do orçamento.' }
    }
  },

  /**
   * Consulta pública preliminar do token (chamável anonimamente pelo cliente para verificar validade)
   */
  async getPublicInfo(token: string): Promise<ServiceResult<CustomerPortalPublicInfo>> {
    try {
      const { data, error } = await supabase.rpc('get_customer_portal_public_info', {
        p_token: token,
      })

      if (error) {
        logger.error('Erro ao consultar informações do link do portal', error)
        return { success: false, error: 'Não foi possível validar o link do orçamento.' }
      }

      if (!data || !data.found) {
        return {
          success: false,
          error: data?.message || 'Link de orçamento inválido ou expirado.',
        }
      }

      return {
        success: true,
        data: {
          found: true,
          organizationName: data.organization_name,
          organizationPhone: data.organization_phone,
          customerName: data.customer_name,
          customerFirstName: data.customer_first_name,
          hasDocument: Boolean(data.has_document),
          maskedDocument: data.masked_document,
          quoteNumber: data.quote_number,
        },
      }
    } catch (err) {
      logger.error('Exceção ao obter informações do portal', err)
      return { success: false, error: 'Erro ao conectar ao servidor para validar o link.' }
    }
  },

  /**
   * Valida o CPF/CNPJ digitado pelo cliente e desbloqueia todos os orçamentos
   */
  async accessQuotes(token: string, document: string): Promise<ServiceResult<CustomerPortalData>> {
    try {
      const { data, error } = await supabase.rpc('access_customer_portal_quotes', {
        p_token: token,
        p_document: document,
      })

      if (error) {
        logger.error('Erro ao validar acesso ao portal com documento', error)
        return { success: false, error: 'Falha na comunicação com o servidor. Tente novamente.' }
      }

      if (!data || !data.success) {
        return {
          success: false,
          error: data?.message || 'Documento incorreto ou link inválido.',
        }
      }

      return {
        success: true,
        data: {
          customer: data.customer,
          organization: data.organization,
          highlightedQuoteId: data.highlightedQuoteId,
          quotes: data.quotes || [],
        },
      }
    } catch (err) {
      logger.error('Exceção ao acessar orçamentos do portal', err)
      return { success: false, error: 'Erro inesperado ao consultar seus orçamentos.' }
    }
  },

  /**
   * Aprova um orçamento pelo cliente no portal público
   */
  async approveQuote(token: string, quoteId: UUID): Promise<ServiceResult<{ message?: string }>> {
    try {
      const { data, error } = await supabase.rpc('approve_customer_portal_quote', {
        p_token: token,
        p_quote_id: quoteId,
      })

      if (error) {
        logger.error('Erro ao aprovar orçamento no portal do cliente', error)
        if (error.code === '42883' || error.message?.includes('approve_customer_portal_quote')) {
          return {
            success: false,
            error:
              'Função de aprovação não encontrada no banco. Execute a migração 00047_quote_approval_tracking.sql no Supabase.',
          }
        }
        return { success: false, error: 'Não foi possível aprovar o orçamento. Tente novamente.' }
      }

      if (!data || !data.success) {
        return {
          success: false,
          error: data?.message || 'Falha ao aprovar o orçamento.',
        }
      }

      return {
        success: true,
        data: {
          message: data.message,
        },
      }
    } catch (err) {
      logger.error('Exceção ao aprovar orçamento no portal', err)
      return { success: false, error: 'Erro inesperado ao aprovar o orçamento.' }
    }
  },

  /**
   * Recusa um orçamento pelo cliente no portal público
   */
  async rejectQuote(token: string, quoteId: UUID): Promise<ServiceResult<{ message?: string }>> {
    try {
      const { data, error } = await supabase.rpc('reject_customer_portal_quote', {
        p_token: token,
        p_quote_id: quoteId,
      })

      if (error) {
        logger.error('Erro ao recusar orçamento no portal do cliente', error)
        return { success: false, error: 'Não foi possível recusar o orçamento. Tente novamente.' }
      }

      if (!data || !data.success) {
        return {
          success: false,
          error: data?.message || 'Falha ao recusar o orçamento.',
        }
      }

      return {
        success: true,
        data: {
          message: data.message,
        },
      }
    } catch (err) {
      logger.error('Exceção ao recusar orçamento no portal', err)
      return { success: false, error: 'Erro inesperado ao recusar o orçamento.' }
    }
  },
}

