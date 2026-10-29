import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { supplierService } from '../services/supplier.service'
import type { Supplier } from '@shared/types/common'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { ConfirmActionDialog } from '@shared/components/ConfirmActionDialog'
import {
  ArrowLeft,
  Building2,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import type { ServiceResult } from '@shared/types/common'

function getSupplierInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toLocaleUpperCase()
}

function formatDocument(document: string | null) {
  const digits = document?.replace(/\D/g, '') ?? ''
  if (digits.length !== 14) return document || 'Não informado'
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function formatRegistrationDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value))
}

export function SuppliersListPage() {
  const { currentOrganization } = useOrganization()
  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadedOrganizationId, setLoadedOrganizationId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loadError, setLoadError] = useState('')
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null)

  const loadSuppliers = async () => {
    if (!currentOrganization) {
      setSuppliers([])
      setLoadedOrganizationId(null)
      return
    }

    setLoadError('')
    const result = await supplierService.list(currentOrganization.id)
    if (result.success) {
      setSuppliers(result.data)
      setLoadedOrganizationId(currentOrganization.id)
    } else {
      setLoadError(result.error)
      setLoadedOrganizationId(currentOrganization.id)
    }
  }

  useEffect(() => {
    if (!currentOrganization) return
    let isActive = true
    void supplierService.list(currentOrganization.id).then(
      (result) => {
        if (!isActive) return
        if (result.success) {
          setSuppliers(result.data)
          setLoadError('')
        } else {
          setLoadError(result.error)
        }
        setLoadedOrganizationId(currentOrganization.id)
      },
      () => {
        if (!isActive) return
        setLoadError('Erro inesperado ao consultar fornecedores.')
        setLoadedOrganizationId(currentOrganization.id)
      },
    )
    return () => {
      isActive = false
    }
  }, [currentOrganization])

  const handleDelete = async (): Promise<ServiceResult<void>> => {
    if (!currentOrganization || !supplierToDelete) {
      return { success: false, error: 'Não foi possível identificar o fornecedor.' }
    }
    const result = await supplierService.delete(currentOrganization.id, supplierToDelete.id)
    if (result.success) {
      setSupplierToDelete(null)
      await loadSuppliers()
    }
    return result
  }

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase()
  const visibleSuppliers = loadedOrganizationId === currentOrganization?.id ? suppliers : []
  const isLoading = !!currentOrganization && loadedOrganizationId !== currentOrganization.id
  const filteredSuppliers = visibleSuppliers.filter((supplier) =>
    [supplier.name, supplier.document, supplier.contactName, supplier.email]
      .filter(Boolean)
      .some((value) => value?.toLocaleLowerCase().includes(normalizedSearch)),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => {
              void navigate('/orcafacil/suppliers')
            }}
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Consultar Fornecedor</h1>
          <p className="mt-1 text-sm text-gray-500">
            Pesquise para consultar os dados e abrir a ficha com as notas recebidas de cada
            fornecedor.
          </p>
        </div>
        <Button
          onClick={() => {
            void navigate('/orcafacil/suppliers/new')
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Cadastrar fornecedor
        </Button>
      </div>

      <Card className="rounded-xl border-blue-200 shadow-sm ring-1 ring-blue-100">
        <CardContent className="p-3 sm:p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <Input
              aria-label="Pesquisar fornecedor pelo nome"
              placeholder="Digite o nome do fornecedor para consultar..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
              }}
              className="h-12 border-blue-300 pl-11 pr-12 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-gray-100 p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800"
                aria-label="Limpar pesquisa"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium text-gray-700" aria-live="polite">
          {normalizedSearch
            ? `Exibindo ${String(filteredSuppliers.length)} de ${String(visibleSuppliers.length)} fornecedor(es) cadastrados`
            : `Exibindo todos os ${String(visibleSuppliers.length)} fornecedor(es) cadastrados`}
        </p>
        <p className="text-gray-500">Visualização em tempo real</p>
      </div>

      {!currentOrganization ? (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-8 text-center text-sm text-gray-500">
            Selecione uma organização para consultar os fornecedores.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-8 text-center text-sm text-gray-500">
            Carregando fornecedores...
          </CardContent>
        </Card>
      ) : loadError ? (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-8 text-center text-sm text-red-700">{loadError}</CardContent>
        </Card>
      ) : visibleSuppliers.length === 0 ? (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <Truck className="mb-3 h-9 w-9 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-600">Ainda não há fornecedores cadastrados.</p>
            <Button
              size="sm"
              className="mt-4"
              onClick={() => {
                void navigate('/orcafacil/suppliers/new')
              }}
            >
              Cadastrar o primeiro fornecedor
            </Button>
          </CardContent>
        </Card>
      ) : filteredSuppliers.length === 0 ? (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-8 text-center text-sm text-gray-500">
            Nenhum fornecedor encontrado para “{searchTerm}”.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredSuppliers.map((supplier) => (
            <Card key={supplier.id} className="rounded-xl shadow-sm">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                      {getSupplierInitials(supplier.name) || <Building2 aria-hidden="true" />}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-bold text-gray-900">
                        {supplier.name}
                      </h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        void navigate(`/orcafacil/suppliers/${supplier.id}/edit`)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-blue-700"
                      aria-label={`Abrir ficha de ${supplier.name}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Ficha e notas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSupplierToDelete(supplier)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                      aria-label={`Excluir ${supplier.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Excluir
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Pessoa Jurídica · CNPJ
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {formatDocument(supplier.document)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Telefone / WhatsApp
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {supplier.phone || 'Não informado'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Contato
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {supplier.contactName || 'Não informado'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Endereço completo
                    </p>
                    <p className="mt-1 break-words text-sm font-semibold text-gray-900">
                      {supplier.address || 'Não informado'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      E-mail
                    </p>
                    <p className="mt-1 break-words text-sm font-semibold text-gray-900">
                      {supplier.email || 'Não informado'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Data de cadastro
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {formatRegistrationDate(supplier.createdAt)}
                    </p>
                  </div>
                  {supplier.notes && (
                    <div className="min-w-0 sm:col-span-2 xl:col-span-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Observações
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">
                        {supplier.notes}
                      </p>
                    </div>
                  )}
                  <p className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 sm:col-span-2 xl:col-span-3">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    Anexe e consulte as notas fiscais na ficha deste fornecedor.
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmActionDialog
        open={supplierToDelete !== null}
        title="Excluir fornecedor?"
        description={`Tem certeza de que deseja excluir ${supplierToDelete?.name ?? 'este fornecedor'}?`}
        confirmLabel="Sim, excluir"
        onCancel={() => {
          setSupplierToDelete(null)
        }}
        onConfirm={handleDelete}
      />
    </div>
  )
}
