import { useRef, useState, type SyntheticEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { Button } from '@shared/components/ui/Button'
import { suggestionService } from '../services/suggestion.service'
import {
  ALLOWED_SUGGESTION_IMAGE_TYPES,
  getSuggestionModuleLabel,
  validateSuggestionImage,
} from '../utils/suggestion.utils'
import {
  SUGGESTION_TYPES,
  SUGGESTION_TYPE_LABELS,
  type SuggestionType,
} from '../types/suggestion.types'
import { Lightbulb, X, ImagePlus } from 'lucide-react'

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
  const [form, setForm] = useState(EMPTY_FORM)
  const [attachment, setAttachment] = useState<File | undefined>()
  const attachmentInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const close = () => {
    if (isSubmitting) return
    setIsOpen(false)
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
    setNotice(result.data.warning ?? 'Sugestão enviada com sucesso. Obrigado pelo seu feedback!')
    window.setTimeout(() => {
      setNotice('')
    }, 6000)
  }

  if (!user) return null

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
      <button
        type="button"
        onClick={() => {
          setIsOpen(true)
        }}
        className="fixed bottom-4 right-4 z-[60] inline-flex min-h-12 items-center gap-2 rounded-full bg-blue-700 px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        aria-label="Enviar sugestão"
      >
        <Lightbulb aria-hidden="true" className="h-5 w-5" />
        <span>Sugestões</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close()
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
            className="max-h-[94dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-xl sm:rounded-2xl sm:p-6"
          >
            <header className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="feedback-dialog-title" className="text-xl font-bold text-slate-900 dark:text-white">
                  Conte para nós
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Sua opinião ajuda a melhorar o OrçaFácil.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <form className="space-y-4" onSubmit={(event) => {
              void submit(event)
            }}>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>Tipo de manifestação <span className="text-rose-600">*</span></span>
                <select
                  required
                  value={form.type}
                  onChange={(event) => {
                    setForm({ ...form, type: event.target.value as SuggestionType })
                  }}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {SUGGESTION_TYPES.map((type) => (
                    <option key={type} value={type}>{SUGGESTION_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>Título <span className="text-rose-600">*</span></span>
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
                <span>Descrição <span className="text-rose-600">*</span></span>
                <textarea
                  required
                  minLength={10}
                  maxLength={10000}
                  rows={5}
                  value={form.description}
                  onChange={(event) => {
                    setForm({ ...form, description: event.target.value })
                  }}
                  placeholder="Explique com suas palavras. Não precisa usar termos técnicos."
                  className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>

              <label className="block space-y-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>Informações adicionais <span className="font-normal text-slate-400">(opcional)</span></span>
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
                <label htmlFor="feedback-image" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Imagem ou print <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <label
                  htmlFor="feedback-image"
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ImagePlus className="h-4 w-4 shrink-0" />
                  <span className="truncate">{attachment?.name ?? 'Escolher imagem (JPG, PNG ou WEBP; até 5 MB)'}</span>
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
                  Enviado por {profile?.displayName || user.email || 'você'} em {currentOrganization?.name || 'sua empresa'}.
                </p>
              </div>

              {error && <p role="alert" className="text-sm font-medium text-rose-600">{error}</p>}

              <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
                <Button type="submit" isLoading={isSubmitting}>Enviar sugestão</Button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
