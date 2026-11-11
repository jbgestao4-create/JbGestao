import { ReactNode } from 'react'
import { ArrowLeft, FileCode, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react'
import { Button } from '@shared/components/ui/Button'

interface ReportActionBarProps {
  title: string
  badgeText: string
  badgeColorClass?: string
  description: string
  onBack: () => void
  onExportExcel: () => void
  onExportXml: () => void
  onPrint: () => void
  onRefresh?: () => void
  isRefreshing?: boolean
  disableExport?: boolean
  extraActions?: ReactNode
}

export function ReportActionBar({
  title,
  badgeText,
  badgeColorClass = 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300',
  description,
  onBack,
  onExportExcel,
  onExportXml,
  onPrint,
  onRefresh,
  isRefreshing = false,
  disableExport = false,
  extraActions,
}: ReportActionBarProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-900 dark:hover:text-white shadow-xs transition-colors shrink-0"
          title="Voltar para a Central"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {title}
            </h1>
            <span className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${badgeColorClass}`}>
              {badgeText}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {extraActions}

        <Button
          variant="outline"
          size="sm"
          onClick={onExportExcel}
          disabled={disableExport}
          className="rounded-xl flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
          title="Exportar planilha compatível com Microsoft Excel"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          <span>Gerar Excel</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onExportXml}
          disabled={disableExport}
          className="rounded-xl flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-amber-300 dark:border-amber-800"
          title="Exportar arquivo estruturado em XML"
        >
          <FileCode className="h-4 w-4 text-amber-600" />
          <span>Gerar XML</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onPrint}
          className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
          title="Imprimir relatório formatado"
        >
          <Printer className="h-4 w-4" />
          <span>Imprimir</span>
        </Button>

        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
            title="Atualizar dados do relatório"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
        )}
      </div>
    </div>
  )
}
