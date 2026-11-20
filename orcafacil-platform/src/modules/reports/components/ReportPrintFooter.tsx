interface ReportPrintFooterProps {
  emissionWeekday?: string
  emissionDate?: string
  emissionTime?: string
  documentType?: string
}

export function ReportPrintFooter(_props: ReportPrintFooterProps) {
  // Conforme solicitação do usuário: rodapé com visto/assinatura removido na impressão
  // para permitir aproveitamento máximo da folha como planilha Excel.
  return null
}
