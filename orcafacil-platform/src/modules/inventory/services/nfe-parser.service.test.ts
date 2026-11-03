import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { parseNfePdf, parseNfeXml } from './nfe-parser.service'

const SAMPLE_1 = 'C:/Users/alexs/.gemini/antigravity/brain/0d8a1a2a-0ac9-49d7-b104-486a24f9e9be/.user_uploaded/media_1793674348261_4064ebdd.pdf'
const SAMPLE_2 = 'C:/Users/alexs/.gemini/antigravity/brain/0d8a1a2a-0ac9-49d7-b104-486a24f9e9be/.user_uploaded/media_1793674348284_9383395c.pdf'
const SAMPLE_3 = 'C:/Users/alexs/.gemini/antigravity/brain/0d8a1a2a-0ac9-49d7-b104-486a24f9e9be/.user_uploaded/media_1793674348289_433bc54c.pdf'

describe('nfe-parser.service', () => {
  it('should parse PDF 1 (T-Shirt) with all products and supplier info', async () => {
    if (!fs.existsSync(SAMPLE_1)) return
    const buffer = fs.readFileSync(SAMPLE_1)
    const result = await parseNfePdf(new Uint8Array(buffer))

    expect(result.supplier.document).toBe('37947783000125')
    expect(result.supplier.name).toContain('TSHIRT')
    expect(result.invoiceNumber).toBe('7494')
    expect(result.series).toBe('1')
    expect(result.accessKey).toBe('52210237947783000125550010000074941624442880')
    expect(result.items.length).toBe(13)
    expect(result.items[0].code).toBe('EZAL25DY-G')
    expect(result.items[0].name).toContain('Love your self')
    expect(result.items[0].quantity).toBe(4)
    expect(result.items[0].unitCost).toBe(7.5)
    expect(result.items[0].isPendingInfo).toBe(true)
    expect(result.items[0].pendingFields).toContain('Preço de venda')
  })

  it('should parse PDF 2 (Kabum) with product and supplier info', async () => {
    if (!fs.existsSync(SAMPLE_2)) return
    const buffer = fs.readFileSync(SAMPLE_2)
    const result = await parseNfePdf(new Uint8Array(buffer))

    expect(result.supplier.document).toBe('05570714000825')
    expect(result.supplier.name).toContain('KABUM')
    expect(result.invoiceNumber).toBe('16008825')
    expect(result.accessKey).toBe('32221105570714000825550010160088251371149302')
    expect(result.items.length).toBe(1)
    expect(result.items[0].code).toBe('114642')
    expect(result.items[0].name).toContain('WATER COOLER')
    expect(result.items[0].quantity).toBe(1)
    expect(result.items[0].unitCost).toBe(376.46)
    expect(result.items[0].isPendingInfo).toBe(true)
  })

  it('should parse PDF 3 (Pichau) with product and supplier info', async () => {
    if (!fs.existsSync(SAMPLE_3)) return
    const buffer = fs.readFileSync(SAMPLE_3)
    const result = await parseNfePdf(new Uint8Array(buffer))

    expect(result.supplier.document).toBe('09376495000122')
    expect(result.supplier.name).toContain('PICHAU')
    expect(result.invoiceNumber).toBe('1355794')
    expect(result.series).toBe('2')
    expect(result.accessKey).toBe('42231009376495000122550020013557941487920358')
    expect(result.items.length).toBe(1)
    expect(result.items[0].code).toBe('37157')
    expect(result.items[0].name).toContain('Cadeira Gamer')
    expect(result.items[0].quantity).toBe(1)
    expect(result.items[0].unitCost).toBe(637.9758)
    expect(result.items[0].isPendingInfo).toBe(true)
  })

  it('should parse NF-e XML successfully', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
      <NFe>
        <infNFe Id="NFe35210100000000000000550010000000011000000018">
          <ide>
            <nNF>12345</nNF>
            <serie>1</serie>
            <dhEmi>2023-10-15T10:00:00-03:00</dhEmi>
          </ide>
          <emit>
            <CNPJ>12345678000199</CNPJ>
            <xNome>Fornecedor Teste LTDA</xNome>
            <enderEmit>
              <xLgr>Rua Teste</xLgr>
              <nro>100</nro>
              <xBairro>Centro</xBairro>
              <xMun>São Paulo</xMun>
              <UF>SP</UF>
              <CEP>01001000</CEP>
            </enderEmit>
          </emit>
          <det nItem="1">
            <prod>
              <cProd>SKU-TEST</cProd>
              <xProd>Produto Teste XML</xProd>
              <NCM>12345678</NCM>
              <uCom>UN</uCom>
              <qCom>10.0000</qCom>
              <vUnCom>25.5000</vUnCom>
              <vProd>255.00</vProd>
            </prod>
          </det>
          <total>
            <ICMSTot>
              <vProd>255.00</vProd>
              <vNF>255.00</vNF>
            </ICMSTot>
          </total>
        </infNFe>
      </NFe>
    </nfeProc>`

    const result = await parseNfeXml(xml)
    expect(result.supplier.name).toBe('Fornecedor Teste LTDA')
    expect(result.supplier.document).toBe('12345678000199')
    expect(result.invoiceNumber).toBe('12345')
    expect(result.items.length).toBe(1)
    expect(result.items[0].code).toBe('SKU-TEST')
    expect(result.items[0].name).toBe('Produto Teste XML')
    expect(result.items[0].quantity).toBe(10)
    expect(result.items[0].unitCost).toBe(25.5)
  })
})
