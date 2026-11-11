import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import {
  parseNfePdf,
  parseNfeXml,
  type ParsedInvoiceData,
} from '../services/nfe-parser.service'
import {
  findMatchingInventoryItem,
  invoiceImportService,
  type InvoiceImportResult,
} from '../services/invoice-import.service'
import { inventoryService } from '../services/inventory.service'
import type { InventoryItem } from '@shared/types/common'
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  FileText,
  FileUp,
  Loader2,
  Package,
  Percent,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'

interface ImportInvoiceModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function ImportInvoiceModal({ open, onClose, onSuccess }: ImportInvoiceModalProps) {
  const { currentOrganization } = useOrganization()
  const navigate = useNavigate()

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<ParsedInvoiceData | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<InvoiceImportResult | null>(null)
  const [customMargin, setCustomMargin] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  if (!open) return null

  const handleReset = () => {
    setSelectedFile(null)
    setIsParsing(false)
    setParseError(null)
    setParsedData(null)
    setIsImporting(false)
    setImportResult(null)
    setCustomMargin('')
    setIsDragging(false)
  }

  const handleProcessFile = async (file: File) => {
    setSelectedFile(file)
    setIsParsing(true)
    setParseError(null)
    setParsedData(null)
    setCustomMargin('')

    try {
      const isXml = file.name.toLowerCase().endsWith('.xml') || file.type.includes('xml')
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type.includes('pdf')

      if (!isXml && !isPdf) {
        setParseError('Formato inválido. Por favor, envie uma nota em PDF (DANFE) ou XML da NF-e.')
        setIsParsing(false)
        return
      }

      let data: ParsedInvoiceData
      if (isXml) {
        const text = await file.text()
        data = await parseNfeXml(text)
      } else {
        const arrayBuffer = await file.arrayBuffer()
        data = await parseNfePdf(new Uint8Array(arrayBuffer))
      }

      let baseCode = 1
      let existingItems: InventoryItem[] = []
      if (currentOrganization) {
        const [nextCodeRes, existingRes] = await Promise.all([
          inventoryService.getNextCode(currentOrganization.id),
          inventoryService.list(currentOrganization.id),
        ])
        if (nextCodeRes.success) {
          const parsedNext = parseInt(nextCodeRes.data, 10)
          if (!isNaN(parsedNext) && parsedNext > 0) {
            baseCode = parsedNext
          }
        }
        if (existingRes.success) {
          existingItems = existingRes.data
        }
      }

      let nextNewCode = baseCode
      setParsedData({
        ...data,
        items: data.items.map((item) => {
          const matched = findMatchingInventoryItem(item, existingItems)
          if (matched) {
            const existingSalePrice = Number(matched.unitPrice) || 0
            const hasSale = existingSalePrice > 0
            return {
              ...item,
              code: matched.sku || String(baseCode),
              existingItemId: matched.id,
              existingQuantity: Number(matched.quantityOnHand) || 0,
              salePrice: hasSale ? existingSalePrice : item.salePrice,
              isPendingInfo: !hasSale,
              pendingFields: hasSale ? [] : ['Preço de venda'],
            }
          }
          const assignedCode = String(nextNewCode)
          nextNewCode++
          return {
            ...item,
            code: assignedCode,
          }
        }),
      })
    } catch (err) {
      setParseError(
        err instanceof Error
          ? err.message
          : 'Não foi possível ler os dados da nota fiscal. Verifique se o arquivo é válido.',
      )
    } finally {
      setIsParsing(false)
    }
  }

  const handleItemSalePriceChange = (index: number, newPrice: number) => {
    if (!parsedData) return
    const updatedItems = [...parsedData.items]
    const item = updatedItems[index]
    const isCompleted = newPrice > 0
    updatedItems[index] = {
      ...item,
      salePrice: newPrice,
      isPendingInfo: !isCompleted,
      pendingFields: isCompleted ? [] : ['Preço de venda'],
    }
    setParsedData({ ...parsedData, items: updatedItems })
  }

  const handleApplyMarginToAll = (marginPercent: number) => {
    if (!parsedData) return
    const updatedItems = parsedData.items.map((item) => {
      const price = Math.round(item.unitCost * (1 + marginPercent / 100) * 100) / 100
      const isCompleted = price > 0
      return {
        ...item,
        salePrice: price,
        isPendingInfo: !isCompleted,
        pendingFields: isCompleted ? [] : ['Preço de venda'],
      }
    })
    setParsedData({ ...parsedData, items: updatedItems })
  }

  const handleClearAllSalePrices = () => {
    if (!parsedData) return
    setCustomMargin('')
    const updatedItems = parsedData.items.map((item) => ({
      ...item,
      salePrice: 0,
      isPendingInfo: true,
      pendingFields: ['Preço de venda'],
    }))
    setParsedData({ ...parsedData, items: updatedItems })
  }

  const handleExecuteImport = async () => {
    if (!currentOrganization || !parsedData) return
    setIsImporting(true)
    setParseError(null)

    const result = await invoiceImportService.importInvoice(
      currentOrganization.id,
      parsedData,
      selectedFile || undefined,
    )

    setIsImporting(false)

    if (result.success) {
      setImportResult(result.data)
      if (onSuccess) onSuccess()
    } else {
      setParseError(result.error)
    }
  }

  const completedCount = parsedData?.items.filter((i) => !i.isPendingInfo).length ?? 0
  const pendingCount = parsedData?.items.filter((i) => i.isPendingInfo).length ?? 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 sm:p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-gray-100">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/75 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <FileUp className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Importar Nota Fiscal</h2>
              <p className="text-xs text-gray-500">
                Lê emitente, dados da NF-e e cadastra os materiais no estoque automaticamente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {parseError && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <div>
                <p className="font-semibold">Não foi possível processar a nota fiscal</p>
                <p className="mt-0.5 text-xs text-red-700">{parseError}</p>
              </div>
            </div>
          )}

          {/* ESTADO 1: SUCESSO DA IMPORTAÇÃO */}
          {importResult ? (
            <div className="py-6 text-center space-y-5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Nota Fiscal Importada com Sucesso!</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Os dados foram processados e integrados ao sistema.
                </p>
              </div>

              <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-gray-50 p-5 text-left text-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <span className="text-gray-600">Fornecedor:</span>
                  <span className="font-semibold text-gray-900">{importResult.supplierName}</span>
                </div>
                {importResult.isNewSupplier && (
                  <div className="flex items-center gap-2 text-xs text-blue-700 font-medium">
                    <Check className="h-4 w-4" /> Fornecedor novo cadastrado automaticamente
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-blue-700 font-medium">
                  <Check className="h-4 w-4" /> Arquivo da NF-e anexado à ficha do fornecedor
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-gray-600">Total de materiais cadastrados:</span>
                  <span className="font-bold text-gray-900">{importResult.totalItems} produto(s)</span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="rounded-lg bg-green-50 p-3 border border-green-200">
                    <p className="text-xs text-green-700 font-medium">Status Concluído</p>
                    <p className="text-lg font-bold text-green-900">{importResult.completedCount}</p>
                    <p className="text-[11px] text-green-600">Liberados para uso em outros módulos</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3 border border-amber-200">
                    <p className="text-xs text-amber-700 font-medium">Aguardando Informação</p>
                    <p className="text-lg font-bold text-amber-900">{importResult.awaitingCount}</p>
                    <p className="text-[11px] text-amber-600">Bloqueados até definir preço de venda</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    handleReset()
                  }}
                >
                  Importar Outra Nota
                </Button>
                <Button
                  onClick={() => {
                    onClose()
                    void navigate('/orcafacil/inventory/search')
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Ir para Consultar Estoque
                </Button>
              </div>
            </div>
          ) : !parsedData ? (
            /* ESTADO 2: SELEÇÃO E UPLOAD DO ARQUIVO */
            <div className="space-y-6">
              <label
                htmlFor="invoice-file-input"
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!isParsing) setIsDragging(true)
                }}
                onDragEnter={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!isParsing) setIsDragging(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsDragging(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsDragging(false)
                  if (isParsing) return
                  const file = e.dataTransfer?.files?.[0]
                  if (file) void handleProcessFile(file)
                }}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition cursor-pointer ${
                  isParsing
                    ? 'border-blue-400 bg-blue-50/50'
                    : isDragging
                      ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-200'
                      : 'border-gray-300 hover:border-blue-500 hover:bg-gray-50'
                }`}
              >
                <input
                  id="invoice-file-input"
                  type="file"
                  accept=".pdf,.xml,application/pdf,text/xml,application/xml"
                  className="sr-only"
                  disabled={isParsing}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleProcessFile(file)
                  }}
                />
                {isParsing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900">Lendo arquivo da nota fiscal...</p>
                      <p className="text-xs text-blue-600">Extraindo fornecedor, dados fiscais e produtos</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-gray-900">
                        Clique para enviar ou arraste a Nota Fiscal aqui
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Suporta arquivos <strong>PDF (DANFE)</strong> e <strong>XML (NF-e)</strong> até 20MB
                      </p>
                    </div>
                  </div>
                )}
              </label>
            </div>
          ) : (
            /* ESTADO 3: PRÉ-VISUALIZAÇÃO DOS DADOS LIDOS E CONFIGURAÇÃO */
            <div className="space-y-6">
              {/* Card Resumo do Emitente e Nota */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-xl border border-gray-200 bg-gray-50/75 p-4 text-xs">
                <div>
                  <p className="font-semibold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-blue-600" /> Fornecedor (Emitente)
                  </p>
                  <p className="text-sm font-bold text-gray-900">{parsedData.supplier.name}</p>
                  <p className="text-gray-600 mt-0.5">
                    CNPJ: <strong>{parsedData.supplier.document || 'Não informado'}</strong>
                  </p>
                  <p className="text-gray-500 mt-0.5 line-clamp-2">{parsedData.supplier.address}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-purple-600" /> Dados da NF-e
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    NF-e Nº {parsedData.invoiceNumber} · Série {parsedData.series}
                  </p>
                  <p className="text-gray-600 mt-0.5">
                    Emissão: <strong>{parsedData.issuedAt}</strong> · Total: <strong>
                      {parsedData.invoiceTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                  </p>
                  {parsedData.accessKey && (
                    <p className="text-[10px] font-mono text-gray-500 mt-0.5 truncate">
                      Chave: {parsedData.accessKey}
                    </p>
                  )}
                </div>
              </div>

              {/* Barra de Ações Rápidas de Margem e Status */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blue-50/80 p-3.5 border border-blue-200 text-xs">
                <div>
                  <p className="font-bold text-blue-950">
                    {parsedData.items.length} produto(s) identificado(s) na nota
                  </p>
                  <p className="text-blue-700 text-[11px] mt-0.5">
                    Produtos sem preço de venda serão cadastrados como <strong>Aguardando informação</strong> (bloqueados para venda).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-2.5 py-1 shadow-2xs">
                    <Percent className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <label
                      htmlFor="custom-margin-input"
                      className="text-xs font-semibold text-gray-700 whitespace-nowrap"
                    >
                      Margem em todos (%):
                    </label>
                    <input
                      id="custom-margin-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={customMargin}
                      placeholder="Ex: 50"
                      onChange={(e) => {
                        const val = e.target.value
                        setCustomMargin(val)
                        const parsed = parseFloat(val)
                        if (!isNaN(parsed) && parsed >= 0) {
                          handleApplyMarginToAll(parsed)
                        }
                      }}
                      className="w-20 rounded-md border border-gray-300 px-2 py-1 text-right text-xs font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleClearAllSalePrices}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    Deixar pendente
                  </button>
                </div>
              </div>

              {/* Tabela de Produtos */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                <table className="w-full text-left text-xs text-gray-700">
                  <thead className="bg-gray-50 text-[11px] uppercase font-bold text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2.5">ID</th>
                      <th className="px-3 py-2.5">Descrição do Material</th>
                      <th className="px-3 py-2.5">Unid.</th>
                      <th className="px-3 py-2.5 text-right">Qtd</th>
                      <th className="px-3 py-2.5 text-right">Custo (R$)</th>
                      <th className="px-3 py-2.5 text-right w-36">Preço Venda (R$)</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {parsedData.items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50/75 transition">
                        <td className="px-3 py-2 font-mono font-bold text-blue-700">
                          #{item.code || idx + 1}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900 max-w-xs">
                          <div>{item.name}</div>
                          {item.barcode && (
                            <div className="text-[10px] font-mono text-gray-500 mt-0.5">
                              Cód. Barras: {item.barcode}
                            </div>
                          )}
                          {item.existingItemId && (
                            <div className="mt-1 inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                              Já cadastrado • Somará +{item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ao estoque
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 font-bold text-gray-600">{item.unit}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">
                          {item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600 font-mono">
                          {item.unitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.salePrice || ''}
                            placeholder="0,00"
                            onChange={(e) => handleItemSalePriceChange(idx, parseFloat(e.target.value) || 0)}
                            className="w-28 rounded-lg border border-gray-300 px-2.5 py-1 text-right text-xs font-semibold focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          {item.salePrice > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700 border border-green-200">
                              <CheckCircle2 className="h-3 w-3" /> Concluído
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200"
                              title="Falta definir preço de venda"
                            >
                              <AlertCircle className="h-3 w-3" /> Aguardando informação
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Status footer de resumo */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-gray-600">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> {completedCount} produto(s) concluído(s)
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                    <AlertCircle className="h-4 w-4" /> {pendingCount} aguardando informação
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-gray-500 hover:text-gray-800 underline"
                >
                  Trocar arquivo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        {!importResult && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
            <Button variant="outline" onClick={onClose} disabled={isImporting}>
              Cancelar
            </Button>

            {parsedData && (
              <Button
                onClick={() => void handleExecuteImport()}
                disabled={isImporting || parsedData.items.length === 0}
                className="bg-blue-600 hover:bg-blue-700 inline-flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cadastrando no Estoque...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4" />
                    Cadastrar {parsedData.items.length} Material(is) no Estoque
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
