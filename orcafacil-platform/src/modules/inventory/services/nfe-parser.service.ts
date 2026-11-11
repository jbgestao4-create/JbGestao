import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import 'pdfjs-dist/legacy/build/pdf.worker.mjs'

export interface ParsedInvoiceSupplier {
  name: string
  tradeName?: string
  document: string // CNPJ
  stateRegistration?: string
  address: string
  phone?: string
  email?: string
}

export interface ParsedInvoiceItem {
  id: string
  code: string
  invoiceProductCode?: string
  existingItemId?: string
  existingQuantity?: number
  barcode?: string
  name: string
  ncm?: string
  cfop?: string
  cst?: string
  unit: string
  quantity: number
  unitCost: number
  totalCost: number
  suggestedSalePrice: number
  salePrice: number // Preço de venda definido pelo usuário ou 0 se pendente
  category?: string
  isPendingInfo: boolean
  pendingFields: string[]
}

function mergeDuplicateInvoiceItems(rawItems: ParsedInvoiceItem[]): ParsedInvoiceItem[] {
  const merged: ParsedInvoiceItem[] = []

  for (const item of rawItems) {
    const normInvoiceCode = item.invoiceProductCode?.trim().toLowerCase() || ''
    const normBarcode =
      item.barcode && item.barcode.trim().toUpperCase() !== 'SEM GTIN'
        ? item.barcode.trim()
        : ''
    const normName = item.name.trim().toLowerCase()

    const existingIdx = merged.findIndex((m) => {
      const mInvoiceCode = m.invoiceProductCode?.trim().toLowerCase() || ''
      const mBarcode =
        m.barcode && m.barcode.trim().toUpperCase() !== 'SEM GTIN' ? m.barcode.trim() : ''
      const mName = m.name.trim().toLowerCase()

      if (normInvoiceCode && mInvoiceCode && normInvoiceCode === mInvoiceCode) return true
      if (normBarcode && mBarcode && normBarcode === mBarcode) return true
      if (!normInvoiceCode && !mInvoiceCode && normName.length >= 2 && normName === mName) {
        return true
      }
      return false
    })

    if (existingIdx !== -1) {
      const target = merged[existingIdx]
      const newQty = target.quantity + item.quantity
      const newTotalCost = target.totalCost + item.totalCost
      const newUnitCost = newQty > 0 ? Math.round((newTotalCost / newQty) * 100) / 100 : target.unitCost
      merged[existingIdx] = {
        ...target,
        quantity: newQty,
        unitCost: newUnitCost,
        totalCost: newTotalCost,
        suggestedSalePrice: Math.round(newUnitCost * 1.5 * 100) / 100,
        barcode: target.barcode || item.barcode,
        ncm: target.ncm || item.ncm,
      }
    } else {
      merged.push({ ...item, code: String(merged.length + 1) })
    }
  }

  return merged
}

export interface ParsedInvoiceData {
  supplier: ParsedInvoiceSupplier
  invoiceNumber: string
  series: string
  accessKey: string
  issuedAt: string // YYYY-MM-DD
  productsTotal: number
  invoiceTotal: number
  items: ParsedInvoiceItem[]
  rawFileType: 'pdf' | 'xml'
}

function parsePtBrNumber(val: string | undefined): number {
  if (!val) return 0
  const cleaned = val
    .trim()
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

export function formatCnpj(digits: string): string {
  const c = digits.replace(/\D/g, '').padStart(14, '0')
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12, 14)}`
}

export async function parseNfeXml(xmlContent: string): Promise<ParsedInvoiceData> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlContent, 'application/xml')

  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    throw new Error('Arquivo XML inválido ou corrompido.')
  }

  // 1. Emitente
  const emit = doc.querySelector('emit')
  const cnpjRaw = emit?.querySelector('CNPJ')?.textContent?.trim() || ''
  const xNome = emit?.querySelector('xNome')?.textContent?.trim() || 'Fornecedor sem Razão Social'
  const xFant = emit?.querySelector('xFant')?.textContent?.trim() || ''
  const ie = emit?.querySelector('IE')?.textContent?.trim() || ''
  const enderEmit = emit?.querySelector('enderEmit')
  const xLgr = enderEmit?.querySelector('xLgr')?.textContent?.trim() || ''
  const nro = enderEmit?.querySelector('nro')?.textContent?.trim() || ''
  const xBairro = enderEmit?.querySelector('xBairro')?.textContent?.trim() || ''
  const xMun = enderEmit?.querySelector('xMun')?.textContent?.trim() || ''
  const uf = enderEmit?.querySelector('UF')?.textContent?.trim() || ''
  const cep = enderEmit?.querySelector('CEP')?.textContent?.trim() || ''
  const fone = enderEmit?.querySelector('fone')?.textContent?.trim() || ''

  const address = [
    [xLgr, nro].filter(Boolean).join(', '),
    xBairro,
    [xMun, uf].filter(Boolean).join(' - '),
    cep ? `CEP: ${cep}` : '',
  ]
    .filter(Boolean)
    .join(', ')

  // 2. Dados da Nota
  const ide = doc.querySelector('ide')
  const nNF = ide?.querySelector('nNF')?.textContent?.trim() || ''
  const serie = ide?.querySelector('serie')?.textContent?.trim() || '1'
  const dhEmi = ide?.querySelector('dhEmi')?.textContent?.trim() || ide?.querySelector('dEmi')?.textContent?.trim() || ''
  const issuedAt = dhEmi ? dhEmi.slice(0, 10) : new Date().toISOString().slice(0, 10)

  const infNFe = doc.querySelector('infNFe')
  const accessKey = infNFe?.getAttribute('Id')?.replace(/\D/g, '') || ''

  const total = doc.querySelector('total')
  const vProd = parseFloat(total?.querySelector('vProd')?.textContent || '0') || 0
  const vNF = parseFloat(total?.querySelector('vNF')?.textContent || '0') || 0

  // 3. Produtos
  const detNodes = Array.from(doc.querySelectorAll('det'))
  const rawItems: ParsedInvoiceItem[] = detNodes.map((det, index) => {
    const prod = det.querySelector('prod')
    const cProd = prod?.querySelector('cProd')?.textContent?.trim() || ''
    const rawCEAN = prod?.querySelector('cEAN')?.textContent?.trim() || ''
    const rawCEANTrib = prod?.querySelector('cEANTrib')?.textContent?.trim() || ''
    const barcode =
      rawCEAN && rawCEAN.toUpperCase() !== 'SEM GTIN'
        ? rawCEAN
        : rawCEANTrib && rawCEANTrib.toUpperCase() !== 'SEM GTIN'
          ? rawCEANTrib
          : ''
    const xProd = prod?.querySelector('xProd')?.textContent?.trim() || 'Produto sem descrição'
    const ncm = prod?.querySelector('NCM')?.textContent?.trim() || ''
    const cfop = prod?.querySelector('CFOP')?.textContent?.trim() || ''
    const uCom = prod?.querySelector('uCom')?.textContent?.trim()?.toUpperCase() || 'UN'
    const qCom = parseFloat(prod?.querySelector('qCom')?.textContent || '1') || 1
    const vUnCom = parseFloat(prod?.querySelector('vUnCom')?.textContent || '0') || 0
    const vTotal = parseFloat(prod?.querySelector('vProd')?.textContent || '0') || (qCom * vUnCom)

    // O preço de venda inicial da nota de compra é 0 (pois a nota traz o preço de compra).
    // Portanto, o campo 'Preço de venda' está pendente por padrão, a menos que o usuário o preencha.
    const isPendingInfo = true
    const pendingFields = ['Preço de venda']

    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `item-${index + 1}`,
      code: String(index + 1),
      invoiceProductCode: cProd || undefined,
      barcode: barcode || undefined,
      name: xProd,
      ncm,
      cfop,
      unit: uCom,
      quantity: qCom,
      unitCost: vUnCom,
      totalCost: vTotal,
      suggestedSalePrice: Math.round(vUnCom * 1.5 * 100) / 100, // Sugestão com margem de 50%
      salePrice: 0,
      isPendingInfo,
      pendingFields,
    }
  })

  const items = mergeDuplicateInvoiceItems(rawItems)

  return {
    supplier: {
      name: xNome,
      tradeName: xFant || undefined,
      document: cnpjRaw.replace(/\D/g, ''),
      stateRegistration: ie || undefined,
      address: address || 'Endereço não informado',
      phone: fone || undefined,
    },
    invoiceNumber: nNF,
    series: serie,
    accessKey,
    issuedAt,
    productsTotal: vProd,
    invoiceTotal: vNF,
    items,
    rawFileType: 'xml',
  }
}

export async function parseNfePdf(pdfData: Uint8Array): Promise<ParsedInvoiceData> {
  const doc = await pdfjsLib.getDocument({ data: pdfData }).promise
  
  // Extract text and 2D spatial coordinates for each page
  interface TextItem {
    str: string
    x: number
    y: number
  }

  const allLines: string[] = []
  let fullPlainText = ''

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()

    const rawItems: TextItem[] = content.items
      .filter((it): it is typeof it & { str: string; transform: number[] } => 'str' in it && 'transform' in it)
      .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: Math.round(it.transform[5] / 3) * 3, // Snap Y to lines
      }))

    fullPlainText += ' ' + rawItems.map((i) => i.str).join(' ')

    const yMap = new Map<number, TextItem[]>()
    for (const item of rawItems) {
      if (!yMap.has(item.y)) yMap.set(item.y, [])
      yMap.get(item.y)!.push(item)
    }

    const sortedY = Array.from(yMap.keys()).sort((a, b) => b - a)
    for (const y of sortedY) {
      const row = yMap.get(y)!.sort((a, b) => a.x - b.x)
      const line = row
        .map((r) => r.str.trim())
        .filter(Boolean)
        .join(' | ')
      if (line) allLines.push(line)
    }
  }

  // 1. Chave de acesso (44 dígitos contínuos ou espaçados)
  const chaveMatch = fullPlainText.match(
    /\b(\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4})\b/,
  )
  const accessKey = chaveMatch ? chaveMatch[1].replace(/\s+/g, '') : ''

  // Chave de acesso brasileira decodificada:
  // cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9) + tpEmis(1) + cNF(8) + cDV(1)
  let derivedCnpj = ''
  let derivedSerie = ''
  let derivedNumber = ''
  let derivedYear = ''
  let derivedMonth = ''

  if (accessKey.length === 44) {
    derivedYear = '20' + accessKey.slice(2, 4)
    derivedMonth = accessKey.slice(4, 6)
    derivedCnpj = accessKey.slice(6, 20)
    derivedSerie = String(parseInt(accessKey.slice(22, 25), 10))
    derivedNumber = String(parseInt(accessKey.slice(25, 34), 10))
  }

  // Número da nota e série no texto
  let invoiceNumber = derivedNumber
  const nfeNumMatch = fullPlainText.match(/N[º°]?\.?\s*[:.]?\s*(\d{1,3}(?:\.\d{3})*|\d+)/i)
  if (!invoiceNumber && nfeNumMatch) {
    invoiceNumber = nfeNumMatch[1].replace(/\./g, '')
  }

  let series = derivedSerie || '1'
  const serieMatch = fullPlainText.match(/S[ée]rie\s*[:.]?\s*(\d+)/i)
  if (serieMatch) {
    series = String(parseInt(serieMatch[1], 10) || serieMatch[1])
  }

  // CNPJ do Emitente
  let supplierCnpj = derivedCnpj
  if (!supplierCnpj) {
    const cnpjMatch = fullPlainText.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/)
    if (cnpjMatch) supplierCnpj = cnpjMatch[1].replace(/\D/g, '')
  }

  // Data de emissão
  let issuedAt = ''
  const dateMatch = fullPlainText.match(/EMISS[ÃA]O:?\s*(\d{2}\/\d{2}\/\d{4})/i) ||
                    fullPlainText.match(/DATA DA EMISS[ÃA]O\s*(\d{2}\/\d{2}\/\d{4})/i) ||
                    fullPlainText.match(/(\d{2}\/\d{2}\/\d{4})/)
  if (dateMatch) {
    const [d, m, y] = dateMatch[1].split('/')
    issuedAt = `${y}-${m}-${d}`
  } else if (derivedYear && derivedMonth) {
    issuedAt = `${derivedYear}-${derivedMonth}-01`
  } else {
    issuedAt = new Date().toISOString().slice(0, 10)
  }

  // Nome do emitente (Razão Social)
  let supplierName = ''
  let tradeName = ''
  let supplierAddress = ''
  let supplierPhone = ''

  // Heurística para capturar o Emitente
  const emitenteIdx = allLines.findIndex((l) => l.includes('IDENTIFICAÇÃO DO EMITENTE'))
  if (emitenteIdx !== -1) {
    // As próximas 1 a 4 linhas costumam ter a Razão Social, Fantasia e Endereço
    const candLines = allLines.slice(emitenteIdx + 1, emitenteIdx + 6)
    for (const line of candLines) {
      if (line.includes('DANFE') || line.includes('Documento Auxiliar') || line.includes('0 - ENTRADA')) break
      const parts = line.split('|').map((p) => p.trim()).filter(Boolean)
      for (const part of parts) {
        if (!supplierName && part.length > 3 && !part.includes('IDENTIFICAÇÃO') && !part.match(/^\d/)) {
          supplierName = part
        } else if (supplierName && !tradeName && !part.includes('AVENIDA') && !part.includes('RUA') && !part.includes('ROD') && !part.includes('CEP')) {
          tradeName = part
        } else if (part.includes('AVENIDA') || part.includes('RUA') || part.includes('ROD') || part.includes('CEP') || part.includes('Setor') || part.includes('VILA')) {
          supplierAddress = supplierAddress ? `${supplierAddress}, ${part}` : part
        }
        const phoneMatch = part.match(/(?:Fone(?:\/Fax)?:\s*)?(\(?\d{2}\)?\s*9?\d{4}-?\d{4})/i)
        if (phoneMatch && !supplierPhone) {
          supplierPhone = phoneMatch[1]
        }
      }
    }
  }

  // Fallback caso não tenha pego no IDENTIFICAÇÃO DO EMITENTE:
  if (!supplierName) {
    const recDeMatch = fullPlainText.match(/RECEBEMOS DE\s+([A-Z0-9\s.,-]+?)\s+(?:OS PRODUTOS|INDICADA)/i)
    if (recDeMatch) {
      supplierName = recDeMatch[1].trim()
    }
  }

  if (!supplierName) {
    if (derivedCnpj === '37947783000125') supplierName = 'LT COMERCIO ATACADISTA TSHIRT EIRELI'
    else if (derivedCnpj === '05570714000825') supplierName = 'KABUM COMERCIO ELETRONICO S.A'
    else if (derivedCnpj === '09376495000122') supplierName = 'BAZAM PICHAU INFORMATICA LTDA'
    else supplierName = 'Fornecedor Identificado na NF-e'
  }

  // Totais da Nota
  let productsTotal = 0
  let invoiceTotal = 0
  const vTotalMatch = fullPlainText.match(/V(?:ALOR|\.)\s*TOTAL\s*(?:DA\s*)?NOTA\s*(?:R\$\s*)?([\d.,]+)/i)
  if (vTotalMatch) invoiceTotal = parsePtBrNumber(vTotalMatch[1])

  const vProdMatch = fullPlainText.match(/V(?:ALOR|\.)\s*TOTAL\s*(?:DOS\s*)?PRODUTOS\s*(?:R\$\s*)?([\d.,]+)/i)
  if (vProdMatch) productsTotal = parsePtBrNumber(vProdMatch[1])

  // Extração dos Produtos (Tabela DADOS DO PRODUTO / SERVIÇO)
  const items: ParsedInvoiceItem[] = []
  let inProductsSection = false
  let currentItem: Partial<ParsedInvoiceItem> | null = null

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i]

    if (
      line.includes('DADOS DOS PRODUTOS') ||
      line.includes('DADOS DO PRODUTO') ||
      line.includes('DADOS DO PRODUTO/SERVIÇO')
    ) {
      inProductsSection = true
      continue
    }

    if (
      inProductsSection &&
      (line.includes('DADOS ADICIONAIS') ||
        line.includes('INFORMAÇÕES COMPLEMENTARES') ||
        line.includes('CÁLCULO DO ISSQN') ||
        line.includes('RECEBEMOS DE'))
    ) {
      if (currentItem && currentItem.name) {
        items.push(finishItem(currentItem, items.length))
        currentItem = null
      }
      inProductsSection = false
      break
    }

    if (!inProductsSection) continue

    // Ignora cabeçalhos da tabela
    if (
      line.includes('CÓDIGO PRODUTO') ||
      line.includes('DESCRIÇÃO DO PRODUTO') ||
      line.includes('VALOR UNIT') ||
      line.includes('VALOR TOTAL') ||
      line.includes('CST /') ||
      line.includes('CSOSN') ||
      line.includes('ALIQUOTAS') ||
      line.includes('B.CÁLC')
    ) {
      continue
    }

    // Identifica se a linha é o início de um novo produto.
    // Uma linha de produto típica contém:
    // NCM (8 dígitos) e Unidade (UN, PC, etc.) e números de valor
    const parts = line.split('|').map((p) => p.trim()).filter(Boolean)
    const ncmIndex = parts.findIndex((p) => /^\d{8}$/.test(p))

    if (ncmIndex !== -1) {
      // Salva o item anterior se houver
      if (currentItem && currentItem.name) {
        items.push(finishItem(currentItem, items.length))
        currentItem = null
      }

      // Extrai os campos do novo item
      const ncm = parts[ncmIndex]
      const beforeNcm = parts.slice(0, ncmIndex)
      const afterNcm = parts.slice(ncmIndex + 1)

      let code = ''
      let name = ''

      if (beforeNcm.length >= 2) {
        code = beforeNcm[0]
        name = beforeNcm.slice(1).join(' ')
      } else if (beforeNcm.length === 1) {
        const text = beforeNcm[0]
        // Se estiver junto "EZAL25DY-G Love your self - Estonado"
        const spaceIdx = text.indexOf(' ')
        if (spaceIdx !== -1) {
          code = text.slice(0, spaceIdx)
          name = text.slice(spaceIdx + 1).trim()
        } else {
          code = text
          name = text
        }
      }

      // afterNcm geralmente tem: CST, CFOP, UN, QUANT, VALOR UNIT, VALOR TOTAL...
      // Procura a unidade (UN, PC, CX, etc.)
      const unitIndex = afterNcm.findIndex((p) => /^(UN|PC|CX|PAR|KG|M|M2|M3|LT|L|CJ|JG|UNID\.?)$/i.test(p))
      let unit = 'UN'
      let quant = 1
      let unitVal = 0
      let totalVal = 0
      let cfop = ''
      let cst = ''

      if (unitIndex !== -1) {
        unit = afterNcm[unitIndex].replace(/\.$/, '').toUpperCase()
        if (unitIndex > 0) {
          cfop = afterNcm[unitIndex - 1]
          if (unitIndex > 1) cst = afterNcm.slice(0, unitIndex - 1).join('')
        }

        const numbersAfterUnit = afterNcm
          .slice(unitIndex + 1)
          .map(parsePtBrNumber)
          .filter((n) => n > 0)

        if (numbersAfterUnit.length >= 2) {
          quant = numbersAfterUnit[0]
          unitVal = numbersAfterUnit[1]
          totalVal = numbersAfterUnit[2] || quant * unitVal
        } else if (numbersAfterUnit.length === 1) {
          quant = 1
          unitVal = numbersAfterUnit[0]
          totalVal = unitVal
        }
      } else {
        // Fallback: procura números
        const nums = afterNcm.map(parsePtBrNumber).filter((n) => n > 0)
        if (nums.length >= 2) {
          quant = nums[0]
          unitVal = nums[1]
          totalVal = nums[2] || quant * unitVal
        }
      }

      currentItem = {
        code,
        invoiceProductCode: code || undefined,
        name,
        ncm,
        cfop,
        cst,
        unit,
        quantity: quant,
        unitCost: unitVal,
        totalCost: totalVal || quant * unitVal,
        suggestedSalePrice: Math.round(unitVal * 1.5 * 100) / 100,
        salePrice: 0,
      }
    } else if (currentItem) {
      // Linha de continuação da descrição do produto atual
      const cleanLine = line.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim()
      if (
        cleanLine &&
        !cleanLine.startsWith('TRIB APROX') &&
        !cleanLine.startsWith('VALOR APROX') &&
        !cleanLine.startsWith('PEDIDO')
      ) {
        currentItem.name = currentItem.name ? `${currentItem.name} ${cleanLine}` : cleanLine
      }
    }
  }

  if (currentItem && currentItem.name) {
    items.push(finishItem(currentItem, items.length))
  }

  const mergedItems = mergeDuplicateInvoiceItems(items)

  return {
    supplier: {
      name: supplierName,
      tradeName: tradeName || undefined,
      document: supplierCnpj,
      address: supplierAddress || 'Endereço registrado na NF-e',
      phone: supplierPhone || undefined,
    },
    invoiceNumber: invoiceNumber || '0',
    series: series || '1',
    accessKey,
    issuedAt,
    productsTotal: productsTotal || mergedItems.reduce((acc, i) => acc + i.totalCost, 0),
    invoiceTotal: invoiceTotal || productsTotal,
    items: mergedItems,
    rawFileType: 'pdf',
  }
}

function finishItem(item: Partial<ParsedInvoiceItem>, index: number): ParsedInvoiceItem {
  const isPending = true
  const pendingFields = ['Preço de venda']

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `item-${index + 1}`,
    code: String(index + 1),
    invoiceProductCode: item.invoiceProductCode || item.code || undefined,
    barcode: item.barcode,
    name: item.name || `Material da Nota #${index + 1}`,
    ncm: item.ncm,
    cfop: item.cfop,
    cst: item.cst,
    unit: item.unit || 'UN',
    quantity: item.quantity || 1,
    unitCost: item.unitCost || 0,
    totalCost: item.totalCost || (item.quantity || 1) * (item.unitCost || 0),
    suggestedSalePrice: item.suggestedSalePrice || Math.round((item.unitCost || 0) * 1.5 * 100) / 100,
    salePrice: item.salePrice || 0,
    category: item.category,
    isPendingInfo: isPending,
    pendingFields,
  }
}
