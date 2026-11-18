import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  FileCheck,
  FileCode,
  FileSignature,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  User,
  Activity,
  Check,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { isSystemOwner } from '@shared/utils/system-owner'
import { Button } from '@shared/components/ui/Button'
import {
  contractAcceptanceAuditService,
  type ContractAcceptanceEvidenceRecord,
  type IntegrityCheckResult,
} from '@shared/services/contract-acceptance-audit.service'

export function ContractAcceptanceAuditAdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const urlSearch = searchParams.get('search') || searchParams.get('q') || ''
  const [records, setRecords] = useState<ContractAcceptanceEvidenceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(urlSearch)
  const [planFilter, setPlanFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all')

  // Modal de Detalhes / Dossiê Individual
  const [selectedRecord, setSelectedRecord] = useState<ContractAcceptanceEvidenceRecord | null>(null)
  const [integrityResult, setIntegrityResult] = useState<IntegrityCheckResult | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  const loadRecords = async () => {
    setIsLoading(true)
    try {
      const data = await contractAcceptanceAuditService.listAll()
      setRecords(data)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadRecords()
  }, [])

  // Sincroniza o termo de busca caso a URL mude externamente (ex: atalhos ou botões)
  useEffect(() => {
    const q = searchParams.get('search') || searchParams.get('q') || ''
    if (q !== searchTerm) {
      setSearchTerm(q)
    }
  }, [searchParams])

  // Abre automaticamente o modal se a URL especificar um recibo ou contrato exato
  useEffect(() => {
    const q = searchParams.get('search') || searchParams.get('q')
    if (q && records.length > 0 && !selectedRecord) {
      const clean = q.trim().toLowerCase()
      const exactMatch = records.find(
        (r) =>
          r.receiptNumber?.toLowerCase() === clean ||
          r.contractNumber?.toLowerCase() === clean ||
          r.id?.toLowerCase() === clean,
      )
      if (exactMatch) {
        setSelectedRecord(exactMatch)
      }
    }
  }, [records, searchParams, selectedRecord])

  // Verifica integridade quando um registro for aberto
  useEffect(() => {
    if (!selectedRecord) {
      setIntegrityResult(null)
      return
    }

    let isMounted = true
    setIsVerifying(true)
    void contractAcceptanceAuditService.verifyRecordIntegrity(selectedRecord).then((res) => {
      if (isMounted) {
        setIntegrityResult(res)
        setIsVerifying(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [selectedRecord])

  const copyToClipboard = (text: string, id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedHash(id)
      setTimeout(() => setCopiedHash(null), 2000)
    }
  }

  const handleSearchChange = (val: string) => {
    setSearchTerm(val)
    if (val.trim()) {
      setSearchParams({ search: val.trim() }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }

  // Filtragem dinâmica
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Filtro de Texto
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const cleanDigits = q.replace(/\D/g, '')

        const matchName = r.userName?.toLowerCase().includes(q)
        const matchEmail = r.userEmail?.toLowerCase().includes(q)
        const matchCompany = r.companyName?.toLowerCase().includes(q)
        const matchPlan = r.planName?.toLowerCase().includes(q)
        const matchDoc = cleanDigits ? r.userDocument?.replace(/\D/g, '').includes(cleanDigits) : false
        const matchCompanyDoc = cleanDigits ? r.companyDocument?.replace(/\D/g, '').includes(cleanDigits) : false
        const matchReceipt = r.receiptNumber?.toLowerCase().includes(q)
        const matchContractNum = r.contractNumber?.toLowerCase().includes(q)
        const matchIp = r.ipAddress?.includes(q)
        const matchSha = r.documentSha256?.toLowerCase().includes(q)

        if (
          !matchName &&
          !matchEmail &&
          !matchCompany &&
          !matchPlan &&
          !matchDoc &&
          !matchCompanyDoc &&
          !matchReceipt &&
          !matchContractNum &&
          !matchIp &&
          !matchSha
        ) {
          return false
        }
      }

      // Filtro de Plano
      if (planFilter !== 'all') {
        if (r.planName !== planFilter && r.planId !== planFilter) {
          return false
        }
      }

      // Filtro de Data
      if (dateFilter !== 'all') {
        const itemDate = new Date(r.acceptedAtUtc).getTime()
        const now = Date.now()
        const diffDays = (now - itemDate) / (1000 * 60 * 60 * 24)

        if (dateFilter === 'today' && diffDays > 1) return false
        if (dateFilter === '7days' && diffDays > 7) return false
        if (dateFilter === '30days' && diffDays > 30) return false
      }

      return true
    })
  }, [records, searchTerm, planFilter, dateFilter])

  // Lista única de planos para filtro
  const uniquePlans = useMemo(() => {
    const set = new Set<string>()
    for (const r of records) {
      if (r.planName) set.add(r.planName)
    }
    return Array.from(set).sort()
  }, [records])

  // Métricas
  const metrics = useMemo(() => {
    const total = records.length
    const verified = records.filter((r) => r.verificationStatus === 'verified').length
    const ips = new Set(records.map((r) => r.ipAddress)).size
    return { total, verified, ips }
  }, [records])

  if (!isSystemOwner(user)) {
    return (
      <div className="py-20 max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Acesso Restrito ao Desenvolvedor</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          A área de Registros de Aceites e Evidências Digitais é restrita a Superadmins para proteção de dados (LGPD).
        </p>
        <button
          type="button"
          onClick={() => void navigate('/dashboard')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          Voltar ao Início
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      {/* HEADER DA PÁGINA */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => void navigate('/admin/developer-settings')}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition shrink-0"
              title="Voltar para Desenvolvedor"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Registros de Aceites e Evidências Digitais
                </h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                  Trilha Jurídica Imutável
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-slate-400 max-w-3xl">
                Auditoria completa de manifestação de vontade, hashes criptográficos SHA-256, telemetria de conexão,
                não-repúdio e emissão de Dossiês Periciais conforme a MP nº 2.200-2/2001, Lei nº 14.063/2020 e LGPD.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={loadRecords}
              disabled={isLoading}
              className="gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar Registros
            </Button>
          </div>
        </div>
      </div>

      {/* CARDS DE MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Total de Aceites Eletrônicos
            </span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
              {metrics.total} registros
            </span>
            <span className="text-[11px] text-slate-400">Preservados imutavelmente</span>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <FileCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Integridade Criptográfica (SHA-256)
            </span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
              100% Auditável
            </span>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
              {metrics.verified} verificados com sucesso
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Endereços IP Auditados
            </span>
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1 block">
              {metrics.ips} conexões
            </span>
            <span className="text-[11px] text-slate-400">IPv4 / IPv6 validados</span>
          </div>
          <div className="p-3 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
            <Globe className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS E BUSCA */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Busca Unificada */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar por Nome, Empresa, E-mail, CPF/CNPJ, Recibo, Contrato, IP ou Hash SHA-256..."
              className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            />
          </div>

          {/* Filtro por Plano */}
          <div>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            >
              <option value="all">Todos os Planos</option>
              {uniquePlans.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Data */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            >
              <option value="all">Qualquer período</option>
              <option value="today">Hoje (últimas 24h)</option>
              <option value="7days">Últimos 7 dias</option>
              <option value="30days">Últimos 30 dias</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>
            Exibindo <strong>{filteredRecords.length}</strong> de {records.length} aceites registrados
          </span>
          {(searchTerm || planFilter !== 'all' || dateFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('')
                setPlanFilter('all')
                setDateFilter('all')
              }}
              className="text-purple-600 dark:text-purple-400 hover:underline font-semibold"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* TABELA DE REGISTROS DE ACEITE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Comprovante / Recibo</th>
                <th className="py-3.5 px-4">Contratante / Usuário</th>
                <th className="py-3.5 px-4">Empresa / Plano</th>
                <th className="py-3.5 px-4">Data e Hora (UTC / Local)</th>
                <th className="py-3.5 px-4">Conexão & IP</th>
                <th className="py-3.5 px-4">Hash SHA-256 do Contrato</th>
                <th className="py-3.5 px-4 text-right">Ações de Evidência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Carregando registros de aceites e trilhas de auditoria...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Nenhum registro de aceite encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    {/* Recibo e Versão */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        {item.receiptNumber}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-mono text-[10px] font-bold">
                          v{item.contractVersion}
                        </span>
                        <span className="text-[10px] text-slate-400">CTR #{item.contractNumber}</span>
                      </div>
                    </td>

                    {/* Contratante */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{item.userName}</div>
                      <div className="text-slate-500 text-[11px] truncate max-w-[200px]" title={item.userEmail}>
                        {item.userEmail}
                      </div>
                      {item.userDocument && (
                        <div className="text-slate-400 font-mono text-[10px]">Doc: {item.userDocument}</div>
                      )}
                    </td>

                    {/* Empresa / Plano */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                        {item.companyName || 'Empresa Padrão'}
                      </div>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                        {item.planName || 'Plano JB'}
                      </span>
                    </td>

                    {/* Data/Hora */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {new Date(item.acceptedAtUtc).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(item.acceptedAtUtc).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        UTC: {item.acceptedAtUtc.substring(11, 19)}
                      </div>
                    </td>

                    {/* IP e Dispositivo */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>{item.ipAddress}</span>
                        <span className="text-[10px] font-normal text-slate-400">({item.ipType})</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                        {item.deviceType === 'celular' ? (
                          <Smartphone className="w-3 h-3 text-slate-400" />
                        ) : item.deviceType === 'tablet' ? (
                          <Tablet className="w-3 h-3 text-slate-400" />
                        ) : (
                          <Monitor className="w-3 h-3 text-slate-400" />
                        )}
                        <span>
                          {item.browserName} • {item.osName}
                        </span>
                      </div>
                    </td>

                    {/* SHA-256 */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-mono text-[10px] border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          SHA-256
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.documentSha256, item.id)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                          title="Copiar Hash SHA-256 completo"
                        >
                          {copiedHash === item.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <div
                        className="font-mono text-[10px] text-slate-500 truncate max-w-[140px] mt-0.5"
                        title={item.documentSha256}
                      >
                        {item.documentSha256.substring(0, 16)}...
                      </div>
                    </td>

                    {/* Ações */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedRecord(item)}
                          className="gap-1 text-xs text-purple-700 border-purple-300 hover:bg-purple-50 dark:text-purple-300 dark:border-purple-800 font-semibold"
                          title="Abrir Trilha de Auditoria e Evidências Completas"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Ver Dossiê
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => contractAcceptanceAuditService.downloadCertificatePdf(item)}
                          className="gap-1 text-xs text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                          title="Baixar Comprovante Oficial em PDF"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          PDF
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETALHADO DO DOSSIÊ DE EVIDÊNCIAS INDIVIDUAL */}
      {selectedRecord && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto"
        >
          <div className="max-h-[94vh] w-full max-w-4xl flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150">
            {/* Cabeçalho do Dossiê */}
            <div className="flex items-start justify-between p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400 shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                      Dossiê de Evidências Digitais: {selectedRecord.receiptNumber}
                    </h2>
                    {isVerifying ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                        <Activity className="w-3.5 h-3.5 animate-pulse" />
                        Verificando integridade...
                      </span>
                    ) : integrityResult?.isValid ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        100% Íntegro e Não-Adulterado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Divergência Detectada
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Contrato: <strong>{selectedRecord.contractName}</strong> (v{selectedRecord.contractVersion}) • Aceito
                    por <strong>{selectedRecord.userName}</strong> ({selectedRecord.userEmail})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo Rolável do Dossiê */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
              {/* Box de Integridade e Hash SHA-256 */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-800 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Verificação Criptográfica em Tempo Real</span>
                  </div>
                  <span className="font-mono text-[11px] text-emerald-800 dark:text-emerald-300">
                    MP 2.200-2/2001 & Lei 14.063/2020
                  </span>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div>
                    <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 block">
                      Hash SHA-256 do Documento Original Aceito:
                    </span>
                    <div className="font-mono text-[11px] font-bold break-all bg-white dark:bg-slate-900 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800 select-all">
                      {selectedRecord.documentSha256}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 block">
                      Hash Raiz da Trilha de Auditoria Encadeada (Head Hash):
                    </span>
                    <div className="font-mono text-[11px] font-bold break-all bg-white dark:bg-slate-900 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800 select-all">
                      {selectedRecord.auditChainHeadHash}
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid: Identificação do Contratante e Conexão Técnica */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Dados do Contratante */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-850 space-y-2.5">
                  <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-700">
                    <User className="w-3.5 h-3.5 text-purple-600" />
                    <span>1. Identificação do Titular (Contratante)</span>
                  </div>
                  <div className="space-y-1">
                    <div><strong>Nome Completo:</strong> {selectedRecord.userName}</div>
                    <div><strong>E-mail:</strong> {selectedRecord.userEmail}</div>
                    <div><strong>CPF / CNPJ:</strong> {selectedRecord.userDocument || 'Registrado no cadastro'}</div>
                    <div><strong>Telefone:</strong> {selectedRecord.userPhone || 'Não informado'}</div>
                    <div><strong>Empresa:</strong> {selectedRecord.companyName || 'Empresa Padrão'}</div>
                    <div><strong>Plano:</strong> {selectedRecord.planName || 'Padrão'}</div>
                    <div><strong>Método de Autenticação:</strong> {selectedRecord.authMethod}</div>
                  </div>
                </div>

                {/* 2. Conexão Técnica */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-850 space-y-2.5">
                  <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-700">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    <span>2. Evidências Técnicas da Conexão</span>
                  </div>
                  <div className="space-y-1">
                    <div><strong>Endereço IP:</strong> <span className="font-mono font-bold">{selectedRecord.ipAddress}</span> ({selectedRecord.ipType})</div>
                    <div><strong>Localização Estimada (IP):</strong> {[selectedRecord.geoCity, selectedRecord.geoRegion, selectedRecord.geoCountry].filter(Boolean).join(', ') || 'Brasil'}</div>
                    <div><strong>Dispositivo:</strong> {selectedRecord.deviceType.toUpperCase()} ({selectedRecord.screenResolution})</div>
                    <div><strong>Navegador:</strong> {selectedRecord.browserName} v{selectedRecord.browserVersion}</div>
                    <div><strong>Sistema Operacional:</strong> {selectedRecord.osName} {selectedRecord.osVersion}</div>
                    <div><strong>Fuso Horário:</strong> {selectedRecord.deviceTimezone}</div>
                    <div className="truncate" title={selectedRecord.pageUrl}><strong>Página do Aceite:</strong> {selectedRecord.pageUrl}</div>
                  </div>
                </div>
              </div>

              {/* 3. Manifestação Expressa de Vontade */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-850 space-y-2">
                <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5 pb-1 border-b border-slate-200 dark:border-slate-700">
                  <FileSignature className="w-3.5 h-3.5 text-emerald-600" />
                  <span>3. Manifestação Expressa de Vontade Registrada</span>
                </div>
                <blockquote className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 italic text-slate-600 dark:text-slate-300">
                  &ldquo;{selectedRecord.declarationText}&rdquo;
                </blockquote>
                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                  <span>Data/Hora UTC: <strong className="font-mono">{selectedRecord.acceptedAtUtc}</strong></span>
                  <span>Data/Hora Local: <strong>{selectedRecord.acceptedAtLocal}</strong></span>
                </div>
              </div>

              {/* 4. Transcrição do Documento Aceito */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                    4. Conteúdo Integral Preservado da Versão v{selectedRecord.contractVersion}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {selectedRecord.documentContent.length} caracteres
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto p-3 bg-slate-50/70 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-mono leading-relaxed whitespace-pre-line select-text">
                  {selectedRecord.documentContent}
                </div>
              </div>
            </div>

            {/* Rodapé com Ações de Exportação */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 rounded-b-2xl">
              <span className="text-xs text-slate-500">
                Evidências preservadas com proteção de integridade criptográfica.
              </span>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => contractAcceptanceAuditService.downloadDossierJson(selectedRecord)}
                  className="gap-1.5 text-xs text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-600" />
                  Exportar Dossiê (JSON)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => contractAcceptanceAuditService.downloadForensicDossierPdf(selectedRecord)}
                  className="gap-1.5 text-xs text-purple-700 border-purple-300 hover:bg-purple-50 dark:text-purple-300 dark:border-purple-800 font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar Dossiê Pericial (PDF)
                </Button>
                <Button
                  type="button"
                  onClick={() => contractAcceptanceAuditService.downloadCertificatePdf(selectedRecord)}
                  className="gap-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Comprovante Oficial (PDF)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedRecord(null)}
                  className="text-xs"
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
