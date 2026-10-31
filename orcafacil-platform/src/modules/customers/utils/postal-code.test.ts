import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatPostalAddress, formatPostalCode, lookupPostalAddress } from './postal-code'

describe('formatPostalCode', () => {
  it('formata o CEP e limita a oito dígitos', () => {
    expect(formatPostalCode('30123456')).toBe('30123-456')
    expect(formatPostalCode('301234567')).toBe('30123-456')
  })
})

describe('lookupPostalAddress', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('busca e formata os dados do endereço', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          logradouro: 'Rua Exemplo',
          bairro: 'Centro',
          localidade: 'Belo Horizonte',
          uf: 'MG',
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const address = await lookupPostalAddress('30123-456')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://viacep.com.br/ws/30123456/json/',
      expect.objectContaining({ signal: undefined }),
    )
    expect(formatPostalAddress(address)).toBe('Rua Exemplo, Centro, Belo Horizonte - MG')
  })

  it('informa quando o CEP não é encontrado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ erro: true }), { status: 200 })),
    )

    await expect(lookupPostalAddress('00000000')).rejects.toThrow('CEP não encontrado')
  })

  it('rejeita CEP incompleto sem consultar o serviço', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(lookupPostalAddress('12345')).rejects.toThrow('CEP com 8 dígitos')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
