import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult, UUID } from '@shared/types/common'
import type {
  FeedbackAiDiagnostic,
  SupportAiToolCallPayload,
} from '../types/suggestion.types'

const GEMINI_STORAGE_KEY = 'gemini_api_key'

export function getGeminiApiKey(): string {
  const envKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim()
  if (envKey) return envKey
  return (localStorage.getItem(GEMINI_STORAGE_KEY) || '').trim()
}

export function setGeminiApiKey(key: string): void {
  if (!key.trim()) {
    localStorage.removeItem(GEMINI_STORAGE_KEY)
  } else {
    localStorage.setItem(GEMINI_STORAGE_KEY, key.trim())
  }
}

const SYSTEM_INSTRUCTION = `Você é o assistente virtual de suporte ao cliente integrado ao sistema ControleSoft. Sua função é realizar o atendimento inicial do usuário com empatia, clareza e eficiência, além de gerar diagnósticos técnicos estruturados para a equipe de desenvolvimento quando necessário.

---

### 1. DIRETRIZES DE ATENDIMENTO AO CLIENTE (resposta_cliente)
- **Tom de Voz:** Cordial, profissional, empático e resolutivo.
- **Respostas Operacionais:** Explique o uso correto do sistema, guie o usuário passo a passo em fluxos comuns e tire dúvidas de usabilidade de forma simples.
- **Gestão de Problemas:** Quando o usuário relatar um erro ou comportamento inesperado, escute o relato com atenção, faça perguntas esclarecedoras se necessário para coletar contexto (ex.: em qual tela ocorreu, qual a mensagem de erro) e informe que o caso foi registrado e encaminhado para análise técnica.

---

### 2. RESTRIÇÕES RÍGIDAS DE SEGURANÇA E ESCOPO
- **PROIBIÇÃO DE CÓDIGO PARA O CLIENTE:** Você NÃO DEVE, sob nenhuma hipótese, gerar, alterar, sugerir ou colar trechos de código (HTML, JavaScript, SQL, CSS, etc.) na mensagem destinada ao cliente.
- **PROIBIÇÃO DE EXECUÇÃO:** Você não possui permissão para aplicar correções diretas no banco de dados ou no código-fonte da aplicação.
- **PROIBIÇÃO DE PROMESSAS FALSAS:** Nunca garanta ao cliente um prazo exato de correção nem diga "já corrigi o sistema". Diga apenas que o diagnóstico técnico foi encaminhado à equipe de desenvolvimento.

---

### 3. DIRETRIZES PARA ANÁLISE TÉCNICA (analise_desenvolvedor)
Sempre que você identificar que o relato do cliente se refere a um **bug, falha de sistema, erro 500/404, comportamento anômalo ou necessidade de melhoria/ajuste técnico**, você DEVE ativar a flag \`requer_analise_dev: true\` e preencher o objeto \`analise_desenvolvedor\` com as seguintes seções bem detalhadas:

1. **resumo_problema:** Descrição objetiva da falha reportada sob a ótica técnica.
2. **causa_provavel:** Análise diagnóstica da possível origem do problema (ex.: exceção não tratada, falha de validação no formulário, timeout de API, inconsistência no banco de dados).
3. **componentes_afetados:** Lista de telas, rotas/endpoints, rotinas ou módulos prováveis da aplicação (array de strings).
4. **passos_reproducao:** Passo a passo sequencial para o desenvolvedor simular o cenário reportado pelo cliente (array de strings).
5. **sugestao_tecnica_ponto_a_ponto:** Lista detalhada, item por item, do que os desenvolvedores devem investigar, testar e alterar. **Explique a lógica da solução sem escrever trechos de código executável.** (array de strings).

---

### 4. REGRAS DE SAÍDA
Você DEVE obrigatoriamente responder invocando a ferramenta \`registrar_analise_suporte\`. Nunca responda com texto puro fora dessa chamada de ferramenta.`

const TOOL_DECLARATION = {
  functionDeclarations: [
    {
      name: 'registrar_analise_suporte',
      description:
        'Registra a resposta inicial do cliente e o diagnóstico técnico estruturado para a equipe de desenvolvimento.',
      parameters: {
        type: 'OBJECT',
        properties: {
          resposta_cliente: {
            type: 'STRING',
            description:
              'Texto cordial, empático e resolutivo para o cliente. Não inclua código nem promessas falsas de prazo.',
          },
          requer_analise_dev: {
            type: 'BOOLEAN',
            description:
              'Verdadeiro se o relato se refere a bug, falha, erro 500/404, comportamento anômalo ou ajuste técnico.',
          },
          analise_desenvolvedor: {
            type: 'OBJECT',
            description:
              'Diagnóstico detalhado para a equipe de desenvolvimento quando requer_analise_dev for true.',
            properties: {
              resumo_problema: {
                type: 'STRING',
                description: 'Descrição objetiva da falha sob a ótica técnica.',
              },
              causa_provavel: {
                type: 'STRING',
                description: 'Análise diagnóstica da causa provável.',
              },
              componentes_afetados: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: 'Telas, rotas ou módulos afetados.',
              },
              passos_reproducao: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: 'Passo a passo sequencial para reprodução da falha.',
              },
              sugestao_tecnica_ponto_a_ponto: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description:
                  'Lista de itens recomendados para investigação e correção, sem código executável.',
              },
            },
            required: [
              'resumo_problema',
              'causa_provavel',
              'componentes_afetados',
              'passos_reproducao',
              'sugestao_tecnica_ponto_a_ponto',
            ],
          },
        },
        required: ['resposta_cliente', 'requer_analise_dev'],
      },
    },
  ],
}

interface ProcessTicketInput {
  organizationId: UUID
  suggestionId: UUID
  title: string
  description: string
  additionalInfo?: string | null
  moduleOrigin: string
  originRoute: string
  userName: string
}

interface ProcessMessageInput {
  organizationId: UUID
  suggestionId: UUID
  userMessage: string
  previousMessages?: Array<{ senderRole: 'owner' | 'user'; message: string }>
  title: string
  moduleOrigin: string
  originRoute: string
}

export const supportAiService = {
  /**
   * Consulta a lista de modelos ativos para a chave da API (ModelService.ListModels).
   */
  async listAvailableModels(
    apiKey: string,
  ): Promise<{ success: boolean; models: string[]; error?: string }> {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      )
      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as {
          error?: { message?: string }
        } | null
        const msg = errJson?.error?.message || (await res.text())
        return { success: false, models: [], error: msg }
      }
      const data = (await res.json()) as {
        models?: Array<{ name: string; supportedGenerationMethods?: string[] }>
      }
      const models = (data.models || [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace('models/', ''))

      return { success: true, models }
    } catch (err) {
      return { success: false, models: [], error: String(err) }
    }
  },

  /**
   * Executa a análise pelo Gemini utilizando Function Calling para registrar_analise_suporte.
   */
  async generateAiSupportResponse(
    promptContent: string,
  ): Promise<SupportAiToolCallPayload> {
    const apiKey = getGeminiApiKey()

    if (apiKey) {
      const modelListRes = await this.listAvailableModels(apiKey)
      let candidateModels: string[] = []

      if (modelListRes.success && modelListRes.models.length > 0) {
        const flashModels = modelListRes.models.filter((m) => m.includes('flash'))
        const otherModels = modelListRes.models.filter((m) => !m.includes('flash'))
        candidateModels = [...flashModels, ...otherModels]
      } else {
        candidateModels = [
          'gemini-flash-latest',
          'gemini-3.8-flash',
          'gemini-3.5-flash-lite',
          'gemini-2.5-flash',
          'gemini-2.0-flash',
          'gemini-1.5-flash',
        ]
      }

      for (const model of candidateModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
          const body = {
            contents: [
              {
                role: 'user',
                parts: [{ text: promptContent }],
              },
            ],
            systemInstruction: {
              parts: [{ text: SYSTEM_INSTRUCTION }],
            },
            tools: [TOOL_DECLARATION],
            toolConfig: {
              functionCallingConfig: {
                mode: 'ANY',
                allowedFunctionNames: ['registrar_analise_suporte'],
              },
            },
          }

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

          if (!response.ok) {
            const errText = await response.text()
            logger.warn(`Chamada Gemini API (${model}) retornou erro:`, { error: errText })
            continue
          }

          const data = await response.json()
          const candidate = data.candidates?.[0]
          const functionCall = candidate?.content?.parts?.find(
            (part: { functionCall?: { name: string; args: unknown } }) =>
              part.functionCall?.name === 'registrar_analise_suporte',
          )?.functionCall

          if (functionCall?.args) {
            return functionCall.args as SupportAiToolCallPayload
          }

          // Se por ventura retornar JSON puro no texto
          const textPart = candidate?.content?.parts?.find(
            (part: { text?: string }) => !!part.text,
          )?.text
          if (textPart) {
            const clean = textPart.replace(/```json/g, '').replace(/```/g, '').trim()
            try {
              const parsed = JSON.parse(clean)
              if (parsed.resposta_cliente) {
                return parsed as SupportAiToolCallPayload
              }
            } catch {
              // segue para fallback
            }
          }
        } catch (err) {
          logger.error(`Erro na integração direta com Gemini API (${model}):`, err)
        }
      }
    }

    // Heurística de fallback resiliente quando a chave do Gemini ainda não estiver preenchida ou falhar
    return this.generateFallbackDiagnostic(promptContent)
  },

  /**
   * Testa a conexão real com a API do Gemini e retorna o status detalhado.
   */
  async testConnection(customKey?: string): Promise<{
    success: boolean
    model?: string
    isFallback: boolean
    payload: SupportAiToolCallPayload
    error?: string
  }> {
    const key = (customKey || getGeminiApiKey()).trim()
    if (!key) {
      return {
        success: false,
        isFallback: true,
        payload: this.generateFallbackDiagnostic('Teste'),
        error: 'Nenhuma chave da API configurada.',
      }
    }

    const testPrompt =
      'Relato do usuário: "Ao tentar fechar o caixa na rota /cash-management deu erro 500 no terminal."'

    // Consulta os modelos suportados pela chave do usuário diretamente na API do Google
    const modelList = await this.listAvailableModels(key)
    if (!modelList.success) {
      return {
        success: false,
        isFallback: true,
        payload: this.generateFallbackDiagnostic(testPrompt),
        error: `Falha na validação da chave com o Google: ${modelList.error}`,
      }
    }

    if (modelList.models.length === 0) {
      return {
        success: false,
        isFallback: true,
        payload: this.generateFallbackDiagnostic(testPrompt),
        error:
          'A chave é válida, mas nenhum modelo ativo com suporte a generateContent foi retornado pelo Google para esta chave.',
      }
    }

    // Prioriza modelos flash (rápidos e leves)
    const sortedModels = [
      ...modelList.models.filter((m) => m.includes('flash')),
      ...modelList.models.filter((m) => !m.includes('flash')),
    ]

    let lastError = ''
    for (const model of sortedModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
        const body = {
          contents: [{ role: 'user', parts: [{ text: testPrompt }] }],
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          tools: [TOOL_DECLARATION],
          toolConfig: {
            functionCallingConfig: {
              mode: 'ANY',
              allowedFunctionNames: ['registrar_analise_suporte'],
            },
          },
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errText = await response.text()
          lastError = `[${model}] ${errText}`
          continue
        }

        const data = await response.json()
        const candidate = data.candidates?.[0]
        const functionCall = candidate?.content?.parts?.find(
          (part: { functionCall?: { name: string; args: unknown } }) =>
            part.functionCall?.name === 'registrar_analise_suporte',
        )?.functionCall

        if (functionCall?.args) {
          return {
            success: true,
            model,
            isFallback: false,
            payload: functionCall.args as SupportAiToolCallPayload,
          }
        }
      } catch (err) {
        lastError = String(err)
      }
    }

    return {
      success: false,
      isFallback: true,
      payload: this.generateFallbackDiagnostic(testPrompt),
      error: lastError || 'Erro ao comunicar com a API do Gemini.',
    }
  },

  /**
   * Gera um diagnóstico inicial estruturado caso a API do Gemini esteja temporariamente inacessível
   */
  generateFallbackDiagnostic(promptContent: string): SupportAiToolCallPayload {
    const lower = promptContent.toLowerCase()
    const isErrorOrBug =
      lower.includes('erro') ||
      lower.includes('falha') ||
      lower.includes('bug') ||
      lower.includes('500') ||
      lower.includes('404') ||
      lower.includes('não funciona') ||
      lower.includes('travou') ||
      lower.includes('tela preta') ||
      lower.includes('problema')

    if (isErrorOrBug) {
      return {
        resposta_cliente:
          'Olá! Lamentamos o inconveniente ocorrido. Recebemos seu relato detalhado e já registramos todas as informações técnicas do caso. Nossa equipe de desenvolvimento foi notificada e já está investigando a ocorrência para que o sistema funcione perfeitamente para você.',
        requer_analise_dev: true,
        analise_desenvolvedor: {
          resumo_problema:
            'Usuário relatou instabilidade ou comportamento inesperado no módulo da aplicação.',
          causa_provavel:
            'Possível exceção não tratada na requisição de dados, inconsistência de estado ou validação em formulário.',
          componentes_afetados: [
            'Interface do Módulo / Rota ativa',
            'Camada de Serviços / Requisições Supabase',
          ],
          passos_reproducao: [
            'Acessar a rota onde o incidente foi reportado',
            'Executar a ação informada pelo usuário',
            'Verificar o console de erros do navegador e a resposta de rede',
          ],
          sugestao_tecnica_ponto_a_ponto: [
            'Inspecionar logs do cliente e exceptions no console do navegador',
            'Verificar integridade dos parâmetros enviados para as funções do banco de dados',
            'Adicionar tratamento de fallback visual com mensagem amigável ao usuário',
          ],
        },
      }
    }

    return {
      resposta_cliente:
        'Olá! Agradecemos pelo seu contato. Seu relato foi recebido com sucesso pelo nosso suporte. Estamos à disposição para auxiliá-lo em todas as funcionalidades do sistema e já registramos seu apontamento.',
      requer_analise_dev: false,
    }
  },

  /**
   * Processa a abertura de uma nova solicitação/chamado, gerando a resposta e gravando o diagnóstico
   */
  async processTicket(input: ProcessTicketInput): Promise<ServiceResult<SupportAiToolCallPayload>> {
    try {
      const userContextPrompt = `NOVA SOLICITAÇÃO DE SUPORTE
Usuário: ${input.userName}
Módulo de Origem: ${input.moduleOrigin}
Rota da Aplicação: ${input.originRoute}
Título da Solicitação: ${input.title}
Descrição: ${input.description}
${input.additionalInfo ? `Informações Adicionais: ${input.additionalInfo}` : ''}`

      const aiResponse = await this.generateAiSupportResponse(userContextPrompt)

      // 1. Grava a resposta ao cliente na tabela de mensagens (tempo real para o usuário)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const fallbackSenderId = user?.id || '00000000-0000-0000-0000-000000000000'

      await supabase.from('feedback_messages').insert({
        organization_id: input.organizationId,
        suggestion_id: input.suggestionId,
        sender_id: fallbackSenderId,
        sender_name: 'Suporte ControleSoft',
        sender_role: 'owner',
        message: aiResponse.resposta_cliente,
        read_by_user: false,
        read_by_owner: true,
      })

      // 2. Se requerer análise dev, salva na tabela de diagnósticos técnicos da IA
      if (aiResponse.requer_analise_dev && aiResponse.analise_desenvolvedor) {
        const dev = aiResponse.analise_desenvolvedor

        await supabase.from('feedback_ai_diagnostics').insert({
          organization_id: input.organizationId,
          suggestion_id: input.suggestionId,
          requer_analise_dev: true,
          resumo_problema: dev.resumo_problema,
          causa_provavel: dev.causa_provavel,
          componentes_afetados: dev.componentes_afetados || [],
          passos_reproducao: dev.passos_reproducao || [],
          sugestao_tecnica_ponto_a_ponto: dev.sugestao_tecnica_ponto_a_ponto || [],
          raw_payload: aiResponse,
        })

        // Também atualiza o status para 'in_review'
        await supabase
          .from('feedback_suggestions')
          .update({ status: 'in_review', updated_at: new Date().toISOString() })
          .eq('organization_id', input.organizationId)
          .eq('id', input.suggestionId)
          .eq('status', 'received')

        // Registra observação interna para os desenvolvedores
        if (user) {
          await supabase.from('feedback_internal_notes').insert({
            organization_id: input.organizationId,
            suggestion_id: input.suggestionId,
            owner_id: user.id,
            content: `[Diagnóstico IA] Resumo: ${dev.resumo_problema}\nCausa Provável: ${dev.causa_provavel}`,
          })
        }
      }

      return { success: true, data: aiResponse }
    } catch (err) {
      logger.error('Erro ao processar ticket com IA:', err)
      return { success: false, error: 'Falha no processamento da IA de suporte.' }
    }
  },

  /**
   * Processa uma nova mensagem enviada pelo usuário no chat do chamado
   */
  async processUserMessage(
    input: ProcessMessageInput,
  ): Promise<ServiceResult<SupportAiToolCallPayload>> {
    try {
      const historyText = (input.previousMessages || [])
        .map((m) => `${m.senderRole === 'owner' ? 'Atendente' : 'Cliente'}: ${m.message}`)
        .join('\n')

      const prompt = `CONVERSA EM ANDAMENTO NO SUPORTE
Título do Chamado: ${input.title}
Módulo: ${input.moduleOrigin} (${input.originRoute})

Histórico recente:
${historyText}

Nova mensagem do cliente:
"${input.userMessage}"`

      const aiResponse = await this.generateAiSupportResponse(prompt)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      const fallbackSenderId = user?.id || '00000000-0000-0000-0000-000000000000'

      // Envia resposta do assistente no chat
      await supabase.from('feedback_messages').insert({
        organization_id: input.organizationId,
        suggestion_id: input.suggestionId,
        sender_id: fallbackSenderId,
        sender_name: 'Suporte ControleSoft',
        sender_role: 'owner',
        message: aiResponse.resposta_cliente,
        read_by_user: false,
        read_by_owner: true,
      })

      // Se identificado novo detalhe técnico relevante para os desenvolvedores
      if (aiResponse.requer_analise_dev && aiResponse.analise_desenvolvedor) {
        const dev = aiResponse.analise_desenvolvedor

        await supabase.from('feedback_ai_diagnostics').insert({
          organization_id: input.organizationId,
          suggestion_id: input.suggestionId,
          requer_analise_dev: true,
          resumo_problema: dev.resumo_problema,
          causa_provavel: dev.causa_provavel,
          componentes_afetados: dev.componentes_afetados || [],
          passos_reproducao: dev.passos_reproducao || [],
          sugestao_tecnica_ponto_a_ponto: dev.sugestao_tecnica_ponto_a_ponto || [],
          raw_payload: aiResponse,
        })
      }

      return { success: true, data: aiResponse }
    } catch (err) {
      logger.error('Erro ao responder mensagem do usuário com IA:', err)
      return { success: false, error: 'Falha ao gerar resposta automática.' }
    }
  },

  /**
   * Obtém os diagnósticos da IA para uma solicitação
   */
  async getAiDiagnostics(
    organizationId: UUID,
    suggestionId: UUID,
  ): Promise<ServiceResult<FeedbackAiDiagnostic[]>> {
    try {
      const { data, error } = await supabase
        .from('feedback_ai_diagnostics')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('suggestion_id', suggestionId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Erro ao buscar diagnósticos da IA', error)
        return { success: false, error: 'Não foi possível carregar diagnósticos.' }
      }

      return { success: true, data: (data ?? []) as FeedbackAiDiagnostic[] }
    } catch (err) {
      logger.error('Erro inesperado ao buscar diagnósticos da IA', err)
      return { success: false, error: 'Erro ao buscar diagnósticos.' }
    }
  },
}
