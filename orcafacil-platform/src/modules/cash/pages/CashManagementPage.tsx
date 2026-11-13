import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  FileText,
  History,
  Landmark,
  Lock,
  Paperclip,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react';
import { supabase } from '@app/config/supabase';

import type { CashSession, CashSessionMovement } from '../domain/cash-session';
import { cashSessionService } from '../services/cash-session.service';
import type { CashBill } from '../services/cash-bills.service';
import { cashBillsService } from '../services/cash-bills.service';
import { salesService, type SaleListItem } from '@modules/sales/services/sales.service';


import { CashClosureModal } from '../components/CashClosureModal';
import { ManualMovementModal } from '../components/ManualMovementModal';
import { BoletoFormModal } from '../components/BoletoFormModal';
import { PayBillModal } from '../components/PayBillModal';

type ActiveTab = 'session' | 'bills' | 'history';

export function CashManagementPage() {
  const { currentOrganization } = useOrganization();
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state
  const currentTabParam = searchParams.get('tab') as ActiveTab | null;
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    currentTabParam && ['session', 'bills', 'history'].includes(currentTabParam)
      ? currentTabParam
      : 'session'
  );

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Cash Session State
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [sessionMovements, setSessionMovements] = useState<CashSessionMovement[]>([]);
  const [sessionSales, setSessionSales] = useState<SaleListItem[]>([]);
  const [allOrgSales, setAllOrgSales] = useState<SaleListItem[]>([]);
  const [allOrgMovements, setAllOrgMovements] = useState<CashSessionMovement[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeExtratoTab, setActiveExtratoTab] = useState<'movements' | 'sales'>('movements');
  const [historySessions, setHistorySessions] = useState<CashSession[]>([]);
  const [, setIsLoadingSession] = useState<boolean>(true);

  // Modals state
  const [openModalOpen, setOpenModalOpen] = useState<boolean>(false);
  const [closureModalOpen, setClosureModalOpen] = useState<boolean>(false);
  const [closureSession, setClosureSession] = useState<CashSession | null>(null);
  const [movementModalOpen, setMovementModalOpen] = useState<boolean>(false);
  const [boletoModalOpen, setBoletoModalOpen] = useState<boolean>(false);
  const [payBillModalOpen, setPayBillModalOpen] = useState<boolean>(false);
  const [billToPay, setBillToPay] = useState<CashBill | null>(null);
  const [resumePayBillAfterOpen, setResumePayBillAfterOpen] = useState<boolean>(false);
  const [inspectHistorySession, setInspectHistorySession] = useState<CashSession | null>(null);
  const [historyMovements, setHistoryMovements] = useState<CashSessionMovement[]>([]);
  const [isLoadingHistoryMovements, setIsLoadingHistoryMovements] = useState<boolean>(false);
  const [historyInspectTab, setHistoryInspectTab] = useState<'movements' | 'summary'>('movements');
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<{ url: string; title: string } | null>(null);

  // Open session form state
  const [initialBalanceStr, setInitialBalanceStr] = useState<string>('0,00');
  const [lastClosedSession, setLastClosedSession] = useState<CashSession | null>(null);
  const [isLoadingLastClosure, setIsLoadingLastClosure] = useState<boolean>(false);
  const [isSubmittingSession, setIsSubmittingSession] = useState<boolean>(false);

  // Bills State
  const [bills, setBills] = useState<CashBill[]>([]);
  const [billsFilterCategory, setBillsFilterCategory] = useState<string>('all');
  const [billsFilterStatus, setBillsFilterStatus] = useState<string>('all');
  const [billsSearch, setBillsSearch] = useState<string>('');
  const [isLoadingBills, setIsLoadingBills] = useState<boolean>(false);
  const [upcomingAlertCount, setUpcomingAlertCount] = useState<number>(0);

  // Notification message
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 5000);
  };

  // Carrega a sessão ativa do Caixa Geral (/cash), vendas e movimentações massivas
  const loadActiveSession = useCallback(async () => {
    if (!currentOrganization) return;
    setIsLoadingSession(true);

    try {
      const [res, salesRes, allMovsRes] = await Promise.all([
        cashSessionService.getOpenCashManagementSession(currentOrganization.id),
        salesService.listSales(currentOrganization.id),
        cashSessionService.listAllMovements(currentOrganization.id),
      ]);

      const session = res.success ? res.data : null;
      setActiveSession(session);

      if (salesRes.success && salesRes.data) {
        setAllOrgSales(salesRes.data);
      } else {
        setAllOrgSales([]);
      }

      if (allMovsRes.success && allMovsRes.data) {
        setAllOrgMovements(allMovsRes.data);
      } else {
        setAllOrgMovements([]);
      }

      if (session) {
        const movRes = await cashSessionService.listMovements(currentOrganization.id, session.id);
        if (movRes.success && movRes.data) {
          setSessionMovements(movRes.data);
        } else {
          setSessionMovements([]);
        }

        if (salesRes.success && salesRes.data) {
          const sessionStart = new Date(session.openedAt).getTime();
          const relevant = salesRes.data.filter((s) => {
            if (s.sessionId === session.id) return true;
            const saleTime = new Date(s.createdAt).getTime();
            return saleTime >= sessionStart;
          });
          setSessionSales(relevant);
        } else {
          setSessionSales([]);
        }
      } else {
        setSessionMovements([]);
        setSessionSales([]);
      }
    } catch {
      // Ignora erro
    } finally {
      setIsLoadingSession(false);
    }
  }, [currentOrganization]);

  // Carrega histórico de caixas (apenas Caixa Geral)
  const loadHistory = useCallback(async () => {
    if (!currentOrganization) return;
    const res = await cashSessionService.listHistory(currentOrganization.id, 'cash_management');
    if (res.success && res.data) {
      setHistorySessions(res.data.filter((s) => s.sessionType === 'cash_management'));
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

  // Carrega a última sessão fechada para herdar obrigatoriamente o saldo final no início do dia
  const loadLastClosure = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      const res = await cashSessionService.getLastClosedSession(
        currentOrganization.id,
        'cash_management',
      );
      if (res.success && res.data) {
        const closed = res.data;
        setLastClosedSession(closed);
        const closingVal =
          closed.countedMoney !== null &&
          closed.countedMoney !== undefined &&
          closed.countedMoney !== ''
            ? parseFloat(closed.countedMoney)
            : parseFloat(closed.expectedMoney) || 0;
        setInitialBalanceStr(closingVal.toFixed(2).replace('.', ','));
      } else {
        setLastClosedSession(null);
        setInitialBalanceStr('0,00');
      }
    } catch {
      // Ignora erro
    }
  }, [currentOrganization]);

  const handleOpenOpenModal = useCallback(async () => {
    setClosureModalOpen(false);
    setClosureSession(null);
    setIsLoadingLastClosure(true);
    await loadLastClosure();
    setIsLoadingLastClosure(false);
    setOpenModalOpen(true);
  }, [loadLastClosure]);

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      loadActiveSession(),
      loadBills(),
      loadHistory(),
      loadLastClosure(),
    ]);
    setIsRefreshing(false);
  }, [loadActiveSession, loadBills, loadHistory, loadLastClosure]);

  useEffect(() => {
    void loadActiveSession();
    void loadBills();
    void loadHistory();
    void loadLastClosure();
  }, [loadActiveSession, loadBills, loadHistory, loadLastClosure]);

  // Abre modal de abertura de Caixa Geral quando acionado via ?openCash=true ou evento global
  useEffect(() => {
    if (searchParams.get('openCash') === 'true') {
      void handleOpenOpenModal();
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('openCash');
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams, handleOpenOpenModal]);

  useEffect(() => {
    const onOpenGeneralCashEvent = () => {
      void handleOpenOpenModal();
    };
    window.addEventListener('open-general-cash-modal', onOpenGeneralCashEvent);
    return () => {
      window.removeEventListener('open-general-cash-modal', onOpenGeneralCashEvent);
    };
  }, [handleOpenOpenModal]);

  // Atualização em tempo real (Supabase Realtime Channel + Interval de contingência)
  useEffect(() => {
    if (!currentOrganization) return;

    // Contingência: atualização a cada 10 segundos
    const interval = setInterval(() => {
      void loadActiveSession();
      void loadBills();
    }, 10000);

    // Canal Realtime do Supabase
    const channelName = `cash-mgmt-${currentOrganization.id}-${Math.random().toString(36).substring(2, 9)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cash_sessions',
          filter: `organization_id=eq.${currentOrganization.id}`,
        },
        () => {
          void loadActiveSession();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cash_session_movements',
          filter: `organization_id=eq.${currentOrganization.id}`,
        },
        () => {
          void loadActiveSession();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
          filter: `organization_id=eq.${currentOrganization.id}`,
        },
        () => {
          void loadActiveSession();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [currentOrganization, loadActiveSession, loadBills]);

  // Handler para Abertura do Caixa Geral (/cash)
  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user) return;
    setIsSubmittingSession(true);

    const cleanBalance =
      parseFloat(initialBalanceStr.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;

    // Se existe caixa anterior fechado, garante obrigatoriamente que o saldo inicial seja o valor fechado
    const lastClosedAmount = lastClosedSession
      ? (lastClosedSession.countedMoney !== null &&
         lastClosedSession.countedMoney !== undefined &&
         lastClosedSession.countedMoney !== ''
          ? parseFloat(lastClosedSession.countedMoney)
          : parseFloat(lastClosedSession.expectedMoney) || 0)
      : null;

    const finalBalance = lastClosedAmount !== null ? lastClosedAmount : cleanBalance;

    const opName = profile?.displayName || user.email?.split('@')[0] || 'Administrador';

    const res = await cashSessionService.openSession(currentOrganization.id, {
      registerId: 'Caixa Geral',
      registerName: 'Caixa Geral da Empresa',
      sessionType: 'cash_management',
      operatorId: user.id,
      openingBalance: finalBalance,
      operatorName: opName,
    });

    setIsSubmittingSession(false);

    if (res.success && res.data) {
      setActiveSession(res.data);
      setOpenModalOpen(false);
      setClosureModalOpen(false);
      setClosureSession(null);
      showNotification('success', 'Caixa Geral aberto com sucesso!');

      if (resumePayBillAfterOpen && billToPay) {
        setResumePayBillAfterOpen(false);
        setActiveTab('bills');
        setSearchParams({ tab: 'bills' }, { replace: true });
        setPayBillModalOpen(true);
      }

      window.dispatchEvent(new CustomEvent('general-cash-session-opened'));

      void loadActiveSession();
      void loadHistory();
      void loadLastClosure();
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
    const sessionToClose = closureSession || activeSession;
    if (!currentOrganization || !sessionToClose || !user) return;
    setIsSubmittingSession(true);

    const res = await cashSessionService.closeSession(
      currentOrganization.id,
      sessionToClose.id,
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
      window.dispatchEvent(new CustomEvent('general-cash-session-closed'));
      await loadActiveSession();
      await loadHistory();
      await loadLastClosure();
    } else {
      showNotification('error', res.error || 'Erro ao fechar caixa.');
    }
  };

  // Handler para Inspecionar Sessão do Histórico e buscar o extrato de movimentações
  const handleInspectHistorySession = async (session: CashSession) => {
    setInspectHistorySession(session);
    setHistoryInspectTab('movements');
    setHistoryMovements([]);
    if (!currentOrganization) return;
    setIsLoadingHistoryMovements(true);
    try {
      const movRes = await cashSessionService.listMovements(currentOrganization.id, session.id);
      if (movRes.success && movRes.data) {
        setHistoryMovements(movRes.data);
      }
    } finally {
      setIsLoadingHistoryMovements(false);
    }
  };

  // Handler para Sangria / Suprimento
  const handleConfirmMovement = async (data: {
    type: 'supply' | 'bleed';
    amount: number;
    reason: string;
    category?: string;
    attachmentFile?: File | null;
    moveToAccount?: boolean;
  }) => {
    if (!currentOrganization || !activeSession) return;
    setIsSubmittingSession(true);

    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;

    if (data.attachmentFile) {
      const uploadRes = await cashSessionService.uploadMovementAttachment(
        currentOrganization.id,
        data.attachmentFile
      );
      if (!uploadRes.success) {
        showNotification(
          'error',
          uploadRes.error || 'Erro ao anexar comprovante da movimentação.'
        );
        setIsSubmittingSession(false);
        return;
      }
      attachmentUrl = uploadRes.data.url;
      attachmentName = uploadRes.data.fileName;
    }

    const res = await cashSessionService.recordMovement(
      currentOrganization.id,
      activeSession.id,
      {
        type: data.type,
        amount: data.amount,
        reason: data.reason,
        category: data.category,
        attachmentUrl,
        attachmentName,
        moveToAccount: data.moveToAccount,
        userId: user?.id,
      }
    );

    setIsSubmittingSession(false);

    if (res.success && res.data) {
      setActiveSession(res.data);
      const moveNotice = data.moveToAccount ? ' (transferido para o Saldo em Conta)' : '';
      showNotification(
        'success',
        `${data.type === 'supply' ? 'Suprimento' : 'Sangria'} de ${formatCurrency(
          data.amount
        )}${moveNotice} lançada com sucesso!`
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
      attachmentFile?: File | null;
    }
  ) => {
    if (!currentOrganization) return;
    setIsSubmittingSession(true);

    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;

    if (params.attachmentFile) {
      const uploadRes = await cashSessionService.uploadMovementAttachment(
        currentOrganization.id,
        params.attachmentFile,
      );
      if (uploadRes.success && uploadRes.data) {
        attachmentUrl = uploadRes.data.url;
        attachmentName = uploadRes.data.fileName;
      } else {
        // Fallback para Base64 local para nunca perder o comprovante
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(params.attachmentFile!);
          });
          attachmentUrl = base64;
          attachmentName = params.attachmentFile.name;
        } catch {
          // Segue com o pagamento
        }
      }
    }

    const res = await cashBillsService.payBill(currentOrganization.id, billId, {
      paymentMethod: params.paymentMethod,
      paidAmount: params.paidAmount,
      notes: params.notes,
      deductFromOpenSession: params.deductFromOpenSession !== false,
      openSessionId: activeSession ? activeSession.id : undefined,
      attachmentUrl,
      attachmentName,
      operatorName: user?.email?.split('@')[0],
      userId: user?.id,
    });

    setIsSubmittingSession(false);

    if (res.success) {
      showNotification('success', 'Boleto/Fatura baixada e sangria lançada no Caixa Geral com sucesso!');
      void loadBills();
      void loadActiveSession();
      void loadHistory();
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

  // Totais rápidos da sessão ativa e saldos massivos da empresa
  const sessionExpectedMoney = activeSession
    ? parseFloat(activeSession.expectedMoney) || 0
    : 0;
  const lastClosedAmount = lastClosedSession
    ? (lastClosedSession.countedMoney !== null &&
       lastClosedSession.countedMoney !== undefined &&
       lastClosedSession.countedMoney !== ''
        ? parseFloat(lastClosedSession.countedMoney)
        : parseFloat(lastClosedSession.expectedMoney) || 0)
    : 0;

  // 1. Saldo Físico: total em dinheiro físico na gaveta da empresa
  const currentPhysicalCash = activeSession
    ? sessionExpectedMoney
    : lastClosedAmount;

  // 2. PIX Total: total massivo de vendas PIX da empresa
  const massivePixTotal = useMemo(() => {
    return allOrgSales
      .filter((s) => s.paymentMethod === 'pix')
      .reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0);
  }, [allOrgSales]);

  // 3. Cartões (C/D): total massivo de cartões (crédito + débito)
  const massiveCardsTotal = useMemo(() => {
    return allOrgSales
      .filter((s) => s.paymentMethod === 'credit_card' || s.paymentMethod === 'debit_card')
      .reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0);
  }, [allOrgSales]);

  // 4. Suprimentos da sessão
  const sessionTotalSupplies = activeSession
    ? parseFloat(activeSession.totalAdditionalEntries) || 0
    : 0;

  // 5. Sangrias da sessão
  const sessionTotalBleeds = activeSession
    ? parseFloat(activeSession.totalWithdrawals) || 0
    : 0;

  // Sangrias de Segurança movidas para a conta bancária
  const totalSangriasToAccount = useMemo(() => {
    return allOrgMovements
      .filter(
        (m) =>
          m.type === 'bleed' &&
          (m.moveToAccount ||
            m.category?.includes('Mover para Conta') ||
            m.reason.includes('[Transferido para Conta]') ||
            m.reason.includes('Mover para Conta'))
      )
      .reduce((acc, m) => acc + (parseFloat(m.amount) || 0), 0);
  }, [allOrgMovements]);

  // Saídas / Sangrias de boletos pagos via Saldo em Conta (Pix + Cartões + Sangrias p/ Conta)
  const totalAccountOutflows = useMemo(() => {
    return allOrgMovements
      .filter(
        (m) =>
          m.type === 'bleed' &&
          (m.reason.includes('[Saída Saldo em Conta]') ||
            m.category?.includes('Saída Saldo em Conta'))
      )
      .reduce((acc, m) => acc + (parseFloat(m.amount) || 0), 0);
  }, [allOrgMovements]);

  // 6. Saldo em Conta: somando os valores de Pix Total, Cartões (C/D) e Sangrias movidas para a conta, descontando saídas da conta
  const massiveAccountBalance =
    massivePixTotal + massiveCardsTotal + totalSangriasToAccount - totalAccountOutflows;

  const sessionTotalMoneySales = activeSession
    ? parseFloat(activeSession.totalMoney) || 0
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
          {!activeSession && (
            <Button
              size="sm"
              onClick={() => void handleOpenOpenModal()}
              disabled={isLoadingLastClosure}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Unlock className="h-4 w-4" />
              {isLoadingLastClosure ? 'Carregando...' : 'Abrir Caixa'}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleRefreshAll()}
            disabled={isRefreshing}
            className="gap-2 border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            title="Atualizar dados do caixa em tempo real"
          >
            <RefreshCw className={`h-4 w-4 text-zinc-600 dark:text-zinc-300 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar Caixa
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
      <div className="row g-3">
        {/* 1. Saldo Físico em Dinheiro */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
        <Card className="h-full rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500">Saldo Físico (Dinheiro Em Caixa)</span>
              <div className="rounded-lg bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <Banknote className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(currentPhysicalCash)}
            </p>
            <span className="text-[11px] text-zinc-400">
              {activeSession ? 'Aberto no terminal' : 'Caixa fechado (Último saldo)'}
            </span>
          </CardContent>
        </Card>
        </div>

        {/* 2. Total PIX Massivo */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
        <Card className="h-full rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500">PIX Total</span>
              <div className="rounded-lg bg-teal-100 p-1.5 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
                <QrCode className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(massivePixTotal)}
            </p>
            <span className="text-[11px] text-zinc-400">Total acumulado (Vendas/OS)</span>
          </CardContent>
        </Card>
        </div>

        {/* 3. Total Cartões Massivo */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
        <Card className="h-full rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500">Cartões (C/D)</span>
              <div className="rounded-lg bg-purple-100 p-1.5 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(massiveCardsTotal)}
            </p>
            <span className="text-[11px] text-zinc-400">Crédito + Débito total</span>
          </CardContent>
        </Card>
        </div>

        {/* 4. Suprimentos */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
        <Card className="h-full rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
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
        </div>

        {/* 5. Sangrias */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
        <Card className="h-full rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
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
        </div>

        {/* 6. Saldo em Conta */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
        <Card className="h-full rounded-2xl border border-indigo-200 bg-indigo-50/40 shadow-xs dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Saldo em Conta</span>
              <div className="rounded-lg bg-indigo-100 p-1.5 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <Landmark className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-lg font-bold text-indigo-700 dark:text-indigo-300">
              {formatCurrency(massiveAccountBalance)}
            </p>
            <span className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80">
              Pix + Cartões + Sangrias p/ Conta
            </span>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Aviso de Boas Práticas Financeiras e Bancárias (MOD-05) */}
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Boas Práticas Operacionais (MOD-05):</strong> O registro de pagamentos em PIX/Cartão e a baixa de contas ou boletos (PDF) neste painel têm finalidade exclusiva de <strong>controle gerencial interno</strong> e não realizam liquidação bancária automática. Efetue os pagamentos reais no seu <em>Internet Banking</em> e confira sempre os dados extraídos automaticamente de boletos.
        </p>
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
                      onClick={() => {
                        setClosureSession(activeSession);
                        setClosureModalOpen(true);
                      }}
                      className="w-full gap-2 bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                      size="sm"
                    >
                      <Lock className="h-4 w-4" />
                      Fechar Caixa
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Extrato e Vendas da Sessão */}
              <Card className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveExtratoTab('movements')}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          activeExtratoTab === 'movements'
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        Extrato Completo ({sessionMovements.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveExtratoTab('sales')}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                          activeExtratoTab === 'sales'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Vendas Faturadas ({sessionSales.length})
                      </button>
                    </div>
                    <span className="text-xs text-zinc-400">
                      {activeExtratoTab === 'movements'
                        ? `${sessionMovements.length} movimentação(ões)`
                        : `${sessionSales.length} venda(s) na sessão`}
                    </span>
                  </div>

                  {/* ABA: Extrato Completo */}
                  {activeExtratoTab === 'movements' && (
                    <>
                      {sessionMovements.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400">
                          <DollarSign className="h-10 w-10 stroke-1" />
                          <p className="mt-2 text-sm font-medium">Nenhuma movimentação na sessão atual.</p>
                          <p className="text-xs">
                            Vendas da Nova Venda, do PDV, suprimentos e sangrias serão listados aqui.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 font-semibold">
                              <tr>
                                <th className="p-3">Horário</th>
                                <th className="p-3">Tipo</th>
                                <th className="p-3">Origem & Detalhes</th>
                                <th className="p-3 text-right">Valor</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                              {sessionMovements.map((mov) => {
                                const isSale = mov.reason.startsWith('Venda');
                                const isNovaVenda = mov.reason.includes('[Nova Venda]');
                                const isPdv = mov.reason.includes('[PDV') || mov.reason.includes('[Caixa');

                                return (
                                  <tr key={mov.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                    <td className="p-3 whitespace-nowrap text-zinc-500">
                                      {new Date(mov.createdAt).toLocaleTimeString('pt-BR', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </td>
                                    <td className="p-3 whitespace-nowrap">
                                      {isSale ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                          <ShoppingCart className="h-3 w-3" />
                                          Venda
                                        </span>
                                      ) : mov.type === 'supply' ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                                          <ArrowDownRight className="h-3 w-3" />
                                          Suprimento
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 font-bold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                          <ArrowUpRight className="h-3 w-3" />
                                          Sangria
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 text-zinc-700 dark:text-zinc-300">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                          {mov.reason.split(' • ')[0]}
                                        </span>
                                        {isNovaVenda && (
                                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                                            Nova Venda
                                          </span>
                                        )}
                                        {isPdv && (
                                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                            PDV
                                          </span>
                                        )}
                                        {mov.moveToAccount && (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                            <Landmark className="h-3 w-3" />
                                            Para a Conta
                                          </span>
                                        )}
                                        {mov.reason.includes(' • ') && (
                                          <span className="text-[11px] font-medium text-zinc-500">
                                            {mov.reason.split(' • ').slice(1).join(' • ')}
                                          </span>
                                        )}
                                        {mov.attachmentUrl && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setPreviewAttachmentUrl({
                                                url: mov.attachmentUrl!,
                                                title: mov.attachmentName || 'Comprovante / Nota de Compra',
                                              })
                                            }
                                            className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition"
                                            title="Clique para visualizar o comprovante / nota anexado"
                                          >
                                            <Paperclip className="h-3 w-3" />
                                            <span>Ver Nota</span>
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td
                                      className={`p-3 text-right font-bold ${
                                        mov.type === 'supply' ? 'text-emerald-600' : 'text-rose-600'
                                      }`}
                                    >
                                      {mov.type === 'supply' ? '+' : '-'}
                                      {formatCurrency(parseFloat(mov.amount) || 0)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {/* ABA: Tabela Detalhada de Vendas */}
                  {activeExtratoTab === 'sales' && (
                    <>
                      {sessionSales.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400">
                          <ShoppingCart className="h-10 w-10 stroke-1" />
                          <p className="mt-2 text-sm font-medium">Nenhuma venda registrada na sessão aberta.</p>
                          <p className="text-xs">
                            Vendas concluídas na &quot;Nova Venda&quot; e no &quot;PDV&quot; serão listadas aqui automaticamente.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 font-semibold">
                              <tr>
                                <th className="p-3">Horário</th>
                                <th className="p-3">Venda</th>
                                <th className="p-3">Origem</th>
                                <th className="p-3">Cliente</th>
                                <th className="p-3">Pagamento</th>
                                <th className="p-3">Vendedor</th>
                                <th className="p-3 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                              {sessionSales.map((sale) => {
                                const isNovaVenda = !sale.isPdv;
                                const methodLabels: Record<string, string> = {
                                  money: 'Dinheiro',
                                  pix: 'PIX',
                                  credit_card: 'Cartão de Crédito',
                                  debit_card: 'Cartão de Débito',
                                  on_credit: 'A Prazo',
                                  other: 'Outro',
                                };
                                const payText = methodLabels[sale.paymentMethod] || sale.paymentMethod || 'Outro';

                                return (
                                  <tr key={sale.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                    <td className="p-3 whitespace-nowrap text-zinc-500">
                                      {new Date(sale.createdAt).toLocaleTimeString('pt-BR', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </td>
                                    <td className="p-3 whitespace-nowrap font-bold text-zinc-900 dark:text-zinc-100">
                                      #{sale.saleNumber}
                                    </td>
                                    <td className="p-3 whitespace-nowrap">
                                      {isNovaVenda ? (
                                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                                          Nova Venda (Balcão)
                                        </span>
                                      ) : (
                                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                          PDV
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 text-zinc-800 dark:text-zinc-200">
                                      {sale.customerName || 'Consumidor Final'}
                                    </td>
                                    <td className="p-3 whitespace-nowrap font-medium text-zinc-600 dark:text-zinc-400">
                                      {payText}
                                    </td>
                                    <td className="p-3 text-zinc-500">
                                      {sale.sellerName || sale.creatorName || '-'}
                                    </td>
                                    <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                      {formatCurrency(parseFloat(sale.total) || 0)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
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
                  onClick={() => void handleOpenOpenModal()}
                  disabled={isLoadingLastClosure}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Unlock className="h-4 w-4" />
                  {isLoadingLastClosure ? 'Carregando...' : 'Abrir Caixa Agora'}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ABA 2: Contas a Pagar & Boletos (PDF Inteligente) */}
      {activeTab === 'bills' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="row g-2 flex-1 items-center">
              <div className="col-12 col-md-5 relative">
                <Search className="absolute left-5 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar por descrição, beneficiário ou código de barras..."
                  value={billsSearch}
                  onChange={(e) => setBillsSearch(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 py-2 pl-9 pr-3 text-xs focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              {/* Filtro Categoria */}
              <div className="col-6 col-md-3">
              <select
                value={billsFilterCategory}
                onChange={(e) => setBillsFilterCategory(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
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
              </div>

              {/* Filtro Status */}
              <div className="col-6 col-md-4">
              <select
                value={billsFilterStatus}
                onChange={(e) => setBillsFilterStatus(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="all">Todos os Status</option>
                <option value="due_soon">⚠️ Vencendo em 10 dias (Pendente)</option>
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="cancelled">Cancelado / Arquivado</option>
              </select>
              </div>
            </div>

            <Button
              onClick={() => setBoletoModalOpen(true)}
              className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700 text-white"
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

      {/* ABA 3: Histórico de Caixas */}
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
                          <tr
                            key={s.id}
                            onClick={() => void handleInspectHistorySession(s)}
                            className="hover:bg-blue-50/60 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors"
                            title="Clique para ver o histórico de movimentações deste caixa"
                          >
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
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleInspectHistorySession(s);
                                }}
                                className="h-7 text-xs text-blue-600 hover:text-blue-800 border-blue-200 dark:border-blue-900/40"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" /> Movimentações
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
                  Escopo do Caixa
                </label>
                <div className="mt-1 flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
                  <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                    <Store className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Caixa Geral da Empresa (Controle Diário)
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Consolida vendas dos PDVs, contas pagas, sangrias e suprimentos do dia.
                    </p>
                  </div>
                </div>
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
                    readOnly={lastClosedSession !== null}
                    placeholder="100,00"
                    value={initialBalanceStr}
                    onChange={(e) => {
                      if (!lastClosedSession) {
                        setInitialBalanceStr(e.target.value);
                      }
                    }}
                    className={`w-full rounded-xl border py-2 pl-9 pr-10 text-sm font-semibold dark:bg-zinc-800 ${
                      lastClosedSession
                        ? 'border-emerald-300 bg-emerald-50/60 text-emerald-950 cursor-not-allowed dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
                        : 'border-zinc-300 text-zinc-900 dark:border-zinc-700 dark:text-zinc-100'
                    }`}
                  />
                  {lastClosedSession && (
                    <span
                      className="absolute right-3 top-2.5 text-emerald-600 dark:text-emerald-400"
                      title="Saldo obrigatório herdado do último fechamento de caixa"
                    >
                      <Lock className="h-4 w-4" />
                    </span>
                  )}
                </div>

                {lastClosedSession ? (
                  <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-800 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>Saldo herdado obrigatoriamente do último caixa fechado</span>
                    </div>
                    <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                      O último caixa fechou com{' '}
                      <strong>
                        {formatCurrency(
                          lastClosedSession.countedMoney !== null &&
                          lastClosedSession.countedMoney !== undefined &&
                          lastClosedSession.countedMoney !== ''
                            ? parseFloat(lastClosedSession.countedMoney)
                            : parseFloat(lastClosedSession.expectedMoney) || 0
                        )}
                      </strong>
                      {lastClosedSession.closedAt && (
                        <> em {new Date(lastClosedSession.closedAt).toLocaleDateString('pt-BR')} às {new Date(lastClosedSession.closedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</>
                      )}
                      {lastClosedSession.operatorName && <> por {lastClosedSession.operatorName}</>}.
                    </p>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[11px] text-zinc-500">
                    Nenhum caixa anterior fechado encontrado. Defina o saldo inicial para a primeira abertura do Caixa Geral.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t pt-4 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpenModalOpen(false);
                    cashBillsService.clearPendingAlertPaymentForCashOpen();
                    if (resumePayBillAfterOpen && billToPay) {
                      setResumePayBillAfterOpen(false);
                      setPayBillModalOpen(true);
                    }
                  }}
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
      {closureModalOpen && closureSession && (
        <CashClosureModal
          session={closureSession}
          isOpen={closureModalOpen}
          onClose={() => {
            setClosureModalOpen(false);
            setClosureSession(null);
            void loadActiveSession();
            void loadHistory();
            void loadLastClosure();
          }}
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
          setResumePayBillAfterOpen(false);
        }}
        onConfirmPay={handleConfirmPayBill}
        hasOpenSession={!!activeSession}
        onOpenGeneralCash={() => {
          setResumePayBillAfterOpen(true);
          setPayBillModalOpen(false);
          void handleOpenOpenModal();
        }}
        isLoading={isSubmittingSession}
      />

      {/* MODAL: VISUALIZAR HISTÓRICO DE MOVIMENTAÇÕES E COMPROVANTE DO CAIXA */}
      {inspectHistorySession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b pb-4 dark:border-zinc-800">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <History className="h-5 w-5 text-blue-600" />
                  Histórico de Movimentações — {inspectHistorySession.registerName || inspectHistorySession.registerId}
                </h3>
                <p className="text-xs text-zinc-500">
                  Operador: {inspectHistorySession.operatorName || inspectHistorySession.operatorId} • Abertura: {new Date(inspectHistorySession.openedAt).toLocaleString('pt-BR')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInspectHistorySession(null)}
              >
                ✕
              </Button>
            </div>

            {/* Abas do Modal de Inspeção */}
            <div className="mt-4 flex gap-2 border-b pb-2 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setHistoryInspectTab('movements')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                  historyInspectTab === 'movements'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Extrato de Movimentações ({historyMovements.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryInspectTab('summary')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                  historyInspectTab === 'summary'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                Resumo e Conferência Financeira
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-4 text-xs text-zinc-700 dark:text-zinc-300">
              {historyInspectTab === 'movements' ? (
                <div>
                  {isLoadingHistoryMovements ? (
                    <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                      <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                      <p className="mt-2 text-xs font-semibold">Carregando movimentações do caixa...</p>
                    </div>
                  ) : historyMovements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400">
                      <DollarSign className="h-10 w-10 stroke-1" />
                      <p className="mt-2 text-sm font-semibold">Nenhuma movimentação registrada nesta sessão.</p>
                      <p className="text-xs">Todas as entradas, saídas e vendas do período serão listadas aqui.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                          <tr>
                            <th className="p-3">Horário</th>
                            <th className="p-3">Tipo</th>
                            <th className="p-3">Descrição / Classificação</th>
                            <th className="p-3 text-right">Valor</th>
                            <th className="p-3 text-center">Comprovante</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {historyMovements.map((mov) => {
                            const isSale = mov.reason.startsWith('Venda');
                            return (
                              <tr key={mov.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                <td className="p-3 whitespace-nowrap text-zinc-500">
                                  {new Date(mov.createdAt).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  {isSale ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px]">
                                      <ShoppingCart className="h-3 w-3" />
                                      Venda
                                    </span>
                                  ) : mov.type === 'supply' ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 text-[10px]">
                                      <ArrowDownRight className="h-3 w-3" />
                                      Suprimento
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 font-bold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 text-[10px]">
                                      <ArrowUpRight className="h-3 w-3" />
                                      Sangria
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-zinc-700 dark:text-zinc-300">
                                  <div>
                                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                                      {mov.reason}
                                    </p>
                                    {mov.category && (
                                      <span className="text-[10px] text-zinc-400">
                                        Categoria: {mov.category}
                                      </span>
                                    )}
                                    {mov.moveToAccount && (
                                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                        <Landmark className="h-3 w-3" />
                                        Para a Conta
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td
                                  className={`p-3 text-right font-bold whitespace-nowrap ${
                                    mov.type === 'supply' ? 'text-emerald-600' : 'text-rose-600'
                                  }`}
                                >
                                  {mov.type === 'supply' ? '+' : '-'}
                                  {formatCurrency(parseFloat(mov.amount) || 0)}
                                </td>
                                <td className="p-3 text-center whitespace-nowrap">
                                  {mov.attachmentUrl ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPreviewAttachmentUrl({
                                          url: mov.attachmentUrl!,
                                          title: mov.attachmentName || 'Comprovante / Nota de Compra',
                                        })
                                      }
                                      className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                    >
                                      <Paperclip className="h-3 w-3" />
                                      <span>Ver Anexo</span>
                                    </button>
                                  ) : (
                                    <span className="text-zinc-400 text-[11px]">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
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
              )}
            </div>

            <div className="mt-4 flex justify-between gap-2 border-t pt-3 dark:border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Imprimir Relatório
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

      {/* MODAL: PRÉ-VISUALIZAÇÃO DE COMPROVANTE / NOTA ANEXADA */}
      {previewAttachmentUrl && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4">
          <div className="relative max-h-[90vh] max-w-3xl w-full rounded-2xl bg-white p-4 shadow-2xl dark:bg-zinc-900 border border-zinc-800 flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-blue-600" />
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {previewAttachmentUrl.title}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewAttachmentUrl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300"
                >
                  Abrir em nova aba ↗
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewAttachmentUrl(null)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="mt-3 flex-1 overflow-auto flex items-center justify-center min-h-[300px]">
              {previewAttachmentUrl.url.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewAttachmentUrl.url}
                  title="Comprovante PDF"
                  className="w-full h-[65vh] rounded-lg border border-zinc-200 dark:border-zinc-800"
                />
              ) : (
                <img
                  src={previewAttachmentUrl.url}
                  alt="Comprovante / Nota de Compra"
                  className="max-h-[75vh] max-w-full rounded-lg object-contain shadow-md"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
