import { useRef, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle,
  CreditCard,
  DollarSign,
  Paperclip,
  QrCode,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
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
      attachmentFile?: File | null;
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
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !bill) return null;

  const parsedAmount =
    parseFloat(paidAmountStr.replace(/[^\d,.-]/g, '').replace(',', '.')) || billAmountNum;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setFileError('Selecione um arquivo de imagem (PNG, JPG) ou documento PDF.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFileError('O arquivo do comprovante deve ter no máximo 10MB.');
      return;
    }

    setAttachmentFile(file);
  };

  const handleRemoveFile = () => {
    setAttachmentFile(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirmPay(bill.id, {
      paymentMethod,
      paidAmount: parsedAmount,
      notes: notes.trim() || undefined,
      deductFromOpenSession: hasOpenSession ? deductFromCash : false,
      attachmentFile,
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
                Confirme o pagamento para registrar a sangria e o comprovante no caixa
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
          {/* Alerta de Caixa Fechado */}
          {!hasOpenSession && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Caixa Geral Fechado</p>
                <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                  É obrigatório que o Caixa Geral esteja aberto para realizar a baixa de faturas/boletos e registrar a sangria no fluxo de caixa. Por favor, abra o caixa antes de continuar.
                </p>
              </div>
            </div>
          )}

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

          {/* Anexo de Comprovante de Pagamento */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Comprovante de Pagamento (Anexo)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            {attachmentFile ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 shrink-0">
                    <Paperclip className="h-4 w-4" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 truncate">
                      {attachmentFile.name}
                    </p>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                      {(attachmentFile.size / 1024).toFixed(0)} KB • Pronto para anexar à sangria
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/50 transition cursor-pointer"
                  title="Remover comprovante"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 p-3 text-xs font-medium text-zinc-600 hover:border-emerald-500 hover:bg-emerald-50/20 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-emerald-500 transition cursor-pointer"
              >
                <Upload className="h-4 w-4 text-zinc-400" />
                <span>Clique para anexar comprovante (PDF ou Imagem)</span>
              </button>
            )}

            {fileError && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fileError}</p>
            )}
          </div>

          {/* Opção de Sangria no Caixa */}
          <label className="flex items-center gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 p-3 text-xs font-medium bg-emerald-50/40 dark:bg-emerald-950/20 cursor-pointer">
            <input
              type="checkbox"
              checked={deductFromCash}
              onChange={(e) => setDeductFromCash(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-zinc-800 dark:text-zinc-200">
              Descontar e registrar saída (sangria) com comprovante no <strong>Caixa Geral</strong>
            </span>
          </label>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Observações / Autenticação (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Pago via app Bancário / Autenticação 98218..."
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
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || parsedAmount <= 0 || !hasOpenSession}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              {isLoading
                ? 'Registrando...'
                : !hasOpenSession
                ? 'Caixa Fechado (Abra o Caixa)'
                : 'Confirmar Pagamento & Sangria'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
