interface ReportPrintHeaderProps {
  organizationName?: string
  organizationLogoUrl?: string | null
  reportTitle: string
  reportSubtitle?: string
  reportType?: string
  moduleTitle?: string
  totalRecords: number
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
  reportType,
  moduleTitle: _moduleTitle,
  totalRecords,
  totalAmountLabel,
  totalAmountValue,
  emissionWeekday,
  emissionDate,
  emissionTime,
  periodLabel,
  periodRange,
}: ReportPrintHeaderProps) {
  return (
    <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img
            src={organizationLogoUrl || '/controlesoft-logo.png'}
            alt="Logo da Empresa"
            className="h-14 max-h-16 max-w-[180px] object-contain"
          />
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">
              {organizationName || 'ControleSoft Gestão Empresarial'}
            </h2>
            <p className="text-xs font-semibold text-slate-600">
              {reportSubtitle} • {reportTitle}
            </p>
          </div>
        </div>

        <div className="text-right text-[11px] text-slate-700 leading-tight space-y-0.5 border-l border-slate-300 pl-4">
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

      <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
        {reportType ? (
          <div className="font-bold text-slate-800 bg-slate-50 px-2.5 py-1 rounded border border-slate-300">
            <span className="text-slate-500 font-semibold uppercase mr-1">Tipo do Relatório:</span>
            <span className="text-slate-900 font-black uppercase">{reportType}</span>
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-4 font-semibold text-slate-700">
          {totalAmountLabel && totalAmountValue && (
            <span>
              {totalAmountLabel}: <span className="font-bold text-slate-900">{totalAmountValue}</span>
            </span>
          )}
          <span>
            Total de Registros: <span className="font-bold text-slate-900">{totalRecords}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
