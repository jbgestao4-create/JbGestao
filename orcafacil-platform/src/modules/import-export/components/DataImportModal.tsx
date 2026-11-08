import { useState, useRef, type DragEvent } from 'react'
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  X,
  Layers,
  ArrowRight
} from 'lucide-react'
import { ImportEngineService } from '../services/import-engine.service'
import { TemplateGeneratorService } from '../services/template-generator.service'
import type {
  ImportModule,
  ImportOptions,
  ImportSummary
} from '../types/import.types'

interface DataImportModalProps {
  isOpen: boolean
  onClose: () => void
  module: ImportModule
  moduleTitle: string
  organizationId: string
  onImportComplete?: () => void
}

export function DataImportModal({
  isOpen,
  onClose,
  module,
  moduleTitle,
  organizationId,
  onImportComplete
}: DataImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)

  // Configurações avançadas do usuário
  const [options, setOptions] = useState<ImportOptions>({
    onDuplicate: 'upsert',
    autoCreateSupplierIfMissing: true,
    atomic: false
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  const validateAndSetFile = (selectedFile: File) => {
    setGeneralError(null)
    const validExtensions = ['.xlsx', '.xls', '.csv']
    const isExtensionValid = validExtensions.some((ext) =>
      selectedFile.name.toLowerCase().endsWith(ext)
    )

    if (!isExtensionValid) {
      setGeneralError('Formato inválido! Envie um arquivo Excel (.xlsx, .xls) ou (.csv).')
      return
    }

    setFile(selectedFile)
    setSummary(null)
  }

  const handleProcessImport = async () => {
    if (!file) return
    setIsProcessing(true)
    setProgress(5)
    setGeneralError(null)

    try {
      const { rows } = await ImportEngineService.parseSpreadsheet(file)

      let result: ImportSummary

      switch (module) {
        case 'customers':
          result = await ImportEngineService.importCustomers(
            rows,
            organizationId,
            options,
            (p) => setProgress(p)
          )
          break

        case 'suppliers':
          result = await ImportEngineService.importSuppliers(
            rows,
            organizationId,
            options,
            (p) => setProgress(p)
          )
          break

        case 'inventory':
          result = await ImportEngineService.importInventory(
            rows,
            organizationId,
            options,
            (p) => setProgress(p)
          )
          break

        case 'sales':
          result = await ImportEngineService.importSales(
            rows,
            organizationId,
            options,
            (p) => setProgress(p)
          )
          break

        case 'budgets':
          result = await ImportEngineService.importBudgets(
            rows,
            organizationId,
            options,
            (p) => setProgress(p)
          )
          break

        default:
          throw new Error(`Módulo "${module}" não implementado.`)
      }

      setSummary(result)
      if (onImportComplete && result.successCount > 0) {
        onImportComplete()
      }
    } catch (err: any) {
      setGeneralError(err.message || 'Ocorreu uma falha inesperada ao processar o arquivo.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setSummary(null)
    setGeneralError(null)
    setProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Importação de Planilha: {moduleTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Carga em massa e sincronização de dados via .XLSX ou .CSV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Mensagem de Erro Geral */}
          {generalError && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start gap-3">
              <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-rose-800 dark:text-rose-200">
                <span className="font-semibold">Erro no arquivo:</span> {generalError}
              </div>
            </div>
          )}

          {!summary ? (
            <>
              {/* Card de Download do Template */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gradient-to-r from-emerald-50/60 to-slate-50 dark:from-emerald-950/20 dark:to-slate-800/40 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Precisa da planilha no modelo correto?
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Baixe o arquivo de exemplo com as colunas esperadas e dados preenchidos.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => TemplateGeneratorService.downloadTemplate(module)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 rounded-xl hover:bg-emerald-50 dark:hover:bg-slate-700 transition shadow-sm w-fit"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  Baixar Modelo Oficial (.xlsx)
                </button>
              </div>

              {/* Opções e Regras de Negócio */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/30 dark:bg-slate-800/20 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Regras de Validação & Sincronização
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Registros Duplicados:
                    </label>
                    <select
                      value={options.onDuplicate}
                      onChange={(e) =>
                        setOptions({ ...options, onDuplicate: e.target.value as any })
                      }
                      className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="upsert">Atualizar dados existentes (Upsert)</option>
                      <option value="reject">Rejeitar e manter o registro original</option>
                    </select>
                  </div>

                  {module === 'inventory' && (
                    <div className="flex items-center gap-3 pt-2 sm:pt-6">
                      <input
                        type="checkbox"
                        id="autoSupplier"
                        checked={options.autoCreateSupplierIfMissing}
                        onChange={(e) =>
                          setOptions({ ...options, autoCreateSupplierIfMissing: e.target.checked })
                        }
                        className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                      />
                      <label htmlFor="autoSupplier" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer font-medium">
                        Cadastrar Fornecedor automaticamente se não existir
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Zona de Drop & Upload */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                  file
                    ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                    : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-800/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && validateAndSetFile(e.target.files[0])}
                />

                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
                  <UploadCloud className="w-6 h-6" />
                </div>

                {file ? (
                  <div>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB &bull; Pronto para validação (clique para trocar)
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Arraste e solte o arquivo aqui, ou <span className="text-emerald-600 font-bold underline">procure no seu dispositivo</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Formatos suportados: .XLSX, .XLS ou .CSV
                    </p>
                  </div>
                )}
              </div>

              {/* Barra de Progresso */}
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 font-semibold">
                    <span>Validando e gravando registros em lotes...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Painel de Resumo Pós-Processamento */
            <div className="space-y-6">
              {/* Cards Estatísticos */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-xs font-semibold text-slate-500">Total Lido</span>
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                    {summary.totalRows}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Importados</span>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    {summary.successCount}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center">
                  <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">Com Erros</span>
                  <div className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1 flex items-center justify-center gap-1">
                    <XCircle className="w-5 h-5 text-rose-600" />
                    {summary.errorCount}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-center">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Auto-Criados</span>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1 flex items-center justify-center gap-1">
                    <Layers className="w-5 h-5 text-blue-600" />
                    {summary.autoCreatedDependenciesCount}
                  </div>
                </div>
              </div>

              {/* Botão de Download das Falhas */}
              {summary.errorCount > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-amber-900 dark:text-amber-200">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Algumas linhas foram recusadas e não foram gravadas.
                    </p>
                    <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                      Baixe uma planilha contendo apenas as linhas com falha para corrigir e reimportar.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      TemplateGeneratorService.exportErrorsSpreadsheet(summary.rejectedRowsData, module)
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-xl transition shadow-sm whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    Baixar Apenas Linhas com Falha (.xlsx)
                  </button>
                </div>
              )}

              {/* Tabela de Erros Linha a Linha */}
              {summary.errors.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between items-center">
                    <span>Relatório Detalhado das Falhas ({summary.errors.length})</span>
                    <span className="text-[11px] font-normal text-slate-500">Exibindo primeiras 100 falhas</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="p-2.5 font-bold text-slate-600 dark:text-slate-400">Linha</th>
                          <th className="p-2.5 font-bold text-slate-600 dark:text-slate-400">Identificador</th>
                          <th className="p-2.5 font-bold text-slate-600 dark:text-slate-400">Campo</th>
                          <th className="p-2.5 font-bold text-slate-600 dark:text-slate-400">Motivo da Recusa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                        {summary.errors.slice(0, 100).map((err, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="p-2.5 font-mono text-rose-600 font-bold">{err.rowNumber}</td>
                            <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">{err.recordIdentifier}</td>
                            <td className="p-2.5 font-mono text-slate-500">{err.field}</td>
                            <td className="p-2.5 text-rose-600 dark:text-rose-400">{err.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          {summary ? (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Importar Outro Arquivo
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
            >
              Cancelar
            </button>
          )}

          {summary ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 transition shadow-sm"
            >
              Concluir e Fechar
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!file || isProcessing}
              onClick={handleProcessImport}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition ${
                !file || isProcessing
                  ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed text-slate-500'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processando Dados...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Processar e Importar
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
