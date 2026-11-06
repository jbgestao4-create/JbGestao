import { useCallback, useEffect, useState, type SubmitEvent } from 'react'
import { ArrowLeft, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { CompanyModulesSelector } from './CompanyModulesSelector'
import {
  accessPlanService,
  type AccessPlan,
} from '../services/access-plan.service'
import type { DashboardModuleCode } from '@shared/types/common'

interface ManageAccessPlansModalProps {
  open: boolean
  companyName: string
  assignedPlanId: string | null
  assignedModuleCodes: DashboardModuleCode[]
  onClose: () => void
  onChanged: () => Promise<void>
  onAssign: (plan: AccessPlan) => Promise<boolean>
}

export function ManageAccessPlansModal({
  open,
  companyName,
  assignedPlanId,
  assignedModuleCodes,
  onClose,
  onChanged,
  onAssign,
}: ManageAccessPlansModalProps) {
  const [plans, setPlans] = useState<AccessPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [editingPlan, setEditingPlan] = useState<AccessPlan | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [modules, setModules] = useState<DashboardModuleCode[]>([])
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId)
  const isSameAssignment =
    selectedPlan?.id === assignedPlanId &&
    selectedPlan.modules.length === assignedModuleCodes.length &&
    selectedPlan.modules.every((code) => assignedModuleCodes.includes(code))

  const loadPlans = useCallback(async () => {
    const result = await accessPlanService.list()
    if (result.success) setPlans(result.data)
    else setError(result.error)
  }, [])

  useEffect(() => {
    if (open) void Promise.resolve().then(loadPlans)
  }, [loadPlans, open])

  if (!open) return null

  const resetForm = () => {
    setIsFormOpen(false)
    setEditingPlan(null)
    setName('')
    setDescription('')
    setModules([])
    setIsActive(true)
    setError('')
  }

  const startEditing = (plan?: AccessPlan) => {
    setEditingPlan(plan ?? null)
    setIsFormOpen(true)
    setName(plan?.name ?? '')
    setDescription(plan?.description ?? '')
    setModules(plan?.modules ?? [])
    setIsActive(plan?.isActive ?? true)
    setError('')
  }

  const handleSave = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Informe o nome do plano.')
      return
    }
    setIsLoading(true)
    setError('')
    const result = await accessPlanService.save({
      id: editingPlan?.id,
      name,
      description,
      modules,
      isActive,
    })
    if (result.success) {
      await loadPlans()
      await onChanged()
      resetForm()
    } else {
      setError(result.error)
    }
    setIsLoading(false)
  }

  const handleDelete = async (plan: AccessPlan) => {
    if (!window.confirm(`Remover o plano "${plan.name}"?`)) return
    setIsLoading(true)
    const result = await accessPlanService.remove(plan.id)
    if (result.success) {
      await loadPlans()
      await onChanged()
      if (editingPlan?.id === plan.id) resetForm()
    } else {
      setError(result.error)
    }
    setIsLoading(false)
  }

  const handleAssign = async () => {
    if (!selectedPlan || !selectedPlan.isActive || selectedPlan.isLocked) return
    setIsLoading(true)
    setError('')
    const assigned = await onAssign(selectedPlan)
    if (!assigned) setError('Não foi possível definir o plano para esta empresa.')
    setIsLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-plans-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b p-5">
          <div>
            <h2 id="access-plans-title" className="text-lg font-bold text-gray-900">
              {isFormOpen
                ? editingPlan
                  ? 'Editar plano de acesso'
                  : 'Novo plano de acesso'
                : 'Gerenciar planos de acesso'}
            </h2>
            <p className="text-xs text-gray-500">
              {isFormOpen
                ? 'Defina o nome, a descrição e os recursos liberados.'
                : 'Selecione um plano para a empresa ou edite os planos existentes.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>

        {isFormOpen ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <form
              onSubmit={(event) => {
                void handleSave(event)
              }}
              className="space-y-4"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetForm}
                disabled={isLoading}
              >
                <ArrowLeft className="h-4 w-4" /> Voltar aos planos
              </Button>
              <h3 className="text-sm font-bold">
                {editingPlan ? `Editando: ${editingPlan.name}` : 'Cadastrar novo plano'}
              </h3>
              {error && <p role="alert" className="rounded bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
              <label className="block text-xs font-semibold">
                Nome do plano
                <input
                  value={name}
                  onChange={(event) => {
                    setName(event.currentTarget.value)
                  }}
                  maxLength={100}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold">
                Descrição
                <textarea
                  value={description}
                  onChange={(event) => {
                    setDescription(event.currentTarget.value)
                  }}
                  maxLength={500}
                  rows={2}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => {
                    setIsActive(event.currentTarget.checked)
                  }}
                />
                Disponível para seleção
              </label>
              <CompanyModulesSelector
                title="Recursos do plano"
                description="Marque os módulos e funções que este plano libera."
                selectedCodes={modules}
                onChange={setModules}
                disabled={isLoading}
              />
              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="outline" onClick={resetForm} disabled={isLoading}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={isLoading}>
                  Salvar plano
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-600">
                Empresa: <span className="font-semibold text-gray-900">{companyName}</span>
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  startEditing()
                }}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4" /> Novo plano
              </Button>
            </div>
            {error && <p role="alert" className="rounded bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-lg border p-3 ${
                  selectedPlanId === plan.id
                    ? 'border-blue-500 bg-blue-50/60'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlanId(plan.id)
                    }}
                    disabled={!plan.isActive || plan.isLocked || isLoading}
                    className="flex-1 text-left disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <p className="text-sm font-semibold text-gray-900">{plan.name}</p>
                    <p className="text-xs text-gray-500">
                      {plan.isActive ? 'Ativo' : 'Desativado'}{plan.isSystem ? ' • Padrão' : ''}
                    </p>
                    {plan.id === assignedPlanId && (
                      <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                        Plano atual da empresa
                      </p>
                    )}
                  </button>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlanId(plan.id)
                      }}
                      disabled={!plan.isActive || plan.isLocked || isLoading}
                      className="rounded px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Selecionar
                    </button>
                    {!plan.isLocked && (
                      <button
                        type="button"
                        onClick={() => {
                          startEditing(plan)
                        }}
                        title={`Editar ${plan.name}`}
                        className="rounded p-1 text-blue-700 hover:bg-blue-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {!plan.isSystem && !plan.isLocked && (
                      <button
                        type="button"
                        onClick={() => {
                          void handleDelete(plan)
                        }}
                        title={`Remover ${plan.name}`}
                        className="rounded p-1 text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
              {selectedPlan && (
                <p className="text-xs text-gray-600">
                  Plano selecionado: <span className="font-semibold text-gray-900">{selectedPlan.name}</span>
                </p>
              )}
              <Button
                type="button"
                size="sm"
                className="mt-3 w-full"
                onClick={() => {
                  void handleAssign()
                }}
                disabled={!selectedPlan || isSameAssignment || isLoading}
              >
                {selectedPlan?.id === assignedPlanId
                  ? 'Atualizar acessos da empresa'
                  : 'Definir plano para a empresa'}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
