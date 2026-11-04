import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UUID } from '@shared/types/common'

export interface ServiceCategory {
  id: UUID
  organizationId: UUID
  name: string
  description?: string | null
  createdAt: string
}

export interface ServiceMaterialInput {
  inventoryItemId: UUID
  quantity: string
  unit: string
  unitCost: string
  totalCost?: string
}

export interface ServiceMaterialDetail {
  id: UUID
  serviceId: UUID
  inventoryItemId: UUID
  productName: string
  quantity: string
  unit: string
  unitCost: string
  totalCost: string
  availableStock?: string
}

export interface ServicePriceHistoryItem {
  id: UUID
  serviceId: UUID
  oldPrice: string
  newPrice: string
  changedByName?: string | null
  createdAt: string
}

export interface ServiceUsageHistoryItem {
  quoteId: string
  quoteNumber: string
  type: 'quote' | 'sale'
  status: string
  customerName: string
  quantity: string
  unitPrice: string
  total: string
  createdAt: string
}

export interface ServiceListItem {
  id: UUID
  organizationId: UUID
  serviceCode: string
  name: string
  description?: string | null
  categoryId?: UUID | null
  categoryName?: string | null
  billingUnit: string
  estimatedTime?: string | null
  isActive: boolean
  operationalCost: string
  laborCost: string
  materialsCost: string
  totalCost: string
  salePrice: string
  profitMargin: string
  minimumSalePrice: string
  allowDiscount: boolean
  commissionRate: string
  materialsCount?: number
  createdAt: string
  updatedAt: string
  creatorName?: string | null
}

export interface ServiceDetail extends ServiceListItem {
  internalNotes?: string | null
  lc116Item?: string | null
  nfsNationalCode?: string | null
  nfsMunicipalCode?: string | null
  cnaeCode?: string | null
  nbsCode?: string | null
  fiscalDescription?: string | null
  issRate: string
  issTaxType: string
  issWithheld: boolean
  deductionsAllowed: boolean
  issRequirement?: string | null
  cstIbsCbs?: string | null
  cClassTrib?: string | null
  ibsRate: string
  cbsRate: string
  taxRulesNotes?: string | null
  materials: ServiceMaterialDetail[]
}

export interface CreateServiceParams {
  serviceCode?: string
  name: string
  description?: string | null
  categoryId?: UUID | null
  billingUnit: string
  estimatedTime?: string | null
  isActive?: boolean
  internalNotes?: string | null

  operationalCost: string
  laborCost: string
  materialsCost?: string
  totalCost: string
  salePrice: string
  profitMargin: string
  minimumSalePrice?: string
  allowDiscount?: boolean
  commissionRate?: string

  // Fiscal
  lc116Item?: string | null
  nfsNationalCode?: string | null
  nfsMunicipalCode?: string | null
  cnaeCode?: string | null
  nbsCode?: string | null
  fiscalDescription?: string | null
  issRate?: string
  issTaxType?: string
  issWithheld?: boolean
  deductionsAllowed?: boolean
  issRequirement?: string | null
  cstIbsCbs?: string | null
  cClassTrib?: string | null
  ibsRate?: string
  cbsRate?: string
  taxRulesNotes?: string | null

  materials?: ServiceMaterialInput[]
  creatorName?: string
}

export interface ListServicesFilters {
  search?: string
  categoryId?: string
  status?: 'all' | 'active' | 'inactive'
  page?: number
  pageSize?: number
}

export interface PaginatedServicesResult {
  items: ServiceListItem[]
  totalCount: number
  currentPage: number
  totalPages: number
}

export const BILLING_UNITS = [
  { value: 'unidade', label: 'Unidade (UN)' },
  { value: 'hora', label: 'Hora (HR)' },
  { value: 'diaria', label: 'Diária (DIA)' },
  { value: 'mes', label: 'Mês (MÊS)' },
  { value: 'projeto', label: 'Projeto (PRJ)' },
  { value: 'visita', label: 'Visita Técnica' },
  { value: 'servico_fechado', label: 'Serviço Fechado' },
  { value: 'km', label: 'Quilômetro (KM)' },
  { value: 'metro', label: 'Metro (M)' },
  { value: 'm2', label: 'Metro Quadrado (M²)' },
] as const

class ServiceService {
  /**
   * Gera o próximo código de serviço disponível (ex: SRV-0001)
   */
  async generateNextServiceCode(organizationId: UUID): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('service_code')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error || !data || data.length === 0) {
        return 'SRV-0001'
      }

      const numbers = data
        .map((s) => {
          const match = String(s.service_code).match(/SRV-(\d+)/i)
          return match ? parseInt(match[1], 10) : 0
        })
        .filter((n) => !isNaN(n) && n > 0)

      const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0
      const nextNumber = maxNumber + 1
      return `SRV-${String(nextNumber).padStart(4, '0')}`
    } catch {
      return `SRV-${Date.now().toString().slice(-4)}`
    }
  }

  /**
   * Lista serviços com paginação e filtros
   */
  async listServices(
    organizationId: UUID,
    filters: ListServicesFilters = {},
  ): Promise<ServiceResult<PaginatedServicesResult>> {
    try {
      const page = filters.page && filters.page > 0 ? filters.page : 1
      const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 15
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let query = supabase
        .from('services')
        .select(
          `
          id,
          organization_id,
          service_code,
          name,
          description,
          category_id,
          billing_unit,
          estimated_time,
          is_active,
          operational_cost,
          labor_cost,
          materials_cost,
          total_cost,
          sale_price,
          profit_margin,
          minimum_sale_price,
          allow_discount,
          commission_rate,
          creator_name,
          created_at,
          updated_at,
          service_categories ( id, name ),
          service_materials ( id )
        `,
          { count: 'exact' },
        )
        .eq('organization_id', organizationId)

      if (filters.status === 'active') {
        query = query.eq('is_active', true)
      } else if (filters.status === 'inactive') {
        query = query.eq('is_active', false)
      }

      if (filters.categoryId && filters.categoryId !== 'all') {
        query = query.eq('category_id', filters.categoryId)
      }

      if (filters.search?.trim()) {
        const s = filters.search.trim()
        query = query.or(`name.ilike.%${s}%,service_code.ilike.%${s}%,description.ilike.%${s}%`)
      }

      query = query.order('name', { ascending: true }).range(from, to)

      const { data, count, error } = await query

      if (error) {
        logger.error('Erro ao listar serviços', { message: error.message })
        return { success: false, error: 'Não foi possível carregar a lista de serviços.' }
      }

      const totalCount = count || 0
      const totalPages = Math.ceil(totalCount / pageSize) || 1

      const items: ServiceListItem[] = (data || []).map((row) => {
        const cat = row.service_categories as unknown as { id: string; name: string } | null
        const materials = row.service_materials as unknown as { id: string }[] | null

        return {
          id: row.id,
          organizationId: row.organization_id,
          serviceCode: row.service_code,
          name: row.name,
          description: row.description,
          categoryId: row.category_id,
          categoryName: cat?.name || null,
          billingUnit: row.billing_unit,
          estimatedTime: row.estimated_time,
          isActive: row.is_active,
          operationalCost: String(row.operational_cost),
          laborCost: String(row.labor_cost),
          materialsCost: String(row.materials_cost),
          totalCost: String(row.total_cost),
          salePrice: String(row.sale_price),
          profitMargin: String(row.profit_margin),
          minimumSalePrice: String(row.minimum_sale_price),
          allowDiscount: row.allow_discount,
          commissionRate: String(row.commission_rate),
          materialsCount: materials?.length || 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          creatorName: row.creator_name,
        }
      })

      return {
        success: true,
        data: {
          items,
          totalCount,
          currentPage: page,
          totalPages,
        },
      }
    } catch (err) {
      logger.error('Exceção ao listar serviços', err)
      return { success: false, error: 'Erro inesperado ao consultar serviços.' }
    }
  }

  /**
   * Obtém os detalhes completos de um serviço incluindo materiais
   */
  async getServiceById(organizationId: UUID, serviceId: UUID): Promise<ServiceResult<ServiceDetail>> {
    try {
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select(
          `
          *,
          service_categories ( id, name )
        `,
        )
        .eq('organization_id', organizationId)
        .eq('id', serviceId)
        .single()

      if (serviceError || !service) {
        return { success: false, error: 'Serviço não encontrado.' }
      }

      // Busca materiais vinculados com dados do produto no estoque
      const { data: materials, error: matError } = await supabase
        .from('service_materials')
        .select(
          `
          id,
          service_id,
          inventory_item_id,
          quantity,
          unit,
          unit_cost,
          total_cost,
          inventory_items ( id, name, unit, quantity_on_hand )
        `,
        )
        .eq('organization_id', organizationId)
        .eq('service_id', serviceId)

      if (matError) {
        logger.error('Erro ao buscar materiais do serviço', { message: matError.message })
      }

      const formattedMaterials: ServiceMaterialDetail[] = (materials || []).map((m) => {
        const item = m.inventory_items as unknown as {
          id: string
          name: string
          unit: string
          quantity_on_hand: number
        } | null

        return {
          id: m.id,
          serviceId: m.service_id,
          inventoryItemId: m.inventory_item_id,
          productName: item?.name || 'Material do Estoque',
          quantity: String(m.quantity),
          unit: m.unit || item?.unit || 'UN',
          unitCost: String(m.unit_cost),
          totalCost: String(m.total_cost),
          availableStock: item ? String(item.quantity_on_hand) : undefined,
        }
      })

      const cat = service.service_categories as unknown as { id: string; name: string } | null

      const detail: ServiceDetail = {
        id: service.id,
        organizationId: service.organization_id,
        serviceCode: service.service_code,
        name: service.name,
        description: service.description,
        categoryId: service.category_id,
        categoryName: cat?.name || null,
        billingUnit: service.billing_unit,
        estimatedTime: service.estimated_time,
        isActive: service.is_active,
        internalNotes: service.internal_notes,

        operationalCost: String(service.operational_cost),
        laborCost: String(service.labor_cost),
        materialsCost: String(service.materials_cost),
        totalCost: String(service.total_cost),
        salePrice: String(service.sale_price),
        profitMargin: String(service.profit_margin),
        minimumSalePrice: String(service.minimum_sale_price),
        allowDiscount: service.allow_discount,
        commissionRate: String(service.commission_rate),

        lc116Item: service.lc116_item,
        nfsNationalCode: service.nfs_national_code,
        nfsMunicipalCode: service.nfs_municipal_code,
        cnaeCode: service.cnae_code,
        nbsCode: service.nbs_code,
        fiscalDescription: service.fiscal_description,
        issRate: String(service.iss_rate || 0),
        issTaxType: service.iss_tax_type || 'tributavel',
        issWithheld: service.iss_withheld || false,
        deductionsAllowed: service.deductions_allowed || false,
        issRequirement: service.iss_requirement,
        cstIbsCbs: service.cst_ibs_cbs,
        cClassTrib: service.c_class_trib,
        ibsRate: String(service.ibs_rate || 0),
        cbsRate: String(service.cbs_rate || 0),
        taxRulesNotes: service.tax_rules_notes,

        materials: formattedMaterials,
        materialsCount: formattedMaterials.length,
        createdAt: service.created_at,
        updatedAt: service.updated_at,
        creatorName: service.creator_name,
      }

      return { success: true, data: detail }
    } catch (err) {
      logger.error('Exceção ao buscar serviço por ID', err)
      return { success: false, error: 'Erro inesperado ao consultar serviço.' }
    }
  }

  /**
   * Cadastra um novo serviço com materiais vinculados
   */
  async createService(
    organizationId: UUID,
    params: CreateServiceParams,
  ): Promise<ServiceResult<{ serviceId: UUID }>> {
    try {
      const code = params.serviceCode?.trim() || (await this.generateNextServiceCode(organizationId))

      // Validação de unicidade de código
      const { data: existingCode } = await supabase
        .from('services')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('service_code', code)
        .maybeSingle()

      if (existingCode) {
        return { success: false, error: `Já existe um serviço com o código "${code}".` }
      }

      // Calcula custo de materiais
      let computedMaterialsCost = Number(params.materialsCost || 0)
      if (params.materials && params.materials.length > 0) {
        computedMaterialsCost = params.materials.reduce((acc, m) => {
          const q = Number(m.quantity) || 0
          const c = Number(m.unitCost) || 0
          return acc + q * c
        }, 0)
      }

      const totalCost = (
        Number(params.operationalCost || 0) +
        Number(params.laborCost || 0) +
        computedMaterialsCost
      ).toFixed(4)

      const payload = {
        organization_id: organizationId,
        service_code: code,
        name: params.name.trim(),
        description: params.description?.trim() || null,
        category_id: params.categoryId || null,
        billing_unit: params.billingUnit || 'unidade',
        estimated_time: params.estimatedTime?.trim() || null,
        is_active: params.isActive !== undefined ? params.isActive : true,
        internal_notes: params.internalNotes?.trim() || null,

        operational_cost: params.operationalCost || '0.0000',
        labor_cost: params.laborCost || '0.0000',
        materials_cost: computedMaterialsCost.toFixed(4),
        total_cost: totalCost,
        sale_price: params.salePrice || '0.0000',
        profit_margin: params.profitMargin || '0.00',
        minimum_sale_price: params.minimumSalePrice || '0.0000',
        allow_discount: params.allowDiscount !== undefined ? params.allowDiscount : true,
        commission_rate: params.commissionRate || '0.00',

        lc116_item: params.lc116Item?.trim() || null,
        nfs_national_code: params.nfsNationalCode?.trim() || null,
        nfs_municipal_code: params.nfsMunicipalCode?.trim() || null,
        cnae_code: params.cnaeCode?.trim() || null,
        nbs_code: params.nbsCode?.trim() || null,
        fiscal_description: params.fiscalDescription?.trim() || null,
        iss_rate: params.issRate || '0.0000',
        iss_tax_type: params.issTaxType || 'tributavel',
        iss_withheld: params.issWithheld ?? false,
        deductions_allowed: params.deductionsAllowed ?? false,
        iss_requirement: params.issRequirement || 'exigivel',
        cst_ibs_cbs: params.cstIbsCbs?.trim() || null,
        c_class_trib: params.cClassTrib?.trim() || null,
        ibs_rate: params.ibsRate || '0.0000',
        cbs_rate: params.cbsRate || '0.0000',
        tax_rules_notes: params.taxRulesNotes?.trim() || null,
        creator_name: params.creatorName || null,
      }

      const { data: inserted, error: insertError } = await supabase
        .from('services')
        .insert(payload)
        .select('id')
        .single()

      if (insertError || !inserted) {
        logger.error('Erro ao inserir serviço', { message: insertError?.message })
        return { success: false, error: 'Não foi possível cadastrar o serviço.' }
      }

      const serviceId = inserted.id

      // Insere materiais vinculados, se houver
      if (params.materials && params.materials.length > 0) {
        const materialsPayload = params.materials.map((m) => {
          const q = Number(m.quantity) || 1
          const c = Number(m.unitCost) || 0
          return {
            organization_id: organizationId,
            service_id: serviceId,
            inventory_item_id: m.inventoryItemId,
            quantity: q.toFixed(4),
            unit: m.unit || 'UN',
            unit_cost: c.toFixed(4),
            total_cost: (q * c).toFixed(4),
          }
        })

        const { error: matError } = await supabase.from('service_materials').insert(materialsPayload)
        if (matError) {
          logger.error('Erro ao inserir materiais vinculados ao serviço', { message: matError.message })
        }
      }

      return { success: true, data: { serviceId } }
    } catch (err) {
      logger.error('Exceção ao criar serviço', err)
      return { success: false, error: 'Erro inesperado ao cadastrar serviço.' }
    }
  }

  /**
   * Atualiza um serviço existente
   */
  async updateService(
    organizationId: UUID,
    serviceId: UUID,
    params: CreateServiceParams,
  ): Promise<ServiceResult<void>> {
    try {
      // Validação de unicidade de código para outro serviço
      if (params.serviceCode?.trim()) {
        const code = params.serviceCode.trim()
        const { data: existingCode } = await supabase
          .from('services')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('service_code', code)
          .neq('id', serviceId)
          .maybeSingle()

        if (existingCode) {
          return { success: false, error: `Já existe outro serviço com o código "${code}".` }
        }
      }

      let computedMaterialsCost = Number(params.materialsCost || 0)
      if (params.materials && params.materials.length > 0) {
        computedMaterialsCost = params.materials.reduce((acc, m) => {
          const q = Number(m.quantity) || 0
          const c = Number(m.unitCost) || 0
          return acc + q * c
        }, 0)
      }

      const totalCost = (
        Number(params.operationalCost || 0) +
        Number(params.laborCost || 0) +
        computedMaterialsCost
      ).toFixed(4)

      const updatePayload = {
        service_code: params.serviceCode?.trim(),
        name: params.name.trim(),
        description: params.description?.trim() || null,
        category_id: params.categoryId || null,
        billing_unit: params.billingUnit || 'unidade',
        estimated_time: params.estimatedTime?.trim() || null,
        is_active: params.isActive !== undefined ? params.isActive : true,
        internal_notes: params.internalNotes?.trim() || null,

        operational_cost: params.operationalCost || '0.0000',
        labor_cost: params.laborCost || '0.0000',
        materials_cost: computedMaterialsCost.toFixed(4),
        total_cost: totalCost,
        sale_price: params.salePrice || '0.0000',
        profit_margin: params.profitMargin || '0.00',
        minimum_sale_price: params.minimumSalePrice || '0.0000',
        allow_discount: params.allowDiscount !== undefined ? params.allowDiscount : true,
        commission_rate: params.commissionRate || '0.00',

        lc116_item: params.lc116Item?.trim() || null,
        nfs_national_code: params.nfsNationalCode?.trim() || null,
        nfs_municipal_code: params.nfsMunicipalCode?.trim() || null,
        cnae_code: params.cnaeCode?.trim() || null,
        nbs_code: params.nbsCode?.trim() || null,
        fiscal_description: params.fiscalDescription?.trim() || null,
        iss_rate: params.issRate || '0.0000',
        iss_tax_type: params.issTaxType || 'tributavel',
        iss_withheld: params.issWithheld ?? false,
        deductions_allowed: params.deductionsAllowed ?? false,
        iss_requirement: params.issRequirement || 'exigivel',
        cst_ibs_cbs: params.cstIbsCbs?.trim() || null,
        c_class_trib: params.cClassTrib?.trim() || null,
        ibs_rate: params.ibsRate || '0.0000',
        cbs_rate: params.cbsRate || '0.0000',
        tax_rules_notes: params.taxRulesNotes?.trim() || null,
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('services')
        .update(updatePayload)
        .eq('organization_id', organizationId)
        .eq('id', serviceId)

      if (updateError) {
        logger.error('Erro ao atualizar serviço', { message: updateError.message })
        return { success: false, error: 'Não foi possível salvar as alterações do serviço.' }
      }

      // Atualiza materiais: remove antigos e insere os novos
      await supabase
        .from('service_materials')
        .delete()
        .eq('organization_id', organizationId)
        .eq('service_id', serviceId)

      if (params.materials && params.materials.length > 0) {
        const materialsPayload = params.materials.map((m) => {
          const q = Number(m.quantity) || 1
          const c = Number(m.unitCost) || 0
          return {
            organization_id: organizationId,
            service_id: serviceId,
            inventory_item_id: m.inventoryItemId,
            quantity: q.toFixed(4),
            unit: m.unit || 'UN',
            unit_cost: c.toFixed(4),
            total_cost: (q * c).toFixed(4),
          }
        })

        const { error: matError } = await supabase.from('service_materials').insert(materialsPayload)
        if (matError) {
          logger.error('Erro ao atualizar materiais vinculados ao serviço', { message: matError.message })
        }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao atualizar serviço', err)
      return { success: false, error: 'Erro inesperado ao salvar serviço.' }
    }
  }

  /**
   * Alterna a situação ativo/inativo de um serviço
   */
  async toggleActive(organizationId: UUID, serviceId: UUID, isActive: boolean): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('organization_id', organizationId)
        .eq('id', serviceId)

      if (error) {
        logger.error('Erro ao alternar status do serviço', { message: error.message })
        return { success: false, error: 'Não foi possível alterar a situação do serviço.' }
      }

      return { success: true, data: undefined }
    } catch {
      return { success: false, error: 'Erro inesperado ao alterar situação.' }
    }
  }

  /**
   * Exclusão segura: se o serviço já foi utilizado em propostas ou vendas, impede a exclusão
   */
  async deleteService(organizationId: UUID, serviceId: UUID): Promise<ServiceResult<void>> {
    try {
      // 1. Verifica se já foi utilizado em quote_items
      const { count, error: countError } = await supabase
        .from('quote_items')
        .select('id', { count: 'exact', head: true })
        .eq('service_id', serviceId)

      if (countError) {
        logger.error('Erro ao verificar dependências do serviço', { message: countError.message })
      }

      if (count && count > 0) {
        return {
          success: false,
          error:
            'Este serviço já foi utilizado em orçamentos ou vendas e não pode ser excluído para preservar o histórico financeiro e fiscal. Caso não queira mais utilizá-lo, inative o serviço.',
        }
      }

      // 2. Remove materiais vinculados primeiro
      await supabase
        .from('service_materials')
        .delete()
        .eq('organization_id', organizationId)
        .eq('service_id', serviceId)

      // 3. Exclui o serviço
      const { error: delError } = await supabase
        .from('services')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', serviceId)

      if (delError) {
        logger.error('Erro ao excluir serviço', { message: delError.message })
        return { success: false, error: 'Não foi possível excluir o serviço.' }
      }

      return { success: true, data: undefined }
    } catch (err) {
      logger.error('Exceção ao excluir serviço', err)
      return { success: false, error: 'Erro inesperado ao excluir serviço.' }
    }
  }

  /**
   * Lista categorias de serviços
   */
  async listCategories(organizationId: UUID): Promise<ServiceResult<ServiceCategory[]>> {
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('id, organization_id, name, description, created_at')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true })

      if (error) {
        logger.error('Erro ao listar categorias de serviços', { message: error.message })
        return { success: false, error: 'Não foi possível carregar as categorias de serviço.' }
      }

      const categories: ServiceCategory[] = (data || []).map((c) => ({
        id: c.id,
        organizationId: c.organization_id,
        name: c.name,
        description: c.description,
        createdAt: c.created_at,
      }))

      return { success: true, data: categories }
    } catch (err) {
      logger.error('Exceção ao listar categorias', err)
      return { success: false, error: 'Erro inesperado ao consultar categorias.' }
    }
  }

  /**
   * Cria nova categoria de serviço
   */
  async createCategory(
    organizationId: UUID,
    name: string,
    description?: string,
  ): Promise<ServiceResult<ServiceCategory>> {
    try {
      const trimmedName = name.trim()
      if (trimmedName.length < 2) {
        return { success: false, error: 'O nome da categoria deve ter pelo menos 2 caracteres.' }
      }

      const { data, error } = await supabase
        .from('service_categories')
        .insert({
          organization_id: organizationId,
          name: trimmedName,
          description: description?.trim() || null,
        })
        .select('id, organization_id, name, description, created_at')
        .single()

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: `A categoria "${trimmedName}" já está cadastrada.` }
        }
        logger.error('Erro ao criar categoria de serviço', { message: error.message })
        return { success: false, error: 'Não foi possível cadastrar a categoria.' }
      }

      return {
        success: true,
        data: {
          id: data.id,
          organizationId: data.organization_id,
          name: data.name,
          description: data.description,
          createdAt: data.created_at,
        },
      }
    } catch (err) {
      logger.error('Exceção ao criar categoria', err)
      return { success: false, error: 'Erro inesperado ao criar categoria.' }
    }
  }

  /**
   * Histórico de alterações de preços do serviço
   */
  async getServicePriceHistory(
    organizationId: UUID,
    serviceId: UUID,
  ): Promise<ServiceResult<ServicePriceHistoryItem[]>> {
    try {
      const { data, error } = await supabase
        .from('service_price_history')
        .select('id, service_id, old_price, new_price, changed_by_name, created_at')
        .eq('organization_id', organizationId)
        .eq('service_id', serviceId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Erro ao buscar histórico de preços', { message: error.message })
        return { success: false, error: 'Não foi possível carregar o histórico de preços.' }
      }

      const items: ServicePriceHistoryItem[] = (data || []).map((h) => ({
        id: h.id,
        serviceId: h.service_id,
        oldPrice: String(h.old_price),
        newPrice: String(h.new_price),
        changedByName: h.changed_by_name,
        createdAt: h.created_at,
      }))

      return { success: true, data: items }
    } catch {
      return { success: false, error: 'Erro inesperado ao consultar histórico.' }
    }
  }

  /**
   * Histórico de utilização do serviço em orçamentos e vendas
   */
  async getServiceUsageHistory(
    organizationId: UUID,
    serviceId: UUID,
  ): Promise<ServiceResult<ServiceUsageHistoryItem[]>> {
    try {
      const { data, error } = await supabase
        .from('quote_items')
        .select(`
          id,
          quantity,
          unit_price,
          total,
          quote_id,
          quotes!inner (
            id,
            quote_number,
            status,
            created_at,
            customers (
              name
            )
          )
        `)
        .eq('organization_id', organizationId)
        .eq('service_id', serviceId)
        .limit(50)

      if (error) {
        logger.error('Erro ao buscar histórico de utilização do serviço', { message: error.message })
        return { success: false, error: 'Não foi possível carregar o histórico de utilização.' }
      }

      interface UsageRow {
        id: string
        quantity: number
        unit_price: number
        total: number
        quote_id: string
        quotes: {
          id: string
          quote_number: string
          status: string
          created_at: string
          customers: { name: string }[] | { name: string } | null
        } | null
      }

      const list: ServiceUsageHistoryItem[] = ((data || []) as unknown as UsageRow[]).map((row) => {
        const q = row.quotes
        const cust = Array.isArray(q?.customers) ? q.customers[0] : q?.customers
        const isSale = q?.quote_number?.startsWith('VND-')
        return {
          quoteId: q?.id || row.quote_id,
          quoteNumber: q?.quote_number || 'Sem número',
          type: isSale ? 'sale' : 'quote',
          status: q?.status || 'draft',
          customerName: cust?.name || 'Consumidor',
          quantity: String(row.quantity),
          unitPrice: String(row.unit_price),
          total: String(row.total),
          createdAt: q?.created_at || new Date().toISOString(),
        }
      })

      return { success: true, data: list }
    } catch {
      return { success: false, error: 'Erro inesperado ao consultar histórico de utilização.' }
    }
  }
}

export const serviceService = new ServiceService()
