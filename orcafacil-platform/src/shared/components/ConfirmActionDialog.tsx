import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@shared/components/ui/Button'
import type { ServiceResult } from '@shared/types/common'

interface ConfirmActionDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => Promise<ServiceResult<void>>
}

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: ConfirmActionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) setError('')
  }, [open])

  if (!open) return null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const result = await onConfirm()
      if (!result.success) setError(result.error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
        aria-describedby="confirm-action-description"
        className="max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 id="confirm-action-title" className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
          {title}
        </h2>
        <p id="confirm-action-description" className="mb-5 text-sm text-gray-500 dark:text-slate-400">
          {description}
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </div>
        )}

        <form onSubmit={(event) => void handleSubmit(event)} className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            autoFocus
          >
            Cancelar
          </Button>
          <Button type="submit" variant="danger" isLoading={isSubmitting}>
            {confirmLabel}
          </Button>
        </form>
      </section>
    </div>
  )
}
