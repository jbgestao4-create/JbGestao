import { describe, expect, it } from 'vitest'
import {
  encodeSaleNotes,
  generateFiscalAccessKey,
  parseSaleNotes,
  type SaleMetadata,
} from './sales.service'

describe('sales.service', () => {
  it('deve gerar chave de acesso fiscal com 44 dígitos numéricos válidos', () => {
    const key = generateFiscalAccessKey('35', '65', '12345678000195')
    expect(key).toHaveLength(44)
    expect(/^\d{44}$/.test(key)).toBe(true)
    expect(key.startsWith('35')).toBe(true)
  })

  it('deve codificar e decodificar metadados de venda com integridade', () => {
    const metadata: SaleMetadata = {
      isSale: true,
      isPdv: true,
      paymentMethod: 'pix',
      customerName: 'Consumidor Teste',
      customerDocument: '123.456.789-00',
    }
    const userNotes = 'Entregar na portaria'

    const encoded = encodeSaleNotes(metadata, userNotes)
    const { metadata: parsedMeta, cleanNotes } = parseSaleNotes(encoded)

    expect(parsedMeta.isSale).toBe(true)
    expect(parsedMeta.isPdv).toBe(true)
    expect(parsedMeta.paymentMethod).toBe('pix')
    expect(parsedMeta.customerName).toBe('Consumidor Teste')
    expect(parsedMeta.customerDocument).toBe('123.456.789-00')
    expect(cleanNotes).toBe('Entregar na portaria')
  })

  it('deve lidar com notas legadas sem metadados especiais', () => {
    const raw = 'Observação antiga sem JSON'
    const { metadata, cleanNotes } = parseSaleNotes(raw)
    expect(metadata).toEqual({})
    expect(cleanNotes).toBe(raw)
  })
})

