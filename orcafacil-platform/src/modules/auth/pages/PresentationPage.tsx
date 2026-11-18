import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calculator,
  Check,
  X,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  Database,
  FileSpreadsheet,
  FileText,
  Layers,
  Lock,
  LogIn,
  MessageCircle,
  Package,
  QrCode,
  Scale,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
  Zap,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { ALL_PLATFORM_DASHBOARD_MODULES } from '@modules/companies/services/company-management.service'
import {
  accessPlanService,
  SYSTEM_DEFAULT_ACCESS_PLANS,
  type AccessPlan,
} from '@modules/companies/services/access-plan.service'
import { BrandLogo } from '@shared/components/BrandLogo'
import { Button } from '@shared/components/ui/Button'
import { formatCurrency } from '@shared/utils/monetary'
import { siteAccessTrackerService } from '@shared/services/site-access-tracker.service'
import { PlanTrialSignupModal } from '../components/PlanTrialSignupModal'

type ModuleCategory = 'all' | 'commercial' | 'services' | 'finance' | 'management'

const MODULE_METADATA: Record<
  string,
  {
    category: ModuleCategory
    categoryLabel: string
    highlight: string
    accentColor: string
    iconBg: string
  }
> = {
  'MOD-01': {
    category: 'commercial',
    categoryLabel: 'Comercial & Frente de Loja',
    highlight: 'PDV ágil com atalhos de teclado, venda rápida e histórico completo',
    accentColor: 'text-blue-600',
    iconBg: 'bg-blue-50 border-blue-200/80 text-blue-600',
  },
  'MOD-02': {
    category: 'finance',
    categoryLabel: 'Estoque & Suprimentos',
    highlight: 'Importação de XML de NF-e, 3 níveis de permissão e alerta de estoque mínimo',
    accentColor: 'text-indigo-600',
    iconBg: 'bg-indigo-50 border-indigo-200/80 text-indigo-600',
  },
  'MOD-03': {
    category: 'commercial',
    categoryLabel: 'Comercial & CRM',
    highlight: 'Ficha completa com validação de CPF/CNPJ, busca automática de CEP e histórico',
    accentColor: 'text-sky-600',
    iconBg: 'bg-sky-50 border-sky-200/80 text-sky-600',
  },
  'MOD-04': {
    category: 'commercial',
    categoryLabel: 'Propostas & Portal do Cliente',
    highlight: 'Envio por WhatsApp, PDF profissional e aprovação online com token seguro',
    accentColor: 'text-blue-600',
    iconBg: 'bg-blue-50 border-blue-200/80 text-blue-600',
  },
  'MOD-05': {
    category: 'finance',
    categoryLabel: 'Financeiro & Caixa',
    highlight: 'Turnos de caixa, sangrias, suprimentos e leitor automático de boletos em PDF',
    accentColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50 border-emerald-200/80 text-emerald-600',
  },
  'MOD-06': {
    category: 'finance',
    categoryLabel: 'Compras & Fornecedores',
    highlight: 'Gestão de fornecedores, CNPJ, contatos comerciais e notas vinculadas',
    accentColor: 'text-teal-600',
    iconBg: 'bg-teal-50 border-teal-200/80 text-teal-600',
  },
  'MOD-07': {
    category: 'management',
    categoryLabel: 'Governança & Equipe',
    highlight: 'Controle granular de acesso por funcionário, tema visual e central LGPD',
    accentColor: 'text-slate-700',
    iconBg: 'bg-slate-100 border-slate-300/80 text-slate-700',
  },
  'MOD-08': {
    category: 'management',
    categoryLabel: 'Inteligência & Relatórios',
    highlight: 'Demonstrativos de faturamento, fechamentos e Curva ABC prontos para impressão A4',
    accentColor: 'text-blue-700',
    iconBg: 'bg-blue-50 border-blue-200/80 text-blue-700',
  },
  'MOD-09': {
    category: 'services',
    categoryLabel: 'Catálogo de Serviços',
    highlight: 'Composição de mão de obra, materiais aplicados, categorias e margem de lucro',
    accentColor: 'text-cyan-600',
    iconBg: 'bg-cyan-50 border-cyan-200/80 text-cyan-600',
  },
  'MOD-10': {
    category: 'services',
    categoryLabel: 'Assistência Técnica & O.S.',
    highlight: 'Fotos do equipamento, avarias, senha de desbloqueio, garantia e conversão em venda',
    accentColor: 'text-blue-600',
    iconBg: 'bg-blue-50 border-blue-200/80 text-blue-600',
  },
  'MOD-11': {
    category: 'management',
    categoryLabel: 'Implantação & Dados',
    highlight: 'Importação em lote de produtos, clientes e fornecedores via Excel e CSV',
    accentColor: 'text-indigo-600',
    iconBg: 'bg-indigo-50 border-indigo-200/80 text-indigo-600',
  },
}

function getModuleIcon(code: string) {
  switch (code) {
    case 'MOD-01':
      return <ShoppingCart className="h-5 w-5" />
    case 'MOD-02':
      return <Package className="h-5 w-5" />
    case 'MOD-03':
      return <Users className="h-5 w-5" />
    case 'MOD-04':
      return <FileSpreadsheet className="h-5 w-5" />
    case 'MOD-05':
      return <Calculator className="h-5 w-5" />
    case 'MOD-06':
      return <Truck className="h-5 w-5" />
    case 'MOD-07':
      return <Building2 className="h-5 w-5" />
    case 'MOD-08':
      return <BarChart3 className="h-5 w-5" />
    case 'MOD-09':
      return <Wrench className="h-5 w-5" />
    case 'MOD-10':
      return <ClipboardList className="h-5 w-5" />
    case 'MOD-11':
      return <Database className="h-5 w-5" />
    default:
      return <Layers className="h-5 w-5" />
  }
}

export function PresentationPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [plans, setPlans] = useState<AccessPlan[]>(SYSTEM_DEFAULT_ACCESS_PLANS)
  const [activeShowcaseTab, setActiveShowcaseTab] = useState<
    'pdv' | 'os' | 'cash' | 'inventory' | 'reports'
  >('pdv')
  // Carrossel do PDV: 0 = captura da tela do PDV, 1 = painel de venda
  const [pdvSlide, setPdvSlide] = useState<0 | 1>(0)
  // Carrossel de O.S. & Orçamentos: 0 = captura da listagem de O.S., 1 = painel de O.S.
  const [osSlide, setOsSlide] = useState<0 | 1>(0)
  const [showComparisonTable, setShowComparisonTable] = useState(false)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

  // Modal de escolha de plano e cadastro com 1 mês grátis
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false)
  const [selectedPlanForSignup, setSelectedPlanForSignup] = useState<AccessPlan | null>(null)

  // Primeira troca em 4s; depois alterna a cada 3s
  const pdvSlideCycled = useRef(false)
  useEffect(() => {
    if (activeShowcaseTab !== 'pdv') {
      pdvSlideCycled.current = false
      setPdvSlide(0)
      return
    }
    const delay = pdvSlideCycled.current ? 3000 : 4000
    const timer = window.setTimeout(() => {
      pdvSlideCycled.current = true
      setPdvSlide((current) => (current === 0 ? 1 : 0))
    }, delay)
    return () => window.clearTimeout(timer)
  }, [activeShowcaseTab, pdvSlide])

  // Rotação automática das abas do showcase: a cada 8 segundos avança para a próxima
  // (PDV → O.S. → Caixa → Estoque → Relatórios → PDV). O clique manual reinicia o tempo.
  useEffect(() => {
    const order = ['pdv', 'os', 'cash', 'inventory', 'reports'] as const
    const timer = window.setTimeout(() => {
      const index = order.indexOf(activeShowcaseTab)
      setActiveShowcaseTab(order[(index + 1) % order.length])
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [activeShowcaseTab])

  // Carrossel de O.S.: alterna de 5 em 5 segundos
  useEffect(() => {
    if (activeShowcaseTab !== 'os') {
      setOsSlide(0)
      return
    }
    const timer = window.setInterval(() => {
      setOsSlide((current) => (current === 0 ? 1 : 0))
    }, 5000)
    return () => window.clearInterval(timer)
  }, [activeShowcaseTab])

  useEffect(() => {
    document.documentElement.classList.remove('dark')
    document.documentElement.removeAttribute('data-theme')

    // Registra estatística de acesso da visita pública ao site
    void siteAccessTrackerService.trackCurrentVisit(window.location.pathname)

    let isMounted = true
    void accessPlanService.listPublic().then((loadedPlans) => {
      if (isMounted && loadedPlans.length > 0) {
        setPlans(loadedPlans)
      }
    })

    const unsubscribe = accessPlanService.subscribeToPlansUpdates((freshPlans) => {
      if (isMounted && freshPlans.length > 0) {
        setPlans(freshPlans)
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  // Se acessar /register ou ?signup=1 ou #planos, posiciona ou abre o modal automaticamente
  useEffect(() => {
    const planParam = searchParams.get('plan')
    const signupParam = searchParams.get('signup')

    if (planParam) {
      const found = plans.find(
        (p) => p.id === planParam || p.name.toLowerCase().includes(planParam.toLowerCase()),
      )
      if (found && found.isActive && !found.isLocked) {
        setSelectedPlanForSignup(found)
        setIsSignupModalOpen(true)
        return
      }
    }

    if (location.pathname === '/register' || signupParam === '1') {
      const recommended =
        plans.find((p) => p.isActive && !p.isLocked && p.name.toLowerCase().includes('completo')) ||
        plans.find((p) => p.isActive && !p.isLocked) ||
        null
      setSelectedPlanForSignup(recommended)
      setIsSignupModalOpen(true)
    } else if (location.pathname === '/planos' || location.hash === '#planos') {
      const el = document.getElementById('planos')
      el?.scrollIntoView({ behavior: 'smooth' })
    } else if (location.pathname === '/modulos' || location.hash === '#modulos') {
      const el = document.getElementById('planos')
      el?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [location.pathname, location.hash, searchParams, plans])

  const [detailsPlan, setDetailsPlan] = useState<AccessPlan | null>(null)
  const [pinnedModulesPlanId, setPinnedModulesPlanId] = useState<string | null>(null)

  const handleChoosePlan = (plan?: AccessPlan) => {
    if (plan?.id) {
      navigate(`/cadastrar-empresa?plano=${plan.id}`)
    } else {
      navigate('/cadastrar-empresa')
    }
  }

  const faqItems = [
    {
      question: 'Como funciona o período de 1 mês de teste grátis ao escolher um plano?',
      answer:
        'Ao escolher qualquer um dos planos ativos na plataforma e concluir seu cadastro aprovando os Termos de Uso e a Política de Privacidade, sua empresa recebe imediatamente 1 mês (30 dias corridos) de acesso 100% gratuito a todos os módulos incluídos naquele plano. Nenhuma cobrança é exigida no primeiro mês.',
    },
    {
      question:
        'O que acontece no próximo mês após terminar o período gratuito de 1 mês?',
      answer:
        'Encerrado o 1º mês gratuito, inicia-se o ciclo mensal normal do plano escolhido. Para continuar utilizando o sistema no próximo mês, você deve efetuar o pagamento da mensalidade (via PIX com QR Code ou Boleto Bancário) até a data de vencimento diretamente em Configurações → Faturas do Sistema.',
    },
    {
      question: 'Posso controlar quais módulos cada funcionário da minha empresa pode acessar?',
      answer:
        'Sim! Dentro dos módulos liberados pelo seu plano, o Administrador da empresa conta com o módulo de Organização (MOD-07), podendo conceder ou restringir o acesso de cada colaborador módulo por módulo e sub-função por sub-função, além de definir 3 níveis de permissão no Estoque.',
    },
    {
      question: 'Posso alterar de plano futuramente conforme minha empresa crescer?',
      answer:
        'Com certeza. Você pode iniciar no Plano Básico ou Básico + PDV e migrar para o Plano Completo a qualquer momento, liberando instantaneamente Orçamentos com Portal do Cliente, Catálogo de Serviços, Ordens de Serviço (O.S.) e Relatórios Avançados.',
    },
  ]

  // Rolagem suave automática para a seção indicada em qualquer link interno (#modulos, #planos, #faq...)
  const handleInternalAnchorClick = (event: ReactMouseEvent<HTMLElement>) => {
    const anchor = (event.target as HTMLElement).closest('a')
    const href = anchor?.getAttribute('href')
    if (!anchor || !href || !href.startsWith('#') || href.length < 2) return
    const target = document.getElementById(href.slice(1))
    if (!target) return
    event.preventDefault()
    const headerOffset = 64
    const top = target.getBoundingClientRect().top + window.scrollY - headerOffset
    window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' })
    window.history.replaceState(null, '', href)
  }

  return (
    <div
      onClick={handleInternalAnchorClick}
      className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-blue-600 selection:text-white"
    >
      {/* ===================================================================== */}
      {/* BARRA DE NAVEGAÇÃO FLUTUANTE (ESTILO MODERNO SAAS)                     */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0F172A] shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link to="/apresentacao" className="flex items-center gap-2.5">
              <BrandLogo size="sm" dark />
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-xs font-semibold text-slate-300">
              <a
                href="#visao-geral"
                className="rounded-lg px-3 py-2 transition-colors hover:bg-slate-800 hover:text-white"
              >
                Visão Geral
              </a>
              <a
                href="#planos"
                className="rounded-lg px-3 py-2 transition-colors hover:bg-slate-800 hover:text-white"
              >
                Planos Cadastrados
              </a>
              <a
                href="#seguranca-lgpd"
                className="rounded-lg px-3 py-2 transition-colors hover:bg-slate-800 hover:text-white"
              >
                Segurança & LGPD
              </a>
              <a
                href="#faq"
                className="rounded-lg px-3 py-2 transition-colors hover:bg-slate-800 hover:text-white"
              >
                Dúvidas
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-blue-600/30 transition-all cursor-pointer"
              >
                <span>Acesso ao Sistema</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-blue-600/30 transition-all cursor-pointer"
              >
                <LogIn className="h-4 w-4 text-white" />
                <span>Acesso ao Sistema</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* HERO SECTION + SHOWCASE INTERATIVO DA PLATAFORMA                       */}
      {/* ===================================================================== */}
      <section id="visao-geral" className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-24">
        {/* Efeitos sutis de iluminação com a paleta azul/esmeralda do ControleSoft */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl"
        >
          <div className="mx-auto aspect-[1155/678] w-[72rem] bg-gradient-to-tr from-blue-600/15 via-sky-400/10 to-emerald-400/15 opacity-80" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Topo centralizado inspirado na clareza e precisão de produto */}
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-6 flex justify-center">
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute -inset-4 rounded-full bg-gradient-to-tr from-blue-500/20 via-sky-400/15 to-emerald-400/25 blur-2xl"
                />
                <img
                  src="/controlesoft-logo-full.jpg"
                  alt="ControleSoft"
                  className="relative h-36 w-36 sm:h-44 sm:w-44 rounded-3xl object-cover bg-[#FAF9F6] shadow-xl shadow-blue-900/10 ring-1 ring-slate-200/80"
                />
              </div>
            </div>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl leading-[1.12]">
              Toda a gestão da sua empresa,{' '}
              <span className="bg-gradient-to-r from-[#2563EB] via-blue-700 to-sky-600 bg-clip-text text-transparent">
                conectada em um só lugar.
              </span>
            </h1>

            <p className="mt-5 text-base sm:text-lg leading-relaxed text-slate-600">
              Substitua planilhas e sistemas fragmentados por uma plataforma única com{' '}
              <strong className="font-semibold text-slate-800">
                Vendas, PDV, Estoque, Orçamentos Online, Ordem de Serviço e Gestão de Caixa
              </strong>
              . Escolha seu plano, utilize o{' '}
              <strong className="font-semibold text-emerald-700">1º mês grátis</strong> e continue
              nos meses seguintes com total transparência.
            </p>

            {/* Botões de Ação */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <a
                href="#como-funciona"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-2xl bg-[#2563EB] px-7 py-4 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Escolher Plano com 1 Mês Grátis</span>
                <ArrowRight className="h-4 w-4" />
              </a>

              <a
                href="#planos"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-4 text-sm font-bold text-slate-700 shadow-xs transition-all hover:border-blue-300 hover:text-blue-600"
              >
                <Layers className="h-4 w-4 text-blue-600" />
                <span>Ver Planos Cadastrados</span>
              </a>
            </div>

            {/* Selos de Confiança e Diferenciais */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-xs font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                30 dias grátis no 1º mês
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-700">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-black">
                  <X className="h-2.5 w-2.5 stroke-[3.5]" />
                </span>
                Sem taxa de implantação
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-700">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-black">
                  <X className="h-2.5 w-2.5 stroke-[3.5]" />
                </span>
                Sem taxa de cancelamento
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-700">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-black">
                  <X className="h-2.5 w-2.5 stroke-[3.5]" />
                </span>
                Sem contrato de Fidelidade
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                11 módulos integrados
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                Termos e LGPD transparentes
              </span>
            </div>
          </div>

          {/* ================================================================= */}
          {/* INTERACTIVE PRODUCT WORKSPACE SHOWCASE                            */}
          {/* ================================================================= */}
          <div className="mt-12 sm:mt-14">
            {/* Abas seletoras de visualização interativa */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
              {[
                {
                  id: 'pdv' as const,
                  label: 'Frente de Caixa & PDV',
                  code: 'MOD-01',
                  icon: <ShoppingCart className="h-3.5 w-3.5" />,
                },
                {
                  id: 'os' as const,
                  label: 'Ordem de Serviço & Orçamentos',
                  code: 'MOD-04 / MOD-10',
                  icon: <ClipboardList className="h-3.5 w-3.5" />,
                },
                {
                  id: 'cash' as const,
                  label: 'Caixa & Boletos em PDF',
                  code: 'MOD-05',
                  icon: <Calculator className="h-3.5 w-3.5" />,
                },
                {
                  id: 'inventory' as const,
                  label: 'Estoque & Importação XML',
                  code: 'MOD-02',
                  icon: <Package className="h-3.5 w-3.5" />,
                },
                {
                  id: 'reports' as const,
                  label: 'Relatórios & Equipe',
                  code: 'MOD-07 / MOD-08',
                  icon: <BarChart3 className="h-3.5 w-3.5" />,
                },
              ].map((tab) => {
                const isActive = activeShowcaseTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveShowcaseTab(tab.id)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#0F172A] text-white shadow-md shadow-slate-900/15'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    <span className={isActive ? 'text-blue-400' : 'text-blue-600'}>{tab.icon}</span>
                    <span>{tab.label}</span>
                    <span
                      className={`hidden sm:inline-block rounded px-1.5 py-0.5 text-[10px] font-mono ${
                        isActive ? 'bg-white/15 text-blue-200' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {tab.code}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Moldura do Sistema ControleSoft */}
            <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl shadow-blue-950/10">
              {/* Barra de título da janela */}
              <div className="flex items-center justify-between border-b border-slate-800 bg-[#0F172A] px-4 py-3 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 font-semibold text-white">
                    ControleSoft — Ambiente Operacional Multi-Módulos
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-400/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Caixa Aberto • Sincronizado em Nuvem
                  </span>
                </div>
              </div>

              {/* Conteúdo dinâmico do Showcase */}
              <div className="p-5 sm:p-8 bg-gradient-to-b from-slate-50/70 to-white">
                {activeShowcaseTab === 'pdv' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-5 space-y-4">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200">
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Módulo MOD-01 • Vendas & Frente de Caixa PDV
                      </span>
                      <h3 className="text-2xl font-bold text-slate-900">
                        Frente de Caixa PDV ultrarrápido e Venda Direta em segundos
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Atenda no balcão sem filas com leitura de código de barras, busca instantânea
                        por código ou descrição, múltiplos meios de pagamento (PIX, Dinheiro,
                        Cartão), cálculo automático de troco e emissão de comprovante térmico ou A4.
                      </p>
                      <ul className="space-y-2 text-xs font-semibold text-slate-700">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>MOD-01_PDV: Terminal PDV tela cheia com atalhos e alerta sonoro</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>MOD-01_QUICK_SALE: Emissão rápida de pedidos com baixa automática no estoque</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>MOD-01_SEARCH: Histórico detalhado de vendas com filtros por período e cliente</span>
                        </li>
                      </ul>
                    </div>

                    <div className="w-full lg:col-span-7 grid">
                    <div
                      aria-hidden={pdvSlide !== 0}
                      className={`col-start-1 row-start-1 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-opacity duration-700 ${
                        pdvSlide === 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
                      }`}
                    >
                      <img
                        src="/showcase-pdv-venda.jpg"
                        alt="Tela do PDV ControleSoft com carrinho de compras e finalização de venda"
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div
                      aria-hidden={pdvSlide !== 1}
                      className={`col-start-1 row-start-1 rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-sm space-y-3 sm:space-y-4 overflow-hidden transition-opacity duration-700 ${
                        pdvSlide === 1 ? 'opacity-100' : 'opacity-0 pointer-events-none'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-[10px] sm:text-[11px] font-bold uppercase text-blue-600">
                            Terminal PDV #01 • Operador Ativo
                          </span>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                            Cupom de Venda #2026-0842
                          </h4>
                        </div>
                        <span className="self-start sm:self-auto rounded-lg bg-emerald-50 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold text-emerald-700 border border-emerald-200">
                          F2 Finalizar Venda
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        {[
                          { code: 'PRD-0014', name: 'Kit Revisão Sintético 5W30 + Filtro', qty: '1 UN', total: 'R$ 249,90' },
                          { code: 'PRD-0089', name: 'Pastilha de Freio Cerâmica Dianteira', qty: '1 JG', total: 'R$ 185,00' },
                          { code: 'SRV-0012', name: 'Mão de Obra Substituição e Alinhamento', qty: '1 SV', total: 'R$ 120,00' },
                        ].map((item) => (
                          <div
                            key={item.code}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 rounded-xl bg-slate-50 px-3 sm:px-3.5 py-2 sm:py-2.5 border border-slate-200/70"
                          >
                            <div className="min-w-0">
                              <span className="font-mono text-[10px] font-bold text-blue-600 mr-1.5 sm:mr-2">
                                {item.code}
                              </span>
                              <span className="font-semibold text-slate-800 break-words">{item.name}</span>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 text-right">
                              <span className="text-slate-500 text-[11px] sm:text-xs">{item.qty}</span>
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">{item.total}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 pt-1 sm:pt-2">
                        <div className="rounded-xl bg-slate-50 p-2.5 sm:p-3 border border-slate-200 flex sm:flex-col justify-between items-center sm:items-start">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Subtotal
                          </span>
                          <span className="text-sm sm:text-base font-bold text-slate-800">R$ 554,90</span>
                        </div>
                        <div className="rounded-xl bg-emerald-50 p-2.5 sm:p-3 border border-emerald-200 flex sm:flex-col justify-between items-center sm:items-start">
                          <span className="text-[10px] font-bold uppercase text-emerald-700 block">
                            Pagamento
                          </span>
                          <span className="text-sm sm:text-base font-bold text-emerald-800">PIX Instantâneo</span>
                        </div>
                        <div className="rounded-xl bg-blue-600 p-2.5 sm:p-3 text-white flex sm:flex-col justify-between items-center sm:items-start">
                          <span className="text-[10px] font-bold uppercase text-blue-200 block">
                            Total Líquido
                          </span>
                          <span className="text-sm sm:text-base font-black">R$ 554,90</span>
                        </div>
                      </div>
                    </div>
                    </div>
                  </div>
                )}

                {activeShowcaseTab === 'os' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-5 space-y-4">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200">
                        <ClipboardList className="h-3.5 w-3.5" />
                        Módulos MOD-04, MOD-09 & MOD-10
                      </span>
                      <h3 className="text-2xl font-bold text-slate-900">
                        Ordens de Serviço completas e Orçamentos com aprovação online
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Registre a entrada de equipamentos com fotos de vistoria, avarias, senha do
                        aparelho e diagnóstico técnico. Envie o link do Portal de Orçamentos no
                        WhatsApp para o cliente aprovar com validação de CPF e converta em O.S. ou
                        venda com 1 clique.
                      </p>
                      <ul className="space-y-2 text-xs font-semibold text-slate-700">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>Portal do Cliente com Token único para aprovar ou recusar propostas</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>Catálogo de equipamentos, checklist de avarias, fotos e termos de garantia</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>Integração direta: Orçamento Aprovado → Ordem de Serviço → Fechamento de Caixa</span>
                        </li>
                      </ul>
                    </div>

                    <div className="w-full lg:col-span-7 grid">
                      <div
                        aria-hidden={osSlide !== 0}
                        className={`col-start-1 row-start-1 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-opacity duration-700 ${
                          osSlide === 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                      >
                        <img
                          src="/showcase-os-lista.jpg"
                          alt="Painel de Ordens de Serviço (O.S.) do ControleSoft com indicadores e listagem de status"
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div
                        aria-hidden={osSlide !== 1}
                        className={`col-start-1 row-start-1 rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-sm space-y-3 sm:space-y-4 overflow-hidden transition-opacity duration-700 ${
                          osSlide === 1 ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div>
                            <span className="text-[10px] sm:text-[11px] font-bold uppercase text-blue-600">
                              Ordem de Serviço #OS-2026-0194
                            </span>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                              Equipamento: Notebook Dell Inspiron 15 • Cliente: Mariana Costa
                            </h4>
                          </div>
                          <span className="self-start sm:self-auto rounded-full bg-emerald-100 px-3 py-1 text-[11px] sm:text-xs font-bold text-emerald-800">
                            ✓ Aprovado no Portal pelo Cliente
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
                            <span className="text-[10px] font-bold uppercase text-slate-400">
                              Vistoria & Diagnóstico Técnico
                            </span>
                            <p className="font-semibold text-slate-800">
                              Substituição de SSD NVMe 1TB + Limpeza Térmica e Restauração de Sistema
                            </p>
                            <span className="inline-block text-[11px] text-blue-600 font-medium">
                              3 fotos anexadas na vistoria • Garantia de 90 dias
                            </span>
                          </div>
                          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-1">
                            <span className="text-[10px] font-bold uppercase text-blue-700">
                              Rastreabilidade da Aprovação
                            </span>
                            <p className="font-semibold text-slate-800">
                              Proposta #ORC-0412 validada via CPF no Portal Seguro
                            </p>
                            <span className="inline-block text-[11px] text-emerald-700 font-semibold">
                              Peças + Mão de Obra: R$ 680,00
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeShowcaseTab === 'cash' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-5 space-y-4">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                        <Calculator className="h-3.5 w-3.5" />
                        Módulo MOD-05 • Gerenciamento do Caixa & Boletos
                      </span>
                      <h3 className="text-2xl font-bold text-slate-900">
                        Controle absoluto do caixa e leitor inteligente de boletos em PDF
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Acompanhe abertura e fechamento de caixa por operador, sangrias, suprimentos,
                        transferências para conta e importe arquivos PDF de boletos bancários com
                        extração automática de valor, vencimento e código de barras.
                      </p>
                      <ul className="space-y-2 text-xs font-semibold text-slate-700">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>MOD-05_SESSION: Abertura, conferência cega e fechamento de turno</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>MOD-05_MOVEMENTS: Sangrias, suprimentos e comprovantes anexados</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>MOD-05_BILLS: Alertas automáticos de boletos a vencer e leitura de PDF</span>
                        </li>
                      </ul>
                    </div>

                    <div className="w-full lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-sm space-y-3 sm:space-y-4 overflow-hidden">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 sm:p-3.5 flex sm:flex-col justify-between items-center sm:items-start">
                          <span className="text-[10px] font-bold uppercase text-emerald-700 block">
                            Entradas do Dia
                          </span>
                          <span className="text-base sm:text-lg font-black text-emerald-800">R$ 4.820,00</span>
                        </div>
                        <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 sm:p-3.5 flex sm:flex-col justify-between items-center sm:items-start">
                          <span className="text-[10px] font-bold uppercase text-rose-700 block">
                            Saídas / Boletos Pagos
                          </span>
                          <span className="text-base sm:text-lg font-black text-rose-800">R$ 1.150,00</span>
                        </div>
                        <div className="rounded-xl bg-blue-50 border border-blue-200 p-2.5 sm:p-3.5 flex sm:flex-col justify-between items-center sm:items-start">
                          <span className="text-[10px] font-bold uppercase text-blue-700 block">
                            Saldo em Caixa
                          </span>
                          <span className="text-base sm:text-lg font-black text-blue-900">R$ 3.670,00</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                        <div>
                          <span className="font-bold text-amber-950 block text-[11px] sm:text-xs">
                            Leitor Inteligente de Boletos PDF Ativo
                          </span>
                          <span className="text-amber-800 text-[10px] sm:text-xs">
                            Distribuidora Nacional Ltda • Vencimento extraído automaticamente
                          </span>
                        </div>
                        <span className="self-start sm:self-auto rounded-lg bg-amber-600 px-2.5 py-1 text-[10px] sm:text-[11px] font-bold text-white shrink-0">
                          Dar Baixa no Caixa
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {activeShowcaseTab === 'inventory' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-5 space-y-4">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 border border-indigo-200">
                        <Package className="h-3.5 w-3.5" />
                        Módulos MOD-02 & MOD-06 • Estoque & Fornecedores
                      </span>
                      <h3 className="text-2xl font-bold text-slate-900">
                        Estoque inteligente com importação de NF-e e cálculo de margem
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Alimente seu estoque automaticamente importando o XML ou PDF da nota fiscal
                        do fornecedor, defina preço mínimo de venda, acompanhe histórico de entradas
                        e saídas e proteja seus custos com 3 níveis de acesso por colaborador.
                      </p>
                      <ul className="space-y-2 text-xs font-semibold text-slate-700">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-indigo-600 shrink-0" />
                          <span>MOD-02_IMPORT_NFE: Entrada de mercadorias via XML de Nota Fiscal</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-indigo-600 shrink-0" />
                          <span>Níveis 1, 2 e 3 de acesso ao estoque para vendedores e estoquistas</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-indigo-600 shrink-0" />
                          <span>Consolidação inteligente de itens e rastreabilidade completa de lotes</span>
                        </li>
                      </ul>
                    </div>

                    <div className="w-full lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-sm space-y-3 text-xs overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">
                          Posição de Estoque & Margem Comercial
                        </span>
                        <span className="self-start sm:self-auto rounded-lg bg-indigo-50 px-2.5 py-1 text-[10px] sm:text-[11px] font-bold text-indigo-700">
                          Importar XML NF-e
                        </span>
                      </div>
                      {[
                        { sku: 'EST-101', item: 'Bateria Automotiva 60Ah Selada', stock: '18 un', status: 'Estoque Ideal', color: 'text-emerald-700 bg-emerald-50' },
                        { sku: 'EST-204', item: 'Óleo Motor 5W30 100% Sintético 1L', stock: '42 un', status: 'Alto Giro (Curva A)', color: 'text-blue-700 bg-blue-50' },
                        { sku: 'EST-309', item: 'Filtro de Cabine Carvão Ativado', stock: '3 un', status: 'Reposição Recomendada', color: 'text-amber-700 bg-amber-50' },
                      ].map((row) => (
                        <div
                          key={row.sku}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 sm:px-3.5 py-2 sm:py-2.5"
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-[10px] font-bold text-indigo-600 mr-1.5 sm:mr-2">
                              {row.sku}
                            </span>
                            <span className="font-semibold text-slate-800 break-words">{row.item}</span>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 shrink-0">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">{row.stock}</span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${row.color}`}>
                              {row.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeShowcaseTab === 'reports' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-5 space-y-4">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200">
                        <BarChart3 className="h-3.5 w-3.5" />
                        Módulos MOD-07, MOD-08 & MOD-11
                      </span>
                      <h3 className="text-2xl font-bold text-slate-900">
                        Relatórios gerenciais, Curva ABC e gestão granular de equipe
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Extraia relatórios financeiros de vendas, fechamento de caixa e valorização
                        de estoque formatados para impressão A4, personalize a cor do sistema com a
                        identidade da sua marca e gerencie as permissões de cada funcionário.
                      </p>
                      <ul className="space-y-2 text-xs font-semibold text-slate-700">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>MOD-08: Relatórios de faturamento, lucro estimado e Curva ABC de estoque</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>MOD-07: Controle de acesso por módulo para cada membro da equipe</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>MOD-11: Migração rápida de dados via planilhas Excel e CSV</span>
                        </li>
                      </ul>
                    </div>

                    <div className="w-full lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-sm space-y-3 sm:space-y-4 text-xs overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">
                          Demonstrativo Gerencial & Permissões de Equipe
                        </span>
                        <span className="self-start sm:self-auto rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] sm:text-[11px] font-bold text-blue-700">
                          Exportar / Imprimir A4
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                        <div className="rounded-xl border border-slate-200 p-2.5 sm:p-3 flex sm:flex-col justify-between items-center sm:items-start">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Ticket Médio
                          </span>
                          <span className="text-sm sm:text-base font-black text-slate-900">R$ 312,40</span>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-2.5 sm:p-3 flex sm:flex-col justify-between items-center sm:items-start">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Conversão de Orçamentos
                          </span>
                          <span className="text-sm sm:text-base font-black text-emerald-700">78,5%</span>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-2.5 sm:p-3 flex sm:flex-col justify-between items-center sm:items-start">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Colaboradores Ativos
                          </span>
                          <span className="text-sm sm:text-base font-black text-blue-700">Permissões Granulares</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* COMO FUNCIONA O TESTE GRÁTIS DE 1 MÊS E A REGRA DO PRÓXIMO MÊS         */}
      {/* ===================================================================== */}
      <section id="como-funciona" className="py-20 bg-[#0F172A] text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
              <Clock className="h-3.5 w-3.5" />
              Regras Claras de Avaliação & Assinatura
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
              1º Mês Grátis para testar. Transparência total no próximo mês.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
              Entenda exatamente como funciona sua jornada desde o cadastro gratuito até a renovação
              mensal e as regras de controle de acesso regidas pelos nossos Termos de Uso.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-6">
            {/* Etapa 1 */}
            <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7 backdrop-blur-xs">
              <div className="flex items-center justify-between mb-5">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                  <CheckCircle2 className="h-6 w-6" />
                </span>
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-extrabold text-emerald-300">
                  Mês 1 • R$ 0,00
                </span>
              </div>
              <h3 className="text-lg font-bold text-white">
                1. Escolha seu Plano com 1 Mês de Teste Grátis
              </h3>
              <p className="mt-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                Ao selecionar o plano desejado e aprovar as Políticas de Privacidade e os Termos de
                Uso no cadastro, sua empresa recebe <strong>30 dias de acesso gratuito</strong> a
                todos os módulos daquele plano.
              </p>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-emerald-300 font-semibold">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Isenção total de mensalidade nos primeiros 30 dias</span>
              </div>
            </div>

            {/* Etapa 2 */}
            <div className="relative rounded-3xl border border-blue-400/30 bg-blue-600/10 p-6 sm:p-7 backdrop-blur-xs">
              <div className="flex items-center justify-between mb-5">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-300">
                  <CreditCard className="h-6 w-6" />
                </span>
                <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-extrabold text-blue-300">
                  A partir do 2º Mês
                </span>
              </div>
              <h3 className="text-lg font-bold text-white">
                2. No Próximo Mês, Pague para Continuar Utilizando
              </h3>
              <p className="mt-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                Após o período gratuito de 1 mês, vence a primeira mensalidade do plano escolhido.
                Para continuar utilizando a plataforma normalmente, basta quitar a fatura mensal via{' '}
                <strong>PIX ou Boleto Bancário</strong> diretamente pelo painel.
              </p>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-blue-300 font-semibold">
                <QrCode className="h-4 w-4 shrink-0" />
                <span>Avisos automáticos 3 dias antes do vencimento</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* PLANOS CADASTRADOS NA PLATAFORMA (#planos)                             */}
      {/* ===================================================================== */}
      <section id="planos" className="py-20 sm:py-24">
        <div className="mx-auto max-w-[100rem] px-4 sm:px-6 lg:px-8 xl:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-blue-700 border border-blue-200">
              <Zap className="h-3.5 w-3.5 text-blue-600" />
              Planos Cadastrados no Sistema
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Escolha o plano ideal para o momento da sua empresa
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Todos os planos disponíveis contam com a opção de{' '}
              <strong className="text-emerald-700">1 mês de teste grátis (R$ 0,00 no 1º mês)</strong>
              . Você só começa a pagar no próximo mês se decidir continuar utilizando.
            </p>
          </div>

          {/* Grid de Cards dos Planos Cadastrados - Os 5 um ao lado do outro */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-4.5 items-stretch">
            {plans.map((plan, index) => {
              const isPopular =
                plan.isActive &&
                !plan.isLocked &&
                plan.name.toLowerCase().includes('completo') &&
                !plan.name.toLowerCase().includes('com emissão')
              const isAvailable = plan.isActive && !plan.isLocked
              const price = plan.monthlyPrice ?? 149.9
              const codeSet = new Set(plan.modules)
              const includedModulesList = ALL_PLATFORM_DASHBOARD_MODULES.filter(
                (m) => codeSet.has(m.code) || m.subFeatures.some((s) => codeSet.has(s.code)),
              )
              const isModulesOpen = pinnedModulesPlanId === plan.id

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col justify-between rounded-3xl p-6 transition-all duration-200 ${
                    isModulesOpen ? 'z-30' : 'z-10'
                  } ${
                    isPopular
                      ? 'border-2 border-[#2563EB] bg-white shadow-xl shadow-blue-600/10 ring-4 ring-blue-600/5'
                      : isAvailable
                        ? 'border border-slate-200/90 bg-white shadow-sm hover:border-blue-300 hover:shadow-md'
                        : 'border border-dashed border-slate-300 bg-slate-50/80 opacity-90'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#2563EB] px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-sm whitespace-nowrap">
                      ★ Mais Escolhido pelas Empresas
                    </div>
                  )}

                  <div>
                    {/* Cabeçalho do Plano */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                          isAvailable
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {isAvailable ? (
                          <>
                            <Clock className="h-3 w-3" />
                            1º Mês Grátis
                          </>
                        ) : (
                          'Em Desenvolvimento'
                        )}
                      </span>

                      <span className="text-[11px] font-semibold text-slate-400">
                        {includedModulesList.length} de {ALL_PLATFORM_DASHBOARD_MODULES.length} módulos
                      </span>
                    </div>

                    <h3 className="mt-4 text-lg font-extrabold text-slate-900 leading-snug">
                      {plan.name}
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-500 leading-relaxed min-h-[36px]">
                      {plan.description}
                    </p>

                    {/* Bloco de Preço: 1º Mês Grátis + Valor do Próximo Mês */}
                    <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-emerald-600">R$ 0,00</span>
                        <span className="text-xs font-bold text-emerald-700">no 1º mês</span>
                      </div>
                      <div className="mt-1.5 pt-1.5 border-t border-slate-200/70 flex items-baseline justify-between text-xs">
                        <span className="text-slate-500 font-medium">Próximo mês:</span>
                        <div>
                          <span className="text-base font-extrabold text-slate-900">
                            {formatCurrency(price.toFixed(2))}
                          </span>
                          <span className="text-[11px] text-slate-500">/mês</span>
                        </div>
                      </div>
                    </div>

                    {/* Módulos Liberados neste Plano - Gatilho e Popover flutuante ao passar o mouse */}
                    <div className="relative mt-4">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">
                        Módulos Liberados neste Plano:
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPinnedModulesPlanId(pinnedModulesPlanId === plan.id ? null : plan.id)
                        }}
                        className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all cursor-pointer border text-left ${
                          isModulesOpen
                            ? 'bg-blue-100/90 border-blue-400 text-blue-900 shadow-xs ring-2 ring-blue-500/20'
                            : 'bg-blue-50/70 hover:bg-blue-100/70 border-blue-200/80 hover:border-blue-300 text-blue-900'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>{includedModulesList.length} Módulos Inclusos</span>
                        </div>
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600 bg-white/95 px-2 py-0.5 rounded-md border border-blue-200 shadow-2xs">
                          {isModulesOpen ? 'Ocultar' : 'Ver lista'}
                          <ChevronDown
                            className={`h-3 w-3 transition-transform duration-200 ${
                              isModulesOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </span>
                      </button>

                      {/* Popover Flutuante com a Lista Completa de Módulos */}
                      <div
                        className={`absolute top-full mt-2 z-50 w-72 sm:w-80 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xl transition-all duration-200 ${
                          index === 0
                            ? 'left-0'
                            : index === plans.length - 1
                              ? 'right-0'
                              : 'left-1/2 -translate-x-1/2'
                        } ${
                          isModulesOpen
                            ? 'opacity-100 visible scale-100 pointer-events-auto'
                            : 'opacity-0 invisible scale-95 pointer-events-none'
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 block">
                              Módulos Liberados
                            </span>
                            <h4 className="text-sm font-extrabold text-slate-900 leading-tight">
                              {plan.name}
                            </h4>
                          </div>
                          <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            {includedModulesList.length} de {ALL_PLATFORM_DASHBOARD_MODULES.length}
                          </span>
                        </div>

                        <div className="my-2.5 max-h-60 overflow-y-auto pr-1">
                          <ul className="space-y-2 text-xs">
                            {includedModulesList.map((mod) => {
                              const hasPdv = codeSet.has('MOD-01_PDV')
                              const hasInvoices = codeSet.has('MOD-01_INVOICES')
                              return (
                                <li key={mod.code} className="flex items-start gap-2 text-slate-700">
                                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-semibold text-slate-900">{mod.name}</span>
                                    {mod.code === 'MOD-01' && (
                                      <span className="block text-[11px] text-slate-500">
                                        {hasPdv
                                          ? hasInvoices
                                            ? 'Inclui Venda Rápida, PDV e NF-e/NFC-e'
                                            : 'Inclui Venda Rápida e Terminal PDV'
                                          : 'Venda Rápida e Consulta (sem PDV)'}
                                      </span>
                                    )}
                                  </div>
                                </li>
                              )
                            })}

                            {/* Suporte / Dúvidas garantido em todos os planos */}
                            <li className="flex items-start gap-2 text-slate-700">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold text-slate-900">Suporte / Dúvidas</span>
                                <span className="block text-[11px] text-emerald-700 font-medium">
                                  Atendimento humanizado via WhatsApp e central de ajuda inclusos
                                </span>
                              </div>
                            </li>
                          </ul>
                        </div>

                        <div className="pt-2.5 border-t border-slate-100 flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailsPlan(plan)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                          >
                            <span>Saber mais sobre as funções deste plano</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                          {isAvailable ? (
                            <button
                              type="button"
                              onClick={() => handleChoosePlan(plan)}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 px-3 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
                            >
                              <span>Escolher Plano</span>
                              <Zap className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <a
                              href="https://wa.me/5531986848490?text=Ol%C3%A1%21%20Gostaria%20de%20saber%20sobre%20a%20disponibilidade%20do%20Plano%20Completo%20com%20NF-e."
                              target="_blank"
                              rel="noreferrer"
                              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span>Consultar Previsão</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Botão de Escolha do Plano e Link de Saber Mais (Espaçamento reduzido) */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailsPlan(plan)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                    >
                      <span>Saber mais sobre as funções deste plano</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>

                    {isAvailable ? (
                      <button
                        type="button"
                        onClick={() => handleChoosePlan(plan)}
                        className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                          isPopular
                            ? 'bg-[#2563EB] text-white shadow-md shadow-blue-600/25 hover:bg-blue-700'
                            : 'bg-slate-900 text-white hover:bg-[#2563EB]'
                        }`}
                      >
                        <span>Escolher Plano</span>
                        <Zap className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <a
                        href="https://wa.me/5531986848490?text=Ol%C3%A1%21%20Gostaria%20de%20saber%20sobre%20a%20disponibilidade%20do%20Plano%20Completo%20com%20NF-e."
                        target="_blank"
                        rel="noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Consultar Previsão no WhatsApp</span>
                      </a>
                    )}
                    <p className="text-[10px] text-center text-slate-400">
                      Sem cobrança no 1º mês • Ativação rápida via WhatsApp
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ================================================================= */}
          {/* TABELA COMPARATIVA COMPLETA DE MÓDULOS POR PLANO                  */}
          {/* ================================================================= */}
          <div className="mt-14">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Comparativo Detalhado de Módulos e Recursos por Plano
                </h3>
                <p className="text-xs text-slate-500">
                  Confira exatamente quais módulos (`MOD-01` a `MOD-11`) estão habilitados em cada
                  plano cadastrado.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowComparisonTable(!showComparisonTable)}
                className="text-xs"
              >
                {showComparisonTable ? 'Ocultar Tabela Comparativa' : 'Ver Tabela Comparativa'}
              </Button>
            </div>

            {showComparisonTable && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <tr>
                      <th className="py-4 px-5 font-bold min-w-[220px]">
                        Módulo / Funcionalidade do Sistema
                      </th>
                      {plans.map((p) => (
                        <th key={p.id} className="py-4 px-4 text-center font-bold min-w-[150px]">
                          <span className="block text-slate-900">{p.name}</span>
                          <span className="mt-0.5 inline-block text-[10px] font-semibold text-emerald-700">
                            1º Mês Grátis • {formatCurrency((p.monthlyPrice ?? 149.9).toFixed(2))}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ALL_PLATFORM_DASHBOARD_MODULES.map((mod) => (
                      <tr key={mod.code} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                              {mod.code}
                            </span>
                            <span className="font-bold text-slate-900">{mod.name}</span>
                          </div>
                          <span className="block text-[11px] text-slate-500 mt-0.5">
                            {mod.description}
                          </span>
                        </td>
                        {plans.map((plan) => {
                          const set = new Set(plan.modules)
                          const hasMod =
                            set.has(mod.code) || mod.subFeatures.some((s) => set.has(s.code))
                          const activeSubs = mod.subFeatures.filter((s) => set.has(s.code)).length
                          return (
                            <td key={plan.id} className="py-3.5 px-4 text-center">
                              {hasMod ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                  {mod.code === 'MOD-01' && (
                                    <span className="mt-1 text-[10px] font-semibold text-slate-500">
                                      {set.has('MOD-01_PDV')
                                        ? set.has('MOD-01_INVOICES')
                                          ? 'Completo + NF-e'
                                          : 'Com PDV'
                                        : 'Venda Rápida'}
                                    </span>
                                  )}
                                  {mod.code !== 'MOD-01' && activeSubs > 0 && (
                                    <span className="mt-1 text-[10px] text-slate-400">
                                      {activeSubs}/{mod.subFeatures.length} funções
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 font-bold">—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SEGURANÇA, CRIPTOGRAFIA & CONFORMIDADE LGPD                           */}
      {/* ===================================================================== */}
      <section id="seguranca-lgpd" className="py-16 sm:py-20 bg-gradient-to-b from-white via-slate-50 to-white border-t border-slate-200/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3.5 py-1 text-xs font-bold text-blue-700">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              Segurança Máxima & Proteção de Dados
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Criptografia de Ponta a Ponta e 100% em Conformidade com a LGPD
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
              O ControleSoft foi projetado desde a sua arquitetura base para garantir a total proteção,
              confidencialidade e integridade dos dados da sua empresa e dos seus clientes, em estrita
              conformidade com a <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018)</strong>.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">Criptografia em Trânsito e em Repouso</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Toda comunicação com nossos servidores é criptografada utilizando o protocolo <strong>TLS 1.3 / SSL de 256 bits</strong>.
                Bancos de dados e backups contam com cifragem de alto padrão criptográfico.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Scale className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">Conformidade Total com a LGPD</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Adequação integral à <strong>Lei nº 13.709/2018 (LGPD)</strong>. Respeito irrestrito aos direitos dos titulares,
                tratamento legítimo e seguro de dados pessoais e política de privacidade transparente.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                <Database className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">Isolamento de Dados Multitenant</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Garantia arquitetural de isolamento absoluto por empresa via <strong>Row-Level Security (RLS)</strong> a nível de banco de dados.
                Nenhuma organização acessa informações de outra.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">Consentimento e Auditoria</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Registro auditável de termos de uso e consentimento com carimbo de data, hora e IP,
                além de trilha de auditoria para operações críticas e fiscais.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs font-semibold text-slate-600">
            <Link
              to="/politica-de-privacidade?tab=privacy"
              className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline"
            >
              <FileText className="h-4 w-4" />
              Consultar nossa Política de Privacidade Completa
            </Link>
            <span className="hidden sm:inline text-slate-300">•</span>
            <Link
              to="/politica-de-privacidade?tab=terms"
              className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline"
            >
              <FileText className="h-4 w-4" />
              Termos de Uso e Condições Gerais
            </Link>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* FAQ E POLÍTICAS DE USO / LGPD (#faq)                                  */}
      {/* ===================================================================== */}
      <section id="faq" className="py-20 bg-white border-t border-slate-200/80">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-blue-700 border border-blue-200">
              <Scale className="h-3.5 w-3.5" />
              Dúvidas Frequentes & Termos de Uso
            </span>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-900">
              Perguntas sobre Planos, Teste Grátis e Regras de Acesso
            </h2>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, idx) => {
              const isOpen = openFaqIndex === idx
              return (
                <div
                  key={item.question}
                  className="rounded-2xl border border-slate-200 bg-[#F8FAFC]/60 overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left text-sm font-bold text-slate-900 hover:text-blue-600 cursor-pointer"
                  >
                    <span>{item.question}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                        isOpen ? 'rotate-180 text-blue-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200/60">
                      {item.answer}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ===================================================================== */}
          {/* ATENDIMENTO VIA WHATSAPP                                              */}
          {/* ===================================================================== */}
          <div className="mt-14 pt-10 border-t border-slate-200">
            <div className="flex flex-col items-center justify-center text-center max-w-xl mx-auto">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200">
                <MessageCircle className="h-3.5 w-3.5" />
                Atendimento via WhatsApp
              </span>

              <h3 className="mt-3 text-2xl font-extrabold text-slate-900">
                Ainda ficou com alguma dúvida?
              </h3>

              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md">
                Tire suas dúvidas sobre planos, implantação gratuita, migração de dados ou solicite uma demonstração com nossa equipe em tempo real.
              </p>

              <div className="mt-5">
                <a
                  href="https://wa.me/5531986848490?text=Ol%C3%A1!%20Gostaria%20de%20tirar%20algumas%20d%C3%BAvidas%20sobre%20o%20ControleSoft."
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Chamar no WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* RODAPÉ INSTITUCIONAL                                                   */}
      {/* ===================================================================== */}
      <footer className="border-t border-slate-200 bg-slate-900 py-12 text-xs text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <BrandLogo dark size="sm" />
            <span className="text-slate-500">
              © 2026 ControleSoft / JB Gestão. Todos os direitos reservados.
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5">
            <Link to="/login" className="hover:text-white transition-colors">
              Acessar Conta
            </Link>
            <button
              type="button"
              onClick={() => handleChoosePlan()}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Planos & Teste Grátis
            </button>
            <Link
              to="/politica-de-privacidade?tab=terms"
              className="hover:text-white transition-colors"
            >
              Termos de Uso (v2.0)
            </Link>
            <Link to="/politica-de-privacidade" className="hover:text-white transition-colors">
              Política de Privacidade (LGPD)
            </Link>
            <a
              href="https://wa.me/5531986848490"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:underline font-semibold"
            >
              Suporte WhatsApp
            </a>
          </div>
        </div>
      </footer>

      {/* Modal: Mais informações do plano (módulos liberados e o que cada um faz) */}
      {detailsPlan &&
        (() => {
          const codeSet = new Set(detailsPlan.modules)
          const planModules = ALL_PLATFORM_DASHBOARD_MODULES.map((mod) => {
            const selectedSubs = mod.subFeatures.filter((s) => codeSet.has(s.code))
            const hasModule = codeSet.has(mod.code)
            if (selectedSubs.length === 0 && !hasModule) return null
            return {
              mod,
              subs: selectedSubs.length > 0 ? selectedSubs : mod.subFeatures,
            }
          }).filter((item): item is NonNullable<typeof item> => item !== null)

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
              onClick={() => setDetailsPlan(null)}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="plan-details-title"
                onClick={(event) => event.stopPropagation()}
                className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl"
              >
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-6">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                      Mais informações do plano
                    </span>
                    <h3 id="plan-details-title" className="mt-1 text-xl font-extrabold text-slate-900">
                      {detailsPlan.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      {planModules.length} {planModules.length === 1 ? 'módulo disponível' : 'módulos disponíveis'} para
                      utilização, com as funções de cada um.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailsPlan(null)}
                    aria-label="Fechar"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {planModules.map(({ mod, subs }) => {
                      const meta = MODULE_METADATA[mod.code] ?? {
                        category: 'management',
                        categoryLabel: 'Gestão',
                        highlight: mod.description,
                        accentColor: 'text-blue-600',
                        iconBg: 'bg-blue-50 border-blue-200 text-blue-600',
                      }
                      return (
                        <article
                          key={mod.code}
                          className="rounded-2xl border border-slate-200/90 bg-[#F8FAFC]/60 p-5"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.iconBg}`}
                            >
                              {getModuleIcon(mod.code)}
                            </div>
                            <div>
                              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                                {meta.categoryLabel}
                              </span>
                              <h4 className="text-base font-bold text-slate-900">{mod.name}</h4>
                              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                                {meta.highlight}
                              </p>
                            </div>
                          </div>
                          <ul className="mt-3 space-y-1.5 border-t border-slate-200/80 pt-3">
                            {subs.map((sub) => (
                              <li key={sub.code} className="flex items-start gap-2 text-xs text-slate-700">
                                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                                <div>
                                  <span className="font-semibold text-slate-800">{sub.name}</span>
                                  <span className="block text-[11px] leading-tight text-slate-500">
                                    {sub.description}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </article>
                      )
                    })}

                    {/* Bloco fixo de Suporte e Dúvidas garantido em todos os planos */}
                    <article className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-emerald-700">
                          <MessageCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                            Atendimento Garantido
                          </span>
                          <h4 className="text-base font-bold text-slate-900">Suporte / Dúvidas</h4>
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                            Atendimento humanizado direto com especialistas para você e sua equipe nunca ficarem com dúvidas.
                          </p>
                        </div>
                      </div>
                      <ul className="mt-3 space-y-1.5 border-t border-emerald-200/80 pt-3">
                        <li className="flex items-start gap-2 text-xs text-slate-700">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          <div>
                            <span className="font-semibold text-slate-800">Atendimento via WhatsApp</span>
                            <span className="block text-[11px] leading-tight text-slate-500">
                              Canal direto em tempo real para orientações e suporte rápido.
                            </span>
                          </div>
                        </li>
                        <li className="flex items-start gap-2 text-xs text-slate-700">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          <div>
                            <span className="font-semibold text-slate-800">Central de Ajuda & Chamados</span>
                            <span className="block text-[11px] leading-tight text-slate-500">
                              Abertura de dúvidas e acompanhamento diretamente pelo painel do sistema.
                            </span>
                          </div>
                        </li>
                      </ul>
                    </article>
                  </div>
                </div>

                <footer className="flex flex-col gap-2 border-t border-slate-200 p-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setDetailsPlan(null)}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDetailsPlan(null)
                      handleChoosePlan(detailsPlan)
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>Escolher Plano</span>
                  </button>
                </footer>
              </section>
            </div>
          )
        })()}

      {/* Modal de Adesão ao Plano com 1 Mês de Teste Grátis */}
      <PlanTrialSignupModal
        isOpen={isSignupModalOpen}
        onClose={() => setIsSignupModalOpen(false)}
        selectedPlan={selectedPlanForSignup}
        availablePlans={plans}
        onSelectPlan={(plan) => setSelectedPlanForSignup(plan)}
      />
    </div>
  )
}
