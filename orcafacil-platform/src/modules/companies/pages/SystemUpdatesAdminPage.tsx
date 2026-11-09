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
  Sparkles,
  Trash2,
  User,
  Wrench,
  Bug,
  ShieldCheck,
  Tag,
  X,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { isSystemOwner } from '@shared/utils/system-owner'
import {
  systemUpdateService,
  type SystemUpdate,
  type SystemUpdateType,
} from '@shared/services/system-update.service'

export function SystemUpdatesAdminPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [updates, setUpdates] = useState<SystemUpdate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Modal de cadastro / edição
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUpdate, setEditingUpdate] = useState<SystemUpdate | null>(null)

  // Campos do formulário
  const [version, setVersion] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<SystemUpdateType>('feature')
  const [authorName, setAuthorName] = useState('')
  const [authorEmail, setAuthorEmail] = useState('')
  const [modulesInput, setModulesInput] = useState('')
  const [performedAt, setPerformedAt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const isDev = isSystemOwner(user)

  const loadUpdates = async () => {
    setIsLoading(true)
    const res = await systemUpdateService.listAll()
    if (res.success && res.data) {
      setUpdates(res.data)
    }
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

    if (editingUpdate) {
      const res = await systemUpdateService.update(editingUpdate.id, {
        version: version.trim() || null,
        title: title.trim(),
        description: description.trim(),
        type,
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim() || null,
        modules: parsedModules,
        performedAt: isoPerformedAt,
      })

      setIsSubmitting(false)

      if (!res.success) {
        setFormError(`Erro ao atualizar: ${res.error}`)
      } else {
        setUpdates((prev) => prev.map((u) => (u.id === editingUpdate.id ? res.data : u)))
        handleCloseModal()
      }
    } else {
      const res = await systemUpdateService.create({
        version: version.trim() || null,
        title: title.trim(),
        description: description.trim(),
        type,
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim() || null,
        modules: parsedModules,
        performedAt: isoPerformedAt,
      })

      setIsSubmitting(false)

      if (!res.success) {
        setFormError(`Erro ao cadastrar: ${res.error}`)
      } else {
        setUpdates((prev) => [res.data, ...prev])
        handleCloseModal()
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro de atualização?')) return

    const res = await systemUpdateService.delete(id)
    if (res.success) {
      setUpdates((prev) => prev.filter((u) => u.id !== id))
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
          icon: Sparkles,
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

  const latestVersion = updates.find((u) => u.version)?.version || 'v2.4.0'
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
                  <Sparkles className="w-3 h-3" /> Histórico &amp; Changelog
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 max-w-2xl">
                Registre e acompanhe todas as versões, melhorias, correções e manutenções do software, identificando quem realizou cada atualização e as mudanças entregues.
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

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Rocket className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Versão Atual
            </span>
            <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
              {latestVersion}
            </span>
          </div>
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
            Todas as manutenções, novidades e ajustes implementados, organizados pela data em que foram realizados.
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

              return (
                <div key={item.id} className="relative group">
                  {/* Ponto na timeline */}
                  <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-4 border-indigo-600" />

                  {/* Card da Atualização */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 transition hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-700/60 pb-4">
                      <div className="flex flex-wrap items-center gap-2.5">
                        {item.version && (
                          <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-indigo-600 text-white shadow-xs">
                            {item.version}
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

                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
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
