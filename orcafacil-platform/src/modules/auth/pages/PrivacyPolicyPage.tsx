import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Database,
  FileText,
  Lock,
  Mail,
  Printer,
  Scale,
  Shield,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import { BrandLogo } from '@shared/components/BrandLogo'
import { Button } from '@shared/components/ui/Button'

export function PrivacyPolicyPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') === 'terms' ? 'terms' : 'privacy'
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(initialTab)

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'terms') {
      setActiveTab('terms')
    } else if (tabParam === 'privacy') {
      setActiveTab('privacy')
    }
  }, [searchParams])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeTab])

  const handleTabChange = (tab: 'privacy' | 'terms') => {
    setActiveTab(tab)
    setSearchParams(tab === 'terms' ? { tab: 'terms' } : {})
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-800 print:bg-white">
      {/* Cabeçalho fixo */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs print:static print:border-b-2 print:border-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandLogo />
            <span className="hidden sm:inline-block h-5 w-px bg-slate-200" />
            <span className="hidden sm:inline-block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Central Jurídica & Conformidade LGPD
            </span>
          </div>

          <div className="flex items-center gap-2.5 print:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5 text-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </Button>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao Login
            </Link>
          </div>
        </div>
      </header>

      {/* Hero / Banner Superior */}
      <section className="bg-[#0F172A] py-10 text-white print:bg-white print:py-4 print:text-slate-900">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300 print:border-slate-300 print:text-slate-700">
                <ShieldCheck className="h-4 w-4" />
                {activeTab === 'privacy'
                  ? 'Lei Geral de Proteção de Dados (Lei nº 13.709/2018)'
                  : 'Contrato de Licenciamento SaaS e Condições Gerais'}
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                {activeTab === 'privacy'
                  ? 'Política de Privacidade e Proteção de Dados Pessoais'
                  : 'Termos e Condições de Uso da Plataforma'}
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-300 print:text-slate-600">
                Última atualização: <strong>12/11/2026</strong> · Versão <strong>2.0</strong>{' '}
                (Vigência a partir da aceitação)
              </p>
            </div>

            {/* Seletor de Abas (Política de Privacidade vs. Termos de Uso) */}
            <div className="flex rounded-xl bg-slate-800/90 p-1 border border-slate-700 self-start print:hidden">
              <button
                type="button"
                onClick={() => handleTabChange('privacy')}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'privacy'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Shield className="h-3.5 w-3.5" />
                Política de Privacidade
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('terms')}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'terms'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Scale className="h-3.5 w-3.5" />
                Termos de Uso (v2.0)
              </button>
            </div>
          </div>

          {/* Quadro resumo de Identificação da Controladora e DPO */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl border border-white/10 bg-white/5 p-4 text-xs print:border-slate-300 print:bg-slate-50 print:text-slate-800">
            <div className="flex items-start gap-2.5">
              <Building2 className="h-4 w-4 text-blue-400 shrink-0 mt-0.5 print:text-blue-700" />
              <div>
                <span className="text-slate-400 block print:text-slate-500">
                  Operadora e Controladora do SaaS:
                </span>
                <strong className="text-white text-sm print:text-slate-900">
                  ControleSoft / JB Gestão (doravante &ldquo;Plataforma&rdquo;)
                </strong>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Mail className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5 print:text-emerald-700" />
              <div>
                <span className="text-slate-400 block print:text-slate-500">
                  Encarregado de Dados (DPO) e Canal Jurídico:
                </span>
                <div className="font-semibold text-white print:text-slate-900 space-x-2">
                  <a
                    href="mailto:dpo@controlesoft.com.br"
                    className="underline decoration-blue-400/60 hover:text-blue-300"
                  >
                    dpo@controlesoft.com.br
                  </a>
                  <span>/</span>
                  <a
                    href="mailto:privacidade@controlesoft.com.br"
                    className="underline decoration-blue-400/60 hover:text-blue-300"
                  >
                    privacidade@controlesoft.com.br
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Conteúdo Principal */}
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {activeTab === 'privacy' ? (
          <>
            {/* 1. Apresentação e Papéis Jurídicos */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Scale className="h-4 w-4" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  1. Apresentação e Papéis Jurídicos (LGPD — Lei nº 13.709/2018)
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                A <strong>ControleSoft / JB Gestão</strong> respeita a privacidade de seus usuários e
                adota as melhores práticas de segurança da informação em conformidade com a Lei Geral
                de Proteção de Dados (LGPD) e o Marco Civil da Internet.
              </p>
              <p className="text-sm leading-relaxed text-slate-600">
                Para fins da LGPD, os papéis de tratamento de dados dividem-se da seguinte forma:
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-blue-900">
                    (a) Dados da Conta e Uso da Plataforma (Controlador)
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-700">
                    Somos os <strong>Controladores</strong> dos dados cadastrais dos representantes da
                    Empresa Contratante (nome, e-mail, CPF/CNPJ, dados de faturamento, credenciais de
                    acesso, logs de auditoria e telemetria de uso — como tempo de tela e endereço IP).
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-900">
                    (b) Dados Inseridos na Operação (Operador)
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-700">
                    Em relação a todos os dados pessoais inseridos, importados ou coletados pela
                    Empresa Contratante em seus módulos operacionais (como cadastros de clientes
                    finais, fornecedores, histórico de vendas, fiado, orçamentos, ordens de serviço e
                    senhas de dispositivos), a{' '}
                    <strong>Empresa Contratante é a única e exclusiva Controladora</strong>, e a{' '}
                    <strong>ControleSoft atua estritamente como Operadora</strong>, realizando o
                    armazenamento técnico e processamento por meio de arquitetura multi-tenant com
                    isolamento lógico de dados (<em>Row-Level Security</em>), agindo unicamente sob as
                    instruções da Empresa Contratante.
                  </p>
                </div>
              </div>
            </section>

            {/* 2. Dados Coletados */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Database className="h-4 w-4" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  2. Dados Coletados
                </h2>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800">
                  2.1. Fornecidos por Você (Empresa Contratante e Usuários)
                </h3>
                <ul className="space-y-2.5 text-sm text-slate-600">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-1" />
                    <span>
                      <strong>Cadastro e Identificação:</strong> Razão social, nome fantasia,
                      CNPJ/CPF, endereço completo, e-mail, telefones de contato e dados dos usuários
                      autorizados (proprietários, administradores e colaboradores).
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-1" />
                    <span>
                      <strong>Dados Operacionais e Transacionais:</strong> Produtos, estoque, preços
                      de custo e venda, tabelas de insumos, movimentações financeiras, dados de
                      fechamento de caixa, sangrias, suprimentos, contas a pagar e receber.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-1" />
                    <span>
                      <strong>Orçamentos e Ordens de Serviço (O.S.):</strong> Informações de clientes
                      finais, equipamentos deixados em assistência, termos de garantia personalizados
                      e senhas de desbloqueio de dispositivos (<code>device_password</code>), cuja
                      guarda e sigilo competem integralmente à equipe da Empresa Contratante.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-1" />
                    <span>
                      <strong>Arquivos e Documentos Auxiliares:</strong> Arquivos XML de notas
                      fiscais de entrada, arquivos PDF de boletos bancários para extração automática
                      via parser, planilhas de migração em massa (Excel/CSV) e fotos de vistorias de
                      equipamentos.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-1" />
                    <span>
                      <strong>Canais de Atendimento e Suporte:</strong> Mensagens enviadas via widget
                      de suporte, sugestões ou assistente de Inteligência Artificial.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">
                  2.2. Coletados Automaticamente e por Telemetria
                </h3>
                <ul className="space-y-2.5 text-sm text-slate-600">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0 mt-1" />
                    <span>
                      <strong>Registros de Acesso (Logs):</strong> Endereço IP, data e hora de
                      acesso, páginas visitadas, tipo de navegador e dispositivo, nos termos do art.
                      15 do Marco Civil da Internet.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0 mt-1" />
                    <span>
                      <strong>Métricas de Uso e Telemetria:</strong> Registro de tempo ativo na
                      plataforma, histórico de versões visualizadas e data do último acesso (
                      <code>last_access_at</code>) para fins de auditoria, segurança e melhoria
                      contínua da experiência de suporte.
                    </span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 3. Finalidades e Bases Legais */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <FileText className="h-4 w-4" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  3. Finalidades e Bases Legais do Tratamento (Art. 7º da LGPD)
                </h2>
              </div>
              <p className="text-sm text-slate-600">
                Os dados pessoais coletados são tratados para as seguintes finalidades e respectivas
                bases legais:
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/60">
                  <h4 className="text-xs font-bold uppercase text-slate-900">
                    Execução de Contrato
                  </h4>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Criação e manutenção da conta SaaS, liberação de planos de acesso, processamento
                    de assinaturas e prestação de suporte técnico.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/60">
                  <h4 className="text-xs font-bold uppercase text-slate-900">
                    Cumprimento de Obrigação Legal
                  </h4>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Guarda de registros de acesso pelo prazo mínimo de 6 meses (Marco Civil da
                    Internet) e armazenamento de dados fiscais e financeiros pelo prazo legal
                    aplicável.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/60">
                  <h4 className="text-xs font-bold uppercase text-slate-900">
                    Legítimo Interesse
                  </h4>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Segurança da plataforma, prevenção a fraudes, auditoria de permissões de
                    usuários, aprimoramento de produtos e processamento de consultas por meio do
                    assistente de IA.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/60">
                  <h4 className="text-xs font-bold uppercase text-slate-900">Consentimento</h4>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Quando aplicável a comunicações de marketing, campanhas específicas ou
                    formulários de captação de leads.
                  </p>
                </div>
              </div>
            </section>

            {/* 4. Compartilhamento de Dados e Suboperadores */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Shield className="h-4 w-4" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  4. Compartilhamento de Dados e Suboperadores
                </h2>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                <strong>Não comercializamos dados pessoais.</strong> O compartilhamento ocorre
                estritamente na medida necessária para a operação da Plataforma com prestadores de
                infraestrutura e serviços (suboperadores), tais como:
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>
                  • <strong>Provedores de Infraestrutura e Nuvem (Supabase / AWS / Vercel):</strong>{' '}
                  Hospedagem de banco de dados, autenticação e entrega de conteúdo web com
                  criptografia de tráfego.
                </li>
                <li>
                  • <strong>Provedores de Pagamento e Gateway:</strong> Processamento de assinaturas,
                  PIX e cobranças da licença do sistema.
                </li>
                <li>
                  • <strong>APIs Públicas e Governamentais:</strong> Validação automatizada de CEP e
                  dados cadastrais.
                </li>
                <li>
                  • <strong>Autoridades Públicas:</strong> Cumprimento de ordens judiciais,
                  requisições legais ou exercício regular de direitos em processos administrativos ou
                  judiciais.
                </li>
              </ul>
            </section>

            {/* 5. Segurança da Informação & 6. Retenção */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Lock className="h-4 w-4" />
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    5. Segurança da Informação
                  </h2>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Adotamos rígidas salvaguardas técnicas e administrativas para proteger os dados
                  contra acessos não autorizados, perda ou alteração, incluindo criptografia de
                  tráfego (HTTPS/SSL), isolamento lógico de dados entre empresas (
                  <em>Row-Level Security</em>), controle de acesso hierárquico por perfis granulares
                  (SuperAdmin, Admin e Membro) e auditoria de operações administrativas.
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <Database className="h-4 w-4" />
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    6. Retenção e Eliminação de Dados
                  </h2>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Os dados são mantidos pelo tempo estritamente necessário para cumprir as
                  finalidades descritas nesta Política e as exigências legais aplicáveis:
                </p>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li>
                    • <strong>Logs de Acesso:</strong> Mínimo de 6 meses.
                  </li>
                  <li>
                    • <strong>Dados Fiscais e Financeiros de Assinatura:</strong> Prazos legais
                    aplicáveis (referência de até 5 anos).
                  </li>
                  <li>
                    • <strong>Encerramento de Conta / Rescisão:</strong> Após o término da relação
                    contratual ou cancelamento por inadimplência/fim de trial, os dados da
                    organização e de sua operação poderão ser mantidos por um período de carência (
                    <strong>30 a 90 dias</strong>) para eventual solicitação de exportação pelo
                    cliente, sendo posteriormente eliminados ou anonimizados de forma definitiva dos
                    servidores, ressalvadas as hipóteses de guarda obrigatória por lei.
                  </li>
                </ul>
              </section>
            </div>

            {/* 7. Direitos dos Titulares & 8. Alterações */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <UserCheck className="h-4 w-4" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  7. Direitos dos Titulares (Art. 18 da LGPD)
                </h2>
              </div>
              <p className="text-sm text-slate-600">
                Como titular de dados da sua conta, você pode solicitar a qualquer momento (inclusive
                diretamente na área logada em{' '}
                <strong>Configurações da Organização → Privacidade e LGPD</strong>):
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-slate-700">
                <li className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                  Confirmação da existência de tratamento e acesso aos dados.
                </li>
                <li className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                  Correção de dados incompletos, inexatos ou desatualizados.
                </li>
                <li className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                  Anonimização, bloqueio ou eliminação de dados desnecessários.
                </li>
                <li className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                  Portabilidade e exportação dos dados operacionais (JSON/CSV).
                </li>
                <li className="sm:col-span-2 flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                  Revogação do consentimento e oposição a tratamentos realizados com base em legítimo
                  interesse.
                </li>
              </ul>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 leading-relaxed">
                <strong>Nota sobre Clientes Finais:</strong> Como a Empresa Contratante é a
                Controladora dos dados de seus clientes finais inseridos no sistema, eventuais
                solicitações de titulares (consumidores) referentes a esses dados devem ser
                direcionadas diretamente à Empresa Contratante. A ControleSoft atuará como Operadora
                prestando suporte técnico para viabilizar o atendimento ao pedido (ex.: exportação ou
                exclusão pontual pelo painel).
              </div>

              <div className="pt-3 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">8. Alterações desta Política</h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Esta Política de Privacidade poderá ser atualizada periodicamente. Alterações
                  relevantes serão comunicadas por aviso na Plataforma ou por e-mail cadastrado. A
                  versão mais recente estará sempre publicada neste endereço.
                </p>
              </div>
            </section>
          </>
        ) : (
          /* ============================================================== */
          /* ABA DE TERMOS E CONDIÇÕES DE USO DA PLATAFORMA (VERSÃO 2.0)     */
          /* ============================================================== */
          <div className="space-y-6">
            {/* Aviso Importante */}
            <section className="rounded-2xl border border-amber-300 bg-amber-50/80 p-5 shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <span>Aviso Importante — Contrato Legalmente Vinculante</span>
              </div>
              <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
                Estes Termos e Condições de Uso (&ldquo;Termos&rdquo;) constituem um contrato
                legalmente vinculante entre você (o &ldquo;Cliente&rdquo; / &ldquo;Assinante&rdquo;)
                e a <strong>ControleSoft / JB Gestão</strong>, operadora da plataforma. Ao criar uma
                conta, contratar um plano, iniciar um período de teste (<em>Trial</em>) ou utilizar
                o Serviço de qualquer forma, você declara ter lido, compreendido e aceito
                integralmente todas as disposições aqui previstas.
              </p>
              <p className="text-xs font-semibold text-amber-800 leading-relaxed">
                Leia atentamente este documento: ele contém limitações expressas de responsabilidade
                da fornecedora do software, isenções quanto a obrigações fiscais, tributárias e
                bancárias, e regras estritas sobre a responsabilidade pelos atos de prepostos e
                operadores.
              </p>
            </section>

            {/* Cláusulas 1 a 14 */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
              {/* 1. Definições */}
              <div className="space-y-2 border-b border-slate-100 pb-5">
                <h2 className="text-base font-bold text-slate-900">1. Definições</h2>
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  <li>
                    • <strong>Plataforma / Serviço:</strong> O sistema de ponto de venda (PDV) e
                    gestão comercial ControleSoft / JB Gestão, ofertado em nuvem no modelo de{' '}
                    <em>Software as a Service</em> (SaaS), estruturado em arquitetura multi-tenant
                    com isolamento lógico de dados.
                  </li>
                  <li>
                    • <strong>Empresa / Nós:</strong> ControleSoft / JB Gestão, desenvolvedora e
                    operadora da Plataforma.
                  </li>
                  <li>
                    • <strong>Cliente / Você:</strong> A pessoa física ou jurídica (empresário,
                    microempresa, empresa de pequeno ou médio porte) que realiza o cadastro,
                    contrata a licença de uso e assume a responsabilidade pela organização criada na
                    Plataforma.
                  </li>
                  <li>
                    • <strong>Usuário / Preposto:</strong> Qualquer pessoa física autorizada pelo
                    Cliente a acessar a Plataforma sob a sua conta (sócios, administradores, caixas,
                    vendedores, técnicos ou operadores).
                  </li>
                  <li>
                    • <strong>Dados do Cliente:</strong> Todas as informações, cadastros, arquivos,
                    planilhas, produtos, históricos de vendas, movimentações financeiras, dados de
                    clientes finais e documentos inseridos, importados ou gerados pelo Cliente na
                    Plataforma.
                  </li>
                </ul>
              </div>

              {/* 2. Aceitação, Capacidade e Hierarquia de Contas */}
              <div className="space-y-2 border-b border-slate-100 pb-5">
                <h2 className="text-base font-bold text-slate-900">
                  2. Aceitação, Capacidade e Hierarquia de Contas
                </h2>
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  <li>
                    • <strong>Capacidade Civil e Empresarial:</strong> Você declara ser maior de 18
                    anos, plenamente capaz, ou representar validamente a pessoa jurídica
                    contratante, possuindo plenos poderes para assumir as obrigações estipuladas
                    nestes Termos.
                  </li>
                  <li>
                    • <strong>Hierarquia e Gestão de Acessos:</strong> O Cliente (por meio da conta{' '}
                    <code>owner</code> / <code>admin</code>) é o único responsável por cadastrar,
                    gerenciar, conceder permissões granulares (<code>MOD-01</code> a{' '}
                    <code>MOD-11</code>) e revogar o acesso de seus Usuários.
                  </li>
                  <li>
                    • <strong>Responsabilidade por Atos de Prepostos:</strong> Nos termos do art.
                    932, III, do Código Civil, o Cliente assume responsabilidade integral e objetiva
                    por todos os atos, lançamentos, descontos, sangrias de caixa, exclusões,
                    exportações de dados e operações realizadas por qualquer Usuário vinculado à sua
                    organização.
                  </li>
                </ul>
              </div>

              {/* 3. Natureza do Serviço e Isenção de Obrigações Contábeis e Fiscais */}
              <div className="space-y-2 border-b border-slate-100 pb-5">
                <h2 className="text-base font-bold text-slate-900">
                  3. Natureza do Serviço e Isenção de Obrigações Contábeis e Fiscais
                </h2>
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  <li>
                    • <strong>Obrigação de Meio:</strong> A Plataforma constitui uma ferramenta
                    tecnológica de apoio gerencial e operacional (obrigação de meio), não
                    configurando consultoria contábil, fiscal, financeira, jurídica ou garantia de
                    resultado comercial.
                  </li>
                  <li>
                    • <strong>Módulo Fiscal (Homologação e Controle Interno):</strong> A geração de
                    dados e metadados fiscais (como NF-e e NFC-e) no sistema opera em caráter de
                    controle gerencial interno e simulação/homologação, não substituindo a emissão
                    oficial nos portais governamentais autorizados (SEFAZ/Prefeituras) via
                    certificado digital próprio.
                  </li>
                  <li>
                    • <strong>Exclusividade de Responsabilidade Tributária:</strong> O Cliente é o
                    único e exclusivo responsável pelo cumprimento de todas as suas obrigações
                    tributárias principais e acessórias, apuração de impostos, parametrização
                    correta de alíquotas, NCM, CFOP, CST/CSOSN e entrega de declarações fiscais. A
                    Plataforma não assume nenhuma responsabilidade por autuações, multas ou
                    bitributações.
                  </li>
                </ul>
              </div>

              {/* 4. Operações Financeiras, Caixa e Leitura de Boletos */}
              <div className="space-y-2 border-b border-slate-100 pb-5">
                <h2 className="text-base font-bold text-slate-900">
                  4. Operações Financeiras, Caixa e Leitura de Boletos
                </h2>
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  <li>
                    • <strong>Ausência de Liquidação Bancária:</strong> A Plataforma não é uma
                    instituição financeira, banco ou processadora de pagamentos bancários direta. O
                    registro de formas de pagamento (Dinheiro, PIX, Cartão) e a baixa de contas a
                    pagar ou boletos no módulo financeiro (<code>MOD-05</code>) constituem
                    estritamente registros gerenciais internos para controle de fluxo de caixa, não
                    gerando ordens de pagamento nem liquidando títulos na rede bancária
                    (DDA/FEBRABAN). O pagamento real deve ser efetuado pelo Cliente em seu{' '}
                    <em>Internet Banking</em> ou instituição autorizada.
                  </li>
                  <li>
                    • <strong>Informatização de Leitura de Boletos (Parser PDF):</strong> O recurso
                    de extração automática de dados de boletos bancários por meio de arquivos PDF é
                    uma ferramenta de mera conveniência. O Cliente tem o dever intransferível de
                    conferir valores, datas de vencimento e beneficiários antes de confirmar o
                    registro. A Plataforma exime-se de prejuízos decorrentes de multas, juros,
                    atrasos ou protestos por falhas na leitura de arquivos.
                  </li>
                </ul>
              </div>

              {/* 5. Cadastro, Segurança de Credenciais e Senhas de Aparelhos (O.S.) */}
              <div className="space-y-2 border-b border-slate-100 pb-5">
                <h2 className="text-base font-bold text-slate-900">
                  5. Cadastro, Segurança de Credenciais e Senhas de Aparelhos (O.S.)
                </h2>
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  <li>
                    • <strong>Sigilo de Credenciais:</strong> As senhas e logins de acesso são
                    pessoais e intransferíveis. O Cliente deve notificar o suporte imediatamente em
                    caso de qualquer suspeita de comprometimento de sua conta.
                  </li>
                  <li>
                    • <strong>Desligamento de Funcionários:</strong> É dever absoluto do
                    Administrador da empresa cliente revogar ou excluir imediatamente o acesso de
                    funcionários demitidos, afastados ou cujas funções tenham sido alteradas.
                  </li>
                  <li>
                    • <strong>Senhas de Dispositivos em Ordens de Serviço (MOD-10):</strong> No
                    módulo de assistência técnica, o armazenamento da senha de desbloqueio de
                    equipamentos de clientes finais (<code>device_password</code>) e a realização de
                    vistorias são de inteira responsabilidade civil, criminal e perante a LGPD do
                    Cliente e de seus técnicos, cabendo-lhes zelar pelo sigilo e orientar o
                    consumidor final.
                  </li>
                </ul>
              </div>

              {/* 6. Planos, Período de Teste (Trial), Pagamentos e Reajustes */}
              <div className="space-y-2 border-b border-slate-100 pb-5">
                <h2 className="text-base font-bold text-slate-900">
                  6. Planos, Período de Teste (Trial), Pagamentos e Reajustes
                </h2>
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  <li>
                    • <strong>Período de Teste (Trial):</strong> Oferecemos período de avaliação
                    gratuita conforme condições comerciais vigentes. Ao término do período de teste,
                    a continuidade do uso depende da contratação/renovação ativa do plano.
                  </li>
                  <li>
                    • <strong>Cobranças Recorrentes e Inadimplemento:</strong> As assinaturas
                    (mensais ou anuais) são cobradas conforme o plano contratado. O inadimplemento
                    ou vencimento do <em>Trial</em> sem renovação acarretará a suspensão automática
                    do acesso (<code>is_active = false</code>).
                  </li>
                  <li>
                    • <strong>Reajustes:</strong> Os valores poderão ser reajustados anualmente com
                    base em índices oficiais (IPCA/IGP-M) ou revisão de mercado, mediante aviso
                    prévio de 30 dias.
                  </li>
                  <li>
                    • <strong>Política de Reembolso:</strong> As regras de arrependimento (prazo
                    legal de 7 dias) e prazos de reembolso seguem a legislação aplicável.
                  </li>
                </ul>
              </div>

              {/* 7. Condutas Proibidas e Uso Aceitável */}
              <div className="space-y-2 border-b border-slate-100 pb-5">
                <h2 className="text-base font-bold text-slate-900">
                  7. Condutas Proibidas e Uso Aceitável
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  É expressamente vedado ao Cliente e aos seus Usuários:
                </p>
                <ul className="space-y-1 text-xs sm:text-sm text-slate-600">
                  <li>
                    • Utilizar a Plataforma para fins ilícitos, fraudes, sonegação fiscal ou lavagem
                    de dinheiro;
                  </li>
                  <li>
                    • Inserir dados falsos ou bases de dados de terceiros obtidas sem base legal ou
                    consentimento;
                  </li>
                  <li>
                    • Realizar engenharia reversa, descompilação, cópia de código-fonte, testes de
                    intrusão ou sobrecarga intencional da infraestrutura;
                  </li>
                  <li>
                    • Compartilhar credenciais de acesso de nível <code>admin</code> de forma a
                    burlar o controle individualizado de operadores em auditorias.
                  </li>
                </ul>
                <p className="text-xs font-semibold text-rose-700 pt-1">
                  Violações constituem justa causa para o encerramento imediato do contrato, sem
                  direito a reembolso e sem prejuízo de medidas judiciais.
                </p>
              </div>

              {/* 8. Propriedade Intelectual & 9. LGPD */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 border-b border-slate-100 pb-5">
                <div className="space-y-1.5">
                  <h2 className="text-base font-bold text-slate-900">
                    8. Propriedade Intelectual
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    A Plataforma, suas marcas, layouts, interfaces, códigos-fonte, algoritmos e
                    documentações são de propriedade exclusiva da ControleSoft / JB Gestão. A
                    contratação concede ao Cliente uma licença de uso temporária, limitada,
                    revogável, não exclusiva e intransferível, sendo terminantemente proibida a
                    comercialização ou sublicenciamento do software.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-base font-bold text-slate-900">
                    9. Proteção de Dados Pessoais (LGPD)
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    O tratamento de dados pessoais rege-se pela nossa Política de Privacidade. Para
                    os fins da Lei nº 13.709/2018 (LGPD): o Cliente atua como{' '}
                    <strong>Controlador</strong> dos dados de seus clientes finais, fornecedores e
                    colaboradores inseridos na Plataforma; a ControleSoft atua como{' '}
                    <strong>Operadora</strong> da infraestrutura tecnológica, mantendo isolamento
                    lógico por <em>Row-Level Security</em>.
                  </p>
                </div>
              </div>

              {/* 10. Disponibilidade & 11. Limitação de Responsabilidade */}
              <div className="space-y-3 border-b border-slate-100 pb-5">
                <h2 className="text-base font-bold text-slate-900">
                  10. Disponibilidade, Manutenção e Limitação de Suporte
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  A Plataforma é disponibilizada em regime de melhores esforços comerciais. Poderão
                  ocorrer interrupções temporárias decorrentes de manutenções programadas ou
                  emergenciais, falhas de infraestrutura de nuvem global (AWS, Supabase, Vercel),
                  instabilidades de provedores de pagamento ou eventos de força maior. O suporte
                  técnico é prestado em dias e horários úteis, sem garantia de SLA de tempo de
                  resposta, salvo contratação corporativa específica.
                </p>

                <h2 className="text-base font-bold text-slate-900 pt-2">
                  11. Isenção de Garantias e Limitação de Responsabilidade (Teto Indenizatório)
                </h2>
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  <li>
                    • <strong>Isenção:</strong> Na máxima extensão permitida em lei, o Serviço é
                    fornecido &ldquo;no estado em que se encontra&rdquo;, sem garantias de adequação
                    a fins comerciais específicos.
                  </li>
                  <li>
                    • <strong>Exclusão de Danos Indiretos:</strong> A fornecedora da Plataforma não
                    responderá, em nenhuma hipótese, por lucros cessantes, perda de receitas, perda
                    de dados, interrupção de negócios ou danos indiretos.
                  </li>
                  <li>
                    • <strong>Teto de Indenização:</strong> A responsabilidade civil total agregada
                    da Plataforma por quaisquer reclamações oriundas da utilização do Serviço fica
                    estritamente limitada ao valor total efetivamente pago pelo Cliente a título de
                    assinatura nos últimos <strong>3 (três) meses</strong> anteriores ao evento
                    danoso.
                  </li>
                </ul>
              </div>

              {/* 12. Indenização, 13. Vigência e 14. Foro */}
              <div className="space-y-3">
                <h2 className="text-base font-bold text-slate-900">12. Indenização</h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  O Cliente concorda em defender, indenizar e isentar a Plataforma, seus sócios,
                  administradores e colaboradores de quaisquer reclamações, perdas, condenações,
                  multas ou despesas (incluindo honorários advocatícios) decorrentes de: (i) uso
                  indevido da Plataforma; (ii) infração a direitos de terceiros ou legislação
                  fiscal/trabalhista; (iii) inveracidade dos dados inseridos; ou (iv) violação
                  destes Termos por seus Usuários ou prepostos.
                </p>

                <h2 className="text-base font-bold text-slate-900 pt-2">
                  13. Vigência, Suspensão e Rescisão
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  O Cliente pode cancelar sua assinatura a qualquer momento diretamente pelo painel
                  administrativo, sem incidência de multa por cancelamento. A Plataforma poderá
                  suspender ou encerrar o acesso em caso de inadimplência, término do período de
                  teste sem contratação, uso fraudulento ou violação destes Termos. Após o
                  encerramento, os dados da organização serão mantidos por prazo de carência (30 a
                  90 dias) para exportação antes da exclusão definitiva dos servidores.
                </p>

                <h2 className="text-base font-bold text-slate-900 pt-2">
                  14. Disposições Gerais e Foro
                </h2>
                <ul className="space-y-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  <li>
                    • <strong>Comunicações:</strong> Comunicações eletrônicas (e-mail e avisos na
                    Plataforma) possuem plena validade jurídica.
                  </li>
                  <li>
                    • <strong>Legislação e Foro:</strong> Estes Termos são regidos pelas leis
                    brasileiras. Fica eleito o foro da comarca da sede da operadora da Plataforma
                    para dirimir controvérsias, com expressa renúncia a qualquer outro, por mais
                    privilegiado que seja, ressalvadas as hipóteses de competência territorial de
                    foro do consumidor previstas em lei.
                  </li>
                  <li>
                    • <strong>Contato Oficial:</strong> Para dúvidas, suporte ou assuntos jurídicos,
                    utilize os canais oficiais:{' '}
                    <a
                      href="mailto:privacidade@controlesoft.com.br"
                      className="font-semibold text-blue-600 underline"
                    >
                      privacidade@controlesoft.com.br
                    </a>{' '}
                    /{' '}
                    <a
                      href="mailto:dpo@controlesoft.com.br"
                      className="font-semibold text-blue-600 underline"
                    >
                      dpo@controlesoft.com.br
                    </a>
                    .
                  </li>
                </ul>
              </div>
            </section>
          </div>
        )}

        {/* Rodapé da página */}
        <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 pt-6 pb-10 text-xs text-slate-500 print:hidden">
          <span>© 2026 ControleSoft / JB Gestão. Todos os direitos reservados.</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => handleTabChange('privacy')}
              className="hover:text-blue-600 font-medium cursor-pointer"
            >
              Política de Privacidade
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => handleTabChange('terms')}
              className="hover:text-blue-600 font-medium cursor-pointer"
            >
              Termos de Uso
            </button>
            <span>•</span>
            <Link to="/login" className="text-blue-600 font-semibold hover:underline">
              Ir para o Login
            </Link>
          </div>
        </footer>
      </div>
    </main>
  )
}
