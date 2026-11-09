import { useEffect, useState, type FormEvent } from 'react'
import {
  Building2,
  Eye,
  EyeOff,
  FileText,
  ShieldAlert,
  Check,
  UserCheck,
  X,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { formatCNPJ } from '@shared/utils/cnpj'
import {
  companyManagementService,
  getAllPlatformDashboardCodes,
} from '../services/company-management.service'
import { CompanyModulesSelector } from './CompanyModulesSelector'
import type { DashboardModuleCode } from '@shared/types/common'

interface RegisterCompanyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function RegisterCompanyModal({ isOpen, onClose, onSuccess }: RegisterCompanyModalProps) {
  // 1. Dados da Empresa
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [responsible, setResponsible] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  // 2. Administrador
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [isEmailManuallyEdited, setIsEmailManuallyEdited] = useState(false)
  const [isAdminNameManuallyEdited, setIsAdminNameManuallyEdited] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // 3. Módulos e Páginas Liberadas
  const [selectedModules, setSelectedModules] = useState<DashboardModuleCode[]>(() =>
    getAllPlatformDashboardCodes(),
  )

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Garante que todos os campos venham completamente limpos e resetados ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      setName('')
      setSlug('')
      setCnpj('')
      setResponsible('')
      setAddress('')
      setNotes('')
      setAdminName('')
      setAdminEmail('')
      setIsEmailManuallyEdited(false)
      setIsAdminNameManuallyEdited(false)
      setAdminPassword('')
      setShowPassword(false)
      setSelectedModules(getAllPlatformDashboardCodes())
      setError(null)
      setIsLoading(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const generateSlugFromName = (val: string) => {
    return val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleNameChange = (val: string) => {
    setName(val)
    const generatedSlug = generateSlugFromName(val)
    setSlug(generatedSlug)

    // Puxa o e-mail do administrador automaticamente a partir do slug
    if (!isEmailManuallyEdited) {
      setAdminEmail(generatedSlug ? `admin@${generatedSlug}.com` : '')
    }
  }

  const handleSlugChange = (val: string) => {
    const cleanSlug = val.toLowerCase().replace(/\s+/g, '-')
    setSlug(cleanSlug)

    // Atualiza o e-mail puxado automaticamente caso não tenha sido editado manualmente
    if (!isEmailManuallyEdited) {
      setAdminEmail(cleanSlug ? `admin@${cleanSlug}.com` : '')
    }
  }

  const handleResponsibleChange = (val: string) => {
    setResponsible(val)
    // Se o usuário ainda não editou manualmente o nome do administrador, preenche com o responsável
    if (!isAdminNameManuallyEdited) {
      setAdminName(val)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (name.trim().length < 2) {
      setError('O nome da empresa deve ter pelo menos 2 caracteres.')
      return
    }

    if (!slug.trim()) {
      setError('O identificador único (slug) é obrigatório.')
      return
    }

    if (adminName.trim().length < 2) {
      setError('Informe o nome completo do administrador.')
      return
    }

    if (!adminEmail.trim()) {
      setError('Informe o e-mail do administrador.')
      return
    }

    if (adminPassword.trim().length < 6) {
      setError('A senha deve conter no mínimo 6 caracteres.')
      return
    }

    setIsLoading(true)
    const res = await companyManagementService.registerCompanyWithAdmin({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      cnpj: cnpj.trim(),
      address: address.trim(),
      responsible: responsible.trim(),
      notes: notes.trim(),
      adminName: adminName.trim(),
      adminEmail: adminEmail.trim(),
      adminPassword: adminPassword.trim(),
      modules: selectedModules,
    })

    setIsLoading(false)

    if (res.success) {
      onSuccess()
      onClose()
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Cadastrar Nova Empresa
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Criação da empresa e do usuário inicial com permissões de administrador.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} autoComplete="off" className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 dark:border-rose-800/80 dark:bg-rose-950/50 dark:text-rose-300">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Dados da Empresa */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
              1. Dados da Empresa
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nome da Empresa / Razão Social"
                placeholder="Ex: Auto Peças & Serviços Estrela"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                autoComplete="off"
                required
              />
              <Input
                label="Identificador Único (SLUG)"
                placeholder="ex: auto-pecas-estrela"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                helperText="Chave única de acesso da empresa no sistema."
                autoComplete="off"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <Input
                label="CNPJ"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                maxLength={18}
                autoComplete="off"
              />
              <Input
                label="Responsável Legal"
                placeholder="Ex: Carlos Eduardo Silva"
                value={responsible}
                onChange={(e) => handleResponsibleChange(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="mt-4">
              <Input
                label="Endereço Completo"
                placeholder="Ex: Av. Brasil, 1500, Centro - São Paulo/SP - CEP 01000-000"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
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
          </div>

          {/* 2. Usuário Administrador */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                2. Usuário Administrador
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                <UserCheck className="h-3 w-3" /> Perfil Administrador
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nome do Administrador"
                placeholder="Ex: Carlos Eduardo Silva"
                value={adminName}
                onChange={(e) => {
                  setIsAdminNameManuallyEdited(true)
                  setAdminName(e.target.value)
                }}
                autoComplete="off"
                required
              />

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    E-mail de Login do Administrador
                  </label>
                  {adminEmail && !isEmailManuallyEdited && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      <Check className="h-3 w-3" /> Puxado automaticamente
                    </span>
                  )}
                </div>
                <Input
                  type="email"
                  placeholder="admin@empresa.com"
                  value={adminEmail}
                  onChange={(e) => {
                    setIsEmailManuallyEdited(true)
                    setAdminEmail(e.target.value)
                  }}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Senha Inicial de Acesso
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 pr-10 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">
                  O administrador usará este e-mail e senha para acessar a plataforma.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Módulos e Páginas Liberadas com Filtros Específicos */}
          <CompanyModulesSelector
            selectedCodes={selectedModules}
            onChange={setSelectedModules}
            disabled={isLoading}
          />

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading} className="bg-blue-600 hover:bg-blue-700">
              Cadastrar Empresa
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
