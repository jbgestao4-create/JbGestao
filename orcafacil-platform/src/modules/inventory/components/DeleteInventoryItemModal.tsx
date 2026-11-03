import { useEffect, useState, type MouseEvent, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import type { InventoryItem } from '@shared/types/common'

export interface DeleteInventoryItemModalProps {
  open: boolean
  item: InventoryItem | null
  isDeleting: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}

function formatQuantity(value: string) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(Number(value))
}

interface DialogContentProps {
  item: InventoryItem
  isDeleting: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}

function DeleteInventoryItemDialog({
  item,
  isDeleting,
  onClose,
  onConfirm,
}: DialogContentProps) {
  const [reason, setReason] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeleting) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [isDeleting, onClose])

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !isDeleting) {
      onClose()
    }
  }

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = reason.trim()
    if (!trimmed) {
      setErrorMessage('Por favor, informe o motivo da exclusão.')
      return
    }
    if (trimmed.length < 3) {
      setErrorMessage('O motivo deve conter pelo menos 3 caracteres.')
      return
    }

    setErrorMessage('')
    await onConfirm(trimmed)
  }

  const hasStock = Number(item.quantityOnHand) > 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-inventory-modal-title"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 animate-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="flex items-start gap-3.5">
          <div className="rounded-xl bg-red-100 p-2.5 text-red-600">
            <Trash2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="delete-inventory-modal-title"
              className="text-lg font-bold text-gray-900"
            >
              Excluir Produto do Estoque
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Esta ação removerá o produto da listagem de estoque.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">{item.name}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {item.sku && <span>Código: <strong>#{item.sku}</strong></span>}
            <span>Unidade: <strong>{item.unit}</strong></span>
            <span>Saldo: <strong>{formatQuantity(item.quantityOnHand)} {item.unit}</strong></span>
          </div>
        </div>

        {hasStock && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
            <div>
              <strong>Atenção:</strong> Este produto possui <strong>{formatQuantity(item.quantityOnHand)} {item.unit}</strong> em saldo atual de estoque. Ao confirmar, o produto será retirado de circulação.
            </div>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="delete-reason-input"
              className="block text-sm font-semibold text-gray-700"
            >
              Motivo da exclusão <span className="text-red-500">*</span>
            </label>
            <textarea
              id="delete-reason-input"
              rows={3}
              required
              disabled={isDeleting}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (errorMessage) setErrorMessage('')
              }}
              placeholder="Ex: Produto descontinuado pelo fornecedor, cadastro duplicado por engano..."
              className="mt-1.5 w-full rounded-xl border border-gray-300 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:bg-gray-100 disabled:opacity-75"
            />
            {errorMessage && (
              <p className="mt-1.5 text-xs font-medium text-red-600">{errorMessage}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
            >
              {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function DeleteInventoryItemModal({
  open,
  item,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteInventoryItemModalProps) {
  if (!open || !item) return null

  return createPortal(
    <DeleteInventoryItemDialog
      key={item.id}
      item={item}
      isDeleting={isDeleting}
      onClose={onClose}
      onConfirm={onConfirm}
    />,
    document.body,
  )
}
