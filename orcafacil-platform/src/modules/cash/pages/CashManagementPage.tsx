import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useOrganization } from '@modules/organizations/context/OrganizationContext';
import { useAuth } from '@modules/auth/context/AuthContext';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { formatCurrency } from '@shared/utils/monetary';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  FileCheck,

  FileText,

  History,
  Lock,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Store,
  Trash2,
  TrendingDown,

  Unlock,
  Upload,
  Wrench,
} from 'lucide-react';

import type { CashRegister, CashSession, CashSessionMovement } from '../domain/cash-session';
import { cashSessionService } from '../services/cash-session.service';
import type { CashBill } from '../services/cash-bills.service';
import { cashBillsService } from '../services/cash-bills.service';
import { quoteService, type QuoteListItem } from '@modules/orcafacil/services/quote.service';
import { serviceOrderService, type ServiceOrderListItem } from '@modules/service-orders/services/service-order.service';


import { CashClosureModal } from '../components/CashClosureModal';
import { ManualMovementModal } from '../components/ManualMovementModal';
import { BoletoFormModal } from '../components/BoletoFormModal';
import { PayBillModal } from '../components/PayBillModal';

type ActiveTab = 'session' | 'bills' | 'integrations' | 'history';

export function CashManagementPage() {
  const { currentOrganization } = useOrganization();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state
  const currentTabParam = searchParams.get('tab') as ActiveTab | null;
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    currentTabParam && ['session', 'bills', 'integrations', 'history'].includes(currentTabParam)
      ? currentTabParam
      : 'session'
  );

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Cash Session State
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [sessionMovements, setSessionMovements] = useState<CashSessionMovement[]>([]);
  const [historySessions, setHistorySessions] = useState<CashSession[]>([]);
  const [, setIsLoadingSession] = useState<boolean>(true);

  // Modals state
  const [openModalOpen, setOpenModalOpen] = useState<boolean>(false);
  const [closureModalOpen, setClosureModalOpen] = useState<boolean>(false);
  const [movementModalOpen, setMovementModalOpen] = useState<boolean>(false);
  const [boletoModalOpen, setBoletoModalOpen] = useState<boolean>(false);
  const [payBillModalOpen, setPayBillModalOpen] = useState<boolean>(false);
  const [billToPay, setBillToPay] = useState<CashBill | null>(null);
  const [inspectHistorySession, setInspectHistorySession] = useState<CashSession | null>(null);

  // Open session form state
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>('');
  const [newRegisterName, setNewRegisterName] = useState<string>('');
  const [initialBalanceStr, setInitialBalanceStr] = useState<string>('0,00');
  const [isSubmittingSession, setIsSubmittingSession] = useState<boolean>(false);

  // Bills State
  const [bills, setBills] = useState<CashBill[]>([]);
  const [billsFilterCategory, setBillsFilterCategory] = useState<string>('all');
  const [billsFilterStatus, setBillsFilterStatus] = useState<string>('all');
  const [billsSearch, setBillsSearch] = useState<string>('');
  const [isLoadingBills, setIsLoadingBills] = useState<boolean>(false);
  const [upcomingAlertCount, setUpcomingAlertCount] = useState<number>(0);

  // Integrations State (Quotes and Service Orders)
  const [approvedQuotes, setApprovedQuotes] = useState<QuoteListItem[]>([]);
  const [readyOrders, setReadyOrders] = useState<ServiceOrderListItem[]>([]);
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState<boolean>(false);

  // Notification message
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 5000);
  };

  // Carrega a sessão ativa e os terminais
  const loadActiveSession = useCallback(async () => {
    if (!currentOrganization) return;
    setIsLoadingSession(true);

    try {
      const regRes = await cashSessionService.listRegisters(currentOrganization.id);
      if (regRes.success && regRes.data) {
        setRegisters(regRes.data);
        if (regRes.data.length > 0 && !selectedRegisterId) {
          setSelectedRegisterId(regRes.data[0].id);
        }
      }

      const session = await cashSessionService.findBestOpenSession(
        currentOrganization.id,
        user?.id
      );
      setActiveSession(session);

      if (session) {
        const movRes = await cashSessionService.listMovements(currentOrganization.id, session.id);
        if (movRes.success && movRes.data) {
          setSessionMovements(movRes.data);
        }
      } else {
        setSessionMovements([]);
      }
    } catch {
      // Ignora erro
    } finally {
      setIsLoadingSession(false);
    }
  }, [currentOrganization, user?.id, selectedRegisterId]);

  // Carrega histórico de caixas
  const loadHistory = useCallback(async () => {
    if (!currentOrganization) return;
    const res = await cashSessionService.listHistory(currentOrganization.id);
    if (res.success && res.data) {
      setHistorySessions(res.data);
    }
  }, [currentOrganization]);

  // Carrega boletos e contas
  const loadBills = useCallback(async () => {
    if (!currentOrganization) return;
    setIsLoadingBills(true);
    try {
      const res = await cashBillsService.listBills(currentOrganization.id);
      if (res.success && res.data) {
        setBills(res.data);
      }
      const alertRes = await cashBillsService.getUpcomingDueAlerts(currentOrganization.id);
      if (alertRes.success && alertRes.data) {
        setUpcomingAlertCount(alertRes.data.length);
      }
    } finally {
      setIsLoadingBills(false);
    }
  }, [currentOrganization]);

  // Carrega orçamentos aprovados e OS prontas
  const loadIntegrations = useCallback(async () => {
    if (!currentOrganization) return;
    setIsLoadingIntegrations(true);
    try {
      const quotesRes = await quoteService.listQuotes(currentOrganization.id);
      if (quotesRes.success && quotesRes.data) {
        setApprovedQuotes(quotesRes.data.filter((q) => q.status === 'approved'));
      }
      const osRes = await serviceOrderService.list(currentOrganization.id);
      if (osRes.success && osRes.data) {
        setReadyOrders(
          osRes.data.filter(
            (o) => o.status === 'ready' || o.status === 'closed'
          )
        );
      }
    } finally {
      setIsLoadingIntegrations(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    void loadActiveSession();
    void loadBills();
    void loadHistory();
    void loadIntegrations();
  }, [loadActiveSession, loadBills, loadHistory, loadIntegrations]);

  // Handler para Abertura de Caixa
  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user) return;
    setIsSubmittingSession(true);

    let regId = selectedRegisterId;
    let regName = registers.find((r) => r.id === regId)?.name || 'Caixa 01';

    // Cria novo terminal se fornecido
    if (!regId && newRegisterName.trim()) {
      const regRes = await cashSessionService.createRegister(
        currentOrganization.id,
        newRegisterName.trim()
      );
      if (regRes.success && regRes.data) {
        regId = regRes.data.id;
        regName = regRes.data.name;
      }
    }

    const cleanBalance =
      parseFloat(initialBalanceStr.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;

    const res = await cashSessionService.openSession(currentOrganization.id, {
      registerId: regId || 'reg-padrao-01',
      operatorId: user.id,
      openingBalance: cleanBalance,
      operatorName: profile?.displayName || user.email || 'Operador de Caixa',
      registerName: regName,
    });

    setIsSubmittingSession(false);

    if (res.success && res.data) {
      setActiveSession(res.data);
      setOpenModalOpen(false);
      showNotification('success', `Caixa aberto com sucesso no terminal ${regName}!`);
      void loadActiveSession();
      void loadHistory();
    } else {
      showNotification('error', (!res.success && res.error) || 'Erro ao abrir sessão de caixa.');
    }
  };

  // Handler para Fechamento de Caixa
  const handleConfirmClose = async (data: {
    countedMoney: number;
    countedPix: number;
    countedCreditCard: number;
    countedDebitCard: number;
    closureReason?: string;
  }) => {
    if (!currentOrganization || !activeSession || !user) return;
    setIsSubmittingSession(true);

    const res = await cashSessionService.closeSession(
      currentOrganization.id,
      activeSession.id,
      {
        operatorId: user.id,
        countedMoney: data.countedMoney,
        countedPix: data.countedPix,
        countedCreditCard: data.countedCreditCard,
        countedDebitCard: data.countedDebitCard,
        discrepancyJustification: data.closureReason,
      }
    );

    setIsSubmittingSession(false);

    if (res.success) {
      showNotification('success', 'Caixa fechado com sucesso!');
      await loadActiveSession();
      await loadHistory();
    } else {
      showNotification('error', res.error || 'Erro ao fechar caixa.');
    }
  };

  // Handler para Sangria / Suprimento
  const handleConfirmMovement = async (data: {
    type: 'supply' | 'bleed';
    amount: number;
    reason: string;
  }) => {
    if (!currentOrganization || !activeSession) return;
    setIsSubmittingSession(true);

    const res = await cashSessionService.recordMovement(
      currentOrganization.id,
      activeSession.id,
      {
        type: data.type,
        amount: data.amount,
        reason: data.reason,
      }
    );

    setIsSubmittingSession(false);

    if (res.success && res.data) {
      setActiveSession(res.data);
      showNotification(
        'success',
        `${data.type === 'supply' ? 'Suprimento' : 'Sangria'} de ${formatCurrency(
          data.amount
        )} lançada com sucesso!`
      );
      await loadActiveSession();
    } else {
      showNotification('error', (!res.success && res.error) || 'Erro ao registrar movimentação.');
    }
  };

  // Handler para Pagamento de Boleto / Baixa
  const handleConfirmPayBill = async (
    billId: string,
    params: {
      paymentMethod: 'money' | 'pix' | 'debit_card' | 'credit_card' | 'bank_transfer';
      paidAmount: number;
      notes?: string;
      deductFromOpenSession?: boolean;
    }
  ) => {
    if (!currentOrganization) return;
    const res = await cashBillsService.payBill(currentOrganization.id, billId, {
      paymentMethod: params.paymentMethod,
      paidAmount: params.paidAmount,
      notes: params.notes,
      openSessionId:
        params.deductFromOpenSession && activeSession ? activeSession.id : undefined,
    });

    if (res.success) {
      showNotification('success', 'Boleto/Conta baixada com sucesso!');
      void loadBills();
      void loadActiveSession();
    } else {
      showNotification('error', res.error || 'Erro ao dar baixa no boleto.');
    }
  };

  // Filtragem de Boletos
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      if (billsFilterCategory !== 'all' && b.category !== billsFilterCategory) return false;
      if (billsFilterStatus !== 'all') {
        if (billsFilterStatus === 'due_soon') {
          const diffDays = Math.ceil(
            (new Date(b.dueDate).getTime() - new Date().setHours(0, 0, 0, 0)) /
              (1000 * 60 * 60 * 24)
          );
          if (b.status !== 'pending' || diffDays > 10) return false;
        } else if (b.status !== billsFilterStatus) {
          return false;
        }
      }
      if (billsSearch.trim()) {
        const query = billsSearch.toLowerCase();
        const desc = b.description.toLowerCase();
        const ben = (b.beneficiaryName || '').toLowerCase();
        const code = (b.barcode || '').replace(/\s+/g, '');
        const sup = (b.supplierName || '').toLowerCase();
        if (
          !desc.includes(query) &&
          !ben.includes(query) &&
          !code.includes(query) &&
          !sup.includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [bills, billsFilterCategory, billsFilterStatus, billsSearch]);

  // Totais rápidos da sessão ativa
  const sessionExpectedMoney = activeSession
    ? parseFloat(activeSession.expectedMoney) || 0
    : 0;
  const sessionTotalMoneySales = activeSession
    ? parseFloat(activeSession.totalMoney) || 0
    : 0;
  const sessionTotalPix = activeSession
    ? parseFloat(activeSession.totalPix) || 0
    : 0;
  const sessionTotalCards = activeSession
    ? (parseFloat(activeSession.totalCreditCard) || 0) +
      (parseFloat(activeSession.totalDebitCard) || 0)
    : 0;
  const sessionTotalSupplies = activeSession
    ? parseFloat(activeSession.totalAdditionalEntries) || 0
    : 0;
  const sessionTotalBleeds = activeSession
    ? parseFloat(activeSession.totalWithdrawals) || 0
    : 0;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span className="text-sm font-semibold">{notification.text}</span>
        </div>
      )}

      {/* Header do Módulo de Gerenciamento de Caixa */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-600/10 p-3 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <DollarSign className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Gerenciamento de Caixa
                </h1>
                {activeSession ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Caixa Aberto ({activeSession.registerName || activeSession.registerId})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                    <Lock className="h-3 w-3" />
                    Caixa Fechado
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Abertura, fechamento cego, sangrias, suprimentos, integração com vendas/OS e leitor de boletos bancários.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeSession ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMovementModalOpen(true)}
                className="gap-2"
              >
                <TrendingDown className="h-4 w-4 text-amber-500" />
                Sangria / Suprimento
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setClosureModalOpen(true)}
                className="gap-2"
              >
                <Lock className="h-4 w-4" />
                Fechar Caixa
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => setOpenModalOpen(true)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Unlock className="h-4 w-4" />
              Abrir Caixa
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setBoletoModalOpen(true)}
            className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/40"
          >
            <Upload className="h-4 w-4 text-blue-600" />
            Importar Boleto (PDF)
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void loadActiveSession();
              void loadBills();
              void loadHistory();
              void loadIntegrations();
            }}
            title="Atualizar dados"
          >
            <RefreshCw className="h-4 w-4 text-zinc-500" />
          </Button>
        </div>
      </div>

      {/* Alerta de Boletos Críticos Pendentes (Vencendo em até 10 dias) */}
      {upcomingAlertCount > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-300 bg-amber-50/90 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-200/80 p-2 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Atenção: Você possui {upcomingAlertCount} conta(s) ou boleto(s) vencendo nos próximos 10 dias!
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Acesse a aba &quot;Contas a Pagar & Boletos&quot; para conferir e dar baixa com saída no caixa.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTabChange('bills')}
            className="border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/40"
          >
            Ver Boletos
          </Button>
        </div>
      )}

      {/* KPI Cards do Caixa */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        {/* Saldo Físico em Dinheiro */}
        <Card className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500">Saldo Físico (Dinheiro)</span>
              <div className="rounded-lg bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <Banknote className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(sessionExpectedMoney)}
            </p>
            <span className="text-[11px] text-zinc-400">
              {activeSession ? 'Aberto no terminal' : 'Caixa fechado'}
            </span>
          </CardContent>
        </Card>

        {/* Total PIX */}
        <Card className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500">PIX Total</span>
              <div className="rounded-lg bg-teal-100 p-1.5 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
                <QrCode className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(sessionTotalPix)}
            </p>
            <span className="text-[11px] text-zinc-400">Lançado via Vendas/OS</span>
          </CardContent>
        </Card>

        {/* Total Cartões */}
        <Card className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500">Cartões (C/D)</span>
              <div className="rounded-lg bg-purple-100 p-1.5 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(sessionTotalCards)}
            </p>
            <span className="text-[11px] text-zinc-400">Crédito + Débito</span>
          </CardContent>
        </Card>

        {/* Suprimentos */}
        <Card className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500">Suprimentos</span>
              <div className="rounded-lg bg-blue-100 p-1.5 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <ArrowDownRight className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(sessionTotalSupplies)}
            </p>
            <span className="text-[11px] text-zinc-400">Entradas manuais</span>
          </CardContent>
        </Card>

        {/* Sangrias */}
        <Card className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500">Sangrias</span>
              <div className="rounded-lg bg-rose-100 p-1.5 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(sessionTotalBleeds)}
            </p>
            <span className="text-[11px] text-zinc-400">Retiradas manuais</span>
          </CardContent>
        </Card>

        {/* Boletos Pendentes Próximos */}
        <Card className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500">Boletos 10 Dias</span>
              <div className="rounded-lg bg-amber-100 p-1.5 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {upcomingAlertCount} pendente(s)
            </p>
            <span className="text-[11px] text-amber-600 font-medium">Contas a pagar</span>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => handleTabChange('session')}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition ${
              activeTab === 'session'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
            }`}
          >
            <Store className="h-4 w-4" />
            Caixa Atual & Movimentações
          </button>

          <button
            onClick={() => handleTabChange('bills')}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition ${
              activeTab === 'bills'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
            }`}
          >
            <FileText className="h-4 w-4" />
            Contas a Pagar & Boletos (PDF)
            {upcomingAlertCount > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {upcomingAlertCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('integrations')}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition ${
              activeTab === 'integrations'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
            }`}
          >
            <CheckCircle className="h-4 w-4" />
            Integrações (Vendas, O.S. e Orçamentos)
            {approvedQuotes.length + readyOrders.length > 0 && (
              <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {approvedQuotes.length + readyOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('history')}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
            }`}
          >
            <History className="h-4 w-4" />
            Histórico de Caixas
          </button>
        </nav>
      </div>

      {/* ABA 1: Caixa Atual & Movimentações */}
      {activeTab === 'session' && (
        <div className="space-y-6">
          {activeSession ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Painel da Sessão Ativa */}
              <Card className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-1">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800">
                    <div>
                      <p className="text-xs text-zinc-400">Terminal</p>
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {activeSession.registerName || activeSession.registerId}
                      </h3>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      ABERTO
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Operador:</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {activeSession.operatorName || activeSession.operatorId}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Abertura:</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {new Date(activeSession.openedAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Saldo Inicial (Troco):</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {formatCurrency(parseFloat(activeSession.openingBalance) || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2 dark:border-zinc-800">
                      <span className="text-zinc-500">Vendas em Dinheiro:</span>
                      <span className="font-semibold text-emerald-600">
                        +{formatCurrency(sessionTotalMoneySales)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Suprimentos (Entradas):</span>
                      <span className="font-semibold text-blue-600">
                        +{formatCurrency(sessionTotalSupplies)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Sangrias / Saídas:</span>
                      <span className="font-semibold text-rose-600">
                        -{formatCurrency(sessionTotalBleeds)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-sm font-bold dark:border-zinc-800">
                      <span className="text-zinc-900 dark:text-zinc-100">Saldo em Gaveta:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(sessionExpectedMoney)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <Button
                      onClick={() => setMovementModalOpen(true)}
                      className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                      size="sm"
                    >
                      <Plus className="h-4 w-4" />
                      Lançar Sangria ou Suprimento
                    </Button>
                    <Button
                      onClick={() => setClosureModalOpen(true)}
                      variant="outline"
                      className="w-full gap-2 border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:hover:bg-rose-950/40"
                      size="sm"
                    >
                      <Lock className="h-4 w-4" />
                      Realizar Fechamento Cego
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Extrato Unificado de Movimentações da Sessão */}
              <Card className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      Extrato de Movimentações da Sessão
                    </h3>
                    <span className="text-xs text-zinc-400">
                      {sessionMovements.length} registro(s)
                    </span>
                  </div>

                  {sessionMovements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400">
                      <DollarSign className="h-10 w-10 stroke-1" />
                      <p className="mt-2 text-sm font-medium">Nenhuma movimentação manual na sessão atual.</p>
                      <p className="text-xs">
                        Suprimentos e sangrias manuais lançados neste caixa serão listados aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 font-semibold">
                          <tr>
                            <th className="p-3">Horário</th>
                            <th className="p-3">Tipo</th>
                            <th className="p-3">Justificativa</th>
                            <th className="p-3 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {sessionMovements.map((mov) => (
                            <tr key={mov.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                              <td className="p-3 whitespace-nowrap text-zinc-500">
                                {new Date(mov.createdAt).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${
                                    mov.type === 'supply'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                  }`}
                                >
                                  {mov.type === 'supply' ? (
                                    <ArrowDownRight className="h-3 w-3" />
                                  ) : (
                                    <ArrowUpRight className="h-3 w-3" />
                                  )}
                                  {mov.type === 'supply' ? 'Suprimento' : 'Sangria'}
                                </span>
                              </td>
                              <td className="p-3 text-zinc-700 dark:text-zinc-300">
                                {mov.reason}
                              </td>
                              <td
                                className={`p-3 text-right font-bold ${
                                  mov.type === 'supply' ? 'text-blue-600' : 'text-rose-600'
                                }`}
                              >
                                {mov.type === 'supply' ? '+' : '-'}
                                {formatCurrency(parseFloat(mov.amount) || 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center shadow-xs dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <Lock className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Nenhuma Sessão de Caixa Aberta no Momento
              </h3>
              <p className="mt-1 text-sm text-zinc-500 max-w-md mx-auto">
                Para registrar vendas, suprimentos, sangrias e baixas de boletos diretamente na gaveta de dinheiro, abra uma nova sessão de caixa.
              </p>
              <div className="mt-6 flex justify-center">
                <Button
                  onClick={() => setOpenModalOpen(true)}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Unlock className="h-4 w-4" />
                  Abrir Caixa Agora
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ABA 2: Contas a Pagar & Boletos (PDF Inteligente) */}
      {activeTab === 'bills' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar por descrição, beneficiário ou código de barras..."
                  value={billsSearch}
                  onChange={(e) => setBillsSearch(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 py-2 pl-9 pr-3 text-xs focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              {/* Filtro Categoria */}
              <select
                value={billsFilterCategory}
                onChange={(e) => setBillsFilterCategory(e.target.value)}
                className="rounded-xl border border-zinc-300 px-3 py-2 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="all">Todas Categorias</option>
                <option value="Água">Água</option>
                <option value="Luz">Luz / Energia</option>
                <option value="Internet">Internet / Telecom</option>
                <option value="Fornecedor">Fornecedores</option>
                <option value="Aluguel">Aluguel</option>
                <option value="Impostos">Impostos</option>
                <option value="Outros">Outros</option>
              </select>

              {/* Filtro Status */}
              <select
                value={billsFilterStatus}
                onChange={(e) => setBillsFilterStatus(e.target.value)}
                className="rounded-xl border border-zinc-300 px-3 py-2 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="all">Todos os Status</option>
                <option value="due_soon">⚠️ Vencendo em 10 dias (Pendente)</option>
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="cancelled">Cancelado / Arquivado</option>
              </select>
            </div>

            <Button
              onClick={() => setBoletoModalOpen(true)}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              <Upload className="h-4 w-4" />
              Importar / Cadastrar Boleto
            </Button>
          </div>

          <Card className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <CardContent className="p-0">
              {isLoadingBills ? (
                <div className="p-8 text-center text-sm text-zinc-500">Carregando boletos...</div>
              ) : filteredBills.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-center text-zinc-400">
                  <FileText className="h-10 w-10 stroke-1" />
                  <p className="mt-2 text-sm font-semibold">Nenhum boleto encontrado.</p>
                  <p className="text-xs">
                    Faça o upload do PDF do boleto bancário (Cemig, Sabesp, Copasa, internet, etc.) para extração automática.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="p-3.5">Descrição / Beneficiário</th>
                        <th className="p-3.5">Categoria</th>
                        <th className="p-3.5">Vencimento</th>
                        <th className="p-3.5 text-right">Valor</th>
                        <th className="p-3.5 text-center">Status</th>
                        <th className="p-3.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {filteredBills.map((b) => {
                        const dueDate = new Date(b.dueDate);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const diffDays = Math.ceil(
                          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                        );
                        const isDueSoon = b.status === 'pending' && diffDays >= 0 && diffDays <= 10;
                        const isOverdue = b.status === 'pending' && diffDays < 0;

                        return (
                          <tr
                            key={b.id}
                            className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                              isDueSoon
                                ? 'bg-amber-50/40 dark:bg-amber-950/20'
                                : isOverdue
                                ? 'bg-rose-50/40 dark:bg-rose-950/20'
                                : ''
                            }`}
                          >
                            <td className="p-3.5">
                              <p className="font-bold text-zinc-900 dark:text-zinc-100">{b.description}</p>
                              {b.beneficiaryName && (
                                <p className="text-[11px] text-zinc-500">Beneficiário: {b.beneficiaryName}</p>
                              )}
                              {b.barcode && (
                                <p className="font-mono text-[10px] text-zinc-400 truncate max-w-xs">
                                  {b.barcode}
                                </p>
                              )}
                            </td>
                            <td className="p-3.5">
                              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                {b.category || 'Outros'}
                              </span>
                            </td>
                            <td className="p-3.5">
                              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                                {dueDate.toLocaleDateString('pt-BR')}
                              </p>
                              {isOverdue && (
                                <span className="text-[10px] font-bold text-rose-600">
                                  Vencido há {Math.abs(diffDays)} dia(s)
                                </span>
                              )}
                              {isDueSoon && (
                                <span className="text-[10px] font-bold text-amber-600">
                                  {diffDays === 0 ? 'Vence HOJE!' : `Vence em ${diffDays} dia(s)`}
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-right font-bold text-zinc-900 dark:text-zinc-100">
                              {formatCurrency(parseFloat(b.amount) || 0)}
                            </td>
                            <td className="p-3.5 text-center">
                              {b.status === 'paid' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  <CheckCircle className="h-3 w-3" /> Pago
                                </span>
                              ) : b.status === 'cancelled' ? (
                                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                  Cancelado
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                    isDueSoon
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                      : isOverdue
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                  }`}
                                >
                                  <Clock className="h-3 w-3" /> Pendente
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-right space-x-2">
                              {b.attachmentDataUrl && (
                                <a
                                  href={b.attachmentDataUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                                >
                                  <Eye className="h-3.5 w-3.5" /> PDF
                                </a>
                              )}
                              {b.status === 'pending' && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setBillToPay(b);
                                    setPayBillModalOpen(true);
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-7 px-2.5"
                                >
                                  Pagar (Baixa)
                                </Button>
                              )}
                              {b.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    if (confirm('Deseja realmente remover/cancelar este boleto?')) {
                                      await cashBillsService.deleteBill(currentOrganization!.id, b.id);
                                      void loadBills();
                                    }
                                  }}
                                  className="text-zinc-400 hover:text-rose-600 h-7 w-7 p-0"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA 3: Integrações (Vendas, O.S. e Orçamentos) */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          {/* Card Informativo de Integração Automática */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
            <p className="font-semibold text-sm">Integração Automática com Caixa Ativo Ativada</p>
            <p className="mt-1">
              • Toda venda realizada no PDV ou Balcão já lança automaticamente a receita no caixa aberto correspondente.
              <br />• Orçamentos aprovados e Ordens de Serviço prontas podem ser convertidos e faturados diretamente com 1 clique abaixo.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Orçamentos Aprovados Prontos para Faturar */}
            <Card className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <CardContent className="p-5">
                <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      Orçamentos Aprovados
                    </h3>
                  </div>
                  <span className="text-xs text-zinc-400">
                    {approvedQuotes.length} aguardando faturamento
                  </span>
                </div>

                {isLoadingIntegrations ? (
                  <p className="py-6 text-center text-xs text-zinc-400">Carregando...</p>
                ) : approvedQuotes.length === 0 ? (
                  <p className="py-8 text-center text-xs text-zinc-400">
                    Nenhum orçamento com status &quot;Aprovado&quot; aguardando faturamento.
                  </p>
                ) : (
                  <div className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
                    {approvedQuotes.map((q) => (
                      <div key={q.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                            #{q.quoteNumber} • {(q as any).clientName ?? (q as any).customerName ?? "Cliente"}
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            Valor Total: <strong className="text-zinc-800 dark:text-zinc-200">{formatCurrency((q as any).totalAmount ?? q.total ?? 0)}</strong>
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => navigate(`/sales/new?quoteId=${q.id}`)}
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                        >
                          Faturar no Caixa
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ordens de Serviço Prontas */}
            <Card className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <CardContent className="p-5">
                <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-blue-600" />
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      Ordens de Serviço (O.S.)
                    </h3>
                  </div>
                  <span className="text-xs text-zinc-400">
                    {readyOrders.length} para recebimento
                  </span>
                </div>

                {isLoadingIntegrations ? (
                  <p className="py-6 text-center text-xs text-zinc-400">Carregando...</p>
                ) : readyOrders.length === 0 ? (
                  <p className="py-8 text-center text-xs text-zinc-400">
                    Nenhuma ordem de serviço pronta para recebimento no momento.
                  </p>
                ) : (
                  <div className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
                    {readyOrders.map((os) => (
                      <div key={os.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                            OS #{os.orderNumber} • {(os as any).clientName ?? os.customerName ?? 'Cliente'}
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            Status: <strong className="capitalize">{os.status}</strong> • Total:{' '}
                            <strong className="text-zinc-800 dark:text-zinc-200">
                              {formatCurrency((os as any).totalAmount ?? (os as any).total ?? 0)}
                            </strong>
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => navigate(`/sales/new?serviceOrderId=${os.id}`)}
                          className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                        >
                          Receber O.S. no Caixa
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ABA 4: Histórico de Caixas */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <Card className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <CardContent className="p-0">
              {historySessions.length === 0 ? (
                <div className="p-10 text-center text-zinc-400">
                  <History className="mx-auto h-10 w-10 stroke-1" />
                  <p className="mt-2 text-sm font-semibold">Nenhuma sessão registrada no histórico.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="p-3.5">Terminal / Operador</th>
                        <th className="p-3.5">Abertura</th>
                        <th className="p-3.5">Fechamento</th>
                        <th className="p-3.5 text-right">Inicial (Troco)</th>
                        <th className="p-3.5 text-right">Vendas (Dinheiro)</th>
                        <th className="p-3.5 text-right">PIX</th>
                        <th className="p-3.5 text-right">Cartões</th>
                        <th className="p-3.5 text-right">Final Gaveta</th>
                        <th className="p-3.5 text-center">Status</th>
                        <th className="p-3.5 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {historySessions.map((s) => {
                        const isClosed = s.status === 'closed';
                        const diffNum = parseFloat(s.difference || '0') || 0;
                        const hasDiff = Math.abs(diffNum) > 0.01;

                        return (
                          <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                            <td className="p-3.5">
                              <p className="font-bold text-zinc-900 dark:text-zinc-100">
                                {s.registerName || s.registerId}
                              </p>
                              <p className="text-[11px] text-zinc-400">
                                Operador: {s.operatorName || s.operatorId}
                              </p>
                            </td>
                            <td className="p-3.5 text-zinc-600 dark:text-zinc-400">
                              {new Date(s.openedAt).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-3.5 text-zinc-600 dark:text-zinc-400">
                              {s.closedAt ? new Date(s.closedAt).toLocaleString('pt-BR') : '—'}
                            </td>
                            <td className="p-3.5 text-right font-medium">
                              {formatCurrency(parseFloat(s.openingBalance) || 0)}
                            </td>
                            <td className="p-3.5 text-right font-medium text-emerald-600">
                              {formatCurrency(parseFloat(s.totalMoney) || 0)}
                            </td>
                            <td className="p-3.5 text-right font-medium text-teal-600">
                              {formatCurrency(parseFloat(s.totalPix) || 0)}
                            </td>
                            <td className="p-3.5 text-right font-medium text-purple-600">
                              {formatCurrency(
                                (parseFloat(s.totalCreditCard) || 0) +
                                  (parseFloat(s.totalDebitCard) || 0)
                              )}
                            </td>
                            <td className="p-3.5 text-right font-bold text-zinc-900 dark:text-zinc-100">
                              {formatCurrency(parseFloat(s.expectedMoney) || 0)}
                            </td>
                            <td className="p-3.5 text-center">
                              {isClosed ? (
                                hasDiff ? (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                    Fechado (Dif: {formatCurrency(diffNum)})
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                    Fechado OK
                                  </span>
                                )
                              ) : (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  Aberto
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setInspectHistorySession(s)}
                                className="h-7 text-xs text-blue-600 hover:text-blue-800"
                              >
                                <Printer className="h-3.5 w-3.5 mr-1" /> Comprovante
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL: ABERTURA DE CAIXA */}
      {openModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b pb-4 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <Unlock className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Abertura de Caixa
                  </h3>
                  <p className="text-xs text-zinc-500">Inicie o turno informando o fundo de troco</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleOpenSession} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Selecione o Terminal de Caixa
                </label>
                {registers.length > 0 ? (
                  <select
                    value={selectedRegisterId}
                    onChange={(e) => setSelectedRegisterId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {registers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="Ex: Caixa 01, Balcão Principal..."
                    value={newRegisterName}
                    onChange={(e) => setNewRegisterName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 p-2 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Saldo Inicial / Fundo de Troco (R$)
                </label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2 text-xs text-zinc-400">R$</span>
                  <input
                    type="text"
                    required
                    placeholder="100,00"
                    value={initialBalanceStr}
                    onChange={(e) => setInitialBalanceStr(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 py-2 pl-9 pr-3 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t pt-4 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenModalOpen(false)}
                  disabled={isSubmittingSession}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingSession}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSubmittingSession ? 'Abrindo...' : 'Confirmar Abertura'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FECHAMENTO DE CAIXA */}
      {activeSession && (
        <CashClosureModal
          session={activeSession}
          isOpen={closureModalOpen}
          onClose={() => setClosureModalOpen(false)}
          onConfirmClose={handleConfirmClose}
          isLoading={isSubmittingSession}
        />
      )}

      {/* MODAL: SANGRIA E SUPRIMENTO */}
      {activeSession && (
        <ManualMovementModal
          isOpen={movementModalOpen}
          onClose={() => setMovementModalOpen(false)}
          onConfirm={handleConfirmMovement}
          currentSessionId={activeSession.id}
          isLoading={isSubmittingSession}
        />
      )}

      {/* MODAL: IMPORTAR / CADASTRAR BOLETO PDF */}
      <BoletoFormModal
        isOpen={boletoModalOpen}
        onClose={() => setBoletoModalOpen(false)}
        onSaved={async () => {
          showNotification('success', 'Boleto cadastrado com sucesso!');
          await loadBills();
        }}
      />

      {/* MODAL: DAR BAIXA (PAGAR) BOLETO */}
      <PayBillModal
        bill={billToPay}
        isOpen={payBillModalOpen}
        onClose={() => {
          setPayBillModalOpen(false);
          setBillToPay(null);
        }}
        onConfirmPay={handleConfirmPayBill}
        hasOpenSession={!!activeSession}
      />

      {/* MODAL: VISUALIZAR COMPROVANTE DO HISTÓRICO */}
      {inspectHistorySession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b pb-4 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Comprovante de Turno de Caixa
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInspectHistorySession(null)}
              >
                ✕
              </Button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-zinc-700 dark:text-zinc-300">
              <div className="grid grid-cols-2 gap-2 bg-zinc-50 p-3 rounded-xl dark:bg-zinc-800/50">
                <div>
                  <span className="text-zinc-400">Terminal:</span>
                  <p className="font-semibold">{inspectHistorySession.registerName || inspectHistorySession.registerId}</p>
                </div>
                <div>
                  <span className="text-zinc-400">Operador:</span>
                  <p className="font-semibold">{inspectHistorySession.operatorName || inspectHistorySession.operatorId}</p>
                </div>
                <div>
                  <span className="text-zinc-400">Abertura:</span>
                  <p>{new Date(inspectHistorySession.openedAt).toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <span className="text-zinc-400">Fechamento:</span>
                  <p>
                    {inspectHistorySession.closedAt
                      ? new Date(inspectHistorySession.closedAt).toLocaleString('pt-BR')
                      : 'Em Aberto'}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 border-t pt-2 dark:border-zinc-800">
                <div className="flex justify-between">
                  <span>Troco Inicial:</span>
                  <span className="font-semibold">{formatCurrency(parseFloat(inspectHistorySession.openingBalance) || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vendas em Dinheiro:</span>
                  <span className="font-semibold text-emerald-600">+{formatCurrency(parseFloat(inspectHistorySession.totalMoney) || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vendas em PIX:</span>
                  <span className="font-semibold text-teal-600">+{formatCurrency(parseFloat(inspectHistorySession.totalPix) || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vendas em Cartão (C/D):</span>
                  <span className="font-semibold text-purple-600">
                    +{formatCurrency((parseFloat(inspectHistorySession.totalCreditCard) || 0) + (parseFloat(inspectHistorySession.totalDebitCard) || 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Suprimentos:</span>
                  <span className="font-semibold text-blue-600">+{formatCurrency(parseFloat(inspectHistorySession.totalAdditionalEntries) || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sangrias / Pagamentos:</span>
                  <span className="font-semibold text-rose-600">-{formatCurrency(parseFloat(inspectHistorySession.totalWithdrawals) || 0)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-sm font-bold dark:border-zinc-800">
                  <span>Saldo Gaveta Esperado:</span>
                  <span>{formatCurrency(parseFloat(inspectHistorySession.expectedMoney) || 0)}</span>
                </div>
                {inspectHistorySession.countedMoney && (
                  <div className="flex justify-between text-sm font-bold">
                    <span>Saldo Gaveta Apurado:</span>
                    <span>{formatCurrency(parseFloat(inspectHistorySession.countedMoney) || 0)}</span>
                  </div>
                )}
                {inspectHistorySession.discrepancyJustification && (
                  <div className="mt-2 rounded-lg bg-amber-50 p-2.5 text-amber-900 text-xs dark:bg-amber-950/40 dark:text-amber-200">
                    <strong>Justificativa da Divergência:</strong> {inspectHistorySession.discrepancyJustification}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t pt-3 dark:border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
              <Button
                size="sm"
                onClick={() => setInspectHistorySession(null)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
