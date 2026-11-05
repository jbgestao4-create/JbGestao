import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, DollarSign, X } from 'lucide-react';

interface ManualMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    type: 'supply' | 'bleed';
    amount: number;
    reason: string;
  }) => Promise<void>;
  currentSessionId: string;
  isLoading?: boolean;
}

export function ManualMovementModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: ManualMovementModalProps) {
  const [type, setType] = useState<'supply' | 'bleed'>('supply');
  const [amountStr, setAmountStr] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  if (!isOpen) return null;

  const parsedAmount =
    parseFloat(amountStr.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0 || !reason.trim()) return;

    await onConfirm({
      type,
      amount: parsedAmount,
      reason: reason.trim(),
    });
    setAmountStr('');
    setReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between border-b pb-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-xl p-2.5 ${
                type === 'supply'
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
              }`}
            >
              {type === 'supply' ? (
                <ArrowDownRight className="h-6 w-6" />
              ) : (
                <ArrowUpRight className="h-6 w-6" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Movimentação Manual de Caixa
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Suprimento (entrada de troco) ou Sangria (retirada)
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
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('supply')}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition ${
                type === 'supply'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300'
              }`}
            >
              <ArrowDownRight className="h-4 w-4 text-emerald-600" />
              Suprimento (Entrada)
            </button>
            <button
              type="button"
              onClick={() => setType('bleed')}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition ${
                type === 'bleed'
                  ? 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                  : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300'
              }`}
            >
              <ArrowUpRight className="h-4 w-4 text-rose-600" />
              Sangria (Retirada)
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Valor da Operação (R$) <span className="text-rose-500">*</span>
            </label>
            <div className="relative mt-1">
              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                required
                placeholder="0,00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 py-2 pl-9 pr-3 text-sm font-medium focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Justificativa Obrigatória <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder={
                type === 'supply'
                  ? 'Ex: Reforço de troco em moedas e notas de R$ 5...'
                  : 'Ex: Recolhimento de excesso para cofre / Pagamento urgente de frete...'
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-300 p-3 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
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
              disabled={isLoading || parsedAmount <= 0 || !reason.trim()}
              className={`rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                type === 'supply'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isLoading
                ? 'Gravando...'
                : type === 'supply'
                ? 'Lançar Suprimento'
                : 'Lançar Sangria'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

