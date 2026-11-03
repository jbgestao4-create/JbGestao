import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { customerService, type Customer } from '../services/customer.service'
import { formatCustomerDocument } from '../utils/customer-document'
import { formatPostalCode } from '../utils/postal-code'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { ConfirmActionDialog } from '@shared/components/ConfirmActionDialog'
import { ArrowLeft, MessageCircle, Pencil, Plus, Search, Users, X } from 'lucide-react'
import type { ServiceResult } from '@shared/types/common'

function getCustomerInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toLocaleUpperCase()
}

function formatRegistrationDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value))
}

export function CustomersListPage() {
  const { currentOrganization } = useOrganization()
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)

  useEffect(() => {
    let ignore = false

    const fetchCustomers = async () => {
      if (!currentOrganization) {
        setIsLoading(false)
        return
      }

      setLoadError('')
      const result = await customerService.list(currentOrganization.id)
      if (ignore) return

      if (result.success) {
        setCustomers(result.data)
      } else {
        setLoadError(result.error)
      }
      setIsLoading(false)
    }

    void fetchCustomers()

    return () => {
      ignore = true
    }
  }, [currentOrganization])

  const refreshCustomers = async () => {
    if (!currentOrganization) return
    const result = await customerService.list(currentOrganization.id)
    if (result.success) {
      setCustomers(result.data)
    }
  }

  const handleDelete = async (): Promise<ServiceResult<void>> => {
    if (!currentOrganization || !customerToDelete) {
      return { success: false, error: 'Não foi possível identificar o cliente.' }
    }

    const result = await customerService.delete(currentOrganization.id, customerToDelete.id)
    if (result.success) {
      setCustomerToDelete(null)
      await refreshCustomers()
    }
    return result
  }

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase()
  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLocaleLowerCase().includes(normalizedSearch),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => {
              void navigate('/orcafacil/customers')
            }}
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Consultar Cliente</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Digite o nome do cliente desejado. A busca é instantânea e exibe todos os dados
            cadastrados.
          </p>
        </div>
        <Button
          onClick={() => {
            void navigate('/orcafacil/customers/new')
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Cadastrar cliente
        </Button>
      </div>

      <Card className="rounded-xl border-blue-200 dark:border-slate-800 shadow-sm ring-1 ring-blue-100 dark:ring-0">
        <CardContent className="p-3 sm:p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-slate-500"
              aria-hidden="true"
            />
            <Input
              aria-label="Pesquisar cliente pelo nome"
              placeholder="Digite o nome do cliente para consultar..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
              }}
              className="h-12 border-blue-300 dark:border-slate-700 pl-11 pr-12 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-gray-100 dark:bg-slate-800 p-1.5 text-gray-500 dark:text-slate-400 transition-colors hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-white"
                aria-label="Limpar pesquisa"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium text-gray-700 dark:text-slate-300" aria-live="polite">
          {normalizedSearch
            ? `Exibindo ${String(filteredCustomers.length)} de ${String(customers.length)} cliente(s) cadastrados`
            : `Exibindo todos os ${String(customers.length)} cliente(s) cadastrados`}
        </p>
        <p className="text-gray-500 dark:text-slate-400">Visualização em tempo real</p>
      </div>

      {isLoading ? (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-8 text-center text-sm text-gray-500">
            Carregando clientes...
          </CardContent>
        </Card>
      ) : loadError ? (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-8 text-center text-sm text-red-700">{loadError}</CardContent>
        </Card>
      ) : customers.length === 0 ? (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <Users className="mb-3 h-9 w-9 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-600">Ainda não há clientes cadastrados.</p>
            <Button
              size="sm"
              className="mt-4"
              onClick={() => {
                void navigate('/orcafacil/customers/new')
              }}
            >
              Cadastrar o primeiro cliente
            </Button>
          </CardContent>
        </Card>
      ) : filteredCustomers.length === 0 ? (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-8 text-center text-sm text-gray-500">
            Nenhum cliente encontrado para “{searchTerm}”.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCustomers.map((customer) => {
            const phoneDigits = customer.phone?.replace(/\D/g, '')
            const whatsappUrl = phoneDigits
              ? `https://wa.me/${phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`}`
              : null

            return (
              <Card key={customer.id} className="rounded-xl shadow-sm">
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                        {getCustomerInitials(customer.name)}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-bold text-gray-900 dark:text-white">
                          {customer.name}
                        </h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          void navigate(`/orcafacil/customers/${customer.id}/edit`)
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-blue-700 dark:hover:text-blue-400 cursor-pointer"
                        aria-label={`Editar ${customer.name}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerToDelete(customer)
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        aria-label={`Excluir ${customer.name}`}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                        Excluir
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 p-4 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        {customer.personType === 'individual'
                          ? 'Pessoa Física · CPF'
                          : 'Pessoa Jurídica · CNPJ'}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                        {customer.document
                          ? formatCustomerDocument(customer.document, customer.personType)
                          : 'Não informado'}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Telefone / WhatsApp
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {customer.phone || 'Não informado'}
                        </span>
                        {whatsappUrl && (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-transparent px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-400 transition-colors hover:bg-emerald-200 dark:hover:bg-emerald-950/40"
                            aria-label={`Conversar com ${customer.name} pelo WhatsApp`}
                            title={`Conversar com ${customer.name} pelo WhatsApp`}
                          >
                            <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                            <span className="dark:hidden">WhatsApp</span>
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Endereço completo
                      </p>
                      <p className="mt-1 break-words text-sm font-semibold text-gray-900 dark:text-white">
                        {customer.address
                          ? [customer.address, customer.addressNumber].filter(Boolean).join(', ')
                          : 'Não informado'}
                      </p>
                      {customer.postalCode && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                          CEP: {formatPostalCode(customer.postalCode)}
                        </p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Data de cadastro
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                        {formatRegistrationDate(customer.createdAt)}
                      </p>
                    </div>
                    {customer.notes && (
                      <div className="min-w-0 sm:col-span-2 xl:col-span-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                          Observações
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-slate-300">
                          {customer.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmActionDialog
        open={customerToDelete !== null}
        title="Excluir cliente?"
        description={`Tem certeza de que deseja excluir ${customerToDelete?.name ?? 'este cliente'}?`}
        confirmLabel="Sim, excluir"
        onCancel={() => {
          setCustomerToDelete(null)
        }}
        onConfirm={handleDelete}
      />
    </div>
  )
}
