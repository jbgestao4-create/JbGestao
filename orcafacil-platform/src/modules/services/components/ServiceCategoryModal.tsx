import { useState, type FormEvent } from 'react'
import { Button } from '@shared/components/ui/Button'
import { X, Tag, Plus } from 'lucide-react'
import { serviceService, type ServiceCategory } from '../services/service.service'
import type { UUID } from '@shared/types/common'

interface ServiceCategoryModalProps {
  open: boolean
  organizationId: UUID
  onClose: () => void
  onCategoryCreated: (category: ServiceCategory) => void
}

export function ServiceCategoryModal({
  open,
  organizationId,
  onClose,
  onCategoryCreated,
}: ServiceCategoryModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Informe o nome da categoria.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const res = await serviceService.createCategory(organizationId, name, description)
    setIsSubmitting(false)

    if (res.success) {
      setName('')
      setDescription('')
      onCategoryCreated(res.data)
      onClose()
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/50 p-1.5 text-indigo-600 dark:text-indigo-400">
              <Tag className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Nova Categoria de Serviço
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
              Nome da Categoria <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Instalação, Manutenção, Consultoria..."
              className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
              Descrição (opcional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição da categoria..."
              className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Salvar Categoria
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

