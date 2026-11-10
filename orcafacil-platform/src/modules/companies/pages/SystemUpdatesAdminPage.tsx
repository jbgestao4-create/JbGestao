import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  GitBranch,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  ShieldAlert,
  History,
  Trash2,
  User,
  Wrench,
  Bug,
  ShieldCheck,
  Tag,
  X,
  Star,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { isSystemOwner } from '@shared/utils/system-owner'
import { useSystemVersion } from '@shared/hooks/useSystemVersion'
import {
  systemUpdateService,
  formatSystemVersion,
  type SystemUpdate,
  type SystemUpdateType,
} from '@shared/services/system-update.service'

export function SystemUpdatesAdminPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { version: activeSystemVersion, setCustomVersion, refreshVersion } = useSystemVersion()

  const [updates, setUpdates] = useState<SystemUpdate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Modal de cadastro / edição
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUpdate, setEditingUpdate] = useState<SystemUpdate | null>(null)

  // Modal rápido de definir versão atual
  const [isQuickVersionModalOpen, setIsQuickVersionModalOpen] = useState(false)
  const [quickVersionInput, setQuickVersionInput] = useState('')
  const [isSavingQuickVersion, setIsSavingQuickVersion] = useState(false)

  // Campos do formulário
  const [version, setVersion] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<SystemUpdateType>('feature')
  const [authorName, setAuthorName] = useState('')
  const [authorEmail, setAuthorEmail] = useState('')
  const [modulesInput, setModulesInput] = useState('')
  const [performedAt, setPerformedAt] = useState('')
  const [isCurrent, setIsCurrent] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const isDev = isSystemOwner(user)

  const loadUpdates = async () => {
    setIsLoading(true)
    const res = await systemUpdateService.listAll()
    if (res.success && res.data) {
      setUpdates(res.data)
    }
    void refreshVersion()
    setIsLoading(false)
  }

  useEffect(() => {
    void loadUpdates()
  }, [])

  if (!isDev) {
    return (
      <div className="py-20 max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Acesso Restrito ao Desenvolvedor</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Este painel é restrito exclusivamente ao desenvolvedor do sistema.
        </p>
        <button
          type="button"
          onClick={() => void navigate('/')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition cursor-pointer"
        >
          Voltar ao Início
        </button>
      </div>
    )
  }

  const handleOpenCreateModal = () => {
    setEditingUpdate(null)
    setVersion('')
    setTitle('')
    setDescription('')
    setType('feature')
    setAuthorName(profile?.displayName || user?.email?.split('@')[0] || 'Bryan Mendes')
    setAuthorEmail(user?.email || 'bryanmendes968@gmail.com')
    setModulesInput('')
    setIsCurrent(true)

    // Formato YYYY-MM-DDTHH:mm para datetime-local
    const now = new Date()
    const tzOffset = now.getTimezoneOffset() * 60000
    const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16)
    setPerformedAt(localISOTime)
    setFormError(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (item: SystemUpdate) => {
    setEditingUpdate(item)
    setVersion(item.version || '')
    setTitle(item.title)
    setDescription(item.description)
    setType(item.type)
    setAuthorName(item.authorName)
    setAuthorEmail(item.authorEmail || '')
    setModulesInput(item.modules ? item.modules.join(', ') : '')
    setIsCurrent(Boolean(item.isCurrent || (item.version && item.version === activeSystemVersion)))

    try {
      const date = new Date(item.performedAt)
      const tzOffset = date.getTimezoneOffset() * 60000
      const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
      setPerformedAt(localISOTime)
    } catch {
      setPerformedAt('')
    }
    setFormError(null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingUpdate(null)
    setFormError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim() || !authorName.trim()) {
      setFormError('Preencha os campos obrigatórios (Título, Quem realizou e Descrição).')
      return
    }

    setIsSubmitting(true)
    setFormError(null)

    const parsedModules = modulesInput
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)

    const isoPerformedAt = performedAt ? new Date(performedAt).toISOString() : new Date().toISOString()
    const cleanVersion = version.trim() ? formatSystemVersion(version.trim()) : null

    if (editingUpdate) {
      const res = await systemUpdateService.update(editingUpdate.id, {
        version: cleanVersion,
        title: title.trim(),
        description: description.trim(),
        type,
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim() || null,
        modules: parsedModules,
        performedAt: isoPerformedAt,
        isCurrent,
      })

      setIsSubmitting(false)

      if (!res.success) {
        setFormError(`Erro ao atualizar: ${res.error}`)
      } else {
        setUpdates((prev) =>
          prev.map((u) => {
            if (u.id === editingUpdate.id) return res.data
            if (isCurrent) return { ...u, isCurrent: false }
            return u
          }),
        )
        if (isCurrent && cleanVersion) {
          void setCustomVersion(cleanVersion)
        }
        handleCloseModal()
      }
    } else {
      const res = await systemUpdateService.create({
        version: cleanVersion,
        title: title.trim(),
        description: description.trim(),
        type,
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim() || null,
        modules: parsedModules,
        performedAt: isoPerformedAt,
        isCurrent,
      })

      setIsSubmitting(false)

      if (!res.success) {
        setFormError(`Erro ao cadastrar: ${res.error}`)
      } else {
        setUpdates((prev) => [
          res.data,
          ...prev.map((u) => (isCurrent ? { ...u, isCurrent: false } : u)),
        ])
        if (isCurrent && cleanVersion) {
          void setCustomVersion(cleanVersion)
        }
        handleCloseModal()
      }
    }
  }

  const handleSetAsCurrent = async (item: SystemUpdate) => {
    if (!item.version) return
    const formatted = formatSystemVersion(item.version)
    await setCustomVersion(formatted)
    await systemUpdateService.setCurrentVersion(formatted, item.id)

    setUpdates((prev) =>
      prev.map((u) => ({
        ...u,
        isCurrent: u.id === item.id,
      })),
    )
  }

  const handleSaveQuickVersion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickVersionInput.trim()) return

    setIsSavingQuickVersion(true)
    const formatted = formatSystemVersion(quickVersionInput.trim())
    await setCustomVersion(formatted)
    setIsSavingQuickVersion(false)
    setIsQuickVersionModalOpen(false)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro de atualização?')) return

    const res = await systemUpdateService.delete(id)
    if (res.success) {
      setUpdates((prev) => prev.filter((u) => u.id !== id))
      void refreshVersion()
    }
  }

  const getTypeBadge = (uType: SystemUpdateType) => {
    switch (uType) {
      case 'feature':
        return {
          icon: Rocket,
          label: 'Nova Funcionalidade',
          badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300',
        }
      case 'improvement':
        return {
          icon: History,
          label: 'Melhoria / Otimização',
          badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300',
        }
      case 'bugfix':
        return {
          icon: Bug,
          label: 'Correção de Bug',
          badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300',
        }
      case 'security':
        return {
          icon: ShieldCheck,
          label: 'Segurança / Banco',
          badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300',
        }
      case 'maintenance':
      default:
        return {
          icon: Wrench,
          label: 'Manutenção Geral',
          badgeClass: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
        }
    }
  }

  const latestAuthor = updates[0]?.authorName || 'Bryan Mendes'

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto">
      {/* HEADER PRINCIPAL */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => void navigate('/admin/developer-settings')}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition shrink-0 cursor-pointer"
              title="Voltar para Configurações de Desenvolvedor"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <GitBranch className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Atualização do Sistema
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  <History className="w-3 h-3" /> Histórico &amp; Changelog
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 max-w-2xl">
                Registre e acompanhe todas as versões, melhorias, correções e manutenções do software. Qualquer nova versão cadastrada atualiza automaticamente o selo no topo da página inicial e em todo o sistema.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => void loadUpdates()}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Atualizar Lista"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Nova Atualização</span>
            </button>
          </div>
        </div>
      </div>

      {/* CARDS DE RESUMO DE ATUALIZAÇÕES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center shrink-0">
            <GitBranch className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total de Entregas
            </span>
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {updates.length} atualizações
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Rocket className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Versão Atual no Sistema
              </span>
              <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                {activeSystemVersion}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setQuickVersionInput(activeSystemVersion)
              setIsQuickVersionModalOpen(true)
            }}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 font-medium cursor-pointer transition"
            title="Alterar versão atual diretamente"
          >
            Alterar
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Último Autor
            </span>
            <span className="text-lg font-bold text-gray-900 dark:text-white truncate block">
              {latestAuthor}
            </span>
          </div>
        </div>
      </div>

      {/* LINHA DO TEMPO / HISTÓRICO DE ATUALIZAÇÕES */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Histórico Cronológico de Atualizações
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Todas as manutenções, novidades e ajustes implementados. Ao registrar ou definir uma versão como atual, ela passa a ser exibida automaticamente na página inicial.
          </p>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-500">Carregando histórico de atualizações...</div>
        ) : updates.length === 0 ? (
          <div className="py-16 text-center text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
            Nenhuma atualização registrada ainda. Clique em &quot;Registrar Nova Atualização&quot; para começar.
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 border-l-2 border-indigo-200 dark:border-slate-800 space-y-8">
            {updates.map((item) => {
              const badge = getTypeBadge(item.type)
              const BadgeIcon = badge.icon
              const formattedDate = new Date(item.performedAt).toLocaleString('pt-BR', {
                dateStyle: 'long',
                timeStyle: 'short',
              })

              const isCurrentVersion =
                item.isCurrent || (Boolean(item.version) && formatSystemVersion(item.version) === activeSystemVersion)

              return (
                <div key={item.id} className="relative group">
                  {/* Ponto na timeline */}
                  <div
                    className={`absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-4 ${
                      isCurrentVersion ? 'border-emerald-500 ring-2 ring-emerald-300' : 'border-indigo-600'
                    }`}
                  />

                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 hover:border-indigo-200 dark:hover:border-slate-700 transition">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.version && (
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                            {formatSystemVersion(item.version)}
                          </span>
                        )}

                        {isCurrentVersion && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800">
                            <Star className="w-3.5 h-3.5 fill-emerald-500 text-emerald-600" />
                            Versão Atual do Sistema
                          </span>
                        )}

                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${badge.badgeClass}`}>
                          <BadgeIcon className="w-3.5 h-3.5" />
                          {badge.label}
                        </span>
                        <div className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formattedDate}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {!isCurrentVersion && item.version && (
                          <button
                            type="button"
                            onClick={() => void handleSetAsCurrent(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer transition"
                            title="Tornar esta a versão atual ativa no sistema"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Definir como Atual
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                          title="Editar Atualização"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                          title="Excluir Registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
                        {item.title}
                      </h3>
                      <div className="mt-2 text-sm text-gray-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                        {item.description}
                      </div>
                    </div>

                    {/* Destaque de quem realizou a atualização */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300">
                        <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>
                          Realizado por:{' '}
                          <strong className="text-gray-900 dark:text-white font-semibold">
                            {item.authorName}
                          </strong>
                          {item.authorEmail && (
                            <span className="text-slate-400 dark:text-slate-500 ml-1">
                              ({item.authorEmail})
                            </span>
                          )}
                        </span>
                      </div>

                      {item.modules && item.modules.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-slate-400" />
                          {item.modules.map((mod, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                            >
                              {mod}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL RÁPIDO PARA ALTERAR VERSÃO ATUAL */}
      {isQuickVersionModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400 flex items-center justify-center">
                  <Rocket className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Alterar Versão Atual do Sistema
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickVersionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickVersion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Número / Código da Versão:
                </label>
                <input
                  type="text"
                  required
                  value={quickVersionInput}
                  onChange={(e) => setQuickVersionInput(e.target.value)}
                  placeholder="Ex: v2.5.0 ou 2.5"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-mono text-gray-900 dark:text-white"
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Ao salvar, a versão é imediatamente propagada em tempo real para a página inicial (ao lado de ControleSoft) e para todos os usuários logados.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsQuickVersionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuickVersion}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSavingQuickVersion ? 'Salvando...' : 'Aplicar Versão'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO / EDIÇÃO DE ATUALIZAÇÃO */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400 flex items-center justify-center">
                  <GitBranch className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editingUpdate ? 'Editar Atualização do Sistema' : 'Registrar Nova Atualização do Sistema'}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Versão (Ex: v2.5.0):
                  </label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="v2.5.0"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-mono text-gray-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Título / Resumo da Atualização *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Melhorias no PDV e Módulo de Manutenção"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* OPÇÃO DE DEFINIR COMO VERSÃO ATUAL DO SISTEMA */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="isCurrentVersionCheckbox"
                  checked={isCurrent}
                  onChange={(e) => setIsCurrent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="isCurrentVersionCheckbox" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <strong className="text-blue-900 dark:text-blue-300 font-semibold block">
                    Definir como Versão Atual do Sistema
                  </strong>
                  Atualiza automaticamente o selo de versão exibido na página inicial (Dashboard) e em toda a aplicação assim que salvar.
                </label>
              </div>

              {/* QUEM REALIZOU A ATUALIZAÇÃO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                <div>
                  <label className="block text-xs font-bold text-indigo-950 dark:text-indigo-300 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Quem realizou a atualização *
                  </label>
                  <input
                    type="text"
                    required
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Ex: Bryan Mendes (Desenvolvedor)"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-gray-900 dark:text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-indigo-950 dark:text-indigo-300 mb-1.5">
                    E-mail do Autor (Opcional):
                  </label>
                  <input
                    type="email"
                    value={authorEmail}
                    onChange={(e) => setAuthorEmail(e.target.value)}
                    placeholder="dev@jbsoftware.com.br"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Tipo de Atualização:
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as SystemUpdateType)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-gray-900 dark:text-white"
                  >
                    <option value="feature">🚀 Nova Funcionalidade</option>
                    <option value="improvement">✨ Melhoria / Otimização</option>
                    <option value="bugfix">🐛 Correção de Bug</option>
                    <option value="security">🔒 Segurança / Banco de Dados</option>
                    <option value="maintenance">🛠️ Manutenção Geral</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Data e Hora de Realização:
                  </label>
                  <input
                    type="datetime-local"
                    value={performedAt}
                    onChange={(e) => setPerformedAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Módulos Afetados (separados por vírgula):
                </label>
                <input
                  type="text"
                  value={modulesInput}
                  onChange={(e) => setModulesInput(e.target.value)}
                  placeholder="Ex: PDV, Vendas, Estoque, Notificações"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Descrição e Detalhes das Atualizações *
                </label>
                <textarea
                  required
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva as mudanças realizadas, melhorias operacionais, itens corrigidos ou novos recursos adicionados..."
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-gray-900 dark:text-white leading-relaxed"
                />
              </div>

              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-xs font-medium">
                  {formError}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Salvando...' : 'Salvar Atualização'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
