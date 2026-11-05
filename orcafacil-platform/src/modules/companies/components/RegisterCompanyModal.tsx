import { useState, type FormEvent } from 'react'
import {
  Building2,
  Eye,
  EyeOff,
  ShieldAlert,
  UserCheck,
  X,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import {
  ALL_PLATFORM_DASHBOARD_MODULES,
  companyManagementService,
} from '../services/company-management.service'
import type { DashboardModuleCode } from '@shared/types/common'

interface RegisterCompanyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function RegisterCompanyModal({ isOpen, onClose, onSuccess }: RegisterCompanyModalProps) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedModules, setSelectedModules] = useState<DashboardModuleCode[]>(
    ALL_PLATFORM_DASHBOARD_MODULES.map((m) => m.code),
  )

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleNameChange = (val: string) => {
    setName(val)
    const generated = val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    setSlug(generated)
  }

  const toggleModule = (code: DashboardModuleCode) => {
    setSelectedModules((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    )
  }

  const handleSelectAllModules = () => {
    setSelectedModules(ALL_PLATFORM_DASHBOARD_MODULES.map((m) => m.code))
  }

  const handleDeselectAllModules = () => {
    setSelectedModules([])
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 dark:border-rose-800/80 dark:bg-rose-950/50 dark:text-rose-300">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Dados da Empresa */}
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
                required
              />
              <Input
                label="Identificador Único (SLUG)"
                placeholder="ex: auto-pecas-estrela"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                helperText="Chave única de acesso da empresa no sistema."
                required
              />
            </div>
          </div>

          {/* Usuário Administrador */}
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
                onChange={(e) => setAdminName(e.target.value)}
                required
              />

              <Input
                label="E-mail de Login do Administrador"
                type="email"
                placeholder="carlos@empresa.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />

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

          {/* Módulos e Páginas Liberadas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                3. Páginas e Módulos Liberados
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllModules}
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400 font-semibold"
                >
                  Marcar Todos
                </button>
                <span className="text-gray-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllModules}
                  className="text-xs text-gray-500 hover:underline dark:text-slate-400"
                >
                  Desmarcar Todos
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ALL_PLATFORM_DASHBOARD_MODULES.map((m) => {
                const isSelected = selectedModules.includes(m.code)
                return (
                  <label
                    key={m.code}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-blue-500/80 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/30'
                        : 'border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 opacity-75'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleModule(m.code)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {m.name}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500">
                          ({m.code})
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
                        {m.description}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

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

