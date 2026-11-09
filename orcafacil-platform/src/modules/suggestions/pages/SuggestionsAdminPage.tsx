import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { Button } from '@shared/components/ui/Button'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Input } from '@shared/components/ui/Input'
import { suggestionService } from '../services/suggestion.service'
import type {
  FeedbackAttachmentWithUrl,
  SuggestionDetails,
} from '../services/suggestion.service'
import type { FeedbackSuggestion, SuggestionStatus } from '../types/suggestion.types'
import {
  SUGGESTION_STATUSES,
  SUGGESTION_STATUS_LABELS,
  SUGGESTION_TYPE_LABELS,
} from '../types/suggestion.types'
import { getSuggestionStatusTone } from '../utils/suggestion.utils'
import {
  Check,
  ChevronRight,
  Clock3,
  Eye,
  FileImage,
  Loader2,
  MessageSquareText,
  Search,
  Send,
  X,
} from 'lucide-react'

const fieldClass =
  'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function getLocalDate(value: string) {
  const date = new Date(value)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${String(date.getFullYear())}-${month}-${day}`
}

function StatusBadge({ status }: { status: SuggestionStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getSuggestionStatusTone(status)}`}>
      {SUGGESTION_STATUS_LABELS[status]}
    </span>
  )
}

export function SuggestionsAdminPage() {
  const { user, profile } = useAuth()
  const { currentOrganization } = useOrganization()
  const [suggestions, setSuggestions] = useState<FeedbackSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selected, setSelected] = useState<FeedbackSuggestion | null>(null)
  const [details, setDetails] = useState<SuggestionDetails | null>(null)
  const [attachmentUrls, setAttachmentUrls] = useState<FeedbackAttachmentWithUrl[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [statusDraft, setStatusDraft] = useState<SuggestionStatus>('received')
  const [noteDraft, setNoteDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [replyDraft, setReplyDraft] = useState('')
  const [savingReply, setSavingReply] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [suggestionsOrganizationId, setSuggestionsOrganizationId] = useState<string | null>(null)
  const organizationId = currentOrganization?.id
  const isSuggestionsLoading = isLoading || suggestionsOrganizationId !== organizationId

  const loadSuggestions = useCallback(async () => {
    if (!organizationId) {
      setSuggestions([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError('')
    const result = await suggestionService.list(organizationId)
    if (result.success) {
      setSuggestions(result.data)
      setSuggestionsOrganizationId(organizationId)
    }
    else setError(result.error)
    setIsLoading(false)
  }, [organizationId])

  useEffect(() => {
    if (!organizationId) return
    let active = true
    void suggestionService.list(organizationId).then((result) => {
      if (!active) return
      if (result.success) {
        setSuggestions(result.data)
        setSuggestionsOrganizationId(organizationId)
      } else {
        setSuggestions([])
        setSuggestionsOrganizationId(organizationId)
        setError(result.error)
      }
      setIsLoading(false)
    })
    return () => {
      active = false
    }
  }, [organizationId])

  const scopedSuggestions = useMemo(
    () => (suggestionsOrganizationId === organizationId ? suggestions : []),
    [suggestionsOrganizationId, organizationId, suggestions],
  )

  const filteredSuggestions = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('pt-BR')
    return scopedSuggestions.filter((item) => {
      const matchesSearch =
        !search ||
        item.title.toLocaleLowerCase('pt-BR').includes(search) ||
        item.description.toLocaleLowerCase('pt-BR').includes(search)
      const created = getLocalDate(item.created_at)
      const matchesStatus = statusFilter ? item.status === statusFilter : item.status !== 'completed'
      return (
        matchesSearch &&
        matchesStatus &&
        (!typeFilter || item.type === typeFilter) &&
        (!userFilter || item.submitted_by_name === userFilter) &&
        (!moduleFilter || item.module_origin === moduleFilter) &&
        (!fromDate || created >= fromDate) &&
        (!toDate || created <= toDate)
      )
    })
  }, [scopedSuggestions, query, statusFilter, typeFilter, userFilter, moduleFilter, fromDate, toDate])

  const users = useMemo(
    () => [...new Set(scopedSuggestions.map((item) => item.submitted_by_name))].sort((a, b) => a.localeCompare(b)),
    [scopedSuggestions],
  )
  const modules = useMemo(
    () => [...new Set(scopedSuggestions.map((item) => item.module_origin))].sort((a, b) => a.localeCompare(b)),
    [scopedSuggestions],
  )

  const metrics = [
    { label: 'Total recebidas', count: scopedSuggestions.length, icon: MessageSquareText, color: 'text-blue-700 bg-blue-50' },
    { label: 'Pendentes', count: scopedSuggestions.filter((item) => item.status === 'received').length, icon: Clock3, color: 'text-amber-700 bg-amber-50' },
    { label: 'Em análise', count: scopedSuggestions.filter((item) => item.status === 'in_review').length, icon: Search, color: 'text-orange-700 bg-orange-50' },
    { label: 'Em desenvolvimento', count: scopedSuggestions.filter((item) => item.status === 'in_development').length, icon: ChevronRight, color: 'text-violet-700 bg-violet-50' },
    { label: 'Concluídas', count: scopedSuggestions.filter((item) => item.status === 'completed').length, icon: Check, color: 'text-emerald-700 bg-emerald-50' },
  ]

  const openDetails = async (item: FeedbackSuggestion) => {
    setSelected(item)
    setStatusDraft(item.status)
    setDetails(null)
    setAttachmentUrls([])
    setDetailError('')
    setDetailsLoading(true)
    const [result, readResult] = await Promise.all([
      suggestionService.getDetails(item.organization_id, item.id),
      suggestionService.markAsRead(item.organization_id, item.id),
    ])
    if (readResult.success) {
      window.dispatchEvent(
        new CustomEvent('feedback-unread-count-changed', {
          detail: { organizationId: item.organization_id, count: readResult.data },
        }),
      )
    } else {
      setDetailError(readResult.error)
    }
    if (!result.success) {
      setDetailError((previous) => [previous, result.error].filter(Boolean).join(' '))
      setDetailsLoading(false)
      return
    }
    setDetails(result.data)
    const urls = await Promise.all(result.data.attachments.map(async (attachment) => {
      const urlResult = await suggestionService.getAttachmentUrl(attachment.storage_path)
      return urlResult.success ? { ...attachment, url: urlResult.data } : null
    }))
    const validUrls = urls.filter((attachment): attachment is FeedbackAttachmentWithUrl => attachment !== null)
    if (validUrls.length !== result.data.attachments.length) {
      setDetailError((previous) =>
        [previous, 'Não foi possível abrir um ou mais anexos.'].filter(Boolean).join(' '),
      )
    }
    setAttachmentUrls(validUrls)
    setDetailsLoading(false)
  }

  const refreshSelectedDetails = async () => {
    if (!selected || !currentOrganization) return
    const result = await suggestionService.getDetails(currentOrganization.id, selected.id)
    if (result.success) setDetails(result.data)
    else setDetailError(result.error)
  }

  const saveStatus = async () => {
    if (!selected || !currentOrganization || statusDraft === selected.status) return
    setSavingStatus(true)
    setDetailError('')
    const result = await suggestionService.updateStatus(currentOrganization.id, selected.id, statusDraft)
    setSavingStatus(false)
    if (!result.success) {
      setDetailError(result.error)
      return
    }
    const updated = { ...selected, status: statusDraft, updated_at: new Date().toISOString() }
    setSelected(updated)
    setSuggestions((items) => items.map((item) => (item.id === selected.id ? updated : item)))
    await refreshSelectedDetails()
  }

  const addNote = async () => {
    if (!selected || !currentOrganization || !user || !noteDraft.trim()) return
    setSavingNote(true)
    setDetailError('')
    const result = await suggestionService.addInternalNote(
      currentOrganization.id,
      selected.id,
      user.id,
      noteDraft,
    )
    setSavingNote(false)
    if (!result.success) {
      setDetailError(result.error)
      return
    }
    setNoteDraft('')
    await refreshSelectedDetails()
  }

  const sendReply = async () => {
    if (!selected || !currentOrganization || !user || !replyDraft.trim()) return
    setSavingReply(true)
    setDetailError('')
    const senderName = profile?.displayName || user.email?.split('@')[0] || 'Proprietário'
    const result = await suggestionService.sendMessage(
      currentOrganization.id,
      selected.id,
      senderName,
      replyDraft,
      'owner',
    )
    setSavingReply(false)
    if (!result.success) {
      setDetailError(result.error)
      return
    }
    setReplyDraft('')
    await refreshSelectedDetails()
  }

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-700">Configurações de Desenvolvedor</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Suporte</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Acompanhe os chamados, dúvidas e solicitações de suporte enviadas pela equipe de {currentOrganization?.name ?? 'sua empresa'}.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => { void loadSuggestions() }} isLoading={isSuggestionsLoading}>
          Atualizar lista
        </Button>
      </header>

      <section aria-label="Indicadores de sugestões" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {metrics.map(({ label, count, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-bold text-slate-900 dark:text-white">{count}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                aria-label="Pesquisar por título ou descrição"
                value={query}
                onChange={(event) => { setQuery(event.target.value); }}
                placeholder="Pesquisar título ou descrição"
                className={`${fieldClass} pl-9`}
              />
            </label>
            <select aria-label="Filtrar por status" className={fieldClass} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); }}>
              <option value="">Todos os status</option>
              {SUGGESTION_STATUSES.map((status) => <option key={status} value={status}>{SUGGESTION_STATUS_LABELS[status]}</option>)}
            </select>
            <select aria-label="Filtrar por tipo" className={fieldClass} value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); }}>
              <option value="">Todos os tipos</option>
              {Object.entries(SUGGESTION_TYPE_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
            </select>
            <select aria-label="Filtrar por usuário" className={fieldClass} value={userFilter} onChange={(event) => { setUserFilter(event.target.value); }}>
              <option value="">Todos os usuários</option>
              {users.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select aria-label="Filtrar por módulo" className={fieldClass} value={moduleFilter} onChange={(event) => { setModuleFilter(event.target.value); }}>
              <option value="">Todos os módulos</option>
              {modules.map((module) => <option key={module} value={module}>{module}</option>)}
            </select>
            <Input aria-label="Enviadas a partir de" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); }} />
            <Input aria-label="Enviadas até" type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); }} />
          </div>

          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {isSuggestionsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="py-12 text-center">
              <MessageSquareText className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                {scopedSuggestions.length ? 'Nenhuma sugestão corresponde aos filtros.' : 'Ainda não há sugestões recebidas.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/70 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Número / título</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Enviado por</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Origem</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"><span className="sr-only">Ação</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSuggestions.map((item) => (
                    <tr key={item.id} className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60">
                      <td className="max-w-[280px] px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">#{item.id.slice(0, 8).toUpperCase()}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {SUGGESTION_TYPE_LABELS[item.type]}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.submitted_by_name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(item.created_at)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.module_origin}</td>
                      <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-4 py-3">
                        <Button type="button" variant="outline" size="sm" onClick={() => { void openDetails(item) }}>
                          <Eye className="h-4 w-4" /> Detalhes
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!isSuggestionsLoading && (
            <p className="text-xs text-slate-500">
              Exibindo {filteredSuggestions.length} de {scopedSuggestions.length} sugestões desta empresa.
            </p>
          )}
        </CardContent>
      </Card>

      {selected && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="suggestion-detail-title"
            className="max-h-[95dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-3xl sm:rounded-2xl sm:p-6"
          >
            <header className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Sugestão #{selected.id.slice(0, 8).toUpperCase()}
                </p>
                <h2 id="suggestion-detail-title" className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {selected.title}
                </h2>
              </div>
              <button type="button" aria-label="Fechar detalhes" onClick={() => { setSelected(null); }} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </header>

            {detailsLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60 sm:grid-cols-2">
                  <p><span className="text-slate-500">Tipo:</span> <strong>{SUGGESTION_TYPE_LABELS[selected.type]}</strong></p>
                  <p><span className="text-slate-500">Enviado por:</span> <strong>{selected.submitted_by_name}</strong></p>
                  <p><span className="text-slate-500">Empresa:</span> <strong>{selected.organization_name}</strong></p>
                  <p><span className="text-slate-500">Data:</span> <strong>{formatDate(selected.created_at)}</strong></p>
                  <p><span className="text-slate-500">Módulo:</span> <strong>{selected.module_origin}</strong></p>
                  <p className="break-all"><span className="text-slate-500">Rota:</span> <strong>{selected.origin_route}</strong></p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Descrição</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{selected.description}</p>
                </div>
                {selected.additional_info && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Informações adicionais</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{selected.additional_info}</p>
                  </div>
                )}

                {attachmentUrls.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Imagens anexadas</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {attachmentUrls.map((attachment) => (
                        <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                          <img src={attachment.url} alt={attachment.original_name} className="aspect-video w-full object-cover transition group-hover:scale-[1.02]" />
                          <span className="flex items-center gap-1 truncate p-2 text-xs text-slate-600 dark:text-slate-300"><FileImage className="h-3.5 w-3.5 shrink-0" />{attachment.original_name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-950 dark:bg-blue-950/20">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Atualizar andamento</h3>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <select aria-label="Novo status" className={fieldClass} value={statusDraft} onChange={(event) => { setStatusDraft(event.target.value as SuggestionStatus); }}>
                      {SUGGESTION_STATUSES.map((status) => <option key={status} value={status}>{SUGGESTION_STATUS_LABELS[status]}</option>)}
                    </select>
                    <Button type="button" onClick={() => void saveStatus()} isLoading={savingStatus} disabled={statusDraft === selected.status}>
                      Atualizar status
                    </Button>
                  </div>
                </div>

                {/* CONVERSA / RESPOSTA DIRETA AO USUÁRIO */}
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                        Conversa com o Usuário ({selected.submitted_by_name || 'Autor'})
                      </h3>
                      <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80">
                        As respostas enviadas aqui notificam o usuário na tela dele em tempo real.
                      </p>
                    </div>
                  </div>

                  {/* Mensagens trocadas */}
                  {details?.messages && details.messages.length > 0 ? (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto p-1">
                      {details.messages.map((msg) => {
                        const isFromOwner = msg.sender_role === 'owner'
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col rounded-xl p-3 text-xs sm:text-sm ${
                              isFromOwner
                                ? 'ml-auto max-w-[85%] bg-blue-600 text-white shadow-xs'
                                : 'mr-auto max-w-[85%] bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={`text-[11px] font-bold ${isFromOwner ? 'text-blue-100' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                {isFromOwner ? 'Você (Proprietário)' : msg.sender_name}
                              </span>
                              <span className={`text-[10px] ${isFromOwner ? 'text-blue-200' : 'text-slate-400'}`}>
                                {formatDate(msg.created_at)}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic bg-white/70 dark:bg-slate-900/50 p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                      Nenhuma resposta enviada ao usuário ainda. Envie uma mensagem abaixo para notificá-lo.
                    </p>
                  )}

                  {/* Campo de resposta */}
                  <div className="flex flex-col gap-2">
                    <textarea
                      rows={2}
                      maxLength={5000}
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder={`Escreva sua resposta para ${selected.submitted_by_name || 'o usuário'}...`}
                      className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm dark:border-indigo-900 dark:bg-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        onClick={() => void sendReply()}
                        isLoading={savingReply}
                        disabled={!replyDraft.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        <Send className="h-4 w-4" /> Responder ao Usuário
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Observações internas</h3>
                  <p className="mt-1 text-xs text-slate-500">Visíveis somente aos proprietários desta empresa.</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                    <textarea
                      rows={2}
                      maxLength={5000}
                      value={noteDraft}
                      onChange={(event) => { setNoteDraft(event.target.value); }}
                      placeholder="Registre uma decisão ou informação sobre o andamento"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <Button type="button" onClick={() => void addNote()} isLoading={savingNote} disabled={!noteDraft.trim()}>
                      <Send className="h-4 w-4" /> Registrar
                    </Button>
                  </div>
                  {details?.notes.length ? (
                    <ul className="mt-4 space-y-2">
                      {details.notes.map((note) => (
                        <li key={note.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                          <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{note.content}</p>
                          <p className="mt-2 text-xs text-slate-500">{formatDate(note.created_at)} · Proprietário {note.owner_id.slice(0, 8)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-3 text-sm text-slate-500">Nenhuma observação interna registrada.</p>}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Histórico de alterações</h3>
                  {details?.history.length ? (
                    <ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4 dark:border-slate-700">
                      {details.history.map((entry) => (
                        <li key={entry.id} className="relative">
                          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-600" />
                          <p className="text-sm text-slate-700 dark:text-slate-200">
                            {entry.previous_status
                              ? `${SUGGESTION_STATUS_LABELS[entry.previous_status]} → ${SUGGESTION_STATUS_LABELS[entry.new_status]}`
                              : `Sugestão ${SUGGESTION_STATUS_LABELS[entry.new_status].toLocaleLowerCase('pt-BR')}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(entry.created_at)} · {entry.changed_by ? `Usuário ${entry.changed_by.slice(0, 8)}` : 'Sistema'}
                          </p>
                          {entry.observation && <p className="mt-1 text-sm text-slate-600">{entry.observation}</p>}
                        </li>
                      ))}
                    </ol>
                  ) : <p className="mt-3 text-sm text-slate-500">Nenhuma alteração registrada.</p>}
                </div>

                {detailError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{detailError}</p>}
                <footer className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
                  <Button type="button" variant="outline" onClick={() => { setSelected(null); }}>Fechar</Button>
                </footer>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
