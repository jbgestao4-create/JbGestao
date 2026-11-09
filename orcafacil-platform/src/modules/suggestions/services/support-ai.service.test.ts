import { describe, it, expect } from 'vitest'
import { supportAiService } from './support-ai.service'

describe('supportAiService', () => {
  it('gera diagnóstico técnico e resposta empática sem código para relato de erro', () => {
    const prompt = 'Ao tentar concluir uma venda no PDV ocorreu erro 500 e a tela travou.'
    const result = supportAiService.generateFallbackDiagnostic(prompt)

    expect(result.requer_analise_dev).toBe(true)
    expect(result.resposta_cliente).toBeTruthy()
    // Proibição de código para o cliente
    expect(result.resposta_cliente).not.toContain('<script>')
    expect(result.resposta_cliente).not.toContain('function')
    expect(result.resposta_cliente).not.toContain('SELECT ')

    // Diretrizes da análise do desenvolvedor
    expect(result.analise_desenvolvedor).toBeDefined()
    expect(result.analise_desenvolvedor?.resumo_problema).toBeTruthy()
    expect(result.analise_desenvolvedor?.causa_provavel).toBeTruthy()
    expect(result.analise_desenvolvedor?.componentes_afetados.length).toBeGreaterThan(0)
    expect(result.analise_desenvolvedor?.passos_reproducao.length).toBeGreaterThan(0)
    expect(result.analise_desenvolvedor?.sugestao_tecnica_ponto_a_ponto.length).toBeGreaterThan(0)
  })

  it('classifica dúvida operacional sem exigir análise de desenvolvimento', () => {
    const prompt = 'Como faço para alterar a cor do tema nas configurações?'
    const result = supportAiService.generateFallbackDiagnostic(prompt)

    expect(result.requer_analise_dev).toBe(false)
    expect(result.resposta_cliente).toBeTruthy()
    expect(result.analise_desenvolvedor).toBeUndefined()
  })
})
