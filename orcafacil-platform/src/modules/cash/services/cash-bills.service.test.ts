import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cashBillsService } from './cash-bills.service';

const mockChain: any = {
  select: () => mockChain,
  insert: () => mockChain,
  update: () => mockChain,
  delete: () => mockChain,
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
    localStorage.clear();
  });

  it('deve cadastrar um boleto e listá-lo', async () => {
    const res = await cashBillsService.createBill(orgId, {
      description: 'Conta de Energia Elétrica - Cemig',
      category: 'Luz',
      amount: 245.5,
      dueDate: '2026-11-20',
      beneficiaryName: 'CEMIG Distribuição',
      barcode: '836100000021 455000240212 900000000003 000000000004',
    });

    expect(res.success).toBe(true);
    expect((res as any).data?.id).toBeDefined();
    expect((res as any).data?.status).toBe('pending');
    expect((res as any).data?.amount).toBe('245.50');

    const listRes = await cashBillsService.listBills(orgId);
    expect(listRes.success).toBe(true);
    expect((listRes as any).data).toHaveLength(1);
    expect((listRes as any).data?.[0].description).toBe('Conta de Energia Elétrica - Cemig');
  });

  it('deve filtrar boletos com vencimento nos próximos 10 dias pendentes', async () => {
    const today = new Date();

    // Boleto vencendo em 3 dias (deve disparar alerta)
    const in3Days = new Date(today);
    in3Days.setDate(today.getDate() + 3);

    // Boleto vencendo em 20 dias (fora da janela de 10 dias)
    const in20Days = new Date(today);
    in20Days.setDate(today.getDate() + 20);

    // Boleto já pago vencendo em 2 dias (não deve disparar alerta)
    const in2Days = new Date(today);
    in2Days.setDate(today.getDate() + 2);

    await cashBillsService.createBill(orgId, {
      description: 'Água Copasa',
      category: 'Água',
      amount: 90.0,
      dueDate: in3Days.toISOString().split('T')[0],
    });

    await cashBillsService.createBill(orgId, {
      description: 'Aluguel Prédio',
      category: 'Aluguel',
      amount: 1500.0,
      dueDate: in20Days.toISOString().split('T')[0],
    });

    const paidBillRes = await cashBillsService.createBill(orgId, {
      description: 'Internet Fibra',
      category: 'Internet',
      amount: 119.9,
      dueDate: in2Days.toISOString().split('T')[0],
    });

    // Paga a fatura de internet
    if ((paidBillRes as any).data) {
      await cashBillsService.payBill(orgId, (paidBillRes as any).data.id, {
        paymentMethod: 'pix',
        paidAmount: 119.9,
      });
    }

    const alerts = await cashBillsService.getUpcomingDueAlerts(orgId);
    expect(alerts.success).toBe(true);
    expect((alerts as any).data).toHaveLength(1);
    expect((alerts as any).data?.[0].description).toBe('Água Copasa');
  });

  it('deve permitir pagar (dar baixa) em um boleto e registrar data de pagamento', async () => {
    const createRes = await cashBillsService.createBill(orgId, {
      description: 'Material Fornecedor ABC',
      category: 'Fornecedor',
      amount: 450.0,
      dueDate: '2026-11-15',
    });

    const billId = (createRes as any).data!.id;

    const payRes = await cashBillsService.payBill(orgId, billId, {
      paymentMethod: 'money',
      paidAmount: 450.0,
      notes: 'Pago em dinheiro no balcão',
    });

    expect(payRes.success).toBe(true);
    expect((payRes as any).data?.status).toBe('paid');
    expect((payRes as any).data?.paidAt).toBeDefined();
    expect((payRes as any).data?.paymentMethod).toBe('money');
  });

  it('deve remover/excluir um boleto', async () => {
    const createRes = await cashBillsService.createBill(orgId, {
      description: 'Boleto Incorreto',
      category: 'Outros',
      amount: 50.0,
      dueDate: '2026-11-18',
    });

    const billId = (createRes as any).data!.id;

    const delRes = await cashBillsService.deleteBill(orgId, billId);
    expect(delRes.success).toBe(true);

    const listRes = await cashBillsService.listBills(orgId);
    expect((listRes as any).data).toHaveLength(0);
  });
});
