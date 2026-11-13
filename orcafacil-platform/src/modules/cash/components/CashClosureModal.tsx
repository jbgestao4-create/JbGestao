import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CreditCard,
  FileText,
  Printer,
  QrCode,
  X,
} from 'lucide-react';
import type { CashSession, FullSessionReconciliation } from '../domain/cash-session';
import { reconcileFullSession, validateSessionClosure } from '../domain/cash-session';

interface CashClosureModalProps {
  session: CashSession;
  isOpen: boolean;
  onClose: () => void;
  onConfirmClose: (data: {
    countedMoney: number;
    countedPix: number;
    countedCreditCard: number;
    countedDebitCard: number;
    closureReason?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function parseCurrencyInput(val: string): number {
  const cleaned = val.replace(/[^\d,.-]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? Math.max(0, num) : 0;
}

export function CashClosureModal({
  session,
  isOpen,
  onClose,
  onConfirmClose,
  isLoading = false,
}: CashClosureModalProps) {
  const [countedMoneyStr, setCountedMoneyStr] = useState<string>('');
  const [countedPixStr, setCountedPixStr] = useState<string>('');
  const [countedCreditStr, setCountedCreditStr] = useState<string>('');
  const [countedDebitStr, setCountedDebitStr] = useState<string>('');
  const [closureReason, setClosureReason] = useState<string>('');
  const [showPrintReport, setShowPrintReport] = useState<boolean>(false);
  const [lastReconciliation, setLastReconciliation] = useState<FullSessionReconciliation | null>(null);
  const [closedAt, setClosedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setShowPrintReport(false);
      setLastReconciliation(null);
      setCountedMoneyStr('');
      setCountedPixStr('');
      setCountedCreditStr('');
      setCountedDebitStr('');
      setClosureReason('');
      setClosedAt(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const countedMoney = parseCurrencyInput(countedMoneyStr);
  const countedPix = parseCurrencyInput(countedPixStr);
  const countedCredit = parseCurrencyInput(countedCreditStr);
  const countedDebit = parseCurrencyInput(countedDebitStr);

  const recon: FullSessionReconciliation = reconcileFullSession(session as any, {
    countedMoney,
    countedPix,
    countedCreditCard: countedCredit,
    countedDebitCard: countedDebit,
  });

  const validation = validateSessionClosure(session as any, {
    countedMoney,
    countedPix,
    countedCreditCard: countedCredit,
    countedDebitCard: countedDebit,
    closureReason: closureReason.trim() ? closureReason.trim() : undefined,
  });

  const handleFillSystemValues = () => {
    setCountedMoneyStr(recon.money.expected.toFixed(2).replace('.', ','));
    setCountedPixStr(recon.pix.expected.toFixed(2).replace('.', ','));
    setCountedCreditStr(recon.creditCard.expected.toFixed(2).replace('.', ','));
    setCountedDebitStr(recon.debitCard.expected.toFixed(2).replace('.', ','));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid) return;

    setLastReconciliation(recon);
    await onConfirmClose({
      countedMoney,
      countedPix,
      countedCreditCard: countedCredit,
      countedDebitCard: countedDebit,
      closureReason: closureReason.trim() || undefined,
    });
    setClosedAt(new Date());
    setShowPrintReport(true);
  };

  const handlePrint = () => {
    window.print();
  };

  if (showPrintReport && lastReconciliation) {
    return (
      <div className="cash-closure-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:bg-white print:p-0">
        <style>{`
          @media print {
            @page { margin: 4mm; }
            body * { visibility: hidden !important; }
            .cash-closure-print, .cash-closure-print * { visibility: visible !important; }
            .cash-closure-print {
              position: absolute !important;
              inset: 0 auto auto 0 !important;
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 0 !important;
              border: 0 !important;
              box-shadow: none !important;
            }
          }
        `}</style>
        <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 print:max-h-none print:max-w-none print:overflow-visible print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <div className="flex items-center justify-between border-b pb-4 dark:border-zinc-800 print:hidden">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Comprovante de Fechamento de Caixa
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Sessão: {session.id.slice(0, 8)} • Terminal: {session.registerName || session.registerId}
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

          <div className="cash-closure-print mx-auto mt-4 w-full space-y-4 rounded-xl border border-dashed border-gray-300 bg-white p-5 font-mono text-xs text-gray-800 print:mt-0 print:space-y-3 print:border-0 print:p-0 print:text-black">
            <div className="border-b border-gray-200 pb-3 text-center">
              <img src="/controlesoft-logo.png" alt="ControleSoft" className="mx-auto mb-2 h-14 object-contain" />
              <p className="text-sm font-bold uppercase tracking-wider">CONTROLESOFT</p>
              <p className="mt-0.5 text-[11px] text-gray-500">COMPROVANTE DE FECHAMENTO DE CAIXA</p>
              <p className="mt-1 text-[10px] text-gray-500">
                {new Intl.DateTimeFormat('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hourCycle: 'h23',
                }).format(closedAt || new Date())}
              </p>
              <p className="mt-1 text-[10px]">Sessão: {session.id.slice(0, 8)}</p>
              <p className="text-[10px]">Terminal: {session.registerName || session.registerId}</p>
            </div>

            <div className="space-y-1.5 border-b border-gray-200 pb-3 text-[11px]">
              <p><span className="font-semibold">Operador:</span> {session.operatorName || session.operatorId}</p>
              <p><span className="font-semibold">Abertura:</span> {new Date(session.openedAt).toLocaleString('pt-BR')}</p>
              <p><span className="font-semibold">Fechamento:</span> {(closedAt || new Date()).toLocaleString('pt-BR')}</p>
              <p>
                <span className="font-semibold">Status:</span>{' '}
                {lastReconciliation.hasDiscrepancy ? 'Fechado com Divergência' : 'Fechamento Exato'}
              </p>
            </div>

            <div className="space-y-3 border-b border-gray-200 pb-3">
              {[
                { label: 'Dinheiro em Espécie', result: lastReconciliation.money },
                { label: 'PIX', result: lastReconciliation.pix },
                { label: 'Cartão de Crédito', result: lastReconciliation.creditCard },
                { label: 'Cartão de Débito', result: lastReconciliation.debitCard },
              ].map(({ label, result }) => (
                <div key={label} className="space-y-0.5 text-[11px]">
                  <p className="font-bold">{label}</p>
                  <div className="flex justify-between gap-2">
                    <span>Esperado:</span>
                    <span className="whitespace-nowrap">{formatCurrency(result.expected)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Contado:</span>
                    <span className="whitespace-nowrap">{formatCurrency(result.counted)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Diferença:</span>
                    <span className="whitespace-nowrap font-semibold">{formatCurrency(result.difference)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-0.5 border-b border-gray-200 pb-3 text-[11px]">
              <p className="mb-1 font-bold">TOTAL GERAL</p>
              <div className="flex justify-between gap-2">
                <span>Esperado:</span>
                <span className="whitespace-nowrap">{formatCurrency(lastReconciliation.totals.totalExpected)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Contado:</span>
                <span className="whitespace-nowrap">{formatCurrency(lastReconciliation.totals.totalCounted)}</span>
              </div>
              <div className="flex justify-between gap-2 font-bold">
                <span>Diferença:</span>
                <span className="whitespace-nowrap">{formatCurrency(lastReconciliation.totals.totalDifference)}</span>
              </div>
            </div>

            {closureReason && (
              <div className="text-[11px]">
                <p className="font-semibold">Justificativa da Divergência:</p>
                <p className="mt-1 whitespace-pre-wrap">{closureReason}</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t pt-4 dark:border-zinc-800 print:hidden">
            <button
              onClick={handlePrint}
              type="button"
              className="flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Printer className="h-4 w-4" />
              Imprimir Relatório
            </button>
            <button
              onClick={onClose}
              type="button"
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Concluir
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-2.5 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Fechamento de Caixa & Conferência Cega
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Insira os valores reais apurados para Dinheiro, PIX e Cartões.
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          {/* Aviso de Controle Gerencial Interno (Termos de Uso) */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 leading-relaxed">
            <strong>Aviso Importante (Termos de Uso):</strong> O sistema realiza controle gerencial interno. A emissão fiscal oficial e o pagamento de boletos/tributos devem ser realizados nos canais governamentais e bancários oficiais.
          </div>

          <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3.5 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Terminal Aberto</p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {session.registerName || session.registerId}
              </p>
            </div>
            <button
              type="button"
              onClick={handleFillSystemValues}
              className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Preencher com valores do sistema
            </button>
          </div>

          {/* Formas de Pagamento Inputs */}
          <div className="space-y-3">
            {/* Dinheiro */}
            <div className="rounded-xl border border-zinc-200 p-3.5 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Dinheiro em Espécie (Físico no Caixa)
                  </span>
                </div>
                <span className="text-xs text-zinc-500">
                  Esperado: {formatCurrency(recon.money.expected)}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-400">R$</span>
                  <input
                    type="text"
                    required
                    placeholder="0,00"
                    value={countedMoneyStr}
                    onChange={(e) => setCountedMoneyStr(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm font-medium focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                {countedMoneyStr !== '' && (
                  <span
                    className={`text-xs font-semibold ${
                      recon.money.difference === 0
                        ? 'text-emerald-600'
                        : recon.money.difference < 0
                        ? 'text-rose-600'
                        : 'text-blue-600'
                    }`}
                  >
                    Dif: {formatCurrency(recon.money.difference)}
                  </span>
                )}
              </div>
            </div>

            {/* PIX */}
            <div className="rounded-xl border border-zinc-200 p-3.5 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-teal-500" />
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    PIX (Extrato Bancário)
                  </span>
                </div>
                <span className="text-xs text-zinc-500">
                  Esperado: {formatCurrency(recon.pix.expected)}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-400">R$</span>
                  <input
                    type="text"
                    required
                    placeholder="0,00"
                    value={countedPixStr}
                    onChange={(e) => setCountedPixStr(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm font-medium focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                {countedPixStr !== '' && (
                  <span
                    className={`text-xs font-semibold ${
                      recon.pix.difference === 0
                        ? 'text-emerald-600'
                        : recon.pix.difference < 0
                        ? 'text-rose-600'
                        : 'text-blue-600'
                    }`}
                  >
                    Dif: {formatCurrency(recon.pix.difference)}
                  </span>
                )}
              </div>
            </div>

            {/* Cartão de Crédito */}
            <div className="rounded-xl border border-zinc-200 p-3.5 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-purple-500" />
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Cartão de Crédito (Maquininhas/Comprovantes)
                  </span>
                </div>
                <span className="text-xs text-zinc-500">
                  Esperado: {formatCurrency(recon.creditCard.expected)}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-400">R$</span>
                  <input
                    type="text"
                    required
                    placeholder="0,00"
                    value={countedCreditStr}
                    onChange={(e) => setCountedCreditStr(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm font-medium focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                {countedCreditStr !== '' && (
                  <span
                    className={`text-xs font-semibold ${
                      recon.creditCard.difference === 0
                        ? 'text-emerald-600'
                        : recon.creditCard.difference < 0
                        ? 'text-rose-600'
                        : 'text-blue-600'
                    }`}
                  >
                    Dif: {formatCurrency(recon.creditCard.difference)}
                  </span>
                )}
              </div>
            </div>

            {/* Cartão de Débito */}
            <div className="rounded-xl border border-zinc-200 p-3.5 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-indigo-500" />
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Cartão de Débito (Maquininhas/Comprovantes)
                  </span>
                </div>
                <span className="text-xs text-zinc-500">
                  Esperado: {formatCurrency(recon.debitCard.expected)}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-400">R$</span>
                  <input
                    type="text"
                    required
                    placeholder="0,00"
                    value={countedDebitStr}
                    onChange={(e) => setCountedDebitStr(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm font-medium focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                {countedDebitStr !== '' && (
                  <span
                    className={`text-xs font-semibold ${
                      recon.debitCard.difference === 0
                        ? 'text-emerald-600'
                        : recon.debitCard.difference < 0
                        ? 'text-rose-600'
                        : 'text-blue-600'
                    }`}
                  >
                    Dif: {formatCurrency(recon.debitCard.difference)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Resumo de Diferença Geral */}
          <div
            className={`rounded-xl p-4 border ${
              recon.hasDiscrepancy
                ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-2">
                {recon.hasDiscrepancy ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                )}
                {recon.hasDiscrepancy
                  ? 'Divergência detectada entre valores apurados e esperados'
                  : 'Valores 100% conferidos com o sistema'}
              </span>
              <span className="text-base">
                Dif. Total: {formatCurrency(recon.totals.totalDifference)}
              </span>
            </div>
            {recon.hasDiscrepancy && (
              <p className="mt-1 text-xs opacity-90">
                Uma justificativa é obrigatória para registrar o fechamento quando houver sobra ou falta de caixa.
              </p>
            )}
          </div>

          {/* Justificativa caso haja divergência */}
          {recon.hasDiscrepancy && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Justificativa da Divergência <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Explique o motivo da divergência apurada (ex: diferença de troco, comprovante pendente, taxa não abatida)..."
                value={closureReason}
                onChange={(e) => setClosureReason(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 p-3 text-sm focus:border-amber-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          )}

          {/* Erros de validação */}
          {!validation.isValid && (
            <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              <ul className="list-disc pl-4 space-y-1">
                {(validation.errors || []).map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

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
              disabled={!validation.isValid || isLoading}
              className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {isLoading ? 'Fechando Caixa...' : 'Confirmar e Fechar Caixa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
