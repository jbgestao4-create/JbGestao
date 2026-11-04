import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import {
  Wrench,
  Plus,
  Search,
  X,
  Filter,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  Package,
  Tag,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
} from 'lucide-react'
import {
  serviceService,
  type ServiceListItem,
  type ServiceCategory,
  BILLING_UNITS,
} from '../services/service.service'
import { ServiceDetailModal } from '../components/ServiceDetailModal'
import { ConfirmActionDialog } from '@shared/components/ConfirmActionDialog'

import type { ServiceResult } from '@shared/types/common'

export function ServicesListPage() {
  const { currentOrganization } = useOrganization()
  const navigate = useNavigate()

  const [services, setServices] = useState<ServiceListItem[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Modais de ação
  const [detailServiceId, setDetailServiceId] = useState<string | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [serviceToDelete, setServiceToDelete] = useState<ServiceListItem | null>(null)
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadData = async (page = currentPage) => {
    if (!currentOrganization) return
    setIsLoading(true)
    setDeleteErrorMessage(null)

    const [servicesRes, catRes] = await Promise.all([
      serviceService.listServices(currentOrganization.id, {
        search: searchQuery,
        categoryId: selectedCategory !== 'all' ? selectedCategory : undefined,
        status: statusFilter,
        page,
        pageSize: 12,
      }),
      serviceService.listCategories(currentOrganization.id),
    ])

    setIsLoading(false)

    if (servicesRes.success) {
      setServices(servicesRes.data.items)
      setTotalCount(servicesRes.data.totalCount)
      setCurrentPage(servicesRes.data.currentPage)
      setTotalPages(servicesRes.data.totalPages)
    }

    if (catRes.success) {
      setCategories(catRes.data)
    }
  }

  useEffect(() => {
    void loadData(1)
  }, [currentOrganization, searchQuery, selectedCategory, statusFilter])

  // Ações
  const handleToggleActive = async (s: ServiceListItem) => {
    if (!currentOrganization) return
    const nextStatus = !s.isActive
    const res = await serviceService.toggleActive(currentOrganization.id, s.id, nextStatus)
    if (res.success) {
      setServices((prev) =>
        prev.map((item) => (item.id === s.id ? { ...item, isActive: nextStatus } : item)),
      )
    }
  }

  const handleDeleteService = async (): Promise<ServiceResult<void>> => {
    if (!currentOrganization || !serviceToDelete) {
      return { success: false, error: 'Serviço não selecionado.' }
    }
    setIsDeleting(true)
    setDeleteErrorMessage(null)

    const res = await serviceService.deleteService(currentOrganization.id, serviceToDelete.id)
    setIsDeleting(false)

    if (res.success) {
      setServiceToDelete(null)
      await loadData(currentPage)
    } else {
      setDeleteErrorMessage(res.error)
    }
    return res
  }

  // Métricas do Topo
  const metrics = useMemo(() => {
    const total = totalCount
    const activeCount = services.filter((s) => s.isActive).length
    const withMaterials = services.filter((s) => (s.materialsCount || 0) > 0).length
    return { total, activeCount, withMaterials, categoriesCount: categories.length }
  }, [totalCount, services, categories])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/60 p-2.5 text-indigo-700 dark:text-indigo-400">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Catálogo de Serviços
            </h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
              Gerencie seus serviços, precificação com margem real, insumos do estoque e NFS-e.
            </p>
          </div>
        </div>

        <Link to="/services/new">
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs">
            <Plus className="h-4 w-4" />
            Novo Serviço
          </Button>
        </Link>
      </div>

      {deleteErrorMessage && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 border border-amber-200 dark:border-amber-800 flex items-start gap-3 text-amber-800 dark:text-amber-300 text-xs">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="font-bold">Aviso sobre o serviço:</p>
            <p className="mt-0.5">{deleteErrorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setDeleteErrorMessage(null)}
            className="text-amber-500 hover:text-amber-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="rounded-xl shadow-xs border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/30 dark:to-slate-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Total de Serviços
              </p>
              <p className="text-xl font-extrabold text-indigo-700 dark:text-indigo-300 mt-0.5">
                {metrics.total} cadastrado(s)
              </p>
            </div>
            <div className="rounded-xl bg-indigo-100 dark:bg-indigo-900/60 p-2 text-indigo-700 dark:text-indigo-300">
              <Wrench className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-xs border-emerald-100 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/30 dark:to-slate-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Serviços Ativos
              </p>
              <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {metrics.activeCount} disponível(is)
              </p>
            </div>
            <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/60 p-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-xs border-blue-100 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/30 dark:to-slate-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Com Materiais Vinculados
              </p>
              <p className="text-xl font-extrabold text-blue-700 dark:text-blue-300 mt-0.5">
                {metrics.withMaterials} com insumos
              </p>
            </div>
            <div className="rounded-xl bg-blue-100 dark:bg-blue-900/60 p-2 text-blue-700 dark:text-blue-300">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-xs border-amber-100 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/30 dark:to-slate-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Categorias
              </p>
              <p className="text-xl font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">
                {metrics.categoriesCount} cadastrada(s)
              </p>
            </div>
            <div className="rounded-xl bg-amber-100 dark:bg-amber-900/60 p-2 text-amber-700 dark:text-amber-300">
              <Tag className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Campo de Busca */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por código, nome do serviço ou descrição..."
                className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 pl-9 pr-8 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filtro por Categoria */}
            <div className="flex items-center gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 px-2.5 text-xs text-gray-700 dark:text-slate-300 focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">Todas as Categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Abas de Situação */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-slate-800 text-xs font-medium">
            <span className="text-gray-400 dark:text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Situação:
            </span>
            {[
              { id: 'all', label: 'Todos os Serviços' },
              { id: 'active', label: 'Somente Ativos' },
              { id: 'inactive', label: 'Inativos' },
            ].map((tab) => {
              const active = statusFilter === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
                  className={`rounded-lg px-2.5 py-1 transition ${
                    active
                      ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Serviços */}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-gray-500 dark:text-slate-400">
              Carregando serviços...
            </div>
          ) : services.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500 dark:text-slate-400 space-y-3">
              <Wrench className="h-10 w-10 mx-auto text-gray-300 dark:text-slate-600" />
              <p>Nenhum serviço localizado com os filtros selecionados.</p>
              <Link to="/services/new">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Plus className="h-4 w-4 mr-1" /> Cadastrar Primeiro Serviço
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                    <th className="px-4 py-3 font-semibold">Código / Serviço</th>
                    <th className="px-3 py-3 font-semibold">Categoria</th>
                    <th className="px-3 py-3 font-semibold">Cobrança / Tempo</th>
                    <th className="px-3 py-3 text-right font-semibold">Custo Total</th>
                    <th className="px-3 py-3 text-right font-semibold">Preço de Venda</th>
                    <th className="px-3 py-3 text-center font-semibold">Margem</th>
                    <th className="px-3 py-3 text-center font-semibold">Materiais</th>
                    <th className="px-3 py-3 text-center font-semibold">Situação</th>
                    <th className="px-4 py-3 text-center font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {services.map((s) => {
                    const billingLabel =
                      BILLING_UNITS.find((u) => u.value === s.billingUnit)?.label || s.billingUnit

                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-gray-50/60 dark:hover:bg-slate-800/50 transition"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-indigo-700 dark:text-indigo-400">
                            {s.serviceCode}
                          </div>
                          <p className="font-semibold text-gray-900 dark:text-white mt-0.5">{s.name}</p>
                          {s.description && (
                            <p className="text-[11px] text-gray-400 dark:text-slate-500 line-clamp-1">
                              {s.description}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-600 dark:text-slate-400">
                          {s.categoryName ? (
                            <span className="inline-flex items-center gap-1 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800 dark:text-indigo-300">
                              <Tag className="h-2.5 w-2.5" />
                              {s.categoryName}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-600 dark:text-slate-400">
                          <p className="font-medium text-gray-800 dark:text-slate-300">{billingLabel}</p>
                          {s.estimatedTime && (
                            <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" /> {s.estimatedTime}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600 dark:text-slate-400 whitespace-nowrap">
                          {formatCurrency(s.totalCost)}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(s.salePrice)}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                            {s.profitMargin}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {(s.materialsCount || 0) > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                              <Package className="h-3 w-3" />
                              {s.materialsCount} insumo(s)
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-slate-500 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(s)}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase transition ${
                              s.isActive
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-200'
                                : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-gray-200'
                            }`}
                            title="Clique para alternar situação Ativo/Inativo"
                          >
                            {s.isActive ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDetailServiceId(s.id)
                                setDetailModalOpen(true)
                              }}
                              className="h-7 w-7 p-0 text-gray-600 hover:text-indigo-600"
                              title="Visualizar detalhes do serviço"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void navigate(`/services/${s.id}/edit`)}
                              className="h-7 w-7 p-0 text-gray-600 hover:text-blue-600"
                              title="Editar serviço"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setServiceToDelete(s)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                              title="Excluir serviço"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-800 p-4 text-xs">
              <span className="text-gray-500 dark:text-slate-400">
                Mostrando página <span className="font-bold">{currentPage}</span> de{' '}
                <span className="font-bold">{totalPages}</span> ({totalCount} serviços)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => void loadData(currentPage - 1)}
                  className="gap-1 h-8 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => void loadData(currentPage + 1)}
                  className="gap-1 h-8 text-xs"
                >
                  Próxima <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      {currentOrganization && (
        <ServiceDetailModal
          open={detailModalOpen}
          serviceId={detailServiceId}
          organizationId={currentOrganization.id}
          onClose={() => {
            setDetailModalOpen(false)
            setDetailServiceId(null)
          }}
        />
      )}

      {/* Diálogo de Exclusão Segura */}
      <ConfirmActionDialog
        open={serviceToDelete !== null}
        title="Excluir serviço?"
        description={`Tem certeza de que deseja excluir o serviço "${serviceToDelete?.name}" (${serviceToDelete?.serviceCode})? Caso ele já tenha sido utilizado em propostas ou vendas, a exclusão será bloqueada para proteger o histórico financeiro.`}
        confirmLabel={isDeleting ? 'Excluindo...' : 'Sim, excluir serviço'}
        onCancel={() => {
          setServiceToDelete(null)
        }}
        onConfirm={handleDeleteService}
      />
    </div>
  )
}
