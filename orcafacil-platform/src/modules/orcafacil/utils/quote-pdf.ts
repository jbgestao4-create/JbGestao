import { jsPDF } from 'jspdf'
import { formatCurrency } from '@shared/utils/monetary'
import type { QuoteDetail } from '../services/quote.service'

export interface GeneratePdfOptions {
  organizationName?: string
}

/**
 * Gera e realiza o download do arquivo PDF do orçamento.
 */
export function generateQuotePdf(
  quote: QuoteDetail,
  options?: GeneratePdfOptions,
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const orgName = options?.organizationName || 'JB Gestão Comercial'
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentWidth = pageWidth - margin * 2

  let currentY = margin

  // 1. Cabeçalho Principal
  doc.setFillColor(15, 23, 42) // Slate 900
  doc.rect(margin, currentY, contentWidth, 22, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(orgName, margin + 6, currentY + 9)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(203, 213, 225) // Slate 300
  doc.text('ORÇAMENTO / PROPOSTA COMERCIAL', margin + 6, currentY + 16)

  // Número do orçamento no canto direito do cabeçalho
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(`Nº ${quote.quoteNumber}`, pageWidth - margin - 6, currentY + 13, { align: 'right' })

  currentY += 27

  // 2. Informações Gerais (Data / Validade / Status)
  doc.setFillColor(248, 250, 252) // Slate 50
  doc.setDrawColor(226, 232, 240) // Slate 200
  doc.roundedRect(margin, currentY, contentWidth, 16, 2, 2, 'FD')

  doc.setTextColor(71, 85, 105) // Slate 600
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')

  const colWidth = contentWidth / 4
  const dateStr = new Date(quote.createdAt).toLocaleDateString('pt-BR')
  const validStr = quote.validUntil
    ? new Date(quote.validUntil).toLocaleDateString('pt-BR')
    : 'Não informada'

  // Coluna 1: Emissão
  doc.text('DATA DE EMISSÃO', margin + 4, currentY + 6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.text(dateStr, margin + 4, currentY + 11)

  // Coluna 2: Validade
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('VALIDADE DA PROPOSTA', margin + colWidth + 4, currentY + 6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.text(validStr, margin + colWidth + 4, currentY + 11)

  // Coluna 3: Responsável
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('RESPONSÁVEL', margin + colWidth * 2 + 4, currentY + 6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  const creator = quote.creatorName || 'Sistema'
  doc.text(creator.length > 20 ? creator.substring(0, 18) + '...' : creator, margin + colWidth * 2 + 4, currentY + 11)

  // Coluna 4: Situação
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('SITUAÇÃO', margin + colWidth * 3 + 4, currentY + 6)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(37, 99, 235) // Blue 600
  doc.text(quote.status.toUpperCase(), margin + colWidth * 3 + 4, currentY + 11)

  currentY += 21

  // 3. Dados do Cliente
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('DADOS DO CLIENTE', margin + 4, currentY + 6)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(quote.customerName, margin + 4, currentY + 12)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)

  let contactLine = ''
  if (quote.customerPhone) contactLine += `Telefone: ${quote.customerPhone}   `
  if (quote.customerEmail) contactLine += `E-mail: ${quote.customerEmail}   `
  if (!contactLine) contactLine = 'Contato não informado'
  doc.text(contactLine, margin + 4, currentY + 17)

  if (quote.customerAddress) {
    doc.text(`Endereço: ${quote.customerAddress}`, margin + 4, currentY + 21)
  }

  currentY += 29

  // 4. Tabela de Itens
  // Cabeçalho da tabela
  doc.setFillColor(241, 245, 249) // Slate 100
  doc.rect(margin, currentY, contentWidth, 8, 'F')
  doc.setDrawColor(203, 213, 225)
  doc.line(margin, currentY + 8, margin + contentWidth, currentY + 8)

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(51, 65, 85) // Slate 700

  const colItem = margin + 3
  const colDesc = margin + 12
  const colQty = margin + 105
  const colUnit = margin + 122
  const colUnitPrice = margin + 140
  const colItemTotal = pageWidth - margin - 3

  doc.text('#', colItem, currentY + 5.5)
  doc.text('DESCRIÇÃO DO ITEM / PRODUTO', colDesc, currentY + 5.5)
  doc.text('QTD.', colQty, currentY + 5.5)
  doc.text('UNID.', colUnit, currentY + 5.5)
  doc.text('VALOR UNIT.', colUnitPrice, currentY + 5.5)
  doc.text('TOTAL', colItemTotal, currentY + 5.5, { align: 'right' })

  currentY += 8

  // Linhas de itens
  doc.setFont('helvetica', 'normal')
  const items = quote.items

  items.forEach((item, index) => {
    // Checa overflow de página
    if (currentY > pageHeight - 45) {
      doc.addPage()
      currentY = margin
      // Repete cabeçalho da tabela na nova página
      doc.setFillColor(241, 245, 249)
      doc.rect(margin, currentY, contentWidth, 8, 'F')
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(51, 65, 85)
      doc.text('#', colItem, currentY + 5.5)
      doc.text('DESCRIÇÃO DO ITEM / PRODUTO', colDesc, currentY + 5.5)
      doc.text('QTD.', colQty, currentY + 5.5)
      doc.text('UNID.', colUnit, currentY + 5.5)
      doc.text('VALOR UNIT.', colUnitPrice, currentY + 5.5)
      doc.text('TOTAL', colItemTotal, currentY + 5.5, { align: 'right' })
      currentY += 8
      doc.setFont('helvetica', 'normal')
    }

    const rowBg = index % 2 === 0 ? 255 : 250
    doc.setFillColor(rowBg, rowBg, rowBg)
    doc.rect(margin, currentY, contentWidth, 7, 'F')

    doc.setFontSize(8)
    doc.setTextColor(15, 23, 42)

    doc.text(String(index + 1), colItem, currentY + 5)

    const desc = item.description.length > 55
      ? item.description.substring(0, 52) + '...'
      : item.description
    doc.text(desc, colDesc, currentY + 5)

    const qty = Number(item.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
    doc.text(qty, colQty, currentY + 5)

    doc.text(item.unit || 'UN', colUnit, currentY + 5)
    doc.text(formatCurrency(item.unitPrice), colUnitPrice, currentY + 5)
    doc.text(formatCurrency(item.total), colItemTotal, currentY + 5, { align: 'right' })

    currentY += 7
  })

  // Linha delimitadora inferior da tabela
  doc.setDrawColor(203, 213, 225)
  doc.line(margin, currentY, margin + contentWidth, currentY)
  currentY += 4

  // 5. Totalizadores e Observações
  if (currentY > pageHeight - 55) {
    doc.addPage()
    currentY = margin
  }

  const totalsBoxWidth = 75
  const totalsBoxX = pageWidth - margin - totalsBoxWidth

  // Observações (lado esquerdo)
  if (quote.notes?.trim()) {
    const notesWidth = contentWidth - totalsBoxWidth - 6
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(margin, currentY, notesWidth, 28, 2, 2, 'FD')

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 85, 105)
    doc.text('OBSERVAÇÕES E CONDIÇÕES', margin + 3, currentY + 5)

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 65, 85)
    const splitNotes = doc.splitTextToSize(quote.notes.trim(), notesWidth - 6) as string[]
    doc.text(splitNotes.slice(0, 4), margin + 3, currentY + 10)
  }

  // Caixa de Totais (lado direito)
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(totalsBoxX, currentY, totalsBoxWidth, 28, 2, 2, 'FD')

  // Subtotal
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text('Subtotal:', totalsBoxX + 4, currentY + 7)
  doc.text(formatCurrency(quote.subtotal), totalsBoxX + totalsBoxWidth - 4, currentY + 7, { align: 'right' })

  // Desconto (se houver)
  const discountVal = parseFloat(quote.discount)
  if (discountVal > 0) {
    doc.setTextColor(220, 38, 38) // Red 600
    doc.text('Desconto:', totalsBoxX + 4, currentY + 13)
    doc.text(`-${formatCurrency(quote.discount)}`, totalsBoxX + totalsBoxWidth - 4, currentY + 13, { align: 'right' })
  }

  // Linha separadora
  doc.setDrawColor(203, 213, 225)
  doc.line(totalsBoxX + 4, currentY + 16, totalsBoxX + totalsBoxWidth - 4, currentY + 16)

  // Total Geral
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text('VALOR TOTAL:', totalsBoxX + 4, currentY + 23)
  doc.setTextColor(16, 185, 129) // Emerald 500 / Green
  doc.text(formatCurrency(quote.total), totalsBoxX + totalsBoxWidth - 4, currentY + 23, { align: 'right' })

  currentY += 34

  // 6. Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184) // Slate 400
    doc.text(
      `Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')} • ${orgName}`,
      margin,
      pageHeight - 6,
    )
    doc.text(
      `Página ${String(i)} de ${String(pageCount)}`,
      pageWidth - margin,
      pageHeight - 6,
      { align: 'right' },
    )
  }

  return doc
}

/**
 * Faz o download do arquivo PDF no dispositivo do usuário.
 */
export function downloadQuotePdf(
  quote: QuoteDetail,
  options?: GeneratePdfOptions,
): void {
  const doc = generateQuotePdf(quote, options)
  const safeNumber = quote.quoteNumber.replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileName = `Orcamento_${safeNumber}.pdf`
  doc.save(fileName)
}

/**
 * Retorna o arquivo PDF gerado como um Blob binário.
 */
export function createQuotePdfBlob(
  quote: QuoteDetail,
  options?: GeneratePdfOptions,
): Blob {
  const doc = generateQuotePdf(quote, options)
  return doc.output('blob')
}

/**
 * Retorna o arquivo PDF gerado como um objeto File (para uso com a Web Share API).
 */
export function createQuotePdfFile(
  quote: QuoteDetail,
  options?: GeneratePdfOptions,
): File {
  const blob = createQuotePdfBlob(quote, options)
  const safeNumber = quote.quoteNumber.replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileName = `Orcamento_${safeNumber}.pdf`
  return new File([blob], fileName, { type: 'application/pdf' })
}
