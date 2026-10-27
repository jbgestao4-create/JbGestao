import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { customerService, type Customer } from '@modules/customers/services/customer.service'
import { quoteService } from '../services/quote.service'
import {
  calculateItemTotal,
  calculateSubtotal,
  calculateTotal,
  formatCurrency,
} from '@shared/utils/monetary'
import { Card, CardContent, CardHeader } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'

interface FormItem {
  id: string
  description: string
  quantity: string
  unitPrice: string
}

export function QuoteFormPage() {
  const { currentOrganization } = useOrganization()
  const navigate = useNavigate()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [discount, setDiscount] = useState('0.00')

  const [items, setItems] = useState<FormItem[]>([
    { id: '1', description: '', quantity: '1.0000', unitPrice: '0.00' },
  ])

  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!currentOrganization) return
    void customerService.list(currentOrganization.id).then((res) => {
      if (res.success) {
        setCustomers(res.data)
        if (res.data.length > 0) {
          setSelectedCustomerId(res.data[0].id)
        }
      }
    })
  }, [currentOrganization])

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString(), description: '', quantity: '1.0000', unitPrice: '0.00' },
    ])
  }

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleUpdateItem = (id: string, field: keyof FormItem, value: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  // Cálculos dinâmicos em tempo real para a interface
  const itemTotals = items.map((i) => calculateItemTotal(i.quantity, i.unitPrice))
  const subtotal = calculateSubtotal(itemTotals)
  const total = calculateTotal(subtotal, discount)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrganization) return

    if (!selectedCustomerId) {
      setError('Selecione um cliente para o orçamento.')
      return
    }

    const invalidItem = items.find((i) => !i.description.trim() || parseFloat(i.quantity) <= 0)
    if (invalidItem) {
      setError('Todos os itens devem possuir descrição e quantidade válida maior que zero.')
      return
    }

    setIsSubmitting(true)
    setError('')

    const res = await quoteService.createQuote(currentOrganization.id, {
      customerId: selectedCustomerId,
      validUntil: validUntil || null,
      notes: notes || null,
      discount: discount || '0.00',
      items: items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    })

    if (res.success) {
      navigate('/orcafacil/quotes')
    } else {
      setError(res.error)
    }

    setIsSubmitting(false)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          to="/orcafacil/quotes"
          className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Novo Orçamento</h1>
          <p className="text-sm text-gray-500">
            Preencha os dados da proposta comercial e adicione os itens de serviço ou materiais
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {/* CABEÇALHO DO ORÇAMENTO */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-900">Dados do Cliente e Validade</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
              {customers.length === 0 ? (
                <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  Nenhum cliente cadastrado.{' '}
                  <Link to="/orcafacil/customers" className="underline font-semibold">
                    Cadastre um cliente primeiro
                  </Link>
                  .
                </div>
              ) : (
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <Input
              label="Validade da Proposta"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* ITENS DO ORÇAMENTO */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-900">Itens e Serviços</h2>
            <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
              <Plus className="w-3.5 h-3.5" /> Adicionar Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item) => {
              const lineTotal = calculateItemTotal(item.quantity, item.unitPrice)

              return (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-gray-50/75 rounded-xl border border-gray-100"
                >
                  <div className="flex-1 w-full">
                    <Input
                      placeholder="Descrição do serviço ou material"
                      value={item.description}
                      onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                      required
                    />
                  </div>

                  <div className="w-full sm:w-28">
                    <Input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      placeholder="Qtd"
                      value={item.quantity}
                      onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                      required
                    />
                  </div>

                  <div className="w-full sm:w-32">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Valor Unit."
                      value={item.unitPrice}
                      onChange={(e) => handleUpdateItem(item.id, 'unitPrice', e.target.value)}
                      required
                    />
                  </div>

                  <div className="w-full sm:w-28 text-right font-semibold text-sm text-gray-900 shrink-0">
                    {formatCurrency(lineTotal)}
                  </div>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                      title="Remover Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            })}

            {/* TOTAIS E DESCONTO */}
            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-end sm:justify-between gap-4">
              <div className="w-full sm:w-64">
                <Input
                  label="Desconto em R$"
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>

              <div className="text-right space-y-1">
                <div className="text-xs text-gray-500">
                  Subtotal:{' '}
                  <span className="font-medium text-gray-700">{formatCurrency(subtotal)}</span>
                </div>
                {parseFloat(discount) > 0 && (
                  <div className="text-xs text-red-600">Desconto: -{formatCurrency(discount)}</div>
                )}
                <div className="text-xl font-bold text-gray-900">
                  Total: <span className="text-blue-600">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* OBSERVAÇÕES */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-900">
              Observações e Condições de Pagamento
            </h2>
          </CardHeader>
          <CardContent>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Pagamento 50% na aprovação e 50% na conclusão da obra."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link to="/orcafacil/quotes">
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancelar
            </Button>
          </Link>
          <Button type="submit" isLoading={isSubmitting}>
            Salvar e Gerar Orçamento
          </Button>
        </div>
      </form>
    </div>
  )
}
