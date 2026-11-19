import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSearch,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react'
import { supabase } from '@app/config/supabase'
import { useAuth } from '@modules/auth/context/AuthContext'
import { isSystemOwner } from '@shared/utils/system-owner'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import {
  companyManagementService,
  type ManagedCompany,
} from '../services/company-management.service'
import { organizationService } from '@modules/organizations/services/organization.service'
import type { OrganizationMemberDetail } from '@shared/types/common'
import type { AuditLogRecord } from '@shared/hooks/useAuditLogger'

const PAGE_SIZE = 25
const LIGHTWEIGHT_AUDIT_COLUMNS =
  'id, empresa_id, usuario_id, usuario_nome, modulo, acao, descricao, entidade, entidade_id, created_at'

const MODULO_OPTIONS = [
  'PDV',
  'ESTOQUE',
  'FINANCEIRO',
  'OS',
  'CLIENTES',
  'CAIXA',
  'VENDAS',
  'CONFIGURACOES',
  'SISTEMA',
]

const ACAO_OPTIONS = ['CRIACAO', 'EDICAO', 'EXCLUSAO', 'CANCELAMENTO']

const FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  nome: 'Nome',
  description: 'Descrição',
  descricao: 'Descrição',
  preco_venda: 'Preço de Venda',
  unit_price: 'Preço de Venda',
  sale_price: 'Preço de Venda',
  purchase_price: 'Preço de Compra',
  preco_compra: 'Preço de Compra',
  quantity_on_hand: 'Quantidade em Estoque',
  minimum_quantity: 'Estoque Mínimo',
  category: 'Categoria',
  categoria: 'Categoria',
  status: 'Status',
  is_active: 'Ativo',
  isActive: 'Ativo',
  total: 'Valor Total',
  total_amount: 'Valor Total',
  discount: 'Desconto',
  monthly_amount: 'Valor da Mensalidade',
  billing_day: 'Dia de Vencimento',
  payment_method: 'Forma de Pagamento',
  email: 'E-mail',
  phone: 'Telefone',
  document: 'CPF / CNPJ',
  address: 'Endereço',
  notes: 'Observações',
  trial_ends_at: 'Fim do Teste / Licença',
}

const CURRENCY_KEYS = new Set([
  'preco_venda',
  'unit_price',
  'sale_price',
  'purchase_price',
  'preco_compra',
  'total',
  'total_amount',
  'discount',
  'monthly_amount',
  'setup_fee',
  'amount',
])

function formatFieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key]
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (c) => c.toUpperCase())
}

function formatAuditValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Vazio'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (CURRENCY_KEYS.has(key.toLowerCase())) {
    const num = Number(value)
    if (!Number.isNaN(num)) return formatCurrency(num.toFixed(2))
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function formatDateTimeFull(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`
}

function getModuloBadgeClass(modulo: string): string {
  switch (modulo.toUpperCase()) {
    case 'PDV':
    case 'VENDAS':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
    case 'FINANCEIRO':
    case 'CAIXA':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
    case 'ESTOQUE':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
    case 'OS':
      return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
    case 'CLIENTES':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  }
}

function getAcaoBadgeClass(acao: string): string {
  switch (acao.toUpperCase()) {
    case 'CRIACAO':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
    case 'EDICAO':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
    case 'EXCLUSAO':
    case 'CANCELAMENTO':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700'
  }
}

export function AuditLogsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [companies, setCompanies] = useState<ManagedCompany[]>([])
  const [companyMembers, setCompanyMembers] = useState<OrganizationMemberDetail[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)

  // Filtros
  const [empresaFilter, setEmpresaFilter] = useState<string>('all')
  const [usuarioFilter, setUsuarioFilter] = useState<string>('all')
  const [moduloFilter, setModuloFilter] = useState<string>('all')
  const [acaoFilter, setAcaoFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
    }, 400)
    return () => window.clearTimeout(t)
  }, [searchQuery])

  // Dados e paginação server-side
  const [logs, setLogs] = useState<AuditLogRecord[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // Modal de detalhes ("Ver alteração") com carregamento sob demanda (baixo egress)
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  const handleOpenDetail = async (log: AuditLogRecord) => {
    setSelectedLog(log)
    if (log.dados_anteriores || log.dados_novos) return
    setIsLoadingDetail(true)
    try {
      const { data } = await supabase
        .from('audit_logs')
        .select('dados_anteriores, dados_novos')
        .eq('id', log.id)
        .maybeSingle()

      if (data) {
        const detail = data as {
          dados_anteriores: Record<string, unknown> | null
          dados_novos: Record<string, unknown> | null
        }
        setSelectedLog((prev) =>
          prev && prev.id === log.id
            ? {
                ...prev,
                dados_anteriores: detail.dados_anteriores,
                dados_novos: detail.dados_novos,
              }
            : prev,
        )
      }
    } finally {
      setIsLoadingDetail(false)
    }
  }

  // Carrega lista de empresas cadastradas
  useEffect(() => {
    void companyManagementService.listAll().then((res) => {
      if (res.success && res.data) {
        setCompanies(res.data)
      }
    })
  }, [])

  // Carrega funcionários da empresa selecionada
  useEffect(() => {
    setUsuarioFilter('all')
    if (empresaFilter === 'all') {
      setCompanyMembers([])
      return
    }
    let active = true
    setIsLoadingMembers(true)
    void organizationService
      .getMembersWithDetails(empresaFilter)
      .then((res) => {
        if (active && res.success && res.data) {
          setCompanyMembers(res.data)
        } else if (active) {
          setCompanyMembers([])
        }
      })
      .finally(() => {
        if (active) setIsLoadingMembers(false)
      })
    return () => {
      active = false
    }
  }, [empresaFilter])

  const companyNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of companies) {
      map.set(c.id, c.name)
    }
    return map
  }, [companies])

  // Lista de funcionários disponíveis para o filtro (membros da empresa selecionada ou usuários presentes nos logs)
  const employeeOptions = useMemo(() => {
    if (empresaFilter !== 'all' && companyMembers.length > 0) {
      return companyMembers.map((m) => ({
        id: m.userId,
        label: `${m.displayName}${m.jobTitle ? ` (${m.jobTitle})` : ''}`,
      }))
    }
    const seen = new Map<string, string>()
    for (const log of logs) {
      if (log.usuario_id && !seen.has(log.usuario_id)) {
        seen.set(log.usuario_id, log.usuario_nome)
      }
    }
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }))
  }, [empresaFilter, companyMembers, logs])

  const buildFilteredQuery = useCallback(
    (withCount: boolean) => {
      let query = supabase
        .from('audit_logs')
        .select(LIGHTWEIGHT_AUDIT_COLUMNS, withCount ? { count: 'exact' } : undefined)
        .neq('acao', 'CLIQUE')
        .order('created_at', { ascending: false })

      if (empresaFilter !== 'all') {
        query = query.eq('empresa_id', empresaFilter)
      }
      if (usuarioFilter !== 'all') {
        query = query.eq('usuario_id', usuarioFilter)
      }
      if (moduloFilter !== 'all') {
        query = query.eq('modulo', moduloFilter)
      }
      if (acaoFilter !== 'all') {
        query = query.eq('acao', acaoFilter)
      }
      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`)
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59.999`)
      }
      if (debouncedSearch) {
        query = query.ilike('descricao', `%${debouncedSearch}%`)
      }
      return query
    },
    [empresaFilter, usuarioFilter, moduloFilter, acaoFilter, startDate, endDate, debouncedSearch],
  )

  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, count, error } = await buildFilteredQuery(true).range(from, to)

      if (error) {
        setErrorMsg(
          error.message.includes('audit_logs')
            ? 'A tabela audit_logs ainda não foi criada no Supabase. Execute a migração 00139_audit_logs.sql.'
            : `Erro ao consultar logs: ${error.message}`,
        )
        setLogs([])
        setTotalCount(0)
      } else {
        setLogs((data as AuditLogRecord[]) || [])
        setTotalCount(count ?? 0)
      }
    } catch {
      setErrorMsg('Falha de conexão ao carregar logs de auditoria.')
      setLogs([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [buildFilteredQuery, page])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  // Reseta para página 1 quando filtros mudam
  useEffect(() => {
    setPage(1)
  }, [empresaFilter, usuarioFilter, moduloFilter, acaoFilter, startDate, endDate, debouncedSearch])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const { data, error } = await buildFilteredQuery(false).range(0, 999)
      if (error || !data) return

      const rows = data as AuditLogRecord[]
      const headers = [
        'Data/Hora',
        'Empresa',
        'Funcionário / Usuário',
        'Módulo',
        'Ação',
        'Descrição',
        'Entidade',
        'ID Registro',
      ]

      const escape = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`
      const lines = [
        headers.map(escape).join(';'),
        ...rows.map((r) =>
          [
            formatDateTimeFull(r.created_at),
            companyNameById.get(r.empresa_id) || r.empresa_id,
            r.usuario_nome,
            r.modulo,
            r.acao,
            r.descricao,
            r.entidade || '',
            r.entidade_id || '',
          ]
            .map(escape)
            .join(';'),
        ),
      ]

      const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], {
        type: 'text/csv;charset=utf-8;',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  const diffKeys = useMemo(() => {
    if (!selectedLog) return []
    const prevKeys = selectedLog.dados_anteriores ? Object.keys(selectedLog.dados_anteriores) : []
    const nextKeys = selectedLog.dados_novos ? Object.keys(selectedLog.dados_novos) : []
    return Array.from(new Set([...prevKeys, ...nextKeys]))
  }, [selectedLog])

  if (!isSystemOwner(user)) {
    return (
      <div className="py-20 max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Acesso Restrito ao Desenvolvedor
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Os Logs de Auditoria completos são restritos à administração da plataforma (LGPD).
        </p>
        <Button onClick={() => void navigate('/dashboard')}>Voltar ao Início</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => void navigate('/admin/developer-settings')}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition shrink-0"
              title="Voltar para Configurações de Desenvolvedor"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Logs de Auditoria (Audit Logs)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  Imutável • LGPD
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-slate-400 max-w-3xl">
                Rastreamento completo de ações, cliques críticos e alterações de dados por empresa e funcionário, com comparação visual Antes/Depois.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadLogs()}
              disabled={isLoading}
              className="gap-2 text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button
              type="button"
              onClick={() => void handleExportCsv()}
              disabled={isExporting || totalCount === 0}
              className="gap-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Download className="w-3.5 h-3.5" />
              {isExporting ? 'Exportando...' : 'Exportar CSV'}
            </Button>
          </div>
        </div>
      </div>

      {/* Filtros: Empresa, Funcionário da Empresa, Módulo, Ação, Período e Busca */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Empresa
            </label>
            <select
              value={empresaFilter}
              onChange={(e) => setEmpresaFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white"
            >
              <option value="all">Todas as Empresas ({companies.length})</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Funcionário da Empresa
            </label>
            <select
              value={usuarioFilter}
              onChange={(e) => setUsuarioFilter(e.target.value)}
              disabled={isLoadingMembers}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white disabled:opacity-60"
            >
              <option value="all">
                {isLoadingMembers
                  ? 'Carregando funcionários...'
                  : 'Todos os Funcionários'}
              </option>
              {employeeOptions.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Módulo
            </label>
            <select
              value={moduloFilter}
              onChange={(e) => setModuloFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white"
            >
              <option value="all">Todos os Módulos</option>
              {MODULO_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Tipo de Ação
            </label>
            <select
              value={acaoFilter}
              onChange={(e) => setAcaoFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white"
            >
              <option value="all">Todas as Ações</option>
              {ACAO_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Buscar na Descrição
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ex.: Alterou preço, excluiu venda, exportou relatório..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Tabela de Logs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Data / Hora</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Funcionário</th>
                <th className="px-4 py-3">Módulo</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3 text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    Carregando registros de auditoria...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <FileSearch className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    Nenhum registro de auditoria encontrado para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const hasDiff =
                    ['EDICAO', 'CRIACAO', 'EXCLUSAO', 'CANCELAMENTO'].includes(
                      log.acao.toUpperCase(),
                    ) || Boolean(log.entidade)
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-600 dark:text-slate-300">
                        {formatDateTimeFull(log.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                        {companyNameById.get(log.empresa_id) || log.empresa_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {log.usuario_nome}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${getModuloBadgeClass(
                            log.modulo,
                          )}`}
                        >
                          {log.modulo}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${getAcaoBadgeClass(
                            log.acao,
                          )}`}
                        >
                          {log.acao}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                        {log.descricao}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {hasDiff ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleOpenDetail(log)}
                            className="gap-1.5 text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver alteração
                          </Button>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação Server-Side (25 itens/página) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs text-slate-600 dark:text-slate-400">
          <div>
            Total de <strong>{totalCount}</strong> registro(s) • Página <strong>{page}</strong> de{' '}
            <strong>{totalPages}</strong> (25 por página)
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="gap-1 text-xs"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="gap-1 text-xs"
            >
              Próxima
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de Detalhes ("Ver alteração") */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Detalhes da Alteração
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedLog.usuario_nome} • {formatDateTimeFull(selectedLog.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3.5 text-xs space-y-1">
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300">Descrição:</span>{' '}
                  <span className="text-slate-900 dark:text-white">{selectedLog.descricao}</span>
                </div>
                {selectedLog.entidade && (
                  <div className="text-slate-500">
                    Recurso: <strong>{selectedLog.entidade}</strong>
                    {selectedLog.entidade_id ? ` (ID: ${selectedLog.entidade_id})` : ''}
                  </div>
                )}
              </div>

              {isLoadingDetail ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  Carregando detalhes da alteração...
                </p>
              ) : diffKeys.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  Nenhum campo alterado registrado neste evento.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {diffKeys.map((key) => {
                    const beforeVal = selectedLog.dados_anteriores?.[key]
                    const afterVal = selectedLog.dados_novos?.[key]
                    return (
                      <div
                        key={key}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs"
                      >
                        <div className="font-bold text-slate-800 dark:text-slate-200 mb-2">
                          {formatFieldLabel(key)}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2">
                          <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 px-3 py-2">
                            <div className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">
                              Antes
                            </div>
                            <div className="mt-0.5 font-semibold text-rose-900 dark:text-rose-200 break-words">
                              {formatAuditValue(key, beforeVal)}
                            </div>
                          </div>

                          <ArrowRight className="w-4 h-4 text-slate-400 mx-auto hidden sm:block" />

                          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 px-3 py-2">
                            <div className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                              Depois
                            </div>
                            <div className="mt-0.5 font-semibold text-emerald-900 dark:text-emerald-200 break-words">
                              {formatAuditValue(key, afterVal)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 px-6 py-3">
              <Button type="button" onClick={() => setSelectedLog(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
