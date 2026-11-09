import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { cashSessionService } from '@modules/cash/services/cash-session.service'
import type { CashSession } from '@modules/cash/domain/cash-session'
import { formatCurrency } from '@shared/utils/monetary'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import {
  ArrowLeft,
  ChevronRight,
  DollarSign,
  FileBarChart,
  FileText,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  ShoppingCart,
  Store,
  Users,
  Wallet,
  X,
} from 'lucide-react'

export function ReportsPage() {
  const { currentOrganization } = useOrganization()
  const [searchParams, setSearchParams] = useSearchParams()

  // Se view === 'user-sessions', exibe o relatório detalhado de resumos de caixa do usuário
  const currentView = searchParams.get('view') || 'home'

  const [sessions, setSessions] = useState<CashSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'closed' | 'open'>('closed')
  const [selectedSession, setSelectedSession] = useState<CashSession | null>(null)
  const [showModal, setShowModal] = useState(false)

  const loadSessions = async () => {
    if (!currentOrganization) return
    setIsLoading(true)
    const res = await cashSessionService.listHistory(currentOrganization.id)
    if (res.success && res.data) {
      setSessions(res.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    void loadSessions()
  }, [currentOrganization])

  // Filtragem de resumos
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) {
        return false
      }

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const op = (s.operatorName || '').toLowerCase()
      const reg = (s.registerId || '').toLowerCase()
      const dateOpened = new Date(s.openedAt).toLocaleDateString('pt-BR').toLowerCase()
      const dateClosed = s.closedAt
        ? new Date(s.closedAt).toLocaleDateString('pt-BR').toLowerCase()
        : ''

      return op.includes(q) || reg.includes(q) || dateOpened.includes(q) || dateClosed.includes(q)
    })
  }, [sessions, statusFilter, searchQuery])

  // Métricas calculadas para os resumos fechados
  const metrics = useMemo(() => {
    const closed = sessions.filter((s) => s.status === 'closed')
    const totalSales = closed.reduce((acc, s) => acc + parseFloat(s.totalSales || '0'), 0)
    const totalCountedMoney = closed.reduce((acc, s) => acc + parseFloat(s.countedMoney || '0'), 0)
    const totalSalesCount = closed.reduce((acc, s) => acc + (s.salesCount || 0), 0)
    const balancedCount = closed.filter((s) => (s.difference || '0.00') === '0.00').length

    return {
      closedCount: closed.length,
      totalSales: totalSales.toFixed(2),
      totalCountedMoney: totalCountedMoney.toFixed(2),
      totalSalesCount,
      balancedCount,
    }
  }, [sessions])

  const handleOpenReport = (session: CashSession) => {
    setSelectedSession(session)
    setShowModal(true)
  }

  const handlePrint = (session: CashSession) => {
    setSelectedSession(session)
    setShowModal(true)
    setTimeout(() => {
      window.print()
    }, 300)
  }

  // ==============================================================
  // VIEW 1: RELATÓRIOS DO USUÁRIO (HISTÓRICO DE RESUMOS DE CAIXA)
  // ==============================================================
  if (currentView === 'user-sessions') {
    return (
      <div className="space-y-6">
        {/* CABEÇALHO COM BOTÃO VOLTAR */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-900 dark:hover:text-white shadow-xs transition-colors"
              title="Voltar aos Relatórios"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                  Relatório do Usuário — Resumos de Caixa
                </h1>
                <span className="rounded-md bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 text-xs font-bold text-teal-700 dark:text-teal-300 ring-1 ring-teal-600/20">
                  PDV &amp; Turnos
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                Histórico consolidado de todos os fechamentos de caixa, conciliações da gaveta e resumos de turno gerados pelos operadores.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadSessions()}
              disabled={isLoading}
              className="rounded-xl flex items-center gap-2 text-xs font-semibold"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </Button>
            <Link to="/orcafacil/sales">
              <Button size="sm" className="rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold">
                <Store className="h-4 w-4 mr-1.5" />
                <span>Acessar Vendas &amp; PDV</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* CARDS DE MÉTRICAS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400">
                <Receipt className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Resumos Fechados</p>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                  {metrics.closedCount} {metrics.closedCount === 1 ? 'turno' : 'turnos'}
                </h3>
                <p className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
                  {metrics.balancedCount} turnos sem divergência
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Faturamento em Turnos</p>
                <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatCurrency(metrics.totalSales)}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  {metrics.totalSalesCount} vendas registradas
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Dinheiro Físico Apurado</p>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                  {formatCurrency(metrics.totalCountedMoney)}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">Total conferido na gaveta</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400">
                <FileBarChart className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Organização Ativa</p>
                <h3 className="text-base font-bold text-gray-900 dark:text-white mt-0.5 truncate max-w-[160px]">
                  {currentOrganization?.name || 'Sua Empresa'}
                </h3>
                <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">PDV &amp; Balcão</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FILTROS E BUSCA */}
        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por operador, terminal ou data..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:border-teal-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Filtrar:</span>
                <div className="inline-flex rounded-xl border border-gray-200 dark:border-slate-700 p-0.5 bg-gray-50 dark:bg-slate-800/80 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('closed')}
                    className={`rounded-lg px-3 py-1.5 transition-colors ${
                      statusFilter === 'closed'
                        ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs'
                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                    }`}
                  >
                    Fechados ({sessions.filter((s) => s.status === 'closed').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('open')}
                    className={`rounded-lg px-3 py-1.5 transition-colors ${
                      statusFilter === 'open'
                        ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs'
                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                    }`}
                  >
                    Em Aberto ({sessions.filter((s) => s.status === 'open').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`rounded-lg px-3 py-1.5 transition-colors ${
                      statusFilter === 'all'
                        ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs'
                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                    }`}
                  >
                    Todos ({sessions.length})
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TABELA DE RESUMOS */}
        <Card className="rounded-2xl border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  <th className="px-5 py-3.5">Terminal / Operador</th>
                  <th className="px-5 py-3.5">Abertura / Fechamento</th>
                  <th className="px-5 py-3.5 text-center">Vendas</th>
                  <th className="px-5 py-3.5 text-right">Faturamento Total</th>
                  <th className="px-5 py-3.5 text-right">Dinheiro Contado</th>
                  <th className="px-5 py-3.5 text-center">Situação</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-500 dark:text-slate-400">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-teal-600" />
                      <span>Carregando resumos de caixa...</span>
                    </td>
                  </tr>
                ) : filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-500 dark:text-slate-400">
                      <Receipt className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                      <p className="font-semibold text-gray-700 dark:text-slate-300">
                        Nenhum resumo encontrado para os filtros selecionados.
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Os resumos são gerados automaticamente a cada encerramento oficial de turno (F12) no PDV.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((s) => {
                    const isClosed = s.status === 'closed'
                    const diffVal = parseFloat(s.difference || '0')
                    const isCorrect = (s.difference || '0.00') === '0.00'

                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-teal-50 dark:bg-teal-950/60 px-2 py-1 font-mono text-[11px] font-bold text-teal-700 dark:text-teal-300">
                              {s.registerId}
                            </span>
                            <span className="font-semibold">{s.operatorName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 dark:text-slate-300">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="text-gray-400">Abr:</span>
                              <span>{new Date(s.openedAt).toLocaleString('pt-BR')}</span>
                            </div>
                            {s.closedAt ? (
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="text-gray-400">Fec:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {new Date(s.closedAt).toLocaleString('pt-BR')}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                Turno em andamento
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center font-mono font-bold text-gray-900 dark:text-white">
                          {s.salesCount || 0}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatCurrency(s.totalSales)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-gray-900 dark:text-white font-medium">
                          {s.countedMoney ? formatCurrency(s.countedMoney) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {!isClosed ? (
                            <span className="rounded-full bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20">
                              ABERTO
                            </span>
                          ) : isCorrect ? (
                            <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20">
                              CORRETO
                            </span>
                          ) : diffVal > 0 ? (
                            <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 text-[10px] font-bold text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20">
                              SOBRA ({s.difference})
                            </span>
                          ) : (
                            <span className="rounded-full bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 text-[10px] font-bold text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20">
                              FALTA ({s.difference})
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenReport(s)}
                              className="rounded-lg h-8 px-2.5 text-xs font-semibold hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-slate-700"
                              title="Visualizar Resumo Completo"
                            >
                              <FileText className="h-3.5 w-3.5 mr-1" />
                              <span>Resumo</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePrint(s)}
                              className="rounded-lg h-8 px-2 text-xs text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-white"
                              title="Reimprimir Comprovante"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* MODAL DE VISUALIZAÇÃO DO RESUMO */}
        {showModal && selectedSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-teal-50 dark:bg-teal-950/60 p-2 text-teal-600 dark:text-teal-400">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      Resumo do Fechamento de Caixa
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {selectedSession.registerId} • Operador: {selectedSession.operatorName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* RELATÓRIO FORMATADO */}
              <div className="rounded-xl bg-gray-50 dark:bg-slate-950 p-4 border border-gray-200 dark:border-slate-800 font-mono text-xs space-y-2">
                <div className="border-b border-gray-200 dark:border-slate-800 pb-2 flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span>STATUS DO TURNO:</span>
                  <span className="font-bold text-emerald-600 uppercase">
                    {selectedSession.status === 'closed' ? 'ENCERRADO / CONCLUÍDO' : 'EM ANDAMENTO'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800 pb-2">
                  <div>
                    <span className="text-gray-400">Abertura:</span>{' '}
                    <b className="text-gray-800 dark:text-slate-200">
                      {new Date(selectedSession.openedAt).toLocaleString('pt-BR')}
                    </b>
                  </div>
                  <div>
                    <span className="text-gray-400">Fechamento:</span>{' '}
                    <b className="text-gray-800 dark:text-slate-200">
                      {selectedSession.closedAt
                        ? new Date(selectedSession.closedAt).toLocaleString('pt-BR')
                        : '—'}
                    </b>
                  </div>
                  <div>
                    <span className="text-gray-400">Fundo de Troco:</span>{' '}
                    <b className="text-gray-800 dark:text-slate-200 font-mono">
                      {formatCurrency(selectedSession.openingBalance)}
                    </b>
                  </div>
                  <div>
                    <span className="text-gray-400">Qtd Vendas:</span>{' '}
                    <b className="text-gray-800 dark:text-slate-200 font-mono">
                      {selectedSession.salesCount || 0}
                    </b>
                  </div>
                </div>

                {/* FATURAMENTO POR FORMA DE PAGAMENTO */}
                <div className="space-y-1 border-b border-gray-200 dark:border-slate-800 pb-2">
                  <p className="font-bold text-[11px] text-gray-700 dark:text-slate-300 mb-1">
                    -- FATURAMENTO POR FORMA DE PAGAMENTO --
                  </p>
                  <div className="flex justify-between">
                    <span className="text-gray-500">DINHEIRO:</span>
                    <span className="font-bold">{formatCurrency(selectedSession.totalMoney)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">PIX:</span>
                    <span className="font-bold">{formatCurrency(selectedSession.totalPix)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">CARTÃO DE CRÉDITO:</span>
                    <span className="font-bold">{formatCurrency(selectedSession.totalCreditCard)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">CARTÃO DE DÉBITO:</span>
                    <span className="font-bold">{formatCurrency(selectedSession.totalDebitCard)}</span>
                  </div>
                  <div className="flex justify-between pt-1 font-bold text-emerald-600 dark:text-emerald-400">
                    <span>TOTAL VENDAS FATURADAS:</span>
                    <span>{formatCurrency(selectedSession.totalSales)}</span>
                  </div>
                </div>

                {/* MOVIMENTAÇÕES */}
                <div className="space-y-1 border-b border-gray-200 dark:border-slate-800 pb-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">(+) SUPRIMENTOS:</span>
                    <span className="text-emerald-600 font-bold">
                      {formatCurrency(selectedSession.totalAdditionalEntries)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">(-) SANGRIA / RETIRADAS:</span>
                    <span className="text-rose-500 font-bold">
                      {formatCurrency(selectedSession.totalWithdrawals)}
                    </span>
                  </div>
                </div>

                {/* CONCILIAÇÃO DA GAVETA */}
                <div className="space-y-1 pt-1">
                  <p className="font-bold text-[11px] text-gray-700 dark:text-slate-300 mb-1">
                    -- CONCILIAÇÃO DA GAVETA (DINHEIRO) --
                  </p>
                  <div className="flex justify-between">
                    <span className="text-gray-500">VALOR ESPERADO:</span>
                    <span className="font-bold">{formatCurrency(selectedSession.expectedMoney)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">VALOR FÍSICO CONTADO:</span>
                    <span className="font-bold">
                      {formatCurrency(selectedSession.countedMoney || '0')}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span className="text-gray-500">DIVERGÊNCIA / QUEBRA:</span>
                    <span
                      className={
                        (selectedSession.difference || '0.00') === '0.00'
                          ? 'text-emerald-600'
                          : parseFloat(selectedSession.difference || '0') > 0
                          ? 'text-blue-600'
                          : 'text-rose-600'
                      }
                    >
                      {selectedSession.difference || '0.00'}
                    </span>
                  </div>
                  {selectedSession.discrepancyJustification && (
                    <p className="text-[10px] text-amber-600 pt-1">
                      <b>JUSTIFICATIVA:</b> {selectedSession.discrepancyJustification}
                    </p>
                  )}
                  {selectedSession.supervisorAuthorizedBy && (
                    <p className="text-[10px] text-slate-500">
                      <b>SUPERVISOR:</b> {selectedSession.supervisorAuthorizedBy}
                    </p>
                  )}
                </div>
              </div>

              {/* BOTÕES DE AÇÃO */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-xl text-xs font-semibold"
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    window.print()
                  }}
                  className="flex-1 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Printer className="h-4 w-4" />
                  <span>Imprimir Resumo</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* COMPROVANTE OCULTO PARA IMPRESSÃO TÉRMICA */}
        {selectedSession && (
          <div className="pdv-receipt-print hidden print:block font-mono text-[11px] text-black leading-tight p-2">
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '8px' }}>
              <img src="/controlesoft-logo.png" alt="ControleSoft" style={{ display: 'block', margin: '0 auto 6px', height: '48px', objectFit: 'contain' }} />
              <p style={{ fontWeight: 'bold', fontSize: '13px' }}>{currentOrganization?.name || 'CONTROLESOFT'}</p>
              <p style={{ fontSize: '11px' }}>FECHAMENTO DE CAIXA — PDV</p>
              <p style={{ fontSize: '9px' }}>RELATÓRIO DE ENCERRAMENTO DE TURNO</p>
            </div>

            <div style={{ borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px', fontSize: '10px' }}>
              <p>TERMINAL: {selectedSession.registerId}</p>
              <p>OPERADOR: {selectedSession.operatorName}</p>
              <p>ABERTURA: {new Date(selectedSession.openedAt).toLocaleString('pt-BR')}</p>
              {selectedSession.closedAt && (
                <p>FECHAMENTO: {new Date(selectedSession.closedAt).toLocaleString('pt-BR')}</p>
              )}
              <p>SALDO INICIAL: {formatCurrency(selectedSession.openingBalance)}</p>
            </div>

            <div style={{ borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px', fontSize: '10px' }}>
              <p style={{ fontWeight: 'bold', textAlign: 'center', marginBottom: '4px' }}>-- FATURAMENTO POR PAGAMENTO --</p>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>DINHEIRO:</span>
                <span>{formatCurrency(selectedSession.totalMoney)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>PIX:</span>
                <span>{formatCurrency(selectedSession.totalPix)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>CARTAO CREDITO:</span>
                <span>{formatCurrency(selectedSession.totalCreditCard)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>CARTAO DEBITO:</span>
                <span>{formatCurrency(selectedSession.totalDebitCard)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '2px' }}>
                <span>TOTAL DE VENDAS ({selectedSession.salesCount}):</span>
                <span>{formatCurrency(selectedSession.totalSales)}</span>
              </div>
            </div>

            <div style={{ borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px', fontSize: '10px' }}>
              <p style={{ fontWeight: 'bold', textAlign: 'center', marginBottom: '4px' }}>-- CONCILIAÇÃO DA GAVETA --</p>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>ESPERADO EM DINHEIRO:</span>
                <strong>{formatCurrency(selectedSession.expectedMoney)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>FÍSICO CONTADO:</span>
                <strong>{formatCurrency(selectedSession.countedMoney || '0')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>DIVERGÊNCIA / QUEBRA:</span>
                <strong>{selectedSession.difference || '0.00'}</strong>
              </div>
              {selectedSession.discrepancyJustification && (
                <p style={{ marginTop: '4px', fontSize: '9px' }}>
                  <strong>JUSTIFICATIVA:</strong> {selectedSession.discrepancyJustification}
                </p>
              )}
            </div>

            <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '9px' }}>
              <p style={{ marginBottom: '24px' }}>
                __________________________________________<br />
                Assinatura do Operador ({selectedSession.operatorName})
              </p>
              <p style={{ fontSize: '8px', color: '#555' }}>
                Reimpresso em: {new Date().toLocaleString('pt-BR')} • ControleSoft Relatórios
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ==============================================================
  // VIEW PRINCIPAL: GRADE DE CARDS (LAYOUT IGUAL A /orcafacil/sales)
  // ==============================================================
  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Relatórios &amp; Consultas
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Painel consolidado de relatórios operacionais: resumos de caixa do usuário, faturamento de vendas e clientes.
          </p>
        </div>
      </div>

      {/* GRADE DE CARDS PRINCIPAIS */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* CARD 1: RELATÓRIO DO USUÁRIO (RESUMOS DE CAIXA) */}
        <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex h-full flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-xl bg-teal-50 p-3 text-teal-700">
                <Receipt className="h-6 w-6" aria-hidden="true" />
              </div>
              <span className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-teal-800">
                OPERADOR &amp; CAIXA
              </span>
            </div>
            <h2 className="mt-4 text-base font-bold tracking-wide text-gray-900">
              RELATÓRIOS DO USUÁRIO
            </h2>
            <p className="mt-2 flex-1 text-xs leading-5 text-gray-600">
              Histórico consolidado de todos os resumos de turno, conciliações físicas de gaveta (esperado vs contado), sangrias e justificativas de quebra de caixa.
            </p>
            <div className="mt-5 flex flex-col justify-end gap-2">
              <Button
                size="sm"
                onClick={() => setSearchParams({ view: 'user-sessions' })}
                className="w-full justify-between rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-xs"
              >
                <span className="inline-flex items-center gap-2">
                  <Receipt className="h-4 w-4" aria-hidden="true" />
                  Visualizar Resumos de Caixa
                </span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* CARD 2: RELATÓRIO DE VENDAS */}
        <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex h-full flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
                <ShoppingCart className="h-6 w-6" aria-hidden="true" />
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-blue-800">
                FATURAMENTO &amp; PDV
              </span>
            </div>
            <h2 className="mt-4 text-base font-bold tracking-wide text-gray-900">
              RELATÓRIO DE VENDAS
            </h2>
            <p className="mt-2 flex-1 text-xs leading-5 text-gray-600">
              Acompanhamento de vendas faturadas, formas de pagamento praticadas (Dinheiro, PIX, Cartão), ticket médio e volume de itens comercializados.
            </p>
            <div className="mt-5 flex flex-col justify-end gap-2">
              <Link to="/orcafacil/sales/search" className="w-full">
                <Button
                  size="sm"
                  className="w-full justify-between rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
                >
                  <span className="inline-flex items-center gap-2">
                    <Search className="h-4 w-4" aria-hidden="true" />
                    Consultar Vendas Faturadas
                  </span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* CARD 3: RELATÓRIO DE CLIENTES */}
        <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex h-full flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-xl bg-purple-50 p-3 text-purple-700">
                <Users className="h-6 w-6" aria-hidden="true" />
              </div>
              <span className="rounded-full bg-purple-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-purple-800">
                CLIENTES &amp; CRM
              </span>
            </div>
            <h2 className="mt-4 text-base font-bold tracking-wide text-gray-900">
              RELATÓRIO DE CLIENTES
            </h2>
            <p className="mt-2 flex-1 text-xs leading-5 text-gray-600">
              Listagem cadastral de clientes, volume acumulado de compras, telefones, documentos (CPF/CNPJ) e relatórios de contato da carteira.
            </p>
            <div className="mt-5 flex flex-col justify-end gap-2">
              <Link to="/orcafacil/customers" className="w-full">
                <Button
                  size="sm"
                  className="w-full justify-between rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-xs"
                >
                  <span className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    Consultar Carteira de Clientes
                  </span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
