import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { ProfileMenu } from '@shared/components/ProfileMenu'
import {
  LayoutDashboard,
  Boxes,
  FileSpreadsheet,
  Users,
  Settings,
  LogOut,
  Building2,
  Plus,
} from 'lucide-react'

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, profile, signOut } = useAuth()
  const { currentOrganization, organizations, setCurrentOrganization, createOrganization } =
    useOrganization()
  const { canAccess } = useModuleAccess()
  const location = useLocation()
  const navigate = useNavigate()
  const isDashboard = location.pathname === '/'

  const [isCreatingOrg, setIsCreatingOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgSlug, setNewOrgSlug] = useState('')
  const [orgError, setOrgError] = useState('')
  const [isSubmittingOrg, setIsSubmittingOrg] = useState(false)

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOrgName || !newOrgSlug) {
      setOrgError('Preencha todos os campos.')
      return
    }

    setIsSubmittingOrg(true)
    setOrgError('')

    const res = await createOrganization(newOrgName, newOrgSlug)
    if (res.success) {
      setIsCreatingOrg(false)
      setNewOrgName('')
      setNewOrgSlug('')
    } else {
      setOrgError(res.error)
    }
    setIsSubmittingOrg(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // Se o usuário ainda não tiver nenhuma organização cadastrada
  if (organizations.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Crie sua primeira organização</h2>
          <p className="text-sm text-gray-500 mb-6">
            Para começar a usar a plataforma, informe o nome do seu negócio ou trabalho autônomo.
          </p>

          <form onSubmit={(e) => void handleCreateOrg(e)} className="space-y-4">
            {orgError && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                {orgError}
              </div>
            )}
            <Input
              label="Nome da Empresa / Profissional"
              placeholder="Ex: Alfa Reformas & Pinturas"
              value={newOrgName}
              onChange={(e) => {
                setNewOrgName(e.target.value)
                setNewOrgSlug(
                  e.target.value
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, ''),
                )
              }}
              required
            />
            <Input
              label="Identificador Único (Slug)"
              placeholder="ex: alfa-reformas"
              value={newOrgSlug}
              onChange={(e) => setNewOrgSlug(e.target.value)}
              helperText="Usado para identificar sua organização no sistema."
              required
            />
            <Button type="submit" className="w-full" isLoading={isSubmittingOrg}>
              Criar Organização e Começar
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 flex justify-center">
            <button
              onClick={() => void handleSignOut()}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" /> Sair da conta
            </button>
          </div>
        </div>
      </div>
    )
  }

  const hasOrcafacil = canAccess('orcafacil')

  const navItem = (to: string, label: string, icon: ReactNode) => {
    const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
    return (
      <Link
        to={to}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-50 text-blue-700 font-semibold'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>{icon}</span>
        {label}
      </Link>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${isDashboard ? '' : 'flex'}`}>
      {!isDashboard && (
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
          {/* LOGO & ORG SELECTOR */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                OF
              </div>
              <div>
                <span className="font-bold text-gray-900 tracking-tight block text-sm">
                  OrçaFácil
                </span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block -mt-0.5">
                  Platform
                </span>
              </div>
            </div>

            {/* Seletor de Organização */}
            <div className="relative">
              <select
                aria-label="Selecionar Organização"
                value={currentOrganization?.id}
                onChange={(e) => {
                  const org = organizations.find((o) => o.id === e.target.value)
                  if (org) setCurrentOrganization(org)
                }}
                className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded-lg p-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* NAVEGAÇÃO MODULAR */}
          <nav className="flex-1 p-3 space-y-6 overflow-y-auto">
            <div>
              <span className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Geral
              </span>
              <div className="mt-1 space-y-0.5">
                {navItem('/', 'Visão Geral', <LayoutDashboard className="w-4 h-4" />)}
                {navItem('/modules', 'Módulos', <Boxes className="w-4 h-4" />)}
              </div>
            </div>

            {/* SEÇÃO ORÇAFÁCIL */}
            {hasOrcafacil && (
              <div>
                <span className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  OrçaFácil
                </span>
                <div className="mt-1 space-y-0.5">
                  {navItem(
                    '/orcafacil/quotes',
                    'Orçamentos',
                    <FileSpreadsheet className="w-4 h-4" />,
                  )}
                  {navItem('/orcafacil/customers', 'Clientes', <Users className="w-4 h-4" />)}
                </div>
              </div>
            )}

            <div>
              <span className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Administração
              </span>
              <div className="mt-1 space-y-0.5">
                {navItem('/settings/organization', 'Organização', <Settings className="w-4 h-4" />)}
              </div>
            </div>
          </nav>

          {/* FOOTER DO USUÁRIO */}
          <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <ProfileMenu
              variant="sidebar"
              displayName={profile?.displayName || 'Usuário'}
              email={user?.email}
            />
            <button
              onClick={() => void handleSignOut()}
              title="Encerrar Sessão"
              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* CONTEÚDO PRINCIPAL */}
      <main
        className={isDashboard ? 'min-h-screen' : 'flex-1 flex flex-col min-w-0 overflow-y-auto'}
      >
        {!isDashboard && (
          <header className="h-14 border-b border-gray-200 bg-white px-8 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-gray-900">{currentOrganization?.name}</span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreatingOrg(true)}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Nova Organização
              </Button>
              <ProfileMenu
                variant="header"
                displayName={profile?.displayName || 'Usuário'}
                email={user?.email}
              />
            </div>
          </header>
        )}

        <div className={isDashboard ? 'w-full' : 'flex-1 p-8 max-w-7xl w-full mx-auto'}>
          {children}
        </div>
      </main>

      {/* MODAL CRIAR ORGANIZAÇÃO ADICIONAL */}
      {isCreatingOrg && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Cadastrar Nova Organização</h3>
            <p className="text-xs text-gray-500 mb-4">
              Cada organização possui seus próprios clientes, propostas e membros isolados.
            </p>

            <form onSubmit={(e) => void handleCreateOrg(e)} className="space-y-4">
              {orgError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg">{orgError}</div>
              )}
              <Input
                label="Nome da Organização"
                placeholder="Ex: Beta Soluções"
                value={newOrgName}
                onChange={(e) => {
                  setNewOrgName(e.target.value)
                  setNewOrgSlug(
                    e.target.value
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-+|-+$/g, ''),
                  )
                }}
                required
              />
              <Input
                label="Slug Único"
                value={newOrgSlug}
                onChange={(e) => setNewOrgSlug(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreatingOrg(false)}
                  disabled={isSubmittingOrg}
                >
                  Cancelar
                </Button>
                <Button type="submit" isLoading={isSubmittingOrg}>
                  Criar Organização
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
