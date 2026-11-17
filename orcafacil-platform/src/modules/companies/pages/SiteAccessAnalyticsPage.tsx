import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  Globe,
  Laptop,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  siteAccessTrackerService,
  type SiteAccessStats,
} from '@shared/services/site-access-tracker.service'
import { Card, CardContent, CardHeader } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { formatLastAccess } from '@shared/services/screen-time.service'

export function SiteAccessAnalyticsPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<SiteAccessStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'daily' | 'ips' | 'logs'>('overview')

  const loadData = async () => {
    setIsLoading(true)
    try {
      const data = await siteAccessTrackerService.getAccessStats()
      setStats(data)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    // Atualiza automaticamente a cada 2 minutos (apenas com aba visível)
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void loadData()
    }, 120000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="space-y-6 pb-14">
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => void navigate('/admin/developer-settings')}
              className="mt-1 p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Voltar para Configurações de Desenvolvedor"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
                  <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  Métricas de Acessos ao Site (Diário / Mensal)
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <ShieldCheck className="w-3 h-3" /> Ao Vivo
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 max-w-3xl">
                Acompanhe em tempo real o fluxo de visitantes, acessos diários e mensais por endereços IP únicos no site <strong>https://controlesoft.vercel.app/</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={isLoading}
              className="gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Atualizar Dados</span>
            </Button>
            <button
              type="button"
              onClick={() => void navigate('/admin/developer-settings')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Voltar ao Dev
            </button>
          </div>
        </div>
      </div>

      {/* CARDS DE RESUMO DE ACESSOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card Hoje - Visitas */}
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Acessos de Hoje
              </span>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                  {stats?.todayVisits ?? 0}
                </span>
                <span className="text-xs text-slate-500 font-medium">visualizações</span>
              </div>
              <span className="mt-1 block text-xs text-slate-400">
                Data: {new Date().toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Eye className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card Hoje - IPs Únicos */}
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                IPs Únicos Hoje
              </span>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {stats?.todayUniqueIps ?? 0}
                </span>
                <span className="text-xs text-slate-500 font-medium">visitantes</span>
              </div>
              <span className="mt-1 block text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Pessoas diferentes hoje
              </span>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card Mês - Visitas */}
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Acessos no Mês
              </span>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                  {stats?.monthVisits ?? 0}
                </span>
                <span className="text-xs text-slate-500 font-medium">acessos</span>
              </div>
              <span className="mt-1 block text-xs text-slate-400 capitalize">
                Mês:{' '}
                {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card Mês - IPs Únicos */}
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                IPs Únicos no Mês
              </span>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-purple-600 dark:text-purple-400">
                  {stats?.monthUniqueIps ?? 0}
                </span>
                <span className="text-xs text-slate-500 font-medium">visitantes únicos</span>
              </div>
              <span className="mt-1 block text-xs text-purple-600 dark:text-purple-400 font-medium">
                Total acumulado do mês
              </span>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NAVEGAÇÃO DE ABAS */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Visão Geral & Páginas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'daily'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Acessos Diários ({stats?.dailyBreakdown.length ?? 0} dias)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ips')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'ips'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Top Endereços IP ({stats?.topIps.length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Últimos Acessos ao Vivo ({stats?.recentVisits.length ?? 0})
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Páginas Mais Acessadas */}
          <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600" />
                Páginas Mais Visitadas na Plataforma
              </h3>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {stats?.topPages && stats.topPages.length > 0 ? (
                  stats.topPages.map((page, idx) => (
                    <div
                      key={page.path}
                      className="px-5 py-3 flex items-center justify-between text-xs hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <code className="text-slate-800 dark:text-slate-200 font-semibold">
                          {page.path === '/' ? '/ (Página Inicial)' : page.path}
                        </code>
                      </div>
                      <span className="font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full">
                        {page.count} {page.count === 1 ? 'acesso' : 'acessos'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Nenhum acesso registrado ainda.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Resumo do Status do Site */}
          <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Informações do Domínio & Plataforma
              </h3>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-800/40">
                <span className="text-slate-500 block">URL de Monitoramento:</span>
                <a
                  href="https://controlesoft.vercel.app/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                  https://controlesoft.vercel.app/
                </a>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <span className="text-slate-500 block">Total Geral de Visitas</span>
                  <strong className="text-lg text-slate-900 dark:text-white">
                    {stats?.totalVisits ?? 0}
                  </strong>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <span className="text-slate-500 block">Total de IPs Registrados</span>
                  <strong className="text-lg text-slate-900 dark:text-white">
                    {stats?.totalUniqueIps ?? 0}
                  </strong>
                </div>
              </div>

              <p className="text-slate-500 text-[11px] leading-relaxed">
                O cálculo é atualizado automaticamente conforme os usuários navegam pela página inicial, planos, módulos e telas do sistema.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA DIÁRIA */}
      {activeTab === 'daily' && (
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Histórico de Acessos Diários por Endereço IP
            </h3>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Data</th>
                    <th className="px-5 py-3">Total de Acessos</th>
                    <th className="px-5 py-3">IPs Únicos (Visitantes)</th>
                    <th className="px-5 py-3 text-right">Média por Visitante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats?.dailyBreakdown && stats.dailyBreakdown.length > 0 ? (
                    stats.dailyBreakdown.map((row) => {
                      const avg =
                        row.uniqueIps > 0 ? (row.visits / row.uniqueIps).toFixed(1) : '1.0'
                      return (
                        <tr
                          key={row.date}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-blue-500" />
                            {row.date.split('-').reverse().join('/')}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-blue-600 dark:text-blue-400">
                            {row.visits} acessos
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-emerald-700 dark:text-emerald-300 font-bold">
                              {row.uniqueIps} IPs únicos
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right text-slate-500">
                            ~{avg} visualizações/IP
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">
                        Nenhum registro diário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ABA TOP IPS */}
      {activeTab === 'ips' && (
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              Endereços IP com Maior Frequência de Acesso
            </h3>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3">#</th>
                    <th className="px-5 py-3">Endereço IP</th>
                    <th className="px-5 py-3">Total de Acessos</th>
                    <th className="px-5 py-3 text-right">Último Acesso Detectado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats?.topIps && stats.topIps.length > 0 ? (
                    stats.topIps.map((item, idx) => (
                      <tr
                        key={item.ip}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-5 py-3.5 text-slate-400 font-bold">{idx + 1}</td>
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                          {item.ip}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 text-blue-700 dark:text-blue-300 font-bold">
                            {item.count} {item.count === 1 ? 'acesso' : 'acessos'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-500 font-medium">
                          {formatLastAccess(item.lastSeen)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">
                        Nenhum IP registrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ABA LOGS AO VIVO */}
      {activeTab === 'logs' && (
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              Últimas Visitas Registradas (Tempo Real)
            </h3>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Data e Hora</th>
                    <th className="px-5 py-3">Endereço IP</th>
                    <th className="px-5 py-3">Página Acessada</th>
                    <th className="px-5 py-3">Dispositivo</th>
                    <th className="px-5 py-3 text-right">Origem / Referrer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats?.recentVisits && stats.recentVisits.length > 0 ? (
                    stats.recentVisits.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-5 py-3.5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {formatLastAccess(log.created_at)}
                        </td>
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                          {log.ip_address}
                        </td>
                        <td className="px-5 py-3.5">
                          <code className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded text-[11px]">
                            {log.path}
                          </code>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                            {log.is_mobile ? (
                              <>
                                <Smartphone className="w-3.5 h-3.5 text-slate-400" /> Mobile
                              </>
                            ) : (
                              <>
                                <Laptop className="w-3.5 h-3.5 text-slate-400" /> Desktop
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-400 truncate max-w-[200px]">
                          {log.referrer || 'Acesso Direto'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        Nenhum registro ao vivo no momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
