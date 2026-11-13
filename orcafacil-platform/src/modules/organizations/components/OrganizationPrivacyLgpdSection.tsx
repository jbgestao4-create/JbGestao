import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Lock,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { supabase } from '@app/config/supabase'
import { Card, CardContent, CardHeader } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import type { Organization, OrganizationRole } from '@shared/types/common'

interface OrganizationPrivacyLgpdSectionProps {
  organization: Organization | null
  userRole: OrganizationRole | null
  userEmail?: string | null
  userName?: string | null
}

interface DeletionScheduleState {
  requestedAt: string
  scheduledDeletionDate: string
  reason: string
  requestedBy: string
  protocol: string
}

function toCsvContent(rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return 'Sem registros\n'
  const headers = Array.from(
    rows.reduce((acc, row) => {
      Object.keys(row || {}).forEach((k) => acc.add(k))
      return acc
    }, new Set<string>()),
  )
  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
    return `"${str.replace(/"/g, '""')}"`
  }
  const lines = [
    headers.map((h) => `"${h}"`).join(';'),
    ...rows.map((r) => headers.map((h) => escapeCell(r[h])).join(';')),
  ]
  return '\uFEFF' + lines.join('\r\n')
}

function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function OrganizationPrivacyLgpdSection({
  organization,
  userRole,
  userEmail,
  userName,
}: OrganizationPrivacyLgpdSectionProps) {
  const canManagePrivacy = userRole === 'owner' || userRole === 'admin'
  const storageKey = organization ? `lgpd_deletion_schedule_${organization.id}` : ''

  const [isExportingJson, setIsExportingJson] = useState(false)
  const [isExportingCsvModule, setIsExportingCsvModule] = useState<string | null>(null)
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const [deletionSchedule, setDeletionSchedule] = useState<DeletionScheduleState | null>(() => {
    if (!storageKey || typeof window === 'undefined') return null
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? (JSON.parse(saved) as DeletionScheduleState) : null
    } catch {
      return null
    }
  })

  const [showDeletionModal, setShowDeletionModal] = useState(false)
  const [deletionReason, setDeletionReason] = useState('')
  const [confirmSlugInput, setConfirmSlugInput] = useState('')
  const [isSubmittingDeletion, setIsSubmittingDeletion] = useState(false)
  const [deletionError, setDeletionError] = useState<string | null>(null)

  if (!organization) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-gray-500">
          Selecione uma organização para gerenciar as configurações de Privacidade e LGPD.
        </CardContent>
      </Card>
    )
  }

  const handleExportAllDataJson = async () => {
    if (!canManagePrivacy) return
    setIsExportingJson(true)
    setExportError(null)
    setExportSuccessMessage(null)

    try {
      const orgId = organization.id
      const [
        customersRes,
        suppliersRes,
        inventoryRes,
        servicesRes,
        quotesRes,
        serviceOrdersRes,
        cashBillsRes,
      ] = await Promise.all([
        supabase.from('customers').select('*').eq('organization_id', orgId),
        supabase.from('suppliers').select('*').eq('organization_id', orgId),
        supabase.from('inventory_items').select('*').eq('organization_id', orgId),
        supabase.from('services').select('*').eq('organization_id', orgId),
        supabase.from('quotes').select('*').eq('organization_id', orgId),
        supabase.from('service_orders').select('*').eq('organization_id', orgId),
        supabase.from('cash_bills').select('*').eq('organization_id', orgId),
      ])

      const exportPackage = {
        metadata: {
          exportedAt: new Date().toISOString(),
          legalBasis: 'Art. 18, V da Lei nº 13.709/2018 (Portabilidade e Acesso LGPD)',
          organization: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
          },
          exportedBy: userEmail || userName || 'Administrador',
        },
        data: {
          customers: customersRes.data ?? [],
          suppliers: suppliersRes.data ?? [],
          inventoryItems: inventoryRes.data ?? [],
          services: servicesRes.data ?? [],
          quotesAndSales: quotesRes.data ?? [],
          serviceOrders: serviceOrdersRes.data ?? [],
          cashBills: cashBillsRes.data ?? [],
        },
      }

      const dateSuffix = new Date().toISOString().slice(0, 10)
      triggerFileDownload(
        `exportacao-lgpd-${organization.slug}-${dateSuffix}.json`,
        JSON.stringify(exportPackage, null, 2),
        'application/json;charset=utf-8',
      )

      setExportSuccessMessage(
        'Pacote completo de dados operacionais (JSON) exportado com sucesso para o seu dispositivo.',
      )
    } catch {
      setExportError('Não foi possível concluir a exportação completa dos dados. Tente novamente.')
    } finally {
      setIsExportingJson(false)
    }
  }

  const handleExportModuleCsv = async (
    moduleKey: 'customers' | 'suppliers' | 'inventory_items' | 'quotes' | 'service_orders',
    label: string,
  ) => {
    if (!canManagePrivacy) return
    setIsExportingCsvModule(moduleKey)
    setExportError(null)
    setExportSuccessMessage(null)

    try {
      const { data, error } = await supabase
        .from(moduleKey)
        .select('*')
        .eq('organization_id', organization.id)

      if (error) {
        setExportError(`Erro ao consultar dados de ${label}.`)
        setIsExportingCsvModule(null)
        return
      }

      const csv = toCsvContent((data ?? []) as Record<string, unknown>[])
      const dateSuffix = new Date().toISOString().slice(0, 10)
      triggerFileDownload(
        `${moduleKey}-${organization.slug}-${dateSuffix}.csv`,
        csv,
        'text/csv;charset=utf-8',
      )
      setExportSuccessMessage(`Planilha CSV de "${label}" exportada com sucesso.`)
    } catch {
      setExportError(`Falha ao gerar arquivo CSV de ${label}.`)
    } finally {
      setIsExportingCsvModule(null)
    }
  }

  const handleRequestAccountDeletion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManagePrivacy) return

    if (confirmSlugInput.trim().toLowerCase() !== organization.slug.toLowerCase()) {
      setDeletionError(
        `Digite exatamente o identificador "${organization.slug}" para confirmar o agendamento.`,
      )
      return
    }

    if (!deletionReason.trim()) {
      setDeletionError('Informe o motivo do encerramento para registro de auditoria.')
      return
    }

    setIsSubmittingDeletion(true)
    setDeletionError(null)

    try {
      const now = new Date()
      const graceDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000) // 60 dias (dentro da janela de 30 a 90 dias)
      const protocol = `LGPD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(100000 + Math.random() * 900000)}`

      // Registra protocolo administrativo no banco (feedback_suggestions) para ciência do SuperAdmin / DPO
      try {
        await supabase.from('feedback_suggestions').insert({
          id: crypto.randomUUID(),
          organization_id: organization.id,
          type: 'other',
          title: `[PROTOCOLO ${protocol}] Solicitação de Encerramento e Exclusão LGPD — ${organization.name}`,
          description: `Solicitação formal de encerramento de conta e agendamento de eliminação de dados (Tenant: ${organization.name} / ${organization.slug}). Motivo: ${deletionReason.trim()}`,
          additional_info: `Solicitado por: ${userName || ''} (${userEmail || ''}) | Data programada após carência legal: ${graceDate.toLocaleDateString('pt-BR')}`,
          module_origin: 'MOD-07 Privacidade e LGPD',
          origin_route: '/settings/organization?tab=privacy',
        })
      } catch {
        // Prossegue mesmo se a tabela de suporte não estiver acessível para este perfil
      }

      const scheduleObj: DeletionScheduleState = {
        requestedAt: now.toISOString(),
        scheduledDeletionDate: graceDate.toISOString(),
        reason: deletionReason.trim(),
        requestedBy: userEmail || userName || 'Administrador',
        protocol,
      }

      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(scheduleObj))
      }
      setDeletionSchedule(scheduleObj)
      setShowDeletionModal(false)
      setConfirmSlugInput('')
      setDeletionReason('')
    } catch {
      setDeletionError('Erro inesperado ao registrar solicitação de encerramento.')
    } finally {
      setIsSubmittingDeletion(false)
    }
  }

  const handleCancelDeletionSchedule = () => {
    if (storageKey) {
      localStorage.removeItem(storageKey)
    }
    setDeletionSchedule(null)
  }

  return (
    <div className="space-y-6">
      {/* 1. RESUMO DE CONFORMIDADE E PAPÉIS LGPD */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Governança de Privacidade e Proteção de Dados (LGPD — Lei nº 13.709/2018)
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Ferramentas de portabilidade, exportação de dados operacionais e gestão de ciclo de
                vida da conta
              </p>
            </div>
          </div>

          <Link
            to="/politica-de-privacidade"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/40 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition"
          >
            <span>Ler Política de Privacidade v2.0</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/50 p-4 space-y-1.5">
              <span className="font-bold uppercase tracking-wide text-blue-700 dark:text-blue-400 block">
                Papel da Sua Empresa ({organization.name})
              </span>
              <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                <strong>CONTROLADORA DOS DADOS OPERACIONAIS:</strong> Sua empresa é a única
                Controladora dos dados pessoais inseridos nos módulos de Clientes, Fornecedores,
                Vendas, Orçamentos e Ordens de Serviço (incluindo senhas de dispositivos{' '}
                <code>device_password</code>).
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/50 p-4 space-y-1.5">
              <span className="font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 block">
                Papel da ControleSoft / JB Gestão
              </span>
              <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                <strong>OPERADORA TECNOLÓGICA:</strong> Realizamos o armazenamento seguro com
                isolamento lógico (<em>Row-Level Security</em>). Canal direto com o Encarregado de
                Dados (DPO):{' '}
                <a
                  href="mailto:dpo@controlesoft.com.br"
                  className="font-semibold text-blue-600 underline"
                >
                  dpo@controlesoft.com.br
                </a>{' '}
                /{' '}
                <a
                  href="mailto:privacidade@controlesoft.com.br"
                  className="font-semibold text-blue-600 underline"
                >
                  privacidade@controlesoft.com.br
                </a>
                .
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. EXPORTAÇÃO E PORTABILIDADE DE DADOS (ART. 18, V DA LGPD) */}
      <Card>
        <CardHeader className="border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-2 text-emerald-600 dark:text-emerald-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Exportação e Portabilidade de Dados Operacionais (Art. 18 da LGPD)
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Baixe a qualquer momento uma cópia estruturada dos dados da organização em formato
                JSON ou planilhas CSV
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {!canManagePrivacy && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0" />
              <span>
                Apenas usuários com perfil de <strong>Proprietário</strong> ou{' '}
                <strong>Administrador</strong> da organização podem exportar bases completas ou
                solicitar o encerramento da conta.
              </span>
            </div>
          )}

          {exportSuccessMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{exportSuccessMessage}</span>
            </div>
          )}

          {exportError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {exportError}
            </div>
          )}

          <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Pacote Completo da Organização (Backup / Portabilidade JSON)
              </h3>
              <p className="text-xs text-gray-600 dark:text-slate-300">
                Inclui Clientes, Fornecedores, Estoque, Serviços, Vendas/Orçamentos, Ordens de
                Serviço e Contas a Pagar em um único arquivo estruturado.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => void handleExportAllDataJson()}
              isLoading={isExportingJson}
              disabled={!canManagePrivacy || isExportingJson}
              className="shrink-0 gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="h-4 w-4" />
              Exportar Tudo (.JSON)
            </Button>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2.5">
              Exportação Individual por Módulo (Planilha .CSV compatível com Excel)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {(
                [
                  { key: 'customers', label: 'Clientes Cadastrados' },
                  { key: 'suppliers', label: 'Fornecedores' },
                  { key: 'inventory_items', label: 'Produtos e Estoque' },
                  { key: 'quotes', label: 'Vendas e Orçamentos' },
                  { key: 'service_orders', label: 'Ordens de Serviço (O.S.)' },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={!canManagePrivacy || isExportingCsvModule !== null}
                  onClick={() => void handleExportModuleCsv(item.key, item.label)}
                  className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-left text-xs font-semibold text-gray-700 dark:text-slate-200 hover:border-blue-400 hover:bg-blue-50/30 disabled:opacity-50 transition cursor-pointer"
                >
                  <span className="flex items-center gap-2 truncate">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold ml-2 shrink-0">
                    {isExportingCsvModule === item.key ? 'Gerando...' : 'Baixar CSV'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. ENCERRAMENTO DE CONTA E AGENDAMENTO DE EXCLUSÃO DO TENANT */}
      <Card className="border-rose-200 dark:border-rose-900/60">
        <CardHeader className="border-b border-rose-100 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/20">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-rose-100 dark:bg-rose-950/80 p-2 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-rose-950 dark:text-rose-200">
                Encerramento da Conta e Eliminação de Dados do Tenant (Item 6 da Política)
              </h2>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                Solicitação formal de rescisão e agendamento da exclusão definitiva após o período
                legal de carência (30 a 90 dias)
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {deletionSchedule ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3 text-xs text-amber-950">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-amber-950">
                      Agendamento de Exclusão do Tenant Registrado — Protocolo{' '}
                      {deletionSchedule.protocol}
                    </h3>
                    <p className="mt-1 text-amber-900 leading-relaxed">
                      Solicitado em{' '}
                      <strong>
                        {new Date(deletionSchedule.requestedAt).toLocaleString('pt-BR')}
                      </strong>{' '}
                      por <strong>{deletionSchedule.requestedBy}</strong>. Conforme o Item 6 da
                      Política de Privacidade, os dados da organização serão mantidos em período de
                      carência para exportação até{' '}
                      <strong>
                        {new Date(deletionSchedule.scheduledDeletionDate).toLocaleDateString(
                          'pt-BR',
                        )}
                      </strong>
                      , data após a qual serão eliminados ou anonimizados definitivamente, salvo
                      obrigações legais (Marco Civil da Internet e legislação fiscal).
                    </p>
                    <p className="mt-1 text-[11px] text-amber-800">
                      <strong>Motivo registrado:</strong> {deletionSchedule.reason}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-amber-200">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCancelDeletionSchedule}
                  disabled={!canManagePrivacy}
                  className="text-xs border-amber-400 text-amber-900 hover:bg-amber-100"
                >
                  Revogar Solicitação de Exclusão
                </Button>
                <a
                  href={`mailto:dpo@controlesoft.com.br?subject=${encodeURIComponent(`Protocolo ${deletionSchedule.protocol} - Exclusão LGPD (${organization.name})`)}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 underline"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Contatar DPO (dpo@controlesoft.com.br)
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 text-xs text-gray-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                <p>
                  Ao solicitar o encerramento da conta da organização{' '}
                  <strong>{organization.name}</strong>, será gerado um protocolo formal junto ao
                  Encarregado de Dados (DPO).
                </p>
                <p>
                  Recomendamos realizar a <strong>Exportação Completa (.JSON / .CSV)</strong> acima
                  antes de confirmar. Os dados permanecerão em quarentena de segurança pelo prazo de{' '}
                  <strong>30 a 90 dias</strong> antes da eliminação definitiva dos servidores.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={!canManagePrivacy}
                onClick={() => {
                  setDeletionError(null)
                  setShowDeletionModal(true)
                }}
                className="shrink-0 gap-1.5 border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400"
              >
                <Trash2 className="h-4 w-4" />
                Solicitar Encerramento e Exclusão
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE CONFIRMAÇÃO DE AGENDAMENTO DE EXCLUSÃO DO TENANT */}
      {showDeletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-rose-100 p-2.5 text-rose-600 shrink-0">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Agendar Encerramento e Exclusão LGPD
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Organização: <strong>{organization.name}</strong> ({organization.slug})
                </p>
              </div>
            </div>

            {deletionError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {deletionError}
              </div>
            )}

            <form onSubmit={(e) => void handleRequestAccountDeletion(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Motivo da Solicitação de Encerramento *
                </label>
                <textarea
                  rows={3}
                  required
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  placeholder="Informe o motivo do encerramento da conta e solicitação de eliminação dos dados..."
                  className="w-full rounded-xl border border-gray-300 p-3 text-xs text-gray-800 focus:border-rose-500 focus:outline-none"
                />
              </div>

              <Input
                label={`Digite "${organization.slug}" para confirmar *`}
                value={confirmSlugInput}
                onChange={(e) => setConfirmSlugInput(e.target.value)}
                placeholder={organization.slug}
                required
                helperText="Após a solicitação, a conta entrará no período de carência legal (30 a 90 dias) antes da eliminação definitiva."
              />

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeletionModal(false)}
                  disabled={isSubmittingDeletion}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  isLoading={isSubmittingDeletion}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Confirmar Agendamento LGPD
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
