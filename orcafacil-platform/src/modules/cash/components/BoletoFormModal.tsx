import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import type { Supplier } from '@modules/suppliers/services/supplier.service'
import { Button } from '@shared/components/ui/Button'
import { formatCurrencyInput, parseCurrencyInput } from '@shared/utils/monetary'
import {
  parseBoletoPdf,
  type BoletoCategory,
  type ParsedBoletoData,
} from '../services/boleto-pdf-parser.service'
import {
  BILL_CATEGORIES,
  cashBillsService,
  type CashBillStatus,
} from '../services/cash-bills.service'
import {
  AlertCircle,
  Barcode,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileCheck2,
  FileText,
  FileUp,
  Loader2,
  Sparkles,
  Tag,
  Truck,
  X,
} from 'lucide-react'

interface BoletoFormModalProps {
  open?: boolean
  isOpen?: boolean
  onClose: () => void
  onSuccess?: () => void
  onSaved?: () => Promise<void> | void
  suppliers?: Supplier[]
  initialFile?: File | null
}

export function BoletoFormModal({
  open,
  isOpen,
  onClose,
  onSuccess,
  suppliers = [],
  onSaved,
  initialFile = null,
}: BoletoFormModalProps) {
  const { user, profile } = useAuth()
  const { currentOrganization } = useOrganization()

  const [description, setDescription] = useState('')
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [category, setCategory] = useState<BoletoCategory>('Luz')
  const [amountInput, setAmountInput] = useState('')
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [barcode, setBarcode] = useState('')
  const [status, setStatus] = useState<CashBillStatus>('pending')
  const [notes, setNotes] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)

  const [isParsingPdf, setIsParsingPdf] = useState(false)
  const [pdfFeedback, setPdfFeedback] = useState<{
    type: 'success' | 'warning' | 'error'
    title: string
    details: string
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const resetForm = () => {
    setDescription('')
    setBeneficiaryName('')
    setSupplierId('')
    setCategory('Luz')
    setAmountInput('')
    setDueDate(new Date().toISOString().slice(0, 10))
    setBarcode('')
    setStatus('pending')
    setNotes('')
    setAttachmentFile(null)
    setIsParsingPdf(false)
    setPdfFeedback(null)
    setIsSubmitting(false)
    setFormError(null)
  }

  const applyParsedBoleto = (parsed: ParsedBoletoData, file: File) => {
    setAttachmentFile(file)
    if (parsed.formattedBarcode || parsed.barcode) {
      setBarcode(parsed.formattedBarcode || parsed.barcode)
    }
    if (parsed.beneficiaryName) {
      setBeneficiaryName(parsed.beneficiaryName)
    }
    if (parsed.suggestedCategory) {
      setCategory(parsed.suggestedCategory)
    }
    if (parsed.suggestedDescription) {
      setDescription(parsed.suggestedDescription)
    }
    if (parsed.amount > 0) {
      setAmountInput(parsed.formattedAmount)
    }
    if (parsed.dueDate) {
      setDueDate(parsed.dueDate)
    }

    // Tenta vincular automaticamente ao fornecedor cadastrado pelo CNPJ ou Nome
    if (suppliers.length > 0) {
      const cleanParsedDoc = parsed.beneficiaryDocument?.replace(/\D/g, '') || ''
      const cleanBenName = parsed.beneficiaryName.toLowerCase()
      const matchedSupplier = suppliers.find((s) => {
        const sDoc = s.document?.replace(/\D/g, '') || ''
        if (cleanParsedDoc && sDoc && sDoc === cleanParsedDoc) return true
        if (cleanBenName && cleanBenName.length >= 3 && s.name.toLowerCase().includes(cleanBenName)) {
          return true
        }
        return false
      })
      if (matchedSupplier) {
        setSupplierId(matchedSupplier.id)
      }
    }

    if (parsed.warnings.length > 0) {
      setPdfFeedback({
        type: 'warning',
        title: 'Leitura parcial do PDF concluída',
        details: parsed.warnings.join(' '),
      })
    } else {
      setPdfFeedback({
        type: 'success',
        title: 'Leitura Automática do PDF concluída com sucesso!',
        details: `Extraídos: Beneficiário (${parsed.beneficiaryName}), Valor (R$ ${parsed.formattedAmount}), Vencimento e Linha Digitável. Confira os dados antes de salvar.`,
      })
    }
  }

  const handleFileUpload = async (file: File) => {
    setFormError(null)
    setPdfFeedback(null)

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setPdfFeedback({
        type: 'error',
        title: 'Formato de arquivo inválido',
        details: 'Envie apenas arquivos em formato PDF (.pdf) para leitura automática do boleto.',
      })
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      setPdfFeedback({
        type: 'error',
        title: 'Arquivo muito grande',
        details: 'O anexo em PDF do boleto deve ter no máximo 20 MB.',
      })
      return
    }

    setIsParsingPdf(true)
    setAttachmentFile(file)

    try {
      const buffer = await file.arrayBuffer()
      const parsed = await parseBoletoPdf(new Uint8Array(buffer), file.name)
      applyParsedBoleto(parsed, file)
    } catch (err) {
      setPdfFeedback({
        type: 'error',
        title: 'Falha na leitura automática do PDF',
        details:
          err instanceof Error
            ? err.message
            : 'Não foi possível extrair os dados do PDF automaticamente. O arquivo foi anexado e você pode preencher os campos manualmente.',
      })
    } finally {
      setIsParsingPdf(false)
    }
  }

  useEffect(() => {
    if (open && initialFile) {
      void handleFileUpload(initialFile)
    } else if (!open) {
      resetForm()
    }
  }, [open, initialFile])

  const isModalOpen = open ?? isOpen;
  if (!isModalOpen) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentOrganization) return

    setFormError(null)
    const cleanAmount = parseCurrencyInput(amountInput)
    const numericAmount = parseFloat(cleanAmount)

    if (!description.trim()) {
      setFormError('Informe a descrição do boleto (ex: Conta de Luz - Cemig).')
      return
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError('Informe um valor válido maior que zero para o boleto.')
      return
    }
    if (!dueDate) {
      setFormError('Informe a data de vencimento do boleto.')
      return
    }

    setIsSubmitting(true)
    const selectedSupplier = suppliers.find((s) => s.id === supplierId)
    const creatorName = profile?.displayName || user?.email?.split('@')[0] || 'Operador'

    const res = await cashBillsService.createBill(currentOrganization.id, {
      description: description.trim(),
      beneficiaryName: beneficiaryName.trim() || selectedSupplier?.name || null,
      supplierId: supplierId || null,
      supplierName: selectedSupplier?.name || null,
      category,
      amount: cleanAmount,
      dueDate,
      barcode: barcode.trim() || null,
      status,
      attachmentFile,
      notes: notes.trim() || null,
      creatorName,
      userId: user?.id || null,
    })

    setIsSubmitting(false)

    if (res.success) {
      resetForm()
      if (onSuccess) { onSuccess(); }
    if (onSaved) { void onSaved(); }
      onClose()
    } else {
      setFormError(res.error)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-400">
              <FileUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                Cadastrar Boleto / Conta a Pagar
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Importe o PDF para preenchimento automático ou cadastre manualmente (Água, Luz, Internet, Fornecedores)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo com scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Área de Importação Inteligente de PDF */}
          <div className="rounded-2xl border-2 border-dashed border-cyan-300 dark:border-cyan-800/70 bg-cyan-50/40 dark:bg-cyan-950/20 p-4 transition hover:border-cyan-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-cyan-600 p-2.5 text-white shrink-0 mt-0.5">
                  {isParsingPdf ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : attachmentFile ? (
                    <FileCheck2 className="h-5 w-5" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-cyan-900 dark:text-cyan-300">
                    Importação Inteligente de Boleto (PDF)
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">
                    {attachmentFile
                      ? `Arquivo anexado: ${attachmentFile.name}`
                      : 'Faça upload do PDF do boleto para extrair automaticamente Linha Digitável, Valor, Vencimento e Beneficiário/Concessionária.'}
                  </p>
                </div>
              </div>

              <label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition">
                <FileUp className="h-4 w-4" />
                <span>{attachmentFile ? 'Trocar PDF' : 'Selecionar Boleto PDF'}</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleFileUpload(file)
                  }}
                />
              </label>
            </div>

            {pdfFeedback && (
              <div
                className={`mt-3 rounded-xl p-3 text-xs border flex items-start gap-2.5 ${
                  pdfFeedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                    : pdfFeedback.type === 'warning'
                      ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
                      : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                }`}
              >
                {pdfFeedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                )}
                <div>
                  <p className="font-bold">{pdfFeedback.title}</p>
                  <p className="mt-0.5 opacity-90">{pdfFeedback.details}</p>
                </div>
              </div>
            )}
          </div>

          {formError && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* Linha Digitável / Código de Barras */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
              Código de Barras / Linha Digitável
            </label>
            <div className="relative">
              <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Ex: 34191.79001 01043.510047 91020.150008 8 16200000025000"
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs font-mono text-gray-900 dark:text-white focus:border-cyan-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Descrição e Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Descrição da Conta / Boleto <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Conta de Luz - Cemig, Conta de Água - Copasa..."
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs font-semibold text-gray-900 dark:text-white focus:border-cyan-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Categoria <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as BoletoCategory)}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs font-semibold text-gray-900 dark:text-white focus:border-cyan-500 focus:outline-hidden"
                >
                  {BILL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Beneficiário / Concessionária e Fornecedor Vinculado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Beneficiário / Concessionária
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={beneficiaryName}
                  onChange={(e) => setBeneficiaryName(e.target.value)}
                  placeholder="Ex: Cemig Distribuição S.A, Sabesp, Vivo..."
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-gray-900 dark:text-white focus:border-cyan-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Fornecedor Vinculado (Opcional)
              </label>
              <div className="relative">
                <Truck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-gray-900 dark:text-white focus:border-cyan-500 focus:outline-hidden"
                >
                  <option value="">Nenhum fornecedor específico</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} {sup.document ? `(${sup.document})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Valor, Data de Vencimento e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Valor (R$) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
                <input
                  type="text"
                  required
                  value={amountInput}
                  onChange={(e) => setAmountInput(formatCurrencyInput(e.target.value))}
                  placeholder="0,00"
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm font-bold font-mono text-gray-900 dark:text-white focus:border-cyan-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Data de Vencimento <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs font-semibold text-gray-900 dark:text-white focus:border-cyan-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Status Inicial
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CashBillStatus)}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-gray-900 dark:text-white focus:border-cyan-500 focus:outline-hidden"
              >
                <option value="pending">Pendente (A Pagar)</option>
                <option value="paid">Pago</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
              Observações (Opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais sobre o documento, número de referência ou instalação..."
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-gray-900 dark:text-white focus:border-cyan-500 focus:outline-hidden"
            />
          </div>

          {/* Rodapé */}
          <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              className="rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              Salvar Boleto / Conta
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

