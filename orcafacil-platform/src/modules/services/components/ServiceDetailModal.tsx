import { useState, useEffect } from 'react'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import {
  Wrench,
  X,
  Clock,
  DollarSign,
  Package,
  FileText,
  Tag,
  CheckCircle2,
  XCircle,
  Percent,
  History,
} from 'lucide-react'
import {
  serviceService,
  type ServiceDetail,
  type ServicePriceHistoryItem,
  type ServiceUsageHistoryItem,
  BILLING_UNITS,
} from '../services/service.service'
import type { UUID } from '@shared/types/common'

interface ServiceDetailModalProps {
  open: boolean
  serviceId: UUID | null
  organizationId: UUID
  onClose: () => void
}

export function ServiceDetailModal({
  open,
  serviceId,
  organizationId,
  onClose,
}: ServiceDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'pricing' | 'materials' | 'fiscal' | 'history'>('general')
  const [service, setService] = useState<ServiceDetail | null>(null)
  const [priceHistory, setPriceHistory] = useState<ServicePriceHistoryItem[]>([])
  const [usageHistory, setUsageHistory] = useState<ServiceUsageHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open || !serviceId) {
      setService(null)
      setPriceHistory([])
      setUsageHistory([])
      return
    }

    const load = async () => {
      setIsLoading(true)
      const res = await serviceService.getServiceById(organizationId, serviceId)
      if (res.success) {
        setService(res.data)
      }
      const histRes = await serviceService.getServicePriceHistory(organizationId, serviceId)
      if (histRes.success) {
        setPriceHistory(histRes.data)
      }
      const usageRes = await serviceService.getServiceUsageHistory(organizationId, serviceId)
      if (usageRes.success) {
        setUsageHistory(usageRes.data)
      }
      setIsLoading(false)
    }

    void load()
  }, [open, serviceId, organizationId])

  if (!open) return null

  const billingLabel =
    BILLING_UNITS.find((u) => u.value === service?.billingUnit)?.label || service?.billingUnit

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/60 p-2.5 text-indigo-600 dark:text-indigo-400">
              <Wrench className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-gray-500 dark:text-slate-400">
                  {service?.serviceCode}
                </span>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {service?.name || 'Carregando serviço...'}
                </h3>
                {service && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      service.isActive
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {service.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                )}
              </div>
              {service?.categoryName && (
                <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                  <Tag className="h-3 w-3 text-indigo-500" />
                  {service.categoryName}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-gray-100 dark:border-slate-800 px-5 gap-4 text-xs font-medium bg-gray-50/50 dark:bg-slate-800/40">
          {[
            { id: 'general', label: 'Informações Gerais', icon: Wrench },
            { id: 'pricing', label: 'Precificação', icon: DollarSign },
            { id: 'materials', label: `Materiais (${service?.materialsCount || 0})`, icon: Package },
            { id: 'fiscal', label: 'Fiscal (NFS-e)', icon: FileText },
            { id: 'history', label: `Histórico (${priceHistory.length})`, icon: History },
          ].map((tab) => {
            const active = activeTab === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 py-3 border-b-2 font-semibold transition ${
                  active
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 text-xs">
          {isLoading || !service ? (
            <div className="py-12 text-center text-gray-500 dark:text-slate-400">
              Carregando detalhes do serviço...
            </div>
          ) : (
            <>
              {/* ABA GERAL */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 p-3 space-y-1">
                      <p className="font-semibold text-gray-500 dark:text-slate-400">Unidade de Cobrança</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{billingLabel}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 p-3 space-y-1">
                      <p className="font-semibold text-gray-500 dark:text-slate-400 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-gray-400" /> Tempo Estimado
                      </p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {service.estimatedTime || 'Não informado'}
                      </p>
                    </div>
                  </div>

                  {service.description && (
                    <div className="rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                      <p className="font-semibold text-gray-700 dark:text-slate-300 mb-1">Descrição</p>
                      <p className="text-gray-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                        {service.description}
                      </p>
                    </div>
                  )}

                  {service.internalNotes && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4">
                      <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Observações Internas</p>
                      <p className="text-amber-700 dark:text-amber-400 whitespace-pre-wrap leading-relaxed">
                        {service.internalNotes}
                      </p>
                    </div>
                  )}

                  <div className="text-[11px] text-gray-400 dark:text-slate-500 pt-2 border-t border-gray-100 dark:border-slate-800">
                    Cadastrado em {new Date(service.createdAt).toLocaleDateString('pt-BR')}
                    {service.creatorName && ` por ${service.creatorName}`}
                  </div>
                </div>
              )}

              {/* ABA PRECIFICAÇÃO */}
              {activeTab === 'pricing' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40 p-3">
                      <p className="text-gray-500 dark:text-slate-400 font-medium">Custo Operacional</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                        {formatCurrency(service.operationalCost)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40 p-3">
                      <p className="text-gray-500 dark:text-slate-400 font-medium">Mão de Obra</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                        {formatCurrency(service.laborCost)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40 p-3">
                      <p className="text-gray-500 dark:text-slate-400 font-medium">Materiais do Estoque</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                        {formatCurrency(service.materialsCost)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-950/30 p-3">
                      <p className="text-red-700 dark:text-red-400 font-bold">Custo Total</p>
                      <p className="text-base font-extrabold text-red-700 dark:text-red-300 mt-1">
                        {formatCurrency(service.totalCost)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/40 dark:to-slate-900 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-400 tracking-wide">
                          Preço de Venda Padrão
                        </p>
                        <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                          {formatCurrency(service.salePrice)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          <Percent className="h-3 w-3" />
                          Margem: {service.profitMargin}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-indigo-100 dark:border-indigo-900/50 text-xs">
                      <div>
                        <span className="text-gray-500 dark:text-slate-400">Preço Mínimo:</span>
                        <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                          {Number(service.minimumSalePrice) > 0
                            ? formatCurrency(service.minimumSalePrice)
                            : 'Sem limite'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-slate-400">Permite Descontos:</span>
                        <p className="font-bold text-gray-900 dark:text-white mt-0.5 flex items-center gap-1">
                          {service.allowDiscount ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Sim
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5 text-red-500" /> Não
                            </>
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-slate-400">Comissão de Venda:</span>
                        <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                          {Number(service.commissionRate) > 0 ? `${service.commissionRate}%` : 'Sem comissão'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA MATERIAIS */}
              {activeTab === 'materials' && (
                <div className="space-y-4">
                  {service.materials.length === 0 ? (
                    <div className="py-10 text-center text-gray-500 dark:text-slate-400 border border-dashed border-gray-200 dark:border-slate-800 rounded-xl">
                      <Package className="h-8 w-8 mx-auto text-gray-300 dark:text-slate-600 mb-2" />
                      Este serviço não possui materiais vinculados do estoque.
                    </div>
                  ) : (
                    <div>
                      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700">
                        <table className="w-full text-left">
                          <thead className="bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 uppercase font-semibold">
                            <tr>
                              <th className="px-3 py-2.5">Material (Estoque)</th>
                              <th className="px-3 py-2.5 text-center">Quantidade</th>
                              <th className="px-3 py-2.5 text-right">Custo Unitário</th>
                              <th className="px-3 py-2.5 text-right">Custo Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                            {service.materials.map((m) => (
                              <tr key={m.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                                <td className="px-3 py-2.5">
                                  <p className="font-semibold text-gray-900 dark:text-white">{m.productName}</p>
                                  {m.availableStock !== undefined && (
                                    <p className="text-[10px] text-gray-400 dark:text-slate-500">
                                      Saldo em estoque: {m.availableStock} {m.unit}
                                    </p>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-center font-medium text-gray-700 dark:text-slate-300">
                                  {m.quantity} {m.unit}
                                </td>
                                <td className="px-3 py-2.5 text-right text-gray-600 dark:text-slate-400">
                                  {formatCurrency(m.unitCost)}
                                </td>
                                <td className="px-3 py-2.5 text-right font-bold text-gray-900 dark:text-white">
                                  {formatCurrency(m.totalCost)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-3 flex justify-between items-center rounded-xl bg-gray-50 dark:bg-slate-800 p-3 font-semibold text-gray-800 dark:text-slate-200">
                        <span>Custo Total dos Materiais:</span>
                        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                          {formatCurrency(service.materialsCost)}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-2">
                        * Os materiais serão baixados do estoque apenas quando a venda deste serviço for concluída/executada.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ABA FISCAL */}
              {activeTab === 'fiscal' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2">
                      Classificação do Serviço (LC 116/2003 & NFS-e)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                        <span className="text-gray-500 dark:text-slate-400">Item LC 116/2003:</span>
                        <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                          {service.lc116Item || 'Não preenchido'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                        <span className="text-gray-500 dark:text-slate-400">Cód. Tributação Nacional:</span>
                        <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                          {service.nfsNationalCode || 'Não preenchido'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                        <span className="text-gray-500 dark:text-slate-400">CNAE:</span>
                        <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                          {service.cnaeCode || 'Não preenchido'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                        <span className="text-gray-500 dark:text-slate-400">Código NBS:</span>
                        <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                          {service.nbsCode || 'Não preenchido'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2">
                      Tributação ISS
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                        <span className="text-gray-500 dark:text-slate-400">Alíquota ISS:</span>
                        <p className="font-bold text-gray-900 dark:text-white mt-0.5">{service.issRate}%</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                        <span className="text-gray-500 dark:text-slate-400">Tipo de Tributação:</span>
                        <p className="font-bold text-gray-900 dark:text-white mt-0.5 capitalize">
                          {service.issTaxType}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                        <span className="text-gray-500 dark:text-slate-400">ISS Retido na Fonte:</span>
                        <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                          {service.issWithheld ? 'Sim' : 'Não'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/30 p-4 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                      Reforma Tributária 2026 (IBS / CBS)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-blue-600 dark:text-blue-400">CST IBS/CBS:</span>
                        <p className="font-bold text-gray-900 dark:text-white">{service.cstIbsCbs || '—'}</p>
                      </div>
                      <div>
                        <span className="text-blue-600 dark:text-blue-400">cClassTrib:</span>
                        <p className="font-bold text-gray-900 dark:text-white">{service.cClassTrib || '—'}</p>
                      </div>
                      <div>
                        <span className="text-blue-600 dark:text-blue-400">Alíquota IBS:</span>
                        <p className="font-bold text-gray-900 dark:text-white">{service.ibsRate}%</p>
                      </div>
                      <div>
                        <span className="text-blue-600 dark:text-blue-400">Alíquota CBS:</span>
                        <p className="font-bold text-gray-900 dark:text-white">{service.cbsRate}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA HISTÓRICO */}
              {activeTab === 'history' && (
                <div className="space-y-6">
                  {/* Seção 1: Histórico de Alterações de Preço */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      Histórico de Reajustes de Preço
                    </h4>
                    {priceHistory.length === 0 ? (
                      <div className="rounded-xl border border-gray-100 dark:border-slate-800 p-4 text-center text-xs text-gray-500 dark:text-slate-400">
                        Nenhuma alteração de preço registrada até o momento.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 uppercase font-semibold">
                            <tr>
                              <th className="px-3 py-2.5">Data / Hora</th>
                              <th className="px-3 py-2.5">Preço Anterior</th>
                              <th className="px-3 py-2.5">Novo Preço</th>
                              <th className="px-3 py-2.5">Responsável</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                            {priceHistory.map((h) => (
                              <tr key={h.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                                <td className="px-3 py-2.5 text-gray-600 dark:text-slate-400">
                                  {new Intl.DateTimeFormat('pt-BR', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  }).format(new Date(h.createdAt))}
                                </td>
                                <td className="px-3 py-2.5 text-gray-500 dark:text-slate-400 line-through">
                                  {formatCurrency(h.oldPrice)}
                                </td>
                                <td className="px-3 py-2.5 font-bold text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(h.newPrice)}
                                </td>
                                <td className="px-3 py-2.5 text-gray-700 dark:text-slate-300">
                                  {h.changedByName || 'Operador'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Seção 2: Histórico de Utilização em Orçamentos e Vendas */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Histórico de Utilização em Orçamentos e Vendas
                    </h4>
                    {usageHistory.length === 0 ? (
                      <div className="rounded-xl border border-gray-100 dark:border-slate-800 p-4 text-center text-xs text-gray-500 dark:text-slate-400">
                        Este serviço ainda não foi utilizado em nenhum orçamento ou venda.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 uppercase font-semibold">
                            <tr>
                              <th className="px-3 py-2.5">Documento</th>
                              <th className="px-3 py-2.5">Tipo</th>
                              <th className="px-3 py-2.5">Cliente</th>
                              <th className="px-3 py-2.5 text-center">Qtd</th>
                              <th className="px-3 py-2.5 text-right">Valor Unit.</th>
                              <th className="px-3 py-2.5 text-right">Total</th>
                              <th className="px-3 py-2.5">Data</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                            {usageHistory.map((u, i) => (
                              <tr key={`${u.quoteId}-${i}`} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                                <td className="px-3 py-2.5 font-bold text-gray-900 dark:text-white">
                                  {u.quoteNumber}
                                </td>
                                <td className="px-3 py-2.5">
                                  {u.type === 'sale' ? (
                                    <span className="inline-flex rounded-full bg-blue-100 dark:bg-blue-950 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:text-blue-300">
                                      Venda
                                    </span>
                                  ) : (
                                    <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                                      Orçamento
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-gray-700 dark:text-slate-300 truncate max-w-[140px]">
                                  {u.customerName}
                                </td>
                                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-slate-400">
                                  {u.quantity}
                                </td>
                                <td className="px-3 py-2.5 text-right text-gray-600 dark:text-slate-400">
                                  {formatCurrency(u.unitPrice)}
                                </td>
                                <td className="px-3 py-2.5 text-right font-bold text-gray-900 dark:text-white">
                                  {formatCurrency(u.total)}
                                </td>
                                <td className="px-3 py-2.5 text-gray-500 dark:text-slate-400">
                                  {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(u.createdAt))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 dark:border-slate-800 p-4 bg-gray-50 dark:bg-slate-800/40 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}
