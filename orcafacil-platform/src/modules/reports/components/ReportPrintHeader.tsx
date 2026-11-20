interface ReportPrintHeaderProps {
  organizationName?: string
  organizationLogoUrl?: string | null
  reportTitle: string
  reportSubtitle?: string
  reportType?: string
  moduleTitle?: string
  totalRecords?: number
  totalAmountLabel?: string
  totalAmountValue?: string
  emissionWeekday: string
  emissionDate: string
  emissionTime: string
  periodLabel: string
  periodRange?: string
}

export function ReportPrintHeader({
  organizationName,
  organizationLogoUrl,
  reportTitle,
  reportSubtitle = 'Central de Relatórios • Gestão Empresarial',
  reportType: _reportType,
  moduleTitle: _moduleTitle,
  totalRecords: _totalRecords,
  totalAmountLabel: _totalAmountLabel,
  totalAmountValue: _totalAmountValue,
  emissionWeekday,
  emissionDate,
  emissionTime,
  periodLabel,
  periodRange,
}: ReportPrintHeaderProps) {
  return (
    <div className="hidden print:block border-b-2 border-slate-900 pb-2 mb-2.5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src={organizationLogoUrl || '/controlesoft-logo.png'}
            alt="Logo da Empresa"
            className="h-10 max-h-12 max-w-[140px] object-contain"
          />
          <div>
            <h2 className="text-base font-black uppercase tracking-tight text-slate-900 leading-tight">
              {organizationName || 'ControleSoft Gestão Empresarial'}
            </h2>
            <p className="text-[10px] font-semibold text-slate-600 leading-tight">
              {reportSubtitle} • {reportTitle}
            </p>
          </div>
        </div>

        <div className="text-right text-[9.5px] text-slate-700 leading-tight space-y-0.5 border-l border-slate-300 pl-3">
          <div>
            <span className="font-bold">Dia da Semana:</span> {emissionWeekday}
          </div>
          <div>
            <span className="font-bold">Data de Emissão:</span> {emissionDate}
          </div>
          <div>
            <span className="font-bold">Horário:</span> {emissionTime}
          </div>
          <div>
            <span className="font-bold">Filtro de Período:</span> {periodLabel}
            {periodRange ? ` (${periodRange})` : ''}
          </div>
        </div>
      </div>
    </div>
  )
}
