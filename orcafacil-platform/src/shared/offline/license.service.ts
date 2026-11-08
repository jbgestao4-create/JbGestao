import { supabase } from '@app/config/supabase'
import { dbLocal, type ProdutoLocal } from './db'
import { getDeviceFingerprint } from './fingerprint'
import { syncEngine } from './sync.engine'

export interface LicenseStatus {
  isLicensed: boolean
  token?: string
  fingerprint?: string
  activatedAt?: string
  totalProdutosLocais: number
}

export const licenseService = {
  /**
   * Obtém o status da licença e catálogo local armazenado no Dexie
   */
  async getLocalStatus(): Promise<LicenseStatus> {
    try {
      const configLicenca = await dbLocal.config_local.get('licenca_offline')
      const totalProdutos = await dbLocal.produtos.count()

      if (configLicenca && configLicenca.valor?.token) {
        return {
          isLicensed: true,
          token: configLicenca.valor.token,
          fingerprint: configLicenca.valor.fingerprint,
          activatedAt: configLicenca.valor.activatedAt,
          totalProdutosLocais: totalProdutos,
        }
      }

      return {
        isLicensed: false,
        totalProdutosLocais: totalProdutos,
      }
    } catch (err) {
      console.warn('[LicenseService] Erro ao consultar banco local:', err)
      return { isLicensed: false, totalProdutosLocais: 0 }
    }
  },

  /**
   * Realiza o processo de ativação da licença de uso único e o download
   * dos produtos e estoque para a base IndexedDB local.
   */
  async activateAndDownload(
    organizationId: string,
    onProgress?: (message: string) => void
  ): Promise<{ sucesso: boolean; mensagem: string; produtosBaixados: number }> {
    onProgress?.('Identificando assinatura de hardware deste dispositivo...')
    const fingerprint = await getDeviceFingerprint()

    onProgress?.('Validando licença offline com o servidor central...')
    const { data: resRpc, error: rpcError } = await supabase.rpc('ativar_licenca_offline', {
      p_device_fingerprint: fingerprint,
      p_nome_identificador: navigator.userAgent.slice(0, 80),
    })

    if (rpcError) {
      throw new Error(rpcError.message || 'Falha de comunicação com o servidor de licenças.')
    }

    if (!resRpc?.sucesso) {
      throw new Error(
        resRpc?.mensagem ||
          'Este usuário já possui uma licença ativa em outro dispositivo. Não é permitida mais de uma estação por usuário.'
      )
    }

    onProgress?.('Gravando licença e credenciais na estação local...')
    await dbLocal.config_local.put({
      chave: 'licenca_offline',
      valor: {
        token: resRpc.token_licenca,
        fingerprint,
        activatedAt: new Date().toISOString(),
        organizationId,
      },
    })

    onProgress?.('Baixando catálogo de produtos e estoque do servidor...')
    const { data: produtos, error: prodError } = await supabase
      .from('inventory_items')
      .select('id, barcode, name, description, unit_price, quantity_on_hand, category, updated_at, is_active, can_sell')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .eq('can_sell', true)

    if (prodError) {
      throw new Error(`Falha ao carregar estoque: ${prodError.message}`)
    }

    const listaProdutos: ProdutoLocal[] = (produtos || []).map((p: any) => ({
      id: p.id,
      codigo_barras: p.barcode || '',
      nome: p.name || p.description || 'Produto sem nome',
      preco_venda: Number(p.unit_price) || 0,
      estoque_atual: Number(p.quantity_on_hand) || 0,
      categoria: p.category || 'Geral',
      data_atualizacao: p.updated_at || new Date().toISOString(),
    }))

    onProgress?.(`Gravando ${listaProdutos.length} produtos no banco local...`)
    await dbLocal.transaction('rw', dbLocal.produtos, async () => {
      await dbLocal.produtos.clear()
      if (listaProdutos.length > 0) {
        await dbLocal.produtos.bulkPut(listaProdutos)
      }
    })

    return {
      sucesso: true,
      mensagem: resRpc.mensagem || 'Modo offline ativado com sucesso!',
      produtosBaixados: listaProdutos.length,
    }
  },

  /**
   * Desvincula a estação atual para permitir a troca de computador:
   * 1. Exige internet ativa.
   * 2. Sincroniza obrigatoriamente todas as vendas offline pendentes.
   * 3. Libera o registro no servidor central (Supabase RPC).
   * 4. Limpa todo o banco de dados IndexedDB e chaves locais deste computador.
   */
  async deactivateAndClearLocal(
    onProgress?: (message: string) => void
  ): Promise<{ sucesso: boolean; mensagem: string }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error(
        'Você precisa estar conectado à internet para sincronizar as vendas pendentes e liberar a licença no servidor.'
      )
    }

    // 1. Sincronização obrigatória de todas as pendências
    onProgress?.('Sincronizando vendas locais pendentes antes de desvincular...')
    await syncEngine.syncPendingSales()

    const pendentesAindaRestantes = await dbLocal.vendas_offline
      .where('status_sincronizacao')
      .equals('pendente')
      .count()

    if (pendentesAindaRestantes > 0) {
      throw new Error(
        `Ainda existem ${pendentesAindaRestantes} venda(s) local(is) que não puderam ser sincronizadas. Conecte-se a uma rede estável antes de desvincular para evitar perda de dados.`
      )
    }

    // 2. Libera a licença no servidor central
    onProgress?.('Liberando licença no servidor central para autorizar novo computador...')
    const fingerprint = await getDeviceFingerprint()
    const { data: resRpc, error: rpcError } = await supabase.rpc('desvincular_estacao_offline', {
      p_device_fingerprint: fingerprint,
    })

    if (rpcError) {
      throw new Error(`Falha ao desvincular no servidor: ${rpcError.message}`)
    }

    // 3. Limpeza total do IndexedDB local
    onProgress?.('Limpando dados e catálogo do banco local deste computador...')
    await dbLocal.transaction('rw', [dbLocal.produtos, dbLocal.vendas_offline, dbLocal.config_local], async () => {
      await dbLocal.produtos.clear()
      await dbLocal.vendas_offline.clear()
      await dbLocal.config_local.clear()
    })

    // 4. Limpeza de chaves de hardware do localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('jb_device_hardware_uid')
    }

    return {
      sucesso: true,
      mensagem:
        resRpc?.mensagem ||
        'Estação desvinculada com sucesso! Todos os dados locais foram sincronizados e limpos. Agora você pode ativar o modo offline em outro computador.',
    }
  },
}
