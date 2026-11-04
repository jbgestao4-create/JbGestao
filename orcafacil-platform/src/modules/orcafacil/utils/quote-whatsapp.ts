import { formatCurrency } from '@shared/utils/monetary'

export interface WhatsAppQuoteData {
  customerName: string
  quoteNumber: string
  createdAt: string
  validUntil: string | null
  subtotal: string
  discount: string
  total: string
  notes?: string | null
}

/**
 * Monta o texto padronizado do orçamento para envio via WhatsApp.
 * Notifica que o orçamento foi concluído e está disponível no PDF enviado (sem descrever a lista de itens em texto).
 * Inclui opcionalmente o link do portal seguro para o cliente consultar todos os seus orçamentos.
 */
export function buildQuoteWhatsAppMessage(
  quote: WhatsAppQuoteData,
  organizationName?: string,
  portalUrl?: string,
): string {
  const dateStr = new Date(quote.createdAt).toLocaleDateString('pt-BR')
  const validStr = quote.validUntil
    ? new Date(quote.validUntil).toLocaleDateString('pt-BR')
    : null

  let msg = `Olá, *${quote.customerName}*!\n\n`
  msg += `Informamos que o seu *Orçamento nº ${quote.quoteNumber}* foi concluído com sucesso e está disponível no PDF enviado.\n\n`
  msg += `📋 *DADOS DO ORÇAMENTO:*\n`
  msg += `• *Número:* #${quote.quoteNumber}\n`
  msg += `• *Data de Emissão:* ${dateStr}\n`
  if (validStr) {
    msg += `• *Validade da Proposta:* ${validStr}\n`
  }
  msg += `• *Valor Total:* *${formatCurrency(quote.total)}*\n\n`
  msg += `📄 O arquivo PDF completo com o detalhamento dos itens, valores unitários e condições comerciais segue em anexo.\n\n`

  if (portalUrl) {
    msg += `🌐 *PORTAL DE ORÇAMENTOS:*\n`
    msg += `Acesse seu orçamento e consulte seu histórico completo pelo link exclusivo:\n`
    msg += `${portalUrl}\n`
    msg += `_(Acesso seguro: confirme seu CPF ao acessar o link)_\n\n`
  }

  if (quote.notes?.trim()) {
    msg += `📝 *Observações:* ${quote.notes.trim()}\n\n`
  }

  msg += `Qualquer dúvida, estamos à inteira disposição!\n`
  msg += `*${organizationName || 'JB Gestão Comercial'}*`

  return msg
}

/**
 * Abre o WhatsApp Web ou App com a mensagem pré-formatada.
 */
export function openQuoteWhatsApp(phone: string, message: string): boolean {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return false
  const formattedPhone = digits.startsWith('55') ? digits : `55${digits}`
  const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}
