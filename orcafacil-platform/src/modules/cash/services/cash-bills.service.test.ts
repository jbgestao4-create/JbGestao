import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cashBillsService } from './cash-bills.service';

const mockChain: any = {
  select: () => mockChain,
  insert: () => mockChain,
  update: () => mockChain,
  delete: () => ({
    eq: () => ({
      eq: () => Promise.resolve({ error: { code: 'PGRST205' } }),
    }),
  }),
  eq: () => mockChain,
  order: () => Promise.resolve({ data: null, error: { code: 'PGRST205' } }),
  maybeSingle: () => Promise.resolve({ data: null, error: { code: 'PGRST205' } }),
  single: () => Promise.resolve({ data: null, error: { code: 'PGRST205' } }),
  then: (resolve: any) => resolve({ data: null, error: null }),
};

vi.mock('@app/config/supabase', () => ({
  supabase: {
    from: () => mockChain,
  },
}));

describe('cash-bills.service', () => {
  const orgId = 'org-test-bills-123';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('não cadastra boleto localmente quando o Supabase não possui a tabela', async () => {
    const res = await cashBillsService.createBill(orgId, {
      description: 'Conta de Energia Elétrica - Cemig',
      category: 'Luz',
      amount: 245.5,
      dueDate: '2026-11-20',
      beneficiaryName: 'CEMIG Distribuição',
      barcode: '836100000021 455000240212 900000000003 000000000004',
    });

    expect(res).toEqual({ success: false, error: 'Não foi possível salvar o boleto no Supabase.' });
    expect(localStorage.length).toBe(0);
  });

  it('propaga a falha remota ao carregar contas e alertas de vencimento', async () => {
    const list = await cashBillsService.listBills(orgId);
    const alerts = await cashBillsService.getUpcomingDueAlerts(orgId);

    expect(list).toEqual({
      success: false,
      error: 'Não foi possível carregar os boletos e contas a pagar.',
    });
    expect(alerts).toEqual({
      success: false,
      error: 'Não foi possível carregar os boletos e contas a pagar.',
    });
  });

  it('não permite baixar ou excluir uma conta que não foi consultada no Supabase', async () => {
    const pay = await cashBillsService.payBill(orgId, 'bill-remote-only', {
      paymentMethod: 'money',
    });
    const remove = await cashBillsService.deleteBill(orgId, 'bill-remote-only');

    expect(pay.success).toBe(false);
    expect(remove.success).toBe(false);
  });

  it('limpa todas as dispensas de alerta ao logar do zero e preserva estado de retomada pós-abertura de caixa', () => {
    cashBillsService.dismissAlertForCurrentSession(orgId);
    expect(cashBillsService.wasAlertDismissedInCurrentSession(orgId)).toBe(true);

    cashBillsService.clearAllAlertDismissals();
    expect(cashBillsService.wasAlertDismissedInCurrentSession(orgId)).toBe(false);

    cashBillsService.savePendingAlertPaymentForCashOpen(orgId, 'bill-123');
    const pending = cashBillsService.consumePendingAlertPaymentForCashOpen(orgId);
    expect(pending).toEqual({ billId: 'bill-123' });
    expect(cashBillsService.consumePendingAlertPaymentForCashOpen(orgId)).toBeNull();
  });
});
