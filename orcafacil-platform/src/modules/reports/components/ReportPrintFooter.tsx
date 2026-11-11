interface ReportPrintFooterProps {
  emissionWeekday: string
  emissionDate: string
  emissionTime: string
  documentType?: string
}

export function ReportPrintFooter({
  emissionWeekday,
  emissionDate,
  emissionTime,
  documentType = 'Documento Oficial de Auditoria & Gestão',
}: ReportPrintFooterProps) {
  return (
    <div className="hidden print:flex items-center justify-between border-t-2 border-slate-900 pt-4 mt-8 text-xs text-slate-600">
      <div>
        <span className="font-bold">ControleSoft Gestão Empresarial</span> • {documentType}
        <div className="text-[10px] text-slate-500">
          Emitido em {emissionDate} às {emissionTime} ({emissionWeekday})
        </div>
      </div>
      <div className="border-t border-slate-500 pt-1 w-64 text-center text-slate-700 text-[11px] font-semibold">
        Visto / Assinatura do Responsável
      </div>
    </div>
  )
}
