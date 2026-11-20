import { useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Calendar,
  LineChart as LineChartIcon,
  Printer,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { formatCurrency } from '@shared/utils/monetary'
import { Button } from '@shared/components/ui/Button'
import type { ReportsDataset } from '../services/reports.service'

export type SalesChartPeriod = 'today' | '7d' | 'week' | '30d' | 'month' | 'year'
export type SalesChartType = 'bar' | 'line'

interface ChartPoint {
  key: string
  label: string
  fullDateLabel: string
  revenue: number
  salesCount: number
  averageTicket: number
  prevRevenue: number
  prevSalesCount: number
}

interface SalesMainChartViewProps {
  dataset: ReportsDataset
  isRefreshing: boolean
  onRefresh: () => void
  onBack: () => void
}

const PERIOD_OPTIONS: Array<{ id: SalesChartPeriod; label: string }> = [
  { id: 'today', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: 'week', label: 'Semana' },
  { id: '30d', label: '30 dias' },
  { id: 'month', label: 'Mês' },
  { id: 'year', label: 'Ano' },
]

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatShortBr(dateKey: string): string {
  const [, m, d] = dateKey.split('-')
  return `${d}/${m}`
}

function formatFullBr(dateKey: string): string {
  const [y, m, d] = dateKey.split('-')
  return `${d}/${m}/${y}`
}

function formatCompactCurrency(val: number): string {
  if (val >= 1000) {
    return `R$ ${(val / 1000).toFixed(1).replace('.', ',')}k`
  }
  return `R$ ${val.toFixed(0)}`
}

export function SalesMainChartView({
  dataset,
  isRefreshing,
  onRefresh,
  onBack,
}: SalesMainChartViewProps) {
  const [period, setPeriod] = useState<SalesChartPeriod>('month')
  const [chartType, setChartType] = useState<SalesChartType>('bar')
  const [comparePrevious, setComparePrevious] = useState<boolean>(true)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const validSales = useMemo(
    () => dataset.sales.filter((s) => s.status !== 'rejected' && s.status !== 'expired'),
    [dataset.sales],
  )

  const chartData = useMemo(() => {
    const now = new Date()
    const todayKey = toDateKey(now)

    const currentBuckets = new Map<string, { revenue: number; count: number; label: string; full: string }>()
    const prevBuckets = new Map<string, { revenue: number; count: number }>()
    const orderedKeys: string[] = []
    const prevKeyForCurrent = new Map<string, string>()

    if (period === 'year') {
      const curYear = now.getFullYear()
      const prevYear = curYear - 1
      for (let m = 0; m < 12; m++) {
        const mm = String(m + 1).padStart(2, '0')
        const curKey = `${curYear}-${mm}`
        const prevKey = `${prevYear}-${mm}`
        orderedKeys.push(curKey)
        currentBuckets.set(curKey, {
          revenue: 0,
          count: 0,
          label: MONTH_NAMES[m],
          full: `${MONTH_NAMES[m]}/${curYear}`,
        })
        prevBuckets.set(prevKey, { revenue: 0, count: 0 })
        prevKeyForCurrent.set(curKey, prevKey)
      }

      for (const s of validSales) {
        const ym = s.createdAt.slice(0, 7)
        const amt = Number(s.total || 0)
        const cur = currentBuckets.get(ym)
        if (cur) {
          cur.revenue += amt
          cur.count += 1
        }
        const prev = prevBuckets.get(ym)
        if (prev) {
          prev.revenue += amt
          prev.count += 1
        }
      }
    } else {
      let startDate = new Date(now)
      let endDate = new Date(now)

      if (period === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      } else if (period === '7d') {
        startDate.setDate(now.getDate() - 6)
      } else if (period === 'week') {
        const dayOfWeek = now.getDay() // 0=Sun
        const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        startDate.setDate(now.getDate() - diffToMon)
      } else if (period === '30d') {
        startDate.setDate(now.getDate() - 29)
      } else if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      }

      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(0, 0, 0, 0)

      const daysSpan = Math.max(
        1,
        Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      )

      for (let i = 0; i < daysSpan; i++) {
        const d = new Date(startDate)
        d.setDate(startDate.getDate() + i)
        const curKey = toDateKey(d)

        const prevD = new Date(d)
        if (period === 'month') {
          prevD.setMonth(prevD.getMonth() - 1)
        } else {
          prevD.setDate(prevD.getDate() - daysSpan)
        }
        const prevKey = toDateKey(prevD)

        orderedKeys.push(curKey)
        currentBuckets.set(curKey, {
          revenue: 0,
          count: 0,
          label: curKey === todayKey && period === 'today' ? 'Hoje' : formatShortBr(curKey),
          full: formatFullBr(curKey),
        })
        prevBuckets.set(prevKey, { revenue: 0, count: 0 })
        prevKeyForCurrent.set(curKey, prevKey)
      }

      for (const s of validSales) {
        const dk = s.createdAt.slice(0, 10)
        const amt = Number(s.total || 0)
        const cur = currentBuckets.get(dk)
        if (cur) {
          cur.revenue += amt
          cur.count += 1
        }
        const prev = prevBuckets.get(dk)
        if (prev) {
          prev.revenue += amt
          prev.count += 1
        }
      }
    }

    const points: ChartPoint[] = orderedKeys.map((k) => {
      const cur = currentBuckets.get(k)!
      const prevKey = prevKeyForCurrent.get(k)!
      const prev = prevBuckets.get(prevKey) || { revenue: 0, count: 0 }
      return {
        key: k,
        label: cur.label,
        fullDateLabel: cur.full,
        revenue: cur.revenue,
        salesCount: cur.count,
        averageTicket: cur.count > 0 ? cur.revenue / cur.count : 0,
        prevRevenue: prev.revenue,
        prevSalesCount: prev.count,
      }
    })

    const totalRevenue = points.reduce((sum, p) => sum + p.revenue, 0)
    const totalSalesCount = points.reduce((sum, p) => sum + p.salesCount, 0)
    const prevTotalRevenue = points.reduce((sum, p) => sum + p.prevRevenue, 0)

    let maxPoint: ChartPoint | null = null
    let minPoint: ChartPoint | null = null
    for (const p of points) {
      if (!maxPoint || p.revenue > maxPoint.revenue) maxPoint = p
      if (p.revenue > 0 && (!minPoint || p.revenue < minPoint.revenue)) minPoint = p
    }
    if (!minPoint && points.length > 0) {
      minPoint = points[0]
    }

    const growthPercent =
      prevTotalRevenue > 0
        ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100
        : totalRevenue > 0
          ? 100
          : 0

    const maxScaleValue = Math.max(
      100,
      ...points.map((p) => Math.max(p.revenue, comparePrevious ? p.prevRevenue : 0)),
    )

    return {
      points,
      totalRevenue,
      totalSalesCount,
      prevTotalRevenue,
      growthPercent,
      maxPoint,
      minPoint,
      maxScaleValue,
    }
  }, [validSales, period, comparePrevious])

  const { points, maxScaleValue, maxPoint, minPoint } = chartData
  const showDirectLabels = points.length <= 14

  // Dimensões SVG responsivas (altura 400px, largura adaptável com scroll horizontal no mobile para muitos dias)
  const svgHeight = 360
  const padTop = 36
  const padBottom = 42
  const padLeft = 68
  const padRight = 24
  const plotHeight = svgHeight - padTop - padBottom
  const minSlotWidth = points.length > 12 ? 54 : 72
  const svgWidth = Math.max(760, padLeft + padRight + points.length * minSlotWidth)
  const plotWidth = svgWidth - padLeft - padRight
  const slotWidth = points.length > 0 ? plotWidth / points.length : plotWidth

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: maxScaleValue * ratio,
    y: padTop + plotHeight - plotHeight * ratio,
  }))

  const activeHoverPoint = hoveredIndex !== null ? points[hoveredIndex] : null

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5 rounded-xl">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Gráfico Principal de Vendas
              </h1>
              <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                ALTA VISIBILIDADE
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Visão executiva de faturamento, quantidade de vendas, maior/menor dia e comparativo entre períodos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="gap-1.5 rounded-xl text-xs font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Resumo Executivo Rápido (leitura em 2 segundos) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Quanto Vendeu ({PERIOD_OPTIONS.find((p) => p.id === period)?.label})
          </div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
            {formatCurrency(chartData.totalRevenue.toFixed(2))}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {chartData.totalSalesCount} {chartData.totalSalesCount === 1 ? 'venda realizada' : 'vendas realizadas'}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Quando Vendeu Mais
          </div>
          <div className="mt-1 text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
            {maxPoint ? formatCurrency(maxPoint.revenue.toFixed(2)) : 'R$ 0,00'}
          </div>
          <div className="mt-1 text-xs font-medium text-emerald-800/80 dark:text-emerald-300/80">
            {maxPoint ? `${maxPoint.fullDateLabel} (${maxPoint.salesCount} vendas)` : 'Sem vendas'}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Menor Faturamento (c/ venda)
          </div>
          <div className="mt-1 text-xl font-extrabold text-amber-700 dark:text-amber-300">
            {minPoint ? formatCurrency(minPoint.revenue.toFixed(2)) : 'R$ 0,00'}
          </div>
          <div className="mt-1 text-xs font-medium text-amber-800/80 dark:text-amber-300/80">
            {minPoint ? `${minPoint.fullDateLabel} (${minPoint.salesCount} vendas)` : 'Sem vendas'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Tendência vs. Período Anterior
          </div>
          <div
            className={`mt-1 flex items-center gap-1.5 text-xl font-extrabold ${
              chartData.growthPercent >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {chartData.growthPercent >= 0 ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )}
            <span>
              {chartData.growthPercent >= 0 ? 'Crescendo' : 'Em queda'}{' '}
              ({chartData.growthPercent >= 0 ? '+' : ''}
              {chartData.growthPercent.toFixed(1)}%)
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Anterior: {formatCurrency(chartData.prevTotalRevenue.toFixed(2))}
          </div>
        </div>
      </div>

      {/* Painel Principal do Gráfico (Largura total + 380px–450px de altura) */}
      <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-5">
        {/* Filtros Rápidos + Alternador Barras/Linhas + Comparação */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 print:hidden">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 mr-1">
              <Calendar className="h-3.5 w-3.5 text-blue-600" />
              Período:
            </span>
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setPeriod(opt.id)
                  setHoveredIndex(null)
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  period === opt.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={comparePrevious}
                onChange={(e) => setComparePrevious(e.target.checked)}
                className="h-3.5 w-3.5 rounded text-blue-600"
              />
              Comparar com período anterior
            </label>

            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5">
              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  chartType === 'bar'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Barras
              </button>
              <button
                type="button"
                onClick={() => setChartType('line')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  chartType === 'line'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <LineChartIcon className="h-3.5 w-3.5" />
                Linhas
              </button>
            </div>
          </div>
        </div>

        {/* Legenda Clara + Painel do Ponto Selecionado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-blue-600" />
              Período Atual
            </span>
            {comparePrevious && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs bg-slate-300 dark:bg-slate-600" />
                Período Anterior
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-emerald-500" />
              Maior Faturamento
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-amber-500" />
              Menor Faturamento
            </span>
          </div>

          {activeHoverPoint && (
            <div className="inline-flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 px-3.5 py-2 text-xs">
              <span className="font-bold text-slate-900 dark:text-white">
                {activeHoverPoint.fullDateLabel}
              </span>
              <span className="font-extrabold text-blue-700 dark:text-blue-300">
                {formatCurrency(activeHoverPoint.revenue.toFixed(2))}
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                {activeHoverPoint.salesCount} {activeHoverPoint.salesCount === 1 ? 'venda' : 'vendas'}
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                Ticket Médio: <strong>{formatCurrency(activeHoverPoint.averageTicket.toFixed(2))}</strong>
              </span>
              {comparePrevious && (
                <span className="inline-flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
                  {activeHoverPoint.revenue >= activeHoverPoint.prevRevenue ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-rose-600" />
                  )}
                  Ant.: {formatCurrency(activeHoverPoint.prevRevenue.toFixed(2))}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Área do Gráfico (380px–420px altura no desktop, scroll horizontal no mobile se necessário) */}
        <div className="w-full overflow-x-auto pb-2">
          <div style={{ minWidth: `${svgWidth}px` }} className="h-[360px] sm:h-[400px]">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-full select-none"
              role="img"
              aria-label="Gráfico principal de vendas"
            >
              {/* Linhas horizontais de referência e Eixo Y (R$) */}
              {yTicks.map((t, idx) => (
                <g key={idx}>
                  <line
                    x1={padLeft}
                    x2={svgWidth - padRight}
                    y1={t.y}
                    y2={t.y}
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-800"
                    strokeDasharray={idx === 0 ? undefined : '4 4'}
                    strokeWidth={1}
                  />
                  <text
                    x={padLeft - 10}
                    y={t.y + 4}
                    textAnchor="end"
                    className="fill-slate-500 dark:fill-slate-400 text-[11px] font-medium"
                  >
                    {formatCompactCurrency(t.value)}
                  </text>
                </g>
              ))}

              {/* Gráfico de Barras Verticais */}
              {chartType === 'bar' &&
                points.map((p, idx) => {
                  const centerX = padLeft + idx * slotWidth + slotWidth / 2
                  const barWidth = comparePrevious
                    ? Math.min(26, Math.max(10, slotWidth * 0.34))
                    : Math.min(42, Math.max(14, slotWidth * 0.56))

                  const curHeight = (p.revenue / maxScaleValue) * plotHeight
                  const curY = padTop + plotHeight - curHeight
                  const curX = comparePrevious ? centerX - barWidth - 2 : centerX - barWidth / 2

                  const prevHeight = (p.prevRevenue / maxScaleValue) * plotHeight
                  const prevY = padTop + plotHeight - prevHeight
                  const prevX = centerX + 2

                  const isMax = maxPoint && p.key === maxPoint.key && p.revenue > 0
                  const isMin = minPoint && p.key === minPoint.key && p.revenue > 0 && !isMax
                  const isHovered = hoveredIndex === idx

                  const barColor = isMax
                    ? '#10b981'
                    : isMin
                      ? '#f59e0b'
                      : isHovered
                        ? '#1d4ed8'
                        : '#2563eb'

                  return (
                    <g
                      key={p.key}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onClick={() => setHoveredIndex(idx)}
                      className="cursor-pointer"
                    >
                      {/* Zona invisível de hover para facilitar toque/mouse */}
                      <rect
                        x={padLeft + idx * slotWidth}
                        y={padTop}
                        width={slotWidth}
                        height={plotHeight + padBottom}
                        fill="transparent"
                      />

                      {comparePrevious && (
                        <rect
                          x={prevX}
                          y={prevY}
                          width={barWidth}
                          height={Math.max(2, prevHeight)}
                          rx={4}
                          className="fill-slate-300 dark:fill-slate-700 transition-opacity"
                          opacity={isHovered ? 0.95 : 0.75}
                        />
                      )}

                      <rect
                        x={curX}
                        y={curY}
                        width={barWidth}
                        height={Math.max(p.revenue > 0 ? 4 : 2, curHeight)}
                        rx={5}
                        fill={barColor}
                        className="transition-all duration-150"
                      />

                      {showDirectLabels && p.revenue > 0 && (
                        <text
                          x={curX + barWidth / 2}
                          y={Math.max(padTop - 8, curY - 7)}
                          textAnchor="middle"
                          className="fill-slate-700 dark:fill-slate-200 text-[10px] font-bold"
                        >
                          {formatCompactCurrency(p.revenue)}
                        </text>
                      )}

                      <text
                        x={centerX}
                        y={svgHeight - 14}
                        textAnchor="middle"
                        className="fill-slate-500 dark:fill-slate-400 text-[11px] font-semibold"
                      >
                        {p.label}
                      </text>
                    </g>
                  )
                })}

              {/* Gráfico de Linhas */}
              {chartType === 'line' && points.length > 0 && (
                <>
                  {comparePrevious && (
                    <polyline
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth={2.5}
                      strokeDasharray="5 4"
                      points={points
                        .map((p, idx) => {
                          const x = padLeft + idx * slotWidth + slotWidth / 2
                          const y = padTop + plotHeight - (p.prevRevenue / maxScaleValue) * plotHeight
                          return `${x},${y}`
                        })
                        .join(' ')}
                    />
                  )}

                  <polyline
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={3.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={points
                      .map((p, idx) => {
                        const x = padLeft + idx * slotWidth + slotWidth / 2
                        const y = padTop + plotHeight - (p.revenue / maxScaleValue) * plotHeight
                        return `${x},${y}`
                      })
                      .join(' ')}
                  />

                  {points.map((p, idx) => {
                    const x = padLeft + idx * slotWidth + slotWidth / 2
                    const y = padTop + plotHeight - (p.revenue / maxScaleValue) * plotHeight
                    const isMax = maxPoint && p.key === maxPoint.key && p.revenue > 0
                    const isMin = minPoint && p.key === minPoint.key && p.revenue > 0 && !isMax
                    const isHovered = hoveredIndex === idx
                    const pointColor = isMax ? '#10b981' : isMin ? '#f59e0b' : '#2563eb'

                    return (
                      <g
                        key={p.key}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => setHoveredIndex(idx)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={padLeft + idx * slotWidth}
                          y={padTop}
                          width={slotWidth}
                          height={plotHeight + padBottom}
                          fill="transparent"
                        />

                        <circle
                          cx={x}
                          cy={y}
                          r={isHovered || isMax || isMin ? 6 : 4.5}
                          fill={pointColor}
                          stroke="#ffffff"
                          strokeWidth={2}
                        />

                        {showDirectLabels && p.revenue > 0 && (
                          <text
                            x={x}
                            y={Math.max(padTop - 8, y - 10)}
                            textAnchor="middle"
                            className="fill-slate-700 dark:fill-slate-200 text-[10px] font-bold"
                          >
                            {formatCompactCurrency(p.revenue)}
                          </text>
                        )}

                        <text
                          x={x}
                          y={svgHeight - 14}
                          textAnchor="middle"
                          className="fill-slate-500 dark:fill-slate-400 text-[11px] font-semibold"
                        >
                          {p.label}
                        </text>
                      </g>
                    )
                  })}
                </>
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
