import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'
import type { ServiceResult } from '@shared/types/common'
import { SYSTEM_DEFAULT_ACCESS_PLANS } from '@modules/companies/services/access-plan.service'

export interface PlanTermConfig {
  planId: string
  planName: string
  version: string
  title: string
  summary: string
  content: string
  updatedAt: string
  updatedBy?: string | null
}

const STORAGE_KEY = 'jb_system_plan_terms_v2'
const SETTING_KEY = 'plan_terms'

export const DEFAULT_PLAN_TERMS: Record<string, PlanTermConfig> = {
  // 1. Básico
  '00000000-0000-4000-8000-000000000001': {
    planId: '00000000-0000-4000-8000-000000000001',
    planName: 'Básico',
    version: '2.0',
    title: 'Termos de Adesão e Licença de Software — Plano Básico',
    summary: 'Licenciamento mensal dos módulos essenciais: Vendas Rápidas, Estoque, Clientes, Caixa, Fornecedores e Membros.',
    content: `CONTRATO DE LICENÇA DE USO DE SOFTWARE (SaaS) — PLANO BÁSICO

1. OBJETO DA CONTRATAÇÃO
1.1. O presente instrumento tem por objeto a concessão de licença de uso temporária, não exclusiva e intransferível do software de gestão empresarial no PLANO BÁSICO, compreendendo os recursos essenciais: Vendas e Pedidos, Controle de Estoque com Movimentações e Importação de XML de Fornecedor, Cadastro de Clientes, Fluxo de Caixa Financeiro com Contas a Pagar, Cadastro de Fornecedores e Gestão de Membros da Organização.
1.2. O software é operado exclusivamente sob o modelo Software as a Service (SaaS), hospedado em infraestrutura de nuvem, incluindo rotinas de salvamento automático, segurança e suporte técnico.

2. ESCOPO E LIMITAÇÕES DO PLANO BÁSICO
2.1. O Assinante declara ter ciência de que o PLANO BÁSICO não contempla Frente de Caixa PDV Ágil de Balcão, Emissão Fiscal de Notas Fiscais Eletrônicas (NF-e modelo 55 e NFC-e modelo 65), Ordens de Serviço (O.S.) nem Relatórios Analíticos de Inteligência Comercial.
2.2. A migração para planos superiores (com PDV ou módulos completos) poderá ser solicitada a qualquer tempo pelo Assinante, mediante ajuste proporcional da mensalidade.

3. VALORES, FORMAS DE PAGAMENTO E PERÍODO DE TESTE
3.1. Pela utilização do PLANO BÁSICO, o Assinante pagará a mensalidade recorrente de R$ 99,90 (noventa e nove reais e noventa centavos).
3.2. Fica expressamente outorgado ao Assinante o benefício de 30 (trinta) dias de avaliação gratuita (Trial), contados a partir da data de criação da conta. Durante este período de 30 dias não haverá nenhuma cobrança ou emissão de boleto bancário.
3.3. A continuidade do acesso após o término do período de teste fica condicionada à quitação da primeira mensalidade regular, com vencimento programado todo dia 10 (dez) de cada mês, quitável via PIX ou Boleto Bancário.

4. SUSPENSÃO E RETIRADA AUTOMÁTICA DE ACESSO
4.1. O não pagamento da mensalidade no prazo de até 10 (dez) dias corridos após o vencimento implicará a suspensão temporária e preventiva de acesso ao sistema, ressalvado o direito de quitação com encargos moratórios legais (2% de multa e 1% de juros ao mês).
4.2. Regularizado o pagamento, a liberação do acesso é restabelecida automaticamente pelo sistema em até 24 horas úteis.

5. ISENÇÃO TRIBUTÁRIA E RESPONSABILIDADE CIVIL
5.1. A plataforma é uma ferramenta de gestão operacional e controle financeiro interno (obrigação de meio). A apuração de tributos devidos, escrituração contábil e conformidade legal perante o fisco são de inteira responsabilidade do Assinante e de sua assessoria contábil.

6. PROTEÇÃO DE DADOS (LGPD) E SEGURANÇA
6.1. Ambas as partes comprometem-se a cumprir os ditames da Lei Geral de Proteção de Dados (Lei nº 13.709/2018). O Assinante atua como Controlador dos dados inseridos e a fornecedora atua como Operadora da infraestrutura em nuvem, garantindo isolamento por chaves de segurança (Row Level Security).
6.2. Os dados cadastrais e financeiros do Assinante são mantidos sob sigilo absoluto.

7. VIGÊNCIA, RESCISÃO E FORO
7.1. O contrato vigora por prazo indeterminado e pode ser rescindido pelo Assinante a qualquer momento, sem multa rescisória ou período de carência.
7.2. As partes elegem o Foro da comarca da fornecedora para dirimir quaisquer controvérsias oriundas deste instrumento.`,
    updatedAt: new Date().toISOString(),
  },

  // 2. Básico + PDV sem NF-e
  '00000000-0000-4000-8000-000000000002': {
    planId: '00000000-0000-4000-8000-000000000002',
    planName: 'Básico + PDV sem NF-e',
    version: '2.0',
    title: 'Termos de Adesão e Licença de Software — Plano Básico + PDV sem NF-e',
    summary: 'Plano Básico com Ponto de Venda (PDV de Balcão), controle de sessões/turnos de operadores, sem emissão fiscal.',
    content: `CONTRATO DE LICENÇA DE USO DE SOFTWARE (SaaS) — PLANO BÁSICO + PDV SEM NF-E

1. OBJETO DA CONTRATAÇÃO
1.1. O presente instrumento tem por objeto a concessão de licença de uso temporária e intransferível do software de gestão empresarial no PLANO BÁSICO + PDV SEM NF-E, agregando todos os recursos de Vendas, Estoque, Clientes, Fornecedores e Caixa, juntamente com o módulo de Ponto de Venda (PDV Caixa Ágil para atendimento em balcão, fechamento de turnos e sangrias).
1.2. A operação dá-se sob modalidade SaaS em nuvem, com disponibilidade de recursos para múltiplos terminais de atendimento simultâneos.

2. ESPECIFICAÇÃO DO MÓDULO PDV E LIMITAÇÃO FISCAL
2.1. O Frente de Caixa PDV incluído neste plano opera para registro interno e gerencial de vendas a dinheiro, PIX, débito e crédito, controle de troco e fechamento de turno por operador.
2.2. O Assinante declara estar expressamente ciente de que este plano NÃO inclui emissão ou transmissão de Notas Fiscais Eletrônicas perante a Secretaria da Fazenda Estadual (SEFAZ - NF-e modelo 55 e NFC-e modelo 65).

3. MENSALIDADE, TESTE DE 30 DIAS E FATURAMENTO
3.1. O valor mensal do PLANO BÁSICO + PDV SEM NF-E é de R$ 129,90 (cento e vinte e nove reais e noventa centavos).
3.2. É assegurado o período de teste gratuito de 30 (trinta) dias para novas organizações, com isenção da primeira mensalidade.
3.3. As faturas regulares subsequentes terão vencimento no dia 10 (dez) de cada mês, mediante compensação via PIX ou Boleto.

4. RESPONSABILIDADE PELOS OPERADORES DE CAIXA
4.1. O Assinante responde de forma objetiva por todos os atos, movimentações, sangrias e cancelamentos efetuados por seus operadores e colaboradores cadastrados no sistema (art. 932, III, do Código Civil).

5. REGRAS DE INADIMPLÊNCIA, LGPD E FORO
5.1. A inadimplência superior a 10 (dez) dias autoriza a suspensão preventiva de acesso aos terminais de PDV e à retaguarda gerencial.
5.2. A base de dados permanece resguardada pelo prazo legal conforme preconiza a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
5.3. Fica eleito o Foro da comarca da sede da fornecedora para qualquer disputa judicial.`,
    updatedAt: new Date().toISOString(),
  },

  // 3. Completo sem emissão de NF-e e NFC-e
  '00000000-0000-4000-8000-000000000003': {
    planId: '00000000-0000-4000-8000-000000000003',
    planName: 'Completo sem emissão de NF-e e NFC-e',
    version: '2.0',
    title: 'Termos de Adesão e Licença de Software — Plano Completo sem NF-e/NFC-e',
    summary: 'Acesso total a todas as funcionalidades: PDV, Vendas, Estoque com depósitos, Orçamentos, Ordens de Serviço (O.S.) e Financeiro completo.',
    content: `CONTRATO DE LICENÇA DE USO DE SOFTWARE (SaaS) — PLANO COMPLETO SEM NF-E/NFC-E

1. OBJETO DA CONTRATAÇÃO
1.1. O presente instrumento concede licença temporária e intransferível de uso da suíte integral de gestão corporativa da plataforma no PLANO COMPLETO SEM EMISSÃO FISCAL, abrangendo:
   a) Módulo de Vendas, Pedidos e Frente de Caixa PDV;
   b) Controle Avançado de Estoque (com múltiplos depósitos, movimentações e importação de XML de fornecedores);
   c) Gestão Comercial de Orçamentos com link público para aprovação ou recusa por clientes;
   d) Ordens de Serviço (O.S.) completas com catálogo de equipamentos, laudos e status de assistência técnica;
   e) Gestão Financeira Completa com Caixa, Contas a Pagar/Receber e Conciliação;
   f) Catálogo de Serviços, Clientes e Fornecedores;
   g) Relatórios de Produtividade, BI e Exportação de Planilhas.

2. ESPECIFICAÇÃO FISCAL E ORDENS DE SERVIÇO
2.1. O plano não inclui emissão oficial de documentos fiscais transmitidos à SEFAZ (NF-e/NFC-e).
2.2. Nas Ordens de Serviço, o Assinante é o exclusivo e integral responsável pela guarda de bens de terceiros, equipamentos deixados em conserto, sigilo de senhas anotadas e cumprimento das garantias de serviços prestadas aos seus clientes finais.

3. VALOR DA ASSINATURA E PERÍODO DE DEGUSTAÇÃO
3.1. A mensalidade recorrente deste plano é de R$ 159,90 (cento e cinquenta e nove reais e noventa centavos).
3.2. A organização dispõe de 30 (trinta) dias de avaliação gratuita completa (Trial), com pleno acesso a todos os módulos sem custo imediato.
3.3. O vencimento da primeira mensalidade pós-trial e das subsequentes ocorrerá todo dia 10 (dez) de cada mês.

4. SUSPENSÃO DE ACESSO, LGPD E EXPORTAÇÃO
4.1. O atraso no pagamento por prazo superior a 10 (dez) dias corridos ensejará a suspensão do acesso às funcionalidades da plataforma.
4.2. Em respeito à LGPD e à titularidade das informações, o Assinante poderá requerer a exportação de sua base cadastral antes da exclusão definitiva da conta.

5. VIGÊNCIA E FORO
5.1. Contrato vigente por prazo indeterminado, com cancelamento livre de multas a qualquer momento.
5.2. Foro competente: comarca da sede da fornecedora da plataforma.`,
    updatedAt: new Date().toISOString(),
  },

  // 4. Completo com emissão de NF-e e NFC-e
  '00000000-0000-4000-8000-000000000004': {
    planId: '00000000-0000-4000-8000-000000000004',
    planName: 'Completo com emissão de NF-e e NFC-e',
    version: '2.0',
    title: 'Termos de Adesão e Licença de Software — Plano Completo com Emissão Fiscal (NF-e / NFC-e)',
    summary: 'Acesso total irrestrito incluindo autorização e transmissão de documentos fiscais eletrônicos perante a SEFAZ.',
    content: `CONTRATO DE LICENÇA DE USO DE SOFTWARE (SaaS) — PLANO COMPLETO COM EMISSÃO FISCAL

1. OBJETO E ESCOPO DA LICENÇA FISCAL
1.1. Concessão de licença integral do software de gestão empresarial compreendendo todos os módulos operacionais, somados ao módulo fiscal de emissão, assinatura digital e transmissão de Notas Fiscais Eletrônicas (NF-e modelo 55) e Notas Fiscais de Consumidor Eletrônica (NFC-e modelo 65) perante os servidores da SEFAZ.

2. CERTIFICADO DIGITAL E RESPONSABILIDADE TRIBUTÁRIA DO ASSINANTE
2.1. O Assinante é o único e exclusivo responsável pelo fornecimento, instalação e validade de seu Certificado Digital padrão ICP-Brasil (A1), bem como pela correta parametrização tributária (NCM, CFOP, CST/CSOSN, alíquotas de ICMS, PIS, COFINS e IPI).
2.2. A fornecedora do software atua como mera intermediadora de transmissão telemática, não prestando consultoria tributária e não respondendo por erros de enquadramento fiscal, autuações fiscais, multas tributárias ou sonegação praticada pelo Assinante.

3. MENSALIDADE, CONDIÇÕES COMERCIAIS E TESTE
3.1. A mensalidade recorrente deste plano é de R$ 199,90 (cento e noventa e nove reais e noventa centavos), incluindo suporte fiscal para transmissão e atualizações de esquemas XML da SEFAZ.
3.2. Período de avaliação gratuita de 30 (trinta) dias garantido na ativação da conta.
3.3. Vencimento mensal todo dia 10 (dez), via PIX ou Boleto Bancário.

4. SUSPENSÃO, CONTINGÊNCIA E SLA
4.1. Atrasos superiores a 10 (dez) dias autorizam o bloqueio preventivo de transmissões fiscais e do sistema até regularização.
4.2. A disponibilidade das transmissões depende da estabilidade dos web services da SEFAZ estadual, cabendo ao Assinante a utilização do modo de contingência quando a autoridade fazendária estiver inoperante.

5. LGPD, FORO E VIGÊNCIA
5.1. Guarda legal dos arquivos XML emitidos pelo prazo estipulado na legislação tributária e em estrita conformidade com a LGPD.
5.2. Foro da comarca da sede da fornecedora para dirimir quaisquer controvérsias.`,
    updatedAt: new Date().toISOString(),
  },

  // Fallback geral
  default: {
    planId: 'default',
    planName: 'Termo Padrão Geral da Plataforma',
    version: '2.0',
    title: 'Termos e Condições Gerais de Uso da Plataforma (SaaS)',
    summary: 'Termos e condições gerais de licenciamento de software em nuvem aplicáveis a todos os planos e contas.',
    content: `TERMOS E CONDIÇÕES GERAIS DE USO E LICENCIAMENTO DE SOFTWARE (SaaS)

1. DISPOSIÇÕES GERAIS
Estes Termos e Condições Gerais constituem um contrato vinculante entre a contratante e a plataforma JB Gestão / ControleSoft. Ao criar uma conta, usufruir do período de teste de 30 dias ou contratar qualquer plano de acesso, você declara ter lido e concordado com as cláusulas deste instrumento.

2. LICENÇA DE USO
A licença é pessoal, temporária, revogável e intransferível, operada sob a modalidade SaaS em nuvem. A titularidade dos direitos autorais e propriedade intelectual sobre a plataforma e seu código-fonte permanecem exclusivamente com a fornecedora.

3. PERÍODO DE DEGUSTAÇÃO E PAGAMENTOS
Novos cadastros possuem 30 (trinta) dias de avaliação gratuita sem cobrança prévia. A continuidade do uso após os 30 dias fica vinculada ao pagamento da assinatura mensal correspondente ao plano adquirido. O não pagamento no prazo de até 10 dias após o vencimento autoriza a suspensão preventiva de acesso.

4. PROTEÇÃO DE DADOS (LGPD) E SEGURANÇA
A fornecedora adota medidas técnicas e organizacionais de segurança para proteção dos registros armazenados, assegurando sigilo e isolamento de banco de dados nos moldes da Lei Federal nº 13.709/2018 (LGPD).

5. CANCELAMENTO E FORO
O cancelamento pode ser efetuado a qualquer momento sem penalidades financeiras. Fica eleito o foro da comarca da operadora da plataforma para solução de litígios.`,
    updatedAt: new Date().toISOString(),
  },
}

function getLocalTerms(): Record<string, PlanTermConfig> {
  if (typeof window === 'undefined') return DEFAULT_PLAN_TERMS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PLAN_TERMS
    const parsed = JSON.parse(raw) as Record<string, PlanTermConfig>
    return { ...DEFAULT_PLAN_TERMS, ...parsed }
  } catch {
    return DEFAULT_PLAN_TERMS
  }
}

function setLocalTerms(terms: Record<string, PlanTermConfig>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(terms))
  } catch {
    // ignore
  }
}

export const planTermsService = {
  /**
   * Retorna todos os termos configurados por plano, mesclando Supabase, LocalStorage e padrões.
   */
  async getAllTerms(): Promise<Record<string, PlanTermConfig>> {
    const local = getLocalTerms()

    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', SETTING_KEY)
        .single()

      if (!error && data?.value && typeof data.value === 'object') {
        const remote = data.value as Record<string, PlanTermConfig>
        const merged = { ...DEFAULT_PLAN_TERMS, ...local, ...remote }
        setLocalTerms(merged)
        return merged
      }
    } catch (err) {
      logger.warn('Falha ao obter termos dos planos do Supabase, usando local', { error: String(err) })
    }

    return local
  },

  /**
   * Retorna o termo exato vinculado a um plano específico (por id ou nome).
   */
  async getTermForPlan(planIdOrName?: string | null): Promise<PlanTermConfig> {
    const all = await this.getAllTerms()

    if (!planIdOrName) {
      return all.default || DEFAULT_PLAN_TERMS.default
    }

    // 1. Busca por ID direto
    if (all[planIdOrName]) {
      return all[planIdOrName]
    }

    // 2. Busca por correspondência no nome do plano
    const search = planIdOrName.trim().toLowerCase()
    const foundEntry = Object.values(all).find((t) => {
      const tName = t.planName.trim().toLowerCase()
      return tName === search || tName.includes(search) || search.includes(tName)
    })

    if (foundEntry) {
      return foundEntry
    }

    // 3. Fallback inteligente pelos planos padrão do sistema
    const sysPlan = SYSTEM_DEFAULT_ACCESS_PLANS.find(
      (p) => p.id === planIdOrName || p.name.trim().toLowerCase() === search,
    )
    if (sysPlan && all[sysPlan.id]) {
      return all[sysPlan.id]
    }

    return all.default || DEFAULT_PLAN_TERMS.default
  },

  /**
   * Salva as alterações no termo de um determinado plano.
   */
  async saveTermForPlan(
    planId: string,
    termUpdate: Partial<PlanTermConfig>,
    updatedBy?: string | null,
  ): Promise<ServiceResult<PlanTermConfig>> {
    try {
      const current = await this.getAllTerms()
      const existing = current[planId] || DEFAULT_PLAN_TERMS[planId] || DEFAULT_PLAN_TERMS.default

      const updated: PlanTermConfig = {
        ...existing,
        ...termUpdate,
        planId,
        updatedAt: new Date().toISOString(),
        updatedBy: updatedBy ?? existing.updatedBy ?? null,
      }

      current[planId] = updated
      setLocalTerms(current)

      // Persiste no Supabase
      try {
        await supabase.from('system_settings').upsert({
          key: SETTING_KEY,
          value: current,
          updated_at: updated.updatedAt,
          updated_by: null,
        })
      } catch (dbErr) {
        logger.warn('Não foi possível persistir termo no Supabase (salvo localmente)', { error: String(dbErr) })
      }

      return { success: true, data: updated }
    } catch (err: any) {
      logger.error('Erro ao salvar termo do plano', err)
      return { success: false, error: 'Falha ao salvar as alterações do termo.' }
    }
  },

  /**
   * Restaura o termo de um plano para o modelo padrão oficial.
   */
  async resetTermToDefault(planId: string, updatedBy?: string | null): Promise<ServiceResult<PlanTermConfig>> {
    const defaultTemplate = DEFAULT_PLAN_TERMS[planId] || DEFAULT_PLAN_TERMS.default
    return this.saveTermForPlan(planId, defaultTemplate, updatedBy)
  },
}
