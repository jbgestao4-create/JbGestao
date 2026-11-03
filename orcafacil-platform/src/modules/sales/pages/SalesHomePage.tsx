import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { cashSessionService } from '@modules/cash/services/cash-session.service'
import type { CashSession } from '@modules/cash/domain/cash-session'
import {
  AlertTriangle,
  Barcode,
  ChevronRight,
  FileCheck2,
  FileText,
  Receipt,
  Search,
  ShoppingCart,
  Store,
  X,
  Zap,
} from 'lucide-react'

export function SalesHomePage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { currentOrganization } = useOrganization()

  const [activeSession, setActiveSession] = useState<CashSession | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [openingBalance, setOpeningBalance] = useState('0,00')
  const [openError, setOpenError] = useState<string | null>(null)
  const [isOpening, setIsOpening] = useState(false)

  useEffect(() => {
    if (!currentOrganization) return
    let active = true

    setIsLoadingSession(true)
    cashSessionService.getOpenSession(currentOrganization.id, 'Caixa 01').then((res) => {
      if (!active) return
      if (res.success) {
        setActiveSession(res.data)
      }
      setIsLoadingSession(false)
    })

    return () => {
      active = false
    }
  }, [currentOrganization])

  const handleAccessPdv = async () => {
    if (!currentOrganization) return

    setIsLoadingSession(true)
    const res = await cashSessionService.getOpenSession(currentOrganization.id, 'Caixa 01')
    setIsLoadingSession(false)

    if (res.success && res.data) {
      // Caixa já aberto: entra direto no terminal
      void navigate('/orcafacil/sales/pdv')
    } else {
      // Caixa fechado: solicita abertura
      setShowOpenModal(true)
    }
  }

  const handleConfirmOpenSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrganization || !user) return

    setIsOpening(true)
    setOpenError(null)

    const opName = profile?.displayName || user.email?.split('@')[0] || 'Operador'
    const cleanBalance = openingBalance.replace(',', '.')

    const res = await cashSessionService.openSession(currentOrganization.id, {
      registerId: 'Caixa 01',
      operatorId: user.id,
      operatorName: opName,
      openingBalance: cleanBalance,
    })

    setIsOpening(false)

    if (res.success) {
      setShowOpenModal(false)
      void navigate('/orcafacil/sales/pdv')
    } else {
      setOpenError(res.error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Vendas &amp; Balcão</h1>
          <p className="mt-1 text-sm text-gray-500">
            Terminal de frente de caixa PDV para supermercado e balcão, pedidos faturados e notas fiscais (NF-e / NFC-e).
          </p>
        </div>
      </div>

      {/* ============================================================== */}
      {/* DESTAQUE PRINCIPAL: TERMINAL PONTO DE VENDA (PDV)               */}
      {/* ============================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 sm:p-8 text-white shadow-xl border border-slate-700/60">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                <Zap className="h-3.5 w-3.5 text-emerald-400" />
                TERMINAL DE FRENTE DE CAIXA RÁPIDO
              </span>
              {!isLoadingSession && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    activeSession
                      ? 'bg-emerald-900/60 text-emerald-300 ring-1 ring-emerald-500/40'
                      : 'bg-amber-900/60 text-amber-300 ring-1 ring-amber-500/40'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      activeSession ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  {activeSession
                    ? `Caixa Aberto (${activeSession.registerId} • ${activeSession.operatorName})`
                    : 'Caixa Fechado'}
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Ponto de Venda (PDV) — Supermercado
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-slate-300">
              Terminal em tela cheia (Full Screen) otimizado para operação por teclado e leitor de código de barras USB.
              Atendimento ágil de balcão com conferência de caixa, troco em tempo real e fechamento oficial (Tecla F12).
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              onClick={handleAccessPdv}
              className="h-14 px-8 text-base font-black uppercase tracking-wider rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-950/60 border border-emerald-400/30 flex items-center gap-3 transition-transform active:scale-[0.98]"
            >
              <Barcode className="h-6 w-6 text-emerald-200" />
              <span>PONTO DE VENDA (PDV)</span>
              <ChevronRight className="h-5 w-5 text-emerald-200" />
            </Button>
          </div>
        </div>

        {/* Efeito sutil de background */}
        <div className="absolute -right-12 -bottom-12 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* ============================================================== */}
      {/* CARDS SECUNDÁRIOS DE GESTÃO DE VENDAS                           */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* CARD 1: CONSULTAR VENDAS & FATURAMENTO */}
        <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex h-full flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                <Receipt className="h-6 w-6" aria-hidden="true" />
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-800">
                CONSULTA &amp; HISTÓRICO
              </span>
            </div>
            <h2 className="mt-4 text-base font-bold tracking-wide text-gray-900">
              CONSULTAR VENDAS
            </h2>
            <p className="mt-2 flex-1 text-xs leading-5 text-gray-600">
              Acompanhe vendas faturadas, cupons emitidos, formas de pagamento praticadas e histórico detalhado por cliente ou data.
            </p>
            <Button
              size="sm"
              onClick={() => {
                void navigate('/orcafacil/sales/search')
              }}
              className="mt-5 w-full justify-between rounded-xl bg-emerald-600 hover:bg-emerald-700"
            >
              <span className="inline-flex items-center gap-2">
                <Search className="h-4 w-4" aria-hidden="true" />
                Consultar Vendas
              </span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>

        {/* CARD 2: EMISSÃO DE NOTAS FISCAIS (NF-e / NFC-e) */}
        <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex h-full flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-xl bg-purple-50 p-3 text-purple-700">
                <FileText className="h-6 w-6" aria-hidden="true" />
              </div>
              <span className="rounded-full bg-purple-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-purple-800">
                CENTRAL FISCAL
              </span>
            </div>
            <h2 className="mt-4 text-base font-bold tracking-wide text-gray-900">
              NOTAS FISCAIS (NF-e / NFC-e)
            </h2>
            <p className="mt-2 flex-1 text-xs leading-5 text-gray-600">
              Emissão eletrônica de Cupom Fiscal do Consumidor (NFC-e) e Nota Fiscal Eletrônica (NF-e) com autorização SEFAZ, DANFE e chave de 44 dígitos.
            </p>
            <Button
              size="sm"
              onClick={() => {
                void navigate('/orcafacil/sales/invoices')
              }}
              className="mt-5 w-full justify-between rounded-xl bg-purple-600 hover:bg-purple-700"
            >
              <span className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4" aria-hidden="true" />
                Painel de Notas Fiscais
              </span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>

        {/* CARD 3: FATURAR ORÇAMENTOS APROVADOS */}
        <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex h-full flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-xl bg-amber-50 p-3 text-amber-700">
                <FileCheck2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-800">
                INTEGRAÇÃO
              </span>
            </div>
            <h2 className="mt-4 text-base font-bold tracking-wide text-gray-900">
              FATURAR ORÇAMENTOS
            </h2>
            <p className="mt-2 flex-1 text-xs leading-5 text-gray-600">
              Converta orçamentos já aprovados pelos clientes diretamente em vendas concluídas, com faturamento automático no caixa e baixa dos materiais.
            </p>
            <Button
              size="sm"
              onClick={() => {
                void navigate('/orcafacil/sales/search?tab=approved')
              }}
              className="mt-5 w-full justify-between rounded-xl bg-amber-600 hover:bg-amber-700"
            >
              <span className="inline-flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Faturar Orçamentos
              </span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================== */}
      {/* MODAL DE ABERTURA DE CAIXA RÁPIDA                               */}
      {/* ============================================================== */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Abertura de Caixa (PDV)</h3>
                  <p className="text-xs text-gray-500">Inicie uma sessão para operar o terminal</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmOpenSession} className="mt-4 space-y-4">
              {openError && (
                <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{openError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700">Terminal</label>
                <input
                  type="text"
                  readOnly
                  value="Caixa 01"
                  className="mt-1 w-full rounded-xl bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Operador</label>
                <input
                  type="text"
                  readOnly
                  value={profile?.displayName || user?.email?.split('@')[0] || 'Operador'}
                  className="mt-1 w-full rounded-xl bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  Saldo Inicial / Fundo de Troco (R$)
                </label>
                <input
                  type="text"
                  autoFocus
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0,00"
                  className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-base font-bold font-mono text-emerald-600 border border-gray-300 focus:border-emerald-500 focus:outline-hidden"
                />
                <span className="text-[11px] text-gray-500">
                  Informe o valor das cédulas e moedas na gaveta ao iniciar o turno.
                </span>
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowOpenModal(false)}
                  className="flex-1 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isOpening}
                  className="flex-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  {isOpening ? 'Abrindo Caixa...' : 'Abrir Caixa e Entrar no PDV'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
