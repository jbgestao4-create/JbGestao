import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { useAuth } from '@modules/auth/context/AuthContext'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { useModuleAccess } from '@modules/access-control/context/ModuleAccessContext'
import { cashSessionService } from '@modules/cash/services/cash-session.service'
import type { CashRegister, CashSession } from '@modules/cash/domain/cash-session'
import { formatCurrencyInput, parseCurrencyInput } from '@shared/utils/monetary'
import { isSystemOwner } from '@shared/utils/system-owner'
import {
  AlertTriangle,
  Barcode,
  CheckCircle2,
  ChevronRight,
  FileText,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  X,
} from 'lucide-react'

export function SalesHomePage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { currentOrganization } = useOrganization()
  const { canAccessSubFeature } = useModuleAccess()
  const canManagePdvRegisters = isSystemOwner(user)

  const canAccessQuickSale = canAccessSubFeature('MOD-01_QUICK_SALE')
  const canAccessPdv = canAccessSubFeature('MOD-01_PDV')
  const canAccessSearchSales = canAccessSubFeature('MOD-01_SEARCH')
  const canAccessInvoices = canAccessSubFeature('MOD-01_INVOICES')

  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [selectedRegister, setSelectedRegister] = useState<string>('Caixa 01')
  const [openSessions, setOpenSessions] = useState<CashSession[]>([])

  // Modal de Abertura de Caixa
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [openingBalance, setOpeningBalance] = useState('0,00')
  const [openError, setOpenError] = useState<string | null>(null)
  const [isOpening, setIsOpening] = useState(false)
  const [isGeneralCashOpen, setIsGeneralCashOpen] = useState(true)

  // Modal de Cadastro / Gerenciamento de Caixas PDV
  const [showRegistersModal, setShowRegistersModal] = useState(false)
  const [newRegisterName, setNewRegisterName] = useState('')
  const [newRegisterDescription, setNewRegisterDescription] = useState('')
  const [registerModalError, setRegisterModalError] = useState<string | null>(null)
  const [registerModalSuccess, setRegisterModalSuccess] = useState<string | null>(null)
  const [isCreatingRegister, setIsCreatingRegister] = useState(false)

  const loadRegistersAndSession = useCallback(
    async (overrideRegisterName?: string) => {
      if (!currentOrganization) return

      const savedRegName =
        overrideRegisterName || cashSessionService.getSelectedRegisterName(currentOrganization.id)

      const [regRes, openListRes, generalRes] = await Promise.all([
        cashSessionService.listRegisters(currentOrganization.id),
        cashSessionService.listOpenPdvSessions(currentOrganization.id),
        cashSessionService.getOpenCashManagementSession(currentOrganization.id),
      ])

      const isGenOpen = Boolean(generalRes.success && generalRes.data)
      setIsGeneralCashOpen(isGenOpen)

      const regList = regRes.success ? regRes.data : []
      setRegisters(regList)

      const validRegName =
        regList.some((r) => r.name === savedRegName)
          ? savedRegName
          : regList[0]?.name || 'Caixa 01'

      setSelectedRegister(validRegName)
      cashSessionService.setSelectedRegisterName(currentOrganization.id, validRegName)

      if (openListRes.success) {
        setOpenSessions(openListRes.data)
      }
    },
    [currentOrganization],
  )

  useEffect(() => {
    void loadRegistersAndSession()
  }, [loadRegistersAndSession])

  const handleSelectRegister = async (registerName: string) => {
    if (!currentOrganization) return
    cashSessionService.setSelectedRegisterName(currentOrganization.id, registerName)
    setSelectedRegister(registerName)
    setOpenError(null)
    await loadRegistersAndSession(registerName)
  }

  const handleCreateRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManagePdvRegisters) return
    if (!currentOrganization) return

    setRegisterModalError(null)
    setRegisterModalSuccess(null)
    setIsCreatingRegister(true)

    const res = await cashSessionService.createRegister(currentOrganization.id, {
      name: newRegisterName,
      description: newRegisterDescription,
    })

    setIsCreatingRegister(false)

    if (res.success) {
      const createdName = res.data.name
      setNewRegisterName('')
      setNewRegisterDescription('')
      cashSessionService.setSelectedRegisterName(currentOrganization.id, createdName)
      setSelectedRegister(createdName)
      setRegisterModalSuccess(`Caixa "${createdName}" cadastrado e selecionado com sucesso!`)
      await loadRegistersAndSession(createdName)
    } else {
      setRegisterModalError(res.error)
    }
  }

  const handleDeleteRegister = async (reg: CashRegister) => {
    if (!currentOrganization) return
    setRegisterModalError(null)
    setRegisterModalSuccess(null)

    const res = await cashSessionService.deleteRegister(
      currentOrganization.id,
      reg.id,
      reg.name,
    )
    if (res.success) {
      const nextReg = cashSessionService.getSelectedRegisterName(currentOrganization.id)
      setRegisterModalSuccess(`Caixa "${reg.name}" removido.`)
      await loadRegistersAndSession(nextReg)
    } else {
      setRegisterModalError(res.error)
    }
  }

  const handleAccessPdv = async () => {
    if (!currentOrganization) return
    await loadRegistersAndSession()
    setOpenError(null)
    setShowOpenModal(true)
  }

  const handleConfirmOpenSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrganization || !user) return

    setIsOpening(true)
    setOpenError(null)

    const generalCheck = await cashSessionService.getOpenCashManagementSession(currentOrganization.id)
    if (!generalCheck.success || !generalCheck.data) {
      setIsOpening(false)
      setIsGeneralCashOpen(false)
      setOpenError('Caixa Geral ainda não aberto, procure o seu administrador')
      return
    }

    cashSessionService.setSelectedRegisterName(currentOrganization.id, selectedRegister)

    // Verifica se o mesmo usuário já possui outro caixa de PDV aberto (o Caixa Geral não bloqueia o PDV)
    const otherOpenByCurrentUser = openSessions.find(
      (s) =>
        s.sessionType === 'pdv' &&
        s.registerId !== 'Caixa Geral' &&
        s.openedBy === user.id &&
        s.registerId !== selectedRegister &&
        !(s.registerId === 'default-caixa-01' && selectedRegister === 'Caixa 01'),
    )
    if (otherOpenByCurrentUser) {
      setIsOpening(false)
      setOpenError(
        `Você já possui o "${otherOpenByCurrentUser.registerId}" aberto. Cada usuário só pode ter um caixa aberto por vez. Feche primeiro o "${otherOpenByCurrentUser.registerId}" para mudar de caixa.`,
      )
      return
    }

    // Verifica se o caixa selecionado já está aberto
    const existingOpen = openSessions.find((s) => s.registerId === selectedRegister)
    if (existingOpen) {
      if (existingOpen.openedBy !== user.id) {
        setIsOpening(false)
        setOpenError(
          `O ${selectedRegister} já consta aberto pelo usuário "${existingOpen.operatorName}". Você só poderá usar este caixa após o fechamento.`,
        )
        return
      }
      setIsOpening(false)
      setShowOpenModal(false)
      void navigate('/orcafacil/sales/pdv')
      return
    }

    const opName = profile?.displayName || user.email?.split('@')[0] || 'Operador'
    const cleanBalance = parseCurrencyInput(openingBalance)

    const res = await cashSessionService.openSession(currentOrganization.id, {
      registerId: selectedRegister,
      sessionType: 'pdv',
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
            Terminal de frente de caixa PDV, pedidos faturados e notas fiscais (NF-e / NFC-e).
          </p>
        </div>
      </div>

      {/* ============================================================== */}
      {/* CARDS PRINCIPAIS DE GESTÃO DE VENDAS                           */}
      {/* ============================================================== */}
      {!canAccessQuickSale && !canAccessPdv && !canAccessSearchSales && !canAccessInvoices ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="font-semibold text-sm">
            Nenhuma funcionalidade de Vendas está liberada para a sua empresa.
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-400 mt-1">
            Entre em contato com o suporte da JB Software para liberação de páginas e recursos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {/* CARD 1: VENDAS & PDV (NOVA VENDA & PDV) */}
          {(canAccessQuickSale || canAccessPdv) && (
            <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="flex h-full flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
                    <ShoppingCart className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-blue-800">
                    EMISSÃO &amp; BALCÃO
                  </span>
                </div>
                <h2 className="mt-4 text-base font-bold tracking-wide text-gray-900">
                  VENDAS &amp; PDV
                </h2>
                <p className="mt-2 flex-1 text-xs leading-5 text-gray-600">
                  {canAccessQuickSale && canAccessPdv
                    ? 'Inicie uma nova venda rápida com seleção de itens e pagamento, ou acesse o terminal de frente de caixa PDV em tela cheia.'
                    : canAccessQuickSale
                      ? 'Inicie uma nova venda rápida com seleção de itens, descontos e faturamento.'
                      : 'Acesse o terminal de frente de caixa PDV para vendas rápidas em balcão.'}
                </p>

                <div className="mt-5 flex flex-col gap-2">
                  {canAccessQuickSale && (
                    <Button
                      size="sm"
                      onClick={() => {
                        void navigate('/orcafacil/sales/new')
                      }}
                      className="w-full justify-between rounded-xl bg-blue-600 hover:bg-blue-700"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Nova Venda
                      </span>
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                  {canAccessPdv && (
                    <>
                      <Button
                        size="sm"
                        onClick={handleAccessPdv}
                        className="w-full justify-between rounded-xl bg-emerald-600 hover:bg-emerald-700"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Barcode className="h-4 w-4" aria-hidden="true" />
                          Ponto de Venda (PDV)
                        </span>
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      {canManagePdvRegisters && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRegisterModalError(null)
                            setRegisterModalSuccess(null)
                            setShowRegistersModal(true)
                          }}
                          className="w-full justify-between rounded-xl border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Store className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                            Cadastrar Caixa PDV
                          </span>
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* CARD 2: CONSULTAR VENDAS & FATURAMENTO */}
          {canAccessSearchSales && (
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
                <div className="mt-5 flex flex-col justify-end gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      void navigate('/orcafacil/sales/search')
                    }}
                    className="w-full justify-between rounded-xl bg-emerald-600 hover:bg-emerald-700"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Search className="h-4 w-4" aria-hidden="true" />
                      Consultar Vendas
                    </span>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* CARD 3: EMISSÃO DE NOTAS FISCAIS (NF-e / NFC-e) */}
          {canAccessInvoices && (
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
                <div className="mt-5 flex flex-col justify-end gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      void navigate('/orcafacil/sales/invoices')
                    }}
                    className="w-full justify-between rounded-xl bg-purple-600 hover:bg-purple-700"
                  >
                    <span className="inline-flex items-center gap-2">
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      Painel de Notas Fiscais
                    </span>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

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
              {(() => {
                const openForSelected = openSessions.find((s) => s.registerId === selectedRegister)
                const isOpenedByAnotherUser = Boolean(
                  openForSelected && user && openForSelected.openedBy !== user.id,
                )
                const isOpenedByCurrentUser = Boolean(
                  openForSelected && user && openForSelected.openedBy === user.id,
                )
                const otherOpenByCurrentUser = openSessions.find(
                  (s) =>
                    user &&
                    s.sessionType === 'pdv' &&
                    s.registerId !== 'Caixa Geral' &&
                    s.openedBy === user.id &&
                    s.registerId !== selectedRegister &&
                    !(s.registerId === 'default-caixa-01' && selectedRegister === 'Caixa 01'),
                )
                const hasAnotherOpenByCurrentUser = Boolean(otherOpenByCurrentUser)

                return (
                  <>
                    {!isGeneralCashOpen ? (
                      <div className="rounded-xl bg-amber-50 p-3.5 text-xs font-semibold text-amber-800 border border-amber-200 flex items-start gap-2.5">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                        <div>
                          <p className="font-bold text-sm text-amber-900">Abertura de PDV Bloqueada</p>
                          <p className="mt-0.5 text-amber-800">Caixa Geral ainda não aberto, procure o seu administrador</p>
                        </div>
                      </div>
                    ) : (openError || isOpenedByAnotherUser || hasAnotherOpenByCurrentUser) ? (
                      <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200 flex flex-col gap-2">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                          <span>
                            {openError ||
                              (isOpenedByAnotherUser
                                ? `O ${selectedRegister} já consta aberto pelo usuário "${openForSelected?.operatorName}". Você só poderá usar este caixa após o fechamento.`
                                : `Você já possui o "${otherOpenByCurrentUser?.registerId}" aberto. Cada usuário tem a obrigação de ter só um caixa aberto por vez. Caso queira mudar de caixa, feche primeiro o "${otherOpenByCurrentUser?.registerId}".`)}
                          </span>
                        </div>
                        {hasAnotherOpenByCurrentUser && otherOpenByCurrentUser && (
                          <button
                            type="button"
                            onClick={() => {
                              void handleSelectRegister(otherOpenByCurrentUser.registerId)
                            }}
                            className="self-start rounded-lg bg-rose-100 hover:bg-rose-200 px-2.5 py-1 text-[11px] font-bold text-rose-800 transition-colors cursor-pointer"
                          >
                            Selecionar {otherOpenByCurrentUser.registerId} (Aberto por você)
                          </button>
                        )}
                      </div>
                    ) : null}

                    {isOpenedByCurrentUser && (
                      <div className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 border border-emerald-200 flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                        <span>
                          Este caixa já está aberto em seu nome ({openForSelected?.operatorName}). Clique abaixo para retomar a operação.
                        </span>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-gray-700">
                        Terminal / Caixa PDV
                      </label>
                      <select
                        value={selectedRegister}
                        onChange={(e) => {
                          void handleSelectRegister(e.target.value)
                        }}
                        className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-800 border border-gray-300 focus:border-emerald-500 focus:outline-hidden"
                      >
                        {registers.map((reg) => {
                          const openForReg = openSessions.find((s) => s.registerId === reg.name)
                          return (
                            <option key={reg.id} value={reg.name}>
                              {reg.name}
                              {openForReg ? ` (Aberto • ${openForReg.operatorName})` : ' (Fechado)'}
                              {reg.description ? ` — ${reg.description}` : ''}
                            </option>
                          )
                        })}
                      </select>
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

                    {!isOpenedByCurrentUser && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-700">
                          Saldo Inicial / Fundo de Troco (R$)
                        </label>
                        <input
                          type="text"
                          autoFocus
                          disabled={isOpenedByAnotherUser || hasAnotherOpenByCurrentUser}
                          value={openingBalance}
                          onChange={(e) => setOpeningBalance(formatCurrencyInput(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          placeholder="0,00"
                          className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-base font-bold font-mono text-emerald-600 border border-gray-300 focus:border-emerald-500 focus:outline-hidden disabled:bg-gray-100 disabled:text-gray-400"
                        />
                        <span className="text-[11px] text-gray-500">
                          Informe o valor das cédulas e moedas na gaveta ao iniciar o turno.
                        </span>
                      </div>
                    )}

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
                        disabled={isOpening || !isGeneralCashOpen || isOpenedByAnotherUser || hasAnotherOpenByCurrentUser}
                        className="flex-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                      >
                        {isOpening
                          ? 'Abrindo Caixa...'
                          : isOpenedByCurrentUser
                            ? 'Retomar Caixa Aberto'
                            : 'Abrir Caixa e Entrar no PDV'}
                      </Button>
                    </div>
                  </>
                )
              })()}
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL DE CADASTRO E GERENCIAMENTO DE CAIXAS PDV                */}
      {/* ============================================================== */}
      {showRegistersModal && canManagePdvRegisters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-gray-100 dark:border-slate-800 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-2 text-emerald-600 dark:text-emerald-400">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Cadastro de Caixas PDV
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Cadastre os caixas da empresa e escolha qual caixa você irá operar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRegistersModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-5 overflow-y-auto pr-1">
              {registerModalError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{registerModalError}</span>
                </div>
              )}

              {registerModalSuccess && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{registerModalSuccess}</span>
                </div>
              )}

              {/* Formulário de Novo Caixa */}
              <form
                onSubmit={handleCreateRegister}
                className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/40 p-4 space-y-3"
              >
                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-slate-200">
                  Novo Caixa PDV
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-slate-300">
                      Nome / Identificação <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newRegisterName}
                      onChange={(e) => setNewRegisterName(e.target.value)}
                      placeholder="Ex.: Caixa 02, Balcão 01..."
                      className="mt-1 w-full rounded-xl bg-white dark:bg-slate-900 px-3 py-2 text-xs text-gray-800 dark:text-slate-100 border border-gray-300 dark:border-slate-700 focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-slate-300">
                      Descrição / Local (opcional)
                    </label>
                    <input
                      type="text"
                      value={newRegisterDescription}
                      onChange={(e) => setNewRegisterDescription(e.target.value)}
                      placeholder="Ex.: Frente de Loja, Rápido..."
                      className="mt-1 w-full rounded-xl bg-white dark:bg-slate-900 px-3 py-2 text-xs text-gray-800 dark:text-slate-100 border border-gray-300 dark:border-slate-700 focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isCreatingRegister}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {isCreatingRegister ? 'Cadastrando...' : 'Cadastrar Caixa'}
                  </Button>
                </div>
              </form>

              {/* Lista de Caixas Cadastrados */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-slate-300 mb-2.5">
                  Caixas PDV Cadastrados ({registers.length})
                </h4>
                <div className="space-y-2">
                  {registers.map((reg) => {
                    const openForReg = openSessions.find((s) => s.registerId === reg.name)

                    return (
                      <div
                        key={reg.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {reg.name}
                            </span>
                            {openForReg ? (
                              <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                                Aberto por {openForReg.operatorName}
                              </span>
                            ) : (
                              <span className="rounded-full bg-gray-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-slate-400">
                                Fechado
                              </span>
                            )}
                          </div>
                          {reg.description && (
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">
                              {reg.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {registers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                void handleDeleteRegister(reg)
                              }}
                              title="Excluir Caixa PDV"
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRegistersModal(false)}
                className="rounded-xl text-xs font-bold"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
