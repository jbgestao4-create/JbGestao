import { useState, useRef, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  Users,
  Package,
  Truck,
  ShoppingCart,
  Layers,
  ArrowRight,
  Info,
  ShieldCheck,
  LayoutDashboard
} from 'lucide-react'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { ImportEngineService } from '../services/import-engine.service'
import { TemplateGeneratorService } from '../services/template-generator.service'
import type {
  ImportModule,
  ImportOptions,
  ImportSummary
} from '../types/import.types'

interface MigrationCardOption {
  id: ImportModule
  title: string
  subtitle: string
  description: string
  icon: typeof Users
  badgeColor: string
  iconBg: string
  iconColor: string
}

const MIGRATION_OPTIONS: MigrationCardOption[] = [
  {
    id: 'customers',
    title: 'Clientes',
    subtitle: 'Pessoa Física e Jurídica',
    description: 'Importe nomes, CPF/CNPJ, telefones e e-mails com busca automática de endereço via CEP.',
    icon: Users,
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400'
  },
  {
    id: 'inventory',
    title: 'Estoque & Produtos',
    subtitle: 'Produtos e Materiais',
    description: 'Importe itens com nome, preços e saldo. O Código Interno é gerado automaticamente pelo sistema.',
    icon: Package,
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    iconBg: 'bg-amber-50 dark:bg-amber-950/40',
    iconColor: 'text-amber-600 dark:text-amber-400'
  },
  {
    id: 'suppliers',
    title: 'Fornecedores',
    subtitle: 'Parceiros e Distribuidores',
    description: 'Cadastre em massa a carteira de fornecedores, CNPJ, contatos responsáveis e dados de entrega.',
    icon: Truck,
    badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300',
    iconBg: 'bg-orange-50 dark:bg-orange-950/40',
    iconColor: 'text-orange-600 dark:text-orange-400'
  },
  {
    id: 'sales',
    title: 'Vendas & Pedidos',
    subtitle: 'Histórico de Faturamento',
    description: 'Importe pedidos de venda com múltiplos itens, produtos, clientes e formas de pagamento.',
    icon: ShoppingCart,
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
    iconBg: 'bg-blue-50 dark:bg-blue-950/40',
    iconColor: 'text-blue-600 dark:text-blue-400'
  },
  {
    id: 'budgets',
    title: 'Orçamentos',
    subtitle: 'Propostas Comerciais',
    description: 'Carregue propostas e cotações com prazos de validade, descontos e itens orçados.',
    icon: FileSpreadsheet,
    badgeColor: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300',
    iconBg: 'bg-violet-50 dark:bg-violet-950/40',
    iconColor: 'text-violet-600 dark:text-violet-400'
  }
]

export function MigrationHubPage() {
  const { currentOrganization } = useOrganization()
  const [selectedModule, setSelectedModule] = useState<ImportModule>('inventory')
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)

  const [options, setOptions] = useState<ImportOptions>({
    onDuplicate: 'upsert',
    autoCreateSupplierIfMissing: true,
    atomic: false
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentOption = MIGRATION_OPTIONS.find((opt) => opt.id === selectedModule) || MIGRATION_OPTIONS[0]

  const handleSelectModule = (modId: ImportModule) => {
    setSelectedModule(modId)
    setFile(null)
    setSummary(null)
    setGeneralError(null)
    setProgress(0)
  }

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
    if (!file || !currentOrganization) return
    setIsProcessing(true)
    setProgress(5)
    setGeneralError(null)

    try {
      const { rows } = await ImportEngineService.parseSpreadsheet(file)

      let result: ImportSummary

      switch (selectedModule) {
        case 'customers':
          result = await ImportEngineService.importCustomers(
            rows,
            currentOrganization.id,
            options,
            (p) => setProgress(p)
          )
          break

        case 'suppliers':
          result = await ImportEngineService.importSuppliers(
            rows,
            currentOrganization.id,
            options,
            (p) => setProgress(p)
          )
          break

        case 'inventory':
          result = await ImportEngineService.importInventory(
            rows,
            currentOrganization.id,
            options,
            (p) => setProgress(p)
          )
          break

        case 'sales':
          result = await ImportEngineService.importSales(
            rows,
            currentOrganization.id,
            options,
            (p) => setProgress(p)
          )
          break

        case 'budgets':
          result = await ImportEngineService.importBudgets(
            rows,
            currentOrganization.id,
            options,
            (p) => setProgress(p)
          )
          break

        default:
          throw new Error(`Módulo "${selectedModule}" não implementado.`)
      }

      setSummary(result)
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
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              MOD-11
            </span>
            <span className="text-xs text-slate-500 font-medium">Controle de Acesso Centralizado</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileSpreadsheet className="w-7 h-7 text-emerald-600" />
            Central de Migração de Dados
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Importe e sincronize cadastros em massa via planilhas Excel (.xlsx) e CSV com validação automática.
          </p>
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-xs w-fit"
        >
          <LayoutDashboard className="w-4 h-4 text-slate-500" />
          Voltar ao Início
        </Link>
      </div>

      {/* 1. Escolha da Entidade de Migração */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            1. Selecione o que você deseja migrar:
          </h2>
          <span className="text-xs text-slate-500">Escolha uma categoria abaixo</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {MIGRATION_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const isSelected = selectedModule === opt.id

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectModule(opt.id)}
                className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between gap-3 relative overflow-hidden ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20 ring-2 ring-emerald-500/30 shadow-md'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className={`p-2.5 rounded-xl ${opt.iconBg} ${opt.iconColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {isSelected && (
                    <span className="flex h-2 w-2 rounded-full bg-emerald-600 ring-4 ring-emerald-100 dark:ring-emerald-900" />
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {opt.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                    {opt.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Área de Trabalho e Processamento da Entidade Selecionada */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Banner do Módulo Ativo & Download do Modelo */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 bg-gradient-to-r from-emerald-50/70 via-slate-50 to-slate-50 dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl ${currentOption.iconBg} ${currentOption.iconColor}`}>
              <currentOption.icon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Migração de {currentOption.title}
                </h3>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${currentOption.badgeColor}`}>
                  {currentOption.subtitle}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Utilize o modelo padrão para garantir que os dados sejam validados sem inconsistências.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => TemplateGeneratorService.downloadTemplate(selectedModule)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 rounded-xl hover:bg-emerald-50 dark:hover:bg-slate-700 transition shadow-xs whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Baixar Template Oficial (.xlsx)
          </button>
        </div>

        {/* Mensagem de Erro Geral */}
        {generalError && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-start gap-3">
            <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
            <div className="text-sm text-rose-800 dark:text-rose-200">
              <span className="font-semibold">Erro no arquivo:</span> {generalError}
            </div>
          </div>
        )}

        {!summary ? (
          <>
            {/* Regras e Parâmetros de Importação */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/40 dark:bg-slate-800/20 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Regras de Validação & Sincronização
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Tratamento de Registros Duplicados:
                  </label>
                  <select
                    value={options.onDuplicate}
                    onChange={(e) =>
                      setOptions({ ...options, onDuplicate: e.target.value as any })
                    }
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-xs"
                  >
                    <option value="upsert">Atualizar cadastro existente (Upsert automático)</option>
                    <option value="reject">Rejeitar linha e manter o cadastro atual do sistema</option>
                  </select>
                </div>

                {selectedModule === 'inventory' && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="hubAutoSupplier"
                        checked={options.autoCreateSupplierIfMissing}
                        onChange={(e) =>
                          setOptions({ ...options, autoCreateSupplierIfMissing: e.target.checked })
                        }
                        className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                      />
                      <label htmlFor="hubAutoSupplier" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer font-medium">
                        Cadastrar Fornecedor automaticamente se não constar no banco
                      </label>
                    </div>

                    <div className="flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300 font-medium bg-amber-50/70 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200/70 dark:border-amber-900/40">
                      <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>O <strong>Código Interno</strong> não precisa estar na planilha: o sistema gera e acrescenta a numeração sequencial automaticamente.</span>
                    </div>
                  </div>
                )}

                {selectedModule === 'customers' && (
                  <div className="flex items-center gap-2.5 pt-2 sm:pt-4 text-xs text-emerald-800 dark:text-emerald-300 font-medium bg-emerald-50/70 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40">
                    <Info className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>Ao preencher a coluna <strong>CEP</strong>, o logradouro, bairro, cidade e UF são preenchidos automaticamente pela API integrada.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Zona de Drop & Upload */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3.5 ${
                file
                  ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-slate-50/60 dark:bg-slate-800/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && validateAndSetFile(e.target.files[0])}
              />

              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center shadow-xs">
                <UploadCloud className="w-7 h-7" />
              </div>

              {file ? (
                <div>
                  <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {(file.size / 1024).toFixed(1)} KB &bull; Pronto para validação (clique para escolher outro)
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Arraste o arquivo aqui ou <span className="text-emerald-600 font-bold underline">procure no seu dispositivo</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Suporta arquivos nos formatos <strong>.XLSX</strong>, <strong>.XLS</strong> ou <strong>.CSV</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Barra de Progresso */}
            {isProcessing && (
              <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 font-semibold">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    Validando e persistindo registros em lotes no banco de dados...
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Botão de Ação */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={!file || isProcessing}
                onClick={handleProcessImport}
                className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl text-sm font-bold text-white shadow-md transition ${
                  !file || isProcessing
                    ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed text-slate-500'
                    : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processando Migração...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Processar e Iniciar Migração
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          /* Painel de Resumo Pós-Processamento */
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Cards Estatísticos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                <span className="text-xs font-semibold text-slate-500">Total de Linhas</span>
                <div className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                  {summary.totalRows}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Migrados com Sucesso</span>
                <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  {summary.successCount}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center">
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">Recusados / Erros</span>
                <div className="text-2xl font-extrabold text-rose-700 dark:text-rose-300 mt-1 flex items-center justify-center gap-1.5">
                  <XCircle className="w-5 h-5 text-rose-600" />
                  {summary.errorCount}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-center">
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Auto-Criados</span>
                <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 mt-1 flex items-center justify-center gap-1.5">
                  <Layers className="w-5 h-5 text-blue-600" />
                  {summary.autoCreatedDependenciesCount}
                </div>
              </div>
            </div>

            {/* Ação de Download das Falhas */}
            {summary.errorCount > 0 && (
              <div className="p-5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-xs text-amber-900 dark:text-amber-200">
                  <p className="font-bold text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    {summary.errorCount} linha(s) continham inconsistências e foram rejeitadas.
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 mt-1">
                    Baixe o arquivo corrigível com as falhas anotadas, corrija as células no Excel e reenvie apenas o que faltou.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    TemplateGeneratorService.exportErrorsSpreadsheet(summary.rejectedRowsData, selectedModule)
                  }
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-amber-950 bg-amber-200 hover:bg-amber-300 rounded-xl transition shadow-xs whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  Baixar Planilha de Erros (.xlsx)
                </button>
              </div>
            )}

            {/* Tabela de Detalhamento Linha a Linha */}
            {summary.errors.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <div className="bg-slate-100 dark:bg-slate-800 px-5 py-3 text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between items-center">
                  <span>Relatório Detalhado das Falhas ({summary.errors.length})</span>
                  <span className="text-[11px] font-normal text-slate-500">Exibindo primeiras 100 inconsistências</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3 font-bold text-slate-600 dark:text-slate-400">Linha</th>
                        <th className="p-3 font-bold text-slate-600 dark:text-slate-400">Identificador</th>
                        <th className="p-3 font-bold text-slate-600 dark:text-slate-400">Campo</th>
                        <th className="p-3 font-bold text-slate-600 dark:text-slate-400">Motivo da Recusa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {summary.errors.slice(0, 100).map((err, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono text-rose-600 font-bold">{err.rowNumber}</td>
                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{err.recordIdentifier}</td>
                          <td className="p-3 font-mono text-slate-500">{err.field}</td>
                          <td className="p-3 text-rose-600 dark:text-rose-400">{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Ações pós-importação */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
              >
                <RefreshCw className="w-4 h-4" />
                Importar Outra Planilha
              </button>

              <Link
                to="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 transition shadow-xs"
              >
                Concluir Migração
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Dica de Segurança e Governança */}
      <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-900 dark:text-blue-300">
          <p className="font-semibold">Controle de Acesso Centralizado (MOD-11):</p>
          <p className="mt-0.5 text-blue-700 dark:text-blue-400">
            O acesso a este módulo pode ser concedido ou revogado a qualquer usuário na aba <strong>Configurações &rarr; Membros da Organização</strong>. Os botões de importação em massa foram concentrados aqui para garantir integridade e auditoria de dados.
          </p>
        </div>
      </div>
    </div>
  )
}
