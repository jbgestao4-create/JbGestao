import * as XLSX from 'xlsx'
import { supabase } from '@app/config/supabase'
import {
  lookupPostalAddress,
  formatPostalAddress,
  formatPostalCode,
} from '@modules/customers/utils/postal-code'
import type {
  ImportOptions,
  ImportSummary,
  ParsedSpreadsheet,
} from '../types/import.types'

export class ImportEngineService {
  /**
   * Converte o arquivo (.xlsx, .xls ou .csv) em linhas e cabeçalhos normalizados
   */
  static async parseSpreadsheet(file: File): Promise<ParsedSpreadsheet> {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array' })

    if (!workbook.SheetNames.length) {
      throw new Error('O arquivo enviado não contém nenhuma planilha legível.')
    }

    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    // Leitura crua
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
    if (rawRows.length === 0) {
      throw new Error('A planilha está vazia ou não contém linhas de dados para importar.')
    }

    // Normalização dos nomes das chaves (remover acentos, espaços viram underline, minúsculo)
    const normalizeKey = (key: string) =>
      key
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_]/g, '_')

    const normalizedRows = rawRows.map((row) => {
      const normalizedRow: Record<string, any> = {}
      for (const [key, value] of Object.entries(row)) {
        const cleanKey = normalizeKey(key)
        normalizedRow[cleanKey] = typeof value === 'string' ? value.trim() : value
      }
      return normalizedRow
    })

    const headers = Object.keys(normalizedRows[0] || {})
    return { headers, rows: normalizedRows }
  }

  // ==========================================
  // 1. IMPORTAÇÃO DE CLIENTES
  // ==========================================
  static async importCustomers(
    rows: Record<string, any>[],
    organizationId: string,
    options: ImportOptions,
    onProgress?: (progress: number) => void
  ): Promise<ImportSummary> {
    const summary: ImportSummary = {
      totalRows: rows.length,
      successCount: 0,
      errorCount: 0,
      autoCreatedDependenciesCount: 0,
      errors: [],
      rejectedRowsData: []
    }

    // Carregar clientes existentes para verificação de duplicidade por documento
    const { data: existingCustomers } = await supabase
      .from('customers')
      .select('id, document, name')
      .eq('organization_id', organizationId)

    const docMap = new Map<string, string>() // doc limpo -> id
    existingCustomers?.forEach((c) => {
      if (c.document) {
        docMap.set(c.document.replace(/\D/g, ''), c.id)
      }
    })

    const toInsert: any[] = []
    const toUpdate: any[] = []

    // Cache de CEPs em memória para evitar chamadas de rede redundantes
    const cepCache = new Map<string, string | null>()

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2
      const name = String(row['nome'] || row['nome_cliente'] || row['razao_social'] || '').trim()
      const rawPersonType = String(row['tipo_pessoa'] || row['tipo'] || 'F').toUpperCase().trim()
      const rawDoc = String(row['cpf_cnpj'] || row['documento'] || row['cpf'] || row['cnpj'] || '').trim()
      const cleanDoc = rawDoc.replace(/\D/g, '')

      const identifier = name || rawDoc || `Linha ${rowNum}`

      if (!name) {
        summary.errors.push({
          rowNumber: rowNum,
          recordIdentifier: identifier,
          field: 'nome',
          receivedValue: '',
          reason: 'O nome do cliente é obrigatório.'
        })
        summary.errorCount++
        summary.rejectedRowsData.push({ ...row, __erro_motivo: 'Nome do cliente ausente' })
        continue
      }

      const personType = rawPersonType.startsWith('J') ? 'company' : 'individual'

      if (cleanDoc) {
        if (personType === 'individual' && cleanDoc.length !== 11) {
          summary.errors.push({
            rowNumber: rowNum,
            recordIdentifier: identifier,
            field: 'cpf_cnpj',
            receivedValue: rawDoc,
            reason: `CPF inválido. Deve conter 11 dígitos numéricos (recebido: ${cleanDoc.length}).`
          })
          summary.errorCount++
          summary.rejectedRowsData.push({ ...row, __erro_motivo: 'CPF inválido (deve ter 11 dígitos)' })
          continue
        } else if (personType === 'company' && cleanDoc.length !== 14) {
          summary.errors.push({
            rowNumber: rowNum,
            recordIdentifier: identifier,
            field: 'cpf_cnpj',
            receivedValue: rawDoc,
            reason: `CNPJ inválido. Deve conter 14 dígitos numéricos (recebido: ${cleanDoc.length}).`
          })
          summary.errorCount++
          summary.rejectedRowsData.push({ ...row, __erro_motivo: 'CNPJ inválido (deve ter 14 dígitos)' })
          continue
        }
      }

      // Preenchimento e enriquecimento automático de endereço via API de CEP
      const rawCep = String(row['cep'] || row['codigo_postal'] || '').trim()
      const cleanCep = rawCep.replace(/\D/g, '')
      let resolvedAddress = row['endereco'] || row['logradouro'] ? String(row['endereco'] || row['logradouro']).trim() : ''

      if (cleanCep.length === 8) {
        let apiAddress = cepCache.get(cleanCep)
        if (apiAddress === undefined) {
          try {
            const apiResult = await lookupPostalAddress(cleanCep)
            apiAddress = formatPostalAddress(apiResult)
            cepCache.set(cleanCep, apiAddress)
          } catch {
            cepCache.set(cleanCep, null)
            apiAddress = null
          }
        }

        // Se o endereço não foi informado ou está vazio, preenche automaticamente com o retorno da API
        if (!resolvedAddress && apiAddress) {
          resolvedAddress = apiAddress
        }
      }

      const formattedPostalCode = cleanCep.length === 8 ? formatPostalCode(cleanCep) : (rawCep || null)

      const payload = {
        organization_id: organizationId,
        name,
        person_type: personType,
        document: cleanDoc || null,
        email: row['email'] ? String(row['email']).trim() : null,
        phone: row['telefone'] || row['celular'] ? String(row['telefone'] || row['celular']).trim() : null,
        postal_code: formattedPostalCode,
        address: resolvedAddress || null,
        address_number: row['numero'] ? String(row['numero']).trim() : null,
        notes: row['observacoes'] || row['obs'] ? String(row['observacoes'] || row['obs']).trim() : null
      }

      const existingId = cleanDoc ? docMap.get(cleanDoc) : null
      if (existingId) {
        if (options.onDuplicate === 'reject') {
          summary.errors.push({
            rowNumber: rowNum,
            recordIdentifier: identifier,
            field: 'cpf_cnpj',
            receivedValue: rawDoc,
            reason: `Cliente com CPF/CNPJ ${rawDoc} já cadastrado no sistema.`
          })
          summary.errorCount++
          summary.rejectedRowsData.push({ ...row, __erro_motivo: 'Documento duplicado (Rejeitado pela regra)' })
          continue
        } else {
          toUpdate.push({ ...payload, id: existingId })
        }
      } else {
        toInsert.push(payload)
      }

      if (onProgress && i % 20 === 0) {
        onProgress(Math.round((i / rows.length) * 50))
      }
    }

    // Salvar novos em lote
    const CHUNK_SIZE = 100
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE)
      const { error } = await supabase.from('customers').insert(chunk)
      if (error) {
        throw new Error(`Falha ao gravar clientes: ${error.message}`)
      }
      summary.successCount += chunk.length
    }

    // Atualizar existentes
    for (const item of toUpdate) {
      const { error } = await supabase.from('customers').update(item).eq('id', item.id)
      if (!error) {
        summary.successCount++
      } else {
        summary.errorCount++
        summary.errors.push({
          rowNumber: 0,
          recordIdentifier: item.name,
          field: 'atualizacao',
          receivedValue: item.id,
          reason: `Erro ao atualizar cliente: ${error.message}`
        })
      }
    }

    if (onProgress) onProgress(100)
    return summary
  }

  // ==========================================
  // 2. IMPORTAÇÃO DE FORNECEDORES
  // ==========================================
  static async importSuppliers(
    rows: Record<string, any>[],
    organizationId: string,
    options: ImportOptions,
    onProgress?: (progress: number) => void
  ): Promise<ImportSummary> {
    const summary: ImportSummary = {
      totalRows: rows.length,
      successCount: 0,
      errorCount: 0,
      autoCreatedDependenciesCount: 0,
      errors: [],
      rejectedRowsData: []
    }

    const { data: existingSuppliers } = await supabase
      .from('suppliers')
      .select('id, document, name')
      .eq('organization_id', organizationId)

    const docMap = new Map<string, string>()
    const nameMap = new Map<string, string>()
    existingSuppliers?.forEach((s) => {
      if (s.document) docMap.set(s.document.replace(/\D/g, ''), s.id)
      nameMap.set(s.name.toLowerCase().trim(), s.id)
    })

    const toInsert: any[] = []
    const toUpdate: any[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2
      const name = String(row['razao_social'] || row['nome'] || row['fornecedor'] || '').trim()
      const rawDoc = String(row['cnpj'] || row['documento'] || row['cpf_cnpj'] || '').trim()
      const cleanDoc = rawDoc.replace(/\D/g, '')

      const identifier = name || rawDoc || `Linha ${rowNum}`

      if (!name) {
        summary.errors.push({
          rowNumber: rowNum,
          recordIdentifier: identifier,
          field: 'razao_social',
          receivedValue: '',
          reason: 'A razão social / nome do fornecedor é obrigatória.'
        })
        summary.errorCount++
        summary.rejectedRowsData.push({ ...row, __erro_motivo: 'Razão social ausente' })
        continue
      }

      if (cleanDoc && cleanDoc.length !== 14 && cleanDoc.length !== 11) {
        summary.errors.push({
          rowNumber: rowNum,
          recordIdentifier: identifier,
          field: 'cnpj',
          receivedValue: rawDoc,
          reason: 'CNPJ/CPF inválido. Deve conter 14 (CNPJ) ou 11 (CPF) dígitos.'
        })
        summary.errorCount++
        summary.rejectedRowsData.push({ ...row, __erro_motivo: 'CNPJ/CPF com quantidade de dígitos inválida' })
        continue
      }

      const payload = {
        organization_id: organizationId,
        name,
        document: cleanDoc || null,
        contact_name: row['contato_responsavel'] || row['contato'] ? String(row['contato_responsavel'] || row['contato']).trim() : null,
        phone: row['telefone'] || row['celular'] ? String(row['telefone'] || row['celular']).trim() : null,
        email: row['email'] ? String(row['email']).trim() : null,
        address: row['endereco'] ? String(row['endereco']).trim() : null,
        notes: row['observacoes'] ? String(row['observacoes']).trim() : null
      }

      const existingId = (cleanDoc ? docMap.get(cleanDoc) : null) || nameMap.get(name.toLowerCase())
      if (existingId) {
        if (options.onDuplicate === 'reject') {
          summary.errors.push({
            rowNumber: rowNum,
            recordIdentifier: identifier,
            field: 'cnpj',
            receivedValue: rawDoc || name,
            reason: `Fornecedor "${name}" já cadastrado.`
          })
          summary.errorCount++
          summary.rejectedRowsData.push({ ...row, __erro_motivo: 'Fornecedor já existente (Rejeitado)' })
          continue
        } else {
          toUpdate.push({ ...payload, id: existingId })
        }
      } else {
        toInsert.push(payload)
      }

      if (onProgress && i % 20 === 0) {
        onProgress(Math.round((i / rows.length) * 50))
      }
    }

    const CHUNK_SIZE = 100
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE)
      const { error } = await supabase.from('suppliers').insert(chunk)
      if (error) {
        throw new Error(`Falha ao gravar fornecedores: ${error.message}`)
      }
      summary.successCount += chunk.length
    }

    for (const item of toUpdate) {
      const { error } = await supabase.from('suppliers').update(item).eq('id', item.id)
      if (!error) {
        summary.successCount++
      } else {
        summary.errorCount++
      }
    }

    if (onProgress) onProgress(100)
    return summary
  }

  // ==========================================
  // 3. IMPORTAÇÃO DE ESTOQUE (INVENTORY_ITEMS)
  // COM DEPENDÊNCIA DE FORNECEDORES
  // ==========================================
  static async importInventory(
    rows: Record<string, any>[],
    organizationId: string,
    options: ImportOptions,
    onProgress?: (progress: number) => void
  ): Promise<ImportSummary> {
    const summary: ImportSummary = {
      totalRows: rows.length,
      successCount: 0,
      errorCount: 0,
      autoCreatedDependenciesCount: 0,
      errors: [],
      rejectedRowsData: []
    }

    // 1. Pré-carregar Fornecedores
    const { data: existingSuppliers } = await supabase
      .from('suppliers')
      .select('id, name, document')
      .eq('organization_id', organizationId)

    const supplierMap = new Map<string, string>()
    existingSuppliers?.forEach((s) => {
      if (s.document) supplierMap.set(s.document.replace(/\D/g, ''), s.id)
      supplierMap.set(s.name.toLowerCase().trim(), s.id)
    })

    // 2. Pré-carregar Itens do Estoque existentes para validação de duplicidade e cálculo do próximo código
    const { data: existingItems } = await supabase
      .from('inventory_items')
      .select('id, sku, barcode, name')
      .eq('organization_id', organizationId)

    const skuMap = new Map<string, string>()
    const barcodeMap = new Map<string, string>()
    const nameMap = new Map<string, string>()
    let maxSequentialCode = 0

    existingItems?.forEach((item) => {
      if (item.sku) {
        skuMap.set(item.sku.toLowerCase().trim(), item.id)
        const cleaned = item.sku.replace(/^\D+/, '')
        const num = parseInt(cleaned || item.sku, 10)
        if (!isNaN(num) && num > maxSequentialCode) {
          maxSequentialCode = num
        }
      }
      if (item.barcode) barcodeMap.set(item.barcode.trim(), item.id)
      if (item.name) nameMap.set(item.name.toLowerCase().trim(), item.id)
    })

    const toInsert: any[] = []
    const toUpdate: any[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2
      const rawSku = String(row['codigo_interno'] || row['codigo'] || row['sku'] || '').trim()
      const name = String(row['nome_produto'] || row['nome'] || row['descricao'] || '').trim()
      const barcode = row['codigo_barras'] || row['cod_barras'] ? String(row['codigo_barras'] || row['cod_barras']).trim() : null
      const unit = String(row['unidade_medida'] || row['unidade'] || 'UN').trim().toUpperCase()
      const category = row['categoria'] ? String(row['categoria']).trim() : null
      const supplierRaw = String(row['fornecedor'] || row['fornecedor_doc_ou_nome'] || '').trim()

      const identifier = name || rawSku || `Linha ${rowNum}`

      // Validação obrigatória: apenas o Nome do produto é indispensável
      if (!name) {
        summary.errors.push({
          rowNumber: rowNum,
          recordIdentifier: identifier,
          field: 'nome_produto',
          receivedValue: '',
          reason: 'O nome do produto é obrigatório.'
        })
        summary.errorCount++
        summary.rejectedRowsData.push({ ...row, __erro_motivo: 'Nome do produto ausente' })
        continue
      }

      // Validação de Preço de Venda
      const rawPrice = String(row['preco_venda'] || row['valor_venda'] || '').replace(',', '.')
      const unitPrice = parseFloat(rawPrice)
      if (isNaN(unitPrice) || unitPrice < 0) {
        summary.errors.push({
          rowNumber: rowNum,
          recordIdentifier: identifier,
          field: 'preco_venda',
          receivedValue: row['preco_venda'],
          reason: 'Preço de venda inválido. Deve ser um número maior ou igual a zero.'
        })
        summary.errorCount++
        summary.rejectedRowsData.push({ ...row, __erro_motivo: 'Preço de venda inválido' })
        continue
      }

      // Validação de Preço de Custo (opcional)
      let costPrice = 0
      if (row['preco_custo'] || row['valor_custo']) {
        const parsedCost = parseFloat(String(row['preco_custo'] || row['valor_custo']).replace(',', '.'))
        if (!isNaN(parsedCost) && parsedCost >= 0) {
          costPrice = parsedCost
        }
      }

      // Validação de Quantidade Atual
      let qtyOnHand = 0
      if (row['estoque_atual'] || row['quantidade']) {
        const parsedQty = parseFloat(String(row['estoque_atual'] || row['quantidade']).replace(',', '.'))
        if (!isNaN(parsedQty)) {
          qtyOnHand = parsedQty
        }
      }

      // Validação de Quantidade Mínima
      let minQty = 0
      if (row['estoque_minimo']) {
        const parsedMin = parseFloat(String(row['estoque_minimo']).replace(',', '.'))
        if (!isNaN(parsedMin)) {
          minQty = parsedMin
        }
      }

      // RESOLUÇÃO DE DEPENDÊNCIA: FORNECEDOR
      let supplierId: string | null = null
      if (supplierRaw) {
        const cleanSupplierDoc = supplierRaw.replace(/\D/g, '')
        const foundId = (cleanSupplierDoc.length >= 11 ? supplierMap.get(cleanSupplierDoc) : null) ||
          supplierMap.get(supplierRaw.toLowerCase())

        if (foundId) {
          supplierId = foundId
        } else {
          // Fornecedor não existe no banco
          if (options.autoCreateSupplierIfMissing) {
            const isDoc = cleanSupplierDoc.length === 11 || cleanSupplierDoc.length === 14
            const { data: createdSupplier, error: supCreateErr } = await supabase
              .from('suppliers')
              .insert({
                organization_id: organizationId,
                name: supplierRaw,
                document: isDoc ? cleanSupplierDoc : null
              })
              .select('id')
              .single()

            if (!supCreateErr && createdSupplier?.id) {
              const newSupId = String(createdSupplier.id)
              supplierId = newSupId
              supplierMap.set(supplierRaw.toLowerCase(), newSupId)
              if (isDoc) supplierMap.set(cleanSupplierDoc, newSupId)
              summary.autoCreatedDependenciesCount++
            } else {
              summary.errors.push({
                rowNumber: rowNum,
                recordIdentifier: identifier,
                field: 'fornecedor',
                receivedValue: supplierRaw,
                reason: `Falha ao cadastrar automaticamente o fornecedor "${supplierRaw}".`
              })
              summary.errorCount++
              summary.rejectedRowsData.push({ ...row, __erro_motivo: 'Erro na criação automática do fornecedor' })
              continue
            }
          } else {
            summary.errors.push({
              rowNumber: rowNum,
              recordIdentifier: identifier,
              field: 'fornecedor',
              receivedValue: supplierRaw,
              reason: `Fornecedor "${supplierRaw}" não cadastrado. Cadastre o fornecedor previamente ou ative a opção de cadastro automático.`
            })
            summary.errorCount++
            summary.rejectedRowsData.push({ ...row, __erro_motivo: 'Fornecedor inexistente no banco' })
            continue
          }
        }
      }

      // Tratamento de Duplicidade (SKU informado, Barcode ou Nome)
      const existingId =
        (rawSku ? skuMap.get(rawSku.toLowerCase()) : null) ||
        (barcode ? barcodeMap.get(barcode) : null) ||
        nameMap.get(name.toLowerCase().trim())

      let assignedSku = rawSku
      if (!assignedSku) {
        if (existingId) {
          const existingItem = existingItems?.find((it) => it.id === existingId)
          assignedSku = existingItem?.sku || String(++maxSequentialCode)
        } else {
          maxSequentialCode++
          assignedSku = String(maxSequentialCode)
        }
      }

      skuMap.set(assignedSku.toLowerCase(), existingId || 'pending')

      const payload = {
        organization_id: organizationId,
        sku: assignedSku,
        name,
        barcode,
        unit,
        category,
        unit_price: unitPrice.toFixed(2),
        purchase_price: costPrice.toFixed(2),
        quantity_on_hand: qtyOnHand.toFixed(2),
        minimum_quantity: minQty.toFixed(2),
        supplier_id: supplierId,
        is_active: true,
        can_sell: true,
        can_purchase: true
      }

      if (existingId) {
        if (options.onDuplicate === 'reject') {
          summary.errors.push({
            rowNumber: rowNum,
            recordIdentifier: identifier,
            field: 'nome_produto',
            receivedValue: rawSku || name,
            reason: `Produto "${name}" (código: ${assignedSku}) já cadastrado (rejeitado por duplicidade).`
          })
          summary.errorCount++
          summary.rejectedRowsData.push({ ...row, __erro_motivo: 'Produto duplicado' })
          continue
        } else {
          toUpdate.push({ ...payload, id: existingId })
        }
      } else {
        toInsert.push(payload)
      }

      if (onProgress && i % 25 === 0) {
        onProgress(Math.round((i / rows.length) * 50))
      }
    }

    // Gravação em lotes (chunks) de novos produtos
    const CHUNK_SIZE = 100
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE)
      const { error } = await supabase.from('inventory_items').insert(chunk)
      if (error) {
        throw new Error(`Falha ao inserir produtos no banco: ${error.message}`)
      }
      summary.successCount += chunk.length
      if (onProgress) {
        onProgress(50 + Math.round((i / toInsert.length) * 50))
      }
    }

    // Atualização dos produtos existentes
    for (const item of toUpdate) {
      const { error } = await supabase
        .from('inventory_items')
        .update(item)
        .eq('id', item.id)
        .eq('organization_id', organizationId)

      if (!error) {
        summary.successCount++
      } else {
        summary.errorCount++
        summary.errors.push({
          rowNumber: 0,
          recordIdentifier: item.sku,
          field: 'atualizacao',
          receivedValue: item.id,
          reason: `Erro ao atualizar produto: ${error.message}`
        })
      }
    }

    if (onProgress) onProgress(100)
    return summary
  }

  // ==========================================
  // 4. IMPORTAÇÃO DE VENDAS
  // COM DEPENDÊNCIA DE CLIENTES E PRODUTOS
  // ==========================================
  static async importSales(
    rows: Record<string, any>[],
    organizationId: string,
    options: ImportOptions,
    onProgress?: (progress: number) => void
  ): Promise<ImportSummary> {
    const summary: ImportSummary = {
      totalRows: rows.length,
      successCount: 0,
      errorCount: 0,
      autoCreatedDependenciesCount: 0,
      errors: [],
      rejectedRowsData: []
    }

    // Carregar clientes e produtos para validação das chaves
    const [{ data: customers }, { data: products }] = await Promise.all([
      supabase.from('customers').select('id, name, document').eq('organization_id', organizationId),
      supabase.from('inventory_items').select('id, sku, barcode, name, unit_price').eq('organization_id', organizationId)
    ])

    const customerMap = new Map<string, string>()
    customers?.forEach((c) => {
      if (c.document) customerMap.set(c.document.replace(/\D/g, ''), c.id)
      customerMap.set(c.name.toLowerCase().trim(), c.id)
    })

    const productMap = new Map<string, { id: string; name: string; price: number }>()
    products?.forEach((p) => {
      const itemData = { id: p.id, name: p.name, price: Number(p.unit_price) || 0 }
      if (p.sku) productMap.set(p.sku.toLowerCase().trim(), itemData)
      if (p.barcode) productMap.set(p.barcode.trim(), itemData)
      productMap.set(p.name.toLowerCase().trim(), itemData)
    })

    // Agrupar linhas por número de pedido
    const ordersMap = new Map<string, {
      orderNumber: string
      customerRaw: string
      date: string
      paymentMethod: string
      notes: string
      items: Array<{
        productRaw: string
        qty: number
        price: number
        discount: number
        rowNum: number
        originalRow: Record<string, any>
      }>
    }>()

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2
      const orderNumber = String(row['numero_pedido'] || row['pedido'] || row['numero'] || `PED-${rowNum}`).trim()
      const customerRaw = String(row['cliente_doc_ou_nome'] || row['cliente'] || '').trim()
      const productRaw = String(row['codigo_produto'] || row['produto'] || row['sku'] || '').trim()
      const qtyRaw = parseFloat(String(row['quantidade'] || row['qtd'] || '1').replace(',', '.'))
      const priceRaw = parseFloat(String(row['preco_unitario'] || row['valor_unitario'] || '0').replace(',', '.'))
      const discountRaw = parseFloat(String(row['desconto'] || '0').replace(',', '.')) || 0

      const identifier = `${orderNumber} - ${productRaw}`

      if (!productRaw) {
        summary.errors.push({
          rowNumber: rowNum,
          recordIdentifier: identifier,
          field: 'codigo_produto',
          receivedValue: '',
          reason: 'O código ou nome do produto é obrigatório no item da venda.'
        })
        summary.errorCount++
        summary.rejectedRowsData.push({ ...row, __erro_motivo: 'Produto não informado no item' })
        continue
      }

      if (isNaN(qtyRaw) || qtyRaw <= 0) {
        summary.errors.push({
          rowNumber: rowNum,
          recordIdentifier: identifier,
          field: 'quantidade',
          receivedValue: row['quantidade'],
          reason: 'Quantidade vendida deve ser maior que zero.'
        })
        summary.errorCount++
        summary.rejectedRowsData.push({ ...row, __erro_motivo: 'Quantidade vendida inválida' })
        continue
      }

      if (!ordersMap.has(orderNumber)) {
        ordersMap.set(orderNumber, {
          orderNumber,
          customerRaw,
          date: row['data_venda'] ? String(row['data_venda']).trim() : new Date().toISOString().split('T')[0],
          paymentMethod: String(row['forma_pagamento'] || 'other').trim(),
          notes: row['observacoes'] ? String(row['observacoes']).trim() : '',
          items: []
        })
      }

      ordersMap.get(orderNumber)!.items.push({
        productRaw,
        qty: qtyRaw,
        price: isNaN(priceRaw) ? 0 : priceRaw,
        discount: discountRaw,
        rowNum,
        originalRow: row
      })
    }

    // Processar cada pedido agrupado
    for (const [, order] of ordersMap) {
      // 1. Resolver Cliente
      let customerId: string | null = null
      if (order.customerRaw) {
        const cleanDoc = order.customerRaw.replace(/\D/g, '')
        customerId =
          (cleanDoc.length >= 11 ? customerMap.get(cleanDoc) : null) ||
          customerMap.get(order.customerRaw.toLowerCase()) ||
          null
      }

      if (!customerId) {
        // Se cliente não existe, falha o pedido todo
        order.items.forEach((item) => {
          summary.errors.push({
            rowNumber: item.rowNum,
            recordIdentifier: order.orderNumber,
            field: 'cliente_doc_ou_nome',
            receivedValue: order.customerRaw,
            reason: `Cliente "${order.customerRaw || 'Não informado'}" não encontrado no sistema.`
          })
          summary.errorCount++
          summary.rejectedRowsData.push({ ...item.originalRow, __erro_motivo: 'Cliente inexistente no banco' })
        })
        continue
      }

      // 2. Resolver Produtos de todos os itens
      const validItemsPayload: any[] = []
      let orderSubtotal = 0
      let orderTotalDiscount = 0
      let hasItemError = false

      for (const item of order.items) {
        const resolvedProduct = productMap.get(item.productRaw.toLowerCase())
        if (!resolvedProduct) {
          summary.errors.push({
            rowNumber: item.rowNum,
            recordIdentifier: order.orderNumber,
            field: 'codigo_produto',
            receivedValue: item.productRaw,
            reason: `Produto "${item.productRaw}" não consta no estoque.`
          })
          summary.errorCount++
          summary.rejectedRowsData.push({ ...item.originalRow, __erro_motivo: 'Produto inexistente no estoque' })
          hasItemError = true
          continue
        }

        const unitPrice = item.price > 0 ? item.price : resolvedProduct.price
        const itemTotal = Math.max(0, item.qty * unitPrice - item.discount)

        orderSubtotal += item.qty * unitPrice
        orderTotalDiscount += item.discount

        validItemsPayload.push({
          organization_id: organizationId,
          description: resolvedProduct.name,
          inventory_item_id: resolvedProduct.id,
          quantity: item.qty,
          unit_price: unitPrice,
          total: itemTotal,
          sort_order: validItemsPayload.length
        })
      }

      if (hasItemError && options.atomic) {
        continue // Se atômico e algum item falhou, ignora o pedido
      }

      if (validItemsPayload.length === 0) {
        continue
      }

      // Criar o registro da Venda em 'quotes' com metadata de venda
      const { data: createdQuote, error: quoteErr } = await supabase
        .from('quotes')
        .insert({
          organization_id: organizationId,
          customer_id: customerId,
          quote_number: order.orderNumber,
          status: 'approved',
          subtotal: orderSubtotal,
          discount: orderTotalDiscount,
          total: Math.max(0, orderSubtotal - orderTotalDiscount),
          notes: order.notes,
          metadata: {
            isSale: true,
            importedAt: new Date().toISOString(),
            paymentMethod: order.paymentMethod
          }
        })
        .select('id')
        .single()

      if (quoteErr || !createdQuote) {
        order.items.forEach((item) => {
          summary.errors.push({
            rowNumber: item.rowNum,
            recordIdentifier: order.orderNumber,
            field: 'venda',
            receivedValue: order.orderNumber,
            reason: `Falha ao gravar pedido: ${quoteErr?.message || 'Erro desconhecido'}`
          })
          summary.errorCount++
          summary.rejectedRowsData.push({ ...item.originalRow, __erro_motivo: 'Erro na criação do pedido no banco' })
        })
        continue
      }

      // Vincular os itens ao quote_id
      const itemsToInsert = validItemsPayload.map((it) => ({
        ...it,
        quote_id: createdQuote.id
      }))

      const { error: itemsErr } = await supabase.from('quote_items').insert(itemsToInsert)
      if (itemsErr) {
        await supabase.from('quotes').delete().eq('id', createdQuote.id)
        order.items.forEach((item) => {
          summary.errors.push({
            rowNumber: item.rowNum,
            recordIdentifier: order.orderNumber,
            field: 'itens_venda',
            receivedValue: order.orderNumber,
            reason: `Falha ao gravar itens da venda: ${itemsErr.message}`
          })
          summary.errorCount++
          summary.rejectedRowsData.push({ ...item.originalRow, __erro_motivo: 'Erro ao gravar itens da venda' })
        })
      } else {
        summary.successCount += itemsToInsert.length
      }
    }

    if (onProgress) onProgress(100)
    return summary
  }

  // ==========================================
  // 5. IMPORTAÇÃO DE ORÇAMENTOS
  // ==========================================
  static async importBudgets(
    rows: Record<string, any>[],
    organizationId: string,
    options: ImportOptions,
    onProgress?: (progress: number) => void
  ): Promise<ImportSummary> {
    // Orçamentos utilizam o mesmo motor de Vendas, porém com status 'draft'
    const summary: ImportSummary = {
      totalRows: rows.length,
      successCount: 0,
      errorCount: 0,
      autoCreatedDependenciesCount: 0,
      errors: [],
      rejectedRowsData: []
    }

    const [{ data: customers }, { data: products }] = await Promise.all([
      supabase.from('customers').select('id, name, document').eq('organization_id', organizationId),
      supabase.from('inventory_items').select('id, sku, barcode, name, unit_price').eq('organization_id', organizationId)
    ])

    const customerMap = new Map<string, string>()
    customers?.forEach((c) => {
      if (c.document) customerMap.set(c.document.replace(/\D/g, ''), c.id)
      customerMap.set(c.name.toLowerCase().trim(), c.id)
    })

    const productMap = new Map<string, { id: string; name: string; price: number }>()
    products?.forEach((p) => {
      const itemData = { id: p.id, name: p.name, price: Number(p.unit_price) || 0 }
      if (p.sku) productMap.set(p.sku.toLowerCase().trim(), itemData)
      if (p.barcode) productMap.set(p.barcode.trim(), itemData)
      productMap.set(p.name.toLowerCase().trim(), itemData)
    })

    const budgetsMap = new Map<string, {
      quoteNumber: string
      customerRaw: string
      validDays: number
      notes: string
      items: Array<{
        productRaw: string
        qty: number
        price: number
        discount: number
        rowNum: number
        originalRow: Record<string, any>
      }>
    }>()

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2
      const quoteNumber = String(row['numero_orcamento'] || row['orcamento'] || row['numero'] || `ORC-${rowNum}`).trim()
      const customerRaw = String(row['cliente_doc_ou_nome'] || row['cliente'] || '').trim()
      const productRaw = String(row['codigo_produto'] || row['produto'] || row['sku'] || '').trim()
      const qtyRaw = parseFloat(String(row['quantidade'] || row['qtd'] || '1').replace(',', '.'))
      const priceRaw = parseFloat(String(row['preco_unitario'] || row['valor_unitario'] || '0').replace(',', '.'))
      const discountRaw = parseFloat(String(row['desconto'] || '0').replace(',', '.')) || 0
      const validDays = parseInt(String(row['validade_dias'] || '15'), 10) || 15

      const identifier = `${quoteNumber} - ${productRaw}`

      if (!productRaw) {
        summary.errors.push({
          rowNumber: rowNum,
          recordIdentifier: identifier,
          field: 'codigo_produto',
          receivedValue: '',
          reason: 'O código ou nome do produto é obrigatório no orçamento.'
        })
        summary.errorCount++
        summary.rejectedRowsData.push({ ...row, __erro_motivo: 'Produto não informado no orçamento' })
        continue
      }

      if (isNaN(qtyRaw) || qtyRaw <= 0) {
        summary.errors.push({
          rowNumber: rowNum,
          recordIdentifier: identifier,
          field: 'quantidade',
          receivedValue: row['quantidade'],
          reason: 'Quantidade deve ser maior que zero.'
        })
        summary.errorCount++
        summary.rejectedRowsData.push({ ...row, __erro_motivo: 'Quantidade inválida' })
        continue
      }

      if (!budgetsMap.has(quoteNumber)) {
        budgetsMap.set(quoteNumber, {
          quoteNumber,
          customerRaw,
          validDays,
          notes: row['observacoes'] ? String(row['observacoes']).trim() : '',
          items: []
        })
      }

      budgetsMap.get(quoteNumber)!.items.push({
        productRaw,
        qty: qtyRaw,
        price: isNaN(priceRaw) ? 0 : priceRaw,
        discount: discountRaw,
        rowNum,
        originalRow: row
      })
    }

    for (const [, budget] of budgetsMap) {
      let customerId: string | null = null
      if (budget.customerRaw) {
        const cleanDoc = budget.customerRaw.replace(/\D/g, '')
        customerId =
          (cleanDoc.length >= 11 ? customerMap.get(cleanDoc) : null) ||
          customerMap.get(budget.customerRaw.toLowerCase()) ||
          null
      }

      if (!customerId) {
        budget.items.forEach((item) => {
          summary.errors.push({
            rowNumber: item.rowNum,
            recordIdentifier: budget.quoteNumber,
            field: 'cliente_doc_ou_nome',
            receivedValue: budget.customerRaw,
            reason: `Cliente "${budget.customerRaw || 'Não informado'}" não encontrado.`
          })
          summary.errorCount++
          summary.rejectedRowsData.push({ ...item.originalRow, __erro_motivo: 'Cliente inexistente no banco' })
        })
        continue
      }

      const validItemsPayload: any[] = []
      let orderSubtotal = 0
      let orderTotalDiscount = 0
      let hasItemError = false

      for (const item of budget.items) {
        const resolvedProduct = productMap.get(item.productRaw.toLowerCase())
        if (!resolvedProduct) {
          summary.errors.push({
            rowNumber: item.rowNum,
            recordIdentifier: budget.quoteNumber,
            field: 'codigo_produto',
            receivedValue: item.productRaw,
            reason: `Produto "${item.productRaw}" não encontrado no estoque.`
          })
          summary.errorCount++
          summary.rejectedRowsData.push({ ...item.originalRow, __erro_motivo: 'Produto inexistente' })
          hasItemError = true
          continue
        }

        const unitPrice = item.price > 0 ? item.price : resolvedProduct.price
        const itemTotal = Math.max(0, item.qty * unitPrice - item.discount)

        orderSubtotal += item.qty * unitPrice
        orderTotalDiscount += item.discount

        validItemsPayload.push({
          organization_id: organizationId,
          description: resolvedProduct.name,
          inventory_item_id: resolvedProduct.id,
          quantity: item.qty,
          unit_price: unitPrice,
          total: itemTotal,
          sort_order: validItemsPayload.length
        })
      }

      if (hasItemError && options.atomic) {
        continue
      }

      if (validItemsPayload.length === 0) {
        continue
      }

      const validUntilDate = new Date()
      validUntilDate.setDate(validUntilDate.getDate() + budget.validDays)

      const { data: createdQuote, error: quoteErr } = await supabase
        .from('quotes')
        .insert({
          organization_id: organizationId,
          customer_id: customerId,
          quote_number: budget.quoteNumber,
          status: 'draft',
          subtotal: orderSubtotal,
          discount: orderTotalDiscount,
          total: Math.max(0, orderSubtotal - orderTotalDiscount),
          valid_until: validUntilDate.toISOString().split('T')[0],
          notes: budget.notes
        })
        .select('id')
        .single()

      if (quoteErr || !createdQuote) {
        budget.items.forEach((item) => {
          summary.errors.push({
            rowNumber: item.rowNum,
            recordIdentifier: budget.quoteNumber,
            field: 'orcamento',
            receivedValue: budget.quoteNumber,
            reason: `Falha ao gravar orçamento: ${quoteErr?.message || 'Erro'}`
          })
          summary.errorCount++
          summary.rejectedRowsData.push({ ...item.originalRow, __erro_motivo: 'Erro na criação do orçamento' })
        })
        continue
      }

      const itemsToInsert = validItemsPayload.map((it) => ({
        ...it,
        quote_id: createdQuote.id
      }))

      const { error: itemsErr } = await supabase.from('quote_items').insert(itemsToInsert)
      if (itemsErr) {
        await supabase.from('quotes').delete().eq('id', createdQuote.id)
        budget.items.forEach((item) => {
          summary.errors.push({
            rowNumber: item.rowNum,
            recordIdentifier: budget.quoteNumber,
            field: 'itens_orcamento',
            receivedValue: budget.quoteNumber,
            reason: `Falha ao gravar itens: ${itemsErr.message}`
          })
          summary.errorCount++
          summary.rejectedRowsData.push({ ...item.originalRow, __erro_motivo: 'Erro ao gravar itens' })
        })
      } else {
        summary.successCount += itemsToInsert.length
      }
    }

    if (onProgress) onProgress(100)
    return summary
  }
}
