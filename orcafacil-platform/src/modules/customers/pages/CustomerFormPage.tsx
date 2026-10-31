import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { customerService } from '../services/customer.service'
import { formatCustomerDocument } from '../utils/customer-document'
import { formatPostalAddress, formatPostalCode, lookupPostalAddress } from '../utils/postal-code'
import { formatPhoneNumber } from '@shared/utils/phone'
import type { CustomerType } from '@shared/types/common'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { ArrowLeft, BriefcaseBusiness, Save, UserRound } from 'lucide-react'

interface CustomerFormReturnState {
  returnTo?: string
  quoteDraft?: unknown
}

export function CustomerFormPage() {
  const { currentOrganization } = useOrganization()
  const navigate = useNavigate()
  const location = useLocation()
  const { customerId } = useParams()
  const isEditing = customerId !== undefined
  const returnState = location.state as CustomerFormReturnState | null
  const quoteReturnPath = returnState?.returnTo?.startsWith('/orcafacil/quotes/')
    ? returnState.returnTo
    : null

  const [personType, setPersonType] = useState<CustomerType>('individual')
  const [name, setName] = useState('')
  const [document, setDocument] = useState('')
  const [skipDocument, setSkipDocument] = useState(false)
  const [phone, setPhone] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [skipPostalCode, setSkipPostalCode] = useState(false)
  const [address, setAddress] = useState('')
  const [addressNumber, setAddressNumber] = useState('')
  const [isLookingUpPostalCode, setIsLookingUpPostalCode] = useState(false)
  const [postalCodeError, setPostalCodeError] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState('')
  const [loadedCustomerKey, setLoadedCustomerKey] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const postalLookupController = useRef<AbortController | null>(null)
  const customerKey =
    customerId && currentOrganization ? `${currentOrganization.id}:${customerId}` : null
  const isLoading = customerKey !== null && loadedCustomerKey !== customerKey

  const handleCancel = () => {
    if (quoteReturnPath && returnState?.quoteDraft) {
      void navigate(quoteReturnPath, { state: { quoteDraft: returnState.quoteDraft } })
      return
    }

    void navigate('/orcafacil/customers')
  }

  useEffect(() => {
    return () => {
      postalLookupController.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!customerId || !currentOrganization) {
      return
    }

    let isActive = true
    void customerService.getById(currentOrganization.id, customerId).then((result) => {
      if (!isActive) return
      if (result.success) {
        setPersonType(result.data.personType)
        setName(result.data.name)
        setDocument(
          result.data.document
            ? formatCustomerDocument(result.data.document, result.data.personType)
            : '',
        )
        setSkipDocument(!result.data.document)
        setPhone(formatPhoneNumber(result.data.phone ?? ''))
        setPostalCode(result.data.postalCode ? formatPostalCode(result.data.postalCode) : '')
        setSkipPostalCode(!result.data.postalCode)
        setAddress(result.data.address ?? '')
        setAddressNumber(result.data.addressNumber ?? '')
        setNotes(result.data.notes ?? '')
      } else {
        setFormError(result.error)
      }
      setLoadedCustomerKey(`${currentOrganization.id}:${customerId}`)
    })

    return () => {
      isActive = false
    }
  }, [customerId, currentOrganization])

  const handlePostalCodeChange = (value: string) => {
    const formattedPostalCode = formatPostalCode(value)
    const digits = formattedPostalCode.replace(/\D/g, '')
    setPostalCode(formattedPostalCode)
    setPostalCodeError('')
    postalLookupController.current?.abort()

    if (digits.length !== 8) {
      setIsLookingUpPostalCode(false)
      return
    }

    const controller = new AbortController()
    postalLookupController.current = controller
    setIsLookingUpPostalCode(true)
    void lookupPostalAddress(digits, controller.signal)
      .then((result) => {
        setAddress(formatPostalAddress(result))
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setPostalCodeError(
          error instanceof Error
            ? error.message
            : 'Não foi possível consultar o CEP. Preencha o endereço manualmente.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLookingUpPostalCode(false)
      })
  }

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentOrganization) {
      setFormError('Selecione uma organização antes de cadastrar o cliente.')
      return
    }

    const requiredDocumentLength = personType === 'individual' ? 11 : 14
    if (!skipDocument && document.replace(/\D/g, '').length !== requiredDocumentLength) {
      setFormError(
        personType === 'individual'
          ? 'Informe o CPF com 11 dígitos.'
          : 'Informe o CNPJ com 14 dígitos.',
      )
      return
    }

    if (!skipPostalCode && postalCode.replace(/\D/g, '').length !== 8) {
      setFormError('Informe um CEP com 8 dígitos ou marque a opção para cadastrar sem CEP.')
      return
    }

    if (!addressNumber.trim()) {
      setFormError('Informe o número do endereço.')
      return
    }

    setIsSaving(true)
    setFormError('')
    const params = {
      personType,
      name: name.trim(),
      document: skipDocument ? null : document,
      phone: phone.trim(),
      postalCode: skipPostalCode ? null : postalCode.replace(/\D/g, ''),
      address: address.trim(),
      addressNumber: addressNumber.trim(),
      notes: notes.trim(),
    }
    if (isEditing) {
      const result = await customerService.update(currentOrganization.id, customerId, params)
      if (result.success) {
        void navigate('/orcafacil/customers/search')
      } else {
        setFormError(result.error)
      }
    } else {
      const result = await customerService.create(currentOrganization.id, params)
      if (result.success) {
        if (quoteReturnPath && returnState?.quoteDraft) {
          void navigate(quoteReturnPath, {
            state: {
              quoteDraft: returnState.quoteDraft,
              createdCustomerId: result.data.id,
            },
          })
        } else {
          void navigate('/orcafacil/customers/search')
        }
      } else {
        setFormError(result.error)
      }
    }
    setIsSaving(false)
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">Carregando ficha do cliente...</div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <button
        type="button"
        onClick={handleCancel}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar para clientes
      </button>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-6 sm:p-8 lg:p-10">
          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Ficha Cadastral do Cliente
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Insira as informações cadastrais requeridas. Os dados serão salvos no sistema e
              estarão disponíveis para consulta imediata.
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
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-800">
                Tipo de Pessoa *
              </legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  aria-pressed={personType === 'individual'}
                  onClick={() => {
                    setPersonType('individual')
                    setDocument((current) => formatCustomerDocument(current, 'individual'))
                  }}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    personType === 'individual'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <UserRound aria-hidden="true" className="h-4 w-4" />
                  Pessoa Física (PF)
                </button>
                <button
                  type="button"
                  aria-pressed={personType === 'company'}
                  onClick={() => {
                    setPersonType('company')
                    setDocument((current) => formatCustomerDocument(current, 'company'))
                  }}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    personType === 'company'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <BriefcaseBusiness aria-hidden="true" className="h-4 w-4" />
                  Pessoa Jurídica (PJ)
                </button>
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
              <Input
                label={
                  personType === 'individual' ? 'Nome Completo do Cliente *' : 'Razão Social *'
                }
                placeholder={
                  personType === 'individual'
                    ? 'Ex: Carlos Eduardo de Souza'
                    : 'Ex: Empresa Exemplo Ltda.'
                }
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                }}
                autoComplete={personType === 'individual' ? 'name' : 'organization'}
                required
                minLength={2}
              />
              <div>
                <Input
                  label={personType === 'individual' ? 'CPF' : 'CNPJ'}
                  placeholder={
                    personType === 'individual' ? '000.000.000-00' : '00.000.000/0000-00'
                  }
                  value={document}
                  onChange={(event) => {
                    setDocument(formatCustomerDocument(event.target.value, personType))
                  }}
                  inputMode="numeric"
                  maxLength={personType === 'individual' ? 14 : 18}
                  disabled={skipDocument}
                  required={!skipDocument}
                />
                <label className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={skipDocument}
                    onChange={(event) => {
                      const shouldSkip = event.target.checked
                      setSkipDocument(shouldSkip)
                      if (shouldSkip) setDocument('')
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  Cadastrar sem {personType === 'individual' ? 'CPF' : 'CNPJ'}
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-3">
              <Input
                label="Telefone / WhatsApp *"
                type="tel"
                placeholder="(31) 90000-0000"
                value={phone}
                onChange={(event) => {
                  setPhone(formatPhoneNumber(event.target.value))
                }}
                inputMode="numeric"
                autoComplete="tel"
                maxLength={15}
                required
              />
              <div>
                <Input
                  label="CEP"
                  placeholder="00000-000"
                  value={postalCode}
                  onChange={(event) => {
                    handlePostalCodeChange(event.target.value)
                  }}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={9}
                  disabled={skipPostalCode}
                  required={!skipPostalCode}
                  aria-describedby={postalCodeError ? 'postal-code-error' : undefined}
                  helperText={isLookingUpPostalCode ? 'Consultando CEP...' : undefined}
                />
                <label className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={skipPostalCode}
                    onChange={(event) => {
                      const shouldSkip = event.target.checked
                      setSkipPostalCode(shouldSkip)
                      setPostalCodeError('')
                      if (shouldSkip) {
                        postalLookupController.current?.abort()
                        setIsLookingUpPostalCode(false)
                        setPostalCode('')
                      }
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  Sem CEP
                </label>
              </div>
              <div className="md:col-span-2">
                <Input
                  label="Endereço Completo *"
                  placeholder="Rua / Av, Bairro, Cidade - UF"
                  value={address}
                  onChange={(event) => {
                    setAddress(event.target.value)
                  }}
                  autoComplete="street-address"
                  required
                />
              </div>
              <div className="md:justify-self-end md:w-40">
                <Input
                  label="Número *"
                  placeholder="Nº ou S/N"
                  value={addressNumber}
                  onChange={(event) => {
                    setAddressNumber(event.target.value)
                  }}
                  autoComplete="address-line2"
                  required
                />
              </div>
              {postalCodeError && (
                <p
                  id="postal-code-error"
                  role="alert"
                  className="text-sm text-red-600 md:col-span-2"
                >
                  {postalCodeError}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="customer-notes"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                Observação / Anotações do Cliente
              </label>
              <textarea
                id="customer-notes"
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value)
                }}
                placeholder="Ex: Horário preferencial de entrega, limite de crédito pré-aprovado, observações fiscais, etc."
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex flex-col-reverse justify-end gap-3 border-t border-gray-100 pt-4 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                isLoading={isSaving}
                className="rounded-xl bg-blue-600 hover:bg-blue-700"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                Salvar Cadastro de Cliente
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
