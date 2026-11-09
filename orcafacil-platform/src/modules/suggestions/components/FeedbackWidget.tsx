import { useRef, useState, useEffect, useCallback, type SyntheticEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { Button } from '@shared/components/ui/Button'
import { supabase } from '@app/config/supabase'
import { suggestionService } from '../services/suggestion.service'
import {
  ALLOWED_SUGGESTION_IMAGE_TYPES,
  getSuggestionModuleLabel,
  validateSuggestionImage,
} from '../utils/suggestion.utils'
import {
  SUGGESTION_TYPES,
  SUGGESTION_TYPE_LABELS,
  SUGGESTION_STATUS_LABELS,
  type SuggestionType,
  type FeedbackSuggestion,
  type FeedbackMessage,
} from '../types/suggestion.types'
import { Headset, X, ImagePlus, MessageSquare, Send, ArrowLeft } from 'lucide-react'

const EMPTY_FORM = {
  type: 'improvement' as SuggestionType,
  title: '',
  description: '',
  additionalInfo: '',
}

export function FeedbackWidget() {
  const { user, profile } = useAuth()
  const { currentOrganization } = useOrganization()
  const location = useLocation()

  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'new' | 'my_suggestions'>('new')
  const [unreadRepliesCount, setUnreadRepliesCount] = useState(0)

  // Formulário de nova sugestão
  const [form, setForm] = useState(EMPTY_FORM)
  const [attachment, setAttachment] = useState<File | undefined>()
  const attachmentInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Lista de sugestões e conversa do usuário
  const [mySuggestions, setMySuggestions] = useState<FeedbackSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<FeedbackSuggestion | null>(null)
  const [messages, setMessages] = useState<FeedbackMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  const orgId = currentOrganization?.id

  // Carrega contagem de respostas não lidas pelo usuário
  const refreshUnreadReplies = useCallback(async () => {
    if (!orgId || !user) return
    const res = await suggestionService.getUnreadUserCount(orgId)
    if (res.success) {
      setUnreadRepliesCount(res.data)
    }
  }, [orgId, user])

  useEffect(() => {
    void refreshUnreadReplies()

    if (!orgId) return

    // Assina atualizações em tempo real das mensagens
    const channel = supabase
      .channel(`feedback-replies-user-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feedback_messages',
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          void refreshUnreadReplies()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [orgId, refreshUnreadReplies])

  // Carrega sugestões enviadas pelo usuário
  const loadMySuggestions = useCallback(async () => {
    if (!orgId) return
    setLoadingSuggestions(true)
    const res = await suggestionService.listUserSuggestions(orgId)
    if (res.success) {
      setMySuggestions(res.data)
    }
    setLoadingSuggestions(false)
  }, [orgId])

  // Ao abrir o modal
  const handleOpenModal = () => {
    if (unreadRepliesCount > 0) {
      setActiveTab('my_suggestions')
      void loadMySuggestions()
    }
    setIsOpen(true)
  }

  // Ao selecionar uma sugestão para ver conversa
  const handleSelectSuggestion = async (sug: FeedbackSuggestion) => {
    setSelectedSuggestion(sug)
    // Imediatamente marca no estado local como lida para que a notificação pare de aparecer
    setMySuggestions((prev) =>
      prev.map((item) => (item.id === sug.id ? { ...item, has_unread_reply: false } : item))
    )
    setLoadingMessages(true)
    setReplyText('')

    if (orgId) {
      const [msgRes] = await Promise.all([
        suggestionService.listMessages(orgId, sug.id),
        suggestionService.markMessagesReadByUser(orgId, sug.id),
      ])
      if (msgRes.success) {
        setMessages(msgRes.data)
      }
      void refreshUnreadReplies()
    }
    setLoadingMessages(false)
  }

  // Enviar resposta do usuário
  const handleSendUserReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !selectedSuggestion || !replyText.trim() || !user) return

    setSendingReply(true)
    const senderName = profile?.displayName || user.email?.split('@')[0] || 'Você'
    const res = await suggestionService.sendMessage(
      orgId,
      selectedSuggestion.id,
      senderName,
      replyText,
      'user',
    )
    setSendingReply(false)

    if (res.success) {
      setMessages((prev) => [...prev, res.data])
      setReplyText('')
    }
  }

  const close = () => {
    if (isSubmitting || sendingReply) return
    setIsOpen(false)
    setSelectedSuggestion(null)
    setError('')
  }

  const submit = async (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault()
    if (!currentOrganization) {
      setError('Não foi possível identificar sua empresa. Atualize a página e tente novamente.')
      return
    }
    if (form.title.trim().length < 3 || form.description.trim().length < 10) {
      setError('Informe um título com pelo menos 3 caracteres e uma descrição com pelo menos 10.')
      return
    }
    if (attachment) {
      const attachmentError = validateSuggestionImage(attachment)
      if (attachmentError) {
        setError(attachmentError)
        return
      }
    }

    setIsSubmitting(true)
    setError('')
    const result = await suggestionService.submit({
      organizationId: currentOrganization.id,
      type: form.type,
      title: form.title,
      description: form.description,
      additionalInfo: form.additionalInfo,
      moduleOrigin: getSuggestionModuleLabel(location.pathname),
      originRoute: `${location.pathname}${location.search}`.slice(0, 500),
      attachment,
    })
    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    setForm(EMPTY_FORM)
    setAttachment(undefined)
    if (attachmentInput.current) attachmentInput.current.value = ''
    setIsOpen(false)
    setNotice(result.data.warning ?? 'Solicitação de suporte enviada com sucesso!')
    window.setTimeout(() => {
      setNotice('')
    }, 6000)
  }

  if (!user) return null

  const activeUserSuggestions = mySuggestions.filter((s) => s.status !== 'completed')

  return (
    <>
      {notice && (
        <div
          role="status"
          className="fixed bottom-20 right-4 z-[70] max-w-[calc(100vw-2rem)] rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg dark:border-emerald-900 dark:bg-slate-900 dark:text-emerald-300"
        >
          {notice}
        </div>
      )}

      {/* BOTÃO FLUTUANTE DE SUPORTE DO LADO DIREITO */}
      <button
        type="button"
        onClick={handleOpenModal}
        className="fixed bottom-4 right-4 z-[60] inline-flex min-h-12 items-center gap-2 rounded-full bg-blue-700 px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer"
        aria-label="Abrir Suporte"
      >
        <Headset aria-hidden="true" className="h-5 w-5" />
        <span>Suporte</span>

        {/* NOTIFICAÇÃO DE RESPOSTA DO PROPRIETÁRIO */}
        {unreadRepliesCount > 0 && (
          <span
            title={`${unreadRepliesCount} nova(s) resposta(s) da administração`}
            className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-black text-white shadow-md animate-bounce ring-2 ring-white dark:ring-slate-900"
          >
            {unreadRepliesCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4 backdrop-blur-xs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close()
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
            className="max-h-[94dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-2xl sm:rounded-2xl sm:p-6"
          >
            <header className="mb-4 flex items-start justify-between gap-4 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h2 id="feedback-dialog-title" className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedSuggestion ? 'Acompanhar Atendimento' : 'Central de Suporte'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {selectedSuggestion
                    ? 'Conversa direta com a administração sobre este chamado.'
                    : 'Abra chamados de suporte, envie dúvidas ou acompanhe as respostas enviadas pelo proprietário.'}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {/* ABA NAVEGAÇÃO SE NENHUMA SUGESTÃO ESTIVER EXPANDIDA */}
            {!selectedSuggestion && (
              <div className="flex border-b border-slate-200 dark:border-slate-800 mb-4 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('new')}
                  className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'new'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Solicitar Suporte
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('my_suggestions')
                    void loadMySuggestions()
                  }}
                  className={`relative pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'my_suggestions'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Meus Chamados & Respostas</span>
                  {unreadRepliesCount > 0 && (
                    <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                      {unreadRepliesCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* CONTEÚDO 1: DETALHE DA CONVERSA SE SELECIONADA */}
            {selectedSuggestion ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setSelectedSuggestion(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" /> Voltar para lista de sugestões
                </button>

                {/* Card da Sugestão Original */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      {SUGGESTION_STATUS_LABELS[selectedSuggestion.status]}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Enviada em {new Date(selectedSuggestion.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedSuggestion.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {selectedSuggestion.description}
                  </p>
                </div>

                {/* Histórico da Conversa / Respostas */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Respostas da Administração
                  </h4>

                  {loadingMessages ? (
                    <p className="text-xs text-slate-500">Carregando mensagens...</p>
                  ) : messages.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                      Ainda não há respostas da administração para esta sugestão. Assim que responderem, você receberá uma notificação aqui.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-64 overflow-y-auto p-1">
                      {messages.map((msg) => {
                        const isOwner = msg.sender_role === 'owner'
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col rounded-xl p-3 text-xs sm:text-sm ${
                              isOwner
                                ? 'mr-auto max-w-[88%] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-900 shadow-2xs'
                                : 'ml-auto max-w-[88%] bg-blue-600 text-white shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 mb-1">
                              <span className={`text-[11px] font-bold ${isOwner ? 'text-indigo-700 dark:text-indigo-300' : 'text-blue-100'}`}>
                                {isOwner ? 'Resposta do Proprietário' : 'Você'}
                              </span>
                              <span className={`text-[10px] ${isOwner ? 'text-indigo-500' : 'text-blue-200'}`}>
                                {new Date(msg.created_at).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* FORMULÁRIO: RESPONDER NOVAMENTE */}
                  <form onSubmit={handleSendUserReply} className="pt-2 flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Responder novamente ou acrescentar informações:
                    </label>
                    <textarea
                      rows={2}
                      maxLength={5000}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Digite sua resposta para o proprietário..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        isLoading={sendingReply}
                        disabled={!replyText.trim()}
                        className="text-xs"
                      >
                        <Send className="h-3.5 w-3.5 mr-1.5" /> Enviar Resposta
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            ) : activeTab === 'my_suggestions' ? (
              /* CONTEÚDO 2: LISTA DE MEUS CHAMADOS & RESPOSTAS */
              <div className="space-y-3">
                {loadingSuggestions ? (
                  <p className="text-xs text-slate-500 py-6 text-center">Carregando seus chamados...</p>
                ) : activeUserSuggestions.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Você não possui chamados de suporte em aberto.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab('new')}
                      className="text-xs"
                    >
                      Abrir um chamado de suporte
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                    {activeUserSuggestions.map((sug) => (
                      <button
                        key={sug.id}
                        type="button"
                        onClick={() => void handleSelectSuggestion(sug)}
                        className={`w-full text-left rounded-xl border p-3.5 transition-all shadow-2xs flex flex-col gap-2 cursor-pointer ${
                          sug.has_unread_reply
                            ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-700/60 ring-1 ring-emerald-400/50'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {sug.title}
                          </span>
                          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800">
                            {SUGGESTION_STATUS_LABELS[sug.status]}
                          </span>
                        </div>

                        {/* NOTIFICAÇÃO: NOVA RESPOSTA RECEBIDA (some assim que a pessoa abre) */}
                        {sug.has_unread_reply ? (
                          <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-600 text-white shadow-xs animate-pulse ring-2 ring-emerald-200 dark:ring-emerald-900">
                            <span className="h-2 w-2 rounded-full bg-white" />
                            Nova resposta recebida
                          </div>
                        ) : null}

                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                          {sug.description}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                          <span>{new Date(sug.created_at).toLocaleDateString('pt-BR')}</span>
                          <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                            Ver respostas & conversar →
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* CONTEÚDO 3: FORMULÁRIO DE NOVA SUGESTÃO */
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  void submit(event)
                }}
              >
                <label className="block space-y-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span>
                    Tipo de manifestação <span className="text-rose-600">*</span>
                  </span>
                  <select
                    required
                    value={form.type}
                    onChange={(event) => {
                      setForm({ ...form, type: event.target.value as SuggestionType })
                    }}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {SUGGESTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {SUGGESTION_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span>
                    Título <span className="text-rose-600">*</span>
                  </span>
                  <input
                    required
                    minLength={3}
                    maxLength={160}
                    value={form.title}
                    onChange={(event) => {
                      setForm({ ...form, title: event.target.value })
                    }}
                    placeholder="Resuma sua sugestão em poucas palavras"
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </label>

                <label className="block space-y-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span>
                    Descrição <span className="text-rose-600">*</span>
                  </span>
                  <textarea
                    required
                    minLength={10}
                    maxLength={10000}
                    rows={4}
                    value={form.description}
                    onChange={(event) => {
                      setForm({ ...form, description: event.target.value })
                    }}
                    placeholder="Explique com suas palavras. Não precisa usar termos técnicos."
                    className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </label>

                <label className="block space-y-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span>
                    Informações adicionais{' '}
                    <span className="font-normal text-slate-400">(opcional)</span>
                  </span>
                  <textarea
                    maxLength={5000}
                    rows={2}
                    value={form.additionalInfo}
                    onChange={(event) => {
                      setForm({ ...form, additionalInfo: event.target.value })
                    }}
                    placeholder="Inclua algum detalhe que possa ajudar"
                    className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </label>

                <div className="space-y-1.5">
                  <label
                    htmlFor="feedback-image"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    Imagem ou print{' '}
                    <span className="font-normal text-slate-400">(opcional)</span>
                  </label>
                  <label
                    htmlFor="feedback-image"
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ImagePlus className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {attachment?.name ?? 'Escolher imagem (JPG, PNG ou WEBP; até 5 MB)'}
                    </span>
                  </label>
                  <input
                    ref={attachmentInput}
                    id="feedback-image"
                    type="file"
                    accept={ALLOWED_SUGGESTION_IMAGE_TYPES.join(',')}
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      setAttachment(file)
                      setError(file ? validateSuggestionImage(file) ?? '' : '')
                    }}
                  />
                  <p className="text-xs text-slate-500">
                    Enviado por {profile?.displayName || user.email || 'você'} em{' '}
                    {currentOrganization?.name || 'sua empresa'}.
                  </p>
                </div>

                {error && (
                  <p role="alert" className="text-sm font-medium text-rose-600">
                    {error}
                  </p>
                )}

                <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={close}>
                    Cancelar
                  </Button>
                  <Button type="submit" isLoading={isSubmitting}>
                    Enviar sugestão
                  </Button>
                </footer>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  )
}
