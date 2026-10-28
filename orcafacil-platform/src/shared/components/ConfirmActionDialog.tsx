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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
        aria-describedby="confirm-action-description"
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
      >
        <h2 id="confirm-action-title" className="mb-2 text-lg font-bold text-gray-900">
          {title}
        </h2>
        <p id="confirm-action-description" className="mb-5 text-sm text-gray-500">
          {description}
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
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
