import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { quoteService, type QuoteListItem } from '@modules/orcafacil/services/quote.service'
import { customerService } from '@modules/customers/services/customer.service'
import { formatCurrency } from '@shared/utils/monetary'
import { getStatusBadgeClasses, getStatusLabel } from '@modules/orcafacil/domain/quote-status'
import { Card, CardContent, CardHeader } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { FileSpreadsheet, Users, Boxes, Plus, ArrowRight } from 'lucide-react'

export function DashboardPage() {
  const { currentOrganization } = useOrganization()
  const { canAccess } = useModuleAccess()

  const [quotesCount, setQuotesCount] = useState<number>(0)
  const [customersCount, setCustomersCount] = useState<number>(0)
  const [recentQuotes, setRecentQuotes] = useState<QuoteListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const hasOrcafacil = canAccess('orcafacil')

  useEffect(() => {
    if (!currentOrganization) return

    const loadMetrics = async () => {
      setIsLoading(true)

      const [quotesRes, customersRes] = await Promise.all([
        quoteService.listQuotes(currentOrganization.id),
        customerService.list(currentOrganization.id),
      ])

      if (quotesRes.success) {
        setQuotesCount(quotesRes.data.length)
        setRecentQuotes(quotesRes.data.slice(0, 5))
      }

      if (customersRes.success) {
        setCustomersCount(customersRes.data.length)
      }

      setIsLoading(false)
    }

    void loadMetrics()
  }, [currentOrganization])

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Painel Geral — {currentOrganization?.name}
          </h1>
          <p className="text-sm text-gray-500">
            Resumo operacional e acesso rápido aos serviços da sua organização
          </p>
        </div>

        {hasOrcafacil && (
          <div className="flex items-center gap-2">
            <Link to="/orcafacil/quotes/new">
              <Button size="sm">
                <Plus className="w-4 h-4" /> Novo Orçamento
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block">
                Total de Orçamentos
              </span>
              <span className="text-2xl font-bold text-gray-900 block">
                {isLoading ? '...' : quotesCount}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block">
                Clientes Cadastrados
              </span>
              <span className="text-2xl font-bold text-gray-900 block">
                {isLoading ? '...' : customersCount}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block">
                Módulos Ativos
              </span>
              <span className="text-2xl font-bold text-gray-900 block">
                {hasOrcafacil ? '1 Ativo' : '0'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ORÇAMENTOS RECENTES */}
      {hasOrcafacil && (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-gray-900">Últimos Orçamentos Criados</h2>
            <Link
              to="/orcafacil/quotes"
              className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentQuotes.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-500">
                <FileSpreadsheet className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                Nenhum orçamento cadastrado ainda.{' '}
                <Link
                  to="/orcafacil/quotes/new"
                  className="text-blue-600 font-medium hover:underline"
                >
                  Criar o primeiro
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
                      <th className="px-6 py-3 text-right">Total</th>
                      <th className="px-6 py-3 text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentQuotes.map((quote) => (
                      <tr key={quote.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{quote.quoteNumber}</td>
                        <td className="px-6 py-4">{quote.customerName}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClasses(
                              quote.status,
                            )}`}
                          >
                            {getStatusLabel(quote.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-gray-900">
                          {formatCurrency(quote.total)}
                        </td>
                        <td className="px-6 py-4 text-right text-xs text-gray-400">
                          {new Date(quote.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
