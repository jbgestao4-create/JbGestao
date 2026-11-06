import { useState, type SubmitEvent } from 'react'
import {
  Building2,
  Calendar,
  Clock,
  FileText,
  Infinity,
  Lock,
  ShieldAlert,
  Trash2,
  Unlock,
  X,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { formatCNPJ } from '@shared/utils/cnpj'
import {
  companyManagementService,
  normalizeCompanyModules,
  type ManagedCompany,
} from '../services/company-management.service'
import { CompanyModulesSelector } from './CompanyModulesSelector'
import type { DashboardModuleCode } from '@shared/types/common'

interface EditCompanyModalProps {
  company: ManagedCompany | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onDelete?: (company: ManagedCompany) => void
  onOpenUsersModal?: (company: ManagedCompany) => void
}

export function EditCompanyModal({
  company,
  isOpen,
  onClose,
  onSuccess,
  onDelete,
  onOpenUsersModal: _onOpenUsersModal,
}: EditCompanyModalProps) {
  if (!isOpen || !company) return null

  return (
    <EditCompanyForm
      key={company.id}
      company={company}
      onClose={onClose}
      onSuccess={onSuccess}
      onDelete={onDelete}
    />
  )
}

function EditCompanyForm({
  company,
  onClose,
  onSuccess,
  onDelete,
}: Omit<EditCompanyModalProps, 'isOpen' | 'onOpenUsersModal'> & { company: ManagedCompany }) {
  // 1. Dados da Empresa
  const [name, setName] = useState(company.name)
  const [slug, setSlug] = useState(company.slug)
  const [cnpj, setCnpj] = useState(company.cnpj ? formatCNPJ(company.cnpj) : '')
  const [responsible, setResponsible] = useState(company.responsible || '')
  const [address, setAddress] = useState(company.address || '')
  const [notes, setNotes] = useState(company.notes || '')
  const [isActive, setIsActive] = useState<boolean>(company.isActive)

  // Período de teste
  const [isUnlimitedTrial, setIsUnlimitedTrial] = useState<boolean>(!company.trialEndsAt)
  const [trialDateStr, setTrialDateStr] = useState<string>(() => {
    if (company.trialEndsAt) {
      const d = new Date(company.trialEndsAt)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }
    const d = new Date()
    d.setDate(d.getDate() + 15)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  })

  // 2. Módulos / Páginas Liberadas com Filtros Específicos
  const [selectedModules, setSelectedModules] = useState<DashboardModuleCode[]>(() =>
    normalizeCompanyModules(company.modules ?? []),
  )

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Adicionar dias ao período de teste
  const handleAddDays = (days: number) => {
    setIsUnlimitedTrial(false)
    const base = new Date()
    base.setDate(base.getDate() + days)
    const yyyy = base.getFullYear()
    const mm = String(base.getMonth() + 1).padStart(2, '0')
    const dd = String(base.getDate()).padStart(2, '0')
    setTrialDateStr(`${yyyy}-${mm}-${dd}`)
  }

  // Expirar teste imediatamente
  const handleExpireNow = () => {
    setIsUnlimitedTrial(false)
    const past = new Date()
    past.setDate(past.getDate() - 1)
    const yyyy = past.getFullYear()
    const mm = String(past.getMonth() + 1).padStart(2, '0')
    const dd = String(past.getDate()).padStart(2, '0')
    setTrialDateStr(`${yyyy}-${mm}-${dd}`)
  }

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanName = name.trim()
    const cleanSlug = slug.trim().toLowerCase()

    if (cleanName.length < 2) {
      setError('O nome da empresa deve ter pelo menos 2 caracteres.')
      return
    }

    if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
      setError('O identificador deve conter apenas letras minúsculas, números e hífens.')
      return
    }

    let finalTrialEndsAt: string | null = null
    if (!isUnlimitedTrial) {
      if (!trialDateStr) {
        setError('Informe a data de término do período de teste ou marque como Ilimitado.')
        return
      }
      const [year, month, day] = trialDateStr.split('-').map(Number)
      const selected = new Date(year, month - 1, day, 23, 59, 59, 999)
      finalTrialEndsAt = selected.toISOString()
    }

    setIsLoading(true)
    setError(null)

    const result = await companyManagementService.updateCompanyDetails(company.id, {
      name: cleanName,
      slug: cleanSlug,
      cnpj: cnpj.trim(),
      address: address.trim(),
      responsible: responsible.trim(),
      notes: notes.trim(),
      isActive,
      trialEndsAt: finalTrialEndsAt,
      adminName: company.adminName || undefined,
      adminEmail: company.adminEmail || undefined,
      modules: selectedModules,
    })

    setIsLoading(false)

    if (result.success) {
      onSuccess()
      onClose()
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-company-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h2
                id="edit-company-title"
                className="text-lg font-bold text-gray-900 dark:text-white"
              >
                Editar Empresa
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Altere os dados cadastrais da empresa, período de teste e o plano de acesso liberado.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Fechar edição"
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={(event) => {
            void handleSubmit(event)
          }}
          autoComplete="off"
          className="flex-1 overflow-y-auto p-6 space-y-6"
        >
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-800/80 dark:bg-rose-950/50 dark:text-rose-300">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Dados da Empresa e Status */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
              1. Dados da Empresa e Status
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nome da Empresa / Razão Social"
                name="company-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                required
              />
              <Input
                label="Identificador Único (SLUG)"
                name="company-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/\s+/g, '-'))}
                helperText="Chave única de acesso da empresa no sistema."
                maxLength={120}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <Input
                label="CNPJ"
                name="company-cnpj"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(event) => setCnpj(formatCNPJ(event.target.value))}
                maxLength={18}
                autoComplete="off"
              />
              <Input
                label="Responsável Legal"
                name="company-responsible"
                placeholder="Ex: Carlos Eduardo Silva"
                value={responsible}
                onChange={(event) => setResponsible(event.target.value)}
                maxLength={120}
                autoComplete="off"
              />
            </div>

            <div className="mt-4">
              <Input
                label="Endereço Completo"
                name="company-address"
                placeholder="Ex: Av. Brasil, 1500, Centro - São Paulo/SP - CEP 01000-000"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                maxLength={255}
                autoComplete="off"
              />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-gray-400" />
                Observações
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotações internas, particularidades do plano, etc."
                rows={2}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Status de Acesso (Ativo / Desativado) */}
            <div className="mt-4 rounded-xl border border-gray-200 dark:border-slate-800 p-4 bg-gray-50/50 dark:bg-slate-800/40">
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                Status de Acesso à Plataforma
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsActive(true)}
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all ${
                    isActive
                      ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                      : 'border-gray-200 bg-white text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 hover:border-gray-300'
                  }`}
                >
                  <Unlock className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold">Acesso Ativo</div>
                    <div className="text-[11px] opacity-80">Empresa e colaboradores podem acessar normalmente</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsActive(false)}
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all ${
                    !isActive
                      ? 'border-rose-500 bg-rose-50/80 text-rose-900 dark:border-rose-600 dark:bg-rose-950/40 dark:text-rose-300 ring-2 ring-rose-500/20'
                      : 'border-gray-200 bg-white text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 hover:border-gray-300'
                  }`}
                >
                  <Lock className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold">Acesso Desativado</div>
                    <div className="text-[11px] opacity-80">Bloqueia o login e o uso da plataforma para todos</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Período de Teste */}
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/30 dark:border-amber-900/50 dark:bg-amber-950/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Período de Teste
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExpireNow}
                  className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                  title="Configura para ontem para suspender o teste imediatamente"
                >
                  Suspender agora
                </button>
              </div>
            </div>

            {/* Opções de Expiração */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-amber-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="radio"
                    id="edit_trial_limited"
                    name="edit_trial_mode"
                    checked={!isUnlimitedTrial}
                    onChange={() => setIsUnlimitedTrial(false)}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="edit_trial_limited" className="text-xs font-bold text-gray-800 dark:text-slate-200 cursor-pointer">
                    Data de Expiração do Teste
                  </label>
                </div>
                {!isUnlimitedTrial && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={trialDateStr}
                      onChange={(e) => setTrialDateStr(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-amber-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 flex items-center">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="edit_trial_unlimited"
                    name="edit_trial_mode"
                    checked={isUnlimitedTrial}
                    onChange={() => setIsUnlimitedTrial(true)}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="edit_trial_unlimited" className="text-xs font-bold text-gray-800 dark:text-slate-200 cursor-pointer flex items-center gap-1.5">
                    <Infinity className="h-4 w-4 text-emerald-600" />
                    Acesso Ilimitado (Sem expiração)
                  </label>
                </div>
              </div>
            </div>

            {/* Botões rápidos de adição */}
            {!isUnlimitedTrial && (
              <div>
                <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400 block mb-1.5">
                  Atalhos rápidos para adicionar dias:
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {[7, 15, 30, 60, 90].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => handleAddDays(days)}
                      className="rounded-lg border border-amber-200 bg-amber-50/60 py-1 text-center text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                    >
                      +{days}d
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Plano de Acesso */}
          <CompanyModulesSelector
            title="2. Plano de Acesso"
            selectedCodes={selectedModules}
            onChange={setSelectedModules}
            disabled={isLoading}
          />

          {/* Footer Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-100 pt-5 dark:border-slate-800">
            {onDelete ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onClose()
                  onDelete(company)
                }}
                disabled={isLoading}
                className="gap-1.5 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/50"
                title="Excluir esta empresa permanentemente"
              >
                <Trash2 className="h-4 w-4" />
                Excluir Empresa
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {isLoading ? 'Salvando alterações...' : 'Salvar Todas as Informações'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
