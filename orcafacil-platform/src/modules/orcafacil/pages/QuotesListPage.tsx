import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { quoteService, type QuoteListItem } from '../services/quote.service'
import {
  getStatusBadgeClasses,
  getStatusLabel,
  isValidStatusTransition,
  ALLOWED_STATUS_TRANSITIONS,
} from '../domain/quote-status'
import { formatCurrency } from '@shared/utils/monetary'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { FileSpreadsheet, Plus, Trash2 } from 'lucide-react'
import type { QuoteStatus } from '@shared/types/database'

export function QuotesListPage() {
  const { currentOrganization } = useOrganization()
  const [quotes, setQuotes] = useState<QuoteListItem[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [statusError, setStatusError] = useState<string | null>(null)

  const loadQuotes = async () => {
    if (!currentOrganization) return
    setIsLoading(true)
    const res = await quoteService.listQuotes(currentOrganization.id)
    if (res.success) {
      setQuotes(res.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    void loadQuotes()
  }, [currentOrganization])

  const handleStatusChange = async (
    quoteId: string,
    currentStatus: QuoteStatus,
    newStatus: QuoteStatus,
  ) => {
    if (!currentOrganization) return
    setStatusError(null)

    if (!isValidStatusTransition(currentStatus, newStatus)) {
      setStatusError(
        `Transição inválida: Não é permitido mudar de "${getStatusLabel(
          currentStatus,
        )}" para "${getStatusLabel(newStatus)}".`,
      )
      return
    }

    const res = await quoteService.updateStatus(currentOrganization.id, quoteId, newStatus)
    if (res.success) {
      await loadQuotes()
    } else {
      setStatusError(res.error)
    }
  }

  const handleDelete = async (quoteId: string) => {
    if (!currentOrganization) return
    if (!window.confirm('Deseja realmente excluir este orçamento e seus itens?')) return

    const res = await quoteService.deleteQuote(currentOrganization.id, quoteId)
    if (res.success) {
      await loadQuotes()
    } else {
      alert(res.error)
    }
  }

  const filteredQuotes =
    filterStatus === 'all' ? quotes : quotes.filter((q) => q.status === filterStatus)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Orçamentos</h1>
          <p className="text-sm text-gray-500">
            Gerenciamento comercial, propostas e histórico de negociações
          </p>
        </div>

        <Link to="/orcafacil/quotes/new">
          <Button size="sm">
            <Plus className="w-4 h-4" /> Novo Orçamento
          </Button>
        </Link>
      </div>

      {statusError && (
        <div className="p-4 bg-amber-50 text-amber-800 text-sm rounded-xl border border-amber-200">
          {statusError}
        </div>
      )}

      {/* FILTROS DE STATUS */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['all', 'draft', 'sent', 'approved', 'rejected', 'expired'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              filterStatus === st
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {st === 'all' ? 'Todos' : getStatusLabel(st as QuoteStatus)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-gray-500">Carregando orçamentos...</div>
          ) : filteredQuotes.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              <FileSpreadsheet className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              Nenhum orçamento encontrado com o filtro selecionado.{' '}
              <Link
                to="/orcafacil/quotes/new"
                className="text-blue-600 font-medium hover:underline"
              >
                Criar novo orçamento
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50/75 text-xs uppercase text-gray-400 font-semibold border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3">Número</th>
                    <th className="px-6 py-3">Cliente</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Subtotal</th>
                    <th className="px-6 py-3 text-right">Desconto</th>
                    <th className="px-6 py-3 text-right">Total</th>
                    <th className="px-6 py-3 text-right">Validade</th>
                    <th className="px-6 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredQuotes.map((q) => {
                    const allowedNext = ALLOWED_STATUS_TRANSITIONS[q.status] ?? []

                    return (
                      <tr key={q.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-gray-900">{q.quoteNumber}</td>
                        <td className="px-6 py-4">{q.customerName}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClasses(
                              q.status,
                            )}`}
                          >
                            {getStatusLabel(q.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-xs text-gray-500">
                          {formatCurrency(q.subtotal)}
                        </td>
                        <td className="px-6 py-4 text-right text-xs text-red-600">
                          {parseFloat(q.discount) > 0 ? `-${formatCurrency(q.discount)}` : '—'}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900">
                          {formatCurrency(q.total)}
                        </td>
                        <td className="px-6 py-4 text-right text-xs text-gray-400">
                          {q.validUntil ? new Date(q.validUntil).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {allowedNext.length > 0 && (
                              <select
                                aria-label="Alterar Status"
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    void handleStatusChange(
                                      q.id,
                                      q.status,
                                      e.target.value as QuoteStatus,
                                    )
                                  }
                                }}
                                className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-700 cursor-pointer"
                              >
                                <option value="" disabled>
                                  Mudar status...
                                </option>
                                {allowedNext.map((st) => (
                                  <option key={st} value={st}>
                                    → {getStatusLabel(st)}
                                  </option>
                                ))}
                              </select>
                            )}

                            <button
                              onClick={() => void handleDelete(q.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                              title="Excluir Orçamento"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
