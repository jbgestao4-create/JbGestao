import { useState } from 'react';
import { Banknote, CheckCircle, CreditCard, DollarSign, QrCode, X } from 'lucide-react';
import type { CashBill } from '../services/cash-bills.service';

interface PayBillModalProps {
  bill: CashBill | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmPay: (
    billId: string,
    params: {
      paymentMethod: 'money' | 'pix' | 'debit_card' | 'credit_card' | 'bank_transfer';
      paidAmount: number;
      notes?: string;
      deductFromOpenSession?: boolean;
    }
  ) => Promise<void>;
  hasOpenSession: boolean;
  isLoading?: boolean;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val);
}

export function PayBillModal({
  bill,
  isOpen,
  onClose,
  onConfirmPay,
  hasOpenSession,
  isLoading = false,
}: PayBillModalProps) {
  const billAmountNum = bill ? parseFloat(bill.amount) || 0 : 0;
  const [paymentMethod, setPaymentMethod] = useState<
    'money' | 'pix' | 'debit_card' | 'credit_card' | 'bank_transfer'
  >('money');
  const [paidAmountStr, setPaidAmountStr] = useState<string>(
    bill ? billAmountNum.toFixed(2).replace('.', ',') : ''
  );
  const [deductFromCash, setDeductFromCash] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');

  if (!isOpen || !bill) return null;

  const parsedAmount =
    parseFloat(paidAmountStr.replace(/[^\d,.-]/g, '').replace(',', '.')) || billAmountNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirmPay(bill.id, {
      paymentMethod,
      paidAmount: parsedAmount,
      notes: notes.trim() || undefined,
      deductFromOpenSession: hasOpenSession ? deductFromCash : false,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between border-b pb-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Dar Baixa / Pagar Boleto
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Confirme o pagamento para registrar a saída financeira
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">{bill.description}</p>
                <p className="text-xs text-zinc-500">
                  {bill.beneficiaryName ? `Beneficiário: ${bill.beneficiaryName}` : `Categoria: ${bill.category}`}
                </p>
                {bill.supplierName && (
                  <p className="text-xs text-zinc-500">Fornecedor: {bill.supplierName}</p>
                )}
              </div>
              <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {formatCurrency(billAmountNum)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Valor Efetivamente Pago (R$)
            </label>
            <input
              type="text"
              required
              value={paidAmountStr}
              onChange={(e) => setPaidAmountStr(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Forma de Pagamento
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('money')}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                  paymentMethod === 'money'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300'
                }`}
              >
                <Banknote className="h-4 w-4 text-emerald-600" />
                Dinheiro em Espécie
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('pix')}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                  paymentMethod === 'pix'
                    ? 'border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300'
                    : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300'
                }`}
              >
                <QrCode className="h-4 w-4 text-teal-600" />
                PIX
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('debit_card')}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                  paymentMethod === 'debit_card'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'
                    : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300'
                }`}
              >
                <CreditCard className="h-4 w-4 text-indigo-600" />
                Cartão de Débito
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('credit_card')}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                  paymentMethod === 'credit_card'
                    ? 'border-purple-500 bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300'
                    : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300'
                }`}
              >
                <CreditCard className="h-4 w-4 text-purple-600" />
                Cartão de Crédito
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('bank_transfer')}
                className={`col-span-2 flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                  paymentMethod === 'bank_transfer'
                    ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300'
                }`}
              >
                <DollarSign className="h-4 w-4 text-blue-600" />
                Transferência / Boleto Bancário
              </button>
            </div>
          </div>

          {hasOpenSession && (
            <label className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3 text-xs font-medium dark:border-zinc-800 cursor-pointer bg-zinc-50/50 dark:bg-zinc-800/30">
              <input
                type="checkbox"
                checked={deductFromCash}
                onChange={(e) => setDeductFromCash(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                Lançar saída (sangria/pagamento) automaticamente no <strong>caixa aberto atual</strong>
              </span>
            </label>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Observações / Comprovante (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Pago via app Nubank / Autenticação 98218..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div className="flex justify-end gap-3 border-t pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || parsedAmount <= 0}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isLoading ? 'Registrando...' : 'Confirmar Pagamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
