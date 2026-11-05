import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import 'pdfjs-dist/legacy/build/pdf.worker.mjs'

export type BoletoCategory =
  | 'Água'
  | 'Luz'
  | 'Internet'
  | 'Fornecedor'
  | 'Aluguel'
  | 'Impostos'
  | 'Outros'

export interface ParsedBoletoData {
  barcode: string
  formattedBarcode: string
  amount: number
  formattedAmount: string // ex: "185,40"
  dueDate: string // YYYY-MM-DD
  beneficiaryName: string
  beneficiaryDocument?: string
  bankName?: string
  suggestedCategory: BoletoCategory
  suggestedDescription: string
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
}

const BANK_CODES: Record<string, string> = {
  '001': 'Banco do Brasil',
  '033': 'Banco Santander',
  '041': 'Banrisul',
  '070': 'BRB',
  '077': 'Banco Inter',
  '084': 'Uniprime',
  '085': 'AILOS',
  '104': 'Caixa Econômica Federal',
  '136': 'Unicred',
  '197': 'Stone Pagamentos',
  '208': 'BTG Pactual',
  '212': 'Banco Original',
  '237': 'Bradesco',
  '260': 'Nubank',
  '290': 'PagBank',
  '318': 'Banco BMG',
  '323': 'Mercado Pago',
  '336': 'Banco C6',
  '341': 'Itaú Unibanco',
  '380': 'PicPay',
  '389': 'Banco Mercantil',
  '403': 'Cora',
  '422': 'Banco Safra',
  '623': 'Banco Pan',
  '633': 'Banco Rendimento',
  '655': 'Banco Votorantim',
  '745': 'Citibank',
  '748': 'Sicredi',
  '756': 'Sicoob',
}

interface KnownConcessionaria {
  keywords: RegExp
  name: string
  category: BoletoCategory
  prefixLabel: string
}

const KNOWN_CONCESSIONARIAS: KnownConcessionaria[] = [
  // Energia Elétrica (Luz)
  { keywords: /\bcemig\b/i, name: 'Cemig', category: 'Luz', prefixLabel: 'Conta de Luz' },
  { keywords: /\benel\b|\beletropaulo\b/i, name: 'Enel Energia', category: 'Luz', prefixLabel: 'Conta de Luz' },
  { keywords: /\bcpfl\b/i, name: 'CPFL Energia', category: 'Luz', prefixLabel: 'Conta de Luz' },
  { keywords: /\bneoenergia\b|\bcoelba\b|\bcelpe\b|\bcosern\b|\belektro\b/i, name: 'Neoenergia', category: 'Luz', prefixLabel: 'Conta de Luz' },
  { keywords: /\blight\s+servi[cç]os\b|\blight\s+s\.?a\b/i, name: 'Light Energia', category: 'Luz', prefixLabel: 'Conta de Luz' },
  { keywords: /\bequatorial\b|\bcelpa\b|\bcemar\b|\bceal\b|\bcepisa\b/i, name: 'Equatorial Energia', category: 'Luz', prefixLabel: 'Conta de Luz' },
  { keywords: /\bcopel\b/i, name: 'Copel Energia', category: 'Luz', prefixLabel: 'Conta de Luz' },
  { keywords: /\bcelesc\b/i, name: 'Celesc', category: 'Luz', prefixLabel: 'Conta de Luz' },
  { keywords: /\benergisa\b/i, name: 'Energisa', category: 'Luz', prefixLabel: 'Conta de Luz' },
  { keywords: /\bedp\s+(s[aã]o\s+paulo|esp[ií]rito\s+santo|brasil)\b/i, name: 'EDP Energia', category: 'Luz', prefixLabel: 'Conta de Luz' },
  { keywords: /\brge\s+sul\b/i, name: 'RGE Energia', category: 'Luz', prefixLabel: 'Conta de Luz' },

  // Água e Saneamento
  { keywords: /\bcopasa\b/i, name: 'Copasa', category: 'Água', prefixLabel: 'Conta de Água' },
  { keywords: /\bsabesp\b/i, name: 'Sabesp', category: 'Água', prefixLabel: 'Conta de Água' },
  { keywords: /\bsanepar\b/i, name: 'Sanepar', category: 'Água', prefixLabel: 'Conta de Água' },
  { keywords: /\bcedae\b/i, name: 'Cedae', category: 'Água', prefixLabel: 'Conta de Água' },
  { keywords: /\b[aá]guas\s+do\s+rio\b/i, name: 'Águas do Rio', category: 'Água', prefixLabel: 'Conta de Água' },
  { keywords: /\bcorsan\b/i, name: 'Corsan', category: 'Água', prefixLabel: 'Conta de Água' },
  { keywords: /\bembasa\b/i, name: 'Embasa', category: 'Água', prefixLabel: 'Conta de Água' },
  { keywords: /\bcagece\b/i, name: 'Cagece', category: 'Água', prefixLabel: 'Conta de Água' },
  { keywords: /\bsaneago\b/i, name: 'Saneago', category: 'Água', prefixLabel: 'Conta de Água' },
  { keywords: /\bcaesb\b/i, name: 'Caesb', category: 'Água', prefixLabel: 'Conta de Água' },
  { keywords: /\bcompesa\b/i, name: 'Compesa', category: 'Água', prefixLabel: 'Conta de Água' },
  { keywords: /\bcasan\b/i, name: 'Casan', category: 'Água', prefixLabel: 'Conta de Água' },
  { keywords: /\bbrk\s+ambiental\b/i, name: 'BRK Ambiental', category: 'Água', prefixLabel: 'Conta de Água' },

  // Internet e Telecomunicações
  { keywords: /\bvivo\b|\btelef[oô]nica\s+brasil\b/i, name: 'Vivo / Telefônica', category: 'Internet', prefixLabel: 'Conta de Internet' },
  { keywords: /\bclaro\b|\bembratel\b|\bnet\s+servi[cç]os\b/i, name: 'Claro / Embratel', category: 'Internet', prefixLabel: 'Conta de Internet' },
  { keywords: /\btim\s+s\.?a\b|\btim\s+fibra\b|\btim\s+celular\b/i, name: 'TIM', category: 'Internet', prefixLabel: 'Conta de Internet' },
  { keywords: /\boi\s+s\.?a\b|\boi\s+fibra\b|\btelemar\b/i, name: 'Oi Fibra', category: 'Internet', prefixLabel: 'Conta de Internet' },
  { keywords: /\balgar\s+telecom\b/i, name: 'Algar Telecom', category: 'Internet', prefixLabel: 'Conta de Internet' },
  { keywords: /\bbrisanet\b/i, name: 'Brisanet', category: 'Internet', prefixLabel: 'Conta de Internet' },
  { keywords: /\bdesktop\s+sigmanet\b/i, name: 'Desktop Internet', category: 'Internet', prefixLabel: 'Conta de Internet' },
  { keywords: /\bvero\s+internet\b/i, name: 'Vero Internet', category: 'Internet', prefixLabel: 'Conta de Internet' },
  { keywords: /\bunifique\b/i, name: 'Unifique Telecom', category: 'Internet', prefixLabel: 'Conta de Internet' },
  { keywords: /\bstarlink\b/i, name: 'Starlink', category: 'Internet', prefixLabel: 'Conta de Internet' },
]

/**
 * Converte fator de vencimento FEBRABAN (4 dígitos) para data YYYY-MM-DD.
 * Regra oficial FEBRABAN:
 * - Base original: 07/10/1997 (fator 1000 = 03/07/2000 ... fator 9999 = 21/02/2025)
 * - Reinício do fator em 22/02/2025: fator 1000 passou a representar 22/02/2025 em diante.
 */
export function decodeFebrabanDueFactor(factorStr: string): string | null {
  const factor = parseInt(factorStr, 10)
  if (!Number.isFinite(factor) || factor < 1000 || factor > 9999) {
    return null
  }

  // Fatores entre 1000 e 8500 no ciclo atual representam datas a partir de 22/02/2025
  if (factor >= 1000 && factor <= 8500) {
    const base2025 = Date.UTC(2025, 1, 22) // 22/02/2025
    const targetMs = base2025 + (factor - 1000) * 86400000
    const d = new Date(targetMs)
    return d.toISOString().slice(0, 10)
  }

  // Fatores acima de 8500 pertencem ao final do ciclo anterior (2021..2025)
  const base1997 = Date.UTC(1997, 9, 7) // 07/10/1997
  const targetMs = base1997 + factor * 86400000
  const d = new Date(targetMs)
  return d.toISOString().slice(0, 10)
}

/**
 * Formata uma linha digitável de 47 ou 48 dígitos para leitura amigável
 */
export function formatLinhaDigitavel(digits: string): string {
  const clean = digits.replace(/\D/g, '')
  if (clean.length === 47) {
    return `${clean.slice(0, 5)}.${clean.slice(5, 10)} ${clean.slice(10, 15)}.${clean.slice(15, 21)} ${clean.slice(21, 26)}.${clean.slice(26, 32)} ${clean.slice(32, 33)} ${clean.slice(33, 47)}`
  }
  if (clean.length === 48) {
    return `${clean.slice(0, 11)}-${clean.slice(11, 12)} ${clean.slice(12, 23)}-${clean.slice(23, 24)} ${clean.slice(24, 35)}-${clean.slice(35, 36)} ${clean.slice(36, 47)}-${clean.slice(47, 48)}`
  }
  return clean
}

function parsePtBrDateToIso(ddmmyyyy: string): string | null {
  const match = ddmmyyyy.trim().match(/^(\d{2})\/(\d{2})\/(20\d{2})$/)
  if (!match) return null
  const [, day, month, year] = match
  const d = parseInt(day, 10)
  const m = parseInt(month, 10)
  const y = parseInt(year, 10)
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null
  return `${year}-${month}-${day}`
}

function parsePtBrCurrency(raw: string): number {
  const clean = raw
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const val = parseFloat(clean)
  return Number.isFinite(val) && val > 0 ? Math.round(val * 100) / 100 : 0
}

/**
 * Extrai linha digitável de 47 dígitos (Boleto Bancário) ou 48 dígitos (Concessionárias/Arrecadação)
 * ou código de barras de 44 dígitos do texto do PDF.
 */
export function extractBarcodeFromText(text: string): {
  digits: string
  type: 'bank_47' | 'utility_48' | 'raw_44' | null
} {
  // 1. Tenta localizar padrão formatado de boleto bancário (47 dígitos)
  // Ex: 34191.79001 01043.510047 91020.150008 8 16200000025000
  const bankFormattedRegex =
    /\b(\d{5}[.\s]?\d{5}[\s.]+\d{5}[.\s]?\d{6}[\s.]+\d{5}[.\s]?\d{6}[\s.]+\d[\s.]+\d{10,14})\b/
  const bankMatch = text.match(bankFormattedRegex)
  if (bankMatch) {
    const clean = bankMatch[1].replace(/\D/g, '')
    if (clean.length === 47) {
      return { digits: clean, type: 'bank_47' }
    }
  }

  // 2. Tenta localizar padrão formatado de concessionária / arrecadação (48 dígitos começando com 8)
  // Ex: 83640000001-7 85400138009-2 10123456789-0 00123456789-4
  const utilityFormattedRegex =
    /\b(8\d{10}[-\s.]?\d[\s.]+\d{11}[-\s.]?\d[\s.]+\d{11}[-\s.]?\d[\s.]+\d{11}[-\s.]?\d)\b/
  const utilityMatch = text.match(utilityFormattedRegex)
  if (utilityMatch) {
    const clean = utilityMatch[1].replace(/\D/g, '')
    if (clean.length === 48) {
      return { digits: clean, type: 'utility_48' }
    }
  }

  // 3. Procura sequências numéricas contínuas ou separadas por espaços que somem 47 ou 48 dígitos
  const tokens = text.match(/\d[\d.\-\s]{42,68}\d/g) || []
  for (const token of tokens) {
    const onlyDigits = token.replace(/\D/g, '')
    if (onlyDigits.length === 47 && !onlyDigits.startsWith('8')) {
      return { digits: onlyDigits, type: 'bank_47' }
    }
    if (onlyDigits.length === 48 && onlyDigits.startsWith('8')) {
      return { digits: onlyDigits, type: 'utility_48' }
    }
    if (onlyDigits.length === 44) {
      return { digits: onlyDigits, type: 'raw_44' }
    }
  }

  return { digits: '', type: null }
}

/**
 * Decodifica informações de valor, vencimento, banco e categoria a partir da linha digitável
 */
function decodeBarcodeMetadata(
  digits: string,
  type: 'bank_47' | 'utility_48' | 'raw_44' | null,
): {
  amount: number
  dueDate: string | null
  bankName?: string
  segmentCategory?: BoletoCategory
} {
  if (!digits || !type) {
    return { amount: 0, dueDate: null }
  }

  if (type === 'bank_47') {
    const bankCode = digits.slice(0, 3)
    const bankName = BANK_CODES[bankCode]
    const factorStr = digits.slice(33, 37)
    const valueCentsStr = digits.slice(37, 47)
    const dueDate = decodeFebrabanDueFactor(factorStr)
    const cents = parseInt(valueCentsStr, 10)
    const amount = Number.isFinite(cents) && cents > 0 ? cents / 100 : 0

    return {
      amount,
      dueDate,
      bankName,
    }
  }

  if (type === 'utility_48') {
    // Remove os 4 dígitos verificadores de bloco (posições 11, 23, 35, 47) para obter as 44 posições
    const bar44 =
      digits.slice(0, 11) +
      digits.slice(12, 23) +
      digits.slice(24, 35) +
      digits.slice(36, 47)

    const segment = bar44[1]
    const valueId = bar44[2]
    let segmentCategory: BoletoCategory | undefined
    if (segment === '2') segmentCategory = 'Água'
    else if (segment === '3') segmentCategory = 'Luz'
    else if (segment === '4') segmentCategory = 'Internet'
    else if (segment === '1' || segment === '5') segmentCategory = 'Impostos'

    let amount = 0
    if (['6', '7', '8', '9'].includes(valueId)) {
      const cents = parseInt(bar44.slice(4, 15), 10)
      if (Number.isFinite(cents) && cents > 0) {
        amount = cents / 100
      }
    }

    // Muitas concessionárias gravam a data de vencimento AAAAMMDD nas posições 19..27 ou 23..31 do código de 44 posições
    let dueDate: string | null = null
    const freeField = bar44.slice(19, 44)
    const yyyymmddMatch = freeField.match(/(20[2-3]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/)
    if (yyyymmddMatch) {
      dueDate = `${yyyymmddMatch[1]}-${yyyymmddMatch[2]}-${yyyymmddMatch[3]}`
    }

    return {
      amount,
      dueDate,
      segmentCategory,
    }
  }

  if (type === 'raw_44') {
    if (digits.startsWith('8')) {
      const segment = digits[1]
      const valueId = digits[2]
      let segmentCategory: BoletoCategory | undefined
      if (segment === '2') segmentCategory = 'Água'
      else if (segment === '3') segmentCategory = 'Luz'
      else if (segment === '4') segmentCategory = 'Internet'
      else if (segment === '1' || segment === '5') segmentCategory = 'Impostos'

      let amount = 0
      if (['6', '7', '8', '9'].includes(valueId)) {
        const cents = parseInt(digits.slice(4, 15), 10)
        if (Number.isFinite(cents) && cents > 0) {
          amount = cents / 100
        }
      }
      return { amount, dueDate: null, segmentCategory }
    } else {
      const bankCode = digits.slice(0, 3)
      const bankName = BANK_CODES[bankCode]
      const factorStr = digits.slice(5, 9)
      const valueCentsStr = digits.slice(9, 19)
      const dueDate = decodeFebrabanDueFactor(factorStr)
      const cents = parseInt(valueCentsStr, 10)
      const amount = Number.isFinite(cents) && cents > 0 ? cents / 100 : 0
      return { amount, dueDate, bankName }
    }
  }

  return { amount: 0, dueDate: null }
}

/**
 * Analisa o texto extraído de um PDF de boleto bancário ou conta de consumo (água, luz, internet)
 * e retorna os campos estruturados para preenchimento automático do cadastro.
 */
export function parseBoletoText(rawText: string, fileName = ''): ParsedBoletoData {
  const normalizedText = rawText.replace(/\s+/g, ' ').trim()
  const warnings: string[] = []

  // 1. Extração e decodificação de Código de Barras / Linha Digitável
  const { digits: barcodeDigits, type: barcodeType } = extractBarcodeFromText(rawText)
  const barcodeMeta = decodeBarcodeMetadata(barcodeDigits, barcodeType)

  // 2. Extração de Data de Vencimento no texto (como confirmação ou fallback)
  let dueDate = barcodeMeta.dueDate || ''
  const duePatterns = [
    /(?:data\s+de\s+vencimento|vencimento|venc\.?|pagar\s+at[eé])\s*[:.-]?\s*(\d{2}\/\d{2}\/20\d{2})/i,
    /(\d{2}\/\d{2}\/20\d{2})\s*(?:vencimento|valor\s+a\s+pagar)/i,
  ]

  for (const pattern of duePatterns) {
    const m = normalizedText.match(pattern)
    if (m?.[1]) {
      const parsed = parsePtBrDateToIso(m[1])
      if (parsed) {
        dueDate = parsed
        break
      }
    }
  }

  // Fallback para qualquer data DD/MM/20XX caso ainda não tenha encontrado vencimento
  if (!dueDate) {
    const allDates = normalizedText.match(/\b(\d{2}\/\d{2}\/20\d{2})\b/g) || []
    const parsedDates = allDates
      .map(parsePtBrDateToIso)
      .filter((d): d is string => Boolean(d))
      .sort()
    // Em boletos, a data de vencimento costuma ser a maior data (posterior à data de emissão/processamento)
    if (parsedDates.length > 0) {
      dueDate = parsedDates[parsedDates.length - 1]
    }
  }

  if (!dueDate) {
    const today = new Date()
    dueDate = today.toISOString().slice(0, 10)
    warnings.push('Data de vencimento não identificada automaticamente; verifique o campo Vencimento.')
  }

  // 3. Extração de Valor no texto (prioriza texto explícito 'valor a pagar / total a pagar / valor do documento')
  let amount = barcodeMeta.amount
  const amountPatterns = [
    /(?:\(=\)\s*valor\s+do\s+documento|valor\s+cobrado|valor\s+a\s+pagar|total\s+a\s+pagar|valor\s+do\s+boleto|valor\s+total)\s*[:.-]?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i,
    /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i,
  ]
  for (const pattern of amountPatterns) {
    const m = normalizedText.match(pattern)
    if (m?.[1]) {
      const parsedVal = parsePtBrCurrency(m[1])
      if (parsedVal > 0) {
        amount = parsedVal
        break
      }
    }
  }

  if (amount <= 0) {
    warnings.push('Valor do boleto não identificado automaticamente; informe o valor manualmente.')
  }

  // 4. Identificação de Beneficiário / Concessionária e Categoria
  let beneficiaryName = ''
  let suggestedCategory: BoletoCategory = barcodeMeta.segmentCategory || 'Outros'
  let prefixLabel = 'Boleto'

  const cleanFileName = fileName.replace(/[._\-]/g, ' ')
  const combinedSearchText = `${normalizedText} ${cleanFileName}`
  for (const item of KNOWN_CONCESSIONARIAS) {
    if (item.keywords.test(combinedSearchText)) {
      beneficiaryName = item.name
      suggestedCategory = item.category
      prefixLabel = item.prefixLabel
      break
    }
  }

  // Caso não seja uma concessionária conhecida da lista, busca o campo Beneficiário / Cedente no PDF
  if (!beneficiaryName) {
    const benMatch =
      rawText.match(
        /(?:benefici[aá]rio|cedente|fornecedor|empresa|raz[aã]o\s+social)\s*[:.-]?\s*([A-ZÀ-Ú0-9][A-ZÀ-Úa-zà-ú0-9\s.&/-]{3,65}?)(?:\s+CNPJ|\s+CPF|\s+Ag[eê]ncia|\s+Nosso\s+N|\n|\r|$)/i,
      ) ||
      normalizedText.match(
        /(?:benefici[aá]rio|cedente)\s*[:.-]?\s*([A-ZÀ-Ú0-9][A-ZÀ-Úa-zà-ú0-9\s.&/-]{3,55}?)(?:\s+\d{2}\.\d{3}\.\d{3}|\s+Ag[eê]ncia|\s+Vencimento)/i,
      )

    if (benMatch?.[1]) {
      beneficiaryName = benMatch[1]
        .replace(/\b(cpf|cnpj|agencia|código|cedente|beneficiario)\b.*/i, '')
        .trim()
    }
  }

  // Inferência de categoria por palavras-chave se ainda estiver 'Outros'
  if (suggestedCategory === 'Outros') {
    if (/\b(energia\s+el[eé]trica|kwh|ilumina[cç][aã]o\s+p[uú]blica|conta\s+de\s+luz)\b/i.test(combinedSearchText)) {
      suggestedCategory = 'Luz'
      prefixLabel = 'Conta de Luz'
    } else if (/\b(saneamento|[aá]gua\s+e\s+esgoto|hidr[oô]metro|abastecimento\s+de\s+[aá]gua|conta\s+de\s+[aá]gua)\b/i.test(combinedSearchText)) {
      suggestedCategory = 'Água'
      prefixLabel = 'Conta de Água'
    } else if (/\b(telecomunica[cç][oõ]es|banda\s+larga|fibra\s+[oó]ptica|internet| mensalidade\s+internet)\b/i.test(combinedSearchText)) {
      suggestedCategory = 'Internet'
      prefixLabel = 'Conta de Internet'
    } else if (/\b(aluguel|loca[cç][aã]o\s+de\s+im[oó]vel|condom[ií]nio)\b/i.test(combinedSearchText)) {
      suggestedCategory = 'Aluguel'
      prefixLabel = 'Aluguel / Encargos'
    } else if (/\b(darf|simples\s+nacional|das\b|iptu|ipva|icms|issqn|tributo|imposto)\b/i.test(combinedSearchText)) {
      suggestedCategory = 'Impostos'
      prefixLabel = 'Guia de Imposto'
    } else if (barcodeType === 'bank_47') {
      suggestedCategory = 'Fornecedor'
      prefixLabel = 'Boleto Bancário'
    }
  }

  if (!beneficiaryName) {
    if (barcodeMeta.bankName) {
      beneficiaryName = barcodeMeta.bankName
    } else if (fileName) {
      beneficiaryName = fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim()
    } else {
      beneficiaryName = 'Beneficiário não identificado'
      warnings.push('Beneficiário não identificado automaticamente; confira o nome da empresa/concessionária.')
    }
  }

  // CNPJ do beneficiário no texto
  const cnpjMatch = normalizedText.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/)
  const beneficiaryDocument = cnpjMatch ? cnpjMatch[1] : undefined

  const formattedAmount =
    amount > 0
      ? amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '0,00'

  const suggestedDescription =
    beneficiaryName && beneficiaryName !== 'Beneficiário não identificado'
      ? `${prefixLabel} - ${beneficiaryName}`
      : prefixLabel

  const confidence: 'high' | 'medium' | 'low' =
    barcodeDigits && amount > 0 && warnings.length === 0
      ? 'high'
      : amount > 0 || barcodeDigits
        ? 'medium'
        : 'low'

  return {
    barcode: barcodeDigits,
    formattedBarcode: formatLinhaDigitavel(barcodeDigits),
    amount,
    formattedAmount,
    dueDate,
    beneficiaryName,
    beneficiaryDocument,
    bankName: barcodeMeta.bankName,
    suggestedCategory,
    suggestedDescription,
    confidence,
    warnings,
  }
}

/**
 * Lê um arquivo PDF de boleto bancário ou fatura de concessionária usando pdfjs-dist
 * e retorna os dados extraídos automaticamente.
 */
export async function parseBoletoPdf(
  pdfBytes: Uint8Array,
  fileName = '',
): Promise<ParsedBoletoData> {
  if (!pdfBytes || pdfBytes.byteLength < 10) {
    throw new Error('O arquivo PDF enviado está vazio ou inválido.')
  }

  try {
    const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise
    let fullText = ''

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()

      const pageItems = content.items
        .filter((it): it is typeof it & { str: string; transform: number[] } => 'str' in it && 'transform' in it)
        .map((it) => ({
          str: it.str,
          x: it.transform[4],
          y: Math.round(it.transform[5] / 3) * 3,
        }))

      const yMap = new Map<number, typeof pageItems>()
      for (const item of pageItems) {
        if (!yMap.has(item.y)) yMap.set(item.y, [])
        yMap.get(item.y)!.push(item)
      }

      const sortedY = Array.from(yMap.keys()).sort((a, b) => b - a)
      for (const y of sortedY) {
        const row = yMap.get(y)!.sort((a, b) => a.x - b.x)
        const line = row.map((r) => r.str.trim()).filter(Boolean).join(' ')
        if (line) {
          fullText += line + '\n'
        }
      }
    }

    if (!fullText.trim()) {
      // Se o PDF for apenas imagem escaneada sem camada de texto, tenta extrair do nome do arquivo e avisa claramente
      const fallback = parseBoletoText('', fileName)
      return {
        ...fallback,
        confidence: 'low',
        warnings: [
          'Este PDF parece ser uma imagem digitalizada sem camada de texto selecionável. Verifique e preencha os campos manualmente.',
        ],
      }
    }

    return parseBoletoText(fullText, fileName)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.toLowerCase().includes('password')) {
      throw new Error(
        'Este boleto em PDF está protegido por senha. Desbloqueie o arquivo ou preencha os dados manualmente.',
      )
    }
    throw new Error(
      'Não foi possível ler automaticamente o PDF do boleto. Verifique se o arquivo é um PDF válido ou preencha os campos manualmente.',
    )
  }
}

