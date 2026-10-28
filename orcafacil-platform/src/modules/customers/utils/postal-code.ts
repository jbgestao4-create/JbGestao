export interface PostalAddress {
  street: string
  neighborhood: string
  city: string
  state: string
}

export function formatPostalCode(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export function formatPostalAddress(address: PostalAddress) {
  return [
    address.street,
    address.neighborhood,
    [address.city, address.state].filter(Boolean).join(' - '),
  ]
    .filter(Boolean)
    .join(', ')
}

export async function lookupPostalAddress(
  postalCode: string,
  signal?: AbortSignal,
): Promise<PostalAddress> {
  const digits = postalCode.replace(/\D/g, '')
  if (digits.length !== 8) {
    throw new Error('Informe um CEP com 8 dígitos.')
  }

  let response: Response
  try {
    response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal })
  } catch {
    if (signal?.aborted) {
      throw new Error('Consulta de CEP cancelada.')
    }
    throw new Error('Não foi possível consultar o CEP. Verifique sua conexão e tente novamente.')
  }

  if (!response.ok) {
    throw new Error('Não foi possível consultar o CEP. Tente novamente.')
  }

  let result: unknown
  try {
    result = await response.json()
  } catch {
    throw new Error('O serviço de CEP retornou uma resposta inválida.')
  }
  if (!result || typeof result !== 'object') {
    throw new Error('O serviço de CEP retornou uma resposta inválida.')
  }

  const data = result as Record<string, unknown>
  if (data['erro'] === true) {
    throw new Error('CEP não encontrado. Confira os números ou preencha o endereço manualmente.')
  }

  const city = typeof data['localidade'] === 'string' ? data['localidade'] : ''
  const state = typeof data['uf'] === 'string' ? data['uf'] : ''
  const street = typeof data['logradouro'] === 'string' ? data['logradouro'] : ''
  const neighborhood = typeof data['bairro'] === 'string' ? data['bairro'] : ''

  if (!city || !state) {
    throw new Error(
      'O serviço de CEP não retornou cidade e estado. Preencha o endereço manualmente.',
    )
  }

  return { street, neighborhood, city, state }
}
