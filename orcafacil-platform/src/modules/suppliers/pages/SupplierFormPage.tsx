import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { Button } from '@shared/components/ui/Button'
import { Card, CardContent } from '@shared/components/ui/Card'
import { ConfirmActionDialog } from '@shared/components/ConfirmActionDialog'
import { Input } from '@shared/components/ui/Input'
import { supplierService, type SupplierParams } from '../services/supplier.service'
import { formatPhoneNumber } from '@shared/utils/phone'
import {
  supplierInvoiceService,
  type SupplierInvoice,
  MAX_SUPPLIER_INVOICE_SIZE_BYTES,
} from '../services/supplier-invoice.service'
import type { ServiceResult } from '@shared/types/common'
import { ArrowDownToLine, ArrowLeft, FileText, Paperclip, Trash2, Upload } from 'lucide-react'

const EMPTY_FORM: SupplierParams = {
  name: '',
  document: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
}

const ALLOWED_INVOICE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

function formatDocument(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

function formatFileSize(size: number) {
  return size < 1024 * 1024
    ? `${String(Math.max(1, Math.round(size / 1024)))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function getLocalDateValue() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${String(date.getFullYear())}-${month}-${day}`
}

export function SupplierFormPage() {
  const { currentOrganization } = useOrganization()
  const navigate = useNavigate()
  const { supplierId } = useParams()
  const isEditing = supplierId !== undefined
  const [form, setForm] = useState<SupplierParams>(EMPTY_FORM)
  const [savedForm, setSavedForm] = useState<SupplierParams>(EMPTY_FORM)
  const [isDetailsEditing, setIsDetailsEditing] = useState(!isEditing)
  const [formError, setFormError] = useState('')
  const [loadedSupplierKey, setLoadedSupplierKey] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([])
  const [invoiceListError, setInvoiceListError] = useState('')
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [receivedAt, setReceivedAt] = useState(getLocalDateValue)
  const [invoiceError, setInvoiceError] = useState('')
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<SupplierInvoice | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supplierKey =
    supplierId && currentOrganization ? `${currentOrganization.id}:${supplierId}` : null
  const isLoadingSupplier = supplierKey !== null && loadedSupplierKey !== supplierKey

  const loadInvoices = async () => {
    if (!currentOrganization || !supplierId) return
    setIsLoadingInvoices(true)
    setInvoiceListError('')
    const result = await supplierInvoiceService.list(currentOrganization.id, supplierId)
    if (result.success) {
      setInvoices(result.data)
    } else {
      setInvoiceListError(result.error)
    }
    setIsLoadingInvoices(false)
  }

  useEffect(() => {
    if (!supplierId || !currentOrganization) return

    let isActive = true
    void supplierService.getById(currentOrganization.id, supplierId).then((result) => {
      if (!isActive) return
      if (result.success) {
        const supplierForm = {
          name: result.data.name,
          document: result.data.document ? formatDocument(result.data.document) : '',
          contactName: result.data.contactName ?? '',
          phone: formatPhoneNumber(result.data.phone ?? ''),
          email: result.data.email ?? '',
          address: result.data.address ?? '',
          notes: result.data.notes ?? '',
        }
        setForm(supplierForm)
        setSavedForm(supplierForm)
        setIsDetailsEditing(false)
      } else {
        setFormError(result.error)
      }
      setLoadedSupplierKey(`${currentOrganization.id}:${supplierId}`)
    })

    return () => {
      isActive = false
    }
  }, [supplierId, currentOrganization])

  useEffect(() => {
    if (!supplierKey || loadedSupplierKey !== supplierKey || !currentOrganization || !supplierId)
      return
    let isActive = true
    void supplierInvoiceService.list(currentOrganization.id, supplierId).then(
      (result) => {
        if (!isActive) return
        if (result.success) {
          setInvoices(result.data)
          setInvoiceListError('')
        } else {
          setInvoiceListError(result.error)
        }
        setIsLoadingInvoices(false)
      },
      () => {
        if (!isActive) return
        setInvoiceListError('Erro inesperado ao consultar notas fiscais.')
        setIsLoadingInvoices(false)
      },
    )
    return () => {
      isActive = false
    }
  }, [supplierKey, loadedSupplierKey, currentOrganization, supplierId])

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentOrganization) {
      setFormError('Selecione uma organização antes de salvar o fornecedor.')
      return
    }
    if (isEditing && !isDetailsEditing) return
    if (form.name.trim().length < 2) {
      setFormError('Informe o nome ou a razão social do fornecedor.')
      return
    }
    const documentDigits = form.document.replace(/\D/g, '')
    if (documentDigits && documentDigits.length !== 14) {
      setFormError('Informe o CNPJ com 14 dígitos ou deixe o campo em branco.')
      return
    }

    setIsSaving(true)
    setFormError('')
    const params = { ...form, document: documentDigits }
    const result =
      isEditing && supplierId
        ? await supplierService.update(currentOrganization.id, supplierId, params)
        : await supplierService.create(currentOrganization.id, params)

    if (!result.success) {
      setFormError(result.error)
      setIsSaving(false)
      return
    }

    void navigate('/orcafacil/suppliers/search')
  }

  const handleFileChange = (file: File | undefined) => {
    setInvoiceError('')
    setSelectedFile(file ?? null)
    if (!file) return
    if (!ALLOWED_INVOICE_TYPES.includes(file.type)) {
      setInvoiceError('Anexe uma nota em PDF, JPG ou PNG.')
      setSelectedFile(null)
      return
    }
    if (file.size > MAX_SUPPLIER_INVOICE_SIZE_BYTES) {
      setInvoiceError('O arquivo deve ter no máximo 20 MB.')
      setSelectedFile(null)
    }
  }

  const handleInvoiceUpload = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentOrganization || !supplierId || !selectedFile) {
      setInvoiceError('Selecione um arquivo de nota fiscal para anexar.')
      return
    }
    setIsUploadingInvoice(true)
    setInvoiceError('')
    const result = await supplierInvoiceService.upload(currentOrganization.id, supplierId, {
      file: selectedFile,
      invoiceNumber: invoiceNumber.trim(),
      receivedAt,
    })
    if (!result.success) {
      setInvoiceError(result.error)
      setIsUploadingInvoice(false)
      return
    }
    setSelectedFile(null)
    setInvoiceNumber('')
    setReceivedAt(getLocalDateValue())
    if (fileInputRef.current) fileInputRef.current.value = ''
    await loadInvoices()
    setIsUploadingInvoice(false)
  }

  const handleDownload = async (invoice: SupplierInvoice) => {
    const fileWindow = window.open('about:blank', '_blank')
    if (fileWindow) fileWindow.opener = null
    const result = await supplierInvoiceService.getDownloadUrl(invoice.filePath)
    if (result.success) {
      if (fileWindow) {
        fileWindow.location.href = result.data
      } else {
        setInvoiceError('Permita a abertura de uma nova aba para consultar a nota fiscal.')
      }
    } else {
      fileWindow?.close()
      setInvoiceError(result.error)
    }
  }

  const handleDeleteInvoice = async (): Promise<ServiceResult<void>> => {
    if (!currentOrganization || !invoiceToDelete) {
      return { success: false, error: 'Não foi possível identificar a nota fiscal.' }
    }
    const result = await supplierInvoiceService.delete(currentOrganization.id, invoiceToDelete)
    if (result.success) {
      setInvoiceToDelete(null)
      await loadInvoices()
    }
    return result
  }

  if (isLoadingSupplier) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">Carregando ficha do fornecedor...</div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <button
        type="button"
        onClick={() => {
          void navigate('/orcafacil/suppliers')
        }}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar para fornecedores
      </button>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-6 sm:p-8 lg:p-10">
          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Ficha Cadastral do Fornecedor
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Informe os dados do fornecedor. Na ficha de cada fornecedor você também pode guardar
              as notas fiscais recebidas.
            </p>
          </header>

          {formError && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {formError}
            </div>
          )}

          <form
            onSubmit={(event) => {
              void handleSubmit(event)
            }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
              <Input
                label="Razão Social / Nome do Fornecedor *"
                placeholder="Ex: Distribuidora de Mercadorias Ltda."
                name="supplier-name"
                autoComplete="organization"
                value={form.name}
                disabled={!isDetailsEditing}
                onChange={(event) => {
                  setForm({ ...form, name: event.target.value })
                }}
                required
              />
              <Input
                label="CNPJ"
                placeholder="00.000.000/0000-00"
                name="supplier-document"
                inputMode="numeric"
                autoComplete="off"
                value={form.document}
                disabled={!isDetailsEditing}
                onChange={(event) => {
                  setForm({ ...form, document: formatDocument(event.target.value) })
                }}
                helperText="Opcional. Informe 14 dígitos quando preencher."
              />
              <Input
                label="Nome do contato"
                placeholder="Pessoa responsável pelo atendimento"
                name="supplier-contact"
                autoComplete="name"
                value={form.contactName}
                disabled={!isDetailsEditing}
                onChange={(event) => {
                  setForm({ ...form, contactName: event.target.value })
                }}
              />
              <Input
                label="Telefone / WhatsApp"
                placeholder="(31) 90000-0000"
                name="supplier-phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                disabled={!isDetailsEditing}
                onChange={(event) => {
                  setForm({ ...form, phone: formatPhoneNumber(event.target.value) })
                }}
                inputMode="numeric"
                maxLength={15}
              />
              <Input
                label="E-mail"
                placeholder="contato@fornecedor.com.br"
                name="supplier-email"
                type="email"
                autoComplete="email"
                value={form.email}
                disabled={!isDetailsEditing}
                onChange={(event) => {
                  setForm({ ...form, email: event.target.value })
                }}
              />
              <Input
                label="Endereço"
                placeholder="Rua, número, bairro, cidade e estado"
                name="supplier-address"
                autoComplete="street-address"
                value={form.address}
                disabled={!isDetailsEditing}
                onChange={(event) => {
                  setForm({ ...form, address: event.target.value })
                }}
              />
            </div>
            <label className="block space-y-1.5 text-sm font-medium text-gray-700">
              Observações
              <textarea
                name="supplier-notes"
                value={form.notes}
                disabled={!isDetailsEditing}
                onChange={(event) => {
                  setForm({ ...form, notes: event.target.value })
                }}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <div className="flex flex-col-reverse justify-end gap-3 border-t border-gray-100 pt-5 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void navigate('/orcafacil/suppliers')
                }}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              {isEditing && !isDetailsEditing ? (
                <Button
                  type="button"
                  onClick={() => {
                    setIsDetailsEditing(true)
                  }}
                >
                  Editar
                </Button>
              ) : (
                <>
                  {isEditing && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSaving}
                      onClick={() => {
                        setForm(savedForm)
                        setIsDetailsEditing(false)
                        setFormError('')
                      }}
                    >
                      Cancelar edição
                    </Button>
                  )}
                  <Button type="submit" isLoading={isSaving}>
                    {isEditing ? 'Salvar alterações' : 'Cadastrar fornecedor'}
                  </Button>
                </>
              )}
            </div>
          </form>

          {isEditing && supplierId && (
            <section
              className="mt-10 border-t border-gray-200 pt-8"
              aria-labelledby="invoice-title"
            >
              <header className="mb-5">
                <h2 id="invoice-title" className="text-xl font-bold text-gray-900">
                  Notas fiscais recebidas
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Os arquivos ficam vinculados somente a este fornecedor.
                </p>
              </header>

              {invoiceError && (
                <div
                  role="alert"
                  className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {invoiceError}
                </div>
              )}

              <form
                onSubmit={(event) => {
                  void handleInvoiceUpload(event)
                }}
                className="mb-6 space-y-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4 sm:p-5"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Número da nota (opcional)"
                    name="supplier-invoice-number"
                    value={invoiceNumber}
                    onChange={(event) => {
                      setInvoiceNumber(event.target.value)
                    }}
                  />
                  <Input
                    label="Data de recebimento"
                    name="supplier-invoice-received-at"
                    type="date"
                    value={receivedAt}
                    onChange={(event) => {
                      setReceivedAt(event.target.value)
                    }}
                    required
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor="supplier-invoice-file"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Arquivo da nota fiscal
                    </label>
                    <input
                      ref={fileInputRef}
                      id="supplier-invoice-file"
                      name="supplier-invoice-file"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      onChange={(event) => {
                        handleFileChange(event.target.files?.[0])
                      }}
                      className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      PDF, JPG ou PNG. Tamanho máximo: 20 MB.
                    </p>
                    {selectedFile && (
                      <p className="mt-1 text-xs font-medium text-gray-700">{selectedFile.name}</p>
                    )}
                  </div>
                  <Button type="submit" isLoading={isUploadingInvoice} disabled={!selectedFile}>
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Anexar nota
                  </Button>
                </div>
              </form>

              {invoiceListError ? (
                <p role="alert" className="text-sm text-red-700">
                  {invoiceListError}
                </p>
              ) : isLoadingInvoices ? (
                <p className="py-4 text-center text-sm text-gray-500">
                  Carregando notas fiscais...
                </p>
              ) : invoices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-5 py-8 text-center">
                  <Paperclip className="mx-auto mb-2 h-7 w-7 text-gray-300" aria-hidden="true" />
                  <p className="text-sm text-gray-600">
                    Nenhuma nota fiscal anexada a este fornecedor.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                  {invoices.map((invoice) => (
                    <li
                      key={invoice.id}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="shrink-0 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-800"
                          aria-label={
                            invoice.invoiceNumber
                              ? `Nota fiscal número ${invoice.invoiceNumber}`
                              : 'Nota fiscal sem número informado'
                          }
                        >
                          {invoice.invoiceNumber ? `NF ${invoice.invoiceNumber}` : 'NF sem nº'}
                        </span>
                        <div className="rounded-lg bg-red-50 p-2 text-red-700">
                          <FileText className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {invoice.fileName}
                          </p>
                          <p className="text-xs text-gray-500">
                            Recebida em{' '}
                            {new Intl.DateTimeFormat('pt-BR').format(
                              new Date(`${invoice.receivedAt}T12:00:00`),
                            )}{' '}
                            · {formatFileSize(invoice.fileSize)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void handleDownload(invoice)
                          }}
                        >
                          <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                          Abrir nota
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          aria-label={`Excluir ${invoice.fileName}`}
                          onClick={() => {
                            setInvoiceToDelete(invoice)
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={invoiceToDelete !== null}
        title="Excluir nota fiscal?"
        description={`Tem certeza de que deseja excluir ${invoiceToDelete?.fileName ?? 'esta nota'}?`}
        confirmLabel="Sim, excluir"
        onCancel={() => {
          setInvoiceToDelete(null)
        }}
        onConfirm={handleDeleteInvoice}
      />
    </div>
  )
}
